// QM-0 §7 reshuffle lifecycle, pinned — the epoch/reshuffle half of ROADMAP Q-003.
//
// The selection goldens pin one partial reshuffle; this pins a whole scripted
// lifetime, including a full reshuffle mid-chain. What it protects is the thing
// §8.2 warns about: a change to the PRNG or to draw order silently breaking
// every saved preset in the field. A failure here is not fixed by regenerating.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createNoiseTable,
  reshuffleFull,
  reshufflePartial,
  deserializeNoiseTable,
  selectAssignment,
} from '../engine/index.mjs';
import { RESHUFFLE_CASE, buildSlots } from './reshuffle-case.mjs';

const golden = JSON.parse(
  readFileSync(new URL('./goldens/qm0-reshuffle.json', import.meta.url), 'utf8'),
);

test('the reshuffle fixture still describes the case under test', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(RESHUFFLE_CASE)), golden.case);
});

test('replaying the scripted lifetime reproduces every step exactly', () => {
  const slots = buildSlots();
  let table = createNoiseTable({
    slotCount: RESHUFFLE_CASE.slotCount,
    cornerCount: RESHUFFLE_CASE.cornerCount,
    moduleCount: RESHUFFLE_CASE.moduleCount,
    seed: RESHUFFLE_CASE.seed,
  });

  for (const [n, step] of golden.steps.entries()) {
    if (step.op === 'full') table = reshuffleFull(table, step.seed);
    else if (step.op === 'partial') table = reshufflePartial(table, step.d);

    assert.equal(table.epoch, step.epoch, `step ${n} (${step.op}) epoch`);
    assert.deepEqual(Array.from(table.g), step.noise.g, `step ${n} (${step.op}) g`);
    assert.deepEqual(Array.from(table.u), step.noise.u, `step ${n} (${step.op}) u`);
    assert.deepEqual(Array.from(table.G), step.noise.G, `step ${n} (${step.op}) G`);
    assert.equal(table.rngState, step.noise.rngState, `step ${n} (${step.op}) rngState`);

    for (const p of step.probe) {
      const a = selectAssignment({
        slots,
        x: p.x,
        y: p.y,
        T: RESHUFFLE_CASE.T,
        coupling: RESHUFFLE_CASE.coupling,
        noise: table,
      });
      assert.deepEqual(Array.from(a), p.a, `step ${n} (${step.op}) assignment at (${p.x},${p.y})`);
    }
  }
});

test('epoch increments once per reshuffle and survives a reseed', () => {
  // The mid-chain full reshuffle is the interesting one: a new seed replaces the
  // table wholesale, but the epoch is a count of EVENTS and must keep climbing.
  const epochs = golden.steps.map((s) => s.epoch);
  assert.deepEqual(epochs, [0, 1, 2, 3, 4, 5, 6]);
  const full = golden.steps.findIndex((s) => s.op === 'full');
  assert.ok(full > 0 && full < golden.steps.length - 1, 'the fixture must reseed mid-chain');
  assert.equal(golden.steps[full].epoch, full);
});

test('a state restored mid-lifetime continues identically (QM-0 §8.2)', () => {
  // Recall from any point must resume the same stream — this is what makes the
  // "store the table, do not reconstruct it" rule actually hold.
  const cut = 3;
  const restored = deserializeNoiseTable(golden.steps[cut].noise);
  const nextStep = golden.steps[cut + 1];
  const continued =
    nextStep.op === 'full' ? reshuffleFull(restored, nextStep.seed) : reshufflePartial(restored, nextStep.d);

  assert.deepEqual(Array.from(continued.g), nextStep.noise.g);
  assert.deepEqual(Array.from(continued.u), nextStep.noise.u);
  assert.equal(continued.rngState, nextStep.noise.rngState);
  assert.equal(continued.epoch, nextStep.epoch);
});
