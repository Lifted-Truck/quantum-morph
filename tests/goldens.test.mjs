// Golden vectors — exact-match. This is the gate that catches silent drift in the
// selection law, the PRNG stream, or the noise-table layout.
//
// A failure here is NEVER fixed by regenerating: tests/goldens/ is protected
// (CLAUDE.md §Domain), and a changed golden means either a real regression or a
// deliberate spec change that needs a human decision in ROADMAP first.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deserializeNoiseTable,
  selectAssignment,
  reshufflePartial,
  createNoiseTable,
  CONTINUOUS_POLICY,
} from '../engine/index.mjs';
import { GOLDEN_CASE, buildSlots } from './golden-case.mjs';

const golden = JSON.parse(
  readFileSync(new URL('./goldens/qm0-selection.json', import.meta.url), 'utf8'),
);

test('the golden fixture still describes the case under test', () => {
  // Guards against the subtle failure where someone edits golden-case.mjs and the
  // vectors quietly start describing a different experiment.
  assert.deepEqual(JSON.parse(JSON.stringify(GOLDEN_CASE)), golden.case);
});

test('pinned assignments match exactly across the position grid', () => {
  const slots = buildSlots();
  let rows = 0;
  for (const epoch of golden.epochs) {
    const noise = deserializeNoiseTable(epoch.noise);
    for (const row of epoch.rows) {
      const a = selectAssignment({
        slots,
        x: row.x,
        y: row.y,
        T: row.T,
        coupling: row.c,
        noise,
        continuousPolicy: CONTINUOUS_POLICY.GRADUAL,
      });
      assert.deepEqual(
        Array.from(a),
        row.a,
        `epoch ${epoch.epoch}, T=${row.T} c=${row.c} at (${row.x},${row.y})`,
      );
      rows += 1;
    }
  }
  assert.equal(rows, golden.epochs.length * GOLDEN_CASE.settings.length * GOLDEN_CASE.grid.length);
});

test('the noise table regenerates bit-identically from its seed', () => {
  // Pins the PRNG stream itself: a change to rng.mjs or to draw ORDER breaks this
  // even if the selection law is untouched.
  const fresh = createNoiseTable({
    slotCount: GOLDEN_CASE.slotCount,
    cornerCount: GOLDEN_CASE.cornerCount,
    moduleCount: GOLDEN_CASE.moduleCount,
    seed: GOLDEN_CASE.seed,
  });
  const pinned = deserializeNoiseTable(golden.epochs[0].noise);
  assert.deepEqual(Array.from(fresh.g), Array.from(pinned.g));
  assert.deepEqual(Array.from(fresh.u), Array.from(pinned.u));
  assert.deepEqual(Array.from(fresh.G), Array.from(pinned.G));
  assert.equal(fresh.rngState, pinned.rngState);
});

test('the pinned reshuffle reproduces epoch 1 exactly', () => {
  const t0 = deserializeNoiseTable(golden.epochs[0].noise);
  const t1 = reshufflePartial(t0, GOLDEN_CASE.reshuffleDepth);
  const pinned = deserializeNoiseTable(golden.epochs[1].noise);
  assert.equal(t1.epoch, pinned.epoch);
  assert.deepEqual(Array.from(t1.g), Array.from(pinned.g));
  assert.deepEqual(Array.from(t1.u), Array.from(pinned.u));
  assert.deepEqual(Array.from(t1.G), Array.from(pinned.G));
});
