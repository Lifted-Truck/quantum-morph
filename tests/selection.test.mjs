// QM-0 §3–§5 selection law, and the acceptance tests of §10 that the engine can
// answer on its own (1–6; 7 and 8 are device-layer and live in QM-1's phase).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNoiseTable,
  selectAssignment,
  census,
  cornerWeights,
  MODE,
  CONTINUOUS_POLICY,
  SLOT_GRADUAL,
  SLOT_FROZEN,
  validateSlots,
} from '../engine/index.mjs';
import { makeSlots, SAMPLE_POSITIONS, maxAbsDiff } from './helpers.mjs';

// §10.1 — determinism.
test('same state and position produce an identical assignment', () => {
  const slots = makeSlots(64, { moduleCount: 8 });
  const noise = createNoiseTable({ slotCount: 64, moduleCount: 8, seed: 40219 });
  const a = selectAssignment({ slots, x: 0.37, y: 0.62, T: 1, coupling: 0.4, noise });
  const b = selectAssignment({ slots, x: 0.37, y: 0.62, T: 1, coupling: 0.4, noise });
  assert.deepEqual(Array.from(a), Array.from(b));
});

test('a table rebuilt from the same seed reproduces the same assignment', () => {
  const slots = makeSlots(64, { moduleCount: 8 });
  const args = { slots, x: 0.37, y: 0.62, T: 1, coupling: 0.4 };
  const a = selectAssignment({ ...args, noise: createNoiseTable({ slotCount: 64, moduleCount: 8, seed: 7 }) });
  const b = selectAssignment({ ...args, noise: createNoiseTable({ slotCount: 64, moduleCount: 8, seed: 7 }) });
  assert.deepEqual(Array.from(a), Array.from(b));
});

// §10.2 — census matches the bilinear weights at σ=1, T=1, c=0.
test('census matches bilinear weights within 3% at a dozen positions', () => {
  const N = 4000;
  const slots = makeSlots(N);
  const noise = createNoiseTable({ slotCount: N, seed: 12345 });
  for (const [x, y] of SAMPLE_POSITIONS) {
    const a = selectAssignment({ slots, x, y, T: 1, coupling: 0, noise });
    const got = census(a, 4);
    const want = cornerWeights(x, y, 4);
    const diff = maxAbsDiff(got, want);
    assert.ok(diff < 0.03, `(${x},${y}) census ${Array.from(got)} vs weights ${Array.from(want)} (diff ${diff.toFixed(4)})`);
  }
});

// §10.3 — coupling invariance. This is the test that fails on the prototype's
// blend formulation and is the entire reason QM-0 §5.1 is written as a mask.
test('sweeping coupling 0→1 leaves the census within sampling error', () => {
  // With c=1 every module flips as a unit, so the effective sample size is the
  // MODULE count, not the slot count — the tolerance below is set by that, and
  // averaging over several independent tables is what keeps it tight enough to
  // still catch a real distribution shift (a blend formulation drifts far more).
  const N = 4000;
  const M = 500;
  const seeds = [11, 22, 33, 44, 55, 66, 77, 88];
  const slots = makeSlots(N, { moduleCount: M });
  const [x, y] = [0.35, 0.7];
  const want = cornerWeights(x, y, 4);

  for (const c of [0, 0.25, 0.5, 0.75, 1]) {
    const mean = new Float64Array(4);
    for (const seed of seeds) {
      const noise = createNoiseTable({ slotCount: N, moduleCount: M, seed });
      const got = census(selectAssignment({ slots, x, y, T: 1, coupling: c, noise }), 4);
      for (let k = 0; k < 4; k++) mean[k] += got[k] / seeds.length;
    }
    const diff = maxAbsDiff(mean, want);
    assert.ok(diff < 0.02, `c=${c}: census ${Array.from(mean)} vs weights ${Array.from(want)} (diff ${diff.toFixed(4)})`);
  }
});

