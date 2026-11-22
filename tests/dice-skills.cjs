'use strict';
const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const { validate } = require('../scripts/build-pokemon-skills.cjs'),
  data = require('../data/pokemon-skills.json');
for (const value of [0, -1, 1.5, 5, NaN]) {
  const d = structuredClone(data);
  d.moves.find((m) => m.mode === 'dice').diceStep = value;
  assert.throws(() => validate(d));
}
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
const r=BattleTurnRules,s=PokemonSkillRules,enemy={...POKEDEX[0],type:null,types:[]},ready=id=>{const c=r.create([id]);r.begin(c);c.members[0].gauge=s.cost(id);return c};
const diceIds=POKEDEX.filter(m=>s.forPokemon(m.id).mode==='dice').map(m=>m.id);assert(diceIds.length>=5);
for(const id of diceIds){let calls=0;const context={enemy,enemyHP:5000,rng:()=>{calls++;return .99}};let combat=ready(id);const before=JSON.stringify(combat);for(let i=0;i<10;i++){r.inspectSkill(combat,id,context);s.damageRange(combat,id,context);}assert.equal(calls,0);assert.equal(JSON.stringify(combat),before);
for(let face=1;face<=6;face++){combat=ready(id);const skill=s.forPokemon(id);const result=r.skill(combat,id,{...context,rng:()=>{calls++;return (face-.5)/6}});assert.equal(result.diceFace,face);assert.equal(result.multiplier,skill.power+face*skill.diceStep);assert.equal(result.damage,s.attackDamage(combat,combat.members[0],{enemy,enemyHP:5000,diceFace:face}));assert.equal(combat.members[0].gauge,0);const count=calls;assert(!r.skill(combat,id,context).ok);assert.equal(calls,count);}
}
let a=ready(40),calls=0,before=JSON.stringify(a);assert(!r.skill(a,40,{enemy:POKEDEX[93],enemyHP:5000,rng:()=>{calls++;return .9}}).ok);assert.equal(calls,0);assert.equal(JSON.stringify(a),before);
a=ready(40);a.members[0].gauge=0;assert(!r.skill(a,40,{enemy,enemyHP:5000,rng:()=>{calls++;return .9}}).ok);assert.equal(calls,0);
for(const [rng,face] of [[()=>0,1],[()=>1,6],[()=>-1,1],[()=>NaN,1]]){a=ready(135);assert.equal(r.skill(a,135,{enemy,enemyHP:5000,rng}).diceFace,face);}
assert.equal(s.role(135),'サイコロアタッカー');assert(s.description(135).includes('2＋出目×2'));
`,
  c,
);
console.log(
  'PASS six faces/exact damage, pure previews, one roll only after validation, no reroll on failed/repeated use, immunity/gauge atomicity and bounded RNG',
);
