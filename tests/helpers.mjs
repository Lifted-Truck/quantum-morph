// Shared fixtures. Not a *.test.mjs file, so the runner does not treat it as a suite.

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
