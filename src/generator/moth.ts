import { clip } from '../core/clip';
import { clamp, contour, mirror, SEGMENT_SAMPLES, type Cubic, type Point, type Polyline } from '../core/geometry';
import { MIN_ROUGHEN_POINTS, roughen } from '../core/ink';
import { dice, type Dice } from '../core/random';
import { buildBody, headSeatOf, hipOf, shoulderOf, type BodyShape } from './body';
import { FAMILIES, type Family } from './family';
import { marginRange, wingField } from './field';
import { dials, normalizeOptions, scaleRange, type Dials, type MothOptions } from './options';
import { UNBOUNDED_LAYERS, type LayerLine, type Mark } from './marks';
import { wingPattern, type PatternRecipe } from './pattern';
import { tear, wingTexture, type TextureRecipe } from './texture';

export { MARK_LAYERS, TEXTURE_LAYERS, UNBOUNDED_LAYERS, type Mark, type MarkLayer } from './marks';
export { FAMILIES, FAMILY_LABELS, type Family } from './family';
export { DEFAULT_OPTIONS, normalizeOptions, type FamilyChoice, type MothOptions } from './options';

export const GENERATOR_VERSION = '0.6.0';
/** Roughly how often a wing carries visible damage, per side. */
const FORE_TEAR = 0.2;
const HIND_TEAR = 0.14;
export interface Moth {
  seed: string;
  /** Normalized; a record of seed, options and version reproduces this exactly. */
  options: MothOptions;
  /** Uniform scale already applied to every coordinate, against a nominal 1. */
  size: number;
  generatorVersion: string;
  family: Family;
  /** [hindwing right, hindwing left, forewing right, forewing left]; marks index into this. */
  wings: readonly Polyline[];
  /** Filled shapes: abdomen, thorax, head and eyes. */
  body: readonly Polyline[];
  antennae: readonly Polyline[];
  /** Hair and legs in ink, drawn over the wings and under the body fill. */
  bristles: readonly Polyline[];
  /**
   * Whether each wing carries a bite out of its margin, index-aligned with
   * `wings`. Wear is the one feature allowed to differ between the two sides.
   */
  torn: readonly boolean[];
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
  bandTilt: [-0.2, -0.06], bandStart: [0.2, 0.3], bandSpan: [0.42, 0.78], doubleBand: 0.45, eyespot: 0.62, eyespotRadius: [8, 14], discalBar: 0.5,
  shade: 0.78, shadeWidth: [0.1, 0.19], shadeStrokes: [58, 86],
};
const HIND_PATTERN: PatternRecipe = {
  veins: [6, 8], bands: [1, 2], bandWaves: [2, 3.5], bandAmplitude: [0.02, 0.05],
  bandTilt: [-0.14, -0.02], bandStart: [0.06, 0.14], bandSpan: [0.45, 0.72], doubleBand: 0.3, eyespot: 0.45, eyespotRadius: [6, 10], discalBar: 0.2,
  shade: 0.6, shadeWidth: [0.09, 0.17], shadeStrokes: [44, 66],
};
const FORE_TEXTURE: TextureTuning = {
  hatchPatches: 2, hatchStrokes: [26, 40], hatchLength: [5, 10], speckles: [20, 34],
  speckleSize: [1.1, 2.4], shadeStrokes: [34, 54], fringeStep: 1.6, fringeLength: [2.2, 4.2],
};
const HIND_TEXTURE: TextureTuning = {
  hatchPatches: 1, hatchStrokes: [20, 30], hatchLength: [4, 8.5], speckles: [12, 22],
  speckleSize: [1, 2.1], shadeStrokes: [24, 38], fringeStep: 1.5, fringeLength: [2.6, 4.6],
};

