// 出典付きの訂正が旧データで上書きされず、説明以外へ変更が広がらないことを検査する。
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const snapshot = require('../data/pokemon.json');
const review = require('../data/pokemon-description-corrections.json');
const byId = new Map(snapshot.pokemon.map((mon) => [mon.id, mon]));
const changedIds = new Set();
const normalize = (text) => text.replace(/\s+/gu, ' ').trim();
assert.equal(review.review.total, 1025);
assert.match(review.source.commit, /^[a-f0-9]{40}$/);
assert.match(review.source.sha256, /^[a-f0-9]{64}$/);
for (const change of review.changes) {
  assert.ok(byId.has(change.id), `Unknown species: ${change.id}`);
  assert.ok(!changedIds.has(change.id), `Duplicate correction: ${change.id}`);
  changedIds.add(change.id);
  assert.equal(change.name, byId.get(change.id).name);
  assert.equal(change.after, byId.get(change.id).description);
  assert.notEqual(change.before, change.after);
  assert.ok(change.reason.trim());
  assert.equal(change.evidence.speciesId, change.id);
  assert.ok(Number.isInteger(change.evidence.versionId));
  assert.ok(change.evidence.text.trim());
  if (change.method === 'official-ja-whitespace-normalized') {
    assert.equal(change.evidence.languageId, 11);
    assert.equal(change.after, normalize(change.evidence.text));
  } else {
    assert.equal(change.method, 'editorial-ja-summary-of-official-en');
    assert.equal(change.evidence.languageId, 9);
    assert.match(change.after, /[ぁ-んァ-ヶ一-龯]/u);
  }
}
// 地名だけで別フォルムと誤判定しない。実在するシールド図鑑文は残す。
for (const source of review.review.retainedOfficialExamples) {
  assert.ok(!changedIds.has(source.id));
  assert.equal(byId.get(source.id).description, normalize(source.text));
}
assert.match(byId.get(124).description, /ガラルの ルージュラ/);
assert.match(byId.get(128).description, /ガラルに 暮らす/);
assert.ok(!changedIds.has(193)); // 家を持ち上げる風も Legends: Arceus の英語原文に実在する。
// 具体的な混同を回帰検査。IDに紐づけ、全図鑑への単語禁止にはしない。
const facts = [
  [353, /恨みや ねたみ/, /捨てられた 人形/],
  [371, /飛ぶ 練習/, /翼を 鍛える/],
  [391, /尻尾の 炎/, /手足から 炎/],
  [394, /群れを 作らず/, /群れを 作って/],
  [401, /触覚/, /足を こすり/],
  [459, /春に なると.*山頂に 戻/, /春になると 山を 下りる/],
  [538, /帯を 締める/, /赤い 帯/],
  [584, /２つの 頭/, /三つの 頭/],
  [606, /光る 指/, /頭の 模様が 光る/],
  [895, /腕の 形/, /頭の 形が 竜/],
  [974, /陸で 暮らす/, /海で 暮らす/],
  [975, /雪と 氷に 覆われた 土地/, /海を.*泳ぐ/],
  [996, /熱を 吸収/, /寒さを 感じ/],
];
for (const [id, correct, incorrect] of facts) {
  assert.match(byId.get(id).description, correct);
  assert.doesNotMatch(byId.get(id).description, incorrect);
}
const nonDescriptions = snapshot.pokemon.map((mon) =>
  Object.fromEntries(
    Object.entries(mon)
      .filter(([key]) => key !== 'description')
      .sort(([a], [b]) => a.localeCompare(b, 'en')),
  ),
);
assert.equal(
  crypto.createHash('sha256').update(JSON.stringify(nonDescriptions)).digest('hex'),
  review.review.nonDescriptionPokemonSha256,
  'Names, ordered types and IDs must remain unchanged by a description-only correction',
);
console.log(
  `PASS: ${review.changes.length} sourced corrections, retained regional descriptions and unchanged identity/type data`,
);
