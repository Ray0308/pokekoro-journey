'use strict';
const prettier = require('prettier');
async function main() {
  const fs = require('node:fs'),
    crypto = require('node:crypto');
  const rules = JSON.parse(fs.readFileSync('data/map-encounter-rules.json', 'utf8'));
  const text = fs.readFileSync('data/reference/pokemon-species.csv', 'utf8');
  if (crypto.createHash('sha256').update(text).digest('hex') !== rules.speciesSource.sha256)
    throw Error('Species source hash mismatch');
  const lines = text.trim().split(/\r?\n/),
    keys = lines.shift().split(',');
  const rows = lines
    .map((line) => Object.fromEntries(line.split(',').map((v, i) => [keys[i], v])))
    .filter((r) => +r.id <= 1025);
  const parents = new Map(rows.map((r) => [+r.id, +r.evolves_from_species_id]));
  const hasChild = new Set(rows.map((r) => +r.evolves_from_species_id));
  function depth(id) {
    let n = 0;
    const seen = new Set();
    while (parents.get(id)) {
      if (seen.has(id)) throw Error('Evolution cycle');
      seen.add(id);
      id = parents.get(id);
      n++;
    }
    return n;
  }
  const catalog = {
    finalIds: rows
      .filter(
        (r) =>
          !hasChild.has(+r.id) &&
          depth(+r.id) >= 2 &&
          r.is_legendary === '0' &&
          r.is_mythical === '0',
      )
      .map((r) => +r.id),
    legendIds: rows
      .filter((r) => r.is_legendary === '1' && r.is_mythical === '0' && !hasChild.has(+r.id))
      .map((r) => +r.id),
  };
  const output = await prettier.format(
    "'use strict';\n// Generated from pinned pokemon-species.csv. Run npm run research:generate.\nconst RESEARCH_CATALOG = Object.freeze(" +
      JSON.stringify(catalog) +
      ');\n',
    { parser: 'babel', ...JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8')) },
  );
  if (process.argv.includes('--check')) {
    if (fs.readFileSync('research-data.generated.js', 'utf8') !== output)
      throw Error('Research data stale');
  } else fs.writeFileSync('research-data.generated.js', output);
  console.log(
    'PASS research catalog',
    catalog.finalIds.length,
    'third-stage finals,',
    catalog.legendIds.length,
    'legendary finals; pinned source verified',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
