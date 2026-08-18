# DECISIONS — quantum-morph (append-only)

One entry per ratified decision, newest first. Never edit past entries;
supersede them with a new one.

- **D-009 · 2026-08-18 — PR workflow; `main` protected.** Work moves to
  branch-per-queue-item (`q-00N-slug`, matching ROADMAP ids so a branch traces
  to its acceptance criteria), squash merge, PR required. Agent authority:
  may push feature branches and open PRs without asking; **merging stays
  human**. `main` is protected — PR required, `verify` status check must pass.
  `enforce_admins` is left OFF so the owner keeps an escape hatch; say the word
  to make it absolute. CI already ran on `pull_request`, so no workflow change
  was needed.

- **D-012 · 2026-08-18 — Kit 2.4.0: gate mechanism vendored to `.kit/`.**
  Kit gate code used to be COPIED into each repo; a `kit_version` was therefore
  a claim about a copy, and a copy can lie. Confirmed here: this repo declared
  `kit_version: 2.1.0` while its copied `leak_gate` matched only
  `/(Users|home)/[^/]+/` — **`C:\Users\<user>\...` went straight through**. The
  vendored gate adds `[A-Za-z]:\+Users\+[^\]`, so this migration closed a
  real, previously invisible hole rather than being bookkeeping.
  `record()` and `leak_gate()` are no longer project-owned; `.kit/` is
  KIT-OWNED, pinned by sha256 in `.kit/MANIFEST`, and `kit_integrity` reddens
  `fast` if it is touched. Update only via `kit_sync.py`.
  **Verified beyond the prescribed checks:** (a) the Windows pattern now fires;
  (b) the Q-007 currency-plant concurrency fix SURVIVED the transfer — foreign
  plant → exit 0, owned plant → exit 1, so the transient-red bug did not
  regress; (c) `kit_integrity` reddens on a tampered `.kit/` and goes green
  again after `kit_sync.py`; (d) `record()`/`./verify report` still work from
  the vendored source. Project gates, test commands, and everything else in
  `./verify` were untouched by the migration.

- **D-011 · 2026-08-18 — Leak gate ignores foreign currency-probe plants.**
  Gate change to `./verify` (human-authored). `kit/currency.py` proves the leak
  gate fires by planting identity paths in `.kit-currency-plant-*` files in the
  working tree and running `./verify`; because the gate deliberately scans
  UNTRACKED files, a concurrent run of our own read someone else's plant and
  went red on a file that had vanished by the time it was investigated. Runs now
  exclude plants they do not own; the owning probe names its file in
  `KIT_LEAK_PLANT` and still sees it, so currency.py's proof still works.
  **Verified not to be a weakening, empirically rather than by argument:** an
  ordinary untracked file containing an identity path still reddens the gate
  (exit 1), and only the fixed dot-prefixed probe pattern is excluded.

- **D-010 · 2026-08-18 — Golden gate split, not loosened (Q-006).** Human
  decision, required because relaxing a golden comparison is a gate change.
  `Math.log` is not bit-identical across platforms, so raw-float noise tables
  cannot be pinned exactly; assignments can and still are. New rule: assert
  EXACT where determinism is by construction (`u`, `rngState` — integer
  arithmetic), tolerance (8 ULP) only where libm is in the path, and prove the
  tolerance still fires with a self-test. Net effect is a gate that is more
  precise about what is guaranteed, not a weaker one. The engine was never
  wrong and was not changed.

- **D-008 · 2026-08-17 — Kit retrofit to 2.1.0; QM-3 filed and ranked.**
  `currency.py` reported BEHIND by 2: the 2.0.0 baseline was fully present but
  undeclared, and 2.1.0's mailbox scope rule was missing. Applied: a
  marker-delimited `## Mailbox` section appended to CLAUDE.md (append-only,
  re-runnable), `kit_version: "2.1.0"` written to the manifest, and the
  untracked `.gitattributes` committed — it passed the presence check because
  it existed on disk, but untracked it would not survive a clone, so the LF
  guarantee it enforces was false for every reader but the author. Closing
  check: `currency.py` prints CURRENT / nothing to do.
  Alongside (human-approved, not kit business): `QM-3-fx-pool-spec.md` filed
  into the protected `docs/specs/` and ranked **normative for FX/routing only,
  subordinate to QM-0** — which it names as prerequisite. `routing-morph-demo
  .html` moved to `prototype/` as reference-only. QM-3's phase ownership is
  NOT resolved: it addresses "the host synth's" integration, which the roadmap
  places at P4, so it is logged as ROADMAP **Q-005, blocked on a human ruling**
  rather than guessed into a phase.

