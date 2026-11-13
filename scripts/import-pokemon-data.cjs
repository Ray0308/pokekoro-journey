// シートのスナップショットを検査して、同期起動で使えるゲーム用データを生成する。
// 通信・シートへの書き込みは行わない。誤りは自動修正せず、生成を止めて元データへ戻す。
const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');
const root = path.resolve(__dirname, '..');
const GAME_TYPES = [
  'くさ',
  'ほのお',
  'みず',
  'どく',
  'ひこう',
  'ノーマル',
  'でんき',
  'こおり',
  'かくとう',
  'じめん',
  'エスパー',
  'むし',
  'いわ',
  'ゴースト',
  'ドラゴン',
  'あく',
  'はがね',
  'フェアリー',
];

function validate(snapshot, reference) {
  if (snapshot.schemaVersion !== 1 || reference.schemaVersion !== 1)
    throw new Error('Unsupported Pokémon data schema');
  if (snapshot.pokemon?.length !== 1025 || reference.pokemon?.length !== 1025)
    throw new Error('Expected 1025 Pokémon in both sources');
  const expected = new Map(reference.pokemon.map((mon) => [mon.id, mon]));
  if (expected.size !== 1025) throw new Error('Duplicate reference ID');
  const ids = new Set();
  const metadata = snapshot.pokemon.map((mon) => {
    if (!Number.isInteger(mon.id) || mon.id < 1 || mon.id > 1025 || ids.has(mon.id))
      throw new Error(`Invalid or duplicate ID: ${mon.id}`);
    ids.add(mon.id);
    const canonical = expected.get(mon.id);
    if (
      typeof mon.name !== 'string' ||
      mon.name !== mon.name.trim() ||
      mon.name !== canonical?.name
    )
      throw new Error(`Name mismatch: ${mon.id}`);
    if (
      !Array.isArray(mon.types) ||
      mon.types.length < 1 ||
      mon.types.length > 2 ||
      new Set(mon.types).size !== mon.types.length ||
      mon.types.some((type) => !GAME_TYPES.includes(type)) ||
      JSON.stringify(mon.types) !== JSON.stringify(canonical.types)
    )
      throw new Error(`Type mismatch: ${mon.id}`);
    if (
      typeof mon.description !== 'string' ||
      !mon.description.trim() ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(mon.description)
    )
      throw new Error(`Missing or invalid description: ${mon.id}`);
    return {
      id: mon.id,
      name: mon.name,
      types: mon.types.map((type) => GAME_TYPES.indexOf(type)),
      description: mon.description.trim(),
    };
  });
  return metadata.sort((a, b) => a.id - b.id);
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/pokemon.json'), 'utf8'));
  const reference = JSON.parse(
    fs.readFileSync(path.join(root, 'data/pokemon-reference.json'), 'utf8'),
  );
  const metadata = validate(snapshot, reference);
  const output = path.join(root, 'pokemon-data.generated.js');
  const config = await prettier.resolveConfig(output);
  const source = await prettier.format(
    "'use strict';\n// 自動生成: npm run data:generate。編集元は data/pokemon.json。\n" +
      '// 名前・タイプは参照データと全件照合。説明はユーザー提供の要約文。\n' +
      `const POKEMON_METADATA = Object.freeze(${JSON.stringify(metadata)});\n`,
    { ...config, parser: 'babel' },
  );
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== source)
      throw new Error('Generated metadata is stale. Run npm run data:generate');
  } else fs.writeFileSync(output, source);
  console.log(
    `PASS: ${metadata.length} names, ordered types and descriptions; generated data ${process.argv.includes('--check') ? 'current' : 'written'}`,
  );
}

module.exports = { validate, GAME_TYPES };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
