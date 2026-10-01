import { atIndex, between, clamp, quadratic, SEGMENT_SAMPLES, type Point, type Polyline } from '../core/geometry';

/** Ribs span the margin from leading (u = 0) to trailing (u = 1). */
const RIB_COUNT = 15;
/** Samples per rib; also the resolution of v between base and margin. */
const RIB_SAMPLES = 25;
/** Ribs stop short of the outline so marks never sit on the ink edge. */
const MARGIN_INSET = 0.975;
/** Wing outlines close with one cubic segment along the thorax, which carries no veins. */
const BASE_SEGMENT_POINTS = SEGMENT_SAMPLES + 2;
/** Skip the first points so the leading corner does not collapse the fan. */
const MARGIN_START_INDEX = 2;
/** Finite-difference step for the local metric. */
const METRIC_STEP = 0.01;

/**
 * Wing-local coordinates. `u` runs across the margin, `v` from the wing base (0)
 * to just inside the margin (1). Marks expressed in (u, v) follow the wing
 * surface, so a band stays parallel to the edge whatever the silhouette does.
 */
export interface WingField {
  at(u: number, v: number): Point;
  /** SVG units per unit of u and of v at (u, v); converts mark sizes to (u, v). */
  metric(u: number, v: number): readonly [number, number];
}

/** Outline index range that carries veins and fringe; excludes the thorax edge. */
export function marginRange(outline: Polyline): readonly [number, number] {
  return [MARGIN_START_INDEX, outline.length - 1 - BASE_SEGMENT_POINTS];
}

export function wingField(outline: Polyline, base: Point, bow: number): WingField {
  const [first, last] = marginRange(outline);
  const ribs: Polyline[] = Array.from({ length: RIB_COUNT }, (_, index) => {
    const fraction = index / (RIB_COUNT - 1);
    const margin = atIndex(outline, first + (last - first) * fraction);
    const target = between(base, margin, MARGIN_INSET);
    const middle = between(base, target, 0.5);
    // Bow peaks mid-fan so neighbouring ribs stay roughly parallel near the edges.
    const lift = Math.sin(fraction * Math.PI) * bow;
    const control: Point = [
      middle[0] - (target[1] - base[1]) * lift,
      middle[1] + (target[0] - base[0]) * lift,
    ];
    return quadratic(base, control, target, RIB_SAMPLES - 1);
  });
  const at = (u: number, v: number): Point => {
    const across = clamp(u, 0, 1) * (RIB_COUNT - 1);
    const column = Math.min(Math.floor(across), RIB_COUNT - 2);
    const along = clamp(v, 0, 1) * (RIB_SAMPLES - 1);
    const row = Math.min(Math.floor(along), RIB_SAMPLES - 2);
    const near = ribs[column]!;
    const far = ribs[column + 1]!;
    return between(
      between(near[row]!, near[row + 1]!, along - row),
      between(far[row]!, far[row + 1]!, along - row),
      across - column,
    );
  };
  return {
    at,
    metric(u, v) {
      // Step inward near the clamped edges so the difference never degenerates.
      const du = u > 0.5 ? -METRIC_STEP : METRIC_STEP;
      const dv = v > 0.5 ? -METRIC_STEP : METRIC_STEP;
      const origin = at(u, v);
      const across = at(u + du, v);
      const along = at(u, v + dv);
      return [
        Math.hypot(across[0] - origin[0], across[1] - origin[1]) / METRIC_STEP,
        Math.hypot(along[0] - origin[0], along[1] - origin[1]) / METRIC_STEP,
      ];
    },
  };
}
