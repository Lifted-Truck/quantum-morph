# kit-retrofit — currency 2.1.0; QM-3 filed; routing demo relocated

- **Queue item:** unqueued: `/retrofit`, a CHANGELOG-driven migration. Opened
  and closed on `kit/currency.py`, which is the authority on what the session
  was for.
- **Why:** the repo declared nothing, and absence of a declaration is read as
  `pre-2.0.0`, never as current — the silence that once hid five repos. The
  delta was two entries, and the entries were the plan.
- **Evidence consulted:** `currency.py` output before (BEHIND by 2, all eleven
  2.0.0 items `[x]`) and after (CURRENT, nothing to do);
  `kit/CHANGELOG.md` retrofit actions for 2.0.0, 2.0.1 (asks nothing of a
  repo — tool change only), 2.1.0; `INTEGRATIONS §3 Scope` as quoted in the
  2.1.0 entry; `docs/specs/QM-3-fx-pool-spec.md` §1 read for placement.
- **Alternatives rejected:**
  - *Declaring 2.0.0 because the baseline was complete* — rejected: step 5 says
    a repo declares the kit version only when the whole delta is closed, and
    2.1.0 was still open at that point. Declaring 2.0.0 would have been true
    but stale by one entry.
  - *Treating `.gitattributes` as done because the checker said `[x]`* —
    rejected: it was untracked. The gate asserts presence on disk and cannot
    see trackedness, so the declaration would have been true of this machine
    and false of the repo. Committed it instead.
  - *Filing QM-3 into a phase* — rejected: it says "the host synth's"
    integration, which is QM-2/P4 territory, while the roadmap has P2 (the M4L
    device) next. Guessing which is right picks different work; logged as
    Q-005 blocked on a human ruling.
  - *Rewriting CLAUDE.md to place Mailbox in the harness layer* — rejected: the
    retrofit is append-only and marker-delimited, so it went at the end where
    re-running replaces only what is between the markers.
- **Verify:** `./verify fast` exit 0, 59 tests. `currency.py`: CURRENT.
- **Open questions:**
  1. Q-005 (QM-3 ownership and phase) is a blocking ask, unanswered.
  2. QM-3 makes every send-matrix cell a morph slot; an N-module pool needs
     ~N²/2 cells, and QM-1 §2's 64-slot ceiling arrives quickly. Raised in
     Q-005; not investigated.
  3. No `integrations/` directory exists yet. The Mailbox section names it as
     where briefs land and says so explicitly rather than creating an empty
     directory that would look like a mailbox that had been checked.
