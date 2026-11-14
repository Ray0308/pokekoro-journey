// 編成の編集元はJSON。ポケモン名で参照せず、全国図鑑番号と既存マップ・素材を検査して生成する。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const prettier = require('prettier');
const root = path.resolve(__dirname, '..');
function validate(data, pokemon, maps, rareIds) {
  const ids = new Set(pokemon.map((p) => p.id));
  const checkIds = (list, label, unique = true) => {
    if (!Array.isArray(list) || !list.length || list.some((id) => !ids.has(id)))
      throw Error(`Invalid IDs: ${label}`);
    if (unique && new Set(list).size !== list.length) throw Error(`Duplicate IDs: ${label}`);
    if (list.some((id) => rareIds.includes(id)))
      throw Error(`Legendary/mythical in trainer roster: ${label}`);
  };
  if (data.schemaVersion !== 1) throw Error('Unsupported trainer schema');
  if (Object.values(data.battle).some((value) => !Number.isFinite(value) || value <= 0))
    throw Error('Invalid trainer battle tuning');
  for (const [key, job] of Object.entries(data.classes)) {
    checkIds(
      job.pool.map((p) => p.id),
      key,
    );
    checkIds(job.reserveIds, key + ' reserves');
    if (job.pool.some((p) => ![0, 1, 2].includes(p.stage)))
      throw Error('Invalid progression stage');
    if (
      job.pool.some(
        (p) => data.starterFamilyIds.includes(p.id) && !job.allowStarterIds?.includes(p.id),
      )
    )
      throw Error('Starter in general class: ' + key);
    if (job.reserveIds.some((id) => !job.pool.some((p) => p.id === id)))
      throw Error('Reserve outside profession');
    if (
      job.count.some((n) => !Number.isInteger(n)) ||
      job.count[0] < 1 ||
      job.count[1] > 6 ||
      job.count[0] > job.count[1]
    )
      throw Error('Invalid team size');
    for (const file of [job.image, job.icon, ...(job.variants || []).map((p) => p.image)])
      if (!fs.existsSync(path.join(root, file))) throw Error('Missing trainer art: ' + file);
  }
  for (const [id, map] of Object.entries(maps)) {
    if (map.boss.wild) continue;
    const config = data.maps[id];
    if (!config || !config.jobs.length || config.jobs.some((job) => !data.classes[job]))
      throw Error('Missing map profession: ' + id);
    for (const job of config.bossClasses || [])
      if (!data.classes[job]) throw Error('Unknown boss profession');
    if (
      !data.bosses[id] &&
      !config.bossClasses?.length &&
      ![data.rival.mid.mapId, data.rival.late.mapId].includes(id)
    )
      throw Error('Missing boss formation: ' + id);
    if (config.poolIds) checkIds(config.poolIds, id);
    if (
      !config.levelRange.every((level) => Number.isInteger(level) && level >= 1 && level <= 100) ||
      config.levelRange[0] > config.levelRange[1]
    )
      throw Error('Invalid map levels: ' + id);
    if (config.appearanceClass && !data.classes[config.appearanceClass])
      throw Error('Unknown trainer artwork class');
    for (const [job, list] of Object.entries(config.classPoolIds || {})) {
      checkIds(list, id + '/' + job);
      if (!data.classes[job] || list.some((id) => !data.classes[job].pool.some((p) => p.id === id)))
        throw Error('Location pool outside profession');
    }
  }
  for (const [id, boss] of Object.entries(data.bosses)) {
    if (!maps[id]) throw Error('Unknown boss map');
    checkIds(boss.fixedIds, id);
    if (
      boss.fixedIds.length !== boss.levels.length ||
      boss.fixedIds.length > 6 ||
      boss.levels.some((level) => !Number.isInteger(level) || level < 1 || level > 100)
    )
      throw Error('Invalid fixed levels');
    if (boss.rematchIds.length) checkIds(boss.rematchIds, id + ' rematch');
  }
  for (const phase of ['mid', 'late']) checkIds(data.rival[phase].poolIds, 'rival ' + phase);
  checkIds(data.rival.starterIds, 'rival starter families');
  checkIds(data.rival.starterMidIds, 'rival middle evolutions');
  checkIds(data.rival.starterFinalIds, 'rival final evolutions');
  for (const phase of ['mid', 'late']) checkIds([data.rival[phase].fixedId], 'rival lead');
  return data;
}
async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/trainer-rosters.json'), 'utf8'));
  const pokemon = JSON.parse(fs.readFileSync(path.join(root, 'data/pokemon.json'), 'utf8')).pokemon;
  const context = vm.createContext({});
  for (const file of [
    'pokemon-data.generated.js',
    'pokemon-stats.generated.js',
    'pokemon-data.js',
    'map-config.js',
    'rainbow-config.js',
  ])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  validate(
    data,
    pokemon,
    vm.runInContext('MAPS', context),
    vm.runInContext('RAINBOW_IDS', context),
  );
  const output = path.join(root, 'trainer-rosters.generated.js');
  const source = await prettier.format(
    "'use strict';\n// 自動生成: npm run trainers:generate。編集元は data/trainer-rosters.json。\nconst TRAINER_ROSTERS = (() => {\nconst data=" +
      JSON.stringify(data) +
      ';\nfunction freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }\nreturn freeze(data);\n})();\n',
    { ...(await prettier.resolveConfig(output)), parser: 'babel' },
  );
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== source)
      throw Error('Trainer data stale. Run npm run trainers:generate');
  } else fs.writeFileSync(output, source);
  console.log('PASS: trainer IDs, uniqueness, professions, fixed bosses, map coverage and artwork');
}
module.exports = { validate };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
