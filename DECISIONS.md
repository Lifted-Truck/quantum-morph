# DECISIONS — quantum-morph (append-only)

One entry per ratified decision, newest first. Never edit past entries;
supersede them with a new one.

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
