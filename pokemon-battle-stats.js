'use strict';
// 種族値から本作用の火力・耐久・ゲージ速度へ変換する。原作のレベル計算とは別。
// セーブには保存せず、同じ計算をパズル・攻撃技・予測表示で共有する。
const PokemonBattleStats = (() => {
  const config = Object.freeze({
    power: 11,
    hpMin: 0.75,
    hpMax: 1.6,
    defenseMin: 0.55,
    defenseMax: 1.45,
    gaugeMin: 850,
    gaugeMax: 1400,
    gaugeUnit: 1000,
  });
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function category(mon) {
    return mon.stats.attack >= mon.stats.specialAttack ? 'physical' : 'special';
  }
  // 技データ導入時には分類を明示できる。現在の共通攻撃は本人の得意側を使う。
  function power(mon, enemy = null, kind = category(mon)) {
    const physical = kind === 'physical';
    const offense = physical ? mon.stats.attack : mon.stats.specialAttack;
    const defense = enemy && (physical ? enemy.stats.defense : enemy.stats.specialDefense);
    const resistance = enemy
      ? clamp(160 / (80 + defense), config.defenseMin, config.defenseMax)
      : 1;
    return config.power * (0.5 + offense / 160) * resistance;
  }
  function enemyHP(mon, baseHP) {
    return Math.max(
      1,
      Math.round(baseHP * clamp(0.7 + mon.stats.hp / 240, config.hpMin, config.hpMax)),
    );
  }
  // 1個あたりの蓄積を1000分率で扱い、消去を分割しても丸めによる損失を出さない。
  function gaugeUnits(mon) {
    return clamp(Math.round(800 + mon.stats.speed * (10 / 3)), config.gaugeMin, config.gaugeMax);
  }
  function style(mon) {
    return category(mon) === 'physical' ? 'こうげき型' : 'とくこう型';
  }
  function gaugeLabel(mon) {
    const units = gaugeUnits(mon);
    return units < 1000 ? 'ゆっくり' : units >= 1150 ? 'はやめ' : 'ふつう';
  }
  return Object.freeze({ config, category, power, enemyHP, gaugeUnits, style, gaugeLabel });
})();
