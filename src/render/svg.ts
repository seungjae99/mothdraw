import type { Polyline } from '../core/geometry';
import { MARK_LAYERS, type MarkLayer, type Moth } from '../generator/moth';

export type RenderMode = 'pattern' | 'silhouette' | 'structure';
export const RENDER_MODES: readonly RenderMode[] = ['pattern', 'silhouette', 'structure'];

const INK = '#292d29';
const STRUCTURE_FORE = '#ece5d6';
const STRUCTURE_HIND = '#d1c5ac';
const STRUCTURE_BODY = '#8d917a';
const BODY_INK = '#2b2f2a';
const BODY_CREASE = '#9ba18e';
/** One decimal is 0.1 units on a 380-wide viewBox: below half a pixel at any
 *  size these plates are read at, and it halves the file. */
const PRECISION = 1;
/** Wide enough for the largest specimen the generator can produce, so a small
 *  one reads as small rather than being scaled up to fill the frame. */
const VIEW_BOX = '0 0 380 320';
const ORIGIN = 'translate(190 160)';

interface LayerStyle {
  readonly width: number;
  readonly opacity: number;
  readonly filled: boolean;
}
/** Keyed in draw order: shading first, then pattern, with the outline last. */
const LAYER_STYLES: Record<MarkLayer, LayerStyle> = {
  shade: { width: 1.05, opacity: 0.66, filled: false },
  hatch: { width: 0.45, opacity: 0.56, filled: false },
  speckle: { width: 0.6, opacity: 0.62, filled: false },
  vein: { width: 0.45, opacity: 0.4, filled: false },
  band: { width: 0.85, opacity: 0.72, filled: false },
  eyespot: { width: 0.7, opacity: 0.82, filled: false },
  pupil: { width: 0.45, opacity: 0.85, filled: true },
  fringe: { width: 0.42, opacity: 0.55, filled: false },
  edge: { width: 1.05, opacity: 0.92, filled: false },
};

function subpath(points: Polyline, closed: boolean): string {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(PRECISION)},${y.toFixed(PRECISION)}`).join(' ')
    + (closed ? ' Z' : '');
}
/** One path per layer keeps the DOM small enough for a hundred specimens at once. */
function group(lines: readonly Polyline[], attributes: string): string {
  if (lines.length === 0) return '';
  return `<path ${attributes} d="${lines.map(line => subpath(line, false)).join(' ')}"/>`;
}

/**
 * The order a hand would work in, which is not the order the layers stack in.
 * Keeping the two apart lets the animation draw the outline first while the
 * shading still sits underneath it.
 */
const DRAW_ORDER: Record<MarkLayer, number> = {
  edge: 0, vein: 3, band: 4, eyespot: 5, pupil: 5, shade: 6, hatch: 7, speckle: 8, fringe: 9,
};
const BODY_ORDER = 1;
const ANTENNA_ORDER = 2;
const BRISTLE_ORDER = 10;
const CREASE_ORDER = 11;

/** One <path> of the inked view, in stacking order, with its drawing order. */
export interface InkLayer {
  readonly id: string;
  /** Everything but the `d`, so a caller can build the element and fill it in. */
  readonly attributes: string;
  readonly lines: readonly Polyline[];
  readonly order: number;
  /** A fill cannot be drawn stroke by stroke; it arrives once the layer is done. */
  readonly filled: boolean;
}

export function inkPlan(moth: Moth): readonly InkLayer[] {
  const layers: InkLayer[] = MARK_LAYERS.map(layer => {
    const style = LAYER_STYLES[layer];
    return {
      id: `mark-${layer}`,
      attributes: `fill="${style.filled ? INK : 'none'}" stroke-width="${style.width}" opacity="${style.opacity}"`,
      lines: moth.marks.filter(mark => mark.layer === layer).map(mark => mark.points),
      order: DRAW_ORDER[layer],
      filled: style.filled,
    };
  });
  layers.push(
    { id: 'bristles', attributes: 'fill="none" stroke-width="0.75" opacity="0.88"', lines: moth.bristles, order: BRISTLE_ORDER, filled: false },
    { id: 'antennae', attributes: 'fill="none" stroke-width="0.9"', lines: moth.antennae, order: ANTENNA_ORDER, filled: false },
    { id: 'body', attributes: `fill="${BODY_INK}" stroke-width="1.1"`, lines: moth.body, order: BODY_ORDER, filled: true },
    { id: 'creases', attributes: `fill="none" stroke="${BODY_CREASE}" stroke-width="0.5" opacity="0.62"`, lines: moth.bodyLines, order: CREASE_ORDER, filled: false },
  );
  return layers;
}

/** Wraps figure content in the shared frame, so static and animated views match. */
export function inkFrame(moth: Moth, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" role="img" aria-label="나방 ${moth.family} 표본">`
    + `<g transform="${ORIGIN}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">`
    + `${content}</g></svg>`;
}

export function subpathOf(points: Polyline): string {
  return subpath(points, false);
}

export function renderMoth(moth: Moth, mode: RenderMode = 'pattern'): string {
  if (mode === 'pattern') {
    return inkFrame(moth, inkPlan(moth)
      .map(layer => group(layer.lines, layer.attributes))
      .join(''));
  }
  // Inspection views keep their fills and show the wing shape before any wear.
  const wings = moth.wings
    .map((wing, index) => `<path d="${subpath(wing, true)}" fill="${
      mode === 'silhouette' ? INK : index < 2 ? STRUCTURE_HIND : STRUCTURE_FORE}"/>`).join('');
  const bristles = group(moth.bristles, 'fill="none" stroke-width="0.75" opacity="0.88"');
  const antennae = group(moth.antennae, 'fill="none" stroke-width="0.9"');
  const bodyFill = mode === 'structure' ? STRUCTURE_BODY : INK;
  const body = moth.body.map(shape => `<path d="${subpath(shape, true)}" fill="${bodyFill}"/>`).join('');
  const label = `나방 ${moth.family} ${mode === 'silhouette' ? '실루엣' : '구조'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" role="img" aria-label="${label}">`
    + `<g transform="${ORIGIN}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">`
    + `${wings}${bristles}${antennae}${body}</g></svg>`;
}
