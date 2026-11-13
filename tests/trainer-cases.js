let seed = 90321;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const fresh = (mapId) => ({
  mapId,
  pos: 4,
  tour: 1,
  clearedMaps: [],
  owned: [1, 4, 7],
  party: [1, 4, 7],
  balls: 23,
  super: 4,
});
const expected = {
  'pewter-gym': [74, 95],
  'cerulean-gym': [120, 121],
  'vermilion-gym': [100, 25, 26],
  'celadon-gym': [71, 114, 45],
  'fuchsia-gym': [109, 89, 452, 110],
  'saffron-gym': [64, 122, 49, 65],
  'cinnabar-gym': [58, 77, 78, 59],
  'viridian-gym': [111, 51, 31, 34, 112],
  'rocket-hideout': [95, 111, 115],
  'silph-co': [33, 111, 115, 31],
  'indigo-lorelei': [87, 91, 80, 124, 131],
  'indigo-bruno': [95, 107, 106, 448, 68],
  'indigo-agatha': [429, 42, 93, 24, 94],
  'indigo-lance': [130, 148, 373, 142, 149],
};
for (const [mapId, ids] of Object.entries(expected)) {
  const save = fresh(mapId);
  save.tour = 4; // 周回数だけでは、初めてのボスまで強化しない。
  for (let i = 0; i < 12; i++) {
    const team = createTrainerEncounter(save, MAPS[mapId], true, random).team;
    assert.deepEqual(
      team.map((p) => p.id),
      ids,
    );
    assert.equal(new Set(team.map((p) => p.id)).size, ids.length);
    assert.ok(team.at(-1).hp > team[0].hp);
    assert.equal(team.at(-1).seconds, 30);
  }
  save.trainerWins[mapId] = 1;
  const rematch = createTrainerEncounter(save, MAPS[mapId], true, random);
  assert.equal(rematch.rematch, true);
  assert.equal(rematch.team.at(-1).id, ids.at(-1));
  assert.ok(rematch.team.some((p) => TRAINER_ROSTERS.bosses[mapId].rematchIds.includes(p.id)));
  assert.equal(new Set(rematch.team.map((p) => p.id)).size, ids.length);
}
const observed = new Set(),
  generations = new Set(),
  formations = new Set();
