// Optional actual-MP3 audit. Requires ffmpeg; runtime and npm test do not require it.
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  { execFileSync } = require('node:child_process'),
  crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'),
  context = vm.createContext({ window: {} });
for (const file of ['map-config.js', 'map-music-config.js', 'title-config.js'])
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
const cfg = vm.runInContext(
  '({tracks:MAP_MUSIC_TRACKS,levels:MAP_MUSIC_LEVELS,bounds:mapMusicBounds,title:window.POKEKORO_TITLE.audio})',
  context,
);
const tracks = { ...cfg.tracks, title: cfg.title.titleBgm, cry: cfg.title.startCry },
  rows = [];
for (const [key, file] of Object.entries(tracks)) {
  const channels = Number(
    execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'stream=channels', '-of', 'csv=p=0', path.join(root, file)],
      { encoding: 'utf8' },
    ).trim(),
  );
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', path.join(root, file), '-ar', '24000', '-f', 'f32le', '-'],
    { maxBuffer: 80 * 1024 * 1024 },
  );
  let sum = 0,
    peak = 0,
    first = -1,
    last = -1;
  for (let offset = 0; offset < raw.length; offset += 4) {
    const value = raw.readFloatLE(offset),
      abs = Math.abs(value);
    sum += value * value;
    peak = Math.max(peak, abs);
    if (abs > 0.003) {
      if (first < 0) first = offset / 4 / channels;
      last = offset / 4 / channels;
    }
  }
  const seconds = raw.length / 4 / channels / 24000,
    rms = 20 * Math.log10(Math.sqrt(sum / (raw.length / 4)));
  const gain =
    key === 'title' ? cfg.title.volume : key === 'cry' ? cfg.title.cryVolume : cfg.levels[key];
  rows.push({
    key,
    file,
    sha256: crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(root, file)))
      .digest('hex'),
    channels,
    seconds: +seconds.toFixed(4),
    onset: +(first / 24000).toFixed(4),
    tail: +(seconds - last / 24000).toFixed(4),
    peak: +peak.toFixed(4),
    rmsDb: +rms.toFixed(2),
    gain,
    outputDb: +(rms + 20 * Math.log10(gain * (key === 'cry' ? 1 : 0.75))).toFixed(2),
    outputPeak: +(peak * gain).toFixed(4),
  });
}
fs.writeFileSync(
  path.join(root, 'data/audio-audit.json'),
  JSON.stringify(
    {
      measured: '2026-11-20',
      sampleRate: 24000,
      channels: 'native',
      notes:
        'ffmpegで現行MP3をデコード。outputDbはBGM75%時のRMSでLUFSではない。cryはSE100%の別枠。聴感と実機評価を代替しない。',
      tracks: rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  rows
    .map(
      (r) =>
        `${r.key}: ${r.outputDb}dB RMS, peak ${r.outputPeak}, onset ${r.onset}s, tail ${r.tail}s`,
    )
    .join('\n'),
);