- **D-007 · 2026-08-08 — Two commit-policy calls QM-0 §6 does not make.**
  (a) **A BAR event also satisfies BEAT policy.** §6.1 lists the policies but
  not how a host that emits only the strongest boundary it crossed should
  behave. Treating a bar as a beat is musically true and fails safe; the
  converse (a beat flushing a BAR queue) is rejected. (b) **`discardPending()`
  exists**, though §6 does not mention it. Without it a queue built at one
  field position can only be resolved by committing it — a user who drags
  somewhere by accident under NOTE_ON would have to play the mistake to clear
  it. Both are additive to the spec, not contradictions; if either is wrong,
  QM-0 §6 is the place to fix it.

- **D-006 · 2026-08-05 — Library standby (plugin-skeleton).** A shared
  infrastructure library is being founded; its FOUNDATIONS document will define
  contracts this project eventually consumes (parameter registry, mod routing,
  scoped presets, event pipeline, payload interfaces). This repo is on **passive
  standby**: no refactoring toward the library, no adopting unseen interfaces,
  no extracting shared code, no speculative preparation. Writes stay home and
  the ROADMAP continues unchanged. A mediator agent in the library repo will
  open a brief→response dialogue when this project becomes the active
  correspondent. Passive obligations during work already underway: prefer
  stable hierarchical parameter addresses and record any old→new rename; add no
  new singletons or global state to anything that could plausibly be per-voice
  or per-module elsewhere; keep engine internals behind clean boundaries with no
  GUI/host reach-in. Standby artifact: `INTEGRATION-STANDBY.md`, maintained
  cheaply, which becomes the first brief when the mediator calls.
  *Provenance note:* the notice arrived without an origin line (authoring
  project, date, motivating decision) — recorded here as received, per doctrine
  §Provenance on agent-authored prompts.

- **D-005 · 2026-07-24 — Knowledge-loop forks.** Candidate lessons live
  inline in LIBRARY.md (tagged `candidate`), no QUARANTINE.md; reflection
  trigger is voluntary (interactive project, per manifest Q9). Tags from
  survey Q8: `m4l-lom`, `max-js`, `morph-engine`, `device-ux`.
- **D-004 · 2026-07-24 — Public repo hygiene.** Remote
  `github.com/Lifted-Truck/quantum-morph` is PUBLIC. The leak gate in
  `./verify` is CI-blocking; `files.zip` (raw seed archive) is gitignored,
  its contents committed as `docs/specs/`.
- **D-003 · 2026-07-24 — Doc precedence.** QM-0 is normative; QM-1/QM-2
  implement it; the lab prototype (`prototype/quantum-morph-lab.html`) is
  reference-only and superseded on coupling (blending → mask formulation,
  QM-0 §5). No agent builds from the prototype where QM-0 disagrees.
- **D-002 · 2026-07-24 — Engine language & seam.** QM-0 reference
  implementation is dependency-free ES-module JS in `engine/`, runnable under
  both Node (tests/CI) and Max `v8` (device) — one codebase, no port between
  prototype and device. Future native ports (QM-2) golden-test against it
  (port-pin, manifest Q5).
- **D-001 · 2026-07-24 — Spin-up survey.** 9-question survey conducted
  interactively; answers in `project.manifest.json` (PROVISIONAL). Shape:
  engine + app, rung 1 (single thread), domain core = QM-0 engine, oracle =
  pinned goldens for core + smoke for device layer, second impl planned
  (QM-2), standalone-for-now in the ecosystem (register in tracks, no briefs
  yet), no audit thread, long-lived/interactive-only.
