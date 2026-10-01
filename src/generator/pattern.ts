import type { Polyline } from '../core/geometry';
import type { Dice } from '../core/random';
import type { WingField } from './field';
import { MIN_METRIC, type LayerLine } from './marks';

/** Veins stop short of the leading and trailing corners. */
const VEIN_EDGE = 0.07;
/** Veins separate well past the wing base; converging on one point reads as a starburst. */
const VEIN_BASE_V = 0.16;
const VEIN_TIP_V = 0.99;
const VEIN_SAMPLES = 12;
const VEIN_SWAY = 0.03;
const BAND_END = 0.97;
const BAND_SAMPLES = 24;
/** Fraction of a band that ramps out to the margin at each end. */
const BAND_ATTACH = 0.13;
/** Gap between the two lines of a doubled band, in v. */
const DOUBLE_BAND_GAP = 0.035;
const RING_SAMPLES = 28;
const PUPIL_SCALE = 0.34;
const DISCAL_SAMPLES = 6;

export interface PatternRecipe {
  readonly veins: readonly [number, number];
  readonly bands: readonly [number, number];
  /** Undulations across the wing; moth transverse lines are rarely straight. */
  readonly bandWaves: readonly [number, number];
  /** Undulation depth in v. */
  readonly bandAmplitude: readonly [number, number];
  /**
   * Drop in v from the leading to the trailing edge. Without it a band would be
   * an offset of the outline and the wing would read as a contour map; real
   * transverse lines run obliquely from the costa towards the inner margin.
   */
  readonly bandTilt: readonly [number, number];
  /**
   * Where along the margin a band leaves the costa. Starting at u = 0 would make
   * the band run alongside the leading edge instead of crossing it once.
   */
  readonly bandStart: readonly [number, number];
  /** Band positions are spread over this v range. */
  readonly bandSpan: readonly [number, number];
  readonly doubleBand: number;
  readonly eyespot: number;
  /** Outer ring radius in SVG units, converted through the local metric. */
  readonly eyespotRadius: readonly [number, number];
  readonly discalBar: number;
  /**
   * A dark mass hatched against one of the bands. Without one the wing stays a
   * pale field of thin lines and the specimen reads as decorative rather than
   * as something found in the dark.
   */
  readonly shade: number;
  readonly shadeWidth: readonly [number, number];
  readonly shadeStrokes: readonly [number, number];
}

/**
 * Veins, transverse bands and eyespots in wing-local (u, v) space, so every mark
 * follows the wing surface instead of being placed in screen coordinates.
 */