/** Per family the markings lean the same way the silhouette does. */
const RECIPES: Record<Family, FamilyRecipe> = {
  rounded: {
    fore: { ...FORE_PATTERN, veins: [10, 12], bandWaves: [1.8, 3], bandAmplitude: [0.03, 0.06], bandTilt: [-0.18, -0.04], eyespot: 0.85, eyespotRadius: [10, 16] },
    hind: { ...HIND_PATTERN, eyespot: 0.4 },
    foreTexture: FORE_TEXTURE, hindTexture: HIND_TEXTURE,
  },
  pointed: {
    fore: { ...FORE_PATTERN, veins: [9, 10], bands: [2, 2], bandWaves: [1, 2], bandAmplitude: [0.012, 0.03], bandTilt: [-0.3, -0.14], bandStart: [0.24, 0.34], doubleBand: 0.65, eyespot: 0.2, discalBar: 0.7, shade: 0.9, shadeWidth: [0.13, 0.22] },
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
    fore: { ...FORE_PATTERN, veins: [10, 12], bands: [3, 4], bandWaves: [5, 8], bandAmplitude: [0.025, 0.05], bandTilt: [-0.16, -0.04], doubleBand: 0.6, eyespot: 0.35, shade: 0.55, shadeWidth: [0.07, 0.13] },
    hind: { ...HIND_PATTERN, bands: [2, 3], bandWaves: [4, 7] },
    foreTexture: { ...FORE_TEXTURE, speckles: [22, 34], speckleSize: [1, 2] },
    hindTexture: { ...HIND_TEXTURE, speckles: [14, 24] },
  },
  tailed: {
    fore: { ...FORE_PATTERN, veins: [8, 10], bands: [2, 2], eyespot: 0.95, eyespotRadius: [11, 17], shade: 0.5 },
    hind: { ...HIND_PATTERN, veins: [6, 7], bands: [1, 1], eyespot: 0.8, eyespotRadius: [7, 12] },
    foreTexture: { ...FORE_TEXTURE, hatchStrokes: [10, 16], speckles: [10, 18] },
    hindTexture: { ...HIND_TEXTURE, hatchStrokes: [8, 14] },
  },
};

/** A pair of wings, back to front; everything in front of it hides part of it. */
interface WingLayer {
  readonly outline: Polyline;
  /** Where the wing-local field fans out from. */
  readonly base: Point;
  /** Outline index offset where fringe starts; the forewing costa is left bare. */
  readonly seat: number;
  readonly pattern: PatternRecipe;
  readonly texture: TextureTuning;
  readonly tear: number;
}

/**
 * A hindwing seated between `top` and `rootY`. The spare third pair reuses it at
 * a smaller scale, which is why every offset is expressed from the seat.
 */
function hindContour(width: number, depth: number, top: number, rootY: number, hinge: number, tailed: boolean): Polyline {
  const start: Point = [hinge, top];
  const outer: Point = [width * 0.79, top + depth * 0.32];
  const bottom: Point = [width * 0.34, top + depth];
  const rooted: Point = [hinge, rootY];
  const middle = (top + rootY) / 2;
  const close: Cubic = [[4, middle + 7], [4, middle - 3], start];
  return tailed
    ? contour(start, [
      [[width * 0.25, top], [width * 0.64, top - 4], outer],
      [[width * 0.79, top + depth * 0.7], [width * 0.53, top + depth * 0.65], [width * 0.47, top + depth * 0.88]],
      [[width * 0.45, top + depth * 1.1], [width * 0.57, top + depth * 1.56], [width * 0.4, top + depth * 1.57]],
      [[width * 0.43, top + depth * 1.23], [width * 0.32, top + depth * 0.96], [width * 0.27, top + depth * 0.89]],
      [[width * 0.16, top + depth * 0.78], [8, rootY + 17], rooted],
      close,
    ])
    : contour(start, [
      [[width * 0.28, top - 2], [width * 0.69, top - 8], outer],
      [[width * 0.85, top + depth * 0.8], [width * 0.64, top + depth * 1.14], bottom],
      [[width * 0.14, top + depth * 0.95], [8, rootY + 15], rooted],
      close,
    ]);
}

/** The outline is drawn twice: once as the shape, once as a searching second pass. */
function edge(outline: Polyline, span: readonly [number, number], ink: Dice, dial: Dials): LayerLine[] {
  return [
    { layer: 'edge', points: outline },
    { layer: 'edge', points: roughen(outline, ink, ink.range(0.5, 1.1) * dial.tremor, ink.int(3, 6), span) },
  ];
}

/**
 * Wear is drawn per side: the bite removes marks, fringe and the margin itself
 * inside its hole, and the torn rim is drawn in place of what it took.
 */
