// 固定版のPokéAPI CSVから通常姿1025種の種族値を生成する。実行時の通信は不要。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const prettier = require('prettier');
const root = path.resolve(__dirname, '..');
const STAT_ORDER = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];
const SOURCE_COMMIT = '8a92bfa7dab2f12b84b5d151562f9857c133ff30';
const SOURCE_SHA256 = 'fa2c44263a3706468682fefc3e0b3c4f5487fe9febed7d4ebcd6939c34b16aa8';

function parseStats(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.shift() !== 'pokemon_id,stat_id,base_stat,effort')
    throw new Error('Unexpected Pokémon stats CSV header');
  const rows = Array.from({ length: 1025 }, (_, i) => [i + 1]);
  for (const line of lines) {
    const [id, stat, value] = line.split(',').map(Number);
    // 全国図鑑番号と同じ通常姿のpokemon_idのみ。別姿や合体後の数値を混ぜない。
    if (!Number.isInteger(id) || id < 1) throw new Error('Invalid Pokémon ID');
    if (id > 1025) continue;
    if (!Number.isInteger(stat) || stat < 1 || stat > 6) throw new Error(`Invalid stat ID: ${id}`);
    if (!Number.isInteger(value) || value < 1 || value > 255)
      throw new Error(`Invalid base stat: ${id}`);
    if (rows[id - 1][stat] !== undefined) throw new Error(`Duplicate base stat: ${id}`);
    rows[id - 1][stat] = value;
  }
  for (const row of rows)
    if (STAT_ORDER.some((_, i) => row[i + 1] === undefined))
      throw new Error(`Missing base stat: ${row[0]}`);
  return rows;
}

async function main() {
  const raw = fs.readFileSync(path.join(root, 'data/reference/pokemon-stats.csv'));
  if (crypto.createHash('sha256').update(raw).digest('hex') !== SOURCE_SHA256)
    throw new Error('Pokémon stats source hash mismatch');
  const rows = parseStats(raw.toString('utf8'));
  const snapshot = {
    schemaVersion: 1,
    source: {
      url: `https://raw.githubusercontent.com/PokeAPI/pokeapi/${SOURCE_COMMIT}/data/v2/csv/pokemon_stats.csv`,
      commit: SOURCE_COMMIT,
      sha256: SOURCE_SHA256,
      form: 'default pokemon_id = national species id, 1–1025',
    },
    statOrder: ['id', ...STAT_ORDER],
    pokemon: rows,
  };
  const config = await prettier.resolveConfig(path.join(root, 'pokemon-stats.generated.js'));
  const outputs = [
    [
      'data/pokemon-stats.json',
      await prettier.format(JSON.stringify(snapshot), { ...config, parser: 'json' }),
    ],
    [
      'pokemon-stats.generated.js',
      await prettier.format(
        "'use strict';\n// 自動生成: npm run stats:generate。編集元は固定版CSV。配列は全国図鑑No.順。\n" +
          `const POKEMON_BASE_STATS = Object.freeze(${JSON.stringify(rows.map((row) => row.slice(1)))}.map(([hp, attack, defense, specialAttack, specialDefense, speed]) => Object.freeze({hp, attack, defense, specialAttack, specialDefense, speed})));\n`,
        { ...config, parser: 'babel' },
      ),
    ],
  ];
  for (const [file, source] of outputs) {
    const output = path.join(root, file);
    if (process.argv.includes('--check')) {
      if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== source)
        throw new Error(`Generated stats are stale: ${file}. Run npm run stats:generate`);
    } else fs.writeFileSync(output, source);
  }
  console.log(
    `PASS: 1025 × 6 base stats; pinned source hash verified; generated data ${process.argv.includes('--check') ? 'current' : 'written'}`,
  );
}

module.exports = { parseStats, STAT_ORDER };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
