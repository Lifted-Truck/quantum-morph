# QM-0 · Quantum Morph Core Engine

**Status:** normative. Both QM-1 (M4L device) and QM-2 (native instrument integration) implement this document. Where they disagree with it, this document wins.

**Supersedes:** the coupling implementation in the `quantum-morph-lab` prototype, which used noise *blending*. See §5 — blending distorts the marginal distribution; the mask formulation here does not.

---

## 1. Scope and terms

| Term | Meaning |
|---|---|
| **Corner patch** | One of 4 complete parameter snapshots, indexed `k ∈ {A,B,C,D}` |
| **Field** | The 2D control surface, position `(x, y) ∈ [0,1]²` |
| **Slot** | One controllable parameter under morph control, indexed `i` |
| **Module** | A named group of slots that may be coupled (osc, filter, env…) |
| **Assignment** | `a[i] ∈ {0..3}` — which corner currently owns slot `i` |
| **Commit** | Applying a new assignment to the audio engine |
| **Epoch** | Monotonic counter incremented on every reshuffle event |
| **Noise table** | The frozen random values that make assignment deterministic in position |

The engine is a **pure function** `(position, engine state, noise table) → assignment`. It contains no free-running randomness. This is the single most important property: it is what separates a playable instrument from a random patch generator.

---

## 2. Field geometry

Corners sit at the four field corners. Weights are bilinear:

```
wA = (1−x)(1−y)      wB = x(1−y)
wC = (1−x)y          wD = x·y
Σ w = 1  for all (x,y)
```

Degenerate configurations must be supported:

- **2 corners** — the field collapses to one axis; the unused axis is inert. Weights become `(1−x, x)`.
- **3 corners** — barycentric over a triangle inscribed in the field. Points outside the triangle clamp to the nearest edge.
- **N > 4** — out of scope for v1, but the selection law in §3 is already N-agnostic. Do not write code that hardcodes 4.

---

## 3. Selection law

For each slot `i`, independently:

```
score[i][k] = σ[i] · log(w[k]) / T  +  noise[i][k]
a[i]        = argmax_k score[i][k]
```

where `w[k] ≤ 1e−9 ⟹ log(w[k]) := −∞` (a corner with zero weight can never win).

`noise[i][k]` are **Gumbel** variates, `g = −ln(−ln(u))`, `u ~ U(0,1)`, drawn once and frozen.

This is the Gumbel-max trick. Over the population of slots, corner `k` is selected with probability proportional to `w[k]^(σ[i]/T)`. At `σ = 1, T = 1` the census matches the bilinear weights exactly in expectation.

### 3.1 Temperature `T`

Global, range `[0.02, 4.0]`, default `1.0`, log-tapered on the control.

| `T` | Behaviour |
|---|---|
| → 0 | Nearest corner wins everything. No dithering. Hard 4-way switch at the quadrant boundaries. |
| 0.3 | Mostly the dominant corner, a few defectors near boundaries. |
| 1.0 | Honest proportional sampling. Census ≈ weights. |
| 2.0+ | Approaches uniform. Patches that belong to no corner. |

`T → 0` must be reachable and must produce an exactly clean switch. It is the reference baseline against which the stochastic layer is judged, and it is also a legitimate performance mode.

### 3.2 Salience `σ[i]`

Per-slot, range `[0.1, 4.0]`, default `1.0`. Implemented as a **per-slot temperature divisor**: `T[i] = T / σ[i]`.

Salience exists because equal-weight flipping is wrong. A filter cutoff flip is perceptually enormous; a delay mix flip is a detail. High salience pins a slot to the dominant corner even at high global temperature; low salience lets it wander freely.

Recommended authoring defaults:

| Slot class | σ |
|---|---|
| Primary timbre (cutoff, osc wave, unison, drive) | 2.5 – 3.5 |
| Pitch-affecting (octave, tune, ratio) | 3.0 – 4.0 |
| Envelope shape | 1.5 – 2.0 |
| Modulation depth / rate | 0.8 – 1.2 |
| FX mix, secondary level | 0.3 – 0.6 |

Salience must be exposed and editable. Auto-assignment is a starting point, not a policy.

### 3.3 Reproducibility

`argmax` ties must break deterministically (lowest `k` wins). Do not rely on floating-point ordering being stable across platforms for equal scores; compare with an explicit `>` and iterate `k` ascending.

---

## 4. Slot modes

Each slot carries a mode that overrides the global continuous/discrete policy. Resolution order, first match wins:

