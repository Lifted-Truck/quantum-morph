// QM-0 §6.1 (trigger policy) and §6.3 (ordering).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMIT_POLICY,
  COMMIT_EVENT,
  eventSatisfies,
  createCommitState,
  propose,
  notify,
  setPolicy,
  discardPending,
  pendingCount,
  pendingFlips,
  createNoiseTable,
  selectAssignment,
  CONTINUOUS_POLICY,
  SLOT_GRADUAL,
  MODE,
} from '../engine/index.mjs';
import { makeSlots } from './helpers.mjs';

const A = (...v) => Int32Array.from(v);

test('IMMEDIATE commits on proposal, with no queue', () => {
  const s = createCommitState(A(0, 0, 0), COMMIT_POLICY.IMMEDIATE);
  const r = propose(s, A(1, 0, 2));
  assert.equal(r.committed, true);
  assert.deepEqual(r.changed, [0, 2]);
  assert.equal(pendingCount(s), 0);
  assert.deepEqual(Array.from(s.applied), [1, 0, 2]);
});

test('NOTE_ON holds the assignment until a note arrives', () => {
  const s = createCommitState(A(0, 0, 0), COMMIT_POLICY.NOTE_ON);
  const p = propose(s, A(1, 2, 0));
  assert.equal(p.committed, false);
  assert.equal(p.pendingCount, 2, 'the UI readout must see the queue');
  assert.deepEqual(Array.from(s.applied), [0, 0, 0], 'nothing lands early');

  assert.equal(notify(s, COMMIT_EVENT.BEAT).committed, false, 'a beat must not flush a NOTE_ON queue');

  const c = notify(s, COMMIT_EVENT.NOTE_ON);
  assert.equal(c.committed, true);
  assert.deepEqual(c.changed, [0, 1]);
  assert.deepEqual(Array.from(s.applied), [1, 2, 0]);
  assert.equal(pendingCount(s), 0);
});

test('only the latest proposal survives the wait', () => {
  // Dragging across the field under NOTE_ON must land where you STOPPED, not
  // replay every position you passed through.
  const s = createCommitState(A(0, 0), COMMIT_POLICY.NOTE_ON);
  propose(s, A(1, 1));
  propose(s, A(2, 2));
  propose(s, A(3, 0));
  const c = notify(s, COMMIT_EVENT.NOTE_ON);
  assert.deepEqual(Array.from(s.applied), [3, 0]);
  assert.deepEqual(c.changed, [0]);
});

test('a proposal that returns to the applied state leaves nothing queued', () => {
  const s = createCommitState(A(0, 1), COMMIT_POLICY.NOTE_ON);
  propose(s, A(1, 1));
  assert.equal(pendingCount(s), 1);
  propose(s, A(0, 1));
  assert.equal(pendingCount(s), 0, 'dragging back must empty the queue, not queue a second flip');
  assert.equal(notify(s, COMMIT_EVENT.NOTE_ON).committed, false);
});

test('BEAT policy flushes on a beat and on a bar; BAR only on a bar', () => {
  const beat = createCommitState(A(0), COMMIT_POLICY.BEAT);
  propose(beat, A(1));
  assert.equal(notify(beat, COMMIT_EVENT.NOTE_ON).committed, false);
  assert.equal(notify(beat, COMMIT_EVENT.BEAT).committed, true);

  // A bar boundary IS a beat boundary — a host emitting only the strongest
  // boundary must not leave a beat-policy queue stuck.
  const beat2 = createCommitState(A(0), COMMIT_POLICY.BEAT);
  propose(beat2, A(1));
  assert.equal(notify(beat2, COMMIT_EVENT.BAR).committed, true);

  const bar = createCommitState(A(0), COMMIT_POLICY.BAR);
  propose(bar, A(1));
  assert.equal(notify(bar, COMMIT_EVENT.BEAT).committed, false, 'a beat must not flush a BAR queue');
  assert.equal(notify(bar, COMMIT_EVENT.BAR).committed, true);
});

test('the policy/event table is exactly as specified', () => {
  const table = {
    [COMMIT_POLICY.IMMEDIATE]: { note_on: false, beat: false, bar: false },
    [COMMIT_POLICY.NOTE_ON]: { note_on: true, beat: false, bar: false },
    [COMMIT_POLICY.BEAT]: { note_on: false, beat: true, bar: true },
    [COMMIT_POLICY.BAR]: { note_on: false, beat: false, bar: true },
  };
  for (const [policy, row] of Object.entries(table)) {
    for (const [event, want] of Object.entries(row)) {
      assert.equal(eventSatisfies(policy, event), want, `${policy} × ${event}`);
    }
  }
});

