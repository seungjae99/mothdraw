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
/** One decimal is 0.1 units on a 340-wide viewBox: below half a pixel at any
 *  size these plates are read at, and it halves the file. */
const PRECISION = 1;

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

function markLayers(moth: Moth): string {
  return MARK_LAYERS.map(layer => {
    const lines = moth.marks.filter(mark => mark.layer === layer).map(mark => mark.points);
    const style = LAYER_STYLES[layer];
    return group(lines, `fill="${style.filled ? INK : 'none'}" stroke-width="${style.width}" opacity="${style.opacity}"`);
  }).join('');
}

export function renderMoth(moth: Moth, mode: RenderMode = 'pattern'): string {
  const inked = mode === 'pattern';
  // The inked view is line only, so the outline arrives as an `edge` mark that
  // the hindwing shares with every other mark it hides under the forewing.
  const wings = inked ? '' : moth.wings
    .map((wing, index) => `<path d="${subpath(wing, true)}" fill="${
      mode === 'silhouette' ? INK : index < 2 ? STRUCTURE_HIND : STRUCTURE_FORE}"/>`).join('');
  const bristles = group(moth.bristles, 'fill="none" stroke-width="0.75" opacity="0.88"');
  const antennae = group(moth.antennae, 'fill="none" stroke-width="0.9"');
  const bodyFill = mode === 'structure' ? STRUCTURE_BODY : inked ? BODY_INK : INK;
  const body = moth.body.map(shape => `<path d="${subpath(shape, true)}" fill="${bodyFill}"/>`).join('');
  // Creases and hair sit on the dark body, so they need a lighter stroke.
  const creases = inked
    ? group(moth.bodyLines, `fill="none" stroke="${BODY_CREASE}" stroke-width="0.5" opacity="0.62"`)
    : '';
  const label = `나방 ${moth.family} ${mode === 'silhouette' ? '실루엣' : '표본'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 260" role="img" aria-label="${label}">`
    + `<g transform="translate(170 116)" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">`
    + `${wings}${inked ? markLayers(moth) : ''}${bristles}${antennae}${body}${creases}</g></svg>`;
}
