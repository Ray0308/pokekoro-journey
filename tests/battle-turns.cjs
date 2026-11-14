const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const c = vm.createContext({ assert });
for (const file of [
  'pokemon-data.generated.js',
  'pokemon-data.js',
  'party-rules.js',
  'type-chart.generated.js',
  'type-effectiveness.js',
  'battle-turn-rules.js',
])
  vm.runInContext(fs.readFileSync(file, 'utf8'), c);
vm.runInContext(
  `
const r=BattleTurnRules, team=[4,6,7,446], combat=r.create(team);
assert.equal(r.config.seconds,10);assert.equal(r.config.maxTurns,6);
r.charge(combat,1,6);assert.deepEqual(combat.members.map(m=>m.gauge),[6,6,0,0]);
r.charge(combat,4,6);assert.equal(combat.members[1].gauge,12); // 副タイプも溜まる。
assert.equal(r.skill(combat,4,'guard',POKEDEX[0]).ok,false);
assert.equal(r.skill(combat,6,'guard',POKEDEX[0]).ok,true);
assert.equal(r.retaliate(combat,()=>0).blocked,true);assert.equal(r.alive(combat).length,4);
r.charge(combat,1,20);assert.equal(combat.members[0].gauge,12);
assert.equal(r.skill(combat,4,'boost',POKEDEX[0]).ok,true);
assert.equal(r.skill(combat,6,'boost',POKEDEX[0]).ok,false);assert.equal(combat.members[1].gauge,12);
assert.ok(r.begin(combat));assert.equal(combat.boost,1.5);assert.equal(combat.nextBoost,1);
assert.ok(r.begin(combat));assert.equal(combat.boost,1);
assert.equal(r.retaliate(combat,()=>0).id,4);assert.equal(combat.members[0].fainted,true);
r.charge(combat,1,36);assert.equal(combat.members[0].gauge,0);
assert.equal(r.skill(combat,4,'attack',POKEDEX[0]).ok,false);
assert.equal(r.skill(combat,6,'attack',POKEDEX[73]).ok,true); // いわ/じめんに炎は半減。
assert.equal(combat.members[1].gauge,0);
const water=r.create([7]);r.charge(water,2,12);
assert.equal(r.skill(water,7,'attack',POKEDEX[73]).damage,528); // 4倍も技へ反映。
const ghost=r.create([446]);r.charge(ghost,5,12);
assert.equal(r.skill(ghost,446,'attack',POKEDEX[93]).ok,false);assert.equal(ghost.members[0].gauge,12);
for(let i=combat.turn;i<6;i++)assert.ok(r.begin(combat));
assert.equal(r.canContinue(combat),false);assert.equal(r.begin(combat),false);
const wiped=r.create([7]);r.retaliate(wiped,()=>0);assert.equal(r.canContinue(wiped),false);
assert.deepEqual(team,[4,6,7,446]);assert.ok(r.create(team).members.every(m=>!m.fainted&&m.gauge===0));
`,
  c,
);
console.log(
  'PASS: turn limit, type gauges, fainting, shared types, skill costs/effects, immunity, defense and battle-local recovery',
);
