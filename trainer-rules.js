'use strict';
// 職業・進行度・再戦記録から編成を作る。野生の抽選関数には依存しない。
function trainerRandom(rng) {
  return Math.max(0, Math.min(1 - Number.EPSILON, Number(rng()) || 0));
}
function trainerInt(min, max, rng) {
  return min + Math.floor(trainerRandom(rng) * (max - min + 1));
}
function trainerHash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}
function normalizeTrainerState(save, rng = Math.random) {
  const data = TRAINER_ROSTERS;
  if (!data.rival.starterIds.includes(save.rivalStarterId))
    save.rivalStarterId = data.rival.starterIds[trainerInt(0, 2, rng)];
  const wins = {};
  for (const id of Object.keys(data.maps)) {
    const value = save.trainerWins?.[id];
    if (Number.isSafeInteger(value) && value >= 0) wins[id] = Math.min(999, value);
    else if (save.clearedMaps?.includes(id)) wins[id] = 1;
  }
  save.trainerWins = wins;
  const teams = {};
  for (const phase of ['mid', 'late']) {
    const rule = data.rival[phase],
      team = save.rivalTeams?.[phase];
    const family = data.rival.starterIds.indexOf(save.rivalStarterId);
    const starter = data.rival[phase === 'mid' ? 'starterMidIds' : 'starterFinalIds'][family];
    if (
      Array.isArray(team) &&
      team.length === rule.count &&
      new Set(team).size === team.length &&
      team[0] === rule.fixedId &&
      team.at(-1) === starter &&
      team.slice(1, -1).every((id) => rule.poolIds.includes(id))
    )
      teams[phase] = [...team];
  }
  save.rivalTeams = teams;
}
function trainerClassAt(save, pos = save.pos) {
  const jobs = TRAINER_ROSTERS.maps[save.mapId]?.jobs;
  if (!jobs?.length) return null;
  return jobs[trainerHash(`${save.mapId}:${save.tour || 1}:${pos}`) % jobs.length];
}
function trainerProfile(classId, mapId, variant = 0) {
  const job = TRAINER_ROSTERS.classes[classId],
    map = TRAINER_ROSTERS.maps[mapId];
  const look = classId === 'gym-trainee' ? TRAINER_ROSTERS.classes[map.appearanceClass] : job;
  return {
    name: job.name,
    image: look.image,
    icon: look.icon,
    ball: 'assets/poke-ball.jpg',
    role: 'トレーナー',
    quote: job.quote,
    ...(job.variants?.[variant % job.variants.length] || {}),
  };
}
function trainerTileProfile(save, pos) {
  const classId = trainerClassAt(save, pos);
  return classId ? trainerProfile(classId, save.mapId, trainerHash(`${save.mapId}:${pos}`)) : null;
}
function trainerAllowed(id, job, map) {
  if (!validPokemonId(id) || RAINBOW_IDS.includes(id)) return false;
  if (TRAINER_ROSTERS.starterFamilyIds.includes(id) && !job.allowStarterIds?.includes(id))
    return false;
  return (
    !map.specialty ||
    POKEDEX[id - 1].types.some((type) => POKEMON_TYPE_NAMES[type] === map.specialty)
  );
}
function trainerCandidates(classId, mapId, count = 0, data = TRAINER_ROSTERS) {
  const job = data.classes[classId],
    map = data.maps[mapId];
  const eligible = (entry) =>
    entry.stage <= map.maxStage &&
    (map.stageWeights[entry.stage] ?? 1) > 0 &&
    trainerAllowed(entry.id, job, map);
  const allowed = map.classPoolIds?.[classId] || (classId === 'gym-trainee' ? map.poolIds : null);
  const candidates = job.pool.filter((p) => (!allowed || allowed.includes(p.id)) && eligible(p));
  if (candidates.length < count) {
    const reserve =
      map.classReserveIds?.[classId] ||
      (classId === 'gym-trainee' ? map.reserveIds : job.reserveIds);
    for (const id of reserve || []) {
      const entry = job.pool.find((p) => p.id === id);
      if (entry && eligible(entry) && !candidates.some((p) => p.id === id)) candidates.push(entry);
    }
  }
  return candidates;
}
function trainerSample(entries, count, rng, weights = [1, 1, 1]) {
  const pool = entries
    .map((entry) => (typeof entry === 'number' ? { id: entry, stage: 0 } : entry))
    .filter((entry) => (weights[entry.stage] ?? 1) > 0);
  if (pool.length < count) throw Error('Trainer profession has too few eligible Pokémon');
  const selected = [];
  while (selected.length < count) {
    const total = pool.reduce((sum, p) => sum + (weights[p.stage] ?? 1), 0);
    let roll = trainerRandom(rng) * total,
      index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[pool[i].stage] ?? 1;
      if (roll < 0) {
        index = i;
        break;
      }
    }
    selected.push(pool.splice(index, 1)[0].id);
  }
  return selected;
}
function trainerEnemyStats(level, ace, boss) {
  const c = TRAINER_ROSTERS.battle;
  const safeLevel = Math.max(1, Math.min(100, Math.round(level)));
  const base = boss ? (ace ? c.bossAceHp : c.bossLeadHp) : ace ? c.generalAceHp : c.generalLeadHp;
  return {
    level: safeLevel,
    hp: Math.round(base * (c.levelHpBase + safeLevel * c.levelHpStep)),
    seconds: ace ? c.aceSeconds : boss ? c.bossLeadSeconds : c.generalLeadSeconds,
  };
}
function createTrainerEncounter(save, map, boss, rng = Math.random) {
  normalizeTrainerState(save, rng);
  const config = TRAINER_ROSTERS.maps[save.mapId];
  if (!config || map.boss.wild) throw Error('No trainer encounter on this map');
  const wins = save.trainerWins[save.mapId] || 0;
  const boost = boss && wins ? TRAINER_ROSTERS.battle.rematchLevelBonus * Math.min(wins, 5) : 0;
  let ids, levels, profile, classId;
  const rivalPhase = ['mid', 'late'].find(
    (phase) => TRAINER_ROSTERS.rival[phase].mapId === save.mapId,
  );
  const fixed = TRAINER_ROSTERS.bosses[save.mapId];
  if (boss && rivalPhase) {
    const rival = TRAINER_ROSTERS.rival,
      rule = rival[rivalPhase];
    const family = rival.starterIds.indexOf(save.rivalStarterId);
    const starter = rival[rivalPhase === 'mid' ? 'starterMidIds' : 'starterFinalIds'][family];
    if (!save.rivalTeams[rivalPhase])
      save.rivalTeams[rivalPhase] = [
        rule.fixedId,
        ...trainerSample(
          rule.poolIds.filter((id) => id !== starter && id !== rule.fixedId),
          rule.count - 2,
          rng,
        ),
        starter,
      ];
    ids = [...save.rivalTeams[rivalPhase]];
    levels = ids.map(
      (_, i) =>
        Math.round(
          rule.levelRange[0] + ((rule.levelRange[1] - rule.levelRange[0]) * i) / (ids.length - 1),
        ) + boost,
    );
    profile = { ...map.boss, name: rival.name, image: rival.image, icon: rival.icon };
    classId = 'rival';
  } else if (boss && fixed) {
    ids = [...fixed.fixedIds];
    if (wins && fixed.rematchIds.length) {
      const additions = trainerSample(
        fixed.rematchIds.filter((id) => !ids.includes(id)),
        Math.min(
          1 + Math.floor((wins - 1) / 2),
          ids.length - 1,
          fixed.rematchIds.filter((id) => !ids.includes(id)).length,
        ),
        rng,
      );
      ids.splice(0, additions.length, ...additions);
    }
    levels = fixed.levels.map((level) => level + boost);
    profile = { ...map.boss };
    classId = 'leader';
  } else {
    classId = boss
      ? config.bossClasses[trainerInt(0, config.bossClasses.length - 1, rng)]
      : trainerClassAt(save);
    const job = TRAINER_ROSTERS.classes[classId];
    profile = boss
      ? trainerProfile(classId, save.mapId, trainerInt(0, (job.variants?.length || 1) - 1, rng))
      : trainerTileProfile(save, save.pos);
    if (boss) profile.role = 'ボストレーナー';
    if (classId === 'rocket-duo') {
      const full = wins > 0 || save.tour > 1;
      const musashi = full ? job.musashi : job.musashi.slice(0, 3),
        kojiro = full ? job.kojiro : job.kojiro.slice(0, 3);
      ids = [trainerSample(musashi, 1, rng)[0], trainerSample(kojiro, 1, rng)[0]];
      ids.push(
        ...trainerSample(
          [...musashi, ...kojiro].filter((id) => !ids.includes(id)),
          1,
          rng,
        ),
      );
    } else {
      const count = trainerInt(job.count[0], job.count[1], rng);
      ids = trainerSample(
        trainerCandidates(classId, save.mapId, count),
        count,
        rng,
        config.stageWeights,
      );
    }
    levels = ids.map(() => trainerInt(...config.levelRange, rng) + boost);
  }
  if (
    ids.length > 6 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !validPokemonId(id) || RAINBOW_IDS.includes(id))
  )
    throw Error('Invalid trainer formation');
  return {
    classId,
    profile,
    index: 0,
    rematch: boss && wins > 0,
    team: ids.map((id, i) => ({ id, ...trainerEnemyStats(levels[i], i === ids.length - 1, boss) })),
  };
}
