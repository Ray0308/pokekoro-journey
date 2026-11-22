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
      (document.querySelector('#battle').open ||
        (document.querySelector('#result').open &&
          document.querySelector('#result').dataset.audio === 'victory'))
    );
  }
  function encounter() {
    return (
      !!battle &&
      (document.querySelector('#encounter').open || document.querySelector('#battle').open)
    );
  }
  function theme() {
    if (document.querySelector('#mock-practice')?.open) return 'gym';
    if (
      document.querySelector('#pokedex-device').open ||
      document.querySelector('#pokemon-habitat-dialog')?.open ||
      document.querySelector('#pokemon-skill-info')?.open ||
      document.querySelector('#opening[open][data-scene="dex"]')
    )
      return 'pokedex';
    if (
      (encounter() && battle?.safari) ||
      (document.querySelector('#result').open &&
        document.querySelector('#result').dataset.audio === 'safari')
    )
      return 'safari';
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
      'dialog[open]:not(#opening):not(#pokedex-device):not(#pokemon-habitat-dialog):not(#pokemon-skill-info):not(#game-menu):not(#item-bag):not(#title-options):not(#ball-exchange):not(#kurt-house):not(#type-ball-picker):not(#debug-tools):not(#debug-roll-picker):not(#result):not(#guide):not(#skill-start-confirm):not(#mock-practice):not(#map-lesson-guide)' +
        exceptions,
    );
  }
  function unlock() {
    if (!enabled || document.hidden) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!context && AC) context = new AC({ latencyHint: 'interactive' });
      if (context && !['running', 'closed'].includes(context.state))
        context.resume().catch(() => {});
    } catch {}
  }
  function position() {
    if (!active) return audio.currentTime || 0;
    const raw = active.offset + Math.max(0, context.currentTime - active.time);
    return raw < active.end
      ? raw
      : active.start + ((raw - active.end) % (active.end - active.start));
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
      old.gain.gain.cancelScheduledValues(context.currentTime);
      old.gain.gain.setValueAtTime(old.gain.gain.value, context.currentTime);
      old.gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.025);
      dispose(old, context.currentTime + 0.03);
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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let response, bytes;
      try {
        response = await fetch(MAP_MUSIC_TRACKS[key], {
          cache: 'force-cache',
          signal: controller.signal,
        });
        if (!response.ok) throw Error('music ' + key);
        bytes = await response.arrayBuffer();
      } finally {
        clearTimeout(timer);
      }
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Offline) throw Error('no decoder');
      const decoder = new Offline(2, 1, 24000);
      const buffer = await new Promise((resolve, reject) => {
        const result = decoder.decodeAudioData(bytes, resolve, reject);
        result?.catch(reject);
      });
      // デコード後のループ端を4msだけゼロへ寄せ、MP3端のクリックを抑える。
      const bounds = mapMusicBounds(key, buffer.duration),
        start = Math.floor(bounds.start * buffer.sampleRate),
        end = Math.min(buffer.length, Math.floor(bounds.end * buffer.sampleRate));
      const fade = Math.min(Math.floor(buffer.sampleRate * 0.004), Math.floor((end - start) / 4));
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const samples = buffer.getChannelData(channel);
        for (let i = 0; i < fade; i++) {
          const level = i / fade;
          samples[start + i] *= level;
          samples[end - 1 - i] *= level;
        }
      }
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
    } else if (encounter() && battle?.safari) warm('safari');
    else if (encounter()) warm('victory');
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
    const bounds = mapMusicBounds(key, buffer.duration);
    source.loopStart = bounds.start;
    source.loopEnd = bounds.end;
    if (!audio.paused) audio.pause();
    source.connect(gain).connect(context.destination);
    const now = context.currentTime,
      saved = positions.get(key) ?? bounds.start,
      offset = saved >= bounds.start && saved < bounds.end ? saved : bounds.start;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(musicGain(key), now + 0.035);
    source.start(now + (immediate ? 0 : 0.006), offset);
    active = {
      key,
      source,
      gain,
      buffer,
      offset,
      start: bounds.start,
      end: bounds.end,
      time: now + (immediate ? 0 : 0.006),
    };
    visibleTheme = key;
    audio.dataset.theme = key;
    audio.dataset.playing = 'true';
    audio.dataset.backend = 'decoded';
    if (old) {
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + 0.06);
      dispose(old, now + 0.065);
    }
    trimCache();
  }
  function fallback(key) {
    const token = request;
    wanted = key;
    audio.dataset.request = String(token);
    if (visibleTheme !== key || !audio.src) {
      audio.src = MAP_MUSIC_TRACKS[key];
      audio.currentTime = positions.get(key) ?? MAP_MUSIC_CUE[key] ?? 0;
    }
    visibleTheme = key;
    audio.volume = musicGain(key);
    audio.dataset.theme = key;
    audio.dataset.backend = 'media';
    audio
      .play()
      ?.then(() => {
        if (token !== request || !canPlay() || theme() !== key) {
          if (audio.dataset.theme === key && audio.dataset.request === String(token)) audio.pause();
          return;
        }
        if (active) {
          positions.set(active.key, position());
          const old = active;
          active = null;
          old.gain.gain.setTargetAtTime(0, context.currentTime, 0.015);
          dispose(old, context.currentTime + 0.06);
        }
        visibleTheme = key;
        wanted = null;
        audio.dataset.playing = String(!audio.paused);
      })
      .catch(() => {
        if (token === request) wanted = null;
      });
  }
  audio.addEventListener('timeupdate', () => {
    if (audio.paused || !Number.isFinite(audio.duration)) return;
    const bounds = mapMusicBounds(audio.dataset.theme, audio.duration);
    if (audio.currentTime >= bounds.end || audio.currentTime < bounds.start)
      audio.currentTime = bounds.start;
  });
  function sync(immediate = false) {
    if (!canPlay()) {
      pause();
      return;
    }
    const key = theme();
    if (active?.key === key) {
      unlock();
      // 曲の準備中に図鑑を閉じた場合、古い切替要求を残して再表示を妨げない。
      if (wanted && wanted !== key) {
        request++;
        wanted = null;
      }
      audio.dataset.playing = 'true';
      return;
    }
    if (!active && !audio.paused && audio.dataset.theme === key) return;
    if (wanted === key) return;
    wanted = key;
    const token = ++request;
    unlock();
    if (!context || failed.has(key)) {
      fallback(key);
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
        fallback(key);
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
      warm(battle?.safari ? 'safari' : 'wild');
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
        await Promise.race([load(key), new Promise((resolve) => setTimeout(resolve, 1500))]);
        sync();
        await Promise.resolve();
      } catch {}
    },
    inspect: () => ({
      theme: visibleTheme,
      wanted,
      playing: !!(active && context?.state === 'running') || !audio.paused,
      position: position(),
      backend: audio.dataset.backend,
      cached: [...buffers.keys()],
      volume: musicGain(visibleTheme || 'field'),
      narration,
      loop: active ? { start: active.start, end: active.end } : null,
      failed: [...failed],
    }),
    sync,
  });
  sync();
})();
