// 初期携帯ゲーム機を意識した4声のオフライン音源。矩形波2声・4bit三角波・ノイズのみ。
// 同じ設定から同じPCMを再生成する。曲中に残響や厚いパッドを重ねない。
const fs = require('node:fs');
const SR = 44100;
function frequency(note) {
  const match = /^([A-G])(#?)(\d)$/.exec(note);
  if (!match) throw new Error(`Invalid note: ${note}`);
  const midi =
    { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] +
    (match[2] ? 1 : 0) +
    (Number(match[3]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}
function render(theme, output) {
  const beats = theme.beats ?? 4,
    bars = 16,
    beat = 60 / theme.bpm;
  const samples = new Float64Array(Math.round(bars * beats * beat * SR));
  let noiseSeed = 0x6d2b;
  function tone(start, seconds, note, amplitude, voice, duty = 0.25) {
    if (note === '-') return;
    const hz = frequency(note),
      offset = Math.round(start * SR),
      length = Math.floor(seconds * SR);
    const timer = Math.max(0, Math.min(2047, Math.round(2048 - 131072 / hz)));
    const clocked = 131072 / (2048 - timer);
    for (let i = 0; i < length && offset + i < samples.length; i++) {
      const phase = ((i * clocked) / SR) % 1;
      const wave =
        voice === 'bass'
          ? Math.round((1 - 4 * Math.abs(phase - 0.5)) * 7) / 7
          : (phase < duty ? 1 - duty : -duty) * 1.5;
      const attack = Math.min(1, i / (SR * 0.002));
      const release = Math.min(1, (length - i) / (SR * 0.009));
      const envelope = Math.max(1 / 15, Math.floor(15 * (1 - (i / length) * 0.55)) / 15);
      samples[offset + i] += wave * amplitude * attack * release * envelope;
    }
  }
  function noise(start, bright, amplitude) {
    const length = Math.round(SR * (bright ? 0.045 : 0.065));
    const offset = Math.round(start * SR),
      hold = bright ? 5 : 24;
    let value = 0;
    for (let i = 0; i < length && offset + i < samples.length; i++) {
      if (i % hold === 0) {
        const bit = (noiseSeed ^ (noiseSeed >> 1)) & 1;
        noiseSeed = (noiseSeed >> 1) | (bit << 14);
        value = noiseSeed & 1 ? 1 : -1;
      }
      samples[offset + i] += value * amplitude * (1 - i / length) ** 2;
    }
  }
  for (let bar = 0; bar < bars; bar++) {
    const chord = theme.chords[bar % theme.chords.length];
    const motif = theme.melodies[bar % theme.melodies.length].split(' ');
    if (motif.length !== beats * 2) throw new Error('Expected two melody steps per beat');
    for (let step = 0; step < beats * 2; step++) {
      const start = (bar * beats + step / 2) * beat;
      const cadence = bar % 8 === 7 && step >= beats * 2 - 2;
      const lead = cadence ? (step === beats * 2 - 2 ? theme.home : '-') : motif[step];
      tone(start, beat * (cadence ? 0.72 : 0.41), lead, 0.3, 'lead', theme.duty ?? 0.25);
      const arp = chord[(step + Math.floor(bar / 4)) % chord.length];
      if (!cadence && (!theme.sparse || step % 2 === 1))
        tone(start, beat * 0.25, arp, 0.12, 'harmony', 0.125);
      if (step % 2 === 0) {
        const bass = chord[step % 4 === 0 ? 0 : 2].replace(/\d$/, '2');
        tone(start, beat * 0.78, bass, 0.21, 'bass');
        if (!theme.sparse || (bar % 2 === 0 && step === 0))
          noise(start, step % 4 === 2, theme.sparse ? 0.025 : step % 4 === 2 ? 0.055 : 0.035);
      }
    }
  }
  // 単声へまとめ、急な振幅変化と高域を軽く抑える。短い窓でループのクリックを防ぐ。
  let filtered = 0,
    peak = 0;
  for (let i = 0; i < samples.length; i++) {
    filtered += 0.45 * (samples[i] - filtered);
    const edge = Math.min(1, i / 64, (samples.length - 1 - i) / 128);
    samples[i] = filtered * edge;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++)
    buffer.writeInt16LE(Math.round((samples[i] / peak) * 0.78 * 32767), 44 + i * 2);
  fs.writeFileSync(output, buffer);
  return { seconds: samples.length / SR, peak: 0.78, channels: 4 };
}
module.exports = { render };
