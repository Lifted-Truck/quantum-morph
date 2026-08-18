# leak-gate-concurrency — Q-007: the unexplained red, explained

- **Queue item:** ROADMAP Q-007 (new). Also closes Q-006, whose last criterion
  (CI green on ubuntu-x64) was met by PR #1's run.
- **Why:** a red `./verify fast` at 04:10:49Z sat between a green CI run on the
  same commit (04:09:59Z, 60/60) and a green local run (04:11:38Z) on an
  unchanged tree. I could not reproduce it and recorded it as an open question
  rather than guess. The answer arrived as an uncommitted human-authored change
  to `verify` carrying its own provenance comment: `kit/currency.py` plants
  identity paths in `.kit-currency-plant-*` files in this working tree to prove
  the leak gate fires, and the gate scans untracked files by design.
- **Evidence consulted:** `.harness/last-verify.json` at three timestamps;
  `git reflog` (no checkout/stash in the window); GitHub Actions run on
  `56dd6a6`; `git diff verify`; and a direct experiment — plant a probe file,
  plant an ordinary bad file, run the gate each way.
- **Correction to the prior trace's reasoning:** the previous session's report
  ruled the leak gate out because it swallows git errors (`2>/dev/null || true`
  → empty hits → pass). That is true and was the wrong inference: it rules out
  the gate failing on a git ERROR, not the gate firing on a genuine transient
  HIT from a foreign untracked file. The latter is what happened.
- **Alternatives rejected:**
  - *Accepting the fix on the strength of its comment* — rejected. The comment
    argues it is not a weakening; arguments are not evidence. Tested it:
    foreign plant → exit 0, owned plant (`KIT_LEAK_PLANT`) → exit 1, ordinary
    untracked file with an identity path → exit 1, clean → exit 0. Criterion 3
    of Q-007 is that experiment, not the claim.
  - *Also making `fast()` report which gate failed* — deferred, not done. It is
    the reason this needed an investigation instead of a glance, but it is a
    separate `./verify` change and needs its own approval. Recorded as
    out-of-scope in Q-007 rather than smuggled in alongside an approved fix.
- **Verify:** `./verify fast` exit 0, 60 tests, 60 pass, on the fix.
- **Open questions:**
  1. `fast()` still returns a single aggregate exit code (see above).
  2. `origin/q-006-golden-portability` still exists on the remote; the branch
     delete in the cleanup sequence did not land. Harmless, but it makes the
     branch list lie about what is in flight.
