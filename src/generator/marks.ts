import type { Polyline } from '../core/geometry';

/** Draw order and stroke weight follow this order in the renderer. */
export const MARK_LAYERS = ['shade', 'hatch', 'speckle', 'vein', 'band', 'eyespot', 'pupil', 'fringe', 'edge'] as const;
export type MarkLayer = typeof MARK_LAYERS[number];

/** Structure and pattern layers are mirrored; only these keep left/right asymmetry. */
export const TEXTURE_LAYERS: readonly MarkLayer[] = ['hatch', 'speckle', 'fringe'];
/** Layers that belong on or beyond the outline and so are never clipped to it. */
export const UNBOUNDED_LAYERS: readonly MarkLayer[] = ['fringe', 'edge'];

/** A mark before it is bound to a wing and clipped. */
export interface LayerLine {
  readonly layer: MarkLayer;
  readonly points: Polyline;
}

/** A mark already clipped to `wing` and to whatever overlaps it. */
export interface Mark {
  readonly layer: MarkLayer;
  /** Index into `Moth.wings`. */
  readonly wing: number;
  readonly points: Polyline;
}

/** Guards divisions by a local metric that can approach zero at a wing corner. */
export const MIN_METRIC = 1e-6;
