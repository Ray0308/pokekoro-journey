'use strict';
// 抽選と同じ重みを参照し、現在の所持状態で一回の野生遭遇に出る割合を比較。
const PokemonHabitats = Object.freeze({
  find(id, stock = {}) {
    if (!validPokemonId(id)) return [];
    const ordinary = MAP_ORDER.flatMap((mapId, order) => {
      const pool = mapEncounterWeights(mapId, stock.owned),
        entry = pool.find(([n]) => n === id);
      return entry
        ? [
            {
              mapId,
              kind: 'wild',
              score: entry[1] / pool.reduce((sum, [, w]) => sum + w, 0),
              order,
            },
          ]
        : [];
    })
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, 3);
    const special = [];
    if (SAFARI_RULES.finalIds.includes(id)) special.push({ mapId: 'safari-zone', kind: 'safari' });
    if (id === 150 && !(stock.owned || []).includes(150))
      special.push({ mapId: 'cerulean-cave', kind: 'mewtwo' });
    if (CAVE_LEGENDARY_IDS.includes(id)) special.push({ mapId: 'cerulean-cave', kind: 'cave' });
    if (RAINBOW_IDS.includes(id)) special.push({ mapId: RAINBOW_CONFIG.mapId, kind: 'rainbow' });
    return [...ordinary, ...special];
  },
});
