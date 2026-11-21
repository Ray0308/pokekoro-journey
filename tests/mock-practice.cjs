const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
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
  'mock-practice-rules.js',
])
  vm.runInContext(fs.readFileSync(file, 'utf8'), c);
vm.runInContext(
  `
const r=MockPracticeRules,master=JSON.stringify(POKEDEX);
for(const starter of [1,4,7]) {
 const m=r.create(starter),type=POKEDEX[starter-1].type;
 assert.deepEqual(Array.from(m.team),[starter,446]);assert.equal(m.enemy.id,25);
 assert.equal(m.pool.length,partyTypes([starter,446]).length);assert.equal(m.phase,'trace');
 const before=JSON.stringify(m);assert.equal(r.clear(m,[12,13]),null);assert.equal(JSON.stringify(m),before);
 const trace=r.clear(m,[12,13,14],()=>0);assert.ok(trace.amount>0);assert.equal(m.phase,'ready');
 const gauge=m.combat.members[0].gauge, power=m.power;
 const resumed=r.create(starter,r.snapshot(m));assert.equal(resumed.power,power);assert.equal(resumed.combat.members[0].gauge,gauge);
 assert.equal(r.begin(m),true);assert.equal(m.power,power);assert.equal(r.begin(m),false);
 for(let i=0;i<4;i++){for(const cell of r.guide)m.board[cell]=type;r.clear(m,[12,13,14],()=>0,i+1);}
 assert.equal(r.end(m),true);assert.equal(r.end(m),false);assert.equal(m.rounds,1);assert.equal(m.enemy.id,25);assert.equal(m.power,0);
 assert.equal(m.combat.members[0].gauge,PokemonSkillRules.cost(starter));assert.equal(r.inspect(m,starter).ok,true);
 const result=r.use(m,starter);assert.equal(result.ok,true);assert.ok(result.damage>0);assert.equal(m.phase,'done');assert.equal(m.combat.members[0].gauge,0);
 assert.equal(r.use(m,starter).ok,false);assert.equal(m.combat.members.some(x=>x.fainted),false);
 const done=r.create(starter,r.snapshot(m));assert.equal(done.phase,'done');assert.equal(done.totalDamage,m.totalDamage);
}
const boost=r.create(4);r.clear(boost,r.guide,()=>0);r.begin(boost);
for(let i=0;i<20;i++){for(const cell of r.guide)boost.board[cell]=5;r.clear(boost,r.guide,()=>0);}
r.end(boost);assert.equal(r.use(boost,446).ok,true);assert.equal(boost.phase,'ready');assert.equal(boost.combat.nextBoost,1.5);
const again=r.create(4,r.snapshot(boost));r.begin(again);assert.equal(again.combat.boost,1.5);
for(const cell of r.guide)again.board[cell]=5;assert.ok(r.clear(again,r.guide,()=>0).amount>0);r.end(again);assert.equal(again.phase,'done');
const invalid=r.snapshot(r.create(1));invalid.gauges[0].value=999;assert.equal(r.create(1,invalid).phase,'trace');
const board=Array.from({length:30},(_,i)=>i);const refilled=r.refill(board,[24,25,26],[0,5],()=>0);
assert.equal(refilled[24],board[18]);assert.equal(refilled[0],0);assert.equal(refilled[29],board[29]);assert.equal(board[24],24);
assert.equal(JSON.stringify(POKEDEX),master);
`,
  c,
);
console.log(
  'PASS mock: own 2 partners, stable opponent/state, real gauges/skills/boost, gravity, save/resume and no forced fainting',
);