test('switching to IMMEDIATE flushes the pending set at once (QM-0 §6.1)', () => {
  const s = createCommitState(A(0, 0, 0), COMMIT_POLICY.BAR);
  propose(s, A(1, 1, 0));
  assert.equal(pendingCount(s), 2);
  const r = setPolicy(s, COMMIT_POLICY.IMMEDIATE);
  assert.equal(r.committed, true);
  assert.deepEqual(r.changed, [0, 1]);
  assert.deepEqual(Array.from(s.applied), [1, 1, 0]);
});

test('switching between deferred policies keeps the queue intact', () => {
  const s = createCommitState(A(0, 0), COMMIT_POLICY.NOTE_ON);
  propose(s, A(1, 1));
  assert.equal(setPolicy(s, COMMIT_POLICY.BAR).committed, false);
  assert.equal(pendingCount(s), 2, 'the queue survives a policy change that is not IMMEDIATE');
  assert.equal(notify(s, COMMIT_EVENT.BAR).committed, true);
});

test('commits are all-or-nothing (QM-0 §6.3)', () => {
  // Every changed slot lands in the same commit — no half-applied assignment can
  // ever be observed between the flush and the next read.
  const s = createCommitState(A(0, 0, 0, 0), COMMIT_POLICY.NOTE_ON);
  propose(s, A(1, 2, 3, 1));
  const before = Array.from(s.applied);
  assert.deepEqual(before, [0, 0, 0, 0], 'no partial application while queued');
  notify(s, COMMIT_EVENT.NOTE_ON);
  assert.deepEqual(Array.from(s.applied), [1, 2, 3, 1]);
});

test('discarding pending restores what is currently sounding', () => {
  const s = createCommitState(A(0, 1), COMMIT_POLICY.NOTE_ON);
  propose(s, A(1, 0));
  const d = discardPending(s);
  assert.deepEqual(d.discarded, [0, 1]);
  assert.equal(pendingCount(s), 0);
  assert.equal(notify(s, COMMIT_EVENT.NOTE_ON).committed, false, 'a discarded queue must not resurface');
  assert.deepEqual(Array.from(s.applied), [0, 1]);
});

test('an event with nothing queued is a no-op, not an empty commit', () => {
  const s = createCommitState(A(0, 1), COMMIT_POLICY.NOTE_ON);
  const r = notify(s, COMMIT_EVENT.NOTE_ON);
  assert.equal(r.committed, false);
  assert.deepEqual(r.changed, []);
});

test('a length mismatch is rejected rather than silently truncated', () => {
  const s = createCommitState(A(0, 0), COMMIT_POLICY.IMMEDIATE);
  assert.throws(() => propose(s, A(0, 0, 0)), RangeError);
});

// The integration that matters: real assignments from the selection law, gated.
test('gradual slots never queue a flip, however far the field moves', () => {
  const slots = [
    { mode: MODE.GRADUAL, discrete: false, module: 0 },
    { mode: MODE.AUTO, discrete: true, module: 0 },
  ];
  const noise = createNoiseTable({ slotCount: 2, seed: 5150 });
  const at = (x, y) =>
    selectAssignment({ slots, x, y, T: 1, noise, continuousPolicy: CONTINUOUS_POLICY.GRADUAL });

  const s = createCommitState(at(0, 0), COMMIT_POLICY.NOTE_ON);
  propose(s, at(1, 1));
  // Slot 0 interpolates continuously and has no flip to time; only slot 1 can queue.
  assert.ok(!pendingFlips(s).includes(0));
  assert.equal(s.applied[0], SLOT_GRADUAL);
});

test('the changed set is what a host writes — and it is only the flips', () => {
  // This is the write-budget path (QM-1 §5): committing must not re-write every
  // slot, only the ones that actually moved.
  const N = 64;
  const slots = makeSlots(N, { moduleCount: 8 });
  const noise = createNoiseTable({ slotCount: N, moduleCount: 8, seed: 2024 });
  const at = (x, y) => selectAssignment({ slots, x, y, T: 1, coupling: 0.4, noise });

  const s = createCommitState(at(0.5, 0.5), COMMIT_POLICY.NOTE_ON);
  const next = at(0.55, 0.5);
  propose(s, next);
  const r = notify(s, COMMIT_EVENT.NOTE_ON);

  let trueDiff = 0;
  for (let i = 0; i < N; i++) if (at(0.5, 0.5)[i] !== next[i]) trueDiff += 1;
  assert.equal(r.changed.length, trueDiff);
  assert.ok(r.changed.length < N, 'a small field move must not rewrite every slot');
});
