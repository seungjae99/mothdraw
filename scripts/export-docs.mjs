import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ENTRY = "export * from './src/generator/moth'; export * from './src/render/svg';";
const bundle = await build({
  stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const { generateMoth, FAMILY_LABELS, inkFrame, inkPlan, renderMoth, subpathOf } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const PAPER = '#f3f0e7';
const TILE = '#f9f7f0';
const RULE = '#d8d7ca';
const LABEL = '#747b6b';
/** Matches the generator's own frame. */
const FIGURE = { width: 380, height: 320 };

function strip(entries, { tileWidth, tileHeight, gap = 14, margin = 18 }) {
  const width = margin * 2 + entries.length * tileWidth + (entries.length - 1) * gap;
  const height = margin * 2 + tileHeight;
  const tiles = entries.map((entry, index) => {
    const x = margin + index * (tileWidth + gap);
    const art = renderMoth(entry.moth, 'pattern')
      .replace('<svg ', `<svg x="6" y="4" width="${tileWidth - 12}" height="${tileHeight - 26}" `);
    return `<g transform="translate(${x} ${margin})">`
      + `<rect width="${tileWidth}" height="${tileHeight}" fill="${TILE}" stroke="${RULE}"/>`
      + art
      + `<text x="${tileWidth / 2}" y="${tileHeight - 9}" text-anchor="middle" font-size="9" fill="${LABEL}">${entry.label}</text>`
      + `</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<rect width="${width}" height="${height}" fill="${PAPER}"/>`
    + `<g font-family="Arial,sans-serif">${tiles}</g></svg>`;
}

function lengthOf(points) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index++) {
    total += Math.hypot(points[index + 1][0] - points[index][0], points[index + 1][1] - points[index][1]);
  }
  return total;
}

/**
 * The figure drawing itself, as a looping CSS animation so it plays wherever the
 * file is shown as an image. Strokes are bucketed by ink length, the same pacing
 * the app uses, and each bucket is one keyframe rule rather than one per stroke.
 *
 * Nothing is hidden by a presentation attribute, so a renderer that ignores the
 * animation shows the finished specimen instead of a blank frame.
 */
function drawing(moth, { draw = 6.5, hold = 2.5, buckets = 80 }) {
  const cycle = draw + hold;
  const ordered = [...inkPlan(moth)].sort((a, b) => a.order - b.order);
  const strokes = [];
  for (const layer of ordered) {
    for (const points of layer.lines) strokes.push({ layer, points, length: lengthOf(points) });
  }
  const total = strokes.reduce((sum, stroke) => sum + stroke.length, 0);

  // Group by (bucket, layer): one path per group keeps the file small, and every
  // stroke in a group shares the same slice of time anyway.
  const groups = new Map();
  let used = 0;
  for (const stroke of strokes) {
    const slot = Math.min(buckets - 1, Math.floor(((used + stroke.length / 2) / total) * buckets));
    used += stroke.length;
    const key = `${slot}|${stroke.layer.id}`;
    const group = groups.get(key) ?? { slot, layer: stroke.layer, lines: [], longest: 0 };
    group.lines.push(stroke.points);
    group.longest = Math.max(group.longest, stroke.length);
    groups.set(key, group);
  }

  const share = (draw / cycle) * 100;
  const rules = [];
  for (let slot = 0; slot < buckets; slot++) {
    const from = ((slot / buckets) * share).toFixed(3);
    const to = (((slot + 1) / buckets) * share).toFixed(3);
    const filled = Math.min(100, Number(to) + 1.5).toFixed(3);
    rules.push(`@keyframes k${slot}{0%,${from}%{stroke-dashoffset:var(--d);fill-opacity:0}`
      + `${to}%{stroke-dashoffset:0;fill-opacity:0}`
      + `${filled}%,100%{stroke-dashoffset:0;fill-opacity:1}}`);
  }
  const paths = [...groups.values()]
    .sort((a, b) => ordered.indexOf(a.layer) - ordered.indexOf(b.layer))
    .map(group => `<path ${group.layer.attributes}`
      + ` style="--d:${group.longest.toFixed(1)};stroke-dasharray:var(--d);animation:k${group.slot} ${cycle}s linear infinite"`
      + ` d="${group.lines.map(subpathOf).join(' ')}"/>`)
    .join('');
  return inkFrame(moth, `<style>${rules.join('')}</style>${paths}`);
}

const destination = resolve(process.argv[2] ?? 'docs');
await mkdir(destination, { recursive: true });

const SPECIMENS = ['nocturne-022', 'nocturne-001', 'nocturne-007', 'nocturne-030'];
const DIALS = [
  { label: '무늬 밀도 0', options: { density: 0, strangeness: 0.5 } },
  { label: '무늬 밀도 1', options: { density: 1, strangeness: 0.5 } },
  { label: '기묘함 0', options: { density: 0.5, strangeness: 0 } },
  { label: '기묘함 1', options: { density: 0.5, strangeness: 1 } },
];

const sheets = [
  ['specimens.svg', strip(SPECIMENS.map(seed => {
    const moth = generateMoth(seed);
    const pairs = moth.wings.length / 2;
    return {
      moth,
      label: `${seed} · ${FAMILY_LABELS[moth.family]}${pairs === 2 ? '' : ` · 날개 ${pairs}쌍`}`,
    };
  }), { tileWidth: 230, tileHeight: 210 })],
  ['dials.svg', strip(DIALS.map(entry => ({
    moth: generateMoth('nocturne-015', entry.options),
    label: entry.label,
  })), { tileWidth: 196, tileHeight: 184 })],
  ['drawing.svg', drawing(generateMoth('nocturne-022'), {})],
];

for (const [name, markup] of sheets) {
  await writeFile(resolve(destination, name), markup);
  console.log(`${name}  ${(markup.length / 1024).toFixed(0)} KB`);
}
console.log(`Figure frame ${FIGURE.width}x${FIGURE.height}; written to ${destination}`);
