'use strict';
// 殿堂入りは実際のチャンピオン勝利ごとに記録。旧クリア履歴から回数を推測しない。
const HallOfFameRules = (() => {
  const stages = ['ceremony', 'oak-celebrate', 'oak-request'];
  function normalize(value) {
    const count = Number.isSafeInteger(value?.count) && value.count >= 0 ? value.count : 0;
    const seen = new Set();
    const records = (Array.isArray(value?.records) ? value.records : [])
      .filter((r) => {
        if (
          !Number.isSafeInteger(r?.id) ||
          r.id < 1 ||
          r.id > count ||
          seen.has(r.id) ||
          !Array.isArray(r.team) ||
          !r.team.length ||
          r.team.length > 6 ||
          !r.team.every(validPokemonId) ||
          new Set(r.team).size !== r.team.length ||
          typeof r.name !== 'string'
        )
          return false;
        seen.add(r.id);
        return true;
      })
      .sort((a, b) => a.id - b.id)
      .slice(-50)
      .map((r) => ({
        id: r.id,
        name: r.name.slice(0, 32),
        team: [...r.team],
        date: typeof r.date === 'string' ? r.date : '',
      }));
    const pending = records.some((r) => r.id === value?.pending?.id)
      ? {
          id: value.pending.id,
          stage: stages.includes(value.pending.stage) ? value.pending.stage : 'ceremony',
        }
      : null;
    return { count, records, pending, researchIntroduced: value?.researchIntroduced === true };
  }
  function add(save, battle, team, date = new Date().toISOString()) {
    const hall = (save.hallOfFame = normalize(save.hallOfFame));
    if (battle.hallRecordId) return hall.records.find((r) => r.id === battle.hallRecordId) || null;
    const ids = [...new Set(team.filter(validPokemonId))].slice(0, 6);
    if (!ids.length || hall.count >= Number.MAX_SAFE_INTEGER) return null;
    const entry = {
      id: hall.count + 1,
      name: String(save.playerName || 'トレーナー').slice(0, 32),
      team: ids,
      date,
    };
    hall.count = entry.id;
    hall.records.push(entry);
    hall.records = hall.records.slice(-50);
    hall.pending = { id: entry.id, stage: 'ceremony' };
    battle.hallRecordId = entry.id;
    return entry;
  }
  return Object.freeze({ normalize, add, stages });
})();
