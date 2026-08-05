# quantum-morph

**A stochastic preset-morph instrument for Ableton Live (Max for Live).**

Four corner patches sit on a 2D field. Instead of crossfading between them,
every controlled parameter is *assigned whole* to one corner by a
deterministic Gumbel-max selection law — continuous parameters can still
glide, but discrete ones (wave selection, filter type, routing…) flip
coherently instead of snapping at 50%. The engine is a pure function of
(position, state, frozen noise table): the same spot on the field always
sounds the same. A playable instrument, not a random patch generator.

![Quantum Morph Lab, a dark interface in three regions. Top left: a square morph
field, its quadrants tinted by four corner patches — A·GLASS amber, B·GRIT red,
C·HOLLOW blue, D·BLOOM green — with a puck at centre and a stacked bar beneath
showing the live corner census, 27% / 27% / 5% / 41%. Top right: a FLIP ENGINE
panel — temperature 1.00, module coupling 30%, flip glide 8 ms, Quantum/Morph
and Immediate/Next-note toggles, reshuffle on seed 1024, and player controls.
Bottom: six parameter modules (OSC A, OSC B, FILTER, ENV, LFO, FX), each row a
parameter and its value — osc A wave sawtooth, filter cutoff 6.5k, delay mix 50%
— with a coloured bar at the left of every row marking which corner currently
owns that parameter.](docs/images/quantum-morph-lab.png)

<sub>The `quantum-morph-lab` browser prototype. The coloured bar on each
parameter row is the whole idea in one glance: every parameter is owned outright
by one corner, never averaged between them — and the census bar shows those
owners landing in proportion to where the puck sits on the field. Reference-only,
and superseded on coupling by QM-0 §5 (see the map below); the shipping Max for
Live device does not exist yet.</sub>

## Status

🔧 **P1 — engine built, device unbuilt.** The QM-0 reference engine is
complete and green (41 tests + pinned goldens, `./verify fast`). QM-0 §10
acceptance tests 1–6 pass; 7–8 are device-layer. No Max device exists yet, and
the engine has **not** been run inside Max — only under Node. See
[ROADMAP.md](ROADMAP.md) for phases, gates, and open questions.

## Map

| Path | What |
|---|---|
| `docs/specs/QM-0-core-engine-spec.md` | **Normative** engine spec — wins over everything below |
| `docs/specs/QM-1-m4l-device-spec.md` | The Max for Live MIDI-effect device |
| `docs/specs/QM-2-instrument-integration-spec.md` | Contract for future native-instrument ports |
| `docs/prior-art.md` | Prior-art landscape + IP flags (swept 2026-07-24) |
| `engine/` | QM-0 reference implementation — dependency-free ES modules: `rng` · `weights` · `noise` · `select` · `warp` |
| `device/` | M4L patcher + device glue — *empty until P2* |
| `prototype/quantum-morph-lab.html` | Standalone browser prototype. Reference-only; its coupling approach is superseded by QM-0 §5 |
| `tests/` | Unit tests + pinned golden assignment vectors (protected) |
| `verify` | The oracle: `./verify fast` (CI) / `full` (pre-done gate) |
| `ROADMAP.md` | Single source of truth for state and acceptance criteria |
| `DECISIONS.md` | Append-only decision log |

## Why a MIDI effect, not an audio effect

Only a MIDI device sees note events, and NOTE_ON-committed parameter changes
are what make stochastic morphing musical (QM-1 §1). The device sits before
the instrument and drives any parameter in the set via the Live API.

## Working here

Agent sessions read [CLAUDE.md](CLAUDE.md) (charter + knowledge loop).
Humans: `./verify fast` must be green before any commit lands; specs and
goldens are behind a human gate.

---
*Last verified: 2026-07-24 (P1 engine landed; statuses above checked against the tree and a green ./verify fast).*
