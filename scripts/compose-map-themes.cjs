// Original loop compositions; reuse the project's small offline synthesizer.
const fs = require('fs'),
  vm = require('vm'),
  { execFileSync } = require('child_process'),
  path = require('path');
const themes = {
  gym: {
    bpm: 144,
    roots: ['A2', 'F3', 'D3', 'E3'],
    chords: [
      ['A2', 'C3', 'E3'],
      ['F2', 'A2', 'C3'],
      ['D3', 'F3', 'A3'],
      ['E3', 'G#3', 'B3'],
    ],
    scale: ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G#5', 'A5'],
    motifs: [
      [0, 4, 3, 4, 7, 4, 2, 1],
      [0, -1, 2, 4, 3, 2, 1, 4],
      [5, 4, 3, -1, 2, 3, 4, 6],
      [4, 6, 7, 6, 4, 3, 1, -1],
    ],
  },
  cave: {
    bpm: 72,
    chords: [
      ['D3', 'F3', 'A3'],
      ['C3', 'E3', 'G3'],
      ['A2', 'C3', 'E3'],
      ['D3', 'F3', 'A3'],
    ],
    scale: ['D4', 'E4', 'F4', 'G4', 'A4', 'C5', 'D5', 'E5'],
    motifs: [
      [0, -1, -1, 4, -1, 2, -1, -1],
      [1, -1, 3, -1, -1, 2, -1, 0],
      [4, -1, -1, 5, -1, 3, -1, -1],
      [2, -1, 1, -1, 0, -1, -1, -1],
    ],
  },
  hideout: {
    bpm: 120,
    chords: [
      ['E3', 'G3', 'B3'],
      ['C3', 'E3', 'G3'],
      ['F#2', 'A2', 'C3'],
      ['B2', 'D#3', 'F#3'],
    ],
    scale: ['E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D#5', 'E5'],
    motifs: [
      [0, 0, -1, 4, 3, 2, -1, 1],
      [0, -1, 2, 1, 4, -1, 3, 2],
      [5, 4, -1, 3, 2, 1, -1, 0],
      [4, 6, 4, 1, 2, -1, 1, -1],
    ],
  },
  league: {
    bpm: 152,
    chords: [
      ['D3', 'F#3', 'A3'],
      ['B2', 'D3', 'F#3'],
      ['G3', 'B3', 'D4'],
      ['A2', 'C#3', 'E3'],
    ],
    scale: ['D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C#6', 'D6'],
    motifs: [
      [0, -1, 4, 4, 5, 4, 2, 0],
      [2, 4, 7, -1, 6, 5, 4, 2],
      [3, -1, 5, 7, 6, 5, 3, 1],
      [4, 6, 7, 4, 2, 1, 0, -1],
    ],
  },
  water: {
    bpm: 88,
    chords: [
      ['C3', 'E3', 'G3'],
      ['A2', 'C3', 'E3'],
      ['F3', 'A3', 'C4'],
      ['G3', 'B3', 'D4'],
    ],
    scale: ['C5', 'D5', 'E5', 'G5', 'A5', 'B5', 'C6', 'D6'],
    motifs: [
      [0, -1, 2, 3, -1, 2, 1, -1],
      [4, -1, 3, 2, 1, -1, 0, -1],
      [2, 3, 4, -1, 6, 4, 3, 2],
      [3, -1, 1, 2, 0, -1, -1, -1],
    ],
  },
};
const base = fs.readFileSync(path.join(__dirname, 'compose-map-music.cjs'), 'utf8');
for (const [key, t] of Object.entries(themes)) {
  const tune = Array.from({ length: 16 }, (_, bar) =>
      t.motifs[bar % 4]
        .map((n, i) => (n < 0 ? '-' : t.scale[(n + (bar >= 8 && i === 0 ? 2 : 0)) % 8]))
        .join(' '),
    ),
    chords = Array.from({ length: 16 }, (_, i) => t.chords[i % 4]);
  let code = base.replace('BPM=116', 'BPM=' + t.bpm);
  const begin = code.indexOf('const tune='),
    end = code.indexOf('for(let bar=0;', begin);
  code =
    code.slice(0, begin) +
    'const tune=' +
    JSON.stringify(tune) +
    ';const chords=' +
    JSON.stringify(chords) +
    ';\n' +
    code.slice(end);
  code = code.replace("'/tmp/map-adventure.wav'", JSON.stringify('/tmp/map-' + key + '.wav'));
  if (key === 'cave' || key === 'water')
    code = code
      .replace('i<8;i++){const start', 'i<0;i++){const start')
      .replace('.15*(i%2?.86:1)', '.10*(i%2?.86:1)')
      .replace(".15,'bass'", ".09,'bass'");
  vm.runInNewContext(
    code,
    { require, console, Buffer, Float64Array, Math },
    { filename: 'compose-' + key },
  );
  if (!process.env.SKIP_ENCODE)
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      '/tmp/map-' + key + '.wav',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '64k',
      '-ar',
      '44100',
      path.join(__dirname, '../assets/audio/map-' + key + '.mp3'),
    ]);
  console.log('Wrote', key);
}
