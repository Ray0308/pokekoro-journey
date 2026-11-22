const fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'),
  ctx = vm.createContext({});
for (const f of [
  'pokemon-data.generated.js',
  'pokemon-stats.generated.js',
  'pokemon-battle-stats.js',
  'pokemon-data.js',
  'map-config.js',
  'rainbow-config.js',
  'map-encounters.generated.js',
  'map-encounters.js',
])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const g = vm.runInContext(
  '({pools:MAP_ENCOUNTERS,normal:NORMAL_ENCOUNTER_IDS,rainbow:RAINBOW_IDS,order:MAP_ORDER,maps:MAPS,pick:chooseMapEncounter,mons:POKEDEX})',
  ctx,
);
assert.equal(Object.keys(g.pools).length, 30);
const all = new Set();
for (const mapId of g.order) {
  const pool = g.pools[mapId];
  assert(pool.length > 0, mapId);
  assert.equal(new Set(pool.map((x) => x[0])).size, pool.length);
  let cumulative = 0,
    total = pool.reduce((s, x) => s + x[1], 0);
  for (const [id, weight] of pool) {
    assert(g.normal.includes(id));
    assert(!g.rainbow.includes(id));
    assert(Number.isSafeInteger(weight) && weight > 0);
    all.add(id);
    assert.equal(
      g.pick(mapId, () => (cumulative + weight / 2) / total),
      id,
    );
    cumulative += weight;
  }
  assert.equal(
    g.pick(mapId, () => 0),
    pool[0][0],
  );
  assert.equal(
    g.pick(mapId, () => 1),
    pool.at(-1)[0],
  );
}
assert.equal(all.size, g.normal.length);
for (const n of g.normal) assert(all.has(n));
assert(g.pools.viridian.some((x) => x[0] === 25));
assert(!g.pools.viridian.some((x) => x[0] === 149 || x[0] === 289 || x[0] === 1006));
assert(g.pools['diglett-cave'].some((x) => x[0] === 50));
assert(!g.pools['diglett-cave'].some((x) => x[0] === 72));
assert(g.pools['pokemon-tower'].some((x) => x[0] === 92));
assert(g.pools['seafoam-islands'].some((x) => x[0] === 131));
assert.equal(g.maps['cerulean-cave'].boss.name, 'ミュウツー');
assert.equal(g.maps['cerulean-cave'].boss.pokemonId, 150);
assert.throws(() => g.pick('unknown'), /未設定/);
console.log(
  'PASS: 30 regional pools, every weighted interval/boundary, all 931 species reachable, no rainbow leakage, early power limits and boss name',
);
// 全地域で各候補の調整後区間を照合。未捕獲・捕獲済みの双方が到達可能。
for (const mapId of g.order) {
  const pool = g.pools[mapId],
    snapshot = JSON.stringify(pool);
  const owned = pool.filter((_, i) => i % 2 === 0).map(([id]) => id);
  const caught = new Set(owned);
  const weighted = pool.map(([id, weight]) => [id, weight * (caught.has(id) ? 0.6 : 1)]);
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let sum = 0;
  for (const [id, weight] of weighted) {
    assert.equal(
      g.pick(mapId, () => (sum + weight / 2) / total, owned),
      id,
    );
    sum += weight;
  }
  for (let i = 0; i < 100; i++) {
    const rng = () => i / 100;
    assert.equal(
      g.pick(
        mapId,
        rng,
        pool.map(([id]) => id),
      ),
      g.pick(mapId, rng),
    );
    assert.equal(g.pick(mapId, rng, []), g.pick(mapId, rng));
    assert.equal(g.pick(mapId, rng, null), g.pick(mapId, rng));
  }
  assert.equal(JSON.stringify(pool), snapshot);
  assert.equal(
    g.pick(mapId, () => 1, owned),
    pool.at(-1)[0],
  );
}
const sample = g.pools.viridian,
  owned = sample.filter((_, i) => i % 2 === 0).map(([id]) => id),
  caught = new Set(owned);
let original = 0,
  adjusted = 0;
for (let i = 0; i < 10000; i++) {
  const rng = () => (i + 0.5) / 10000;
  original += !caught.has(g.pick('viridian', rng));
  adjusted += !caught.has(g.pick('viridian', rng, owned));
}
assert(adjusted > original);
console.log(
  'PASS owned weight 60%, all 30 weighted intervals, all-owned/no-owned original odds, no pool mutation, measurable uncaught increase',
);
