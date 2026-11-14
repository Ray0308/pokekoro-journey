// シートから書き出して構造化した能力案を検査し、通信なしで読み込める代表技表を作る。
const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');
const root = path.resolve(__dirname, '..');
function validate(data) {
  if (data.schemaVersion !== 1 || !Array.isArray(data.moves) || !Array.isArray(data.pokemon))
    throw Error('Invalid skill schema');
  const categories = ['attack', 'boost', 'guard', 'board', 'support', 'revive'];
  const ids = new Set();
  for (const skill of data.moves) {
    if (!Number.isInteger(skill.id) || skill.id <= 0 || ids.has(skill.id))
      throw Error('Invalid/duplicate move ID');
    ids.add(skill.id);
    if (!skill.name?.trim() || !categories.includes(skill.category))
      throw Error('Invalid move category/name');
    if (!Number.isInteger(skill.type) || skill.type < 0 || skill.type > 17)
      throw Error('Invalid move type');
    if (!Number.isInteger(skill.cost) || skill.cost < 1 || skill.cost > 100)
      throw Error('Invalid move cost');
    const positive = (key) => {
      if (!Number.isFinite(skill[key]) || skill[key] <= 0)
        throw Error(`Invalid move ${key}: ${skill.id}`);
    };
    if (skill.category === 'attack') {
      positive('power');
      if (
        !['physical', 'special', 'best'].includes(skill.damageClass) ||
        !['scaled', 'percent', 'counter', 'fainted', 'sacrifice'].includes(skill.mode) ||
        !['self', 'move'].includes(skill.attackType)
      )
        throw Error('Invalid attack mode');
      if (skill.mode === 'percent') {
        positive('percent');
        positive('damageCap');
        if (skill.percent > 100) throw Error('Invalid percent');
      }
      if (skill.mode === 'counter') positive('enhancedPower');
      if (skill.mode === 'fainted') {
        positive('powerStep');
        positive('powerCap');
      }
    }
    if (skill.category === 'boost') {
      positive('multiplier');
      if (skill.multiplier <= 1) throw Error('Invalid boost');
    }
    if (skill.category === 'support') {
      positive('amount');
      if (!Number.isInteger(skill.amount)) throw Error('Invalid support amount');
      if (!['ally', 'allAllies'].includes(skill.target)) throw Error('Invalid support target');
    }
    if (skill.category === 'revive' && skill.target !== 'faintedAlly')
      throw Error('Invalid revival target');
    if (skill.category === 'board') {
      if (!['convert', 'redraw', 'allyType'].includes(skill.mode))
        throw Error('Invalid board mode');
      positive('amount');
      if (!Number.isInteger(skill.amount) || skill.amount > 36) throw Error('Invalid board amount');
      if (
        skill.mode === 'convert' &&
        (!Number.isInteger(skill.convertType) || skill.convertType < 0 || skill.convertType > 17)
      )
        throw Error('Invalid conversion type');
    }
  }
  if (data.pokemon.length !== 1025) throw Error('Expected 1025 skill assignments');
  const pokemon = new Set();
  for (const [id, move] of data.pokemon) {
    if (!Number.isInteger(id) || id < 1 || id > 1025 || pokemon.has(id) || !ids.has(move))
      throw Error('Invalid/duplicate Pokémon skill assignment');
    pokemon.add(id);
  }
  return data;
}
async function main() {
  const data = validate(
    JSON.parse(fs.readFileSync(path.join(root, 'data/pokemon-skills.json'), 'utf8')),
  );
  const output = path.join(root, 'pokemon-skills.generated.js');
  const config = await prettier.resolveConfig(output);
  const rows = data.moves.map(({ designEffect, designState, ...skill }) => skill);
  const source = await prettier.format(
    "'use strict';\n// 自動生成: npm run skills:generate。編集元はdata/pokemon-skills.json。\n" +
      `const POKEMON_SKILL_DATA = Object.freeze({ moves: Object.freeze(Object.fromEntries(${JSON.stringify(rows)}.map(s => [s.id, Object.freeze(s)]))), pokemon: Object.freeze(Object.fromEntries(${JSON.stringify(data.pokemon)})) });\n`,
    { ...config, parser: 'babel' },
  );
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== source)
      throw Error('Stale skills. Run npm run skills:generate');
  } else fs.writeFileSync(output, source);
  console.log(
    `PASS: ${data.moves.length} skills, 1025 assignments, six categories and generated data ${process.argv.includes('--check') ? 'current' : 'written'}`,
  );
}
module.exports = { validate };
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
