export type Point = readonly [number, number];
export type Polyline = readonly Point[];
export type Cubic = readonly [Point, Point, Point];

/** Samples per cubic segment; contour index arithmetic depends on this value. */
export const SEGMENT_SAMPLES = 20;

/** Coordinates in SVG units; positive y points down, origin at thorax. */
export function contour(start: Point, segments: readonly Cubic[]): Polyline {
  const points: Point[] = [start];
  let previous = start;
  for (const [a, b, end] of segments) {
    for (let index = 1; index <= SEGMENT_SAMPLES; index++) {
      const t = index / SEGMENT_SAMPLES;
      const u = 1 - t;
      points.push([
        u ** 3 * previous[0] + 3 * u ** 2 * t * a[0] + 3 * u * t ** 2 * b[0] + t ** 3 * end[0],
        u ** 3 * previous[1] + 3 * u ** 2 * t * a[1] + 3 * u * t ** 2 * b[1] + t ** 3 * end[1],
      ]);
    }
    previous = end;
  }
  return points;
}
export function ellipse(rx: number, ry: number, cy: number): Polyline {
  const points: Point[] = Array.from({ length: 64 }, (_, index) => {
    const angle = index / 64 * Math.PI * 2;
    return [Math.cos(angle) * rx, cy + Math.sin(angle) * ry];
  });
  return [...points, points[0]!];
}
export function mirror(points: Polyline): Polyline {
  return points.map(([x, y]) => [-x, y]);
}

export function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/** Linear interpolation; t outside [0, 1] extrapolates. */
export function between(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Point at a fractional position in index space, not arc length. */
export function atIndex(points: Polyline, index: number): Point {
  const last = points.length - 1;
  const position = clamp(index, 0, last);
  const lower = Math.min(Math.floor(position), last - 1);
  return between(points[lower]!, points[lower + 1]!, position - lower);
}

export function quadratic(start: Point, control: Point, end: Point, steps: number): Polyline {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const u = 1 - t;
    return [
      u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
      u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
    ] as Point;
  });
}

/** Shoelace area; the sign reports winding, which fringe uses to face outward. */
export function signedArea(polygon: Polyline): number {
  let total = 0;
  for (let index = 0; index < polygon.length - 1; index++) {
    const [x1, y1] = polygon[index]!;
    const [x2, y2] = polygon[index + 1]!;
    total += x1 * y2 - x2 * y1;
  }
  return total / 2;
}

/** Ray casting; points exactly on an edge are undefined but never generated. */
export function pointInPolygon(point: Point, polygon: Polyline): boolean {
  const [x, y] = point;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [xi, yi] = polygon[index]!;
    const [xj, yj] = polygon[previous]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
