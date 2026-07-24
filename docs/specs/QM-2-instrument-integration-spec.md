# QM-2 · Integrating Quantum Morph into an Existing Instrument

**Implements:** QM-0 core engine.
**Audience:** a developer adding morph to a synth that already exists and already has presets, an editor, and users.
**Candidates in your own catalogue:** HYPERSAW, PLACE, TERRANE, ORRERY.

This is a **design contract**, not an implementation plan. It says what the instrument must expose and guarantee. Several sections are marked ◇ **open** — those are decisions we haven't made yet and shouldn't pretend we have.

---

## 1. The premise, restated

You said this would only work for gradual settings. The opposite is closer to true, and it's worth stating plainly because it determines what you build first.

Continuous parameters already morph fine — every vector synth since the Prophet VS interpolates them, and nobody is unsatisfied with how a crossfaded cutoff sounds. The unsatisfying part of preset morphing has always been **discrete parameters**: wave selection, filter type, routing, sync, LFO shape, unison mode. Today they either snap at 50%, get excluded from the morph entirely, or force the whole thing to be a volume crossfade between two rendered voices.

Stochastic flipping is the only treatment for those that isn't a compromise. So: **quantum is mandatory for discrete parameters and optional for continuous ones.** An instrument that only exposes continuous parameters to this engine has implemented the least interesting half.

---

## 2. What the instrument must provide

A **parameter manifest** — static metadata, one entry per morphable parameter:

```
id                stable across versions, never reused
display_name
type              continuous | discrete-ordered | discrete-unordered
range / options
warp              linear | log | custom curve      (QM-0 §4.1)
module_id
salience          authored default, user-overridable (QM-0 §3.2)
morph_class       SAFE | VOICE_BOUND | STRUCTURAL | FORBIDDEN   (§3)
smoothing         the parameter's own ramp time, if any
```

`morph_class` is the field that does not exist in any current instrument and is the real work of integration. Everything else you probably have already in some form.

### 2.1 Salience is authored, not derived

QM-1 guesses salience from parameter names because the host gives it nothing better. A native instrument has no such excuse. The person who designed the synth knows that PLACE's terrain scale is worth ten of its weather-mix, and that knowledge belongs in the manifest.

Budget real time for this. On a 200-parameter instrument, authoring salience is an afternoon of listening, and it is the difference between a morph that sounds designed and one that sounds like a randomizer.

---

## 3. Morph classes

The taxonomy that makes this safe:

| Class | Definition | Handling |
|---|---|---|
| **SAFE** | Can change at any time; ramps without artifact | Commit immediately, glide per QM-0 §6.2 |
| **VOICE_BOUND** | Cannot change mid-voice without a click or a discontinuity, but is cheap to change between voices | Latch at voice allocation; running voices keep their value until they end |
| **STRUCTURAL** | Changing it requires reallocation, buffer resize, table rebuild, or state reset | §3.1 |
| **FORBIDDEN** | Must never be under morph control | Excluded from the manifest entirely |

**FORBIDDEN** is short and non-negotiable: master output gain, tuning reference, oversampling factor, anything that could produce a level jump the user didn't ask for, and anything whose flip could damage monitoring. Do not make this user-overridable.

**VOICE_BOUND** is most discrete parameters and most envelope segments. The handling is the important part: **a voice keeps the parameter set it was born with.** This falls out of QM-0 §6.3 (commit atomicity) and it has a delightful consequence — with a chord held and `NOTE_ON` timing, each voice can be carrying a different corner's character. The morph becomes an ensemble rather than a setting.

### 3.1 STRUCTURAL parameters

Unison voice count, oscillator algorithm, FFT size, wavetable slot, delay line length, modal bank size. These can't flip in a callback without a glitch.

Three legal policies, per parameter:

