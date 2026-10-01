import { between, pointInPolygon, type Point, type Polyline } from './geometry';

/** Below this the segment and the edge are treated as parallel. */
const PARALLEL_EPSILON = 1e-12;
/** Sub-segments shorter than this fraction of a segment are numeric noise. */
const SPLIT_EPSILON = 1e-7;

/** Parameters along a -> b where it crosses the polygon boundary, ascending. */
function crossings(a: Point, b: Point, polygon: Polyline): number[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const found: number[] = [];
  for (let index = 0; index < polygon.length - 1; index++) {
    const [px, py] = polygon[index]!;
    const [qx, qy] = polygon[index + 1]!;
    const ex = qx - px;
    const ey = qy - py;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < PARALLEL_EPSILON) continue;
    const ox = px - a[0];
    const oy = py - a[1];
    const t = (ox * ey - oy * ex) / denominator;
    const s = (ox * dy - oy * dx) / denominator;
    if (t > 0 && t < 1 && s >= 0 && s <= 1) found.push(t);
  }
  return found.sort((first, second) => first - second);
}

/**
 * Splits a polyline at the polygon boundary and keeps the pieces on one side.
 * `inside` bounds marks to a wing; `outside` removes what an overlapping wing hides.
 */
export function clip(line: Polyline, polygon: Polyline, keep: 'inside' | 'outside'): Polyline[] {
  const wanted = keep === 'inside';
  const pieces: Polyline[] = [];
  let current: Point[] = [];
  const flush = (): void => {
    if (current.length > 1) pieces.push(current);
    current = [];
  };
  for (let index = 0; index < line.length - 1; index++) {
    const a = line[index]!;
    const b = line[index + 1]!;
    const cuts = [0, ...crossings(a, b, polygon), 1];
    for (let cut = 0; cut < cuts.length - 1; cut++) {
      const from = cuts[cut]!;
      const to = cuts[cut + 1]!;
      if (to - from < SPLIT_EPSILON) continue;
      if (pointInPolygon(between(a, b, (from + to) / 2), polygon) !== wanted) {
        flush();
        continue;
      }
      if (current.length === 0) current.push(between(a, b, from));
      current.push(between(a, b, to));
    }
  }
  flush();
  return pieces;
}
