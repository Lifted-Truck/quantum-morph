# ROADMAP — quantum-morph

Single source of truth. Only the lead session (or the human) edits this file.
State lives here; conversations are ephemeral.

## Status

- **Phase:** **P1 complete** — Q-002 and Q-003 both done; the QM-0 engine is
  built, green, and golden-pinned. P2 (the M4L device) is not started; its
  first task is writing Q-004's acceptance criteria.
- **Oracle:** `fast` = leak gate + structure/manifest sanity + knowledge-loop
  atomicity + 59 engine tests + two pinned golden files (selection, reshuffle
  lifecycle). Green. `full` = `fast` only for now; device-layer attended checks
  are defined at P2.
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
- **Status:** done (trace: `traces/2026-08-08-commit-policies.md`)
- **Scope:** `engine/`, `tests/`
- **Acceptance criteria:**
  1. ✅ Commit modes per QM-0 **§6** (incl. NOTE_ON commit semantics as a pure
     "commit-eligible" predicate — no timing code in the engine).
     *(Corrected 2026-08-08: this read "§8" at scaffold time. §8 is recall and
     state; commit and timing are §6. The criterion was always about §6.)*
     `engine/commit.mjs`: policy × event predicate, held pending set with a
     count for the UI readout, wholesale (§6.3-atomic) flush, IMMEDIATE-flushes
     -on-switch. No clock, no transport, no timer anywhere in the engine.
  2. ✅ Reshuffle/epoch events covered by goldens —
     `tests/goldens/qm0-reshuffle.json`, a 7-step scripted lifetime (both
     reshuffle kinds, both depth extremes, a reseed mid-chain) pinning tables,
     epochs, rng state, and probe assignments. Added as a NEW golden file; the
     existing `qm0-selection.json` was not touched.
- **Out of scope:** the ms-level note-delay mechanics (device-layer, Q-004);
  glide ramping (§6.2 is device timing — the engine reports *which* slots
  changed, the device decides how they move).

