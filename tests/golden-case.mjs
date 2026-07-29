// The one fixture that both the golden generator and the golden test read, so a
// drift in the CASE can never be mistaken for a drift in the ENGINE: if this file
// changes, the goldens fail loudly rather than silently re-describing a new case.

import { MODE } from '../engine/index.mjs';

export const GOLDEN_CASE = Object.freeze({
  slotCount: 64, // QM-1 §2 v1 ceiling
  cornerCount: 4,
  moduleCount: 8,
  seed: 40219,
  reshuffleDepth: 0.35,
  // (T, c) pairs spanning the documented behaviour bands of QM-0 §3.1 and §5.1:
  // hard switch, mostly-dominant, honest proportional, near-uniform; uncoupled,
  // useful range, module-atomic.
  settings: [
    [0.02, 0],
    [0.3, 0],
    [1.0, 0],
    [1.0, 0.4],
    [1.0, 1.0],
    [2.5, 0.4],
  ],
  grid: (() => {
    const g = [];
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) g.push([i / 8, j / 8]);
    return g;
  })(),
});

/**
 * The slot list under test: a deliberate mix so every branch of the mode
 * resolution in QM-0 §4 appears in the goldens — including the sentinels, which
 * would otherwise never be exercised by a pinned vector.
 */
export function buildSlots() {
  return Array.from({ length: GOLDEN_CASE.slotCount }, (_, i) => {
    const module = i % GOLDEN_CASE.moduleCount;
    if (i % 16 === 5) return { mode: MODE.FROZEN, discrete: true, module };
    if (i % 16 === 9) return { mode: MODE.PINNED, pin: (i / 16) | 0, discrete: true, module };
    if (i % 16 === 13) return { mode: MODE.GRADUAL, discrete: false, module };
    if (i % 4 === 2) return { mode: MODE.AUTO, discrete: false, salience: 0.5, module };
    if (i % 4 === 3) return { mode: MODE.QUANTUM, discrete: false, salience: 3.0, module };
    return { mode: MODE.AUTO, discrete: true, salience: 1.0 + (i % 5) * 0.5, module };
  });
}
