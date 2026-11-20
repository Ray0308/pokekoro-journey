'use strict';
// 地域の候補から重み付き抽選。にじのくもの区分抽選は既存処理で行う。
function chooseMapEncounter(mapId, rng = Math.random) {
  const pool = MAP_ENCOUNTERS[mapId];
  if (!pool?.length) throw new Error('地域の出現候補が未設定: ' + mapId);
  const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.max(0, Math.min(1 - Number.EPSILON, Number(rng()) || 0)) * total;
  for (const [id, weight] of pool) {
    if (roll < weight) return id;
    roll -= weight;
  }
  return pool.at(-1)[0];
}
