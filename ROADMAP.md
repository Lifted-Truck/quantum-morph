# ROADMAP — quantum-morph

Single source of truth. Only the lead session (or the human) edits this file.
State lives here; conversations are ephemeral.

## Status

- **Phase:** P0 — scaffolded; specs landed; prior-art swept; engine unbuilt.
  P0 gate is one item short: human ratification.
- **Oracle:** `fast` = leak gate + structure/manifest sanity (green, honestly
  scoped — no engine tests exist yet; they arrive with Q-002/Q-003 and become
  part of `fast` when they do). `full` = `fast` only for now; device-layer
  attended checks are defined at P2.
- **Last human ratification:** pending — manifest is PROVISIONAL until the
  human ratifies it and this file at the P0 gate.

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
- **Status:** blocked (on P0 ratification)
- **Scope:** `engine/`, `tests/`
- **Acceptance criteria:**
  1. Implements QM-0 §2–§5: bilinear/degenerate weights, Gumbel-max selection,
     temperature, salience, coupling via the mask formulation (NOT blending),
     epoch/reshuffle semantics.
  2. Pure ES modules; runs under Node and Max `v8`; zero dependencies.
  3. Unit tests + property checks (Σw=1; zero-weight corner never wins;
     determinism: same seed+position ⇒ same assignment).
  4. Golden vectors: frozen seed → pinned assignments across a position grid,
     exact-match, wired into `./verify fast`.
- **Out of scope:** any Max/LOM code; UI.

### Q-003 — Commit policies + noise-table lifecycle (P1)
- **Status:** blocked (on Q-002)
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
