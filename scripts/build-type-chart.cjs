// PokéAPIの固定スナップショットから、既存ゲームの属性順へ18×18の相性表を変換する。
// タイプ番号を直接流用しない。日本語名で対応を確認し、欠損・重複は生成を止める。
const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');
const { createHash } = require('node:crypto');
const { GAME_TYPES } = require('./import-pokemon-data.cjs');
const root = path.resolve(__dirname, '..');
function rows(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8').trim();
  return text
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(','));
}
function build(
  typeNames = rows('data/type-names.source.csv'),
  efficacy = rows('data/type-efficacy.source.csv'),
) {
  const names = typeNames.filter((row) => Number(row[1]) === 11);
  const ids = GAME_TYPES.map((name) => {
    const matches = names.filter((row) => row[2] === name);
    if (matches.length !== 1) throw Error('Missing/duplicate type name: ' + name);
    return Number(matches[0][0]);
  });
  if (ids.length !== 18 || new Set(ids).size !== 18) throw Error('Expected 18 unique types');
  const pairs = new Map();
  for (const [attack, defense, damage] of efficacy) {
    if (!ids.includes(Number(attack)) || !ids.includes(Number(defense))) continue;
    const key = attack + ':' + defense,
      value = Number(damage) / 100;
    if (pairs.has(key) || ![0, 0.5, 1, 2].includes(value)) throw Error('Invalid type pair: ' + key);
    pairs.set(key, value);
  }
  if (pairs.size !== 324) throw Error('Expected every pair in the 18×18 chart');
  return ids.map((attack) =>
    ids.map((defense) => {
      const value = pairs.get(attack + ':' + defense);
      if (value === undefined) throw Error('Missing type pair');
      return value;
    }),
  );
}
async function main() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'data/type-chart-source.json'), 'utf8'),
  );
  for (const file of manifest.files) {
    const hash = createHash('sha256')
      .update(fs.readFileSync(path.join(root, file.path)))
      .digest('hex');
    if (hash !== file.sha256)
      throw Error('Type source changed without provenance update: ' + file.path);
  }
  const chart = build(),
    output = path.join(root, 'type-chart.generated.js');
  const source = await prettier.format(
    "'use strict';\n// 自動生成: npm run types:generate。行が攻撃、列が防御。\n" +
      'const TYPE_CHART_NAMES = Object.freeze(' +
      JSON.stringify(GAME_TYPES) +
      ');\n' +
      'const TYPE_CHART = Object.freeze(' +
      JSON.stringify(chart) +
      '.map((row) => Object.freeze(row)));\n',
    { ...(await prettier.resolveConfig(output)), parser: 'babel' },
  );
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== source)
      throw Error('Type chart stale. Run npm run types:generate');
  } else fs.writeFileSync(output, source);
  console.log('PASS: all 324 type pairs, Japanese type mapping and generated chart');
}
module.exports = { build };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
