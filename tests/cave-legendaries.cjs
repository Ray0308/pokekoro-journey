const fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const ctx = vm.createContext({});
for (const f of [
  'pokemon-data.generated.js',
  'pokemon-stats.generated.js',
  'pokemon-battle-stats.js',
  'pokemon-data.js',
  'rainbow-config.js',
])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
const g = vm.runInContext(
  '({ids:CAVE_LEGENDARY_IDS,mythical:RAINBOW_POOLS.mythical,resolve:resolveCaveBoss,next:nextCaveLegendary})',
  ctx,
);
assert(g.ids.length > 1);
for (const id of [150, 789, 790, ...g.mythical]) assert(!g.ids.includes(id));
assert.equal(g.resolve({ owned: [], caveBossId: g.ids[0] }), 150);
for (const n of [null, 150, -1, 999999])
  assert(g.ids.includes(g.resolve({ owned: [150], caveBossId: n }, () => 0)));
for (const id of g.ids)
  assert.equal(
    g.resolve({ owned: [150], caveBossId: id }, () => 0.99),
    id,
  );
for (const id of g.ids) {
  const owned = [150, ...g.ids.filter((n) => n !== id)];
  assert.equal(
    g.next(owned, null, () => 0.7),
    id,
  );
  assert.equal(
    g.resolve({ owned, caveBossId: g.ids.find((n) => n !== id) }, () => 0.8),
    id,
  );
}
const owned = [150, ...g.ids];
for (const id of g.ids) {
  assert.equal(
    g.resolve({ owned, caveBossId: id }, () => 0),
    id,
  );
  assert.notEqual(
    g.next(owned, id, () => 0),
    id,
  );
  assert.notEqual(
    g.next(owned, id, () => 1),
    id,
  );
}
assert.equal(
  g.next([150], null, () => 0),
  g.ids[0],
);
assert.equal(
  g.next([150], null, () => 1),
  g.ids.at(-1),
);
console.log(
  'PASS cave: Mewtwo until caught, legacy IDs, stable cached boss, every missing legendary, full collection rotation, pool exclusions and RNG boundaries',
);
