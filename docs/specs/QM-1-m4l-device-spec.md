# QM-1 · Quantum Morph — Max for Live Device

**Implements:** QM-0 core engine.
**Form factor:** Max **MIDI Effect**, placed before the instrument in the chain.
**Working title:** QUANTUM MORPH

---

## 1. Why a MIDI effect, not an audio effect

The instinct is to build an audio effect and sit it after the instrument. That is the wrong slot, for one reason that governs the whole design: **`NOTE_ON` commit timing is the mode that makes this musical, and only a MIDI device sees note events.**

A MIDI effect placed before the instrument:

- receives every note before the instrument does,
- can delay the note by a few milliseconds to let parameter writes land first (§5.3),
- passes MIDI through otherwise untouched,
- controls any parameter on any device via the Live API, regardless of position in the chain.

The cost is that the device shows up in the MIDI chain rather than next to the sound, which is a minor UX oddity. Accept it.

---

## 2. Data model

```
Device
├─ slots[0..63]           ordered, user-arranged
│   ├─ path               Live API path to the parameter
│   ├─ display_name       device name + parameter name
│   ├─ min, max           from the parameter
│   ├─ is_quantized       from the parameter
│   ├─ value_items[]      from the parameter, when quantized
│   ├─ module_id          default: owning device; user-editable
│   ├─ mode               AUTO | QUANTUM | GRADUAL | PINNED(k) | FROZEN
│   ├─ salience           0.1 – 4.0
│   ├─ warp               linear | log   (auto-guessed, user-editable)
│   └─ enabled
├─ corners[4]
│   ├─ name, colour
│   └─ values[64]         snapshot
├─ engine                 x, y, T, c, glide, policies (QM-0 §8.1)
└─ noise_table            g[64][4], u[64], G[M][4]
```

**64 slots** is the v1 ceiling. It is generous for a hand-built morph and it keeps the LOM write budget tractable (§5.1). Make the limit a constant, not an assumption baked into patcher structure.

### 2.1 Discrete detection is free

Live parameters expose `is_quantized`, and quantized ones expose `value_items`. Use it: any quantized parameter is classified discrete and defaults to `QUANTUM` under `AUTO`, per QM-0 §4. This is the single best argument for building the M4L version first — in a native instrument you have to author this metadata by hand, and here the host hands it to you.

Watch for the false positives: on/off toggles for whole devices, and parameters that are quantized but ordered (octave switches, sync divisions), which want `GRADUAL`-then-snap available as an override.

### 2.2 Salience auto-seed

On mapping, guess `σ` from the parameter name, then let the user fix it:

| Match (case-insensitive) | σ |
|---|---|
| `cutoff`, `freq`, `pitch`, `tune`, `transpose`, `octave`, `coarse`, `ratio` | 3.0 |
| `wave`, `shape`, `type`, `mode`, `algorithm`, `unison`, `voices` | 2.5 |
| `attack`, `decay`, `sustain`, `release`, `time` | 1.6 |
| `res`, `q`, `drive`, `amount`, `depth` | 1.2 |
| `dry/wet`, `mix`, `send`, `feedback`, `pan` | 0.5 |
| *(no match)* | 1.0 |

Any quantized parameter gets `max(guess, 2.0)` — discrete flips are always perceptually large.

---

## 3. Mapping workflow

1. **Map** button arms the device.
2. User clicks a parameter in Live. The device resolves the clicked parameter to a `live.path`, reads its metadata, appends a slot, disarms.
3. Repeat, or hold a modifier to stay armed for rapid multi-mapping.
4. **Map device** — one click grabs every parameter of a selected device, filtered by a "skip defaults" heuristic (macros only, or all).

> **Verify before building.** The exact mechanism for "user clicks a parameter, device learns it" has more than one implementation in M4L and the reliable one has changed across Live versions. The two candidates are the `live.remote~`-style mapping used by mappable UI objects, and observing the selected-parameter path via the Live API. Confirm against the current Live Object Model reference for your target Live version before committing patcher architecture — this is the one part of the device where getting it wrong means a rewrite rather than an edit.

### 3.1 Bank capture

**Capture to A/B/C/D** reads current values of all enabled slots into that corner. The workflow this supports is the real one: build a patch, capture, build another patch on the same device, capture, repeat. The user never authors four patches in the abstract; they iterate on one and snapshot it four times.

