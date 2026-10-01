import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({entryPoints:['src/generator/moth.ts'], bundle:true, write:false, format:'esm', platform:'node'});
const { generateMoth, SPECIMEN_SEEDS, FAMILIES } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const specimens = SPECIMEN_SEEDS.map(generateMoth);
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function intersects(a,b,c,d) { return cross(a,b,c)*cross(a,b,d)<-1e-8 && cross(c,d,a)*cross(c,d,b)<-1e-8; }
for (const moth of [...specimens, ...Array.from({length: 200}, (_,i)=>generateMoth(`stress-${i}`))]) {
  assert.deepEqual(moth,generateMoth(moth.seed),'seed must reproduce all geometry');
  for (const line of [...moth.wings,...moth.body,...moth.antennae]) {
    for (const [x,y] of line) assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<160&&y>-106&&y<134,`${moth.seed}: viewport bounds`);
  }
  for (const wing of moth.wings) {
    assert.deepEqual(wing[0],wing.at(-1),'closed contour');
    assert.ok(Math.abs(wing[0][0])<6,'root must enter thorax');
    for(let i=0;i<wing.length-1;i++) for(let j=i+2;j<wing.length-1;j++) {
      if(i===0&&j===wing.length-2) continue;
      assert.ok(!intersects(wing[i],wing[i+1],wing[j],wing[j+1]),`${moth.seed}: wing self-intersection ${i}/${j}`);
    }
  }
  for (const [a,b] of [[0,1],[2,3]]) assert.deepEqual(moth.wings[a].map(([x,y])=>[-x,y]),moth.wings[b],'bilateral symmetry');
}
assert.equal(new Set(specimens.map(m=>JSON.stringify(m.wings))).size,20,'20 unique silhouettes');
assert.equal(new Set(specimens.map(m=>m.family)).size,FAMILIES.length,'all families represented');
assert.throws(()=>generateMoth('  '));
assert.throws(()=>generateMoth('x'.repeat(161)));
console.log('PASS: 20 fixed + 200 stress seeds; deterministic, finite, bounded, closed, non-self-intersecting, connected roots and bilateral symmetry.');
console.log('Families:',Object.fromEntries(FAMILIES.map(f=>[f,specimens.filter(m=>m.family===f).length])));
