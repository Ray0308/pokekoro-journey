'use strict';
// 音量はゲーム進行と別に保存し、変更イベントでBGM・SE・鳴き声へ即時反映する。
(() => {
  const key = 'pokekoro-audio-mix-v1',
    mix = { bgm: 0.75, se: 1 };
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    for (const k of ['bgm', 'se'])
      if (Number.isFinite(saved?.[k])) mix[k] = Math.max(0, Math.min(1, saved[k]));
  } catch {}
  function update(kind, value, persist = true) {
    mix[kind] = Math.max(0, Math.min(1, value));
    const input = document.querySelector('#volume-' + kind),
      output = document.querySelector('#volume-' + kind + '-value');
    input.value = Math.round(mix[kind] * 100);
    output.value = input.value + '%';
    input.setAttribute('aria-valuetext', output.value);
    if (persist)
      try {
        localStorage.setItem(key, JSON.stringify(mix));
      } catch {}
    document.dispatchEvent(new CustomEvent('audio:mixchange', { detail: { ...mix } }));
  }
  for (const kind of ['bgm', 'se']) {
    const input = document.querySelector('#volume-' + kind);
    input.addEventListener('input', () => update(kind, Number(input.value) / 100));
    input.addEventListener('change', () => {
      if (kind === 'se') window.PokekoroSfx?.play('gem', 4);
    });
    update(kind, mix[kind], false);
  }
  window.PokekoroAudioMix = Object.freeze({ get: (kind) => mix[kind] });
})();
