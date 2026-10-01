import { contour, ellipse, mirror, type Point, type Polyline } from '../core/geometry';
import { randomStream } from '../core/random';

export const GENERATOR_VERSION = '0.2.0';
export const FAMILIES = ['rounded', 'pointed', 'swept', 'scalloped', 'tailed'] as const;
export type Family = typeof FAMILIES[number];
export const FAMILY_LABELS: Record<Family, string> = {
  rounded: '둥근 날개', pointed: '뾰족한 날개', swept: '후퇴한 날개',
  scalloped: '물결 날개', tailed: '긴 꼬리 날개',
};
export interface Moth {
  seed: string;
  generatorVersion: string;
  family: Family;
  wings: readonly Polyline[];
  body: readonly Polyline[];
  antennae: readonly Polyline[];
  wingspan: number;
}
export const SPECIMEN_SEEDS = Array.from({ length: 20 }, (_, i) => `nocturne-${String(i + 1).padStart(3, '0')}`);

export function generateMoth(input: string): Moth {
  const seed = input.normalize('NFC').trim();
  if (!seed || seed.length > 160) throw new Error('시드는 1~160자로 입력해주세요.');
  const random = randomStream(seed, 'structure');
  const range = (a: number, b: number) => a + random() * (b - a);
  const family = FAMILIES[Math.floor(random() * FAMILIES.length)]!;
  const width = range(91, 139);
  const rise = range(41, 76);
  const depth = range(43, 67);
  const thoraxWidth = range(7, 11);
  const bodyLength = range(43, 63);
  const tipY = family === 'swept' ? -rise * 0.2 : -rise;
  const tipX = family === 'swept' ? width * 0.9 : width;
  const shoulder: Point = [thoraxWidth * 0.45, -12];
  const root: Point = [thoraxWidth * 0.45, 12];
  const tip: Point = [tipX, tipY];
  const lower: Point = [width * 0.64, family === 'swept' ? depth * 0.8 : depth * 0.2];
  const front = contour(shoulder, [
    [[width * 0.29, -rise * 0.45], [width * 0.79, -rise * (family === 'rounded' ? 1.45 : 0.94)], tip],
    [[width * (family === 'rounded' ? 1.18 : 0.97), tipY + rise * 0.52], [width * 0.92, lower[1] - 1], lower],
    [[width * 0.42, lower[1] + range(4, 15)], [width * 0.14, 22], root],
    [[3, 5], [3, -6], shoulder],
  ]);
  const backStart: Point = [thoraxWidth * 0.45, 0];
  const backOuter: Point = [width * 0.79, depth * 0.32];
  const backBottom: Point = [width * 0.34, depth];
  const backRoot: Point = [thoraxWidth * 0.45, 22];
  const back = family === 'tailed'
    ? contour(backStart, [
      [[width * 0.25, 0], [width * 0.64, -4], backOuter],
      [[width * 0.79, depth * 0.7], [width * 0.53, depth * 0.65], [width * 0.47, depth * 0.88]],
      [[width * 0.45, depth * 1.1], [width * 0.57, depth * 1.56], [width * 0.4, depth * 1.57]],
      [[width * 0.43, depth * 1.23], [width * 0.32, depth * 0.96], [width * 0.27, depth * 0.89]],
      [[width * 0.16, depth * 0.78], [8, 39], backRoot],
      [[4, 18], [4, 8], backStart],
    ])
    : contour(backStart, [
      [[width * 0.28, -2], [width * 0.69, -8], backOuter],
      [[width * 0.85, depth * 0.8], [width * 0.64, depth * 1.14], backBottom],
      [[width * 0.14, depth * 0.95], [8, 37], backRoot],
      [[4, 18], [4, 8], backStart],
    ]);
  // Small edge lobes taper to zero near the root and preserve bilateral structure.
  const scallop = (points: Polyline): Polyline => points.map(([x, y], index) => {
    if (family !== 'scalloped' || index <= 20 || index >= 60) return [x, y];
    const t = (index - 20) / 40;
    const offset = Math.sin(t * Math.PI) * Math.sin(t * Math.PI * 12) * 1.2;
    return [x + offset, y + offset * 0.65];
  });
  const frontShape = scallop(front);
  const backShape = scallop(back);
  const stalk = contour([3, -26], [
    [[10, -40], [range(17, 26), -47], [range(23, 34), -range(48, 62)]],
  ]);
  const antennae: Polyline[] = [stalk, mirror(stalk)];
  const feathered = random() > 0.35;
  if (feathered) {
    for (let i = 3; i < 18; i += 2) {
      const point = stalk[i]!;
      const length = Math.sin(i / 20 * Math.PI) * 6;
      const branch: Polyline = [[point[0] - length, point[1] - 3], point, [point[0] + length, point[1] + 2]];
      antennae.push(branch, mirror(branch));
    }
  }
  return {
    seed, generatorVersion: GENERATOR_VERSION, family,
    wings: [backShape, mirror(backShape), frontShape, mirror(frontShape)],
    body: [ellipse(thoraxWidth * 0.73, bodyLength / 2, bodyLength / 2 + 1), ellipse(thoraxWidth, 18, -2), ellipse(thoraxWidth * 0.69, 8, -22)],
    antennae,
    wingspan: Math.max(...frontShape.map(([x]) => x), ...backShape.map(([x]) => x)) * 2,
  };
}
