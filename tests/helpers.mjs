// Shared fixtures. Not a *.test.mjs file, so the runner does not treat it as a suite.

import assert from 'node:assert/strict';
import { MODE } from '../engine/index.mjs';

/** A slot list of `n` AUTO/discrete slots spread over `moduleCount` modules. */
export function makeSlots(n, { moduleCount = 1, salience = 1.0, mode = MODE.AUTO, discrete = true } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    mode,
    discrete,
    salience,
    module: i % moduleCount,
  }));
}

/** Positions used by the census tests — a dozen sampled points, per QM-0 §10.2. */
export const SAMPLE_POSITIONS = [
  [0.5, 0.5],
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
  [0.1, 0.5],
  [0.9, 0.5],
  [0.5, 0.1],
  [0.5, 0.9],
  [0.3, 0.6],
  [0.65, 0.4],
  [0.15, 0.85],
];

export const maxAbsDiff = (a, b) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
};

/**
 * Compare float arrays that pass through `Math.log`.
 *
 * `Math.log` is NOT bit-identical across platforms and V8 builds: goldens
 * generated on darwin-arm64 differ from ubuntu-x64 in the last ULP, which is
 * how CI went red on 2026-08-05 against an engine that was correct (ROADMAP
 * Q-006). QM-0 §10.1 requires bit-identical ASSIGNMENTS, not bit-identical
 * variates, and assignments survive this drift because argmax margins are
 * enormous compared to it.
 *
 * The tolerance is deliberately tiny. A real regression — a changed PRNG, a
 * changed draw order, a changed formula — moves these values by O(1), roughly
 * fifteen orders of magnitude more than libm drift, so this still fires.
 */
export function assertFloatsClose(actual, expected, message, ulps = 8) {
  assert.equal(actual.length, expected.length, `${message}: length`);
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];
    const tol = ulps * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(e));
    assert.ok(
      Math.abs(a - e) <= tol,
      `${message}: index ${i} — got ${a}, want ${e} (delta ${Math.abs(a - e)}, tol ${tol})`,
    );
  }
}