// §10.4 — temperature limit.
test('T=0.02 gives the nearest corner everywhere off the boundaries', () => {
  const N = 512;
  const slots = makeSlots(N);
  const noise = createNoiseTable({ slotCount: N, seed: 99 });
  let checked = 0;
  for (const [x, y] of SAMPLE_POSITIONS) {
    const w = cornerWeights(x, y, 4);
    const sorted = Array.from(w).sort((p, q) => q - p);
    // §10.4 says "every position NOT exactly on a boundary". On a boundary the
    // top weights tie, every score ties with them, and the noise alone decides —
    // which is correct behaviour, not a temperature failure. (0.5,0.5) is the
    // 4-way tie; anything with x=0.5 or y=0.5 is a 2-way one.
    if (sorted[0] - sorted[1] < 1e-12) continue;
    let dominant = 0;
    for (let k = 1; k < 4; k++) if (w[k] > w[dominant]) dominant = k;
    const a = selectAssignment({ slots, x, y, T: 0.02, coupling: 0, noise });
    assert.ok(
      Array.from(a).every((k) => k === dominant),
      `(${x},${y}) expected every slot on corner ${dominant}`,
    );
    checked += 1;
  }
  assert.ok(checked >= 6, `only ${checked} off-boundary positions exercised — the skip guard has eaten the test`);
});

test('exactly on the 4-way boundary, T→0 leaves the noise to decide (all corners reachable)', () => {
  // The complement of the test above: this is the behaviour §10.4 excludes, and
  // pinning it here stops a future "fix" from making boundaries snap arbitrarily.
  const N = 512;
  const noise = createNoiseTable({ slotCount: N, seed: 99 });
  const a = selectAssignment({ slots: makeSlots(N), x: 0.5, y: 0.5, T: 0.02, coupling: 0, noise });
  assert.equal(new Set(Array.from(a)).size, 4);
});

// §10.5 — coupling limit.
test('c=1 yields at most M distinct corner values across all slots', () => {
  const N = 200;
  const M = 3;
  const slots = makeSlots(N, { moduleCount: M });
  const noise = createNoiseTable({ slotCount: N, moduleCount: M, seed: 4242 });
  const a = selectAssignment({ slots, x: 0.4, y: 0.55, T: 1.5, coupling: 1, noise });
  assert.ok(new Set(Array.from(a)).size <= M);

  // And every slot in a module agrees — module-atomic, not merely few-valued.
  for (let m = 0; m < M; m++) {
    const inModule = Array.from(a).filter((_, i) => slots[i].module === m);
    assert.equal(new Set(inModule).size, 1, `module ${m} did not flip as a unit`);
  }
});

// §10.6 — salience monotonicity. Frozen noise makes this exactly checkable per
// slot rather than statistically: the margin for the dominant corner is
// σ·(log w_dom − log w_k)/T, whose coefficient is positive, so once a slot lands
// on the dominant corner no larger σ can take it off again.
test('raising salience never moves a slot off the dominant corner', () => {
  const N = 256;
  const noise = createNoiseTable({ slotCount: N, seed: 606 });
  const [x, y] = [0.4, 0.35];
  const w = cornerWeights(x, y, 4);
  let dominant = 0;
  for (let k = 1; k < 4; k++) if (w[k] > w[dominant]) dominant = k;

  const wasDominant = new Array(N).fill(false);
  for (const salience of [0.1, 0.25, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]) {
    const a = selectAssignment({ slots: makeSlots(N, { salience }), x, y, T: 1, coupling: 0, noise });
    for (let i = 0; i < N; i++) {
      const isDominant = a[i] === dominant;
      assert.ok(!(wasDominant[i] && !isDominant), `slot ${i} left the dominant corner at σ=${salience}`);
      wasDominant[i] = wasDominant[i] || isDominant;
    }
  }
});

