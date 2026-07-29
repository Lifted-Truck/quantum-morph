// Selection law and slot modes — QM-0 §3, §4, §5.
//
// This module is the heart of the instrument and the reason it is not a random
// patch generator: given the same (position, state, noise table) it returns the
// same assignment, forever, on every platform.

import { cornerWeights, logWeights } from './weights.mjs';

/** Slot modes, QM-0 §4. Resolution order is first-match-wins, top to bottom. */
export const MODE = Object.freeze({
  FROZEN: 'FROZEN',
  PINNED: 'PINNED',
  QUANTUM: 'QUANTUM',
  GRADUAL: 'GRADUAL',
  AUTO: 'AUTO',
});

// Sentinels in the assignment array for slots that resolve to no single corner.
// Negative so they can never collide with a corner index, and named so a reader
// of a golden file can tell a gradual slot from corner 0 at a glance.
export const SLOT_GRADUAL = -1;
export const SLOT_FROZEN = -2;

/** Global policy for continuous slots under AUTO (QM-0 §4). */
export const CONTINUOUS_POLICY = Object.freeze({ QUANTUM: 'quantum', GRADUAL: 'gradual' });

/**
 * Config-time validation. QM-0 §4: a discrete slot set to GRADUAL is "a
 * configuration error: reject it at the UI level rather than silently coercing".
 *
 * This is a separate call rather than a check inside select() on purpose — the
 * selection path runs per field move and must not throw or branch on config
 * errors; the device validates once when the slot list changes.
 * Returns [] when the slot list is valid.
 */
export function validateSlots(slots, cornerCount = 4) {
  const issues = [];
  slots.forEach((s, i) => {
    if (s.discrete && s.mode === MODE.GRADUAL) {
      issues.push({ slot: i, code: 'DISCRETE_GRADUAL', message: 'discrete slot cannot be GRADUAL (QM-0 §4)' });
    }
    if (s.mode === MODE.PINNED && !(Number.isInteger(s.pin) && s.pin >= 0 && s.pin < cornerCount)) {
      issues.push({ slot: i, code: 'BAD_PIN', message: `PINNED slot needs a corner index in [0,${cornerCount})` });
    }
    if (s.salience !== undefined && !(s.salience >= 0.1 && s.salience <= 4.0)) {
      issues.push({ slot: i, code: 'SALIENCE_RANGE', message: 'salience outside QM-0 §3.2 range [0.1, 4.0]' });
    }
  });
  return issues;
}

/**
 * argmax_k of σ·log(w[k])/T + noise[k], QM-0 §3.
 *
 * Ties break to the lowest k (§3.3): the comparison is a strict `>` and k ascends,
 * so an exactly-equal score never displaces the incumbent. Do not "optimise" this
 * into `>=` — that makes the winner depend on iteration order, which is precisely
 * the platform-dependent behaviour §3.3 forbids.
 */
function argmaxScore(logW, sigma, T, noise, noiseOffset, cornerCount) {
  let best = -Infinity;
  let bestK = -1;
  const scale = sigma / T;
  for (let k = 0; k < cornerCount; k++) {
    const lw = logW[k];
    if (lw === -Infinity) continue; // zero-weight corner can never win (§3)
    const score = scale * lw + noise[noiseOffset + k];
    if (score > best) {
      best = score;
      bestK = k;
    }
  }
  // Unreachable while Σw = 1 (some corner always exceeds ZERO_WEIGHT). Falling
  // back to corner 0 rather than returning -1 keeps the assignment array
  // well-typed if a caller ever hands in hand-built degenerate weights.
  return bestK === -1 ? 0 : bestK;
}

/**
 * Resolve every slot to a corner index (or a sentinel) for one field position.
 *
 * @param {object}  cfg
 * @param {Array}   cfg.slots     [{mode, pin, salience, discrete, module}]
 * @param {number}  cfg.x,cfg.y   field position
 * @param {number}  cfg.T         global temperature, QM-0 §3.1
 * @param {number}  cfg.coupling  c ∈ [0,1], QM-0 §5.1
 * @param {object}  cfg.noise     noise table
 * @param {string}  cfg.continuousPolicy  policy for continuous AUTO slots
 * @param {Int32Array} [cfg.out]  optional destination, reused to avoid per-move allocation
 * @returns {Int32Array} assignment a[i]
 */
export function selectAssignment({
  slots,
  x,
  y,
  T = 1.0,
  coupling = 0,
  noise,
  continuousPolicy = CONTINUOUS_POLICY.QUANTUM,
  out,
}) {
  const cornerCount = noise.cornerCount;
  const w = cornerWeights(x, y, cornerCount);
  const logW = logWeights(w);
  const a = out && out.length === slots.length ? out : new Int32Array(slots.length);

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const mode = s.mode || MODE.AUTO;

    if (mode === MODE.FROZEN) {
      a[i] = SLOT_FROZEN;
      continue;
    }
    if (mode === MODE.PINNED) {
      a[i] = s.pin;
      continue;
    }
    if (mode === MODE.GRADUAL) {
      a[i] = SLOT_GRADUAL;
      continue;
    }
    if (mode === MODE.AUTO && !s.discrete && continuousPolicy === CONTINUOUS_POLICY.GRADUAL) {
      a[i] = SLOT_GRADUAL;
      continue;
    }
    // QUANTUM, or AUTO resolving to quantum — which discrete slots ALWAYS do (§4).

    // Coupling, QM-0 §5.1: the slot either reads its own frozen Gumbel vector or
    // borrows its module's, chosen by its own frozen uniform against c. Selecting
    // between two valid Gumbel vectors (rather than blending them) is what keeps
    // the marginal exact at every c — the prototype's blend does not.
    const coupled = noise.u[i] < coupling;
    const src = coupled ? noise.G : noise.g;
    const row = (coupled ? (s.module | 0) : i) * cornerCount;

    // Salience is a per-slot temperature divisor: T[i] = T / σ[i] (§3.2).
    a[i] = argmaxScore(logW, s.salience === undefined ? 1.0 : s.salience, T, src, row, cornerCount);
  }
  return a;
}

/**
 * Corner-population census: the fraction of quantum-resolved slots owned by each
 * corner. This is the quantity QM-0 §10.2 pins against the bilinear weights, and
 * the one §10.3 requires to be invariant as coupling sweeps.
 */
export function census(assignment, cornerCount) {
  const counts = new Float64Array(cornerCount);
  let n = 0;
  for (let i = 0; i < assignment.length; i++) {
    const k = assignment[i];
    if (k < 0) continue; // gradual/frozen slots are not part of the corner population
    counts[k] += 1;
    n += 1;
  }
  if (n > 0) for (let k = 0; k < cornerCount; k++) counts[k] /= n;
  return counts;
}
