# QM-3 · FX Pool & Routing — Implementation Spec

**Status:** normative for the FX section of the host synth's quantum-morph integration.
**Prerequisite reading:** QM-0 (core engine — selection law, salience, coupling, commit timing, recall). QM-1/QM-2 are context, not required.
**Audience:** implementation agents. Where this document says MUST, deviation requires escalation to Julian, not judgment. §9 lists decisions that are explicitly *not* yours to make.

---

## 1. Construction summary (restated from the design thread)

Routing is not a free graph. It is a **fixed pool of persistent module instances** in a **fixed rank order**, wired by an **upper-triangular send matrix**: a module may send only to higher-ranked modules and to the master bus. Consequences, all load-bearing:

1. Every send cell is an ordinary morph slot — a gain with four corner values, flipped or crossfaded by the QM-0 engine like any parameter. There is no separate routing subsystem.
2. Any assignment of corner values to cells is a valid DAG terminating at master. **No cycle detection, no repair pass, no validity checker exists anywhere in this codebase.** If you find yourself writing one, the representation has been violated; stop and escalate.
3. A module whose entire send row resolves to < 0.01 total is **normalled to master** at unity (dashed in UI). Patch-cable-overrides-normal semantics.
4. An **inactive** module is a transparent pass-through: its input sum forwards to its sends unchanged. Bypass never mutes.
5. Instances persist across flips. Delay lines and reverb tails carry their state into new wirings. This is intended behavior.
6. Rerouting is therefore SAFE, not STRUCTURAL: a topology change is gain ramps over `routing_glide`. No allocation, no reset, ever, on the audio thread.

---

## 2. Pool and rank order

| Rank | ID | Module | Role |
|---|---|---|---|
| 0 | `SRC` | synth output | dry tap; has a send row like any module |
| 1 | `DRV1` | drive | pre-filter saturation; the "tone shaping" drive |
| 2 | `FLT1` | multimode filter | first carve |
| 3 | `FLT2` | multimode filter | second carve — same DSP as FLT1, different instance |
| 4 | `CHO` | modulation | chorus / flanger / phaser via `char` |
| 5 | `DLY` | delay | stereo / ping-pong via `char` |
| 6 | `VRB` | reverb | plate / hall / chamber via `char` |
| 7 | `DRV2` | drive | output-stage saturation + tilt; the "glue" drive |
| 8 | `MST` | master bus | receiver only |

**Rationale, so nobody "improves" it:**

- **Two pre-space filters is a multiband architecture,** not redundancy. `SRC→FLT1(LP)→MST` in parallel with `SRC→FLT2(HP)→CHO→VRB` is the split-band patch — lows dry and tight, highs into space — and it is a first-class citizen of this topology. Serial FLT1→FLT2 additionally gives dual-peak / band-carve shapes. Both filters MUST be identical DSP so corners can use them interchangeably.
- **DRV2 sits after the space modules** so driven ambience (crushed reverb tails, saturated delays) is expressible, and its `tilt` control is the deliberate surrogate for post-space filtering (see §5, ledger).
- **CHO < DLY < VRB** follows the common-case ordering: modulation into delay into reverb.

The rank order is frozen. Changing it invalidates every authored corner.

### 2.1 Matrix dimensions

Senders `SRC…DRV2` (8 rows) to all higher-ranked receivers plus `MST`: **36 cells.** Cell IDs are `route.{from}.{to}`, e.g. `route.flt2.cho`.

**Inert-cell rule:** a cell whose four corner values are identical (typically all-zero — unauthored) is excluded from the flip engine and the census. Expect most corners to author 4–8 cables; the census must reflect the cells that can actually move, or it reads as permanently frozen.

---

## 3. Module specifications

Common requirements for every module:

- `active` slot (bool). Inactive = pass-through per §1.4. Crossfade fx/bypass paths over `routing_glide`.
- `char` changes MUST be applied without audio-thread allocation — parallel structures crossfaded over `routing_glide`, or parameter morphs of one structure. Never rebuild.
- Unity loudness discipline: at neutral settings, each module is unity gain ±1 dB. Drive stages are internally gain-compensated (output trim tracks drive amount) so that hybrid-stacked drives change timbre, not level, to first order.
- All continuous params smoothed at audio layer; the engine writes setpoints and assumes you ramp (QM-2 checklist item).

Per-module parameter manifest. `warp` per QM-0 §4.1; `σ` is default salience; `timing` is the commit-class default (§6.3).

### DRV1 — pre-filter drive
| id | type | range / options | warp | σ | timing |
|---|---|---|---|---|---|
| `drv1.active` | bool | — | — | 2.5 | routing |
| `drv1.drive` | cont | 0–1 | lin | 1.5 | param |
| `drv1.char` | disc-unordered | soft, fold, asym | — | 2.0 | routing |
| `drv1.tone` | cont | 500 Hz – 12 kHz (post-shaper LP) | log | 1.0 | param |

