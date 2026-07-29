// QM-0 §4.1 — gradual resolution in the parameter's native warp domain.

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGradual, validateGradual, cornerWeights, WARP } from '../engine/index.mjs';

test('linear warp is a plain weighted mean', () => {
  const w = cornerWeights(0.5, 0.5, 4);
  assert.ok(Math.abs(resolveGradual([0, 10, 20, 30], w, { warp: WARP.LINEAR }) - 15) < 1e-12);
});

test('log warp interpolates geometrically — the midpoint of 120 Hz and 11 kHz is ~1.15 kHz', () => {
  const w = cornerWeights(0.5, 0, 2);
  const v = resolveGradual([120, 11000], w, { warp: WARP.LOG });
  assert.ok(Math.abs(v - Math.sqrt(120 * 11000)) < 1e-9);
  // The failure this exists to prevent: a linear midpoint sits at 5.5 kHz, which
  // puts two-thirds of the control's travel above the useful range.
  assert.ok(v < 2000);
});

test('warping is exact at the corners themselves', () => {
  for (const [x, y, expected] of [
    [0, 0, 100],
    [1, 0, 200],
    [0, 1, 400],
    [1, 1, 800],
  ]) {
    const w = cornerWeights(x, y, 4);
    assert.ok(Math.abs(resolveGradual([100, 200, 400, 800], w, { warp: WARP.LOG }) - expected) < 1e-9);
  }
});

test('quantized-but-ordered parameters interpolate then snap to the nearest legal step', () => {
  const w = cornerWeights(0.3, 0, 2); // 0.7·(−2) + 0.3·(+2) = −0.8 → snaps to −1
  const v = resolveGradual([-2, 2], w, { warp: WARP.LINEAR, snap: { min: -2, step: 1 } });
  assert.equal(v, -1);
});

test('snapping lands on the grid across the whole sweep', () => {
  for (let i = 0; i <= 20; i++) {
    const w = cornerWeights(i / 20, 0, 2);
    const v = resolveGradual([0, 4], w, { warp: WARP.LINEAR, snap: { min: 0, step: 0.5 } });
    assert.ok(Math.abs(v / 0.5 - Math.round(v / 0.5)) < 1e-9, `off-grid value ${v}`);
  }
});

test('log warp on a non-positive range is a validation error, not a silent NaN', () => {
  assert.deepEqual(validateGradual([100, 200], WARP.LOG), []);
  assert.equal(validateGradual([0, 200], WARP.LOG)[0].code, 'LOG_WARP_NONPOSITIVE');
  // The audio path must still return a finite number rather than throw mid-morph.
  const w = cornerWeights(0.5, 0, 2);
  assert.ok(Number.isFinite(resolveGradual([0, 200], w, { warp: WARP.LOG })));
});