function wear(outline: Polyline, span: readonly [number, number], chance: number, dial: Dials, texture: Dice) {
  const holes: Polyline[] = [];
  const rims: LayerLine[] = [];
  const bites = texture.chance(Math.min(0.85, chance * dial.wearChance)) ? texture.int(1, 2) : 0;
  for (let index = 0; index < bites; index++) {
    const bite = tear(outline, span, dial.wear, texture);
    holes.push(bite.hole);
    for (const piece of clip(bite.rim, outline, 'inside')) rims.push({ layer: 'edge', points: piece });
  }
  return { holes, rims };
}

/** Bounds marks to their wing, then removes what an overlapping wing hides. */
function place(lines: readonly LayerLine[], wing: number, outline: Polyline, occluders: readonly Polyline[]): Mark[] {
  const marks: Mark[] = [];
  for (const line of lines) {
    // Edges and fringe belong on the margin, so they are hidden but never bounded.
    let pieces = UNBOUNDED_LAYERS.includes(line.layer) ? [line.points] : clip(line.points, outline, 'inside');
    for (const occluder of occluders) pieces = pieces.flatMap(piece => clip(piece, occluder, 'outside'));
    for (const points of pieces) marks.push({ layer: line.layer, wing, points });
  }
  return marks;
}
const flip = (mark: Mark): Mark => ({ layer: mark.layer, wing: mark.wing, points: mirror(mark.points) });

/**
 * Tremor is applied before clipping, so a mark that wanders past the margin is
 * still trimmed there and containment stays exact. Short marks are a single
 * gesture already and are left alone.
 */
function tremble(lines: readonly LayerLine[], ink: Dice, amplitude: number): LayerLine[] {
  return lines.map(line => line.points.length < MIN_ROUGHEN_POINTS
    ? line
    : { layer: line.layer, points: roughen(line.points, ink, ink.range(0.4, 0.9) * amplitude, ink.int(1, 3), null) });
}

/** Pushes a drawn value away from the middle of its range; the strangeness dial. */
function stretch(value: number, low: number, high: number, extremes: number): number {
  // Returned untouched at the default so the dials do not perturb the reference
  // plate through rounding alone.
  if (extremes === 1) return value;
  const middle = (low + high) / 2;
  return middle + (value - middle) * extremes;
}

/** Applies the dials to a family's recipe without touching the draw order. */
function tune(recipe: FamilyRecipe, dial: Dials): FamilyRecipe {
  const pattern = (entry: PatternRecipe): PatternRecipe => ({
    ...entry,
    veins: scaleRange(entry.veins, dial.marks, 3),
    bands: scaleRange(entry.bands, dial.marks, 1),
    shadeStrokes: scaleRange(entry.shadeStrokes, dial.marks, 8),
    eyespot: Math.min(1, entry.eyespot * dial.eyes),
    eyespotRadius: [entry.eyespotRadius[0] * dial.eyes, entry.eyespotRadius[1] * dial.eyes],
  });
  const texture = (entry: TextureTuning): TextureTuning => ({
    ...entry,
    hatchStrokes: scaleRange(entry.hatchStrokes, dial.marks, 2),
    shadeStrokes: scaleRange(entry.shadeStrokes, dial.marks, 2),
    speckles: scaleRange(entry.speckles, dial.marks, 1),
    fringeStep: Math.max(0.9, entry.fringeStep / dial.marks),
  });
  return {
    fore: pattern(recipe.fore), hind: pattern(recipe.hind),
    foreTexture: texture(recipe.foreTexture), hindTexture: texture(recipe.hindTexture),
  };
}

