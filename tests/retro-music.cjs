// 音源再生成の再現性、即時の鳴り出し、クリップとループ端の不連続を検査する。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { render } = require('../tools/retro-synth.cjs');
const { THEMES } = require('../scripts/compose-map-themes.cjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pokekoro-music-test-'));
try {
  const first = path.join(temporary, 'first.wav'),
    second = path.join(temporary, 'second.wav');
  render(THEMES.pokedex, first);
  render(THEMES.pokedex, second);
  const a = fs.readFileSync(first),
    b = fs.readFileSync(second);
  assert.equal(
    createHash('sha256').update(a).digest('hex'),
    createHash('sha256').update(b).digest('hex'),
  );
  assert.equal(a.toString('ascii', 0, 4), 'RIFF');
  assert.equal(a.readUInt16LE(22), 1);
  assert.equal(a.readUInt32LE(24), 44100);
  let peak = 0,
    onset = -1;
  for (let i = 44; i < a.length; i += 2) {
    const sample = Math.abs(a.readInt16LE(i));
    peak = Math.max(peak, sample);
    if (onset < 0 && sample > 64) onset = (i - 44) / 2;
  }
  assert.ok(onset >= 0 && onset / 44100 < 0.01, 'No export lead-in');
  assert.ok(peak > 20000 && peak < 30000, 'Audible with clipping headroom');
  assert.equal(a.readInt16LE(44), 0);
  assert.equal(a.readInt16LE(a.length - 2), 0);
  for (const key of Object.keys(THEMES)) {
    const file = path.join(__dirname, '../assets/audio', `map-${key}-chip-v1.mp3`);
    assert.ok(fs.statSync(file).size > 100000, `Missing encoded track: ${key}`);
  }
  const ctx = require('node:vm').createContext({});
  for (const file of ['map-config.js', 'map-music-config.js'])
    require('node:vm').runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ctx);
  const mapThemes = require('node:vm').runInContext(
    'Object.entries(MAPS).map(([id])=>[id,mapMusicTheme(id)])',
    ctx,
  );
  const tracks = require('node:vm').runInContext('MAP_MUSIC_TRACKS', ctx);
  for (const [id, key] of mapThemes) {
    assert.ok(tracks[key], 'Missing theme for ' + id);
    assert.notEqual(key, 'field', 'Map must use a deliberate regional theme: ' + id);
    assert.ok(fs.existsSync(path.join(__dirname, '..', tracks[key])));
  }
  assert.equal(
    new Set(
      mapThemes
        .filter(([id]) => ['pewter-city', 'cerulean-city', 'celadon-city'].includes(id))
        .map(([, key]) => key),
    ).size,
    3,
  );
  const { PLACE_THEMES } = require('../scripts/map-place-themes.cjs');
  for (const [key, theme] of Object.entries(PLACE_THEMES)) {
    assert.equal(theme.melodies.length, 8);
    assert.equal(new Set(theme.melodies).size, 8, 'Distinct phrase responses: ' + key);
    const out = path.join(temporary, key + '.wav');
    render(theme, out);
    const pcm = fs.readFileSync(out);
    assert.equal(pcm.readInt16LE(44), 0);
    assert.equal(pcm.readInt16LE(pcm.length - 2), 0);
  }
  console.log(
    'PASS: deterministic retro music, immediate onset, safe peak, loop edges and all regional tracks',
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