| Mode | Behaviour |
|---|---|
| `FROZEN` | Slot ignores the field entirely and holds a user-set value. |
| `PINNED(k)` | Slot always takes corner `k`'s value. |
| `QUANTUM` | Always uses the selection law, regardless of global policy. |
| `GRADUAL` | Always interpolates (§4.1), regardless of global policy. |
| `AUTO` | Follows global policy: discrete slots → quantum, continuous slots → whatever the global *Continuous mode* switch says. |

`AUTO` is the default. Discrete slots under `AUTO` are **always** quantum — there is no meaningful interpolation of "filter type," and half-selecting a waveform is not a thing. A discrete slot set to `GRADUAL` is a configuration error: reject it at the UI level rather than silently coercing.

The per-slot override is the mechanism by which a preset author says "I don't care what else scrambles — the pitch stays coherent." Expect it to be used heavily and make it one click from the parameter row, not buried in a submenu.

### 4.1 Gradual resolution

Interpolation happens in the parameter's **native warp domain**, not in raw units:

```
v = warp⁻¹( Σ_k w[k] · warp(value[k]) )
```

`warp` is `log` for frequency, time, and ratio parameters; identity for linear ones; the parameter's own display curve where one exists. Interpolating a 120 Hz → 11 kHz cutoff linearly produces a control that does nothing for the first two-thirds of its travel.

For quantized-but-ordered parameters (e.g. an octave switch, a rhythmic division), `GRADUAL` means *interpolate then snap to the nearest legal step*. This produces stepped motion, which is correct.

---

## 5. Coupling

Independent per-slot flipping destroys patch coherence — osc 2's detune from A with osc 2's level from D is silence. Coupling makes slots agree.

### 5.1 Formulation (normative)

Each **module** `m` carries its own frozen Gumbel vector `G[m][k]`.
Each **slot** carries a frozen uniform `u[i] ∈ [0,1]` in addition to its Gumbel vector.

```
noise[i][k] = ( u[i] < c )  ?  G[module(i)][k]  :  g[i][k]
```

where `c ∈ [0,1]` is the global coupling amount.

Properties this buys, all of which matter:

- **Marginals are exact.** Both `G` and `g` are valid Gumbel vectors, so every slot still selects `∝ w^(σ/T)` at every value of `c`. Blending the two vectors (as the prototype does) breaks this — the blended variate is not Gumbel and the census drifts away from the weights.
- **`c` is monotone.** Raising the knob only ever recruits more slots into module-lock; it never releases one. The transition is legible.
- **`c = 1` is exactly module-atomic.** Every slot in a module shares noise and weights, so shares an argmax, so flips as a unit.
- **Deterministic.** No re-draw needed when `c` moves.

Expected useful range is `c ∈ [0.25, 0.55]`. Below that, incoherence; above, it becomes vector morphing with extra steps. Verify against the prototype before fixing defaults.

### 5.2 Module membership

Default grouping is by signal-flow unit: `OSC1`, `OSC2`, `FILTER`, `AMP ENV`, `MOD ENV`, `LFO1`, `FX`. Membership must be user-editable — the interesting groupings are sometimes cross-cutting ("everything that affects brightness").

A slot may belong to exactly one module in v1. Multi-membership is a v2 concern and pulls the design toward §9.

### 5.3 Optional: coupling graph

An extension for instruments with strong internal dependencies. Replace the flat module vector with a weighted graph `J[i][j]` and select by iterated conditional modes over `score[i][k] + Σ_j J[i][j]·δ(a[j], k)`. This is an Ising model on the parameter graph and it converges in a handful of sweeps for realistic sizes.

**Not required for v1.** Flat modules cover most of the value. Specify it here so the data model leaves room: store coupling as a graph with the flat-module case expressed as fully-connected cliques, and the upgrade costs nothing later.

---

## 6. Commit and timing

### 6.1 Trigger policy

| Policy | Commit occurs |
|---|---|
| `IMMEDIATE` | As soon as the assignment changes |
| `NOTE_ON` | At the next note event |
| `BEAT` | At the next beat boundary |
| `BAR` | At the next bar boundary |

Between the assignment changing and the commit landing, the pending set is held and its size must be surfaced in the UI (`⟳ 7 flips queued`). Switching policy to `IMMEDIATE` flushes any pending set at once.

`NOTE_ON` is the policy that makes this musical rather than glitchy. Default to it wherever note events are available.

### 6.2 Smoothing

