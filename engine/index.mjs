// QM-0 core engine — public surface.
//
// Everything here is a pure function of its arguments plus a frozen noise table
// (QM-0 §1). No wall-clock reads, no Math.random, no Node-only APIs: this file
// and its imports load unchanged under Node (tests) and Max's `v8` object.

export { makeRng, gumbel } from './rng.mjs';
export { cornerWeights, logWeights, ZERO_WEIGHT } from './weights.mjs';
export {
  createNoiseTable,
  cloneNoiseTable,
  reshuffleFull,
  reshufflePartial,
  serializeNoiseTable,
  deserializeNoiseTable,
} from './noise.mjs';
export {
  MODE,
  CONTINUOUS_POLICY,
  SLOT_GRADUAL,
  SLOT_FROZEN,
  validateSlots,
  selectAssignment,
  census,
} from './select.mjs';
export { WARP, resolveGradual, validateGradual } from './warp.mjs';

/** QM-1 §2: the v1 slot ceiling is a named constant, not a structural assumption. */
export const MAX_SLOTS = 64;

/** QM-0 §3.1 / §5.1 control ranges, exported so UI and tests share one source. */
export const RANGES = Object.freeze({
  temperature: { min: 0.02, max: 4.0, default: 1.0 },
  salience: { min: 0.1, max: 4.0, default: 1.0 },
  coupling: { min: 0, max: 1, default: 0.4 }, // §5.1 useful range is [0.25, 0.55]
  glide: { min: 0, max: 60, default: 8 }, // §6.2, ms
  reshuffleDepth: { min: 0.05, max: 1.0 },
});
