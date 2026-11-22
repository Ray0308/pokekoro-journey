'use strict';
const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const c = vm.createContext({});
for (const f of ['map-config.js', 'map-music-config.js'])
  vm.runInContext(fs.readFileSync(f, 'utf8'), c, { filename: f });
const config = vm.runInContext(
  '({pick:trainerMusicTheme,tracks:MAP_MUSIC_TRACKS,bounds:mapMusicBounds,volume:mapMusicVolume,order:MAP_ORDER,maps:MAPS})',
  c,
);
for (const id of config.order.filter((id) => config.maps[id].badge || id.startsWith('indigo-'))) {
  for (const fighting of [true, false])
    assert.equal(
      config.pick(id, { boss: true, series: { classId: 'leader' } }, fighting),
      'bossVs',
    );
  assert.equal(
    config.pick(id, { boss: false, series: { classId: 'gym-trainee' } }, true),
    'trainerBattle',
  );
}
for (const id of ['ss-anne', 'indigo-champion'])
  assert.equal(config.pick(id, { boss: true, series: { classId: 'rival' } }, false), 'bossVs');
assert.equal(
  config.pick('rocket-hideout', { boss: true, series: { classId: 'leader' } }, true),
  'trainerBattle',
);
assert.equal(config.pick('viridian', { boss: false }, false), 'trainer');
assert.equal(config.pick('viridian', { boss: false }, true), 'trainerBattle');
assert(fs.existsSync(config.tracks.bossVs));
assert.equal(config.bounds('bossVs', 120.555).start, 0);
assert(Math.abs(config.bounds('bossVs', 120.555).end - 115.455) < 0.001);
assert.equal(config.volume('bossVs'), 0.18);
console.log(
  'PASS eight leaders, rival/Champion and Elite Four only, ordinary trainer unchanged, supplied file and trailing-silence loop bounds',
);
