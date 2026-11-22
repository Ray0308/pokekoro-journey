'use strict';
const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict'),
  { validate } = require('../scripts/build-pokemon-skills.cjs'),
  data = require('../data/pokemon-skills.json');
{
  const d = structuredClone(data);
  d.moves.find((m) => m.mode === 'critical').criticalMultiplier = 2;
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
const r=BattleTurnRules,s=PokemonSkillRules,enemy={...POKEDEX[0],type:null,types:[]},base={enemy,enemyHP:5000};
const ready=id=>{const c=r.create([id]);r.begin(c);c.members[0].gauge=s.cost(id);return c};
const ids=POKEDEX.filter(m=>['critical','risky'].includes(s.forPokemon(m.id).mode)).map(m=>m.id);assert(ids.length>20);
for(const id of ids){let combat=ready(id),calls=0;const context={...base,rng:()=>{calls++;return .99}};const before=JSON.stringify(combat);for(let n=0;n<5;n++){r.inspectSkill(combat,id,context);s.damageRange(combat,id,context);}assert.equal(calls,0);assert.equal(JSON.stringify(combat),before);
for(let face=1;face<=6;face++){combat=ready(id);const skill=s.forPokemon(id),result=r.skill(combat,id,{...base,rng:()=>{calls++;return (face-.5)/6}});assert(result.ok);assert.equal(result.diceFace,face);assert.equal(result.critical,skill.mode==='critical'&&face>=5);assert.equal(result.missed,skill.mode==='risky'&&face<=2);assert.equal(result.multiplier,result.missed?0:skill.power*(result.critical?1.3:1));assert.equal(result.damage,s.attackDamage(combat,combat.members[0],{...base,diceFace:face}));assert.equal(result.damage===0,result.missed);assert.equal(combat.members[0].gauge,0);assert.equal(combat.members[0].usedTurn,combat.turn);const count=calls;assert(!r.skill(combat,id,context).ok);assert.equal(calls,count);}
}
let combat=ready(145),calls=0,before=JSON.stringify(combat);assert(!r.skill(combat,145,{enemy:POKEDEX[26],enemyHP:5000,rng:()=>{calls++;return 0}}).ok);assert.equal(calls,0);assert.equal(JSON.stringify(combat),before);
assert.equal(s.forPokemon(144).power,24);assert.equal(s.forPokemon(145).power,24);assert.equal(s.forPokemon(146).power,24);assert.equal(s.damageRange(ready(144),144,base)[0],0);assert(s.description(144).includes('1・2'));assert(s.description(2).includes('5・6'));
`,
  c,
);
console.log(
  'PASS all critical/risky representatives six outcomes, one roll, miss consumes once, hit/critical exact damage, pure ranges, immunity consumes nothing and power24',
);
