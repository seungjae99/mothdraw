import { atIndex, signedArea, type Point, type Polyline } from '../core/geometry';
import type { Dice } from '../core/random';
import type { WingField } from './field';
import { MIN_METRIC, type LayerLine } from './marks';

/** Fringe strokes are rooted this far inside the margin so they stay attached. */
const FRINGE_ROOT_INSET = 1.2;
const SPECKLE_SAMPLES = 2;

export interface TextureRecipe {
  readonly hatchPatches: number;
  readonly hatchStrokes: readonly [number, number];
  /** Stroke length in SVG units. */
  readonly hatchLength: readonly [number, number];
  /** A dense wedge where the wing meets the body; moths are darkest there. */
  readonly shadeStrokes: readonly [number, number];
  readonly speckles: readonly [number, number];
  readonly speckleSize: readonly [number, number];
  /** First outline index that carries fringe; the leading edge is left bare. */
  readonly fringeFrom: number;
  readonly fringeTo: number;
  readonly fringeStep: number;
  readonly fringeLength: readonly [number, number];
}

/**
 * Hatching, speckles and edge fringe. Drawn from the texture stream and generated
 * once per side, so left and right differ in wear without breaking the structure.
 */
export function wingTexture(
  field: WingField,
  outline: Polyline,
  recipe: TextureRecipe,
  dice: Dice,
): LayerLine[] {
  const lines: LayerLine[] = [];
  for (let patch = 0; patch < recipe.hatchPatches; patch++) {
    const originU = dice.range(0.06, 0.6);
    const originV = dice.range(0.3, 0.72);
    const spanU = dice.range(0.16, 0.34);
    const spanV = dice.range(0.1, 0.2);
    const strokes = dice.int(recipe.hatchStrokes[0], recipe.hatchStrokes[1]);
    for (let index = 0; index < strokes; index++) {
      const u = originU + dice.unit() * spanU;
      const v = originV + dice.unit() * spanV;
      const [, along] = field.metric(u, v);
      // Hatching runs along v, i.e. with the veins, so shading reads as scale rows.
      const half = dice.range(recipe.hatchLength[0], recipe.hatchLength[1]) / 2 / Math.max(along, MIN_METRIC);
      lines.push({ layer: 'hatch', points: [field.at(u, v - half), field.at(u, v), field.at(u, v + half)] });
    }
  }

  const shade = dice.int(recipe.shadeStrokes[0], recipe.shadeStrokes[1]);
  for (let index = 0; index < shade; index++) {
    const u = dice.range(0.1, 0.86);
    const v = dice.range(0.08, 0.44);
    const [, along] = field.metric(u, v);
    const half = dice.range(3, 7.5) / 2 / Math.max(along, MIN_METRIC);
    lines.push({ layer: 'hatch', points: [field.at(u, v - half), field.at(u, v), field.at(u, v + half)] });
  }

  const speckles = dice.int(recipe.speckles[0], recipe.speckles[1]);
  for (let index = 0; index < speckles; index++) {
    const u = dice.range(0.08, 0.92);
    const v = dice.range(0.18, 0.9);
    const [across, along] = field.metric(u, v);
    const size = dice.range(recipe.speckleSize[0], recipe.speckleSize[1]);
    const angle = dice.range(0, Math.PI);
    const reachU = (Math.cos(angle) * size) / 2 / Math.max(across, MIN_METRIC);
    const reachV = (Math.sin(angle) * size) / 2 / Math.max(along, MIN_METRIC);
    lines.push({
      layer: 'speckle',
      points: Array.from({ length: SPECKLE_SAMPLES + 1 }, (_, step) => {
        const t = step / SPECKLE_SAMPLES - 0.5;
        return field.at(u + reachU * 2 * t, v + reachV * 2 * t);
      }),
    });
  }

  // Positive shoelace area means (ty, -tx) faces away from the wing interior.
  const facing = signedArea(outline) >= 0 ? 1 : -1;
  for (let index = recipe.fringeFrom; index <= recipe.fringeTo; index += recipe.fringeStep) {
    const point = atIndex(outline, index);
    const ahead = atIndex(outline, index + 1);
    const behind = atIndex(outline, index - 1);
    const span = Math.hypot(ahead[0] - behind[0], ahead[1] - behind[1]) || 1;
    const outX = ((ahead[1] - behind[1]) / span) * facing;
    const outY = ((behind[0] - ahead[0]) / span) * facing;
    const reach = dice.range(recipe.fringeLength[0], recipe.fringeLength[1]);
    const root: Point = [point[0] - outX * FRINGE_ROOT_INSET, point[1] - outY * FRINGE_ROOT_INSET];
    lines.push({ layer: 'fringe', points: [root, [point[0] + outX * reach, point[1] + outY * reach]] });
  }
  return lines;
}

/** How far past the margin a tear reaches, so the bite always breaks the edge. */
const TEAR_LIFT = 8;

export interface Tear {
  /** Everything inside this is gone: marks, fringe and the outline itself. */
  readonly hole: Polyline;
  /** The torn rim, to be drawn in place of the margin it removed. */
  readonly rim: Polyline;
}

/**
 * A bite out of the wing margin. Damage is drawn per side, which is the one
 * place the specimen is allowed to be asymmetric, and it is what turns a tidy
 * plate into something that was found rather than designed.
 */
export function tear(outline: Polyline, span: readonly [number, number], dice: Dice): Tear {
  const seat = dice.range(span[0] + 8, span[1] - 8);
  const spread = dice.range(2, 6);
  const depth = dice.range(4, 11);
  const ahead = atIndex(outline, seat + 1);
  const behind = atIndex(outline, seat - 1);
  const length = Math.hypot(ahead[0] - behind[0], ahead[1] - behind[1]) || 1;
  const facing = signedArea(outline) >= 0 ? 1 : -1;
  const outX = ((ahead[1] - behind[1]) / length) * facing;
  const outY = ((behind[0] - ahead[0]) / length) * facing;
  const lift = (index: number): Point => {
    const edge = atIndex(outline, index);
    return [edge[0] + outX * TEAR_LIFT, edge[1] + outY * TEAR_LIFT];
  };
  // A ragged rim rather than one apex, so the wing reads as torn, not trimmed.
  const inward = (index: number, sink: number): Point => {
    const edge = atIndex(outline, index);
    return [
      edge[0] - outX * depth * sink + dice.range(-1.6, 1.6),
      edge[1] - outY * depth * sink + dice.range(-1.6, 1.6),
    ];
  };
  const start = lift(seat - spread);
  const end = lift(seat + spread);
  const rim: Polyline = [
    start,
    inward(seat - spread * 0.5, dice.range(0.4, 0.8)),
    inward(seat, 1),
    inward(seat + spread * 0.5, dice.range(0.4, 0.8)),
    end,
  ];
  return { hole: [...rim, start], rim };
}