**Recapture** overwrites one corner in place. **Nudge** re-captures only slots currently assigned to that corner, which lets a user tune the corner they're standing on without disturbing the others.

### 3.2 Broken paths

Devices get deleted, renamed, reordered. A slot whose path no longer resolves goes **stale**: greyed in the list, excluded from the engine, retained in the state so that undoing the deletion restores it. Never silently drop a slot, and never let a stale slot throw on every commit tick.

---

## 4. UI

```
┌───────────────────────────────────────────────────────────────┐
│ QUANTUM MORPH          [MAP] [MAP DEVICE]        seed 40219 ⟳ │
├──────────────────────────────┬────────────────────────────────┤
│  A · GLASS        B · GRIT   │  TEMPERATURE   ▓▓▓▓▓░░░  1.00  │
│                              │  COUPLING      ▓▓▓░░░░░  0.32  │
│         [ XY FIELD ]         │  GLIDE         ▓░░░░░░░  8 ms  │
│      territory overlay       │                                │
│         ●                    │  CONTINUOUS  [QUANTUM][GRADUAL]│
│                              │  TIMING  [NOW][NOTE][BEAT][BAR]│
│  C · HOLLOW       D · BLOOM  │                                │
├──────────────────────────────┤  AUTO-SHUFFLE  rate ░░  depth ▓│
│ ████████░░░░████░░██  census │  ⟳ 7 flips queued              │
├──────────────────────────────┴────────────────────────────────┤
│ SLOTS                                      [A][B][C][D] capture│
│ ▌ Wavetable  Osc 1 Wave     saw2      OSC1  AUTO  σ3.0  ●     │
│ ▌ Wavetable  Filter Freq    2.4k      FILT  AUTO  σ3.0  ●     │
│ ▌ Wavetable  Filter Res     0.62      FILT  GRAD  σ1.2  ●     │
│ ▌ Echo       Dry/Wet        34%       FX    AUTO  σ0.5  ●     │
└───────────────────────────────────────────────────────────────┘
```

- **Left border colour** of each slot row = owning corner. This is Julian's colour-provenance idea and it is the primary readout; keep the rest of the row chrome neutral so 64 rows don't become a rainbow. Flash the row background briefly on flip.
- **Click a slot row** → its territory renders on the field. Reshuffle with a territory up and you watch the region map redraw. This turns reshuffle from a slot machine into something readable, and it is the feature most likely to distinguish this device from a toy.
- **Census bar** under the field, four segments, percentages when a segment exceeds ~10%.
- **Mode** and **σ** are inline on the row, editable in place. Not in a submenu — QM-0 §4 expects these to be used constantly.
- Territory rendering at 56×56 for 64 slots is trivial; recompute only on selection, reshuffle, `T`, or `c` change.

---

## 5. Engine and timing

### 5.1 Write budget

Live API parameter writes are not audio-rate and not free. Budget:

- Commit ticks at **60 Hz maximum**. Coalesce anything faster.
- Write **only changed slots**. A field drag at `IMMEDIATE` with `c = 0.4` typically changes 2–8 slots per tick, not 64.
- On a full reshuffle, expect up to 64 writes in one tick. Spread across two ticks if profiling shows a spike.
- Target: < 5% CPU on the M4L device at 60 Hz with 64 slots mapped.

### 5.2 Glide is stepped, and that is a real limitation

QM-0 §6.2 specifies an 8 ms linear ramp. At a 60 Hz write rate an 8 ms ramp is *one write*. There is no smoothing to be had at the LOM layer — you are writing setpoints into whatever smoothing the target device happens to implement internally, which varies from excellent (most Live devices) to none (many third-party plugins).

Consequences to design around, not paper over:

- Glide below ~20 ms is effectively a step. Expose the control anyway, because the value lands in the target's own smoother and longer glides do work.
- **Clicky targets are why `NOTE_ON` is the default timing policy in this device.** If a mapped parameter clicks when jumped, don't jump it during a note.
- Document that the native version (QM-2) does not have this limitation. It is the main sonic reason to eventually build one.

### 5.3 Note-on commit and the write/note race

At `NOTE_ON`, the sequence per incoming note is:

1. Commit the pending assignment — issue parameter writes.
2. Wait `pre-delay` ms.
3. Pass the note through.

