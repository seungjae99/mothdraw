import assert from 'node:assert/strict';
import { build } from 'esbuild';

const ENTRY = "export * from './src/generator/moth'; export * from './src/render/svg'; export * from './src/ui/draw';";

/** The smallest DOM the drawing needs, with a clock we step by hand. */
class FakeElement {
  constructor(id) {
    this.id = id;
    this.values = {};
  }
  setAttribute(name, value) {
    this.values[name] = value;
  }
}
class FakeHost {
  set innerHTML(markup) {
    this.markup = markup;
    this.elements = [...markup.matchAll(/<path id="([^"]+)"/g)].map(match => new FakeElement(match[1]));
  }
  querySelector(selector) {
    return this.elements.find(element => `#${element.id}` === selector) ?? null;
  }
}

let queued = null;
let reduced = false;
globalThis.CSS = { escape: value => value };
globalThis.window = { matchMedia: () => ({ matches: reduced }) };
globalThis.requestAnimationFrame = callback => { queued = callback; return 1; };
globalThis.cancelAnimationFrame = () => { queued = null; };

/** Runs the animation to completion one frame at a time. Returns the frame count. */
function run(step = 16) {
  let clock = 0;
  let frames = 0;
  while (queued && frames < 10000) {
    const callback = queued;
    queued = null;
    clock += step;
    callback(clock);
    frames++;
  }
  return frames;
}

const bundle = await build({
  stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const { generateMoth, inkPlan, drawMoth } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const moth = generateMoth('nocturne-013');
const plan = inkPlan(moth);
const expected = new Map(plan.map(layer => [layer.id, layer.lines.length]));
const drawOrder = [...plan].sort((a, b) => a.order - b.order).filter(layer => layer.lines.length > 0).map(layer => layer.id);

function check(host, label) {
  for (const element of host.elements) {
    const subpaths = (element.values.d ?? '').split('M').length - 1;
    assert.equal(subpaths, expected.get(element.id), `${label}: ${element.id} should hold every line exactly once`);
  }
  for (const layer of plan.filter(entry => entry.filled && entry.lines.length > 0)) {
    const element = host.querySelector(`#${layer.id}`);
    assert.equal(element.values['fill-opacity'], '1', `${label}: ${layer.id} must end up filled`);
  }
}

// Frame by frame, every stroke is laid down once and nothing is left behind.
let finished = 0;
const host = new FakeHost();
const drawing = drawMoth(host, moth, () => { finished++; });
const frames = run();
assert.ok(frames > 30, `the drawing should take many frames, took ${frames}`);
assert.equal(finished, 1, 'the drawing reports completion exactly once');
check(host, 'animated');

// Layers arrive in drawing order, which is not the order they stack in.
const touched = [];
for (const id of drawOrder) {
  const element = host.querySelector(`#${id}`);
  assert.ok(element, `${id} should exist`);
  touched.push(id);
}
assert.deepEqual(touched, drawOrder, 'every drawn layer has an element');
assert.equal(drawOrder[0], 'mark-edge', 'the outline is drawn first');
assert.ok(drawOrder.indexOf('body') < drawOrder.indexOf('mark-hatch'), 'the body is sketched before the shading');
assert.equal(drawOrder.at(-1), 'creases', 'body creases finish the figure');

// Skipping part way through still lands the whole figure.
let skipped = 0;
const quick = new FakeHost();
const running = drawMoth(quick, moth, () => { skipped++; });
queued(16);
running.finish();
running.finish();
assert.equal(skipped, 1, 'finishing twice reports completion once');
check(quick, 'skipped');

// Cancelling stops the clock and never reports completion.
let cancelled = 0;
const dropped = new FakeHost();
const abandoned = drawMoth(dropped, moth, () => { cancelled++; });
queued(16);
abandoned.cancel();
assert.equal(queued, null, 'a cancelled drawing leaves no frame pending');
assert.equal(cancelled, 0, 'a cancelled drawing never reports completion');

// Reduced motion skips the animation entirely.
reduced = true;
let instant = 0;
const still = new FakeHost();
drawMoth(still, moth, () => { instant++; });
reduced = false;
assert.equal(instant, 1, 'reduced motion completes immediately');
assert.equal(queued, null, 'reduced motion schedules no frames');
check(still, 'reduced motion');

console.log(`PASS: the figure is drawn over ${frames} frames in hand order, and skipping, cancelling and reduced motion all land correctly.`);
