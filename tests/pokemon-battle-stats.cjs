// 固定データの6項目と、物理/特殊・耐久・ゲージの実戦への接続を検査する。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseStats } = require('../scripts/import-pokemon-stats.cjs');
const csv = fs.readFileSync('data/reference/pokemon-stats.csv', 'utf8');
const rows = parseStats(csv);
assert.equal(rows.length, 1025);
assert.deepEqual(rows[5], [6, 78, 84, 78, 109, 85, 100]);
assert.deepEqual(rows[94], [95, 35, 45, 160, 30, 45, 70]);
assert.deepEqual(rows[445], [446, 135, 85, 40, 40, 85, 5]);
assert.deepEqual(rows[1024], [1025, 88, 88, 160, 88, 88, 88]);
assert.throws(() => parseStats(csv.trimEnd() + '\n1,1,45,0'), /Duplicate/);
assert.throws(() => parseStats(csv.replace('1,1,45,0\n', '')), /Missing/);
assert.throws(() => parseStats(csv.replace('1,1,45,0', '1,1,0,0')), /Invalid base stat/);
assert.throws(() => parseStats(csv.replace('1,1,45,0', '1,7,45,0')), /Invalid stat ID/);
const context = vm.createContext({ assert });
for (const file of [
  'pokemon-data.generated.js',
  'pokemon-stats.generated.js',
  'pokemon-data.js',
  'pokemon-battle-stats.js',
  'party-rules.js',
  'type-chart.generated.js',
  'type-effectiveness.js',
  'battle-turn-rules.js',
])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
vm.runInContext(
  `
const s = PokemonBattleStats, rules = BattleTurnRules;
const charizard = POKEDEX[5], machamp = POKEDEX[67], onix = POKEDEX[94], gonbe = POKEDEX[445];
assert.equal(s.category(charizard), 'special');
assert.equal(s.category(machamp), 'physical');
assert.ok(Object.isFrozen(gonbe.stats));
assert.throws(() => { 'use strict'; gonbe.stats.hp = 1; }, TypeError);
const balanced = { stats: { hp: 80, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed: 60 } };
const wall = { stats: { ...balanced.stats, defense: 200, specialDefense: 40 } };
assert.equal(s.power(balanced, balanced), 11);
assert.ok(s.power(machamp, wall) < s.power(machamp, balanced));
assert.ok(s.power(charizard, wall) > s.power(charizard, balanced));
assert.ok(s.power({...balanced, stats: {...balanced.stats, attack: 130}}, balanced) > s.power(balanced, balanced));
assert.ok(s.enemyHP(gonbe, 365) > s.enemyHP(onix, 365));
assert.ok(s.gaugeUnits(POKEDEX[100]) > s.gaugeUnits(gonbe));
// 同タイプの物理・特殊を合算前に評価する。旧なかよし計算は相手を渡さず維持。
const party = [4, 6];
assert.equal(partyTypePower(party, 1, onix), pokemonTypePower(POKEDEX[3], 1, onix) + pokemonTypePower(charizard, 1, onix));
assert.equal(partyTypePower([4], 1), 11);
assert.equal(partyTypePower([446], 1, onix), 0);
const split = rules.create([446]), joined = rules.create([446]);
rules.charge(joined, 5, 10);
for (let i = 0; i < 10; i++) rules.charge(split, 5, 1);
assert.equal(split.members[0].gauge, joined.members[0].gauge);
assert.equal(split.members[0].gaugeProgress, joined.members[0].gaugeProgress);
assert.equal(joined.members[0].gauge, 8);
const fast = rules.create([101]); rules.charge(fast, 6, 10);
assert.equal(fast.members[0].gauge, 12); assert.equal(fast.members[0].gaugeProgress, 0);
rules.charge(split, 5, 100); assert.equal(split.members[0].gauge, 12);
rules.retaliate(split, () => 0); assert.equal(split.members[0].gaugeProgress, 0);
rules.charge(split, 5, 100); assert.equal(split.members[0].gauge, 0);
const invalid = rules.create([446]);
for (const cells of [NaN, Infinity, -2, 1.5]) rules.charge(invalid, 5, cells);
assert.equal(invalid.members[0].gauge, 0);
assert.equal(rules.attackDamage(446, POKEDEX[93]), 0);
for (const mon of POKEDEX) {
  assert.ok(Object.values(mon.stats).every(n => Number.isInteger(n) && n > 0 && n <= 255));
  const hp = s.enemyHP(mon, 365);
  assert.ok(Number.isInteger(hp) && hp >= 274 && hp <= 584);
  assert.ok(s.gaugeUnits(mon) >= 850 && s.gaugeUnits(mon) <= 1400);
  for (const enemy of [onix, gonbe, POKEDEX[241], POKEDEX[212]]) {
    assert.ok(Number.isFinite(s.power(mon, enemy)) && s.power(mon, enemy) > 0);
    assert.ok(Number.isSafeInteger(rules.attackDamage(mon.id, enemy)));
  }
}
`,
  context,
);
console.log(
  'PASS: 1025 stat records, source rejection, physical/special matchups, HP, speed, fractional gauge, immunity, Safari legacy and unchanged fainting',
);
