// 正規化・主副タイプ・所持候補・未遭遇の情報非開示を、実データと境界例で検証する。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({});
for (const file of [
  'pokemon-data.generated.js',
  'pokemon-stats.generated.js',
  'pokemon-battle-stats.js',
  'pokemon-data.js',
  'party-rules.js',
  'pokedex-filters.js',
])
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
const normalize = (name) =>
  vm.runInContext(`PokekoroDexFilter.normalizeName(${JSON.stringify(name)})`, ctx);
const ids = (options) =>
  JSON.parse(
    vm.runInContext(
      `JSON.stringify(PokekoroDexFilter.filter(POKEDEX, ${JSON.stringify(options)}).map(m => m.id))`,
      ctx,
    ),
  );
assert.equal(normalize('ゴンベ'), 'こんへ');
assert.equal(normalize('ｺﾞﾝﾍﾞ'), normalize('ごんべ'));
assert.equal(normalize('ピッピ'), normalize('ひつひ'));
assert.equal(normalize('ニャオハ'), normalize('にやおは'));
assert.equal(normalize('ポリゴンＺ'), 'ほりこんZ');
assert.equal(ids({}).length, 1025); // 未絞り込みの図鑑は未遭遇の番号欄も保つ。
assert.deepEqual(ids({ picking: true, owned: [446, 7] }), [7, 446]);
assert.deepEqual(ids({ picking: true, owned: [] }), []);
assert.deepEqual(ids({ name: 'こ', seen: [446, 1, 7], owned: [] }), [446]);
assert.deepEqual(ids({ name: 'ごんべ', owned: [446] }), [446]);
assert.deepEqual(ids({ name: 'り', type: 1, owned: [5, 6, 447] }), [5, 6]);
assert.deepEqual(ids({ type: 4, owned: [6, 7] }), [6]); // リザードンの副タイプ・ひこう。
assert.deepEqual(ids({ type: 1, owned: [6, 7] }), [6]);
assert.deepEqual(ids({ type: 0, seen: [], owned: [] }), []); // 名前・属性検索で未遭遇を明かさない。
assert.deepEqual(ids({ name: 'みゅ', seen: [], owned: [] }), []);
assert.deepEqual(ids({ name: 'あいうえお', picking: true, owned: [1, 446] }), []);
assert.deepEqual(ids({ type: 15, picking: true, owned: [248, 446] }), [248]);
const all = Array.from({ length: 1025 }, (_, i) => i + 1);
for (let type = 0; type < 18; type++) {
  const matches = ids({ type, seen: all });
  assert.ok(matches.length > 0);
  assert.equal(new Set(matches).size, matches.length);
}
console.log(
  'PASS: kana normalization, prefix + both-type filtering, owned-only picker and unseen-data isolation',
);
