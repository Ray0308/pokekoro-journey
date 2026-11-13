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
  console.log(
    'PASS: deterministic retro music, immediate onset, safe peak, loop edges and six tracks',
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
