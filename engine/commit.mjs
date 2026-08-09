// Commit policy — QM-0 §6.1 and §6.3.
//
// The selection law says WHAT the assignment is; this says WHEN it lands. The
// two are deliberately separate: NOTE_ON is the policy that makes the
// instrument musical rather than glitchy (§6.1), and it can only be decided by
// something that sees note events — so the engine exposes a pure predicate over
// events the host feeds it, and owns no timing of its own. There is no clock
// here, no setTimeout, no transport: the device calls `notify()` when a note or
// a beat actually happens.
//
// State is mutated in place rather than rebuilt. `propose()` runs on every
// field move, and the decision it makes is a pure function of (state, next,
// policy) — statefulness across time is the point of a commit queue, not a
// compromise of the §1 purity property, which is about the selection law.

/** QM-0 §6.1 trigger policies. */
export const COMMIT_POLICY = Object.freeze({
  IMMEDIATE: 'immediate',
  NOTE_ON: 'note_on',
  BEAT: 'beat',
  BAR: 'bar',
});

/** Events a host can report. The engine never generates these. */
export const COMMIT_EVENT = Object.freeze({
  NOTE_ON: 'note_on',
  BEAT: 'beat',
  BAR: 'bar',
});

/**
 * Does `event` satisfy `policy`?
 *
 * A BAR event also satisfies BEAT, because a bar boundary IS a beat boundary —
 * a host that emits only the strongest boundary it crossed should not silently
 * fail to flush a beat-policy queue. The converse does not hold. IMMEDIATE
 * never waits for an event at all.
 */
export function eventSatisfies(policy, event) {
  switch (policy) {
    case COMMIT_POLICY.NOTE_ON:
      return event === COMMIT_EVENT.NOTE_ON;
    case COMMIT_POLICY.BEAT:
      return event === COMMIT_EVENT.BEAT || event === COMMIT_EVENT.BAR;
    case COMMIT_POLICY.BAR:
      return event === COMMIT_EVENT.BAR;
    default:
      return false;
  }
}

/**
 * @param {Int32Array} assignment the currently-applied assignment
 * @param {string} policy
 */
export function createCommitState(assignment, policy = COMMIT_POLICY.NOTE_ON) {
  return {
    policy,
    applied: Int32Array.from(assignment),
    pending: Int32Array.from(assignment),
  };
}

/** Slot indices where pending differs from applied — the queued flips. */
export function pendingFlips(state) {
  const out = [];
  for (let i = 0; i < state.pending.length; i++) {
    if (state.pending[i] !== state.applied[i]) out.push(i);
  }
  return out;
}

/** Queue size for the UI's "⟳ 7 flips queued" readout (QM-0 §6.1). */
export function pendingCount(state) {
  let n = 0;
  for (let i = 0; i < state.pending.length; i++) {
    if (state.pending[i] !== state.applied[i]) n += 1;
  }
  return n;
}

/**
 * Apply the pending set wholesale.
 *
 * Wholesale is the §6.3 ordering requirement, not an implementation shortcut:
 * a note must never be triggered against a half-applied assignment — the new
 * note's oscillator wave and its envelope must come from the same commit. Any
 * future optimisation that lands changes incrementally breaks that guarantee.
 */
function flush(state) {
  const changed = pendingFlips(state);
  if (changed.length === 0) return { committed: false, changed: [], pendingCount: 0 };
  state.applied.set(state.pending);
  return { committed: true, changed, pendingCount: 0 };
}

const idle = (state) => ({ committed: false, changed: [], pendingCount: pendingCount(state) });

/**
 * Offer a freshly-selected assignment. Under IMMEDIATE it lands at once;
 * otherwise it joins the pending set and waits for an event.
 *
 * Note what does NOT queue: a GRADUAL slot's assignment code never changes (it
 * stays the sentinel) even though its resolved VALUE tracks the field
 * continuously. That is correct — gradual slots interpolate, they do not flip,
 * so flip timing has nothing to gate. Only quantum slots ever appear in
 * `changed`.
 *
 * @returns {{committed: boolean, changed: number[], pendingCount: number}}
 */
export function propose(state, next) {
  if (next.length !== state.pending.length) {
    throw new RangeError(
      `propose: assignment length ${next.length} does not match commit state ${state.pending.length}`,
    );
  }
  state.pending.set(next);
  if (state.policy === COMMIT_POLICY.IMMEDIATE) return flush(state);
  return idle(state);
}

/** Report a host event; commits iff it satisfies the current policy. */
export function notify(state, event) {
  if (eventSatisfies(state.policy, event)) return flush(state);
  return idle(state);
}

/**
 * Change policy. Switching to IMMEDIATE flushes any pending set at once
 * (QM-0 §6.1) — the user asking for immediate is asking for the queue to stop
 * being a queue, including the part of it already waiting.
 */
export function setPolicy(state, policy) {
  state.policy = policy;
  if (policy === COMMIT_POLICY.IMMEDIATE) return flush(state);
  return idle(state);
}

/**
 * Drop the pending set and go back to what is currently sounding.
 *
 * Not in §6, but its absence is worse than its presence: without it a queue
 * built under one field position can only be resolved by committing it, so a
 * user who drags somewhere by accident under NOTE_ON has no way to take it
 * back except playing the mistake. Returns the flips discarded.
 */
export function discardPending(state) {
  const discarded = pendingFlips(state);
  state.pending.set(state.applied);
  return { committed: false, discarded, pendingCount: 0 };
}
