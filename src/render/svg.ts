import type { Polyline } from '../core/geometry';
import { MARK_LAYERS, type MarkLayer, type Moth } from '../generator/moth';

export type RenderMode = 'pattern' | 'silhouette' | 'structure';
export const RENDER_MODES: readonly RenderMode[] = ['pattern', 'silhouette', 'structure'];

const INK = '#292d29';
const PAPER_FORE = '#f7f3e7';
const PAPER_HIND = '#e6dfcc';
const STRUCTURE_FORE = '#ece5d6';
const STRUCTURE_HIND = '#d1c5ac';
const STRUCTURE_BODY = '#8d917a';
const BODY_INK = '#31362f';
const BODY_CREASE = '#9ba18e';
/** Two decimals is 0.01 units on a 340-wide viewBox; enough, and half the file size. */
const PRECISION = 2;

interface LayerStyle {
  readonly width: number;
  readonly opacity: number;
  readonly filled: boolean;
}
/** Large silhouette first, mid-scale pattern next, fine texture last. */
const LAYER_STYLES: Record<MarkLayer, LayerStyle> = {
  vein: { width: 0.5, opacity: 0.42, filled: false },
  band: { width: 0.95, opacity: 0.8, filled: false },
  eyespot: { width: 0.75, opacity: 0.85, filled: false },
  pupil: { width: 0.5, opacity: 0.8, filled: true },
  hatch: { width: 0.4, opacity: 0.38, filled: false },
  speckle: { width: 0.55, opacity: 0.5, filled: false },
  fringe: { width: 0.42, opacity: 0.5, filled: false },
};

function subpath(points: Polyline, closed: boolean): string {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(PRECISION)},${y.toFixed(PRECISION)}`).join(' ')
    + (closed ? ' Z' : '');
}
/** One path per layer keeps the DOM small enough for a hundred specimens at once. */
function group(lines: readonly Polyline[], closed: boolean, attributes: string): string {
  if (lines.length === 0) return '';
  return `<path ${attributes} d="${lines.map(line => subpath(line, closed)).join(' ')}"/>`;
}

function markLayers(moth: Moth): string {
  return MARK_LAYERS.map(layer => {
    const lines = moth.marks.filter(mark => mark.layer === layer).map(mark => mark.points);
    const style = LAYER_STYLES[layer];
    return group(lines, false, `fill="${style.filled ? INK : 'none'}" stroke-width="${style.width}" opacity="${style.opacity}"`);
  }).join('');
}

export function renderMoth(moth: Moth, mode: RenderMode = 'pattern'): string {
  const wingFill = (index: number): string => {
    if (mode === 'silhouette') return INK;
    if (mode === 'structure') return index < 2 ? STRUCTURE_HIND : STRUCTURE_FORE;
    return index < 2 ? PAPER_HIND : PAPER_FORE;
  };
  const inked = mode === 'pattern';
  const wings = moth.wings.map((wing, index) => `<path d="${subpath(wing, true)}" fill="${wingFill(index)}"/>`).join('');
  const bodyFill = mode === 'structure' ? STRUCTURE_BODY : mode === 'silhouette' ? INK : BODY_INK;
  const body = moth.body.map(shape => `<path d="${subpath(shape, true)}" fill="${bodyFill}"/>`).join('');
  const antennae = group(moth.antennae, false, 'fill="none"');
  // Body creases sit on the dark body fill, so they need a lighter stroke than the wings.
  const creases = inked
    ? group(moth.bodyLines, false, `fill="none" stroke="${BODY_CREASE}" stroke-width="0.45" opacity="0.6"`)
    : '';
  const label = `나방 ${moth.family} ${mode === 'silhouette' ? '실루엣' : '표본'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 260" role="img" aria-label="${label}">`
    + `<g transform="translate(170 116)" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">`
    + `${wings}${inked ? markLayers(moth) : ''}${antennae}${body}${creases}</g></svg>`;
}
