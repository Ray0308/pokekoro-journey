const fs = require('fs');
const SR = 44100,
  BPM = 116,
  beat = 60 / BPM,
  bars = 16,
  duration = bars * 4 * beat,
  N = Math.round(duration * SR),
  L = new Float64Array(N),
  R = new Float64Array(N);
function freq(note) {
  const match = note.match(/^([A-G])(#?)(\d)$/),
    pitch =
      { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] +
      (match[2] ? 1 : 0) +
      (Number(match[3]) + 1) * 12;
  return 440 * Math.pow(2, (pitch - 69) / 12);
}
function put(start, len, note, amp, voice, pan = 0) {
  if (note === '-') return;
  const f = freq(note),
    offset = Math.round(start * SR),
    count = Math.round(len * SR),
    left = Math.sqrt((1 - pan) / 2),
    right = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < count; i++) {
    const t = i / SR,
      attack = Math.min(1, t / 0.006),
      release = Math.min(1, (len - t) / 0.035),
      env =
        attack *
        Math.max(0, release) *
        Math.exp(-t * (voice === 'arp' ? 7 : voice === 'bass' ? 1.4 : 1.8));
    const phase = 2 * Math.PI * f * t;
    let wave =
      voice === 'bass'
        ? Math.sin(phase) + Math.sin(phase * 3) / 9 + Math.sin(phase * 5) / 25
        : voice === 'arp'
          ? Math.sin(phase) + 0.18 * Math.sin(phase * 2) + 0.1 * Math.sin(phase * 3)
          : Math.sin(phase) +
            0.28 * Math.sin(phase * 3) +
            0.12 * Math.sin(phase * 5) +
            0.05 * Math.sin(phase * 7);
    const value = wave * amp * env,
      index = (offset + i) % N;
    L[index] += value * left;
    R[index] += value * right;
    if (voice === 'lead') {
      const echo = (index + Math.round(beat * 0.75 * SR)) % N;
      L[echo] += value * 0.09 * right;
      R[echo] += value * 0.12 * left;
    }
  }
}
const tune = [
  'G5 - B5 D6 E6 D6 B5 A5',
  'F#5 - A5 D6 E6 D6 A5 F#5',
  'E5 G5 B5 - D6 B5 A5 G5',
  'E5 - G5 C6 B5 G5 E5 -',
  'A5 B5 C6 E6 D6 C6 B5 A5',
  'F#5 A5 D6 - C6 A5 F#5 E5',
  'G5 B5 D6 E6 D6 B5 A5 F#5',
  'A5 - F#5 E5 D5 - - -',
  'G5 A5 B5 D6 E6 D6 B5 A5',
  'F#5 A5 B5 D6 E6 D6 B5 A5',
  'G5 B5 E6 D6 C6 B5 A5 G5',
  'D5 G5 B5 D6 B5 A5 G5 -',
  'E5 G5 A5 C6 E6 C6 B5 A5',
  'F#5 A5 D6 C6 A5 F#5 E5 D5',
  'G5 B5 D6 - E6 D6 B5 A5',
  'G5 - D5 - G5 - - -',
];
const chords = [
  ['G3', 'B3', 'D4'],
  ['D3', 'F#3', 'A3'],
  ['E3', 'G3', 'B3'],
  ['C3', 'E3', 'G3'],
  ['A2', 'C3', 'E3'],
  ['D3', 'F#3', 'A3'],
  ['G3', 'B3', 'D4'],
  ['D3', 'F#3', 'A3'],
  ['G3', 'B3', 'D4'],
  ['B2', 'D3', 'F#3'],
  ['C3', 'E3', 'G3'],
  ['G3', 'B3', 'D4'],
  ['A2', 'C3', 'E3'],
  ['D3', 'F#3', 'A3'],
  ['G3', 'B3', 'D4'],
  ['G3', 'B3', 'D4'],
];
for (let bar = 0; bar < bars; bar++) {
  const time = bar * 4 * beat,
    notes = tune[bar].split(' '),
    chord = chords[bar];
  notes.forEach((note, i) =>
    put(time + i * 0.5 * beat, 0.43 * beat, note, 0.15 * (i % 2 ? 0.86 : 1), 'lead', -0.06),
  );
  for (let i = 0; i < 4; i++)
    put(time + i * beat, 0.7 * beat, i % 2 ? chord[2] : chord[0], 0.15, 'bass');
  for (let i = 0; i < 8; i++) {
    const chordNote = chord[[0, 1, 2, 1, 0, 2, 1, 2][i]],
      octave = Number(chordNote.at(-1)) + 1;
    put(
      time + (i * 0.5 + 0.25) * beat,
      0.19 * beat,
      chordNote.slice(0, -1) + octave,
      0.042,
      'arp',
      i % 2 ? 0.42 : -0.42,
    );
  }
  for (let i = 0; i < 8; i++) {
    const start = Math.round((time + i * 0.5 * beat) * SR),
      length = Math.round(0.035 * SR);
    let seed = bar * 97 + i * 31 + 1;
    for (let k = 0; k < length; k++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const noise =
        ((seed / 4294967296) * 2 - 1) * Math.exp(-k / (SR * 0.009)) * 0.018 * (i % 2 ? 0.65 : 1);
      L[(start + k) % N] += noise;
      R[(start + k) % N] += noise;
    }
    if (i % 4 === 0) {
      for (let k = 0; k < SR * 0.09; k++) {
        const t = k / SR,
          v = Math.sin(2 * Math.PI * (75 * t - 120 * t * t)) * 0.055 * Math.exp(-t * 40);
        L[(start + k) % N] += v;
        R[(start + k) % N] += v;
      }
    }
  }
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const scale = 0.82 / peak,
  buffer = Buffer.alloc(44 + N * 4);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(buffer.length - 8, 4);
buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(2, 22);
buffer.writeUInt32LE(SR, 24);
buffer.writeUInt32LE(SR * 4, 28);
buffer.writeUInt16LE(4, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buffer.writeInt16LE(Math.round(L[i] * scale * 32767), 44 + i * 4);
  buffer.writeInt16LE(Math.round(R[i] * scale * 32767), 46 + i * 4);
}
fs.writeFileSync('/tmp/map-adventure.wav', buffer);
console.log({ BPM, duration, peak, scale });
