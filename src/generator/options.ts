import { FAMILIES, type Family } from './family';

/** `any` leaves the choice to the seed. */
export type FamilyChoice = Family | 'any';

export interface MothOptions {
  readonly family: FamilyChoice;
  /** 0 bare, 1 crowded. */
  readonly density: number;
  /** 0 orderly, 1 deformed. */
  readonly strangeness: number;
}

/** Both dials sit at the middle, which reproduces the reference plate. */
export const DEFAULT_OPTIONS: MothOptions = { family: 'any', density: 0.5, strangeness: 0.5 };
/** Dials are rounded to this many steps so a stored record reproduces exactly. */
const STEPS = 100;

function dialed(value: unknown, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.min(Math.max(number, 0), 1) * STEPS) / STEPS;
}

export function normalizeOptions(input?: Partial<MothOptions>): MothOptions {
  const family = input?.family;
  const known = family === 'any' || (typeof family === 'string' && (FAMILIES as readonly string[]).includes(family));
  return {
    family: known ? family as FamilyChoice : DEFAULT_OPTIONS.family,
    density: dialed(input?.density, DEFAULT_OPTIONS.density),
    strangeness: dialed(input?.strangeness, DEFAULT_OPTIONS.strangeness),
  };
}

/**
 * Multipliers the generator applies. Every one of them is 1 at the middle of
 * both dials, so the defaults reproduce the plate exactly.
 */
export interface Dials {
  /** Count multiplier for veins, bands, shading, speckles and fringe. */
  readonly marks: number;
  readonly tremor: number;
  /** Size of a bite out of the margin. */
  readonly wear: number;
  /** Likelihood of one; zero at an orderly setting, so a tidy specimen stays whole. */
  readonly wearChance: number;
  readonly eyes: number;
  /** How far proportions are pushed away from the middle of their range. */
  readonly extremes: number;
  readonly fur: number;
}

export function dials(options: MothOptions): Dials {
  const { density, strangeness } = options;
  return {
    marks: 0.3 + 1.4 * density,
    tremor: 0.4 + 1.2 * strangeness,
    wear: 0.5 + strangeness,
    wearChance: Math.max(0, 2.8 * strangeness - 0.4),
    eyes: 0.6 + 0.8 * strangeness,
    extremes: 0.65 + 0.7 * strangeness,
    fur: 0.5 + strangeness,
  };
}

/** Scales a count range, never below `floor`. */
export function scaleRange(range: readonly [number, number], factor: number, floor: number): readonly [number, number] {
  const low = Math.max(floor, Math.round(range[0] * factor));
  return [low, Math.max(low, Math.round(range[1] * factor))];
}
