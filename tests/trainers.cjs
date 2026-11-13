// 編成ルールを独立VMで実行する。野生抽選やDOM・音声を使わず、契約とセーブ互換を検査する。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ assert: require('node:assert/strict') });
for (const file of [
  'pokemon-data.generated.js',
  'pokemon-data.js',
  'map-config.js',
  'rainbow-config.js',
  'party-rules.js',
  'trainer-rosters.generated.js',
  'trainer-rules.js',
])
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
vm.runInContext(fs.readFileSync(path.join(__dirname, 'trainer-cases.js'), 'utf8'), context);
// 後からJSONを調整した時も、不正な編成を生成段階で止める。
const assert = require('node:assert/strict');
const { validate } = require('../scripts/build-trainer-data.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/trainer-rosters.json'), 'utf8'));
const master = JSON.parse(fs.readFileSync(path.join(root, 'data/pokemon.json'), 'utf8')).pokemon;
for (const [change, pattern] of [
  [
    (data) => {
      data.bosses['fuchsia-gym'].fixedIds[2] = 109;
    },
    /Duplicate IDs/,
  ],
  [
    (data) => {
      data.classes['bug-catcher'].pool[0].id = 150;
    },
    /Legendary/,
  ],
  [
    (data) => {
      data.classes['bug-catcher'].pool[0].id = 906;
    },
    /Starter/,
  ],
  [
    (data) => {
      data.classes['bug-catcher'].pool[0].id = 1026;
    },
    /Invalid IDs/,
  ],
  [
    (data) => {
      data.maps['pewter-gym'].jobs = [];
    },
    /Missing map profession/,
  ],
  [
    (data) => {
      data.battle.bossAceHp = 0;
    },
    /Invalid trainer battle tuning/,
  ],
]) {
  const data = structuredClone(source);
  change(data);
  assert.throws(
    () =>
      validate(
        data,
        master,
        vm.runInContext('MAPS', context),
        vm.runInContext('RAINBOW_IDS', context),
      ),
    pattern,
  );
}
console.log(
  'PASS: fixed teams, all professions/generations, uniqueness, reserves, progression, rivals and legacy saves',
);
