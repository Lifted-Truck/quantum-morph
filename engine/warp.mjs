// Gradual resolution — QM-0 §4.1. Interpolation happens in the parameter's
// native warp domain, never in raw units: a 120 Hz → 11 kHz cutoff interpolated
// linearly does nothing for the first two-thirds of its travel.

export const WARP = Object.freeze({ LINEAR: 'linear', LOG: 'log' });

// log warp is only meaningful on a strictly positive range. A corner value of 0
// in a log-warped slot is a configuration error, but the audio path must not
// throw mid-morph, so it clamps to a value far below any audible frequency or
// time and carries on. validateGradual() is how a device catches it at edit time.
const LOG_FLOOR = 1e-9;

export function validateGradual(cornerValues, warp) {
  if (warp !== WARP.LOG) return [];
  const bad = cornerValues.some((v) => !(v > 0));
  return bad ? [{ code: 'LOG_WARP_NONPOSITIVE', message: 'log warp requires strictly positive corner values (QM-0 §4.1)' }] : [];
}

/**
 * v = warp⁻¹( Σ_k w[k] · warp(value[k]) )  — QM-0 §4.1.
 *
 * `snap` handles the quantized-but-ordered case (an octave switch, a rhythmic
 * division): interpolate first, then snap to the nearest legal step. The result
 * is stepped motion, which §4.1 states is correct — snapping before
 * interpolating would instead quantise the weights and stall the control.
 *
 * @param {number[]|Float64Array} cornerValues one value per corner
 * @param {Float64Array} weights              from cornerWeights()
 * @param {object} [opts]
 * @param {string} [opts.warp]  'linear' | 'log'
 * @param {{min:number, step:number}} [opts.snap] legal-step grid, or omit for continuous
 */
export function resolveGradual(cornerValues, weights, { warp = WARP.LINEAR, snap = null } = {}) {
  const useLog = warp === WARP.LOG;
  let acc = 0;
  for (let k = 0; k < weights.length; k++) {
    const raw = cornerValues[k];
    acc += weights[k] * (useLog ? Math.log(raw > 0 ? raw : LOG_FLOOR) : raw);
  }
  const v = useLog ? Math.exp(acc) : acc;
  if (!snap) return v;
  return snap.min + Math.round((v - snap.min) / snap.step) * snap.step;
}
