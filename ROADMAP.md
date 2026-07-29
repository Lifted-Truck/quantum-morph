# ROADMAP — quantum-morph

Single source of truth. Only the lead session (or the human) edits this file.
State lives here; conversations are ephemeral.

## Status

- **Phase:** P1 — P0 closed; QM-0 engine core built (Q-002 done). Q-003
  (commit policies) is the remaining P1 item.
- **Oracle:** `fast` = leak gate + structure/manifest sanity + knowledge-loop
  atomicity + 41 engine tests + pinned golden vectors. Green. `full` = `fast`
  only for now; device-layer attended checks are defined at P2.
- **Last human ratification:** 2026-07-24 — manifest RATIFIED, P0 gate closed.

## Invariants under active protection

See CLAUDE.md §Domain. At risk in the current phase: none (no engine code yet).
The moment Q-002 opens, "pure function, seeded-and-frozen noise, no wall-clock"
is the invariant every review checks first.

## Phases

Prior-art bookends per kit Decision 30: Phase 0 opens with a prior-art
landscape; any public release is gated on a prior-art & IP re-scan.

- **P0 — Ratify + prior-art landscape.** Human ratifies manifest + this file.
  Prior-art sweep lands in `docs/prior-art.md`, dated and cited. Gate:
  ratification recorded here; prior-art doc exists (✅ 2026-07-24).
- **P1 — QM-0 engine (JS reference).** Pure engine in `engine/`, unit tests +
  pinned golden assignment vectors in `tests/`. Gate: `./verify fast` runs the
  engine suite green; goldens frozen and protected.
- **P2 — QM-1 device.** M4L MIDI Effect hosting the engine via `v8`; slot
  learn/mapping, corners, field UI, NOTE_ON commit, LOM write budget per
  QM-1 §5. Gate: device loads in Live 12, attended checklist in
  `docs/device-checklist.md` passes, trace written.
- **P3 — Ship.** Docs, demo set, pre-ship prior-art & IP re-scan, tag v1.
  Gate: re-scan dated in `docs/prior-art.md`; README current; `full` green.
- **P4 (future, unscoped) — QM-2 integrations.** Native-instrument ports
  golden-tested against the JS reference (port-pin). Revisit architecture
  rung here, not before.

## Queue

### Q-001 — Prior-art landscape (P0)
- **Status:** done (trace: `traces/2026-07-24-prior-art.md`)
- **Scope:** `docs/prior-art.md` (new)
- **Acceptance criteria:**
  1. ✅ Dated, cited survey of preset-morph prior art (hardware vector synths →
     current M4L morph devices) and any patent-shaped risks for the
     stochastic-assignment approach.
  2. ✅ One paragraph: what quantum-morph does that the surveyed art does not.
- **Out of scope:** design changes; this informs, it does not redesign.
- **Findings carried forward:** no spec revision indicated. Two items land on
  P3, not P1 — (a) US10770048B2 (active to ~2038) reaches discrete-element
  morphing but claims *proportional crossfade*, which QM-0 refuses by
  construction; needs counsel, not redesign. (b) "QUANTUM MORPH" as a shipping
  name overlaps Waldorf Quantum's goods class — working title only until a
  trademark check.

### Q-002 — QM-0 engine core (P1)
- **Status:** done (trace: `traces/2026-07-24-qm0-engine.md`)
- **Scope:** `engine/`, `tests/`
- **Acceptance criteria:**
  1. ✅ Implements QM-0 §2–§5: bilinear/degenerate weights, Gumbel-max selection,
     temperature, salience, coupling via the mask formulation (NOT blending),
     epoch/reshuffle semantics.
  2. ⚠️ Pure ES modules, zero dependencies, no Node-only APIs in `engine/` —
     **Node side verified** (41 tests). **Max `v8` side UNVERIFIED**: no Max
     runtime available in an agent session. See open questions.
  3. ✅ Unit tests + property checks (Σw=1; zero-weight corner never wins;
     determinism: same seed+position ⇒ same assignment). QM-0 §10 acceptance
     tests 1–6 are implemented; 7 (no clicks) and 8 (recall in-host) are
     device-layer and belong to P2.
  4. ✅ Golden vectors: seed 40219 → pinned assignments over a 9×9 position grid
     × 6 (T,c) settings × 2 epochs, exact-match, wired into `./verify fast`.
- **Out of scope:** any Max/LOM code; UI.
- **Open questions (carry into P2, none blocking Q-003):**
  1. **3-corner triangle is an engine convention, not a spec quotation.** QM-0
     §2 says "a triangle inscribed in the field" without fixing which.
     `engine/weights.mjs` pins an isoceles triangle (base y=0, apex at
     (0.5,1)). Changing it invalidates every 3-corner golden. Needs a human
     ratification or a spec amendment before any 3-corner device ships.
  2. **`js` vs `v8`.** QM-1 §212 says "the device's `js`/`v8` object". The
     engine is ES modules, which the legacy `js` object cannot load — this
     commits the device to `v8` (Max 8.5+). Confirm at P2 against a real Max.
  3. Coupling default is set to 0.4 (`RANGES.coupling`) from QM-0 §5.1's
     "expected useful range [0.25, 0.55]". §5.1 says to verify against the
     prototype before fixing defaults; not yet done.

### Q-003 — Commit policies + noise-table lifecycle (P1)
- **Status:** open (unblocked — Q-002 done)
- **Scope:** `engine/`, `tests/`
- **Acceptance criteria:**
  1. Commit modes per QM-0 §8 (incl. NOTE_ON commit semantics as a pure
     "commit-eligible" predicate — no timing code in the engine).
  2. Reshuffle/epoch events covered by goldens.
- **Out of scope:** the ms-level note-delay mechanics (device-layer, Q-004).

### Q-004 — QM-1 device shell (P2)
- **Status:** blocked (on P1 gate)
- **Scope:** `device/`
- **Acceptance criteria:** defined at P1 close — writing them is the first
  task of P2 (per charter: no work on items with missing criteria).

## Decision log

- 2026-07-24 — Q-002 engine core landed; `./verify` test invocation fixed with
  human approval (strengthening, not weakening: the gate previously errored
  instead of running the suite) (trace: `traces/2026-07-24-qm0-engine.md`).
- 2026-07-24 — **P0 gate closed: manifest RATIFIED by the human.**
- 2026-07-24 — Q-001 prior-art sweep closed; no spec revision indicated; two
  IP items deferred to P3 (trace: `traces/2026-07-24-prior-art.md`).
- 2026-07-24 — Spin-up decisions ratified-provisional; see DECISIONS.md D-001…D-005.

## Graduation criteria

This project graduates from interactive prototyping to autonomous queue work
when the remaining open questions are infrastructure problems rather than
audible/judgment ones. Still in the judgment column: does stochastic
assignment *sound* musical at NOTE_ON commit (P2 attended testing); coupling
strength defaults; salience defaults per parameter class. Until those close,
sessions stay attended (manifest: interactive-only).
