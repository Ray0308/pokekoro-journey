'use strict';
// SE専用の音声グラフ。音量設定と同時発音数をここで制御し、ゲームの乱数を消費しない。
(() => {
  const CONFIG = Object.freeze({
    volume: 0.3,
    diceVolume: 1.9,
    maxVoices: 40,
    rollHoldMs: 66,
    rollThrowMs: 55,
  });
  let enabled = true,
    context = null,
    master = null,
    diceBus = null,
    battleBus = null,
    effectBus = null,
    noise = null,
    rollTimer = 0,
    rollMode = null,
    rollBegan = 0,
    rollBeat = 0,
    seed = 901;
  const voices = new Set(),
    recent = new Map();
  try {
    const saved = JSON.parse(localStorage.getItem('pokekoro-title-v1'));
    if (typeof saved?.sound === 'boolean') enabled = saved.sound;
  } catch {}
  function unlock() {
    if (!enabled || document.hidden) return false;
    try {
      if (!context) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        context = new AC({ latencyHint: 'interactive' });
        master = context.createGain();
        master.gain.value = CONFIG.volume * (window.PokekoroAudioMix?.get('se') ?? 1);
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.ratio.value = 5;
        master.connect(compressor).connect(context.destination);
        diceBus = context.createGain();
        diceBus.gain.value = CONFIG.diceVolume;
        diceBus.connect(master);
        battleBus = context.createGain();
        battleBus.gain.value = 2.6;
        battleBus.connect(master);
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.16), context.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          data[i] = seed / 2147483648 - 1;
        }
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context.state !== 'closed';
    } catch {
      return false;
    }
  }
  function track(node, connections) {
    while (voices.size >= CONFIG.maxVoices) {
      const old = voices.values().next().value;
      voices.delete(old);
      try {
        old.stop();
      } catch {}
    }
    voices.add(node);
    node.onended = () => {
      voices.delete(node);
      node.disconnect();
      connections.forEach((n) => n.disconnect());
    };
  }
  function note(
    frequency,
    duration = 0.1,
    delay = 0,
    volume = 0.12,
    end = frequency,
    wave = 'sine',
  ) {
    if (!unlock()) return;
    const now = context.currentTime + delay,
      o = context.createOscillator(),
      g = context.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(frequency, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(volume, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g).connect(effectBus || master);
    track(o, [g]);
    o.start(now);
    o.stop(now + duration + 0.01);
  }
  function rise(f, end, d, volume) {
    if (!unlock()) return;
    const now = context.currentTime,
      o = context.createOscillator(),
      g = context.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(end, now + d);
    g.gain.setValueAtTime(0.012, now);
    g.gain.exponentialRampToValueAtTime(volume, now + d - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
    o.connect(g).connect(effectBus || master);
    track(o, [g]);
    o.start(now);
    o.stop(now + d + 0.01);
  }
  function tapNoise(duration = 0.045, frequency = 1200, volume = 0.17, delay = 0) {
    if (!unlock()) return;
    const now = context.currentTime + delay,
      source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      g = context.createGain();
    source.buffer = noise;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source
      .connect(filter)
      .connect(g)
      .connect(effectBus || master);
    track(source, [filter, g]);
    source.start(now);
    source.stop(now + duration);
  }
  function notes(sequence, step = 0.075, volume = 0.12) {
    sequence.forEach((f, i) => note(f, 0.16, i * step, volume, f * 0.99, 'triangle'));
  }
  function play(name, value = 0) {
    if (!enabled || document.hidden) return;
    const now = performance.now(),
      cooldown = name === 'step' ? 75 : name === 'gem' ? 65 : 35;
    if (now - (recent.get(name) ?? -10000) < cooldown) return;
    recent.set(name, now);
    if (!unlock()) return;
    effectBus = ['roll', 'throw', 'land', 'diceResult'].includes(name)
      ? diceBus
      : [
            'gem',
            'charge',
            'gather',
            'release',
            'hit',
            'comboRise',
            'breakthrough',
            'impact',
            'knockout',
          ].includes(name)
        ? battleBus
        : null;
    switch (name) {
      // 短い矩形波で、端末を操作した瞬間に返る電子音を作る。
      case 'dexOpen':
        note(784, 0.06, 0, 0.13, 784, 'square');
        note(1568, 0.09, 0.065, 0.1, 1568, 'square');
        break;
      case 'dexClose':
        note(1047, 0.045, 0, 0.1, 1047, 'square');
        note(523, 0.06, 0.05, 0.09, 523, 'square');
        break;
      case 'dexPage':
        note(1397, 0.035, 0, 0.095, 1397, 'square');
        note(1047, 0.035, 0.04, 0.065, 1047, 'square');
        break;
      case 'dexRead':
        note(1175, 0.04, 0, 0.1, 1175, 'square');
        note(1568, 0.065, 0.05, 0.08, 1568, 'square');
        break;
      case 'dexError':
        note(196, 0.07, 0, 0.12, 196, 'square');
        note(196, 0.06, 0.09, 0.09, 196, 'square');
        break;
      case 'roll': {
        const f = [720, 960, 820, 1100][rollBeat++ % 4];
        tapNoise(0.025, 2100, 0.2);
        note(f, 0.045, 0, 0.18, f * 0.76, 'triangle');
        note(f * 1.9, 0.018, 0, 0.045, f * 1.7, 'square');
        break;
      }
      case 'throw':
        note(450, 0.16, 0, 0.15, 1550, 'triangle');
        tapNoise(0.09, 2700, 0.16);
        break;
      case 'land':
        tapNoise(0.055, 2400, 0.4);
        note(420, 0.105, 0, 0.26, 120, 'triangle');
        note(1700, 0.025, 0, 0.09, 1100, 'square');
        tapNoise(0.025, 1900, 0.16, 0.075);
        break;
      case 'diceResult':
        notes([1047, 1397, 2093], 0.075, 0.2);
        note(2093, 0.22, 0.15, 0.055, 2093);
        break;
      case 'step':
        tapNoise(0.035, 700, 0.1);
        note(150, 0.04, 0, 0.055, 95);
        break;
      case 'menuOpen':
        notes([440, 660], 0.045, 0.08);
        break;
      case 'menuClose':
        notes([550, 370], 0.04, 0.065);
        break;
      case 'select':
        note(850, 0.045, 0, 0.07, 1050);
        break;
      case 'confirm':
        notes([660, 990], 0.045, 0.08);
        break;
      case 'gem': {
        const f = 523 * Math.pow(2, Math.min(12, Math.max(0, value - 1)) / 12);
        tapNoise(0.08, 3200, 0.24);
        notes([f, f * 1.25, f * 1.5], 0.045, 0.22);
        note(f / 2, 0.14, 0, 0.18, f / 2, 'triangle');
        if (value >= 4) note(f * 2, 0.23, 0.1, 0.12, f * 2);
        break;
      }
      case 'charge':
        notes([880, 1320], 0.035, 0.15);
        break;
      case 'gather': {
        const d = value || 2;
        rise(110, 880, d, 0.24);
        rise(165, 1320, d, 0.14);
        for (let i = 0; i < 12; i++) {
          const t = (d * i) / 12;
          note(330 + i * 65, 0.09, t, 0.1 + i * 0.008, 440 + i * 90, 'triangle');
        }
        break;
      }
      case 'release': {
        const boost = 0.7 + Math.min(value, 3) * 0.18;
        note(240, 0.32, 0, 0.3 * boost, 1800, 'sawtooth');
        note(120, 0.28, 0, 0.2 * boost, 480, 'triangle');
        tapNoise(0.28, 2300, 0.36 * boost);
        break;
      }
      case 'hit':
        tapNoise(0.28, 950, 0.48);
        note(180, 0.35, 0, 0.4, 42, 'triangle');
        notes([784, 1047, 1568], 0.055, 0.18);
        break;
      case 'comboRise':
        notes(
          value >= 3
            ? [784, 988, 1175, 1568]
            : value >= 2
              ? [659, 830, 988, 1319]
              : [523, 659, 784],
          0.055,
          0.16,
        );
        break;
      case 'breakthrough':
        notes(value >= 3 ? [1047, 1319, 1568, 2093] : [784, 988, 1175, 1568], 0.07, 0.16);
        break;
      case 'impact': {
        const k = 0.65 + Math.min(value, 3) * 0.2;
        tapNoise(0.28, 850, 0.38 * k);
        note(155, 0.34, 0, 0.28 * k, 40, 'triangle');
        if (value >= 2) {
          tapNoise(0.15, 2200, 0.18, 0.07);
          note(350, 0.18, 0, 0.13, 65, 'sawtooth');
        }
        break;
      }
      case 'knockout':
        notes([523, 784, 1047], 0.07, 0.16);
        note(1568, 0.35, 0.2, 0.12, 1568, 'triangle');
        break;
      case 'ballThrow':
        note(300, 0.18, 0, 0.09, 1200);
        tapNoise(0.12, 2500, 0.06);
        break;
      case 'ballHit':
        tapNoise(0.05, 2000, 0.22);
        notes([1000, 1400], 0.04, 0.09);
        break;
      case 'ballShake':
        tapNoise(0.045, 650, 0.12);
        note(360, 0.06, 0, 0.075, 220);
        break;
      case 'success':
        notes([523, 659, 784, 1047], 0.1, 0.13);
        break;
      case 'fail':
        notes([440, 330, 220], 0.1, 0.09);
        break;
      case 'badge':
        notes([523, 659, 784, 1047, 1319], 0.12, 0.14);
        break;
      case 'arrive':
        notes([392, 523, 659], 0.08, 0.1);
        break;
    }
    effectBus = null;
  }
  function stopRoll() {
    clearTimeout(rollTimer);
    rollTimer = 0;
    rollMode = null;
  }
  function startRoll(mode = 'hold') {
    stopRoll();
    if (!enabled || !unlock()) return;
    rollMode = mode;
    rollBeat = 0;
    rollBegan = performance.now();
    function tick() {
      if (!rollMode || !enabled || document.hidden) return;
      play('roll');
      const delay =
        mode === 'hold'
          ? CONFIG.rollHoldMs
          : CONFIG.rollThrowMs + Math.min(110, (performance.now() - rollBegan) * 0.095);
      rollTimer = setTimeout(tick, delay);
    }
    tick();
  }
  document.addEventListener('audio:mixchange', (e) => {
    if (master)
      master.gain.setTargetAtTime(CONFIG.volume * e.detail.se, context.currentTime, 0.015);
  });
  function stopAll() {
    stopRoll();
    for (const node of voices) {
      try {
        node.stop();
      } catch {}
    }
    voices.clear();
    recent.clear();
  }
  document.addEventListener('title:soundchange', (e) => {
    enabled = !!e.detail.enabled;
    if (!enabled) stopAll();
    else if (e.detail.userGesture) unlock();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAll();
  });
  window.addEventListener('pagehide', stopAll);
  window.addEventListener('blur', stopRoll);
  document.addEventListener('title:start', stopRoll);
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.isTrusted) unlock();
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.isTrusted) unlock();
    },
    true,
  );
  document.addEventListener(
    'click',
    (e) => {
      const b = e.target.closest?.('button');
      if (
        !b ||
        b.disabled ||
        b.closest('#boot-screen') ||
        b.matches(
          '#open-pokedex, [data-menu-action="dex"], [data-party-slot], #cards .party-member',
        ) ||
        ['roll', 'enter-game', 'game-menu-toggle'].includes(b.id)
      )
        return;
      // 図鑑は専用の操作音を持つため、汎用クリック音を重ねない。
      if (b.closest('#pokedex-device')) return;
      if (b.closest('#game-menu')) play('confirm');
      else if (b.hasAttribute('data-tab')) play('select');
      else if (b.id.startsWith('close-') || ['device-close', 'item-bag-back'].includes(b.id))
        play('menuClose');
      else if (b.closest('#battle') || b.closest('#result')) return;
      else play('select');
    },
    true,
  );
  window.PokekoroSfx = Object.freeze({
    play,
    startRoll,
    stopRoll,
    stopAll,
    tone: (f, d) => note(f, d, 0, 0.12),
    config: CONFIG,
  });
})();
