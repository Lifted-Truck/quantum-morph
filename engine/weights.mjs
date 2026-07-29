// Field geometry — QM-0 §2. Position (x,y) ∈ [0,1]² → corner weights summing to 1.
//
// Corner count is a parameter everywhere, never a literal 4: QM-0 §2 states the
// selection law is already N-agnostic and forbids hardcoding 4.

/** A corner at or below this weight can never win a slot (QM-0 §3). */
export const ZERO_WEIGHT = 1e-9;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Three-corner layout: an isoceles triangle inscribed in the unit square, base
 * along y=0 and apex at top-centre.
 *
 * QM-0 §2 says "barycentric over a triangle inscribed in the field" without
 * fixing WHICH triangle — this is the engine's stated convention, not a spec
 * quotation. Flagged as an open question in ROADMAP Q-002; changing it changes
 * every 3-corner golden, so it is pinned here rather than left implicit.
 */
const TRI = [
  [0, 0],
  [1, 0],
  [0.5, 1],
];

/** Closest point to (px,py) on segment (ax,ay)–(bx,by). */
function closestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return [ax, ay];
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp01(t);
  return [ax + t * dx, ay + t * dy];
}

function barycentric(px, py) {
  const [[x0, y0], [x1, y1], [x2, y2]] = TRI;
  const det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  const l0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / det;
  const l1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / det;
  return [l0, l1, 1 - l0 - l1];
}

function triangleWeights(x, y) {
  let l = barycentric(x, y);
  if (l[0] >= 0 && l[1] >= 0 && l[2] >= 0) return l;

  // Outside the triangle: clamp to the nearest edge (QM-0 §2), i.e. project onto
  // the boundary and re-derive. Projecting THEN re-deriving (rather than clamping
  // the barycentric coordinates and renormalising) is what makes the result the
  // true nearest point — coordinate clamping is not a projection.
  let best = null;
  let bestD2 = Infinity;
  for (let e = 0; e < 3; e++) {
    const [ax, ay] = TRI[e];
    const [bx, by] = TRI[(e + 1) % 3];
    const [cx, cy] = closestOnSegment(x, y, ax, ay, bx, by);
    const d2 = (cx - x) ** 2 + (cy - y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = [cx, cy];
    }
  }
  l = barycentric(best[0], best[1]);
  // Numerical dust from the projection can leave a coordinate at -1e-17.
  return l.map((v) => (v < 0 ? 0 : v));
}

/**
 * Corner weights for a position. Returns a Float64Array of length cornerCount
 * summing to 1.
 *
 * cornerCount 2 collapses the field to the x axis (y inert); 3 is barycentric
 * over TRI; 4 is bilinear in corner order A,B,C,D. Counts above 4 are out of
 * scope for v1 (QM-0 §2) and throw rather than silently mis-weighting.
 */
export function cornerWeights(x, y, cornerCount = 4) {
  const px = clamp01(x);
  const py = clamp01(y);
  const w = new Float64Array(cornerCount);

  switch (cornerCount) {
    case 1:
      w[0] = 1;
      return w;
    case 2:
      w[0] = 1 - px;
      w[1] = px;
      return w;
    case 3: {
      const l = triangleWeights(px, py);
      const sum = l[0] + l[1] + l[2];
      for (let k = 0; k < 3; k++) w[k] = l[k] / sum;
      return w;
    }
    case 4:
      w[0] = (1 - px) * (1 - py); // A
      w[1] = px * (1 - py); // B
      w[2] = (1 - px) * py; // C
      w[3] = px * py; // D
      return w;
    default:
      throw new RangeError(
        `cornerWeights: ${cornerCount} corners is out of scope for v1 (QM-0 §2 supports 2–4)`,
      );
  }
}

/**
 * log(w) with the zero-weight rule applied: w ≤ 1e−9 ⟹ −Infinity, so that corner
 * can never win regardless of how favourable its noise draw was (QM-0 §3).
 */
export function logWeights(w) {
  const lw = new Float64Array(w.length);
  for (let k = 0; k < w.length; k++) {
    lw[k] = w[k] <= ZERO_WEIGHT ? -Infinity : Math.log(w[k]);
  }
  return lw;
}
