import assert from 'node:assert/strict';
import { build } from 'esbuild';

const ENTRY = "export * from './src/generator/moth'; export * from './src/core/geometry';";
const bundle = await build({
  stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const { generateMoth, FAMILIES, MARK_LAYERS, TEXTURE_LAYERS, SPECIMEN_SEEDS, SURVEY_SEEDS, pointInPolygon } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

/** Line counts stay well under these so a runaway loop fails loudly. */
const MAX_MARKS = 700;
const MAX_MARK_POINTS = 3200;
/** Fringe crosses the margin; nothing may drift further than one stroke away. */
const MAX_FRINGE_CLEARANCE = 5;
const PATTERN_LAYERS = MARK_LAYERS.filter(layer => !TEXTURE_LAYERS.includes(layer));

const specimens = SPECIMEN_SEEDS.map(generateMoth);
const stress = Array.from({ length: 200 }, (_, index) => generateMoth(`stress-${index}`));
const all = [...specimens, ...stress];
/** The slower geometric checks run on a representative subset. */
const sampled = [...specimens, ...stress.slice(0, 40)];

const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const intersects = (a, b, c, d) =>
  cross(a, b, c) * cross(a, b, d) < -1e-8 && cross(c, d, a) * cross(c, d, b) < -1e-8;
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const flip = line => line.map(([x, y]) => [-x, y]);
const marksOn = (moth, wing, layers) =>
  moth.marks.filter(mark => mark.wing === wing && layers.includes(mark.layer)).map(mark => mark.points);

function distanceToOutline(point, outline) {
  let best = Infinity;
  for (let index = 0; index < outline.length - 1; index++) {
    const [ax, ay] = outline[index];
    const [bx, by] = outline[index + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / length));
    best = Math.min(best, Math.hypot(point[0] - ax - dx * t, point[1] - ay - dy * t));
  }
  return best;
}

// Structure: unchanged invariants from the silhouette stage.
for (const moth of all) {
  assert.deepEqual(moth, generateMoth(moth.seed), `${moth.seed}: seed must reproduce all geometry`);
  const lines = [...moth.wings, ...moth.body, ...moth.antennae, ...moth.bodyLines, ...moth.marks.map(m => m.points)];
  for (const line of lines) {
    for (const [x, y] of line) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 160 && y > -106 && y < 134,
        `${moth.seed}: viewport bounds`);
    }
  }
  for (const wing of moth.wings) {
    assert.deepEqual(wing[0], wing.at(-1), 'closed contour');
    assert.ok(Math.abs(wing[0][0]) < 6, 'root must enter thorax');
    for (let i = 0; i < wing.length - 1; i++) {
      for (let j = i + 2; j < wing.length - 1; j++) {
        if (i === 0 && j === wing.length - 2) continue;
        assert.ok(!intersects(wing[i], wing[i + 1], wing[j], wing[j + 1]),
          `${moth.seed}: wing self-intersection ${i}/${j}`);
      }
    }
  }
  for (const [a, b] of [[0, 1], [2, 3]]) {
    assert.deepEqual(flip(moth.wings[a]), moth.wings[b], 'bilateral symmetry');
  }

  // Pattern: bounded line counts and well-formed marks.
  assert.ok(moth.marks.length > 0 && moth.marks.length <= MAX_MARKS, `${moth.seed}: mark count ${moth.marks.length}`);
  const points = moth.marks.reduce((total, mark) => total + mark.points.length, 0);
  assert.ok(points <= MAX_MARK_POINTS, `${moth.seed}: mark point count ${points}`);
  for (const mark of moth.marks) {
    assert.ok(MARK_LAYERS.includes(mark.layer), `${moth.seed}: unknown layer ${mark.layer}`);
    assert.ok(mark.wing >= 0 && mark.wing < moth.wings.length, `${moth.seed}: mark wing index`);
    assert.ok(mark.points.length > 1, `${moth.seed}: degenerate mark`);
  }
}

// Pattern containment, occlusion and symmetry.
for (const moth of sampled) {
  for (const mark of moth.marks) {
    const own = moth.wings[mark.wing];
    const covering = mark.wing < 2 ? moth.wings[mark.wing + 2] : null;
    for (let index = 0; index < mark.points.length - 1; index++) {
      // Clipped endpoints land on the outline, so containment is read at midpoints.
      const inner = midpoint(mark.points[index], mark.points[index + 1]);
      if (mark.layer !== 'fringe') {
        assert.ok(pointInPolygon(inner, own), `${moth.seed}: ${mark.layer} outside its wing`);
      }
      if (covering) {
        assert.ok(!pointInPolygon(inner, covering), `${moth.seed}: ${mark.layer} runs through the forewing`);
      }
    }
  }
  for (const [a, b] of [[0, 1], [2, 3]]) {
    assert.deepEqual(marksOn(moth, a, PATTERN_LAYERS).map(flip), marksOn(moth, b, PATTERN_LAYERS),
      `${moth.seed}: pattern must be bilaterally symmetric`);
    assert.notDeepEqual(marksOn(moth, a, TEXTURE_LAYERS).map(flip), marksOn(moth, b, TEXTURE_LAYERS),
      `${moth.seed}: texture must differ between sides`);
  }
}

// Fringe deliberately leaves the wing, but only by one stroke.
for (const moth of specimens) {
  for (const mark of moth.marks.filter(entry => entry.layer === 'fringe')) {
    for (const point of mark.points) {
      const clearance = distanceToOutline(point, moth.wings[mark.wing]);
      assert.ok(clearance <= MAX_FRINGE_CLEARANCE, `${moth.seed}: fringe drifted ${clearance.toFixed(2)} from the margin`);
    }
  }
}

assert.equal(new Set(specimens.map(m => JSON.stringify(m.wings))).size, 20, '20 unique silhouettes');
assert.equal(new Set(SURVEY_SEEDS).size, 100, '100 unique survey seeds');
assert.deepEqual(SURVEY_SEEDS.slice(0, 20), SPECIMEN_SEEDS, 'the fixed plate is a prefix of the survey');
assert.equal(new Set(specimens.map(m => m.family)).size, FAMILIES.length, 'all families represented');
assert.ok(specimens.every(m => new Set(m.marks.map(mark => mark.layer)).size >= 5), 'every specimen carries most layers');
assert.throws(() => generateMoth('  '));
assert.throws(() => generateMoth('x'.repeat(161)));

const totalMarks = all.reduce((sum, moth) => sum + moth.marks.length, 0);
console.log('PASS: 20 fixed + 200 stress seeds; deterministic, finite, bounded, closed, non-self-intersecting, connected roots and bilateral symmetry.');
console.log(`PASS: marks clipped to their wing, hidden under the forewing, mirrored pattern and per-side texture (${Math.round(totalMarks / all.length)} lines per specimen).`);
console.log('Families:', Object.fromEntries(FAMILIES.map(f => [f, specimens.filter(m => m.family === f).length])));
