import { clip } from '../core/clip';
import { contour, ellipse, mirror, SEGMENT_SAMPLES, type Point, type Polyline } from '../core/geometry';
import { dice } from '../core/random';
import { marginRange, wingField } from './field';
import type { LayerLine, Mark } from './marks';
import { wingPattern, type PatternRecipe } from './pattern';
import { bodyTexture, wingTexture, type TextureRecipe } from './texture';

export { MARK_LAYERS, TEXTURE_LAYERS, type Mark, type MarkLayer } from './marks';

export const GENERATOR_VERSION = '0.3.0';
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
  /** [hindwing right, hindwing left, forewing right, forewing left]; marks index into this. */
  wings: readonly Polyline[];
  body: readonly Polyline[];
  antennae: readonly Polyline[];
  /** Wing markings, already clipped to their wing and to any wing covering it. */
  marks: readonly Mark[];
  /** Abdomen creases and thorax tufts, drawn over the wings. */
  bodyLines: readonly Polyline[];
  wingspan: number;
}
export const SURVEY_SEEDS = Array.from({ length: 100 }, (_, i) => `nocturne-${String(i + 1).padStart(3, '0')}`);
/** The fixed comparison plate; a prefix of the survey so both stay consistent. */
export const SPECIMEN_SEEDS = SURVEY_SEEDS.slice(0, 20);

type TextureTuning = Omit<TextureRecipe, 'fringeFrom' | 'fringeTo'>;
interface FamilyRecipe {
  readonly fore: PatternRecipe;
  readonly hind: PatternRecipe;
  readonly foreTexture: TextureTuning;
  readonly hindTexture: TextureTuning;
}

const FORE_PATTERN: PatternRecipe = {
  veins: [9, 11], bands: [2, 3], bandWaves: [2.5, 4.5], bandAmplitude: [0.02, 0.05],
  bandTilt: [-0.2, -0.06], bandStart: [0.2, 0.3], bandSpan: [0.42, 0.78], doubleBand: 0.45, eyespot: 0.4, eyespotRadius: [6, 11], discalBar: 0.5,
};
const HIND_PATTERN: PatternRecipe = {
  veins: [6, 8], bands: [1, 2], bandWaves: [2, 3.5], bandAmplitude: [0.02, 0.05],
  bandTilt: [-0.14, -0.02], bandStart: [0.06, 0.14], bandSpan: [0.45, 0.72], doubleBand: 0.3, eyespot: 0.3, eyespotRadius: [5, 8], discalBar: 0.2,
};
const FORE_TEXTURE: TextureTuning = {
  hatchPatches: 2, hatchStrokes: [16, 26], hatchLength: [5, 9.5], speckles: [14, 24],
  speckleSize: [1.1, 2.4], fringeStep: 1.8, fringeLength: [2.2, 3.8],
};
const HIND_TEXTURE: TextureTuning = {
  hatchPatches: 1, hatchStrokes: [12, 20], hatchLength: [4, 8], speckles: [8, 16],
  speckleSize: [1, 2.1], fringeStep: 1.6, fringeLength: [2.6, 4.4],
};

/** Per family the markings lean the same way the silhouette does. */
const RECIPES: Record<Family, FamilyRecipe> = {
  rounded: {
    fore: { ...FORE_PATTERN, veins: [10, 12], bandWaves: [1.8, 3], bandAmplitude: [0.03, 0.06], bandTilt: [-0.18, -0.04], eyespot: 0.7, eyespotRadius: [8, 13] },
    hind: { ...HIND_PATTERN, eyespot: 0.4 },
    foreTexture: FORE_TEXTURE, hindTexture: HIND_TEXTURE,
  },
  pointed: {
    fore: { ...FORE_PATTERN, veins: [9, 10], bands: [2, 2], bandWaves: [1, 2], bandAmplitude: [0.012, 0.03], bandTilt: [-0.3, -0.14], bandStart: [0.24, 0.34], doubleBand: 0.65, eyespot: 0.2, discalBar: 0.7 },
    hind: { ...HIND_PATTERN, bands: [1, 1], bandWaves: [1.4, 2.4], eyespot: 0.15 },
    foreTexture: { ...FORE_TEXTURE, hatchLength: [4.5, 8], speckles: [8, 16] },
    hindTexture: HIND_TEXTURE,
  },
  swept: {
    fore: { ...FORE_PATTERN, veins: [8, 10], bands: [2, 3], bandWaves: [1.2, 2.2], bandTilt: [-0.26, -0.1], bandSpan: [0.44, 0.84], eyespot: 0.45 },
    hind: { ...HIND_PATTERN, veins: [6, 7] },
    foreTexture: { ...FORE_TEXTURE, hatchPatches: 3, hatchStrokes: [16, 24] },
    hindTexture: { ...HIND_TEXTURE, hatchPatches: 2 },
  },
  scalloped: {
    fore: { ...FORE_PATTERN, veins: [10, 12], bands: [3, 4], bandWaves: [5, 8], bandAmplitude: [0.025, 0.05], bandTilt: [-0.16, -0.04], doubleBand: 0.6, eyespot: 0.35 },
    hind: { ...HIND_PATTERN, bands: [2, 3], bandWaves: [4, 7] },
    foreTexture: { ...FORE_TEXTURE, speckles: [22, 34], speckleSize: [1, 2] },
    hindTexture: { ...HIND_TEXTURE, speckles: [14, 24] },
  },
  tailed: {
    fore: { ...FORE_PATTERN, veins: [8, 10], bands: [2, 2], eyespot: 0.9, eyespotRadius: [9, 14] },
    hind: { ...HIND_PATTERN, veins: [6, 7], bands: [1, 1], eyespot: 0.65, eyespotRadius: [6, 10] },
    foreTexture: { ...FORE_TEXTURE, hatchStrokes: [10, 16], speckles: [10, 18] },
    hindTexture: { ...HIND_TEXTURE, hatchStrokes: [8, 14] },
  },
};

