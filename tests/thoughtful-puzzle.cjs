'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({ assert });
vm.runInContext(fs.readFileSync('thoughtful-puzzle-rules.js', 'utf8'), context);
vm.runInContext(
  `
const r = ThoughtfulPuzzleRules;
for (const trainer of [false, true]) for (const boss of [false, true]) {
 for (const rng of [()=>0, ()=>0.3, ()=>0.6, ()=>0.999]) {
  const p = r.create({ trainer, boss, pool:[0,1,2], rng });
  assert.equal(r.settle(p),null);
  for (const count of [0,2,31,3.5,NaN]) assert.equal(r.record(p,count,0),false);
  assert.equal(p.used,0);
  assert.equal(r.choose(p,'invalid'),false);
  assert.equal(r.choose(p,'gauge'),boss);
  assert(r.record(p,5,0));
  assert.equal(r.choose(p,'power'),false);
  assert(r.record(p,5,1));
  assert.equal(r.settle(p),null);
  assert(r.record(p,5,2));
  const reward = r.settle(p);
  assert.equal(reward.success,true);
  assert.equal(reward.multiplier,boss?1:1.5);
  assert.equal(reward.gauge,boss?4:0);
  assert.equal(r.record(p,30,0),false);
  assert.equal(r.settle(p),null);
 }
}
const miss = r.create({trainer:true,pool:[0],rng:()=>0});
for(let i=0;i<3;i++) r.record(miss,3,0);
assert.deepEqual(r.settle(miss),{success:false,multiplier:1,gauge:0});
const power = r.create({boss:true,pool:[0],rng:()=>0});
for (const n of [5,3,3]) r.record(power,n,0);
assert.deepEqual(r.settle(power),{success:true,multiplier:1.5,gauge:0});
for (let i=0;i<50;i++) assert.notEqual(r.create({pool:[1],rng:()=>i/50}).goal.kind,'types');
`,
  context,
);
console.log(
  'PASS thoughtful: three valid moves, optional goals, trainer combinations, boss reward choice, locked choices, no duplicate rewards, single-type pools',
);
