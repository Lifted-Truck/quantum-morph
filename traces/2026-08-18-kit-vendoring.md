# kit-vendoring — kit 2.4.0: gate mechanism vendored to .kit/

- **Queue item:** unqueued: a kit-owned mechanical migration, instructed by the
  human. Not a retrofit (no survey, no rung, no plan-then-pause).
- **Why:** kit gate code was COPIED per repo, so a `kit_version` was a claim
  about a copy. The fleet measurement (ten leak_gate implementations, nine
  missing the Windows pattern) predicted this repo would be one of the nine.
  It was.
- **Evidence consulted:** `kit_sync.py` output (`current`, kit 2.4.0);
  `migrate_to_vendored.py` (119 → 70 lines, 49 removed, all kit-owned); a
  saved copy of the pre-migration `verify` for a before/after of the regex;
  `.kit/MANIFEST`; the post-migration `verify` read in full to confirm the
  project's own gates survived.
- **Checks run — the three prescribed, plus four the instructions did not ask
  for, because the whole point of 2.4.0 is that presence is not reachability
  and reachability is not firing:**
  1. `./verify fast` exit 0, 60 tests, 60 pass; project gates intact.
  2. `grep -c 'kit/kit-gates.sh' verify` = 3 (reachable, not merely vendored).
  3. Planted `/Users/<user>/private` — named in the output. Gate fires.
  4. Planted `C:\Users\<user>\private` — **now caught; it was not before.**
     Old: `/(Users|home)/[^/]+/`. New adds `[A-Za-z]:\+Users\+[^\]`.
  5. The Q-007 currency-plant fix SURVIVED the transfer: foreign plant → exit
     0, owned plant (`KIT_LEAK_PLANT`) → exit 1. Checked because the migration
     deletes the exact block Q-007 patched, and a silent regression there would
     have reinstated a transient-red bug that already cost an investigation.
  6. `kit_integrity` reddens on a tampered `.kit/kit-gates.sh` and goes green
     after `kit_sync.py` restores it.
  7. `record()` still writes `.harness/last-verify.json`; `./verify report`
     works from the vendored definition.
- **Alternatives rejected:**
  - *Reviewing the Q-007 verify diff separately* — unnecessary by the notice's
    own note, and confirmed: migration deleted the block it patched, so it is
    subsumed. The behaviour was re-verified rather than assumed.
  - *Trusting the migration because it reported success* — rejected; that is
    the declared-vs-effective trap in a new costume (L0007).
- **Verify:** `./verify fast` exit 0 — 60 tests, 60 pass.
- **Open questions:**
  1. `fast()` still returns a single aggregate exit code (carried from Q-007).
  2. Not pushed, per instruction. Nothing was committed into `autonomous`.
