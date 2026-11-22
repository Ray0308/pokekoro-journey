'use strict';
const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const c = vm.createContext({ assert });
for (const f of [
  'pokemon-data.generated.js',
  'pokemon-stats.generated.js',
  'pokemon-battle-stats.js',
  'pokemon-data.js',
  'party-rules.js',
  'map-config.js',
  'rainbow-config.js',
  'map-encounters.generated.js',
  'map-encounters.js',
])
  vm.runInContext(fs.readFileSync(f, 'utf8'), c, { filename: f });
vm.runInContext(fs.readFileSync('safari.js', 'utf8').split('function isSafari()')[0], c);
vm.runInContext(fs.readFileSync('pokemon-habitats.js', 'utf8'), c);
vm.runInContext(
  `
const find=PokemonHabitats.find;
for(const id of NORMAL_ENCOUNTER_IDS){const entries=find(id,{owned:[1,4,7,25]}).filter(p=>p.kind==='wild');assert(entries.length>0&&entries.length<=3);let previous=Infinity;for(const p of entries){assert(p.score<=previous);previous=p.score;const pool=mapEncounterWeights(p.mapId,[1,4,7,25]);assert.equal(p.score,pool.find(([n])=>n===id)[1]/pool.reduce((s,[,w])=>s+w,0));}}
assert(find(150).some(p=>p.kind==='mewtwo'));assert(!find(150,{owned:[150]}).some(p=>p.kind==='mewtwo'));assert(find(150,{owned:[150]}).some(p=>p.kind==='rainbow'));assert(find(249).some(p=>p.kind==='cave'));assert(find(151).every(p=>p.kind==='rainbow'));for(const id of [115,113,128])assert(find(id).some(p=>p.kind==='safari'));assert.equal(find(0).length,0);assert.equal(find(1026).length,0);
`,
  c,
);
console.log(
  'PASS 931 species ranked by real owned-adjusted odds, top3, Mewtwo pre/post catch, cave rotation, mythical rainbow and Safari specials',
);
