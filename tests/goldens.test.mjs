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
import { assertFloatsClose } from './helpers.mjs';

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

test('the noise table regenerates from its seed — exactly where determinism is by construction', () => {
  // Pins the PRNG stream itself: a change to rng.mjs or to draw ORDER breaks this
  // even if the selection law is untouched.
  //
  // `u` and `rngState` are EXACT because they never touch libm: rngState is
  // integer, and u is (uint32 + 0.5) / 2^32, an exactly-representable division.
  // `g` and `G` go through Math.log and drift by ULPs across platforms — see
  // assertFloatsClose. Asserting the split, rather than loosening everything,
  // is what keeps this a real tripwire (ROADMAP Q-006).
  const fresh = createNoiseTable({
    slotCount: GOLDEN_CASE.slotCount,
    cornerCount: GOLDEN_CASE.cornerCount,
    moduleCount: GOLDEN_CASE.moduleCount,
    seed: GOLDEN_CASE.seed,
  });
  const pinned = deserializeNoiseTable(golden.epochs[0].noise);
  assert.deepEqual(Array.from(fresh.u), Array.from(pinned.u), 'u must be bit-exact on every platform');
  assert.equal(fresh.rngState, pinned.rngState, 'rngState is integer — bit-exact');
  assertFloatsClose(fresh.g, pinned.g, 'g');
  assertFloatsClose(fresh.G, pinned.G, 'G');
});

test('the pinned reshuffle reproduces epoch 1', () => {
  const t0 = deserializeNoiseTable(golden.epochs[0].noise);
  const t1 = reshufflePartial(t0, GOLDEN_CASE.reshuffleDepth);
  const pinned = deserializeNoiseTable(golden.epochs[1].noise);
  assert.equal(t1.epoch, pinned.epoch);
  assert.deepEqual(Array.from(t1.u), Array.from(pinned.u), 'which slots were redrawn is exact');
  assertFloatsClose(t1.g, pinned.g, 'g');
  assertFloatsClose(t1.G, pinned.G, 'G');
});

test('the tolerance still catches a real regression', () => {
  // A loosened gate nobody has watched fire is decoration. libm drift is ~1e-16
  // relative; anything a changed PRNG, draw order, or formula produces is O(1).
  const base = Float64Array.from([0.5, -1.25, 3.0]);

  // Drift-sized perturbation: must pass.
  const drifted = Float64Array.from([...base].map((v) => v + 2 * Number.EPSILON * Math.max(1, Math.abs(v))));
  assertFloatsClose(drifted, base, 'drift');

  // Regression-sized: must fail. Even a change 1e9x smaller than a real one fires.
  assert.throws(() => assertFloatsClose(Float64Array.from([0.5, -1.25, 3.0000001]), base, 'regression'));
  assert.throws(() => assertFloatsClose(Float64Array.from([0.5, -1.25]), base, 'length'));
});
