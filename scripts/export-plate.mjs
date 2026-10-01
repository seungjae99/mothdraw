import {build} from 'esbuild';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const bundle=await build({stdin:{contents:"export * from './src/generator/moth'; export * from './src/render/svg';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const {generateMoth,SPECIMEN_SEEDS,renderMoth}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const destination=resolve(process.argv[2]??'artifacts');
await mkdir(destination,{recursive:true});
for(const mode of ['silhouette','structure']){
const tiles=SPECIMEN_SEEDS.map((seed,i)=>{
const moth=generateMoth(seed);const x=40+(i%5)*276;const y=166+Math.floor(i/5)*253;
return `<g transform="translate(${x} ${y})"><rect width="260" height="236" fill="#f9f7f0" stroke="#d8d7ca"/><text x="16" y="25" font-size="12">${String(i+1).padStart(2,'0')}</text><text x="244" y="25" text-anchor="end" fill="#747b6b" font-size="10">${moth.family}</text>${renderMoth(moth,mode).replace('<svg ','<svg x="8" y="30" width="244" height="174" ')}<text x="16" y="220" font-size="10" fill="#747b6b">${seed}</text></g>`;
}).join('');
await writeFile(resolve(destination,`mothdraw-${mode}.svg`),`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1230" viewBox="0 0 1440 1230"><rect width="1440" height="1230" fill="#f3f0e7"/><g font-family="Arial,sans-serif" fill="#292d29"><text x="40" y="43" font-size="14" letter-spacing="3">MOTHDRAW / FIELD NOTES 001</text><text x="40" y="111" font-family="Georgia,serif" font-size="48">Shapes of the night</text><text x="1400" y="106" text-anchor="end" font-size="12">20 SEEDS / ${mode.toUpperCase()} / v0.2.0</text>${tiles}<text x="40" y="1210" font-size="11" fill="#747b6b">PROCEDURAL SPECIMENS — 5 MORPHOLOGICAL FAMILIES</text></g></svg>`);
}
console.log(`Plates exported to ${destination}`);
