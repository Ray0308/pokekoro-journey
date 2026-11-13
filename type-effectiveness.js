'use strict';
// 相手の主・副属性へ掛け合わせる。特性や個別の技の例外は、この属性パズルには適用しない。
function pokemonTypeMultiplier(attackType, mon) {
  if (!Number.isInteger(attackType) || attackType < 0 || attackType >= TYPE_CHART.length) return 1;
  return pokemonTypes(mon).reduce((factor, defense) => factor * TYPE_CHART[attackType][defense], 1);
}
function typeEffectivenessLabel(factor) {
  if (factor === 0) return 'こうかが ない';
  if (factor < 1) return `こうかは いまひとつ（×${factor}）`;
  if (factor > 1) return `こうかばつぐん！（×${factor}）`;
  return '';
}
function bestTypeMatchup(mon, partyTypeIds) {
  return (
    partyTypeIds
      .map((type) => ({ type, factor: pokemonTypeMultiplier(type, mon) }))
      .sort((a, b) => b.factor - a.factor)[0] || null
  );
}
function battleTypeMultiplier(attackType, currentBattle) {
  return currentBattle.safari ? 1 : pokemonTypeMultiplier(attackType, currentBattle.m);
}
