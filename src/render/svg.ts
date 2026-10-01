import type { Polyline } from '../core/geometry';
import type { Moth } from '../generator/moth';
export type RenderMode = 'silhouette' | 'structure';
function path(points: Polyline, closed: boolean): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ') + (closed ? ' Z' : '');
}
export function renderMoth(moth: Moth, mode: RenderMode = 'silhouette'): string {
  const structure = mode === 'structure';
  const shapes = moth.wings.map((wing, i) => `<path d="${path(wing, true)}" fill="${structure ? (i < 2 ? '#d1c5ac' : '#ece5d6') : '#292d29'}"/>`).join('');
  const body = moth.body.map(shape => `<path d="${path(shape, true)}" fill="${structure ? '#8d917a' : '#292d29'}"/>`).join('');
  const antennae = moth.antennae.map(line => `<path d="${path(line, false)}" fill="none"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 260" role="img" aria-label="나방 ${moth.family} 실루엣"><g transform="translate(170 116)" stroke="#292d29" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">${shapes}${antennae}${body}</g></svg>`;
}
