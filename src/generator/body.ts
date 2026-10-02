import { ellipse, type Point, type Polyline } from '../core/geometry';
import type { Dice } from '../core/random';

const EYE_SAMPLES = 24;
/** Eyes sit proud of the head outline; a moth that looks back is the unsettling part. */
const EYE_BULGE = 1.18;
const ABDOMEN_SAMPLES = 36;
/** Where the abdomen reaches its widest, as a share of its length. */
const ABDOMEN_WAIST = 0.16;
const LEG_SPINES = 3;
/** Hair starts this far in from the rim so the fill covers where it attaches. */
const HAIR_ROOT = 0.5;

interface LegPair {
  /** Seat on the thorax, from its front (-1) to its back (1). */
  readonly seat: number;
  readonly angle: readonly [number, number];
  readonly reach: readonly [number, number];
  /** Which way the knee folds; the front pair reaches forward past the costa. */
  readonly fold: number;
}
const LEG_PAIRS: readonly LegPair[] = [
  { seat: -0.55, angle: [-0.85, -0.52], reach: [26, 38], fold: -1 },
  { seat: 0, angle: [0.1, 0.45], reach: [22, 32], fold: 1 },
  { seat: 0.55, angle: [0.82, 1.15], reach: [24, 36], fold: 1 },
];

/** Every proportion of the body, so head, thorax and abdomen can vary apart. */
export interface BodyShape {
  readonly thoraxWidth: number;
  /** Half-height of the thorax. */
  readonly thoraxLength: number;
  readonly thoraxSeat: number;
  readonly headRadius: number;
  /** Half-height of the head. */
  readonly headHeight: number;
  readonly abdomenWidth: number;
  readonly abdomenLength: number;
  /** 0.35 a blunt grub, 1 an ellipse, 1.9 a long spindle. */
  readonly abdomenTaper: number;
}

export interface BodyParts {
  /** Filled shapes: abdomen, thorax, head and the two eyes. */
  readonly shapes: readonly Polyline[];
  /** Light strokes over the fill: abdomen creases and eye shine. */
  readonly creases: readonly Polyline[];
  /**
   * Hair and legs, in ink, drawn over the wings but under the body fill. Rooted
   * inside the outline so the fill hides their ends and only a ragged fringe
   * shows: that broken silhouette is what makes the body read as fur.
   */
  readonly bristles: readonly Polyline[];
}

/** Where the head sits, which is also where the antennae leave it. */
export function headSeatOf(shape: BodyShape): number {
  return shape.thoraxSeat - shape.thoraxLength - shape.headHeight * 0.35;
}
/** Front and back of the thorax, where the wings hinge. */
export function shoulderOf(shape: BodyShape): number {
  return shape.thoraxSeat - shape.thoraxLength * 0.55;
}
export function hipOf(shape: BodyShape): number {
  return shape.thoraxSeat + shape.thoraxLength * 0.78;
}
export function abdomenTopOf(shape: BodyShape): number {
  return shape.thoraxSeat + shape.thoraxLength * 0.15;
}

function disc(centre: Point, rx: number, ry: number): Polyline {
  return Array.from({ length: EYE_SAMPLES + 1 }, (_, index) => {
    const angle = (index / EYE_SAMPLES) * Math.PI * 2;
    return [centre[0] + Math.cos(angle) * rx, centre[1] + Math.sin(angle) * ry] as Point;
  });
}

/**
 * A profile that bulges just below the thorax and runs out to a point, so the
 * taper alone turns a stubby grub into a long spindle.
 */
function abdomen(halfWidth: number, length: number, taper: number, top: number): Polyline {
  const right: Point[] = [];
  const left: Point[] = [];
  for (let index = 0; index <= ABDOMEN_SAMPLES; index++) {
    const along = index / ABDOMEN_SAMPLES;
    const girth = halfWidth * Math.sin(Math.PI * (ABDOMEN_WAIST + (1 - ABDOMEN_WAIST) * along)) ** taper;
    const y = top + length * along;
    right.push([girth, y]);
    left.push([-girth, y]);
  }
  return [...right, ...left.reverse(), right[0]!];
}

/**
 * One leg: femur out from the thorax, a knee, then a tibia angled back with a
 * hooked tarsus. Short spines along the femur read as bristles at plate size.
 */