### Q-006 — Golden portability: float-exactness is not the gate (P1 debt)
- **Status:** done (trace: `traces/2026-08-18-golden-portability.md`; merged as `d6e7c5d` via PR #1)
- **Scope:** `tests/goldens.test.mjs`, `tests/reshuffle-goldens.test.mjs`,
  `tests/helpers.mjs`. **No engine change** — the engine was never wrong.
- **Why:** CI was red from 2026-08-05 to 2026-08-18 while `./verify fast` was
  green locally. Goldens generated on darwin-arm64 compared float-exact against
  ubuntu-x64: `g = −log(−log(u))` goes through `Math.log`, which is not
  bit-identical across platforms or V8 builds. 55/59 passed in CI; the 4
  failures were all raw-float table comparisons. **Every assignment golden
  passed** — the property QM-0 §10.1 actually requires held cross-platform.
- **Human decision (2026-08-18, required by charter — gate change):** split the
  gate rather than loosen it. Exact where determinism is by construction (`u`,
  `rngState` — integer arithmetic, no libm), tolerance only on `g`/`G`.
- **Acceptance criteria:**
  1. ✅ `u` and `rngState` asserted bit-exact; `g`/`G` within 8 ULP.
  2. ✅ All assignment goldens remain exact-match, unchanged.
  3. ✅ A self-test proves the tolerance still fires on an O(1e−7) change —
     a loosened gate nobody watched fire is decoration.
  4. ✅ CI green on ubuntu-x64 — run at 04:09:59Z on `56dd6a6`: 60 tests, 60
     pass. **This is the criterion that mattered and only the runner could meet
     it.** It also settled the open hypothesis: the test asserting `u` and
     `rngState` bit-exact PASSED on a different architecture from the one that
     generated the goldens, so "u is exact, only g/G touch libm" is now
     measured, not inferred from reading `rng.mjs`.
- **Findings carried forward (not fixed here):**
  - QM-0 §8.2 offers "enter a seed to regenerate a table from scratch". That
    regeneration is now known to be platform-dependent at the last ULP.
    §8.2's core rule (store the table, never reconstruct for recall) is
    *strengthened* by this, but the seed-entry feature is not portable in the
    way the spec implies. Spec amendment candidate — human call, not urgent.
  - Max's `v8` is a third V8 build. Any future device-side golden must compare
    assignments, never variates. Recorded in LIBRARY L0004.

### Q-007 — Leak gate vs. concurrent foreign probes
- **Status:** done (trace: `traces/2026-08-18-leak-gate-concurrency.md`)
- **Scope:** `verify` (leak_gate only)
- **Why:** `./verify fast` went red at 04:10:49Z on a commit that CI had passed
  60/60 fifty seconds earlier, then green again at 04:11:38Z — same tree, no
  checkout, no stash, nothing untracked afterwards. Cause: `kit/currency.py`
  proves the gate FIRES by planting identity paths in `.kit-currency-plant-*`
  files inside this working tree and running `./verify`. Our concurrent run
  scanned the other run's plant (the gate deliberately scans untracked files)
  and went red on a file that no longer existed by the time anyone looked.
- **Acceptance criteria:**
  1. ✅ A foreign probe's plant is invisible to runs that do not own it.
  2. ✅ The owning probe still sees its own plant, so currency.py's proof still
     works (`KIT_LEAK_PLANT` names it).
  3. ✅ **Not a weakening** — an ordinary untracked file containing an identity
     path still reddens the gate. Verified empirically, not argued:
     plant-present → exit 0; owned plant → exit 1; ordinary bad file → exit 1;
     clean → exit 0.
- **Out of scope:** making `fast()` report WHICH gate failed. Still worth doing
  (a single aggregate exit code is why this took an investigation rather than a
  glance) but it is a separate `./verify` change needing its own approval.
- **Superseded in place by kit 2.4.0 (same day):** `leak_gate` and `record` are
  no longer project-owned — they are vendored to `.kit/kit-gates.sh`, pinned by
  sha256. The fix above was NOT lost in the transfer; re-verified against the
  vendored gate (foreign plant → exit 0, owned plant → exit 1).

### Q-004 — QM-1 device shell (P2)
- **Status:** blocked (on P1 gate)
- **Scope:** `device/`
- **Acceptance criteria:** defined at P1 close — writing them is the first
  task of P2 (per charter: no work on items with missing criteria).

### Q-005 — QM-3 FX pool & routing (phase unresolved — BLOCKING ASK)
- **Status:** blocked (needs a human ruling before criteria can be written)
- **Scope:** TBD — `docs/specs/QM-3-fx-pool-spec.md` landed 2026-08-17
- **Why it is blocked, not just unstarted:** QM-3 declares itself normative for
  "the FX section of **the host synth's** quantum-morph integration". That is
  QM-2 territory — integrating morph into an instrument that already exists —
  which this ROADMAP places at **P4, unscoped**, after the M4L device ships.
  So either (a) QM-3 belongs to a host-synth project and this repo only owns
  the engine-side contract it implies, or (b) the roadmap's phase order is
  wrong and native integration has moved ahead of P2. Those lead to different
  work, so guessing is not available (charter: an item with ambiguous criteria
  is not workable; surfacing the gap is the deliverable).
- **What it would imply for the engine if (b):** QM-3 §1 makes every send-matrix
  cell an ordinary morph slot with four corner values — i.e. routing rides the
  existing selection law with no new subsystem, and its §1.6 classes rerouting
  as SAFE (gain ramps, no allocation on the audio thread). On a first read that
  needs *no* change to `engine/`, which is a strong signal the design is sound —
  but "no change needed" is a hypothesis from one read, not a verified claim.
- **Open questions for the human:** which project owns QM-3? Does it reorder
  P2/P4? Is the 64-slot ceiling (QM-1 §2) still right once every send cell is
  a slot — an N-module pool needs ~N²/2 cells and that ceiling arrives fast.

## Decision log

- 2026-08-18 — Kit 2.4.0: gate MECHANISM vendored to `.kit/`. This repo's copied
  leak gate was missing the Windows identity pattern while declaring
  `kit_version: 2.1.0` — a real gap, closed (DECISIONS D-012).

- 2026-08-18 — Q-006 CLOSED: CI green on ubuntu-x64; `u`/`rngState` bit-exactness
  measured rather than assumed. Q-007 opened for the leak-gate concurrency fix
  (trace: `traces/2026-08-18-leak-gate-concurrency.md`).

- 2026-08-18 — Q-006 opened: golden float-exactness relaxed to a split gate on
  human decision; CI had been red 13 days against a correct engine
  (trace: `traces/2026-08-18-golden-portability.md`).
- 2026-08-18 — PR workflow adopted; `main` protected (PR + green `verify`
  required). See DECISIONS D-009.

- 2026-08-08 — Q-003 done; **P1 gate closed** (engine suite green, goldens
  frozen and protected). Two design calls recorded in DECISIONS D-007
  (trace: `traces/2026-08-08-commit-policies.md`).
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