Without step 2, the instrument may receive the note before the parameter writes have been processed, and the note plays the *previous* assignment — intermittently, depending on scheduler ordering. Expose **pre-delay** as a control, `0–10 ms`, default `3`.

This is latency, and it is honest to call it that. 3 ms is below the threshold where it affects playing feel; it is not below the threshold where it affects tight programmed drums, so make it settable to 0 for users who would rather have the occasional stale note.

### 5.4 Transport sync

`BEAT` and `BAR` timing and clock-synced auto-reshuffle observe the Live transport. When the transport is stopped, `BEAT`/`BAR` degrade to `IMMEDIATE` rather than freezing the device — a morph that does nothing because the transport isn't rolling is a support ticket, not a feature.

### 5.5 Undo

Parameter writes via the Live API can generate Live undo steps. Sixty writes a second will destroy the undo history and may cost real CPU.

Investigate, in order:
1. Whether the write mechanism you settle on in §3 generates undo entries at all.
2. Wrapping commit batches in explicit undo-step begin/end so a whole commit is one entry.
3. Suppressing undo entirely for engine-driven writes, if the API permits.

> **Flagged risk.** This is the second thing to prototype, right after mapping. If engine writes flood undo and can't be suppressed, the device is unusable in a real session regardless of how good it sounds — and you want to know that in week one, not week six.

---

## 6. Automatable device parameters

Exposed to Live's automation lane:

| Parameter | Range | Notes |
|---|---|---|
| `Morph X` | 0–1 | |
| `Morph Y` | 0–1 | |
| `Temperature` | 0.02–4 | log taper |
| `Coupling` | 0–1 | |
| `Glide` | 0–60 ms | |
| `Reshuffle` | trigger | rising edge fires a partial reshuffle |
| `Depth` | 0.05–1 | reshuffle depth |
| `Active` | on/off | off = bypass, slots return to corner A |

Automating `Morph X/Y` while a coherent noise table is frozen is the actual performance workflow: the table is the "arrangement" of the morph, and the automation is the take. Two automation lanes plus a frozen table gives fully reproducible playback, which is the payoff for QM-0 §1.

`Reshuffle` as an automatable trigger means a user can place reshuffles on specific bars. Support that.

---

## 7. Persistence

All state saves with the Live set and with device presets. The noise table is a `dict` embedded in the device (QM-0 §8.2 — store it, don't reconstruct it). Corner snapshots and slot metadata likewise.

Two save scopes:

- **Device preset** — engine settings, slot metadata, noise table, corner values. Paths are stored but expected to be stale on load into a different set; present the user with a remap flow rather than failing.
- **Set** — everything, paths included and valid.

Version the state dict from day one. A `format_version` integer costs nothing now and saves the first user who has 40 mapped slots when you change the schema.

---

## 8. Build phases

**Phase 1 — de-risk (target: one week).** Mapping mechanism (§3) and undo behaviour (§5.5), with a hardcoded 8-slot test rig, no UI to speak of. Both are unknowns that can invalidate the architecture. Nothing else matters until they're answered.

**Phase 2 — engine.** Port QM-0 §3–§5 into the device's `js`/`v8` object. It is maybe 80 lines. Validate against the QM-0 §10 acceptance tests before wiring any UI — the census and coupling-invariance tests in particular are much easier to run headless.

**Phase 3 — mapping and banks.** Full slot list, capture, stale-path handling. Ugly UI. First real musical evaluation happens here: map Wavetable + Echo, capture four corners, and find out whether it's any good.

**Phase 4 — UI.** Field, territory overlay, colour provenance, census, inline mode and salience editing.

**Phase 5 — timing and sync.** `NOTE_ON` with pre-delay, transport-synced beat/bar, clock-synced auto-reshuffle.

**Phase 6 — automation and persistence.** Exposed parameters, versioned state, preset/set handling, remap flow.

The conditional layer (QM-0 §9) is explicitly out of scope. Do not build it into v1 even partially.

---

## 9. Known limitations to document for users

- Parameter changes are stepped at ~60 Hz; smoothness depends on the target device's own smoothing.
- Third-party plugins vary in how they respond to fast host-parameter writes; some will click, some will zipper, a few will misbehave.
- `NOTE_ON` timing introduces a small settable latency.
- Structural parameters on the target (unison voice count, oscillator mode, FFT size) may glitch when flipped mid-note. Set those slots to `PINNED` or use `NOTE_ON`.
- 64 slots maximum.
