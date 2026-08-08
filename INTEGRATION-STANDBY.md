# INTEGRATION-STANDBY — quantum-morph

Standby artifact for the shared infrastructure library ("plugin-skeleton"),
per DECISIONS **D-006**. Passive: nothing here is a request, a design, or a
commitment. It is the first brief when the mediator calls.

**Kept cheap on purpose** — bullets, no polish. Update in passing during work
already underway; do not open a session to groom it.

**Status honesty.** `engine/` is built and green (41 tests, pinned goldens).
`device/` does not exist. So friction below is tagged **[hit]** (encountered in
built code) or **[anticipated]** (entailed by a normative spec, not yet met).
Do not let an anticipated item be read as field evidence.

_Last touched: 2026-08-05 · engine at ROADMAP P1, Q-002 done, Q-003 open._

---

## (a) Friction list — infrastructure problems

### Parameter identity & addressing
- **[anticipated]** M4L slots are addressed by **Live API path** (QM-1 §2
  `path`). Paths are position-dependent in the device chain: move a device,
  reorder the rack, or swap a preset and the mapping silently retargets or
  dies. There is no stable identity to hang a morph slot on.
- **[hit]** The engine sidesteps this by indexing slots **positionally**
  (`a[i]` ↔ `slots[i]`, `engine/select.mjs`). That is correct for a pure
  function but pushes the whole identity problem onto the host layer — and the
  noise table is indexed the same way, so *any* reindexing of slots silently
  remaps frozen noise and changes the sound. Reordering a slot list is a
  breaking operation today with nothing to catch it.
- **[anticipated]** QM-2 §2 demands ids "stable across versions, never
  reused" — a requirement the M4L addressing model cannot satisfy on its own.
  This is the sharpest single gap between the two hosts.

### Parameter metadata
- **[anticipated]** QM-1 §2.1 gets `is_quantized` / `value_items` free from the
  host; QM-2 §2 says a native instrument must hand-author the equivalent
  manifest. Two hosts, two metadata sources, no shared schema.
- **[hit]** The engine needs `discrete`, `salience`, `module`, and (for gradual
  slots) `warp` + legal-step grid. It currently takes them as plain object
  fields with no schema and no provenance — `validateSlots()` checks ranges,
  nothing checks that the metadata is *true of the parameter*.
- **[anticipated]** `morph_class` (SAFE / VOICE_BOUND / STRUCTURAL / FORBIDDEN,
  QM-2 §3) — the spec states plainly that this field "does not exist in any
  current instrument and is the real work of integration." No infrastructure
  anywhere expresses which parameters are safe to change at runtime.

### Scope & voices
- **[hit]** Assignment is **device-global**: one flat `Int32Array` for the whole
  slot list. Nothing in `engine/` is per-voice or per-module-instance, and
  nothing assumes it *couldn't* be — the arrays are indexed, not singleton'd.
- **[anticipated]** `VOICE_BOUND` (QM-2 §3) implies parameters that cannot
  change while a voice sounds. The engine has no concept of voice lifetime, so
  the host layer must own that gate entirely.

### Presets & state
- **[anticipated]** A corner patch is a **complete parameter snapshot** ×4
  (QM-0 §8.1). Capturing, storing, diffing, and restoring scoped snapshots is
  hand-rolled per host today.
- **[hit]** The noise table is **authoritative state, not reconstructible**
  (QM-0 §8.2 — deliberately: partial reshuffles depend on history, and any PRNG
  or draw-order change would break every saved preset in the field). It
  serializes to plain arrays (`serializeNoiseTable`) and carries its own
  generator state. Any preset system must store opaque binary-ish blobs
  verbatim and never "helpfully" regenerate them.
- **[hit]** Related trap already recorded globally: large binary blobs in a
  plugin state chunk can make a host silently fail to save. The table is small
  (N×5 floats, ~2.5 KB at 128 slots) so it is fine — but a preset system that
  inlines corner snapshots + tables for many presets should watch the ceiling.

### Event pipeline / write budget
- **[anticipated]** QM-1 §5 defines an LOM write budget. **Evidenced as a real
  constraint, not hypothetical** (LIBRARY L0002): J74 Morph ships a user-facing
  *Sample Interval* throttle precisely because continuous morphing saturates
  the Live API. Coalescing, rate-limiting, and back-pressure are infrastructure.
- **[anticipated]** Commits must be **atomic w.r.t. the audio thread** (QM-0
  §6.3): a note must never trigger against a half-applied assignment — the new
  note's oscillator wave and its envelope must come from the same commit. That
  is a transactional-apply requirement on the event pipeline, not a nicety.
- **[anticipated]** Commit triggers are IMMEDIATE / NOTE_ON / BEAT / BAR (QM-0
  §6.1) with a held pending set whose size is surfaced in the UI. Needs host
  transport + note events plumbed to the same scheduler. (This is ROADMAP
  Q-003, open.)
- **[anticipated]** Per-parameter smoothing: continuous params ramp over
  `glide` ms; discrete and structural ones cannot ramp at all (QM-0 §6.2).
  Smoothing policy is per-parameter metadata, not a global setting.