// §3 — the zero-weight rule.
test('a corner with zero weight never wins, however favourable its noise', () => {
  const N = 1000;
  const slots = makeSlots(N);
  const noise = createNoiseTable({ slotCount: N, seed: 31337 });
  // At (0,0) only corner A has weight; B, C, D are exactly 0.
  const a = selectAssignment({ slots, x: 0, y: 0, T: 4.0, coupling: 0, noise });
  assert.ok(Array.from(a).every((k) => k === 0));
});

// §3.3 — deterministic tie-breaking.
test('equal scores break to the lowest corner index', () => {
  // A hand-built table of all-equal noise at the field centre: every corner has
  // identical weight and identical noise, so every score ties.
  const N = 8;
  const noise = createNoiseTable({ slotCount: N, seed: 1 });
  noise.g.fill(0.5);
  const a = selectAssignment({ slots: makeSlots(N), x: 0.5, y: 0.5, T: 1, coupling: 0, noise });
  assert.ok(Array.from(a).every((k) => k === 0));
});

// §4 — modes.
test('modes resolve in the documented order', () => {
  const noise = createNoiseTable({ slotCount: 5, seed: 8 });
  const slots = [
    { mode: MODE.FROZEN, discrete: true, module: 0 },
    { mode: MODE.PINNED, pin: 2, discrete: true, module: 0 },
    { mode: MODE.GRADUAL, discrete: false, module: 0 },
    { mode: MODE.QUANTUM, discrete: false, module: 0 },
    { mode: MODE.AUTO, discrete: true, module: 0 },
  ];
  const a = selectAssignment({ slots, x: 0.5, y: 0.5, T: 1, noise, continuousPolicy: CONTINUOUS_POLICY.GRADUAL });
  assert.equal(a[0], SLOT_FROZEN);
  assert.equal(a[1], 2);
  assert.equal(a[2], SLOT_GRADUAL);
  assert.ok(a[3] >= 0, 'QUANTUM ignores the global gradual policy');
  assert.ok(a[4] >= 0, 'a discrete AUTO slot is always quantum (QM-0 §4)');
});

test('continuous AUTO slots follow the global policy', () => {
  const noise = createNoiseTable({ slotCount: 4, seed: 8 });
  const slots = makeSlots(4, { discrete: false });
  const gradual = selectAssignment({ slots, x: 0.5, y: 0.5, noise, continuousPolicy: CONTINUOUS_POLICY.GRADUAL });
  const quantum = selectAssignment({ slots, x: 0.5, y: 0.5, noise, continuousPolicy: CONTINUOUS_POLICY.QUANTUM });
  assert.ok(Array.from(gradual).every((k) => k === SLOT_GRADUAL));
  assert.ok(Array.from(quantum).every((k) => k >= 0));
});

test('a discrete GRADUAL slot is rejected, not silently coerced', () => {
  const issues = validateSlots([{ mode: MODE.GRADUAL, discrete: true, module: 0 }]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'DISCRETE_GRADUAL');
});

test('validation catches bad pins and out-of-range salience', () => {
  const issues = validateSlots([
    { mode: MODE.PINNED, pin: 9, discrete: true, module: 0 },
    { mode: MODE.AUTO, discrete: true, salience: 12, module: 0 },
  ]);
  assert.deepEqual(issues.map((i) => i.code).sort(), ['BAD_PIN', 'SALIENCE_RANGE']);
});

test('census ignores gradual and frozen slots', () => {
  const c = census(Int32Array.from([0, 0, 1, SLOT_GRADUAL, SLOT_FROZEN]), 4);
  assert.deepEqual(Array.from(c), [2 / 3, 1 / 3, 0, 0]);
});

test('selection is corner-count agnostic — a 3-corner field never emits corner 3', () => {
  const N = 300;
  const slots = makeSlots(N);
  const noise = createNoiseTable({ slotCount: N, cornerCount: 3, seed: 5 });
  const a = selectAssignment({ slots, x: 0.5, y: 0.4, T: 1, noise });
  assert.ok(Array.from(a).every((k) => k >= 0 && k < 3));
});
