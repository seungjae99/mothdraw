import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ENTRY = "export * from './src/generator/moth'; export * from './src/render/svg';";
const bundle = await build({
  stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const { generateMoth, GENERATOR_VERSION, SPECIMEN_SEEDS, SURVEY_SEEDS, renderMoth } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const PAGE_MARGIN = 40;
const HEADER_HEIGHT = 126;

/** Lays specimens out on a grid and wraps them in a titled sheet. */
function plate({ seeds, mode, columns, tileWidth, tileHeight, label }) {
  const rows = Math.ceil(seeds.length / columns);
  const gap = 16;
  const width = PAGE_MARGIN * 2 + columns * tileWidth + (columns - 1) * gap;
  const height = HEADER_HEIGHT + rows * (tileHeight + gap) + PAGE_MARGIN + 24;
  const compact = tileWidth < 200;
  const tiles = seeds.map((seed, index) => {
    const moth = generateMoth(seed);
    const x = PAGE_MARGIN + (index % columns) * (tileWidth + gap);
    const y = HEADER_HEIGHT + Math.floor(index / columns) * (tileHeight + gap);
    const caption = compact
      ? `<text x="${tileWidth / 2}" y="${tileHeight - 7}" text-anchor="middle" font-size="8" fill="#80867a">${String(index + 1).padStart(3, '0')} · ${moth.family}</text>`
      : `<text x="16" y="25" font-size="12">${String(index + 1).padStart(2, '0')}</text>`
        + `<text x="${tileWidth - 16}" y="25" text-anchor="end" fill="#747b6b" font-size="10">${moth.family}</text>`
        + `<text x="16" y="${tileHeight - 16}" font-size="10" fill="#747b6b">${seed}</text>`
        + `<text x="${tileWidth - 16}" y="${tileHeight - 16}" text-anchor="end" font-size="10" fill="#747b6b">${moth.wingspan.toFixed(0)} u</text>`;
    const art = compact
      ? renderMoth(moth, mode).replace('<svg ', `<svg x="4" y="2" width="${tileWidth - 8}" height="${tileHeight - 16}" `)
      : renderMoth(moth, mode).replace('<svg ', `<svg x="8" y="30" width="${tileWidth - 16}" height="${tileHeight - 62}" `);
    return `<g transform="translate(${x} ${y})"><rect width="${tileWidth}" height="${tileHeight}" fill="#f9f7f0" stroke="#d8d7ca"/>${art}${caption}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<rect width="${width}" height="${height}" fill="#f3f0e7"/>`
    + `<g font-family="Arial,sans-serif" fill="#292d29">`
    + `<text x="${PAGE_MARGIN}" y="43" font-size="14" letter-spacing="3">MOTHDRAW / FIELD NOTES 001</text>`
    + `<text x="${PAGE_MARGIN}" y="111" font-family="Georgia,serif" font-size="48">${label}</text>`
    + `<text x="${width - PAGE_MARGIN}" y="106" text-anchor="end" font-size="12">${seeds.length} SEEDS / ${mode.toUpperCase()} / v${GENERATOR_VERSION}</text>`
    + `${tiles}`
    + `<text x="${PAGE_MARGIN}" y="${height - 18}" font-size="11" fill="#747b6b">PROCEDURAL SPECIMENS — 5 MORPHOLOGICAL FAMILIES</text>`
    + `</g></svg>`;
}

const SHEETS = [
  { file: 'pattern', seeds: SPECIMEN_SEEDS, mode: 'pattern', columns: 5, tileWidth: 260, tileHeight: 236, label: 'Shapes of the night' },
  { file: 'silhouette', seeds: SPECIMEN_SEEDS, mode: 'silhouette', columns: 5, tileWidth: 260, tileHeight: 236, label: 'Shapes of the night' },
  { file: 'structure', seeds: SPECIMEN_SEEDS, mode: 'structure', columns: 5, tileWidth: 260, tileHeight: 236, label: 'Wing overlap' },
  { file: 'survey', seeds: SURVEY_SEEDS, mode: 'pattern', columns: 10, tileWidth: 140, tileHeight: 124, label: 'One hundred specimens' },
];

const destination = resolve(process.argv[2] ?? 'artifacts');
await mkdir(destination, { recursive: true });
for (const sheet of SHEETS) {
  const markup = plate(sheet);
  await writeFile(resolve(destination, `mothdraw-${sheet.file}.svg`), markup);
  console.log(`mothdraw-${sheet.file}.svg  ${(markup.length / 1024).toFixed(0)} KB`);
}
console.log(`Plates exported to ${destination}`);
