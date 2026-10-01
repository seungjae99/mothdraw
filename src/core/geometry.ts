export type Point = readonly [number, number];
export type Polyline = readonly Point[];
export type Cubic = readonly [Point, Point, Point];

/** Coordinates in SVG units; positive y points down, origin at thorax. */
export function contour(start: Point, segments: readonly Cubic[]): Polyline {
  const points: Point[] = [start];
  let previous = start;
  for (const [a, b, end] of segments) {
    for (let index = 1; index <= 20; index++) {
      const t = index / 20;
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
