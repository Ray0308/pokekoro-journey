'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  { validate } = require('../scripts/build-pokemon-skills.cjs'),
  data = require('../data/pokemon-skills.json');
{
  const d = structuredClone(data);
  d.moves.find((m) => m.category === 'guard').activation = 'always';
  assert.throws(() => validate(d));
}
assert.equal(data.moves.filter((m) => m.category === 'guard').length, 82);
assert(
  data.moves
    .filter((m) => m.category === 'guard')
    .every((m) => m.cost >= 14 && m.activation === 'even'),
);
const c = vm.createContext({ assert });
for (const f of [
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
  vm.runInContext(fs.readFileSync(f, 'utf8'), c, { filename: f });
vm.runInContext(
  `
const r=BattleTurnRules,s=PokemonSkillRules,ctx={enemy:POKEDEX[0],enemyHP:5000},ready=id=>{const c=r.create([id,1,7,6]);r.begin(c);c.members[0].gauge=s.cost(id);return c;};
const guards=POKEDEX.filter(m=>s.forPokemon(m.id).category==='guard');assert(guards.length>=80);
for(const mon of guards){const id=mon.id,skill=s.forPokemon(id);for(let face=1;face<=6;face++){const combat=ready(id);let calls=0;const context={...ctx,rng:()=>{calls++;return(face-.5)/6}};const before=JSON.stringify(combat);r.inspectSkill(combat,id,context);r.inspectSkill(combat,id,context);assert.equal(calls,0);assert.equal(JSON.stringify(combat),before);const result=r.skill(combat,id,context),success=face%2===0;assert(result.ok);assert.equal(result.guardSucceeded,success);assert.equal(result.effectFailed,!success);assert.equal(result.diceFace,face);assert.equal(calls,1);assert.equal(combat.guard,success);assert.equal(combat.members[0].gauge,0);assert.equal(combat.members[0].usedTurn,combat.turn);assert.equal(result.affected.length,success&&skill.bonus?.kind==='chargeAll'?3:0);assert.equal(combat.nextBoost,success&&skill.bonus?.kind==='boost'?1.25:1);assert(!r.skill(combat,id,context).ok);assert.equal(calls,1);if(success){assert(r.retaliate(combat,()=>0).blocked);assert(!r.retaliate(combat,()=>0).blocked);}else assert(!r.retaliate(combat,()=>0).blocked);}}
for(const guard of [11,153,181]){const combat=ready(guard);combat.guard=true;const before=JSON.stringify(combat);assert(!r.skill(combat,guard,{...ctx,rng:()=>{throw Error('must not roll')}}).ok);assert.equal(JSON.stringify(combat),before);}
let combat=ready(153);combat.nextBoost=1.8;r.skill(combat,153,{...ctx,rng:()=>.2});assert.equal(combat.nextBoost,1.8);assert.equal(s.cost(11),14);assert.equal(s.cost(10),18);assert.equal(s.cost(153),20);assert.equal(s.cost(181),20);assert(s.description(181).includes('1・3・5'));assert(s.description(181).includes('成功時'));
`,
  c,
);
console.log(
  'PASS all guard representatives six faces, odd consumes with no guard/boost/charge, even single guard, one roll, invalid-use atomicity and increased costs',
);
