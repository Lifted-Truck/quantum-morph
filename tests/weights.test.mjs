// QM-0 §2 — field geometry.

import test from 'node:test';
import assert from 'node:assert/strict';
import { cornerWeights, logWeights, ZERO_WEIGHT } from '../engine/index.mjs';

const GRID = [];
for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) GRID.push([i / 10, j / 10]);

test('weights sum to 1 across the field, for every supported corner count', () => {
  for (const n of [1, 2, 3, 4]) {
    for (const [x, y] of GRID) {
      const w = cornerWeights(x, y, n);
      const sum = w.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-12, `n=${n} at (${x},${y}) sum=${sum}`);
      assert.ok(
        w.every((v) => v >= 0),
        `n=${n} at (${x},${y}) has a negative weight`,
      );
    }
  }
});

test('4-corner weights are bilinear in A,B,C,D order', () => {
  const w = cornerWeights(0.25, 0.75, 4);
  assert.ok(Math.abs(w[0] - 0.75 * 0.25) < 1e-12); // A = (1−x)(1−y)
  assert.ok(Math.abs(w[1] - 0.25 * 0.25) < 1e-12); // B = x(1−y)
  assert.ok(Math.abs(w[2] - 0.75 * 0.75) < 1e-12); // C = (1−x)y
  assert.ok(Math.abs(w[3] - 0.25 * 0.75) < 1e-12); // D = xy
});

test('each corner owns its own corner of the field', () => {
  const corners = [
    [0, 0, 0],
    [1, 0, 1],
    [0, 1, 2],
    [1, 1, 3],
  ];
  for (const [x, y, k] of corners) {
    const w = cornerWeights(x, y, 4);
    assert.equal(w[k], 1, `corner ${k} should own (${x},${y})`);
  }
});

test('2 corners collapse the field to the x axis — y is inert', () => {
  for (const y of [0, 0.3, 1]) {
    const w = cornerWeights(0.3, y, 2);
    assert.ok(Math.abs(w[0] - 0.7) < 1e-12);
    assert.ok(Math.abs(w[1] - 0.3) < 1e-12);
  }
});

test('3 corners: vertices are exact, and outside points clamp to the triangle', () => {
  // Vertices of the inscribed triangle (engine convention, weights.mjs TRI).
  const vertices = [
    [0, 0, 0],
    [1, 0, 1],
    [0.5, 1, 2],
  ];
  for (const [x, y, k] of vertices) {
    const w = cornerWeights(x, y, 3);
    assert.ok(Math.abs(w[k] - 1) < 1e-12, `vertex ${k} weight ${w[k]}`);
  }
  // The top-left field corner is outside the triangle; clamping must still give
  // a valid distribution rather than a negative coordinate.
  const w = cornerWeights(0, 1, 3);
  assert.ok(w.every((v) => v >= 0));
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});

test('corner counts above 4 are rejected rather than mis-weighted (QM-0 §2, v1 scope)', () => {
  assert.throws(() => cornerWeights(0.5, 0.5, 5), RangeError);
});

test('a corner at or below the zero-weight threshold gets log −Infinity', () => {
  const lw = logWeights(Float64Array.from([1 - ZERO_WEIGHT, ZERO_WEIGHT, 0, 1e-12]));
  assert.ok(Number.isFinite(lw[0]));
  assert.equal(lw[1], -Infinity);
  assert.equal(lw[2], -Infinity);
  assert.equal(lw[3], -Infinity);
});
