// 共通ルールを隔離したVMへ読み込み、セーブ互換性と交換・捕獲の境界条件を検証する。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
for (const file of [
  'pokemon-data.generated.js',
  'pokemon-data.js',
  'party-rules.js',
  'map-config.js',
  'type-balls.js',
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
vm.runInContext(fs.readFileSync(path.join(__dirname, 'type-balls-cases.js'), 'utf8'), context);
console.log(
  'PASS: legacy saves, stable Kurt houses, exchange validation, type matching and capture caps',
);
