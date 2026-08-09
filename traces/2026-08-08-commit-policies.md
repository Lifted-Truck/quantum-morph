# commit-policies — Q-003: commit modes, reshuffle/epoch goldens, P1 gate closed

- **Queue item:** ROADMAP Q-003 (open → done). Closes P1.
- **Why:** QM-0 §6.1 calls NOTE_ON "the policy that makes this musical rather
  than glitchy", so the commit queue is not a detail bolted onto the selection
  law — it is half of what makes the instrument playable. Built it as its own
  module with the same rule as the rest of `engine/`: it decides, the host
  supplies events, and no clock ever enters the engine.
- **Evidence consulted:** `docs/specs/QM-0-core-engine-spec.md` §6.1 (trigger
  policies, held pending set, "switching to IMMEDIATE flushes"), §6.2 (glide —
  read, then deliberately left to the device), §6.3 (atomicity w.r.t. the audio
  thread), §7 and §8.2 (reshuffle lifecycle, store-don't-reconstruct);
  `engine/select.mjs` for the sentinel semantics that make gradual slots
  non-queueing; LIBRARY L0002 (write budget) — which is why `changed` returns
  only the flips rather than the whole slot list.
- **Alternatives rejected:**
  - *Immutable state (new arrays per transition)* — rejected: `propose()` runs
    on every field move; in-place mutation with a pure decision keeps the host
    path allocation-free. The §1 purity property is about the selection law,
    not about a queue that is inherently a state machine over time.
  - *Incremental / partial application of a commit* — rejected outright by
    §6.3: a note must not trigger against a half-applied assignment. `flush()`
    sets the whole array at once and says so in a comment, because this is
    exactly the kind of thing a future optimiser would "improve".
  - *Regenerating `qm0-selection.json` to add reshuffle coverage* — rejected:
    that file is protected and regenerating it is a gate-weakening event.
    Added `qm0-reshuffle.json` as a new file instead; the old one is untouched.
  - *Putting glide/ramping in the engine* — rejected: §6.2 is millisecond
    timing, which is device-layer. The engine reports which slots changed; the
    device decides how they move. Recorded as out-of-scope in ROADMAP.
- **Verify:** `./verify fast` exit 0 — 59 tests, 59 pass, 0 fail (was 41).
- **Open questions:**
  1. Two decisions are additive to QM-0 §6, recorded as DECISIONS D-007:
     BAR-satisfies-BEAT, and the existence of `discardPending()`. Neither
     contradicts the spec, but both are places where the spec was silent and I
     chose — if either is wrong, §6 is where to fix it, not the code.
  2. The ROADMAP criterion cited "QM-0 §8" for commit modes; §8 is recall and
     state, and commit is §6. That was my scaffold-time error, corrected in
     place with a dated note rather than silently. Worth remembering that the
     scaffold's spec references were written before the spec was read in full.
  3. Still unverified, unchanged from Q-002: nothing in `engine/` has ever run
     inside Max. The commit module makes this slightly more pointed, since its
     whole purpose is to be driven by host events that only exist there.
