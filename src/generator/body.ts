import { ellipse, type Point, type Polyline } from '../core/geometry';
import type { Dice } from '../core/random';

const EYE_SAMPLES = 24;
/** Eyes sit proud of the head outline; a moth that looks back is the unsettling part. */
const EYE_BULGE = 1.18;
interface LegPair {
  readonly originY: number;
  readonly angle: readonly [number, number];
  readonly reach: readonly [number, number];
  /** Which way the knee folds; the front pair reaches forward past the costa. */
  readonly fold: number;
}
const LEG_PAIRS: readonly LegPair[] = [
  { originY: -12, angle: [-0.85, -0.52], reach: [26, 38], fold: -1 },
  { originY: -1, angle: [0.1, 0.45], reach: [22, 32], fold: 1 },
  { originY: 9, angle: [0.82, 1.15], reach: [24, 36], fold: 1 },
];
const LEG_SPINES = 3;
/** Hair starts this far in from the rim so the fill covers where it attaches. */
const HAIR_ROOT = 0.5;

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

function disc(centre: Point, rx: number, ry: number): Polyline {
  return Array.from({ length: EYE_SAMPLES + 1 }, (_, index) => {
    const angle = (index / EYE_SAMPLES) * Math.PI * 2;
    return [centre[0] + Math.cos(angle) * rx, centre[1] + Math.sin(angle) * ry] as Point;
  });
}

/**
 * One leg: femur out from the thorax, a knee, then a tibia angled back with a
 * hooked tarsus. Short spines along the femur read as bristles at plate size.
 */
function leg(pair: LegPair, angle: number, reach: number, dice: Dice): Polyline[] {
  const originY = pair.originY;
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

export function buildBody(thoraxWidth: number, bodyLength: number, dice: Dice): BodyParts {
  const headRadius = thoraxWidth * 0.69;
  const eyeRadius = headRadius * 0.66;
  const eyeX = headRadius * EYE_BULGE * 0.72;
  const shapes: Polyline[] = [
    ellipse(thoraxWidth * 0.73, bodyLength / 2, bodyLength / 2 + 1),
    ellipse(thoraxWidth, 18, -2),
    ellipse(headRadius, 8, -22),
    disc([eyeX, -23], eyeRadius, eyeRadius * 1.1),
    disc([-eyeX, -23], eyeRadius, eyeRadius * 1.1),
  ];

  const creases: Polyline[] = [];
  // Abdomen creases cross the midline, so they stay symmetric by construction.
  const rx = thoraxWidth * 0.73;
  const ry = bodyLength / 2;
  const centre = ry + 1;
  const segments = dice.int(5, 8);
  for (let index = 1; index <= segments; index++) {
    const y = centre - ry + (2 * ry * index) / (segments + 1);
    const half = rx * Math.sqrt(Math.max(0, 1 - ((y - centre) / ry) ** 2)) * 0.84;
    creases.push([[-half, y - 0.6], [0, y + 0.9], [half, y - 0.6]]);
  }
  for (const side of [1, -1]) {
    creases.push([[side * eyeX - eyeRadius * 0.34, -24.4], [side * eyeX + eyeRadius * 0.1, -25.1]]);
  }
  const bristles: Polyline[] = [];
  // Dense tufts are what make the body read as fur rather than a painted shape.
  const tufts = dice.int(64, 94);
  for (let index = 0; index < tufts; index++) {
    const angle = dice.range(0, Math.PI * 2);
    const onHead = dice.chance(0.22);
    const onAbdomen = !onHead && dice.chance(0.34);
    const rimX = onHead ? headRadius : onAbdomen ? rx : thoraxWidth;
    const rimY = onHead ? 8 : onAbdomen ? ry : 18;
    const seat = onHead ? -22 : onAbdomen ? centre : -2;
    // Rooted inside the outline so the body fill swallows the root of the hair.
    const root: Point = [Math.cos(angle) * rimX * HAIR_ROOT, seat + Math.sin(angle) * rimY * HAIR_ROOT];
    const outward = Math.hypot(Math.cos(angle) / rimX, Math.sin(angle) / rimY) || 1;
    const reach = dice.range(6, onAbdomen ? 11 : 17);
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
    for (const limb of leg(pair, angle, reach, dice)) {
      bristles.push(limb, limb.map(([x, y]) => [-x, y]));
    }
  }
  return { shapes, creases, bristles };
}