Any committed change to a continuous, currently-audible parameter ramps over **`glide` ms**, default `8`, range `0–60`, linear. Below ~3 ms you hear a click; above ~20 ms you hear a slur that reads as a fast portamento rather than a flip. Both are useful; neither is the default.

Discrete and structural parameters cannot ramp — see QM-2 §3 for their handling.

### 6.3 Ordering

Commits are atomic with respect to the audio thread. Do not allow a note to be triggered against a half-applied assignment: the new note's oscillator wave and its envelope must come from the same commit.

---

## 7. Reshuffle

**Full reshuffle** — new seed, redraw the entire noise table (all `g`, all `G`, all `u`), epoch += 1.

**Partial reshuffle** — redraw a fraction `d ∈ [0.05, 1.0]` of slots, chosen uniformly, plus module vectors with probability `d`. Epoch += 1.

**Auto-reshuffle** — partial reshuffle on a timer or musical division. Rate and depth are independent controls, and both are needed: depth is what distinguishes *drift* (10%, the patch erodes) from *teleport* (100%, it becomes a different sound every N bars).

Auto-reshuffle should optionally sync to the host clock. A reshuffle landing on the downbeat is a musical event; one landing at 3.7 seconds is noise.

---

## 8. Recall and state

### 8.1 What must be serialized

```
position          (x, y)
temperature       T
coupling          c
glide             ms
continuous policy quantum | gradual
timing policy     immediate | note_on | beat | bar
seed, epoch       (display and provenance only)
noise table       g[N][4], u[N], G[M][4]      ← authoritative
per-slot          mode, salience, module id
corner patches    4 × complete snapshots
```

### 8.2 Store the noise table, do not reconstruct it

It is tempting to store only `(seed, epoch)` and regenerate. Don't. Partial reshuffles depend on the *history* of depth values, so reconstruction requires replaying an event log, and any change to the PRNG or draw order silently breaks every saved preset in the field.

The table is `N × 5` floats. At 128 slots that is 2.5 KB. Store it.

Keep `seed` and `epoch` as displayed metadata so a user can talk about a state ("seed 40219, epoch 6"), and support entering a seed to regenerate a table from scratch. Just don't make recall depend on it.

### 8.3 Automation contract

`x`, `y`, `T`, `c`, and a reshuffle *trigger* are automatable host parameters. The individual slot values are **derived** and must not be independently automatable while morph is engaged — see QM-2 §6 for the conflict handling this implies.

---

## 9. Conditional layer (v2, non-normative)

Sketched here so the v1 data model doesn't preclude it.

A rule is `WHEN <predicate> THEN <action>`, evaluated after the selection law and before commit, in author order, with later rules overriding earlier ones.

Predicates worth supporting:

```
slot(id) == corner(k)
module(id) == corner(k)            # all slots in module agree
census(k) > 0.6
position in region(...)
epoch % n == 0
```

Actions:

```
force slot(id) -> corner(k)
force module(id) -> corner(k)
set salience(id) -> v
suppress flip(id)
```

Enough to express "if the filter goes to GRIT, the drive goes with it" and "never let both oscillators leave GLASS at once." A ruleset must remain a pure function of the assignment so §1 determinism survives. Reject rules with cyclic dependencies at author time rather than iterating to a fixed point at runtime.

This is a power-user surface. It should not be visible by default and should never be required to get a good result — if the flat coupling model needs rules to sound coherent, the flat model is wrong and should be fixed instead.

---

## 10. Acceptance tests

1. **Determinism.** Same state + same position ⇒ bit-identical assignment, across sessions and platforms.
2. **Census.** At `σ=1, T=1, c=0`, over ≥1000 slots, empirical corner frequencies match bilinear weights within 3% at a dozen sampled positions.
3. **Coupling invariance.** Sweeping `c` from 0 to 1 at fixed position leaves the census within sampling error. (This test fails on the blend formulation — it is the reason §5.1 exists.)
4. **Temperature limits.** `T = 0.02` produces the nearest corner for every slot at every position not exactly on a boundary.
5. **Coupling limit.** `c = 1` produces at most `M` distinct corner values across all slots, where `M` is the module count.
6. **Salience monotonicity.** Raising `σ[i]` never decreases `P(a[i] = argmax w)`.
7. **No clicks.** At `glide = 8 ms`, `IMMEDIATE` timing, dragging the field at full speed across a sustained note produces no sample discontinuity above −60 dBFS relative to program.
8. **Recall.** Save, quit, reload, and the sound is identical — including after 50 partial reshuffles at varying depth.
