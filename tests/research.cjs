'use strict';
const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const c = vm.createContext({ assert });
for (const f of [
  'pokemon-data.generated.js',
  'pokemon-stats.generated.js',
  'pokemon-data.js',
  'pokemon-battle-stats.js',
  'party-rules.js',
  'map-config.js',
  'rainbow-config.js',
  'map-encounters.generated.js',
  'research-data.generated.js',
  'research-rules.js',
])
  vm.runInContext(fs.readFileSync(f, 'utf8'), c, { filename: f });
vm.runInContext(
  `
const r=ResearchRules,save={mapId:'cerulean-cave',clearedMaps:[...MAP_ORDER],owned:[],research:r.normalize(null)};
let seed=123;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const observed=new Set();for(let i=0;i<1000;i++){save.research.offer=null;const offer=r.generate(save,rng);observed.add(offer.pokemonId);assert(save.clearedMaps.includes(offer.mapId));assert.notEqual(offer.mapId,'safari-zone');assert.notEqual(offer.pos,r.slot(MAPS[offer.mapId].squares));assert(offer.pos>=4&&offer.pos<=10);assert.equal(r.generate(save,()=>{throw Error('reroll')}),offer);}
assert(observed.size>80);
const m=save.research.offer;m.pos=10;assert.equal(save.research.active,null);assert(r.accept(save.research));assert.equal(save.research.active.left,5);assert(!r.accept(save.research));
let p=r.reserve(save.research,m.mapId,0,4);assert.equal(save.research.active.left,4);assert.equal(r.reserve(save.research,m.mapId,0,6),p);assert.equal(save.research.active.left,4);
assert(!r.select(save.research,6));assert(!r.select(save.research,3));assert(r.select(save.research,4));assert.equal(save.research.active.adjusted,false);assert.equal(r.normalize(save.research).active.pending.value,4);
r.arrive(save.research,m.mapId,3);assert.equal(save.research.active.left,4);r.reserve(save.research,m.mapId,3,2);assert.equal(save.research.active.pending.value,2);assert(!r.select(save.research,1));
save.research.active.left=0;const target=r.arrive(save.research,m.mapId,m.pos);assert.deepEqual(target,{missionId:m.id,pokemonId:m.pokemonId});assert.equal(save.research.active.phase,'encounter');assert(r.finish(save.research,'caught'));assert(!r.finish(save.research,'caught'));assert.equal(save.research.completed,1);
save.research.offer={id:999,mapId:'pewter-gym',pos:4,pokemonId:150};r.accept(save.research);save.research.active.left=1;r.reserve(save.research,'viridian',0,2);r.select(save.research,2);assert.equal(r.arrive(save.research,'viridian',2),null);assert.equal(save.research.last.outcome,'expired');assert.equal(save.research.active,null);
const ownedLegends={mapId:'viridian',clearedMaps:['pewter-gym'],owned:RESEARCH_CATALOG.legendIds.filter(id=>id!==150),research:r.normalize(null)};assert.equal(r.generate(ownedLegends,()=>0).pokemonId,150);
assert.equal(r.generate({...save,clearedMaps:[],research:r.normalize(null)},rng),null);
for(const mapId of MAP_ORDER){const stops=MAPS[mapId].squares;assert(r.slot(stops)>0&&r.slot(stops)<14);}
assert.equal(r.normalize({active:{id:1,mapId:'bad',pos:5,pokemonId:150,left:5,phase:'active'}}).active,null);
const legacy=r.normalize({active:{id:20,mapId:'pewter-gym',pos:4,pokemonId:150,left:3,phase:'active',adjusted:true,pending:{mapId:'pewter-gym',from:0,raw:4,value:3}}});assert.equal(legacy.active.pending.value,3);assert.equal(r.reserve(legacy,'pewter-gym',1,6).value,3);assert.equal(legacy.active.left,3);assert(!r.select(legacy,4));r.arrive(legacy,'pewter-gym',3);assert.equal(r.reserve(legacy,'pewter-gym',3,5).value,5);

`,
  c,
);
console.log(
  'PASS stable offers, cleared destinations, regional rarity, missing priority, explicit acceptance, 5 rolls, unmodified rolls, reload, final-roll success, expiry and exactly-once finish',
);
