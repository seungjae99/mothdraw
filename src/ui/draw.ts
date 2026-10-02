import type { Point, Polyline } from '../core/geometry';
import type { Moth } from '../generator/moth';
import { inkFrame, inkPlan, subpathOf } from '../render/svg';

/** Units of ink laid down per second; pacing by length, not by stroke count,
 *  is what makes a long outline take time and a speckle flick past. */
const SPEED = 2800;
const FILL_FADE = '0.45s';

export interface Drawing {
  /** Jump to the finished figure. Safe to call more than once. */
  finish(): void;
  cancel(): void;
}

interface Stroke {
  readonly element: SVGPathElement;
  readonly points: Polyline;
  readonly length: number;
}

function lengthOf(points: Polyline): number {
  let total = 0;
  for (let index = 0; index < points.length - 1; index++) {
    total += Math.hypot(points[index + 1]![0] - points[index]![0], points[index + 1]![1] - points[index]![1]);
  }
  return total;
}

/** The part of a stroke laid down so far. */
function prefix(points: Polyline, reach: number): Polyline {
  const drawn: Point[] = [points[0]!];
  let used = 0;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index]!;
    const b = points[index + 1]!;
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (used + span >= reach) {
      const t = span === 0 ? 0 : (reach - used) / span;
      drawn.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      return drawn;
    }
    used += span;
    drawn.push(b);
  }
  return drawn;
}

export function drawMoth(host: HTMLElement, moth: Moth, onDone: () => void): Drawing {
  const plan = inkPlan(moth);
  host.innerHTML = inkFrame(moth, plan.map(layer =>
    `<path id="${layer.id}" ${layer.attributes}`
    + (layer.filled ? ` fill-opacity="0" style="transition:fill-opacity ${FILL_FADE}"` : '')
    + ' d=""/>').join(''));

  // Layers stack in plan order but are drawn in the order a hand would work in.
  const ordered = [...plan].sort((a, b) => a.order - b.order);
  const strokes: Stroke[] = [];
  const pending = new Map<SVGPathElement, number>();
  const fills: SVGPathElement[] = [];
  for (const layer of ordered) {
    const element = host.querySelector<SVGPathElement>(`#${CSS.escape(layer.id)}`);
    if (!element) continue;
    if (layer.filled) fills.push(element);
    for (const points of layer.lines) {
      strokes.push({ element, points, length: lengthOf(points) });
      pending.set(element, (pending.get(element) ?? 0) + 1);
    }
  }

  const buffers = new Map<SVGPathElement, string>();
  const commit = (stroke: Stroke): void => {
    buffers.set(stroke.element, (buffers.get(stroke.element) ?? '') + subpathOf(stroke.points) + ' ');
    const left = (pending.get(stroke.element) ?? 1) - 1;
    pending.set(stroke.element, left);
    if (left === 0 && fills.includes(stroke.element)) stroke.element.setAttribute('fill-opacity', '1');
  };

  let index = 0;
  let consumed = 0;
  let drawn = 0;
  let last = 0;
  let frame = 0;
  let done = false;

  const finish = (): void => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    while (index < strokes.length) commit(strokes[index++]!);
    for (const [element, buffer] of buffers) element.setAttribute('d', buffer);
    for (const element of fills) element.setAttribute('fill-opacity', '1');
    onDone();
  };

  const step = (now: number): void => {
    if (last === 0) last = now;
    drawn += ((now - last) / 1000) * SPEED;
    last = now;
    const touched = new Set<SVGPathElement>();
    while (index < strokes.length && consumed + strokes[index]!.length <= drawn) {
      const stroke = strokes[index]!;
      consumed += stroke.length;
      commit(stroke);
      touched.add(stroke.element);
      index++;
    }
    if (index >= strokes.length) {
      for (const element of touched) element.setAttribute('d', buffers.get(element) ?? '');
      finish();
      return;
    }
    const stroke = strokes[index]!;
    touched.add(stroke.element);
    const partial = subpathOf(prefix(stroke.points, drawn - consumed));
    for (const element of touched) {
      const buffer = buffers.get(element) ?? '';
      element.setAttribute('d', element === stroke.element ? buffer + partial : buffer);
    }
    frame = requestAnimationFrame(step);
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish();
  } else {
    frame = requestAnimationFrame(step);
  }
  return {
    finish,
    cancel: () => {
      done = true;
      cancelAnimationFrame(frame);
    },
  };
}
