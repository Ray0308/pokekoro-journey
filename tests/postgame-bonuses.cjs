'use strict';
const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const c = vm.createContext({ assert });
for (const f of [
  'pokemon-data.generated.js',
  'pokemon-stats.generated.js',
  'pokemon-battle-stats.js',
  'pokemon-data.js',
  'party-rules.js',
  'map-config.js',
  'rainbow-config.js',
  'trainer-rosters.generated.js',
  'hall-of-fame-rules.js',
  'trainer-rules.js',
  'type-balls.js',
])
  vm.runInContext(fs.readFileSync(f, 'utf8'), c, { filename: f });
vm.runInContext(
  `
const r=HallOfFameRules;
for(const bad of [undefined,null,{}, {hallOfFame:{count:-1}},{hallOfFame:{count:2.5}},{hallOfFame:{count:'5'}}]) assert.equal(r.captureBonus(bad),0);
const normal={cap:0.9,bonus:0}, master={cap:1,bonus:1},typed=TYPE_BALLS[0],mon={types:[0],type:0};
for(const n of [0,1,2,5,10,11,1000]) {
 const save={hallOfFame:{count:n}},bonus=Math.min(n,10)/100;
 assert.equal(r.captureBonus(save),bonus);
 assert(Math.abs(ballCatchChance(normal,0.4,mon,save)-(0.4+bonus))<1e-12);
 assert.equal(ballCatchChance(normal,0.89,mon,save),Math.min(0.9,0.89+bonus));
 assert.equal(ballCatchChance(master,0.4,mon,save),1);
 assert.equal(ballCatchChance(typed,0.8,mon,save),0.99);
 assert.equal(ballCatchChance(typed,0.8,{type:1,types:[1]},save),0.8);
}
const make=(mapId,n,boss=true)=>{const s={mapId,pos:14,tour:1,clearedMaps:[],trainerWins:{},hallOfFame:{count:n}};return createTrainerEncounter(s,MAPS[mapId],boss,()=>0.3)};
for(const id of ['indigo-lorelei','indigo-bruno','indigo-agatha','indigo-lance','indigo-champion']) {
 const baseline=make(id,0),once=make(id,1),twice=make(id,2),cap=make(id,10),beyond=make(id,1000);
 assert.deepEqual(cap.team,beyond.team);
 assert.deepEqual(baseline.team.map(m=>m.id),once.team.map(m=>m.id));
 for(let i=0;i<baseline.team.length;i++) {assert(once.team[i].hp>baseline.team[i].hp);assert(twice.team[i].hp>once.team[i].hp);assert.equal(once.team[i].level,baseline.team[i].level+2)}
 assert.deepEqual(make(id,0,false).team,make(id,10,false).team);
}
assert.deepEqual(make('pewter-gym',0).team,make('pewter-gym',10).team);
assert.deepEqual(r.leagueBonus({hallOfFame:{count:99}},'indigo-champion',true),{clears:10,level:20,hp:1.8});
`,
  c,
);
console.log(
  'PASS capture +1 point/clear, +10 cap, all ball caps/master unchanged, legacy/invalid saves, all five league bosses only, monotonic bounded rematches',
);