function leg(pair: LegPair, originY: number, angle: number, reach: number, dice: Dice): Polyline[] {
  const root: Point = [2, originY];
  const knee: Point = [Math.cos(angle) * reach * 0.58, originY + Math.sin(angle) * reach * 0.58];
  const bend = angle + pair.fold * dice.range(0.35, 0.85);
  const foot: Point = [knee[0] + Math.cos(bend) * reach * 0.5, knee[1] + Math.sin(bend) * reach * 0.5];
  const hook: Point = [foot[0] + Math.cos(bend - 0.9) * reach * 0.16, foot[1] + Math.sin(bend - 0.9) * reach * 0.16];
  const limb: Polyline = [root, knee, foot, hook];
  const spines: Polyline[] = Array.from({ length: LEG_SPINES }, (_, index) => {
    const along = (index + 1) / (LEG_SPINES + 1);
    const base: Point = [root[0] + (knee[0] - root[0]) * along, root[1] + (knee[1] - root[1]) * along];
    const spine = dice.range(1.8, 3.4);
    return [base, [base[0] - Math.sin(angle) * spine, base[1] + Math.cos(angle) * spine]] as Polyline;
  });
  return [limb, ...spines];
}

export function buildBody(shape: BodyShape, fur: number, dice: Dice): BodyParts {
  const { thoraxWidth, thoraxLength, thoraxSeat, headRadius, headHeight, abdomenWidth, abdomenLength } = shape;
  const headSeat = headSeatOf(shape);
  const abdomenTop = abdomenTopOf(shape);
  const abdomenMiddle = abdomenTop + abdomenLength / 2;
  const eyeRadius = headRadius * 0.66;
  const eyeX = headRadius * EYE_BULGE * 0.72;
  const eyeSeat = headSeat - headHeight * 0.12;
  const shapes: Polyline[] = [
    abdomen(abdomenWidth, abdomenLength, shape.abdomenTaper, abdomenTop),
    ellipse(thoraxWidth, thoraxLength, thoraxSeat),
    ellipse(headRadius, headHeight, headSeat),
    disc([eyeX, eyeSeat], eyeRadius, eyeRadius * 1.1),
    disc([-eyeX, eyeSeat], eyeRadius, eyeRadius * 1.1),
  ];

  const creases: Polyline[] = [];
  // Abdomen creases cross the midline, so they stay symmetric by construction.
  const segments = dice.int(5, 8);
  for (let index = 1; index <= segments; index++) {
    const along = index / (segments + 1);
    const girth = abdomenWidth * Math.sin(Math.PI * (ABDOMEN_WAIST + (1 - ABDOMEN_WAIST) * along)) ** shape.abdomenTaper;
    const half = girth * 0.84;
    const y = abdomenTop + abdomenLength * along;
    creases.push([[-half, y - 0.6], [0, y + 0.9], [half, y - 0.6]]);
  }
  for (const side of [1, -1]) {
    creases.push([
      [side * eyeX - eyeRadius * 0.34, eyeSeat - 1.4],
      [side * eyeX + eyeRadius * 0.1, eyeSeat - 2.1],
    ]);
  }

  const bristles: Polyline[] = [];
  // Dense tufts are what make the body read as fur rather than a painted shape.
  const tufts = Math.round(dice.int(64, 94) * fur);
  for (let index = 0; index < tufts; index++) {
    const angle = dice.range(0, Math.PI * 2);
    const onHead = dice.chance(0.22);
    const onAbdomen = !onHead && dice.chance(0.34);
    const rimX = onHead ? headRadius : onAbdomen ? abdomenWidth : thoraxWidth;
    const rimY = onHead ? headHeight : onAbdomen ? abdomenLength / 2 : thoraxLength;
    const seat = onHead ? headSeat : onAbdomen ? abdomenMiddle : thoraxSeat;
    // Rooted inside the outline so the body fill swallows the root of the hair.
    const root: Point = [Math.cos(angle) * rimX * HAIR_ROOT, seat + Math.sin(angle) * rimY * HAIR_ROOT];
    const outward = Math.hypot(Math.cos(angle) / rimX, Math.sin(angle) / rimY) || 1;
    const reach = dice.range(6, onAbdomen ? 11 : 17) * fur;
    const curl = dice.range(-1.2, 1.2);
    const tip: Point = [
      root[0] + ((Math.cos(angle) / rimX) / outward) * reach + curl,
      root[1] + ((Math.sin(angle) / rimY) / outward) * reach,
    ];
    bristles.push([root, [(root[0] + tip[0]) / 2 + curl * 0.6, (root[1] + tip[1]) / 2], tip]);
  }

  for (const pair of LEG_PAIRS) {
    const angle = dice.range(pair.angle[0], pair.angle[1]);
    const reach = dice.range(pair.reach[0], pair.reach[1]);
    const originY = thoraxSeat + thoraxLength * pair.seat;
    for (const limb of leg(pair, originY, angle, reach, dice)) {
      bristles.push(limb, limb.map(([x, y]) => [-x, y]));
    }
  }
  return { shapes, creases, bristles };
}