1. **Defer to next voice** — same as VOICE_BOUND but the reallocation happens in the voice-allocation path, off the audio thread if your architecture allows. Preferred where possible.
2. **Defer to silence** — hold the pending value until all voices have released, then apply. Correct for global structures like an FFT size. Requires the pending change to survive indefinitely, and requires the UI to say so.
3. **Exclude** — the parameter is pinned and does not participate. Always available as a fallback.

An instrument that classifies everything as STRUCTURAL-exclude has a working, boring morph. That is an acceptable first shipping state and a good de-risking target.

◇ **Open:** whether STRUCTURAL parameters should be *offered* to the morph engine at all in v1, or held back until the voice architecture is known to tolerate them. For HYPERSAW specifically, oscillator count and coupling topology are exactly the parameters a user would most want to morph and exactly the ones most likely to glitch.

---

## 4. Coupling graph authoring

QM-1 groups by owning device because that's all the host knows. A native instrument can do better, and should.

- **Default:** flat modules along signal-flow lines. Ships with the instrument, authored once.
- **Recommended addition:** a static coupling graph (QM-0 §5.3) capturing real internal dependencies — the ones where a mismatched pair produces silence or a scream rather than a variation. Osc level ↔ osc enable. Filter type ↔ resonance range. Feedback amount ↔ damping.
- **Per-patch override:** ◇ **open.** A sound designer building a morph preset may want a grouping specific to those four patches. This is real expressive power and it is also a preset-format complication and a support burden. Undecided.

The test for whether a dependency belongs in the graph: **can any combination of these two parameters' corner values produce an unusable result?** If yes, couple them. Coupling is not for taste, it is for safety; taste is what the coupling *amount* knob is for.

---

## 5. Editing while morphing

The problem your colour idea already solves, stated precisely: the user is at position (0.6, 0.3), turns the filter cutoff knob. What did they just edit?

**Recommended: edit the owning corner.** The knob is currently showing corner B's cutoff because slot B won the argmax. Turning it edits B's stored cutoff. The knob ring is B-coloured, so the user already knows this before they touch it.

This is the answer that makes the colour scheme load-bearing rather than decorative, and it is the reason the colour idea is the strongest part of the original concept. It is also the answer that scales: with 200 parameters, you cannot ask "which corner?" on every edit.

Alternatives, both worth having as a modifier-key or preference:

- **Edit all corners** — apply the delta to all four. Correct for global trims ("everything is too bright").
- **Edit nearest corner** — edits whichever corner dominates the current position, regardless of who owns this slot. Predictable but disconnects the knob from what you're hearing.

Under `GRADUAL` mode a continuous parameter has no owning corner. Grey the ring and either disable editing or fall back to edit-nearest. ◇ **Open:** which. Disabling is honest but feels broken; edit-nearest is usable but means the same knob behaves differently in two modes.

### 5.1 Colour discipline

The original idea was each corner's scheme across the whole UI. At 200 parameters that will be exhausting to look at and will fight your instrument's existing visual identity.

Restraint that keeps the information and loses the noise:

- Tint **only the value arc / knob ring / slider fill**. Chrome, labels, and panel stay neutral.
- Brief flash on flip so changes register peripherally without being read.
- Corner colours appear at full saturation only in the field, the corner labels, and the census.
- One optional "provenance" view mode that does go full-colour, for users who want it.

---

## 6. Host automation conflict

This is the thorniest part of native integration and it has no clean answer.

Your instrument's parameters are already exposed to the DAW. Once morph is engaged, those parameters are *derived* — the engine writes them continuously. If the host is also automating them, you have two writers.

Policy (QM-0 §8.3): **morph position is the automated thing; morphed parameters are read-only to the host while morph is active.**

That implies:

- Morphed parameters must report as automatable but reject or ignore host writes while morph is engaged, or
- the instrument exposes a separate set of morph parameters (`Morph X`, `Morph Y`, `Temperature`, `Coupling`, `Reshuffle`, `Depth`) and morph-controlled parameters visibly grey out.

Neither is invisible to the user, and existing sessions that automate a cutoff will break when the user enables morph on that cutoff.

