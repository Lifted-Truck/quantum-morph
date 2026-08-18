# golden-portability — Q-006: CI was red for 13 days; the goldens were wrong, not the engine

- **Queue item:** ROADMAP Q-006 (new). Also carries the D-009 PR-workflow setup.
- **Why:** switching to a PR workflow required knowing what `main`'s CI status
  actually was. It was `failure`, and had been since 2026-08-05 — through four
  commits, each of which I reported as green. Every one of those reports was
  true of `./verify fast` on this machine and none of them was true of the
  remote oracle. I had also said, at the screenshot push, that I would confirm
  CI stayed green, and then only confirmed the image resolved.
- **Evidence consulted:** GitHub Actions runs 30067563844 (success, scaffold),
  31055291797 / 32093270570 / 32093558058 (all failure, every commit carrying
  engine goldens); the failing log, which showed 55 pass / 4 fail with all four
  failures on raw-float table comparisons and `✔ pinned assignments match
  exactly across the position grid` passing; `engine/rng.mjs` (u is an exact
  integer division; g calls Math.log); QM-0 §10.1 (bit-identical ASSIGNMENT)
  and §8.2 (store the table, do not reconstruct).
- **Root cause:** `g = −ln(−ln u)` routes through `Math.log`, which V8 does not
  guarantee bit-identical across platforms or builds. Goldens generated on
  darwin-arm64 were compared float-exact on ubuntu-x64. The engine was correct
  throughout; the gate asserted something the spec never required and that
  nothing could make true — Max's `v8` would have been a third answer.
- **Alternatives rejected:**
  - *Drop float pinning entirely* — rejected: loses the tripwire §8.2 warns
    about (a changed PRNG or draw order silently breaking saved presets).
  - *Make the engine bit-portable* (own log implementation) — rejected: heavy,
    risks correctness, and buys a property QM-0 never asked for.
  - *Quarantine the four tests as debt* — rejected: leaves CI red, which is
    what caused this, and blocks the PR workflow being adopted in the same
    breath.
  - *Fixing it silently as an obvious bug* — rejected: relaxing a golden
    comparison is a gate change and the charter reserves that for the human.
    Asked; D-010 records the answer.
- **Verify:** `./verify fast` exit 0 — 60 tests, 60 pass (was 59; the new one
  is the gate self-test). Local only at time of writing; **the criterion that
  matters is the CI run on this PR**, since local green is exactly what hid
  the problem for 13 days.
- **Open questions:**
  1. QM-0 §8.2's "enter a seed to regenerate a table from scratch" is
     platform-dependent at the last ULP. Spec amendment candidate; recorded in
     Q-006, not acted on.
  2. Whether `u` is genuinely bit-exact cross-platform is a hypothesis from
     reading `rng.mjs`, not a measurement — this PR's CI run is the experiment
     that settles it. If `u` also drifts, the split is wrong and the exact
     assertions will fail on the runner, loudly, which is the point.
