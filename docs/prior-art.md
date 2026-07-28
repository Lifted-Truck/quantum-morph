# Prior-art landscape — quantum-morph

**Swept:** 2026-07-24 · **Queue item:** ROADMAP Q-001 (P0) · **Method:** web
search + primary-source fetch of the one directly-relevant patent. English-
language web only. **This is not a freedom-to-operate opinion** — see §5.

---

## 1. Hardware vector synthesis (1986 → )

The four-corners-on-a-joystick geometry is ~40 years old and is the direct
ancestor of quantum-morph's field.

| Instrument | Year | What it morphs |
|---|---|---|
| Sequential Circuits Prophet VS | 1986 | Continuous crossfade of 4 oscillator sources via joystick; first vector synth |
| Yamaha SY22 / TG33 | 1990 | Same geometry, AWM+FM sources |
| Korg Wavestation | 1990 | Same geometry; each corner may itself be a wave *sequence* |

Chris Meyer's originating insight for the VS was that waveshapes could be
interpolated in **two** dimensions — a diamond with a different wave at each
corner ([Perfect Circuit](https://www.perfectcircuit.com/signal/prophet-vs-history)).

**The invariant across all three:** what moves is a **mix ratio**. The
discrete structure (which wave is loaded into corner A, the filter type, the
routing) is fixed per corner and is *not* itself under the joystick. Vector
synthesis morphs levels, not architecture. Software recreations (Arturia
Prophet-VS V) inherit this property unchanged.

## 2. Software / M4L patch morphing (current art)

The Max for Live ecosystem has mature morph devices, all continuous:

- **J74 Morph** (Fabrizio Poce) — `PresetMorph` morphs across four device
  presets in real time; `TrackMorph` does the same for whole-track snapshots.
  Its documented failure mode is instructive: morphing "keeps on sending lots
  of parameter values in a matter of milliseconds", and the mitigation is a
  user-set *Sample Interval* to throttle the write rate
  ([FAQ](http://www.fabriziopoce.com/morph_FAQ.html)). QM-1 §5's LOM write
  budget is addressing a known, real constraint — not a hypothetical one.
- **ParaMorpher** (GlintEye) and **Parameter Morpher** (midrun) — save presets,
  morph between them; the latter is a one-knob two-preset morph.

**Adjacent but different: the randomizers.** `par-randomizer`,
`Parameter Randomizer`, `Device Randomizer`, `Random Note Parameter` all apply
stochastic values to device parameters. These are stochastic but **not
morphs**: no field, no corner patches, no positional determinism — a dice roll
on demand, which is precisely the "random patch generator" QM-0 §1 defines
itself against.

Nothing found combines the two: no surveyed device makes *position on a field*
select *whole corner values per parameter* deterministically.

## 3. Academic preset interpolation

This literature is the closest conceptual neighbour, and it independently
confirms the premise QM-2 §1 is built on — that **discrete parameters are the
hard part**.

- Sound morphing by audio descriptors + parameter interpolation, DAFx-16
  ([PDF](https://www.dafx.de/paper-archive/2016/dafxpapers/21-DAFx-16_paper_46-PN.pdf)).
- Esling et al., **SPINVAE** — audio VAE with normalizing flows mapping a
  latent space to synth parameters
  ([project](https://gwendal-lv.github.io/preset-gen-vae/)).
- Le Vaillant & Dutoit, *Improving Synthesizer Programming from VAE Latent
  Space* (DAFx-20/21) and *Latent Space Interpolation of Synthesizer
  Parameters using Timbre-Regularized Auto-Encoders* (TASLP 2024,
  [PDF](https://orbi.umons.ac.be/bitstream/20.500.12907/49507/1/taslp24_accepted.pdf)).
  Explicitly treats presets as **heterogeneous** — numerical *and categorical*
  random variables — because "networks are not adapted to categorical
  parameters such as algorithm or waveform type."

**How it differs from us:** these are *learned* interpolations — a model
decides, the mapping is opaque, reproducibility depends on trained weights,
and the output is research tooling rather than a playable instrument. QM-0 is
the opposite commitment: a closed-form selection law, no model in the path,
the same field position always yielding the same assignment (charter §Domain,
doctrine's AI/deterministic boundary).

## 4. The selection law itself

The **Gumbel-max trick** — perturb log-probabilities with i.i.d. Gumbel noise,
take the argmax, recover an exact categorical sample — is standard, well-
reviewed ML machinery ([Huijben et al., arXiv:2110.01515](https://arxiv.org/abs/2110.01515)),
along with its Gumbel-Softmax temperature relaxation. QM-0 §3 uses it
textbook-straight; the temperature `T` and salience `σ` exponent are its
standard knobs.

**Nothing found applies it to preset morphing.** The technique is old and
public (so unpatentable as such, and safely prior art in its own right); if
novelty exists here it is in the *application* — freezing the noise table so
the sample becomes a pure function of field position, which converts a sampler
into an instrument.

## 5. Patent-shaped risks

**Directly relevant — [US10770048B2](https://patents.google.com/patent/US10770048),
"Analog Synthesizer Patch Morphing and Simultaneous Parameter Control Through
Input Devices"** (Lafayette College; priority 2017-05-12, filed 2018-05-14,
granted 2020-09-08, **active**, expiry ~2038). Claim 1 covers a sound-generating
analog synthesizer whose controller interpolates *potentiometer, switch
position, and patch connection* between at least two predetermined settings —
i.e. it does claim discrete-element morphing, which is our territory.

Two distinctions, both apparent from the claim text:
1. **Mechanism.** Its switch/patch interpolation is **proportional crossfade** —
   a connection "set to be any proportion of fully-on and fully-off", VCA gain
   between 0% and 100%. QM-0's treatment is the categorical opposite: a slot is
   assigned *whole* to exactly one corner; nothing is ever partially on.
2. **Apparatus.** The claims are directed at an analog synthesizer with
   physical pots, switches, and patch connections (integral or retrofitted).
   quantum-morph is software writing host parameters over the Live API.

Assessment: **flag, not blocker.** Record it, revisit at the P3 pre-ship
re-scan, and get a professional opinion before any commercial release — the
above is claim-reading by an engineer, not counsel.

**Historical / expired:** US4352311 (synthesizer preset editing, 1982) —
recall/edit/restore of preset parameter groups. Long expired; useful only as
evidence that preset-group recall is deep prior art.

**Naming risk (non-patent).** [Waldorf Quantum](https://waldorfmusic.com/quantum-en/)
is a flagship hardware synthesizer (2018-, MK2 2024) in the identical goods
class. No dispute found involving the word for plugins, but "QUANTUM MORPH"
as a shipped product name warrants a trademark check at P3. Working title only
for now (QM-1 §1).

## 6. What quantum-morph does that the surveyed art does not

Every morph tool surveyed answers the question "what value sits between corner
A and corner B?" with a **blend**, and therefore has to either exclude discrete
parameters, snap them at a threshold, or crossfade two rendered voices.
quantum-morph refuses the question: it never asks what lies between two values,
it asks **which corner owns this parameter right now** — and answers with a
frozen Gumbel-max draw whose selection probability is the bilinear field
weight. The result is a morph that is *stochastic in the census yet
deterministic in position*: at 70% toward corner B roughly 70% of slots read
from B, chosen coherently rather than averaged, and the same point on the field
always resolves the same way, so the field is playable and recallable. That
combination — vector synthesis' geometry, the randomizers' willingness to
switch discrete structure, and the determinism neither of them has — is what no
surveyed device, plugin, or paper does.

---

## 7. Honest gaps in this sweep

- No formal patent-family or FTO search (no Espacenet/Google Patents CPC sweep
  of e.g. G10H by claim); one patent read, found by keyword.
- Device sweep is maxforlive.com search results, not an exhaustive crawl; the
  KVR/Gearspace/GitHub long tail is unexamined.
- DAFx / ICMC / SMC proceedings were sampled via search, not read in full.
- English-language sources only.

These are the gaps the **P3 pre-ship prior-art & IP re-scan** must close
(kit Decision 30). Nothing here justifies a design change; it justifies
recording the assumptions and re-checking before publication.