◇ **Open, and I'd want to talk about this before you build it.** Options include a per-parameter "morph exempt" flag (user removes a parameter from morph so they can keep automating it — this is just `FROZEN` from QM-0 §4, which may be the whole answer), an "automation wins" mode where host writes take over a slot until morph position changes, or refusing to solve it and documenting that morph and per-parameter automation are mutually exclusive.

The `FROZEN` answer is elegant enough that it might be right: a parameter the host automates is simply not in the morph. It costs the user nothing except knowing to set it.

---

## 7. Preset format

A **morph preset** is:

```
format_version
4 × corner patch references or embedded patches
engine state (QM-0 §8.1) including the noise table
per-slot mode / salience / module overrides
```

Decisions that follow:

- **Embed, don't reference.** A morph preset that breaks because the user renamed one of its corner patches is a bad preset. Embed full copies; offer "update from source" as an explicit action.
- **Manifest drift.** A preset saved under manifest v3 loaded into v4 will have unknown or missing parameter ids. Unknown ids are dropped with a warning; missing ids take the instrument default and are excluded from morph. Never fail to load.
- **Backwards compatibility.** A regular single patch loads as a morph preset with all four corners identical, which produces exactly the original sound at every field position. Morph is then discoverable by editing one corner. This is a good onboarding path and costs almost nothing.

---

## 8. Extension: polyphonic superposition

Worth naming because it is native-only, cheap once §3 is done, and genuinely not available anywhere else.

Instead of one global assignment, **give each voice its own draw** at note-on: same weights, same salience, same coupling, different Gumbel table seeded from a voice counter. Play a chord and every note is a different point in the ensemble of possible patches, all statistically consistent with where you're standing on the field.

Controls: a `Voice spread` amount from 0 (all voices share the global assignment, current behaviour) to 1 (fully independent per voice).

This is the version of the idea that could not be done as a mod device, and the one most likely to make somebody actually want the native implementation. It also risks sounding like a broken sampler, which is why it needs a continuous amount control rather than a switch.

Fits your existing work directly: HYPERSAW is already an ensemble of coupled oscillators, and voice-level assignment spread is the same idea one level up the hierarchy.

---

## 9. Requirements checklist

An instrument is ready to host the morph engine when:

- [ ] Every morphable parameter has a stable id, a warp curve, and a `morph_class`
- [ ] Salience is authored per parameter, not guessed
- [ ] Modules are defined; hard dependencies are coupled
- [ ] Parameter changes are smoothed at the audio layer — the engine assumes ramping is the instrument's job, not the engine's
- [ ] Voices latch VOICE_BOUND parameters at allocation
- [ ] STRUCTURAL parameters have a declared deferral policy
- [ ] The engine is deterministic: no wall-clock, no free-running RNG, no dependence on block size or sample rate
- [ ] State serializes and recalls bit-identically (QM-0 §10.8)
- [ ] Editing behaviour under morph is defined and visible in the UI
- [ ] The instrument still works with morph disabled, byte-identically to before

The last one is the acceptance gate. Morph is an addition to the instrument, not a rewrite of it, and any integration that changes the sound of existing presets has failed regardless of how good the morph is.

---

## 10. Open decisions

Collected from above, in the order I'd want to resolve them:

1. **Automation conflict (§6).** Is `FROZEN` the whole answer, or do you need a takeover mode? This shapes the parameter system and is expensive to change later.
2. **STRUCTURAL scope (§3.1).** Which structural parameters, if any, participate in v1?
3. **Editing under GRADUAL (§5).** Disable, or fall back to edit-nearest?
4. **Per-patch coupling overrides (§4).** Expressive power vs. preset-format and support cost.
5. **Which instrument first.** PLACE and TERRANE have the most morphable surface; HYPERSAW has the cleanest existing coupling metaphor and the smallest parameter count, which makes it the better pilot even though it's the less obvious showcase.