### Ownership / automation arbitration
- **[anticipated]** QM-0 §8.3: `x`, `y`, `T`, `c` and a reshuffle trigger are
  automatable; individual slot values are **derived** and must not be
  independently automatable while morph is engaged. Nothing in a host
  parameter system expresses "this parameter currently has another owner."
  QM-2 §6 is where the conflict handling is specified.

### Interpolation domain
- **[hit]** Gradual resolution must happen in the parameter's **native warp
  domain** (QM-0 §4.1) — linear interpolation of a 120 Hz → 11 kHz cutoff is
  useless for two-thirds of its travel. Warp is per-parameter metadata that
  hosts expose inconsistently (Live gives display curves, not warps).

---

## (b) Inventory — components another project might want

All of `engine/` is dependency-free ES modules, pure, no host coupling, no
Node-only APIs. Sizes are small; each is independently liftable.

| Component | What it is | Generality |
|---|---|---|
| `engine/rng.mjs` | Seeded Mulberry32; whole state is one uint32 so it serializes exactly; uniforms in the **open** (0,1) | High — any project needing reproducible, serializable randomness |
| `engine/noise.mjs` | Frozen noise table + full/partial reshuffle + exact round-trip serialization, generator state travelling with the table | High — the general pattern of "randomness that is deterministic in position and survives recall" |
| `engine/weights.mjs` | 2D field → corner weights: bilinear (4), axis collapse (2), barycentric with true nearest-point edge projection (3) | High — any 2D morph/vector field, not morph-specific |
| `engine/warp.mjs` | Interpolate in warp domain (linear/log) then snap to legal step | High — parameter interpolation generally |
| `engine/select.mjs` | Gumbel-max categorical selection: temperature, per-slot salience, module coupling **mask**, deterministic tie-break, census | Medium — the distinctive part; useful anywhere discrete choice should be stochastic yet position-deterministic |
| `tests/golden-case.mjs` pattern | One frozen fixture shared by generator and test, so a changed *case* fails loudly instead of silently re-describing itself | Pattern, not code — cheap to copy |

Non-obvious properties worth preserving if anything is lifted:
- Corner count is **never** hardcoded to 4 (QM-0 §2 requires N-agnostic).
- Tie-breaking is lowest-index via strict `>` with ascending k — `>=` would make
  the winner iteration-order dependent, i.e. platform dependent.
- Coupling is a **mask** (pick one of two valid Gumbel vectors), never a blend.
  Blending breaks the marginal distribution; this is the single correction QM-0
  makes to the lab prototype, and the coupling-invariance test exists to catch a
  regression to it.

---

## (c) Architecture sketch — parameters + modulation, as built

**Slot model** (QM-1 §2 for the device; `engine/` consumes the subset it needs):

```
slot := { path|id, display_name, min, max, is_quantized, value_items[],
          module_id, mode, salience, warp, enabled }
```
Engine reads only: `mode`, `pin`, `discrete`, `salience`, `module`.
Ceiling is 64 slots — `MAX_SLOTS`, a named constant, not a structural limit.

**Addressing today:** positional index `i` into a flat slot array, shared by
`slots[i]`, `noise.g[i]`, `noise.u[i]`, and `a[i]`. Stable *within* a session
and a saved state; **not** stable across a slot-list reorder. No hierarchical
address exists yet. (This is the item most relevant to the standby's "prefer
stable, hierarchical parameter addresses" — currently unmet, recorded rather
than fixed, since fixing it speculatively is exactly what standby forbids.)

**Grouping:** flat modules, one module per slot, `module_id` user-editable
(QM-0 §5.2). Documented upgrade path is a weighted coupling **graph** with
flat modules expressed as fully-connected cliques (§5.3) — the data model is
meant to leave room for it. Multi-membership is explicitly v2.

**"Modulation" — be precise, because the word does not mean here what it means
in a mod-routing system.** There is no mod matrix, no sources, no depths. There
is exactly one control input and one derivation:

```
(x, y) ──> bilinear weights w[k]
                  │
                  ├── quantum slots:  argmax_k( σ[i]·log w[k] / T + noise[i][k] )
                  │                    noise = coupled ? G[module(i)] : g[i]
                  │                                     (u[i] < c decides)
                  │                                          │
                  │                                          └─> a[i] = corner index
                  │
                  └── gradual slots:  warp⁻¹( Σ_k w[k]·warp(value[k]) ) [→ snap]

a[i] ──> (commit policy: IMMEDIATE | NOTE_ON | BEAT | BAR)  ──> host parameter write
                                                    ↑ Q-003, not built
```

Everything left of the commit arrow is pure and built. Everything right of it
is unbuilt and is where all host coupling will live.

**State ownership:**
- Authoritative & serialized: noise table (`g`, `u`, `G`, `rngState`, `epoch`),
  4 corner snapshots, engine scalars (`x`, `y`, `T`, `c`, glide, policies),
  per-slot (mode, salience, module).
- Derived, never stored: `a[i]`, weights, resolved parameter values.
- `seed` + `epoch` are **display/provenance only** — recall must not depend on
  them (QM-0 §8.2).

**Boundaries as they stand:** `engine/` imports nothing but `engine/`. No GUI,
no host, no timing, no I/O, no wall clock. The device layer, when it exists,
will be the only thing that knows about Max, the LOM, or the transport.