### FLT1 / FLT2 — multimode state-variable filter (identical, two instances)
| id | type | range / options | warp | σ | timing |
|---|---|---|---|---|---|
| `fltN.active` | bool | — | — | 2.5 | routing |
| `fltN.cutoff` | cont | 40 Hz – 16 kHz | log | 2.5 | param |
| `fltN.res` | cont | Q 0.5 – 20 | log | 1.2 | param |
| `fltN.type` | disc-unordered | LP, BP, HP, NOTCH | — | 2.5 | routing |

### CHO — modulation
| id | type | range / options | warp | σ | timing |
|---|---|---|---|---|---|
| `cho.active` | bool | — | — | 2.5 | routing |
| `cho.char` | disc-unordered | chorus, flanger, phaser | — | 2.0 | routing |
| `cho.rate` | cont | 0.05 – 8 Hz | log | 1.0 | param |
| `cho.depth` | cont | 0–1 | lin | 0.8 | param |
| `cho.regen` | cont | 0 – 0.9 (flanger/phaser feedback; chorus maps it to stereo spread) | lin | 0.8 | param |

### DLY — delay
| id | type | range / options | warp | σ | timing |
|---|---|---|---|---|---|
| `dly.active` | bool | — | — | 2.5 | routing |
| `dly.char` | disc-unordered | stereo, pingpong | — | 2.0 | routing |
| `dly.sync` | disc-ordered | free, 1/16, 1/8, 3/16, 1/4, 3/8, 1/2 | step | 2.0 | routing |
| `dly.time` | cont | 30 – 900 ms (used when sync = free) | log | 1.0 | param |
| `dly.fb` | cont | 0 – 0.85 | lin | 1.0 | param |
| `dly.damp` | cont | 500 Hz – 12 kHz (in-loop LP) | log | 0.8 | param |

`dly.sync` is discrete-ordered: under GRADUAL it interpolates-then-snaps (QM-0 §4.1). Time changes slew the delay line (tape-style pitch bend, ~50 ms time constant) rather than crossfading buffers.

### VRB — reverb
| id | type | range / options | warp | σ | timing |
|---|---|---|---|---|---|
| `vrb.active` | bool | — | — | 2.5 | routing |
| `vrb.char` | disc-unordered | plate, hall, chamber | — | 2.0 | routing |
| `vrb.decay` | cont | 0.2 – 12 s | log | 1.0 | param |
| `vrb.damp` | cont | 800 Hz – 14 kHz | log | 0.8 | param |
| `vrb.predelay` | cont | 0 – 120 ms | lin | 0.8 | param |

Implementation freedom: FDN or parallel convolvers, provided `char`/`decay` changes meet the no-allocation rule. FDN recommended — decay becomes a coefficient, not a buffer swap.

### DRV2 — output drive
| id | type | range / options | warp | σ | timing |
|---|---|---|---|---|---|
| `drv2.active` | bool | — | — | 2.5 | routing |
| `drv2.drive` | cont | 0–1 | lin | 1.5 | param |
| `drv2.char` | disc-unordered | tape, clip, fold | — | 2.0 | routing |
| `drv2.tilt` | cont | −6 … +6 dB/oct, pivot 800 Hz | lin | 1.2 | param |

`drv2.tilt` doubles as the post-space tone control (§5). It exists partly to compensate the rank order; treat it as first-class, not decorative.

**Slot totals:** 36 routing + 30 module = 66, before the inert-cell rule prunes.

---

## 4. Master stage

`MST` sums all incoming sends → safety limiter (fast lookahead or hard-knee compressor, threshold ≈ −6 dBFS, ratio ≥ 10:1, ceiling −1 dBTP) → output. The limiter is **not** a creative device and MUST NOT be under morph control. Its purpose is to make the worst random hybrid survivable at performance volume; see acceptance test 6.

NaN/denormal guards at every feedback summing point (delay fb, chorus regen, filter state).

---

## 5. Topology ledger

Expressible and intended (author these as factory demonstration corners):

1. **Split-band:** `SRC→FLT1(LP 200)→MST` ∥ `SRC→FLT2(HP 400)→CHO→VRB→MST`.
2. **Serial crush:** `SRC→DRV1→FLT1→FLT2(NOTCH)→DRV2→MST`.
3. **Dub chain:** `SRC→FLT1(BP)→DLY(fb .7)→VRB→MST`, dry tap `SRC→MST` at 0.15.
4. **Driven wash:** `SRC→VRB`, `SRC→DLY→VRB`, `VRB→DRV2(tape)→MST`.
5. **Parallel space:** `SRC→CHO→MST` ∥ `SRC→VRB→MST` ∥ `SRC→MST`.

Inexpressible, known and accepted:

- **Reverb into delay** (rhythmic verb-throws). Cheapest future fix is a second delay instance ranked after VRB, not a rank swap. Do not implement; noted for v2.
- **True post-space filtering.** Surrogate coverage: `drv2.tilt` plus the in-loop `damp` controls. Accepted.
- **Filter between DLY and VRB.** Partially covered by `dly.damp`. Accepted.
- **Any feedback** (below-diagonal). Deferred entirely — §9.

If an authored corner during development genuinely cannot live in this ledger, that is escalation material, not license to add matrix cells below the diagonal.

---

## 6. Morph integration

### 6.1 Coupling groups
One group per pool row: a module's `active`, all params, **and its send row** share a group (`SRC`'s row is its own group). This is what makes "the module flips and its wiring flips with it" fall out of the QM-0 §5.1 mask with no rules.

### 6.2 Salience
As tabled in §3; routing cells default **σ = 2.2**. Rationale: routing and `char` flips are the dramatic events and should defect from the dominant corner late as temperature rises; depths and damps wander first.

### 6.3 Commit timing classes
Two classes, separately configurable, per the design thread:
- **param class** — continuous module params. Default: global timing policy, glide = `param_glide` (default 8 ms).
- **routing class** — all matrix cells, `active`, `char`, `sync`. Default: BEAT (fall back to IMMEDIATE when no transport, per QM-1 §5.4), glide = `routing_glide` (default 140 ms, range 10–800 ms).

Commits remain atomic per QM-0 §6.3: one commit event applies both classes' changes with their respective glides.

### 6.4 Manifest
Every slot above is emitted in the QM-2 §2 manifest format with stable ids as given. `morph_class = SAFE` for everything in this document (that is the point of the construction). No FORBIDDEN entries exist in the FX section except the master limiter, which is simply absent from the manifest.

---

## 7. Serialization

Corner data for the FX section = 8 send-row vectors + module param snapshots, per corner. Sparse storage for rows (absent cell = 0). Noise-table and engine state serialize per QM-0 §8 — owned by the engine, not this layer. `format_version` from day one.

---

## 8. Acceptance tests

1. **Validity by construction (property test).** 10,000 random assignments across random seeds, positions, T ∈ [0.05, 3], c ∈ [0, 1]: render 1 s of audio each; assert no NaN/inf, output reachable (non-silent given non-silent source and any normalling), and — by code inspection — that no repair/validation routine was invoked, because none exists.
2. **Normalling.** Author a corner set where a hybrid feeds DLY while its row zeroes; assert the master normal engages at unity and disengages when any explicit send exceeds 0.01.
3. **Split-band fidelity.** Author ledger patch 1; assert ≥ 30 dB band separation between the two paths at 100 Hz / 2 kHz probes.
4. **Census invariance under coupling.** Sweep c 0→1 at fixed position over the non-inert slot population; census within sampling error (QM-0 test 3).
5. **No clicks on reroute.** Full-speed field drag at `routing_glide` = 140 ms over a sustained pad: no discontinuity above −60 dBFS relative to program.
6. **Worst-hybrid loudness.** Across the 10k random hybrids of test 1, integrated loudness spread ≤ 6 LU and true peak never above −1 dBTP post-limiter. Report the spread; if > 6 LU, the fix is drive gain-compensation curves, not the limiter.
7. **Determinism & recall.** QM-0 tests 1 and 8 pass with the FX section included.
8. **Bypass transparency.** All modules inactive, all-dry routing: null test against source within −80 dBFS.

---

## 9. Not yours to decide (escalate to Julian)

1. **Feedback loop (L3).** A designed below-diagonal return (candidate: VRB/DLY → DRV1 through fixed delay + saturator + clamp) is sketched but not approved. Do not implement.
2. **Rank-order changes** of any kind, including "just swapping CHO and DLY."
3. **Adding or removing pool modules** or `char` options.
4. **Host-synth binding** — which synth this lands in, and whether the module interface adopts FOUNDATIONS conventions so the pool is reusable across instruments. Interface should be written cleanly enough that this decision stays cheap.
5. Anything QM-2 §10 lists as open (automation conflict, editing-under-GRADUAL, per-patch coupling overrides).

---

## 10. Suggested agent split

- **Agent A — DSP pool.** §2–§5, §8 tests 1–3, 5–6, 8. Deliverable: the pool as a standalone processor with a `setCell(id, gain, rampSec)` / `setParam(id, value, rampSec)` / `setActive(id, bool, rampSec)` API and the manifest emitter. No knowledge of the morph engine.
- **Agent B — engine binding.** §6–§7, §8 tests 4, 7. Consumes Agent A's manifest and API; owns assignment→commit, timing classes, serialization. No DSP.

The API boundary is the manifest plus those three calls. If the agents need more surface area than that to talk to each other, the boundary is being drawn wrong.
