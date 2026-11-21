'use strict';
const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const c = vm.createContext({
  assert,
  validPokemonId: (id) => Number.isInteger(id) && id >= 1 && id <= 1025,
});
vm.runInContext(fs.readFileSync('hall-of-fame-rules.js', 'utf8'), c);
vm.runInContext(
  `
const r=HallOfFameRules;
assert.deepEqual(r.normalize(null),{count:0,records:[],pending:null,researchIntroduced:false});
const save={playerName:'レッド',clearedMaps:['indigo-champion']},battle={},team=[1,4,7,25,32,446];
assert.equal(r.normalize(save.hallOfFame).count,0,'legacy clear does not invent a record');
const entry=r.add(save,battle,team,'2026-11-21');team[0]=2;save.playerName='グリーン';
assert.equal(entry.team[0],1);assert.equal(entry.name,'レッド');
r.add(save,battle,[2,4,7]);assert.equal(save.hallOfFame.count,1,'same battle once');
const restored=r.normalize(JSON.parse(JSON.stringify(save.hallOfFame)));assert.deepEqual(restored.pending,{id:1,stage:'ceremony'});
restored.pending.stage='invalid';assert.equal(r.normalize(restored).pending.stage,'ceremony');
for(let n=0;n<55;n++)r.add(save,{},[1,4,7]);assert.equal(save.hallOfFame.count,56);assert.equal(save.hallOfFame.records.length,50);assert.equal(save.hallOfFame.records.at(-1).id,56);
assert.equal(r.normalize({count:1,records:[{id:1,name:'x',team:[1,1]}],pending:{id:1}}).pending,null);
assert.equal(r.add(save,{},[0,-1,1026]),null);
`,
  c,
);
console.log(
  'PASS legacy, party/name snapshot, same-battle idempotency, pending restore, bounds and history count',
);