/** Bounds marks to their wing, then removes what an overlapping wing hides. */
function place(lines: readonly LayerLine[], wing: number, outline: Polyline, occluders: readonly Polyline[]): Mark[] {
  const marks: Mark[] = [];
  for (const line of lines) {
    // Fringe is meant to cross the margin, so it is hidden but never bounded.
    let pieces = line.layer === 'fringe' ? [line.points] : clip(line.points, outline, 'inside');
    for (const occluder of occluders) pieces = pieces.flatMap(piece => clip(piece, occluder, 'outside'));
    for (const points of pieces) marks.push({ layer: line.layer, wing, points });
  }
  return marks;
}
const flip = (mark: Mark): Mark => ({ layer: mark.layer, wing: mark.wing, points: mirror(mark.points) });

export function generateMoth(input: string): Moth {
  const seed = input.normalize('NFC').trim();
  if (!seed || seed.length > 160) throw new Error('시드는 1~160자로 입력해주세요.');
  const structure = dice(seed, 'structure');
  const range = (a: number, b: number) => structure.range(a, b);
  const family = structure.pick(FAMILIES);
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
  const feathered = structure.unit() > 0.35;
  if (feathered) {
    for (let i = 3; i < 18; i += 2) {
      const point = stalk[i]!;
      const length = Math.sin(i / 20 * Math.PI) * 6;
      const branch: Polyline = [[point[0] - length, point[1] - 3], point, [point[0] + length, point[1] + 2]];
      antennae.push(branch, mirror(branch));
    }
  }

  const recipe = RECIPES[family];
  const pattern = dice(seed, 'pattern');
  const texture = dice(seed, 'texture');
  const foreField = wingField(frontShape, [thoraxWidth * 0.45, 0], pattern.range(0.02, 0.055));
  const hindField = wingField(backShape, [thoraxWidth * 0.45, 11], pattern.range(0.015, 0.04));
  const forePattern = wingPattern(foreField, recipe.fore, pattern);
  const hindPattern = wingPattern(hindField, recipe.hind, pattern);
  const [foreMargin, foreMarginEnd] = marginRange(frontShape);
  const [hindMargin, hindMarginEnd] = marginRange(backShape);
  // The forewing costal edge is bare, so its fringe starts after the first segment.
  const foreTexture = (): LayerLine[] => wingTexture(foreField, frontShape,
    { ...recipe.foreTexture, fringeFrom: foreMargin + SEGMENT_SAMPLES, fringeTo: foreMarginEnd }, texture);
  const hindTexture = (): LayerLine[] => wingTexture(hindField, backShape,
    { ...recipe.hindTexture, fringeFrom: hindMargin, fringeTo: hindMarginEnd }, texture);
  // Both sides are clipped in right-wing coordinates and the left is mirrored, so
  // symmetry is exact. Texture draws twice, giving each side its own wear.
  const hindRight = hindTexture();
  const hindLeft = hindTexture();
  const foreRight = foreTexture();
  const foreLeft = foreTexture();
  const marks: Mark[] = [
    ...place([...hindPattern, ...hindRight], 0, backShape, [frontShape]),
    ...place([...hindPattern, ...hindLeft], 1, backShape, [frontShape]).map(flip),
    ...place([...forePattern, ...foreRight], 2, frontShape, []),
    ...place([...forePattern, ...foreLeft], 3, frontShape, []).map(flip),
  ];

  return {
    seed, generatorVersion: GENERATOR_VERSION, family,
    wings: [backShape, mirror(backShape), frontShape, mirror(frontShape)],
    body: [ellipse(thoraxWidth * 0.73, bodyLength / 2, bodyLength / 2 + 1), ellipse(thoraxWidth, 18, -2), ellipse(thoraxWidth * 0.69, 8, -22)],
    antennae,
    marks,
    bodyLines: bodyTexture(thoraxWidth, bodyLength, texture),
    wingspan: Math.max(...frontShape.map(([x]) => x), ...backShape.map(([x]) => x)) * 2,
  };
}
