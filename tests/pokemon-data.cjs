// 外部データの誤りを拒否し、ゲーム内の属性番号・保存ID・既存火力との互換性を検証する。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validate, GAME_TYPES } = require('../scripts/import-pokemon-data.cjs');
const root = path.resolve(__dirname, '..');
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/pokemon.json'), 'utf8'));
const reference = JSON.parse(
  fs.readFileSync(path.join(root, 'data/pokemon-reference.json'), 'utf8'),
);
const context = vm.createContext({});
for (const file of [
  'pokemon-data.generated.js',
  'pokemon-data.js',
  'party-rules.js',
  'map-config.js',
  'type-balls.js',
])
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
const entries = JSON.parse(vm.runInContext('JSON.stringify(POKEDEX)', context));
assert.deepEqual(
  JSON.parse(vm.runInContext('JSON.stringify(POKEMON_TYPE_NAMES)', context)),
  GAME_TYPES,
);
for (let index = 0; index < 1025; index++) {
  const mon = entries[index],
    source = snapshot.pokemon[index];
  assert.equal(mon.id, index + 1);
  assert.equal(mon.name, source.name);
  assert.equal(mon.label, source.name);
  assert.equal(mon.description, source.description.trim());
  assert.deepEqual(
    mon.types.map((type) => GAME_TYPES[type]),
    reference.pokemon[index].types,
  );
  assert.equal(mon.type, mon.types[0]);
  assert.equal(mon.placeholder, false);
  assert.equal(mon.power, index < 9 ? [11, 14, 17][index % 3] : 11);
}
assert.deepEqual(entries[247].types, [12, 15]); // バンギラス: いわ・あく。じめんに戻さない。
assert.equal(entries[445].name, 'ゴンベ');
assert.equal(entries[1024].name, 'モモワロウ');
assert.equal(vm.runInContext('typeBallMatches(TYPE_BALLS[15], POKEDEX[247])', context), true);
assert.equal(vm.runInContext('typeBallMatches(TYPE_BALLS[9], POKEDEX[247])', context), false);
function rejects(change, pattern) {
  const data = structuredClone(snapshot);
  change(data.pokemon);
  assert.throws(() => validate(data, reference), pattern);
}
rejects((rows) => {
  rows[247].types = ['いわ', 'じめん'];
}, /Type mismatch: 248/);
rejects((rows) => {
  rows[0].name += '\r';
}, /Name mismatch: 1/);
rejects((rows) => {
  rows[0].id = 1025;
}, /Name mismatch|duplicate ID/);
rejects((rows) => {
  rows[445].description = '';
}, /description: 446/);
rejects((rows) => {
  rows.pop();
}, /1025/);
console.log(
  'PASS: 1025 metadata entries, game type mapping, custom power and invalid-source rejection',
);