export function wingPattern(field: WingField, recipe: PatternRecipe, dice: Dice): LayerLine[] {
  const lines: LayerLine[] = [];
  const veinCount = dice.int(recipe.veins[0], recipe.veins[1]);
  for (let index = 0; index < veinCount; index++) {
    const u = VEIN_EDGE + (1 - 2 * VEIN_EDGE) * (index / (veinCount - 1));
    const base = VEIN_BASE_V + dice.range(-0.055, 0.055);
    // A small sideways bow keeps the fan from looking like drawn radii.
    const sway = dice.range(-VEIN_SWAY, VEIN_SWAY);
    lines.push({
      layer: 'vein',
      points: Array.from({ length: VEIN_SAMPLES + 1 }, (_, step) => {
        const along = step / VEIN_SAMPLES;
        return field.at(u + sway * Math.sin(Math.PI * along), base + (VEIN_TIP_V - base) * along);
      }),
    });
  }

  const bandCount = dice.int(recipe.bands[0], recipe.bands[1]);
  const [spanLow, spanHigh] = recipe.bandSpan;
  /** Keeps the last band's path so the dark mass can sit flush against a line. */
  let anchor: ((u: number) => number) | null = null;
  for (let index = 0; index < bandCount; index++) {
    const spread = bandCount === 1 ? 0.5 : index / (bandCount - 1);
    const middle = spanLow + (spanHigh - spanLow) * spread + dice.range(-0.025, 0.025);
    const waves = dice.range(recipe.bandWaves[0], recipe.bandWaves[1]);
    const amplitude = dice.range(recipe.bandAmplitude[0], recipe.bandAmplitude[1]);
    const drift = dice.range(0, Math.PI * 2);
    const tilt = dice.range(recipe.bandTilt[0], recipe.bandTilt[1]);
    const start = dice.range(recipe.bandStart[0], recipe.bandStart[1]);
    const seat = (u: number): number => {
      const along = (u - start) / (BAND_END - start);
      const core = middle + tilt * (u - 0.5) + Math.sin(drift + u * Math.PI * waves) * amplitude;
      // Both ends run out to the margin so the band terminates on an edge.
      const inset = Math.min(1, Math.max(0, along) / BAND_ATTACH, Math.max(0, 1 - along) / BAND_ATTACH);
      return 1 - (1 - core) * inset;
    };
    const band = (offset: number): Polyline =>
      Array.from({ length: BAND_SAMPLES + 1 }, (_, step) => {
        const u = start + (BAND_END - start) * (step / BAND_SAMPLES);
        return field.at(u, seat(u) + offset);
      });
    lines.push({ layer: 'band', points: band(0) });
    if (dice.chance(recipe.doubleBand)) lines.push({ layer: 'band', points: band(DOUBLE_BAND_GAP) });
    anchor = seat;
  }

  if (anchor && dice.chance(recipe.shade)) {
    const edge = anchor;
    const width = dice.range(recipe.shadeWidth[0], recipe.shadeWidth[1]);
    const strokes = dice.int(recipe.shadeStrokes[0], recipe.shadeStrokes[1]);
    // Kept clear of the band ends, which ramp onto the margin and would turn the
    // mass into a rim rather than a blotch on the wing.
    const from = dice.range(0.28, 0.44);
    const to = dice.range(0.78, 0.93);
    const inward = dice.chance(0.65) ? -1 : 1;
    for (let index = 0; index < strokes; index++) {
      const u = from + (to - from) * (index / (strokes - 1));
      const seat = edge(u) + dice.range(-0.012, 0.012);
      lines.push({ layer: 'shade', points: [field.at(u, seat), field.at(u, seat + width * inward)] });
    }
  }

  if (dice.chance(recipe.discalBar)) {
    const seat = dice.range(0.34, 0.46);
    const start = dice.range(0.26, 0.4);
    lines.push({
      layer: 'band',
      points: Array.from({ length: DISCAL_SAMPLES + 1 }, (_, step) => {
        const along = step / DISCAL_SAMPLES;
        return field.at(start + 0.2 * along, seat + Math.sin(along * Math.PI) * 0.035);
      }),
    });
  }

  if (dice.chance(recipe.eyespot)) {
    const u = dice.range(0.3, 0.62);
    const v = dice.range(0.42, 0.62);
    const radius = dice.range(recipe.eyespotRadius[0], recipe.eyespotRadius[1]);
    const rings = dice.int(2, 3);
    const [across, along] = field.metric(u, v);
    // A circle of `radius` SVG units becomes an ellipse in (u, v), which bends
    // with the wing exactly as a scale pattern on a curved surface would.
    const ring = (scale: number, driftU: number, driftV: number): Polyline =>
      Array.from({ length: RING_SAMPLES + 1 }, (_, step) => {
        const angle = (step / RING_SAMPLES) * Math.PI * 2;
        return field.at(
          u + ((Math.cos(angle) * scale + driftU) * radius) / Math.max(across, MIN_METRIC),
          v + ((Math.sin(angle) * scale + driftV) * radius) / Math.max(along, MIN_METRIC),
        );
      });
    // Rings drift off centre and the pupil sits off axis; a tidy bullseye reads
    // as decoration, an uneven one reads as an eye.
    for (let index = 0; index < rings; index++) {
      const scale = (index + 1) / rings;
      lines.push({ layer: 'eyespot', points: ring(scale, dice.range(-0.1, 0.1) * scale, dice.range(-0.1, 0.1) * scale) });
    }
    lines.push({ layer: 'pupil', points: ring(PUPIL_SCALE, dice.range(-0.3, 0.3), dice.range(-0.3, 0.3)) });
  }
  return lines;
}
