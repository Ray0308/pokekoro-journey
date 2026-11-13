// 18×18の出典照合と、複合・無効・サファリ・実際の蓄積パワーを検査する。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { build } = require('../scripts/build-type-chart.cjs');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
for (const file of [
  'pokemon-data.generated.js',
  'pokemon-data.js',
  'party-rules.js',
  'type-chart.generated.js',
  'type-effectiveness.js',
])
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
const runtime = vm.runInContext(
  '({ chart: TYPE_CHART, names: TYPE_CHART_NAMES, gameNames: POKEMON_TYPE_NAMES, pokemon: POKEDEX, multiplier: pokemonTypeMultiplier, battleMultiplier: battleTypeMultiplier, label: typeEffectivenessLabel, best: bestTypeMatchup, charge: puzzleCharge })',
  context,
);
assert.equal(JSON.stringify(runtime.names), JSON.stringify(runtime.gameNames));
const parse = (file) =>
  fs
    .readFileSync(path.join(root, file), 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(','));
const source = parse('data/type-efficacy.source.csv'),
  names = parse('data/type-names.source.csv');
// APIの番号順とゲームの番号順が異なることを、生成処理とは別の対応表で照合する。
const apiIds = [12, 10, 11, 4, 3, 1, 13, 15, 2, 5, 14, 7, 6, 8, 16, 17, 9, 18];
const raw = new Map(source.map(([a, d, f]) => [a + ':' + d, Number(f) / 100]));
for (let a = 0; a < 18; a++)
  for (let d = 0; d < 18; d++)
    assert.equal(runtime.chart[a][d], raw.get(apiIds[a] + ':' + apiIds[d]), `${a}/${d}`);
for (const [attack, id, expected] of [
  [0, 74, 4],
  [2, 74, 4],
  [6, 74, 0],
  [6, 130, 4],
  [0, 130, 1],
  [12, 6, 4],
  [8, 248, 4],
  [7, 149, 4],
  [0, 823, 0.25],
  [1, 230, 0.25],
  [5, 94, 0],
  [8, 94, 0],
  [10, 442, 0],
  [3, 823, 0],
  [9, 823, 0],
  [14, 282, 0],
  [13, 446, 0],
  [0, 7, 2],
  [2, 4, 2],
  [1, 3, 2],
])
  assert.equal(
    runtime.multiplier(attack, runtime.pokemon[id - 1]),
    expected,
    `attack ${attack} vs No.${id}`,
  );
assert.equal(runtime.chart[13][16], 1, 'Modern steel does not resist ghost');
assert.equal(runtime.chart[15][16], 1, 'Modern steel does not resist dark');
assert.equal(runtime.chart[17][14], 2, 'Fairy vs dragon');
assert.equal(runtime.multiplier(-1, runtime.pokemon[0]), 1);
assert.equal(runtime.multiplier(18, runtime.pokemon[0]), 1);
assert.equal(runtime.multiplier(1, null), 1);
assert.equal(runtime.multiplier(1, { types: [] }), 1);
assert.equal(
  runtime.multiplier(2, { types: [12, 12] }),
  2,
  'Do not multiply duplicate defensive types',
);
for (const mon of runtime.pokemon)
  for (let attack = 0; attack < 18; attack++)
    assert.ok([0, 0.25, 0.5, 1, 2, 4].includes(runtime.multiplier(attack, mon)));
for (const factor of [0, 0.25, 0.5, 1, 2, 4])
  assert.equal(runtime.charge(12, 3, 1, factor, 3), 12 * factor);
assert.equal(runtime.charge(12, 3, 1, true, 3), 24, 'Legacy boolean caller');
assert.equal(runtime.charge(12, 3, 1, false, 3), 12);
assert.equal(
  runtime.battleMultiplier(5, { m: runtime.pokemon[441], safari: true }),
  1,
  'Friendship ignores immunity',
);
assert.equal(runtime.battleMultiplier(5, { m: runtime.pokemon[441], safari: false }), 0);
assert.equal(runtime.best(runtime.pokemon[73], [0, 1, 2]).factor, 4);
assert.equal(runtime.best(runtime.pokemon[441], [5, 8, 10]).factor, 0);
assert.ok(runtime.label(0).includes('ない'));
assert.ok(runtime.label(0.25).includes('いまひとつ'));
assert.ok(runtime.label(4).includes('×4'));
assert.throws(() => build(names, source.slice(1)), /18×18/);
assert.throws(() => build(names, source.concat([source[0]])), /Invalid type pair/);
const bad = source.map((row) => [...row]);
bad[0][2] = '500';
assert.throws(() => build(names, bad), /Invalid type pair/);
assert.throws(
  () => build(names.concat([names.find((row) => row[1] === '11' && row[2] === 'くさ')]), source),
  /duplicate type name/,
);
console.log(
  'PASS: all 324 pairs, 1025 dual types, immunity, charge multipliers, Safari neutrality and source validation',
);
