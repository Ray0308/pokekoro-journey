'use strict';
// 地域の候補とレア度を元に抽選。捕獲済みの重みだけを軽減する。
const OWNED_ENCOUNTER_WEIGHT = 0.6;
function mapEncounterWeights(mapId, owned = []) {
  const pool = MAP_ENCOUNTERS[mapId];
  if (!pool?.length) throw new Error('地域の出現候補が未設定: ' + mapId);
  const caught = new Set(Array.isArray(owned) ? owned : []);
  const count = pool.filter(([id]) => caught.has(id)).length;
  // 全捕獲/未捕獲なら元の数値のまま。生成された候補データは変更しない。
  const weighted =
    count > 0 && count < pool.length
      ? pool.map(([id, weight]) => [id, weight * (caught.has(id) ? OWNED_ENCOUNTER_WEIGHT : 1)])
      : pool;
  return weighted;
}
function chooseMapEncounter(mapId, rng = Math.random, owned = []) {
  const weighted = mapEncounterWeights(mapId, owned);
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.max(0, Math.min(1 - Number.EPSILON, Number(rng()) || 0)) * total;
  for (const [id, weight] of weighted) {
    if (roll < weight) return id;
    roll -= weight;
  }
  return weighted.at(-1)[0];
}