for (const [mapId, config] of Object.entries(TRAINER_ROSTERS.maps)) {
  for (const classId of config.jobs) {
    const job = TRAINER_ROSTERS.classes[classId];
    const eligible = trainerCandidates(classId, mapId, job.count[1]);
    assert.ok(eligible.length >= job.count[1], `Empty/short profession ${mapId}/${classId}`);
  }
  for (let trial = 0; trial < 250; trial++) {
    const save = fresh(mapId);
    save.tour = 1 + (trial % 7);
    save.pos = [4, 7, 11][trial % 3];
    const encounter = createTrainerEncounter(save, MAPS[mapId], false, random);
    const job = TRAINER_ROSTERS.classes[encounter.classId],
      team = encounter.team;
    assert.ok(team.length >= job.count[0] && team.length <= job.count[1]);
    assert.equal(new Set(team.map((p) => p.id)).size, team.length);
    for (const mon of team) {
      assert.ok(validPokemonId(mon.id) && !RAINBOW_IDS.includes(mon.id));
      assert.ok(
        !TRAINER_ROSTERS.starterFamilyIds.includes(mon.id) ||
          (encounter.classId === 'lady' && mon.id === 906),
      );
      const candidate = job.pool.find((p) => p.id === mon.id);
      assert.ok(candidate && candidate.stage <= config.maxStage);
      if (config.maxStage < 2) assert.ok(candidate.stage < 2, 'No early fully-evolved crowd');
      if (config.specialty)
        assert.ok(
          POKEDEX[mon.id - 1].types.some((type) => POKEMON_TYPE_NAMES[type] === config.specialty),
        );
      observed.add(mon.id);
      generations.add(
        [151, 251, 386, 493, 649, 721, 809, 905, 1025].findIndex((end) => mon.id <= end),
      );
      assert.ok(Number.isInteger(mon.level) && mon.level >= 1 && mon.level <= 100 && mon.hp > 0);
    }
    if (mapId === 'rock-tunnel') formations.add(team.map((p) => p.id).join(','));
    assert.equal(encounter.profile.name, trainerTileProfile(save, save.pos).name);
    assert.equal(encounter.profile.icon, trainerTileProfile(save, save.pos).icon);
  }
}
assert.equal(generations.size, 9);
assert.ok(observed.has(906), 'Sprigatito remains an explicit lady exception');
assert.ok(formations.size > 100, 'Variation within one map');
for (const [classId, job] of Object.entries(TRAINER_ROSTERS.classes)) {
  if (['gym-trainee', 'rocket-duo'].includes(classId)) continue;
  for (const entry of job.pool)
    assert.ok(observed.has(entry.id), `Unreachable candidate ${classId}/${entry.id}`);
}
let duos = 0;
for (let i = 0; i < 300; i++) {
  const save = fresh('pokemon-tower');
  save.tour = 2;
  const e = createTrainerEncounter(save, MAPS[save.mapId], true, random);
  if (e.classId !== 'rocket-duo') continue;
  duos++;
  assert.equal(e.team.length, 3);
  assert.ok(TRAINER_ROSTERS.classes['rocket-duo'].musashi.includes(e.team[0].id));
  assert.ok(TRAINER_ROSTERS.classes['rocket-duo'].kojiro.includes(e.team[1].id));
  assert.equal(new Set(e.team.map((p) => p.id)).size, 3);
}
assert.ok(duos > 50);
const rival = fresh('ss-anne');
rival.party = [446];
const middle = createTrainerEncounter(rival, MAPS[rival.mapId], true, random);
assert.equal(middle.team.length, 4);
assert.equal(middle.team[0].id, 17);
const family = rival.rivalStarterId,
  copy = JSON.parse(JSON.stringify(rival));
assert.deepEqual(
  createTrainerEncounter(copy, MAPS[copy.mapId], true, random).team.map((p) => p.id),
  middle.team.map((p) => p.id),
);
copy.mapId = 'indigo-champion';
const late = createTrainerEncounter(copy, MAPS[copy.mapId], true, random);
assert.equal(late.team.length, 6);
assert.equal(late.team[0].id, 18);
assert.equal(copy.rivalStarterId, family);
assert.equal(
  late.team.at(-1).id,
  TRAINER_ROSTERS.rival.starterFinalIds[TRAINER_ROSTERS.rival.starterIds.indexOf(family)],
);
const old = fresh('pewter-gym');
old.clearedMaps = ['pewter-gym', 'safari-zone', 'rainbow-cloud'];
normalizeTrainerState(old, random);
assert.equal(old.trainerWins['pewter-gym'], 1);
assert.equal(old.trainerWins['safari-zone'], undefined);
assert.deepEqual(old.owned, [1, 4, 7]);
assert.deepEqual(old.party, [1, 4, 7]);
assert.equal(old.balls, 23);
assert.equal(old.pos, 4);
normalizeTrainerState(old, () => {
  throw Error('Rival rerolled on reload');
});
const limited = JSON.parse(JSON.stringify(TRAINER_ROSTERS));
limited.maps['diglett-cave'].classPoolIds = { hiker: [50] };
assert.ok(
  trainerCandidates('hiker', 'diglett-cave', 4, limited).length >= 4,
  'Use profession reserves',
);
assert.ok(
  trainerEnemyStats(50, true, true).hp > trainerEnemyStats(10, true, true).hp,
  'Level changes real HP',
);
assert.equal(MAPS['indigo-lance'].nextMap, 'indigo-champion');
assert.deepEqual(
  trainerSample(
    [
      { id: 10, stage: 0 },
      { id: 11, stage: 1 },
    ],
    1,
    () => 0.99,
    [1, 0, 0],
  ),
  [10],
  'Zero weight is an exclusion, not a fallback to 1',
);
assert.equal(MAPS['indigo-champion'].nextMap, 'cerulean-cave');
