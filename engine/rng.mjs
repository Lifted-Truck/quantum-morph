// Seeded PRNG. QM-0 §1: the engine contains no free-running randomness — every
// random value it ever uses comes from here, from a seed the caller supplied.
//
// Mulberry32: 32-bit state, integer ops only. Chosen over Math.random (unseedable)
// and over any float-accumulator generator because the whole state is one uint32,
// so it serializes exactly and replays identically under Node and Max's v8.
// `Math.imul` and `>>> 0` are load-bearing: without them V8 promotes intermediates
// to doubles past 2^53 and the stream silently diverges from a 32-bit reference.

/** Advance state, return the next uint32. */
function next(state) {
  let t = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { state: t, value: (r ^ (r >>> 14)) >>> 0 };
}

/**
 * A seeded uniform stream.
 *
 * `state` is exposed so a noise table can carry its generator across partial
 * reshuffles (QM-0 §7) and still serialize to a plain number — recall must not
 * depend on replaying an event log (§8.2).
 */
export function makeRng(seed) {
  let state = seed >>> 0;
  return {
    get state() { return state; },
    set state(s) { state = s >>> 0; },

    /** Uniform in the OPEN interval (0,1). Open matters: gumbel() takes log(log(u)),
     *  so a 0 or a 1 would produce ±Infinity and poison the noise table. */
    uniform() {
      const n = next(state);
      state = n.state;
      return (n.value + 0.5) / 4294967296;
    },

    /** Uniform integer in [0, bound). Rejection-free modulo bias is acceptable here:
     *  it is used only to pick which slots a partial reshuffle touches. */
    below(bound) {
      const n = next(state);
      state = n.state;
      return n.value % bound;
    },
  };
}

/** Gumbel variate: g = −ln(−ln(u)), u ~ U(0,1). QM-0 §3. */
export function gumbel(rng) {
  return -Math.log(-Math.log(rng.uniform()));
}