export function generateMoth(input: string, choices?: Partial<MothOptions>): Moth {
  const seed = input.normalize('NFC').trim();
  if (!seed || seed.length > 160) throw new Error('시드는 1~160자로 입력해주세요.');
  const options = normalizeOptions(choices);
  const dial = dials(options);
  const structure = dice(seed, 'structure');
  const range = (a: number, b: number) => structure.range(a, b);
  const push = (value: number, low: number, high: number) => stretch(value, low, high, dial.extremes);
  // The family is always drawn so the stream stays aligned, then overridden.
  const drawn = structure.pick(FAMILIES);
  const family = options.family === 'any' ? drawn : options.family;
  const width = push(range(91, 139), 91, 139);
  const rise = push(range(41, 76), 41, 76);
  const depth = push(range(43, 67), 43, 67);

  const shape: BodyShape = {
    thoraxWidth: push(range(7, 11), 7, 11),
    thoraxLength: push(range(13, 24), 13, 24),
    thoraxSeat: -2,
    headRadius: push(range(7, 11), 7, 11) * range(0.52, 0.95),
    headHeight: push(range(6, 12), 6, 12),
    abdomenWidth: push(range(7, 11), 7, 11) * range(0.56, 0.98),
    abdomenLength: push(range(40, 82), 40, 82),
    abdomenTaper: push(range(0.35, 1.9), 0.35, 1.9),
  };
  const hinge = shape.thoraxWidth * 0.45;
  const shoulderY = shoulderOf(shape);
  const hipY = hipOf(shape);

  // Wing pairs. Two is the moth; one and three are the specimens that are wrong,
  // so an orderly setting never reaches them.
  const oddity = structure.unit();
  const spare = Math.max(0, dial.extremes - 0.65) * 0.62;
  const counted = oddity < spare * 0.45 ? 1 : oddity < spare ? 3 : 2;
  // The tails belong to the hindwing, so a tailed specimen always keeps one.
  const pairs = family === 'tailed' && counted === 1 ? 2 : counted;
  const spareWidth = range(0.64, 0.95);
  const spareDepth = range(0.78, 1.18);
  const spareSeat = range(0.95, 1.5);
  // Overall size. The frame is fixed, so this is the one dimension that reads
  // as a specimen being large or small rather than as a different shape. It is
  // left off the strangeness dial, which would otherwise push it out of frame.
  const size = range(0.62, 1.15);

  const tipY = family === 'swept' ? -rise * 0.2 : -rise;
  const tipX = family === 'swept' ? width * 0.9 : width;
  const shoulder: Point = [hinge, shoulderY];
  const root: Point = [hinge, hipY];
  const tip: Point = [tipX, tipY];
  // A lone pair hangs lower, closer to a fore and hind wing fused into one.
  const drop = family === 'swept' ? 0.8 : pairs === 1 ? 0.78 : 0.2;
  const lower: Point = [width * 0.64, depth * drop];
  const front = contour(shoulder, [
    [[width * 0.29, -rise * 0.45], [width * 0.79, -rise * (family === 'rounded' ? 1.45 : 0.94)], tip],
    [[width * (family === 'rounded' ? 1.18 : 0.97), tipY + rise * 0.52], [width * 0.92, lower[1] - 1], lower],
    [[width * 0.42, lower[1] + range(4, 15)], [width * 0.14, hipY + 10], root],
    [[3, hipY - 7], [3, shoulderY + 6], shoulder],
  ]);

  const backTop = hipY - 12;
  const backRootY = hipY + 10;
  const back = hindContour(width, depth, backTop, backRootY, hinge, family === 'tailed');
  // The spare pair is seated below the hindwing, so what shows of it is the part
  // that reaches past one: the silhouette gains a layer it should not have.
  const spareTop = backTop + depth * 0.4 * spareSeat;
  const spareOutline = hindContour(width * spareWidth, depth * spareDepth, spareTop, spareTop + 20, hinge, false);

  // Small edge lobes taper to zero near the root and preserve bilateral structure.
  const scallop = (points: Polyline): Polyline => points.map(([x, y], index) => {
    if (family !== 'scalloped' || index <= 20 || index >= 60) return [x, y];
    const t = (index - 20) / 40;
    const offset = Math.sin(t * Math.PI) * Math.sin(t * Math.PI * 12) * 1.2;
    return [x + offset, y + offset * 0.65];
  });
  const ink = dice(seed, 'ink');
  // Tremor goes on the silhouette before anything is measured from it, so the
  // fields, the marks and the clipping all agree with the line that is drawn.
  const tremor = ink.range(0.9, 1.7) * dial.tremor;
  const inked = (points: Polyline): Polyline =>
    roughen(scallop(points), ink, tremor, ink.int(4, 7), marginRange(points));

  // Antennae. Length is the single feature that reads as unease from across a
  // room, so a fifth of them run far past the wings.
  const sweeping = structure.chance(0.25);
  const reach = sweeping ? range(2, 2.9) : range(0.9, 1.45);
  const spread = range(0.8, 1.3) * (sweeping ? 1.6 : 1);
  const antennaRoot: Point = [3, headSeatOf(shape) - shape.headHeight * 0.5];
  const stalk = contour(antennaRoot, [[
    [10 * spread, antennaRoot[1] - 14 * reach],
    [range(17, 26) * spread, antennaRoot[1] - 21 * reach],
    [range(23, 34) * spread, antennaRoot[1] - range(22, 36) * reach],
  ]]);
  const antennae: Polyline[] = [stalk, mirror(stalk)];
  const feathered = structure.unit() > 0.35;
  if (feathered) {
    // Bipectinate barbs, one per sample rather than every other, so the antenna
    // reads as a dense feather instead of a comb.
    // A long feeler stays thin; piling barbs on it would read as a bush.
    const barb = 7.5 * clamp(1.25 - reach * 0.3, 0.45, 1);
    for (let i = 2; i < 19; i++) {
      const point = stalk[i]!;
      const length = Math.sin(i / 20 * Math.PI) * barb;
      const branch: Polyline = [[point[0] - length, point[1] - 3.4], point, [point[0] + length, point[1] + 2.2]];
      antennae.push(branch, mirror(branch));
    }
  }

  const recipe = tune(RECIPES[family], dial);
  const pattern = dice(seed, 'pattern');
  const texture = dice(seed, 'texture');
  // Back to front: the spare pair first, the forewing last. Each is hidden by
  // every pair in front of it, so the stack reads without any fill.
  const layers: WingLayer[] = [];
  if (pairs === 3) {
    layers.push({
      outline: inked(spareOutline), base: [hinge, spareTop + 10], seat: 0,
      pattern: recipe.hind, texture: recipe.hindTexture, tear: HIND_TEAR,
    });
  }
  if (pairs >= 2) {
    layers.push({
      outline: inked(back), base: [hinge, backTop + 11], seat: 0,
      pattern: recipe.hind, texture: recipe.hindTexture, tear: HIND_TEAR,
    });
  }
  layers.push({
    outline: inked(front), base: [hinge, shape.thoraxSeat], seat: SEGMENT_SAMPLES,
    pattern: recipe.fore, texture: recipe.foreTexture, tear: FORE_TEAR,
  });

  const marks: Mark[] = [];
  const torn: boolean[] = [];
  for (let pair = 0; pair < layers.length; pair++) {
    const layer = layers[pair]!;
    const occluders = layers.slice(pair + 1).map(entry => entry.outline);
    const field = wingField(layer.outline, layer.base, pattern.range(0.015, 0.055));
    const span = marginRange(layer.outline);
    // The pattern is trembled once and shared, so both sides carry the same hand.
    const marking = tremble(wingPattern(field, layer.pattern, pattern), ink, dial.tremor);
    for (let side = 0; side < 2; side++) {
      const wearing = wingTexture(field, layer.outline,
        { ...layer.texture, fringeFrom: span[0] + layer.seat, fringeTo: span[1] }, texture);
      const worn = wear(layer.outline, span, layer.tear, dial, texture);
      const wing = pair * 2 + side;
      torn[wing] = worn.holes.length > 0;
      const lines = [
        ...edge(layer.outline, span, ink, dial),
        ...worn.rims,
        ...marking,
        ...tremble(wearing, ink, dial.tremor),
      ];
      const placed = place(lines, wing, layer.outline, [...occluders, ...worn.holes]);
      marks.push(...(side === 0 ? placed : placed.map(flip)));
    }
  }
  const parts = buildBody(shape, dial.fur, texture);
  const resize = (points: Polyline): Polyline => points.map(([x, y]) => [x * size, y * size]);

  const wings = layers.flatMap(layer => [layer.outline, mirror(layer.outline)]);
  return {
    seed, options, size, generatorVersion: GENERATOR_VERSION, family,
    wings: wings.map(resize),
    body: parts.shapes.map(resize),
    antennae: antennae.map(resize),
    bristles: parts.bristles.map(resize),
    torn,
    marks: marks.map(mark => ({ layer: mark.layer, wing: mark.wing, points: resize(mark.points) })),
    bodyLines: parts.creases.map(resize),
    wingspan: Math.max(...wings.flatMap(wing => wing.map(([x]) => x))) * 2 * size,
  };
}
