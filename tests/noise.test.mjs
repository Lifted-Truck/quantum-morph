// QM-0 §7 (reshuffle) and §8 (recall / serialization).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNoiseTable,
  reshuffleFull,
  reshufflePartial,
  serializeNoiseTable,
  deserializeNoiseTable,
  selectAssignment,
  makeRng,
  gumbel,
} from '../engine/index.mjs';
import { makeSlots } from './helpers.mjs';

test('the seeded stream is reproducible and stays in (0,1)', () => {
  const a = makeRng(2024);
  const b = makeRng(2024);
  for (let i = 0; i < 1000; i++) {
    const v = a.uniform();
    assert.equal(v, b.uniform());
    assert.ok(v > 0 && v < 1, `uniform out of open interval: ${v}`);
  }
});

test('gumbel variates are finite for a long run', () => {
  const rng = makeRng(1);
  for (let i = 0; i < 100000; i++) {
    assert.ok(Number.isFinite(gumbel(rng)));
  }
});

test('a full reshuffle changes the table and bumps the epoch', () => {
  const t0 = createNoiseTable({ slotCount: 64, moduleCount: 4, seed: 1 });
  const t1 = reshuffleFull(t0, 2);
  assert.equal(t1.epoch, 1);
  assert.notDeepEqual(Array.from(t0.g), Array.from(t1.g));
  assert.equal(t1.slotCount, t0.slotCount);
});

test('epoch counts reshuffle events across a mixed history', () => {
  let t = createNoiseTable({ slotCount: 32, moduleCount: 4, seed: 1 });
  t = reshufflePartial(t, 0.2);
  t = reshuffleFull(t, 9);
  t = reshufflePartial(t, 0.5);
  assert.equal(t.epoch, 3);
});

test('a partial reshuffle redraws exactly round(d·N) slots and leaves the rest', () => {
  const N = 200;
  const t0 = createNoiseTable({ slotCount: N, moduleCount: 4, seed: 3 });
  for (const d of [0.05, 0.1, 0.5, 1.0]) {
    const t1 = reshufflePartial(t0, d);
    let changed = 0;
    for (let i = 0; i < N; i++) {
      if (t0.u[i] !== t1.u[i]) changed += 1;
    }
    assert.equal(changed, Math.round(d * N), `depth ${d}`);
    assert.equal(t1.epoch, 1);
  }
});

test('partial reshuffle depth is range-checked against QM-0 §7', () => {
  const t = createNoiseTable({ slotCount: 8, seed: 1 });
  assert.throws(() => reshufflePartial(t, 0.01), RangeError);
  assert.throws(() => reshufflePartial(t, 1.5), RangeError);
});

test('a reshuffle history is reproducible from the same starting table', () => {
  const start = createNoiseTable({ slotCount: 64, moduleCount: 8, seed: 777 });
  const run = () => {
    let t = start;
    for (const d of [0.1, 0.35, 0.05, 1.0, 0.2]) t = reshufflePartial(t, d);
    return t;
  };
  assert.deepEqual(Array.from(run().g), Array.from(run().g));
});

// §8.2 — the table is authoritative; recall must not depend on replaying history.
test('serialize/deserialize round-trips exactly, including after 50 partial reshuffles', () => {
  let t = createNoiseTable({ slotCount: 128, moduleCount: 12, seed: 40219 });
  const depths = [0.05, 0.1, 0.2, 0.35, 0.5];
  for (let i = 0; i < 50; i++) t = reshufflePartial(t, depths[i % depths.length]);

  const round = deserializeNoiseTable(JSON.parse(JSON.stringify(serializeNoiseTable(t))));
  assert.deepEqual(Array.from(round.g), Array.from(t.g));
  assert.deepEqual(Array.from(round.u), Array.from(t.u));
  assert.deepEqual(Array.from(round.G), Array.from(t.G));
  assert.equal(round.epoch, t.epoch);
  assert.equal(round.rngState, t.rngState);

  // The point of the round-trip: the SOUND recalls, not just the bytes.
  const slots = makeSlots(128, { moduleCount: 12 });
  const args = { slots, x: 0.42, y: 0.19, T: 0.8, coupling: 0.45 };
  assert.deepEqual(
    Array.from(selectAssignment({ ...args, noise: t })),
    Array.from(selectAssignment({ ...args, noise: round })),
  );

  // And a reshuffle continuing from the restored table matches one continuing
  // from the original — the generator state travels with the table.
  assert.deepEqual(
    Array.from(reshufflePartial(t, 0.3).g),
    Array.from(reshufflePartial(round, 0.3).g),
  );
});
