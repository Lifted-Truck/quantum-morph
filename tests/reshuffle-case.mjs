// The reshuffle-lifecycle fixture, shared by generator and test (same pattern as
// golden-case.mjs: a changed CASE fails loudly instead of silently re-describing
// itself).

import { MODE } from '../engine/index.mjs';

export const RESHUFFLE_CASE = Object.freeze({
  slotCount: 32,
  cornerCount: 4,
  moduleCount: 4,
  seed: 1024,
  // A scripted lifetime: both reshuffle kinds, both extremes of the depth range,
  // and a full reshuffle in the MIDDLE of the chain — the ordering that would
  // catch a generator-state leak across a reseed.
  script: [
    { op: 'partial', d: 0.05 },
    { op: 'partial', d: 0.5 },
    { op: 'partial', d: 1.0 },
    { op: 'full', seed: 2048 },
    { op: 'partial', d: 0.25 },
    { op: 'partial', d: 0.05 },
  ],
  probe: [
    [0.5, 0.5],
    [0.2, 0.8],
    [0.85, 0.15],
  ],
  T: 1.0,
  coupling: 0.4,
});

/** Plain AUTO/discrete slots — this fixture is about the TABLE, not mode coverage. */
export function buildSlots() {
  return Array.from({ length: RESHUFFLE_CASE.slotCount }, (_, i) => ({
    mode: MODE.AUTO,
    discrete: true,
    salience: 1.0,
    module: i % RESHUFFLE_CASE.moduleCount,
  }));
}
