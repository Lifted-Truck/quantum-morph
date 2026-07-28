# quantum-morph

**A stochastic preset-morph instrument for Ableton Live (Max for Live).**

Four corner patches sit on a 2D field. Instead of crossfading between them,
every controlled parameter is *assigned whole* to one corner by a
deterministic Gumbel-max selection law — continuous parameters can still
glide, but discrete ones (wave selection, filter type, routing…) flip
coherently instead of snapping at 50%. The engine is a pure function of
(position, state, frozen noise table): the same spot on the field always
sounds the same. A playable instrument, not a random patch generator.

## Status

🚧 **P0 — scaffolded, unbuilt.** Specs are normative and complete and the
prior-art sweep is done; no engine or device code exists yet. P0 closes on
human ratification of the manifest. See [ROADMAP.md](ROADMAP.md) for phases
and gates.

## Map

| Path | What |
|---|---|
| `docs/specs/QM-0-core-engine-spec.md` | **Normative** engine spec — wins over everything below |
| `docs/specs/QM-1-m4l-device-spec.md` | The Max for Live MIDI-effect device |
| `docs/specs/QM-2-instrument-integration-spec.md` | Contract for future native-instrument ports |
| `docs/prior-art.md` | Prior-art landscape + IP flags (swept 2026-07-24) |
| `engine/` | QM-0 reference implementation (dependency-free ES-module JS; runs under Node and Max `v8`) — *empty until P1* |
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
*Last verified: 2026-07-24 (scaffold; statuses above checked against the tree).*
