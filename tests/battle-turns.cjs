const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const c = vm.createContext({ assert });
for (const file of [
  'pokemon-data.generated.js',
  'pokemon-stats.generated.js',
  'pokemon-data.js',
  'pokemon-battle-stats.js',
  'party-rules.js',
  'type-chart.generated.js',
  'type-effectiveness.js',
  'pokemon-skills.generated.js',
  'pokemon-skill-rules.js',
  'battle-turn-rules.js',
])
  vm.runInContext(fs.readFileSync(file, 'utf8'), c);
vm.runInContext(
  `
const r=BattleTurnRules, team=[1,446,11], combat=r.create(team),ctx={enemy:POKEDEX[94],enemyHP:5000};
assert.equal(r.config.seconds,10);assert.equal(r.config.maxTurns,undefined);
r.charge(combat,0,100);assert.equal(combat.members[0].gauge,10);
assert.equal(r.skill(combat,1,ctx).damage,189);assert.equal(combat.members[0].gauge,0);
r.charge(combat,0,100);assert.equal(r.skill(combat,1,ctx).ok,false); // 同じ合間に2回使わない。
r.charge(combat,5,100);assert.ok(r.skill(combat,446,ctx).ok);assert.equal(combat.nextBoost,1.5);
r.charge(combat,11,100);assert.ok(r.skill(combat,11,ctx).ok);assert.equal(r.retaliate(combat).blocked,true);
assert.ok(r.begin(combat));assert.equal(combat.boost,1.5);assert.equal(combat.nextBoost,1);
assert.ok(r.begin(combat));assert.equal(combat.boost,1);
assert.equal(r.retaliate(combat,()=>0).id,1);r.charge(combat,0,100);assert.equal(combat.members[0].gauge,0);assert.equal(r.skill(combat,1,ctx).ok,false);
for(let i=combat.turn;i<10;i++)assert.ok(r.begin(combat));assert.ok(r.canContinue(combat));
const trio=r.create([1,4,7]);for(let i=0;i<3;i++){assert.ok(r.begin(trio));r.retaliate(trio,()=>0);assert.equal(r.canContinue(trio),i<2);}assert.equal(trio.turn,3);assert.equal(r.begin(trio),false);
const protectedTeam=r.create([11]);for(let i=0;i<8;i++){assert.ok(r.begin(protectedTeam));protectedTeam.guard=true;r.retaliate(protectedTeam);}assert.equal(protectedTeam.turn,8);assert.ok(r.canContinue(protectedTeam));
assert.deepEqual(team,[1,446,11]);assert.ok(r.create(team).members.every(m=>!m.fainted&&m.gauge===0));
`,
  c,
);
console.log(
  'PASS: per-skill gauges, skill use limit, boost/guard, fainted types, survival-only continuation and battle-local recovery',
);
