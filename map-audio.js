'use strict';
// 場面から曲を決め、デコード済み音源を切り替える。次の曲が準備できるまで前曲を維持する。
(() => {
  const audio = document.createElement('audio');
  audio.id = 'map-bgm';
  audio.loop = true;
  audio.preload = 'none';
  document.body.append(audio);
  const buffers = new Map(),
    pending = new Map(),
    positions = new Map(),
    failed = new Set();
  const CACHE_BYTES = 64 * 1024 * 1024;
  let enabled = true,
    context = null,
    active = null,
    request = 0,
    wanted = null,
    visibleTheme = null,
    focus = 1,
    focusTimer = 0,
    narration = false;
  try {
    const saved = JSON.parse(localStorage.getItem('pokekoro-title-v1'));
    if (typeof saved?.sound === 'boolean') enabled = saved.sound;
  } catch {}
  function victory() {
    return (
      !!battle?.victory &&
      (document.querySelector('#battle').open || document.querySelector('#result').open)
    );
  }
  function encounter() {
    return (
      !!battle &&
      (document.querySelector('#encounter').open || document.querySelector('#battle').open)
    );
  }
  function theme() {
    if (
      document.querySelector('#pokedex-device').open ||
      document.querySelector('#opening[open][data-scene="dex"]')
    )
      return 'pokedex';
    return victory()
      ? battle.trainer
        ? 'trainerVictory'
        : 'victory'
      : encounter()
        ? battle.trainer
          ? battle.continuation || document.querySelector('#battle').open
            ? 'trainerBattle'
            : 'trainer'
          : 'wild'
        : mapMusicTheme(state.mapId);
  }
  function canPlay() {
    if (!enabled || document.hidden || document.querySelector('#game-shell').hidden) return false;
    const exceptions =
      window.PokekoroOpening?.pending() && document.querySelector('#result').open
        ? ':not(#result)'
        : victory()
          ? ':not(#battle):not(#result)'
          : encounter()
            ? ':not(#encounter):not(#battle)'
            : '';
    return !document.querySelector(
      'dialog[open]:not(#opening):not(#pokedex-device):not(#game-menu):not(#item-bag):not(#title-options):not(#ball-exchange):not(#kurt-house):not(#type-ball-picker):not(#debug-tools):not(#debug-roll-picker)' +
        exceptions,
    );
  }
  function unlock() {
    if (!enabled || document.hidden) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!context && AC) context = new AC({ latencyHint: 'interactive' });
      if (context?.state === 'suspended') context.resume().catch(() => {});
    } catch {}
  }
  function position() {
    return active
      ? (active.offset + Math.max(0, context.currentTime - active.time)) % active.buffer.duration
      : audio.currentTime || 0;
  }
  function dispose(record, when) {
    if (!record) return;
    try {
      record.source.stop(when);
    } catch {}
    record.source.onended = () => {
      record.source.disconnect();
      record.gain.disconnect();
    };
  }
  function pause() {
    request++;
    wanted = null;
    if (active) {
      positions.set(active.key, position());
      const old = active;
      active = null;
      dispose(old, context.currentTime);
    }
    if (!audio.paused) {
      positions.set(visibleTheme, audio.currentTime);
      audio.pause();
    }
    audio.dataset.playing = 'false';
  }
  function trimCache() {
    let bytes = [...buffers.values()].reduce((n, b) => n + b.length * b.numberOfChannels * 4, 0);
    for (const [key, b] of buffers) {
      if (bytes <= CACHE_BYTES) break;
      if (key === active?.key || key === wanted) continue;
      bytes -= b.length * b.numberOfChannels * 4;
      buffers.delete(key);
    }
  }
  function load(key) {
    if (buffers.has(key)) {
      const b = buffers.get(key);
      buffers.delete(key);
      buffers.set(key, b);
      return Promise.resolve(b);
    }
    if (pending.has(key)) return pending.get(key);
    const promise = (async () => {
      const response = await fetch(MAP_MUSIC_TRACKS[key], { cache: 'force-cache' });
      if (!response.ok) throw Error('music ' + key);
      const bytes = await response.arrayBuffer();
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Offline) throw Error('no decoder');
      const decoder = new Offline(2, 1, 24000);
      const buffer = await new Promise((resolve, reject) => {
        const result = decoder.decodeAudioData(bytes, resolve, reject);
        result?.catch(reject);
      });
      buffers.set(key, buffer);
      trimCache();
      return buffer;
    })().finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }
  function warm(key) {
    if (enabled && !failed.has(key)) load(key).catch(() => {});
  }
  function warmScene() {
    if (!enabled) return;
    warm(mapMusicTheme(state.mapId));
    if (battle?.trainer && encounter()) {
      warm('trainerBattle');
      warm('trainerVictory');
    } else if (encounter() && !battle?.safari) warm('victory');
    else if (!encounter()) {
      warm('pokedex');
      warm('wild');
      warm('trainer');
    }
  }
  // 読み上げ中も曲を止めずに下げる。BGM設定・既存の鳴き声用フォーカスと併用する。
  function musicGain(key) {
    return (
      mapMusicVolume(key) *
      (window.PokekoroAudioMix?.get('bgm') ?? 0.75) *
      focus *
      (narration ? 0.24 : 1)
    );
  }
  function install(key, buffer, immediate = false) {
    if (!context) return;
    const old = active;
    if (old) positions.set(old.key, position());
    const source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(context.destination);
    const now = context.currentTime,
      offset = (positions.get(key) ?? MAP_MUSIC_CUE[key] ?? 0) % buffer.duration;
    gain.gain.setValueAtTime(musicGain(key), now);
    source.start(now + (immediate ? 0 : 0.006), offset);
    active = { key, source, gain, buffer, offset, time: now + (immediate ? 0 : 0.006) };
    visibleTheme = key;
    audio.dataset.theme = key;
    audio.dataset.playing = 'true';
    audio.dataset.backend = 'decoded';
    if (old) {
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + 0.014);
      dispose(old, now + 0.016);
    }
    trimCache();
  }
  function fallback(key) {
    if (visibleTheme !== key || !audio.src) {
      audio.src = MAP_MUSIC_TRACKS[key];
      audio.currentTime = positions.get(key) ?? MAP_MUSIC_CUE[key] ?? 0;
      visibleTheme = key;
    }
    audio.volume = musicGain(key);
    audio.dataset.theme = key;
    audio.dataset.backend = 'media';
    audio
      .play()
      ?.then(() => {
        audio.dataset.playing = String(!audio.paused);
      })
      .catch(() => {});
  }
  function sync(immediate = false) {
    if (!canPlay()) {
      pause();
      return;
    }
    const key = theme();
    if (active?.key === key) {
      // 曲の準備中に図鑑を閉じた場合、古い切替要求を残して再表示を妨げない。
      if (wanted && wanted !== key) {
        request++;
        wanted = null;
      }
      audio.dataset.playing = 'true';
      return;
    }
    if (wanted === key) return;
    wanted = key;
    const token = ++request;
    unlock();
    if (!context) {
      fallback(key);
      wanted = null;
      return;
    }
    if (buffers.has(key)) {
      install(key, buffers.get(key), immediate === true);
      wanted = null;
      warmScene();
      return;
    }
    load(key)
      .then((buffer) => {
        if (token !== request || !canPlay() || theme() !== key) return;
        install(key, buffer, immediate === true);
        wanted = null;
      })
      .catch(() => {
        if (token !== request || !canPlay()) return;
        wanted = null;
        failed.add(key);
        if (!active) fallback(key);
      });
    warmScene();
  }
  function applyMix() {
    if (active) active.gain.gain.setTargetAtTime(musicGain(active.key), context.currentTime, 0.045);
    audio.volume = musicGain(visibleTheme || 'field');
  }
  document.addEventListener('audio:mixchange', applyMix);
  document.addEventListener('dex:speech', (event) => {
    narration = !!event.detail?.active;
    applyMix();
  });
  document.addEventListener('battle:audiofocus', (e) => {
    clearTimeout(focusTimer);
    focus = e.detail?.active ? 0.55 : 1;
    applyMix();
    if (focus < 1)
      focusTimer = setTimeout(() => {
        focus = 1;
        applyMix();
      }, 5000);
  });
  document.addEventListener('battle:prepare', (event) => {
    if (!event.detail?.continuation)
      for (const key of ['wild', 'trainer', 'trainerBattle', 'victory', 'trainerVictory'])
        positions.delete(key);
    if (battle?.trainer) {
      warm('trainer');
      warm('trainerBattle');
      warm('trainerVictory');
    } else {
      warm('wild');
      if (!battle?.safari) warm('victory');
    }
  });
  document.addEventListener('battle:enter', () => {
    unlock();
    sync(true);
  });
  document.addEventListener('battle:victory', () => {
    sync();
    warm(mapMusicTheme(state.mapId));
  });
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.isTrusted) {
        unlock();
        if (canPlay()) sync();
      }
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.isTrusted) {
        unlock();
        if (canPlay()) sync();
      }
    },
    true,
  );
  document.addEventListener(
    'click',
    (event) => {
      if (
        event.target.closest?.('#enter-game') &&
        !document.querySelector('#enter-game').disabled
      ) {
        unlock();
        warm(mapMusicTheme(state.mapId));
        warm('wild');
        warm('trainer');
      }
    },
    true,
  );
  document.addEventListener('title:start', () => {
    warmScene();
    sync();
  });
  document.addEventListener('title:soundchange', (event) => {
    enabled = !!event.detail.enabled;
    if (enabled && event.detail.userGesture) unlock();
    sync();
  });
  document.addEventListener('opening:scene', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', sync);
  const observer = new MutationObserver(sync);
  for (const node of [
    document.querySelector('#game-shell'),
    document.querySelector('#title-screen'),
    ...document.querySelectorAll('dialog'),
  ])
    observer.observe(node, { attributes: true, attributeFilter: ['hidden', 'open'] });
  observer.observe(document.querySelector('#map'), {
    attributes: true,
    attributeFilter: ['data-map'],
  });
  window.PokekoroMapAudio = Object.freeze({
    prepareScene: async (key) => {
      if (!enabled || !MAP_MUSIC_TRACKS[key]) return;
      try {
        await load(key);
        sync();
        await Promise.resolve();
      } catch {}
    },
    inspect: () => ({
      theme: visibleTheme,
      wanted,
      playing: !!active || !audio.paused,
      position: position(),
      backend: audio.dataset.backend,
      cached: [...buffers.keys()],
      volume: musicGain(visibleTheme || 'field'),
      narration,
    }),
    sync,
  });
  sync();
})();
