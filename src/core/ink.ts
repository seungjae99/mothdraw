import type { Point, Polyline } from './geometry';
import type { Dice } from './random';

/** Frequency multiple and weight; integers keep a closed contour closed. */
const HARMONICS: readonly (readonly [number, number])[] = [[1, 1], [2, 0.42], [3, 0.21]];
/** Shorter lines are already a single gesture and only get distorted by tremor. */
export const MIN_ROUGHEN_POINTS = 6;

/** Full strength over the span, falling to nothing outside it. */
function taper(index: number, span: readonly [number, number]): number {
  const [from, to] = span;
  if (index <= from || index >= to) return 0;
  return Math.sqrt(Math.sin(((index - from) / (to - from)) * Math.PI));
}

/**
 * Offsets a polyline along its own normal with smooth periodic noise, which is
 * what separates a drawn line from a plotted curve. A closed contour stays
 * closed because the harmonics are whole waves and the normals wrap; `span`
 * pins everything outside it, which is how the wing stays joined to the thorax.
 */
export function roughen(
  line: Polyline,
  dice: Dice,
  amplitude: number,
  waves: number,
  span: readonly [number, number] | null,
): Polyline {
  const last = line.length - 1;
  if (last < MIN_ROUGHEN_POINTS - 1) return line;
  const phases = HARMONICS.map(() => dice.range(0, Math.PI * 2));
  const closed = line[0]![0] === line[last]![0] && line[0]![1] === line[last]![1];
  return line.map((point, index) => {
    const t = index / last;
    let noise = 0;
    for (let harmonic = 0; harmonic < HARMONICS.length; harmonic++) {
      const [frequency, weight] = HARMONICS[harmonic]!;
      noise += weight * Math.sin(phases[harmonic]! + 2 * Math.PI * frequency * waves * t);
    }
    const ahead = line[closed ? (index + 1) % last : Math.min(index + 1, last)]!;
    const behind = line[closed ? (index - 1 + last) % last : Math.max(index - 1, 0)]!;
    const dx = ahead[0] - behind[0];
    const dy = ahead[1] - behind[1];
    const length = Math.hypot(dx, dy) || 1;
    const shift = noise * amplitude * (span ? taper(index, span) : 1);
    return [point[0] + (dy / length) * shift, point[1] - (dx / length) * shift] as Point;
  });
}
