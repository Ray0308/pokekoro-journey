// 初期携帯ゲーム機の4声構成・音色・短いフレーズを意識したオリジナル曲。
// node scripts/compose-map-themes.cjs [pokedex|gym|cave|hideout|league|water]
// ソース文字列の書換えやVM実行に依存せず、設定を音源へ直接渡す。
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { render } = require('../tools/retro-synth.cjs');
const THEMES = {
  pokedex: {
    bpm: 112,
    home: 'C5',
    duty: 0.125,
    chords: [
      ['C3', 'E3', 'G3'],
      ['A2', 'C3', 'E3'],
      ['F3', 'A3', 'C4'],
      ['G2', 'B2', 'D3'],
    ],
    melodies: [
      'C5 - E5 G5 E5 - D5 E5',
      'A4 C5 E5 - D5 C5 B4 -',
      'A4 - C5 D5 F5 E5 D5 C5',
      'B4 D5 G5 - E5 D5 C5 -',
    ],
  },
  gym: {
    bpm: 144,
    home: 'D5',
    chords: [
      ['D3', 'F#3', 'A3'],
      ['B2', 'D3', 'F#3'],
      ['G2', 'B2', 'D3'],
      ['A2', 'C#3', 'E3'],
    ],
    melodies: [
      'D5 A4 D5 F#5 E5 D5 A4 -',
      'B4 D5 F#5 A5 F#5 E5 D5 -',
      'G4 B4 D5 G5 F#5 D5 B4 D5',
      'E5 C#5 A4 C#5 E5 - D5 -',
    ],
  },
  cave: {
    bpm: 84,
    home: 'D4',
    sparse: true,
    duty: 0.125,
    chords: [
      ['D3', 'F3', 'A3'],
      ['C3', 'E3', 'G3'],
      ['A2', 'C3', 'E3'],
      ['D3', 'F3', 'A3'],
    ],
    melodies: [
      'D4 - A4 - F4 E4 - -',
      'E4 - G4 F4 - E4 C4 -',
      'C4 E4 - A4 G4 - E4 -',
      'F4 - E4 - D4 - - -',
    ],
  },
  hideout: {
    bpm: 126,
    home: 'E4',
    duty: 0.125,
    chords: [
      ['E3', 'G3', 'B3'],
      ['C3', 'E3', 'G3'],
      ['F#2', 'A2', 'C3'],
      ['B2', 'D#3', 'F#3'],
    ],
    melodies: [
      'E4 E4 - B4 A4 G4 F#4 -',
      'E4 G4 C5 - B4 G4 E4 -',
      'F#4 A4 C5 B4 - A4 F#4 -',
      'D#4 F#4 B4 A4 F#4 D#4 E4 -',
    ],
  },
  league: {
    bpm: 156,
    home: 'G5',
    duty: 0.5,
    chords: [
      ['G3', 'B3', 'D4'],
      ['E3', 'G3', 'B3'],
      ['C3', 'E3', 'G3'],
      ['D3', 'F#3', 'A3'],
    ],
    melodies: [
      'G5 D5 G5 B5 A5 G5 D5 -',
      'E5 G5 B5 D6 B5 A5 G5 E5',
      'E5 G5 C6 B5 A5 G5 E5 G5',
      'F#5 A5 D6 - C6 A5 G5 -',
    ],
  },
  water: {
    bpm: 100,
    beats: 3,
    home: 'C5',
    duty: 0.25,
    chords: [
      ['C3', 'E3', 'G3'],
      ['A2', 'C3', 'E3'],
      ['F3', 'A3', 'C4'],
      ['G2', 'B2', 'D3'],
    ],
    melodies: ['E5 - G5 E5 D5 C5', 'E5 - A5 G5 E5 -', 'F5 E5 D5 C5 A4 C5', 'D5 G5 E5 D5 C5 -'],
  },
};
function main() {
  const requested = process.argv[2];
  if (requested && !THEMES[requested]) throw new Error('Unknown music theme');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pokekoro-chip-'));
  const output = path.join(__dirname, '../assets/audio');
  try {
    for (const [key, theme] of Object.entries(THEMES)) {
      if (requested && requested !== key) continue;
      const wav = path.join(temporary, key + '.wav');
      const result = render(theme, wav);
      const file = path.join(output, 'map-' + key + '-chip-v1.mp3');
      execFileSync('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-i',
        wav,
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '64k',
        '-ar',
        '44100',
        '-ac',
        '1',
        file,
      ]);
      console.log(key, JSON.stringify(result), fs.statSync(file).size + ' bytes');
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
module.exports = { THEMES };
if (require.main === module) main();
