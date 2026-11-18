const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
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
  'practice-rules.js',
])
  vm.runInContext(fs.readFileSync(file, 'utf8'), c);
vm.runInContext(
  `
const r=PracticeRules;
for(const step of r.steps){
 const m=r.create(step);assert.equal(partyTypeError(m.combat.members.map(x=>x.id)),'');
 assert.equal(m.board.length,30);assert.equal(r.validPath(m.board,[12,13,14]),true);
}
const first=r.create('trace'),before=JSON.stringify(first);
for(const bad of [[],[12,13],[12,13,13],[12,14,13],[0,1,2],[12,13,14,15]]) assert.equal(r.clear(first,bad),null);
assert.equal(JSON.stringify(first),before);
assert.ok(r.clear(first,[14,13,12]).amount>0);
const charge=r.create('charge');
for(let i=0;i<3;i++)r.clear(charge,[12,13,14]);
assert.equal(charge.combat.members[0].gauge,8);
assert.equal(BattleTurnRules.inspectSkill(charge.combat,32,{enemy:charge.enemy,enemyHP:charge.hp}).ok,true);
const use=r.create('skillUse');const used=BattleTurnRules.skill(use.combat,32,{enemy:use.enemy,enemyHP:use.hp});
assert.equal(used.ok,true);assert.ok(used.damage>0);assert.equal(use.combat.members[0].gauge,0);
assert.equal(BattleTurnRules.skill(use.combat,32,{enemy:use.enemy,enemyHP:use.hp}).ok,false);
const neutral=r.create('neutral'),advantage=r.create('advantage');
assert.equal(partyTypePower(r.comparisonTeam,3,neutral.enemy),partyTypePower(r.comparisonTeam,6,neutral.enemy));
assert.equal(r.clear(neutral,[12,13,14]).amount,11);
assert.equal(r.clear(advantage,[12,13,14]).amount,22);
const counter=r.create('counter');assert.equal(BattleTurnRules.retaliate(counter.combat,()=>0).id,32);
const gray=r.create('gray');assert.deepEqual(Array.from(BattleTurnRules.alive(gray.combat)),[7,403]);
assert.equal(BattleTurnRules.skill(gray.combat,32,{enemy:gray.enemy,enemyHP:gray.hp}).ok,false);
const zero=r.clear(gray,[12,13,14]);assert.equal(zero.amount,0);assert.equal(zero.before,zero.after);
assert.equal(gray.combat.members[0].gauge,0);
const live=r.create('live');assert.ok(r.clear(live,[12,13,14]).amount>=live.hp);
const shared=BattleTurnRules.create([32,109,7]);
BattleTurnRules.retaliate(shared,()=>0);
assert.ok(partyTypePower(BattleTurnRules.alive(shared),3,live.enemy)>0); // 同タイプの生存仲間は引き続き攻撃可能。
const master=JSON.stringify(POKEDEX);r.create('counter');assert.equal(JSON.stringify(POKEDEX),master);
`,
  c,
);
console.log(
  'PASS: practical lessons, valid paths, earned skill, exact 11/22 comparison, fixed retaliation, zero/live damage and loan isolation',
);
