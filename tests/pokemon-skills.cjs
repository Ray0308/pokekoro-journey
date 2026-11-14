const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const { validate } = require('../scripts/build-pokemon-skills.cjs');
const data = require('../data/pokemon-skills.json');
assert.equal(validate(data).pokemon.length, 1025);
for (const change of [
  (x) => x.pokemon.pop(),
  (x) => (x.pokemon[0][1] = 99999),
  (x) => x.moves.push(x.moves[0]),
  (x) => (x.moves[0].cost = 0),
  (x) => (x.moves[0].category = 'unknown'),
]) {
  const x = structuredClone(data);
  change(x);
  assert.throws(() => validate(x));
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
  vm.runInContext(fs.readFileSync(f, 'utf8'), c);
vm.runInContext(
  `
const r=BattleTurnRules,s=PokemonSkillRules;
const enemy={...POKEDEX[0],types:[],type:null,stats:{...POKEDEX[0].stats,defense:80,specialDefense:80}},base={enemy,enemyHP:5000,hasNextEnemy:false};
const ready=(ids)=>{const c=r.create(ids);r.begin(c);for(const m of c.members)m.gauge=s.cost(m.id);return c};
const board=()=>Array.from({length:36},(_,i)=>i%18);
// 新盤面は30マス。全盤面変更と部分変更のどちらでも配列を伸ばさない。
for (const id of [63,271,132]) {
  const fresh=ready([id,7]);const tiles=Array(30).fill(1);
  const result=r.skill(fresh,id,{...base,targetId:7,board:tiles,pool:[1,2,0],rng:()=>0});
  assert.ok(result.ok);assert.equal(tiles.length,30);assert.equal(fresh.pendingBoard.length,30);
}
// 物理つるのムチと特殊かえんほうしゃはそれぞれ防御/特防を使う。
let a=ready([1,6]);const wall={...enemy,stats:{...enemy.stats,defense:200,specialDefense:40}};
assert.ok(r.inspectSkill(a,1,{...base,enemy:wall}).damage<r.inspectSkill(a,1,base).damage);
assert.ok(r.inspectSkill(a,6,{...base,enemy:wall}).damage>r.inspectSkill(a,6,base).damage);
assert.equal(s.cost(1),10);assert.equal(s.forPokemon(446).name,'たくわえる');assert.equal(s.cost(446),12);
// 支援は自分を含めず、1合間に1回。支援後に通常の攻撃技は使用できる。
a=ready([311,312,1]);a.members[2].gauge=4;assert.ok(r.skill(a,311,{...base,targetId:1}).ok);assert.equal(a.members[2].gauge,10);assert.equal(a.members[0].gauge,0);assert.equal(r.skill(a,312,{...base,targetId:1}).ok,false);assert.ok(r.skill(a,1,base).ok);
r.begin(a);a.members[1].gauge=s.cost(312);assert.ok(r.skill(a,312,{...base,targetId:311}).ok);
const full=ready([311,1]);const before=JSON.stringify(full);assert.equal(r.skill(full,311,{...base,targetId:1}).ok,false);assert.equal(JSON.stringify(full),before);
assert.equal(r.skill(full,311,{...base,targetId:311}).ok,false);
// 全体支援は生存・未満タンだけ、自分は対象外。増加上限を超えない。
a=ready([251,1,4,7]);a.members[1].gauge=9;a.members[2].gauge=0;a.members[3].fainted=true;
assert.ok(r.skill(a,251,base).ok);assert.equal(a.members[1].gauge,10);assert.equal(a.members[2].gauge,3);assert.equal(a.members[3].gauge,s.cost(7));
// 復活権は2匹が同じ技を持っていても共有。ゲージ0、戦闘を作り直すと復活権が戻る。
a=ready([923,954,1]);a.turn=8;a.members[2].fainted=true;a.members[2].gauge=0;
assert.ok(r.skill(a,923,{...base,targetId:1}).ok);assert.equal(a.members[2].fainted,false);assert.equal(a.members[2].gauge,0);assert.equal(a.reviveUsed,true);
a.members[2].fainted=true;assert.equal(r.skill(a,954,{...base,targetId:1}).ok,false);assert.ok(r.begin(a));assert.equal(a.turn,9);assert.equal(ready([923]).reviveUsed,false);
// 効果なしで復活権を失わない。
a=ready([923,1]);const revivalBefore=JSON.stringify(a);assert.equal(r.skill(a,923,{...base,targetId:1}).ok,false);assert.equal(JSON.stringify(a),revivalBefore);
// 変換は担当不在なら自分の第1タイプ。盤面変更自体でダメージ・ゲージを与えない。
a=ready([271,4]);let grid=Array(36).fill(1);const expectedType=POKEDEX[270].type;assert.ok(r.skill(a,271,{...base,board:grid,pool:[1,expectedType],rng:()=>0}).ok);assert.equal(grid.filter(t=>t===expectedType).length,8);assert.deepEqual(a.pendingBoard,grid);assert.equal(a.members[1].gauge,s.cost(4));
a=ready([132,7]);grid=Array(36).fill(0);assert.ok(r.skill(a,132,{...base,targetId:7,board:grid,pool:[0,2],rng:()=>0}).ok);assert.equal(grid.filter(t=>t===2).length,8);
a=ready([132,7]);grid=Array(36).fill(2);const noChange=JSON.stringify(a);assert.equal(r.skill(a,132,{...base,targetId:7,board:grid,pool:[2]}).ok,false);assert.equal(JSON.stringify(a),noChange);
a=ready([63,7]);grid=Array(36).fill(0);assert.ok(r.skill(a,63,{...base,board:grid,pool:[0,2],rng:()=>0}).ok);assert.ok(grid.some(t=>t!==0));
// 使用者が倒れても強化は継続。次のパズル1回で消費。
a=ready([446,1]);r.skill(a,446,base);a.members[0].fainted=true;r.begin(a);assert.equal(a.boost,1.5);r.begin(a);assert.equal(a.boost,1);
// 無効相性・割合HP1・自爆で最後の1匹などの失敗は消費しない。
a=ready([52]);let unchanged=JSON.stringify(a);assert.equal(r.skill(a,52,{...base,enemy:POKEDEX[93]}).ok,false);assert.equal(JSON.stringify(a),unchanged);
a=ready([101]);assert.equal(r.skill(a,101,base).ok,false);a=ready([101,1]);assert.ok(r.skill(a,101,base).ok);assert.equal(a.members[0].fainted,true);
a=ready([1001]);assert.equal(r.skill(a,1001,{...base,enemyHP:1}).ok,false);assert.equal(r.inspectSkill(a,1001,{...base,enemyHP:5000}).damage,200);
// 全1025匹の実際の代表技を、有効な状況・対象で発動する。
const categories=new Set();
for(let id=1;id<=1025;id++){
 const ids=[...new Set([id,1,4,7,446,923])];const c=ready(ids),skill=s.forPokemon(id);categories.add(skill.category);
 for(const m of c.members)if(m.id!==id)m.gauge=0;
 const context={...base,board:board(),pool:partyTypes(ids),rng:()=>.5};
 if(skill.category==='revive')c.members.find(m=>m.id!==id).fainted=true;
 const candidates=s.targets(c,id);if(candidates.length)context.targetId=candidates[0].id;
 const preview=r.inspectSkill(c,id,context);assert.ok(preview.ok,id+' '+skill.name+' '+preview.reason);
 const used=r.skill(c,id,context);assert.ok(used.ok,id+' '+skill.name);assert.equal(c.members[0].gauge,0);assert.equal(c.members[0].usedTurn,c.turn);
 if(skill.category==='attack')assert.equal(used.damage,preview.damage);
 assert.equal(r.skill(c,id,context).ok,false);
}
assert.equal(categories.size,6);
`,
  c,
);
console.log(
  'PASS: all 1025 representative skills, six effects, target/no-op checks, loops/caps, revival sharing, board fallback, damage classes and zero-cost failure',
);
