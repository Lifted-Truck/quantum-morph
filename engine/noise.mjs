// Noise table — QM-0 §3 (frozen Gumbel variates), §5.1 (module vectors + the
// per-slot uniform that drives coupling), §7 (reshuffle), §8.2 (the table is
// authoritative state, not something to reconstruct from a seed).
//
// Layout is flat typed arrays rather than nested arrays: one allocation per
// field, index arithmetic instead of pointer chasing, and a serialization that
// is a plain list of numbers in both Node and Max's v8.

import { makeRng, gumbel } from './rng.mjs';

/** Fill g[slot][*] for one slot with fresh Gumbel variates, and its coupling uniform. */
function drawSlot(table, i, rng) {
  const { cornerCount } = table;
  for (let k = 0; k < cornerCount; k++) {
    table.g[i * cornerCount + k] = gumbel(rng);
  }
  table.u[i] = rng.uniform();
}

function drawModule(table, m, rng) {
  const { cornerCount } = table;
  for (let k = 0; k < cornerCount; k++) {
    table.G[m * cornerCount + k] = gumbel(rng);
  }
}

/**
 * Draw a complete noise table.
 *
 * The rng state travels with the table so that a later partial reshuffle
 * continues the same stream — that is what makes a sequence of reshuffles
 * reproducible from serialized state alone (QM-0 §8.2: recall must not depend
 * on replaying an event log).
 */
export function createNoiseTable({ slotCount, cornerCount = 4, moduleCount = 1, seed = 1 }) {
  const table = {
    seed: seed >>> 0,
    epoch: 0,
    slotCount,
    cornerCount,
    moduleCount,
    g: new Float64Array(slotCount * cornerCount),
    u: new Float64Array(slotCount),
    G: new Float64Array(moduleCount * cornerCount),
    rngState: 0,
  };
  const rng = makeRng(seed);
  for (let i = 0; i < slotCount; i++) drawSlot(table, i, rng);
  for (let m = 0; m < moduleCount; m++) drawModule(table, m, rng);
  table.rngState = rng.state;
  return table;
}

export function cloneNoiseTable(t) {
  return {
    ...t,
    g: Float64Array.from(t.g),
    u: Float64Array.from(t.u),
    G: Float64Array.from(t.G),
  };
}

/**
 * Full reshuffle (QM-0 §7): new seed, redraw everything, epoch += 1.
 * Epoch survives the reseed — it counts reshuffle events, not table generations.
 */
export function reshuffleFull(table, newSeed) {
  const next = createNoiseTable({
    slotCount: table.slotCount,
    cornerCount: table.cornerCount,
    moduleCount: table.moduleCount,
    seed: newSeed,
  });
  next.epoch = table.epoch + 1;
  return next;
}

/**
 * Partial reshuffle (QM-0 §7): redraw a fraction `d` of slots chosen uniformly,
 * plus each module vector with probability `d`. Epoch += 1.
 *
 * The two halves are deliberately different mechanisms because the spec states
 * them differently: slots are "a fraction d ... chosen uniformly" (an exact
 * count, drawn without replacement) while modules are "with probability d" (an
 * independent Bernoulli each). At small module counts the distinction is
 * audible — Bernoulli can leave every module untouched, which is a legitimate
 * quiet reshuffle; an exact count could not.
 */
export function reshufflePartial(table, d) {
  if (!(d >= 0.05 && d <= 1)) {
    throw new RangeError(`reshufflePartial: depth ${d} outside QM-0 §7 range [0.05, 1.0]`);
  }
  const next = cloneNoiseTable(table);
  const rng = makeRng(0);
  rng.state = table.rngState;

  // Partial Fisher-Yates over an index array: picks exactly `count` distinct
  // slots without building a Set or rejection-sampling duplicates.
  const count = Math.round(d * next.slotCount);
  const idx = new Int32Array(next.slotCount);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  for (let n = 0; n < count; n++) {
    const j = n + rng.below(idx.length - n);
    const tmp = idx[n];
    idx[n] = idx[j];
    idx[j] = tmp;
    drawSlot(next, idx[n], rng);
  }

  for (let m = 0; m < next.moduleCount; m++) {
    if (rng.uniform() < d) drawModule(next, m, rng);
  }

  next.rngState = rng.state;
  next.epoch = table.epoch + 1;
  return next;
}

/** Serialize to JSON-safe plain values (QM-0 §8.1 — the table is authoritative). */
export function serializeNoiseTable(t) {
  return {
    seed: t.seed,
    epoch: t.epoch,
    slotCount: t.slotCount,
    cornerCount: t.cornerCount,
    moduleCount: t.moduleCount,
    rngState: t.rngState,
    g: Array.from(t.g),
    u: Array.from(t.u),
    G: Array.from(t.G),
  };
}

export function deserializeNoiseTable(o) {
  return {
    seed: o.seed,
    epoch: o.epoch,
    slotCount: o.slotCount,
    cornerCount: o.cornerCount,
    moduleCount: o.moduleCount,
    rngState: o.rngState,
    g: Float64Array.from(o.g),
    u: Float64Array.from(o.u),
    G: Float64Array.from(o.G),
  };
}
