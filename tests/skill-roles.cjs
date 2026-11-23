'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const { validate } = require('../scripts/build-pokemon-skills.cjs');
const data = require('../data/pokemon-skills.json');
for (const change of [
  (b) => (b.kind = 'bad'),
  (b) => (b.amount = 0),
  (b) => (b.amount = 100),
  (b) => (b.amount = 1.5),
]) {
  const d = structuredClone(data);
  const m = d.moves.find((m) => m.bonus?.kind === 'chargeLowest');
  change(m.bonus);
  assert.throws(() => validate(d));
}
{
  const d = structuredClone(data);
  d.moves.find((m) => m.category === 'support').bonus = { kind: 'boost', multiplier: 1.25 };
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
const r=BattleTurnRules,s=PokemonSkillRules,enemy={...POKEDEX[0],types:[],type:null},base={enemy,enemyHP:5000,hasNextEnemy:false,rng:()=>.2};
const ready=ids=>{const c=r.create(ids);r.begin(c);for(const m of c.members)m.gauge=s.cost(m.id);return c;};
assert.equal(s.role(19),'速攻アタッカー');assert.equal(s.role(130),'大技アタッカー');assert.equal(s.role(43),'攻撃＆ゲージ支援');assert.equal(s.role(153),'防御＆強化');assert.equal(s.role(181),'防御＆ゲージ支援');assert.equal(s.role(113),'単体ゲージ支援');assert.equal(s.role(242),'全体ゲージ支援');assert.equal(s.role(923),'復活サポート');
let a=ready([43,7,6,19]);a.members[1].gauge=2;a.members[2].gauge=3;a.members[3].gauge=0;a.members[3].fainted=true;let before=JSON.stringify(a);const preview=r.inspectSkill(a,43,base);assert(preview.ok);assert.equal(JSON.stringify(a),before);const hit=r.skill(a,43,base);assert.deepEqual(hit.affected,[6]);assert.equal(a.members[2].gauge,4);assert.equal(a.members[1].gauge,2);assert.equal(a.members[0].gauge,0);assert.equal(hit.damage,preview.damage);assert.equal(a.members[3].gauge,0);before=JSON.stringify(a);assert(!r.skill(a,43,base).ok);assert.equal(JSON.stringify(a),before);
// 格闘無効へのドレインは、ゲージ配布も消費も行わない。
a=ready([534,7]);a.members[1].gauge=0;before=JSON.stringify(a);assert(!r.skill(a,534,{...base,enemy:POKEDEX[93]}).ok);assert.equal(JSON.stringify(a),before);
// 配る相手なしでも攻撃はできる。満タン・ひんしには流さない。
for(const ids of [[43],[43,7]]){a=ready(ids);const outcome=r.skill(a,43,base);assert(outcome.ok);assert.equal(outcome.affected.length,0);}
a=ready([534,7]);a.members[1].gauge=s.cost(7)-1;a.members[1].gaugeProgress=900;r.skill(a,534,base);assert.equal(a.members[1].gauge,s.cost(7));assert.equal(a.members[1].gaugeProgress,0);
// 防御+小強化から、強い強化へ上書きできる。倍率の掛け算はしない。
a=ready([153,446]);assert(r.skill(a,153,base).ok);assert(a.guard);assert.equal(a.nextBoost,1.25);assert(r.skill(a,446,base).ok);assert.equal(a.nextBoost,1.5);r.begin(a);assert.equal(a.boost,1.5);r.begin(a);assert.equal(a.boost,1);
a=ready([446,153]);r.skill(a,446,base);r.skill(a,153,base);assert.equal(a.nextBoost,1.5);assert.equal(r.retaliate(a,()=>0).blocked,true);assert.equal(r.retaliate(a,()=>0).blocked,false);
// 複合防御も既存ガード中は無効。ゲージの二重配布なし。
a=ready([181,7,6]);a.members[1].gauge=0;a.members[2].gauge=0;a.members[2].fainted=true;assert(r.skill(a,181,base).ok);assert.equal(a.members[1].gauge,2);assert.equal(a.members[2].gauge,0);r.begin(a);a.members[0].gauge=s.cost(181);before=JSON.stringify(a);assert(!r.skill(a,181,base).ok);assert.equal(JSON.stringify(a),before);
// 全体支援と単体支援は同じ1合間の権利。使い分けが連打ループを作らない。
a=ready([242,311,7,6]);a.members[1].gauge=0;a.members[2].gauge=0;a.members[3].gauge=0;assert(r.skill(a,242,base).ok);assert.equal(a.members[1].gauge,3);assert.equal(a.members[2].gauge,3);a.members[1].gauge=s.cost(311);assert(!r.skill(a,311,{...base,targetId:7}).ok);
assert(s.cost(19)<s.cost(1));assert(s.forPokemon(130).power>s.forPokemon(6).power);
`,
  c,
);
console.log(
  'PASS quick/burst/compound roles, lowest proportional gauge, no self/fainted/overcharge, immune/no-op atomicity, single guard, max boost/one puzzle, shared support limit',
);
