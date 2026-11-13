'use strict';
// 初回タップによる音声解放と、背景・待機演出・出発演出を管理する。
(() => {
  const config = window.POKEKORO_TITLE;
  const root = document.querySelector('#title-screen');
  const start = document.querySelector('#enter-game');
  const rules = document.querySelector('#help');
  const optionsButton = document.querySelector('#open-options');
  const options = document.querySelector('#title-options');
  const sound = document.querySelector('#sound-toggle');
  const action = root.querySelector('.hero-action');
  const companionTap = root.querySelector('.companion-anchor');
  const leafLayer = root.querySelector('.title-leaves');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const settingsKey = 'pokekoro-title-v1';
  let starting = false;
  let titleReady = false;
  const tapPrompt = document.querySelector('#title-tap-prompt');
  const titleButtons = [start, rules, optionsButton];
  titleButtons.forEach((button) => (button.disabled = true));
  root.classList.add('is-menu-waiting');
  function revealMenu() {
    if (root.hidden || !document.querySelector('#boot-screen').hidden) return;
    tapPrompt.disabled = false;
  }
  function activateTitle() {
    if (
      titleReady ||
      starting ||
      tapPrompt.disabled ||
      root.hidden ||
      document.hidden ||
      !document.querySelector('#boot-screen').hidden
    )
      return;
    titleReady = true;
    tapPrompt.disabled = true;
    root.classList.remove('is-menu-waiting');
    titleButtons.forEach((button) => (button.disabled = false));
    unlockMusicGraph();
    restoreMusicVolume();
    syncBgm();
    refreshTitleActivity();
    start.focus({ preventScroll: true });
  }
  tapPrompt.addEventListener('click', activateTitle);
  root.addEventListener(
    'click',
    (event) => {
      if (titleReady || event.target.closest('a,#title-debug')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      activateTitle();
    },
    true,
  );

  let sequence = 0,
    departureDice = null;
  let idleTimer = 0;
  let idleGeneration = 0;
  let idlePlaying = false;
  let leafTimer = 0;
  let leafCleanupTimer = 0;
  let leafGeneration = 0;
  let settings = { ...config.defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey));
    if (saved && typeof saved.sound === 'boolean') settings.sound = saved.sound;
  } catch {
    /* Storage is optional; gameplay and settings still work in memory. */
  }

  const bgm = document.createElement('audio');
  bgm.id = 'title-bgm';
  bgm.src = config.audio.titleBgm;
  bgm.loop = true;
  bgm.preload = 'auto';
  bgm.volume = config.audio.volume * (window.PokekoroAudioMix?.get('bgm') ?? 0.75);
  document.body.append(bgm);
  const cry = document.createElement('audio');
  cry.id = 'title-start-cry';
  cry.src = config.audio.startCry;
  cry.preload = 'auto';
  document.body.append(cry);
  let musicContext = null,
    musicGain = null,
    finishCry = null,
    crySource = null,
    cryBuffer = null,
    cryGain = null;
  const cryPreparation = (async () => {
    try {
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Offline) return;
      const response = await fetch(config.audio.startCry);
      if (!response.ok) return;
      const decoder = new Offline(2, 1, 48000);
      cryBuffer = await decoder.decodeAudioData(await response.arrayBuffer());
    } catch {
      /* HTML audio remains the fallback. */
    }
  })();
  function unlockMusicGraph() {
    try {
      if (!musicContext) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        musicContext = new AC({ latencyHint: 'interactive' });
        musicGain = musicContext.createGain();
        musicGain.gain.value = config.audio.volume * (window.PokekoroAudioMix?.get('bgm') ?? 0.75);
        musicContext
          .createMediaElementSource(bgm)
          .connect(musicGain)
          .connect(musicContext.destination);
        bgm.volume = 1;
      }
      if (musicContext.state === 'suspended') musicContext.resume().catch(() => {});
    } catch {
      /* Media-element volume remains the fallback. */
    }
  }
  function restoreMusicVolume() {
    if (musicGain) {
      musicGain.gain.cancelScheduledValues(musicContext.currentTime);
      musicGain.gain.setValueAtTime(
        config.audio.volume * (window.PokekoroAudioMix?.get('bgm') ?? 0.75),
        musicContext.currentTime,
      );
    } else bgm.volume = config.audio.volume * (window.PokekoroAudioMix?.get('bgm') ?? 0.75);
  }
  function stopCry() {
    if (crySource) {
      try {
        crySource.stop();
      } catch {}
      crySource.disconnect();
      crySource = null;
    }
    cry.pause();
    cry.currentTime = 0;
    finishCry?.();
  }
  function playStartCry() {
    return new Promise((resolve) => {
      let timer;
      function finish() {
        clearTimeout(timer);
        cry.removeEventListener('ended', finish);
        cry.removeEventListener('error', finish);
        finishCry = null;
        resolve();
      }
      finishCry = finish;
      if (!settings.sound) {
        timer = setTimeout(finish, config.audio.cryMs);
        return;
      }
      if (cryBuffer && musicContext) {
        const source = musicContext.createBufferSource();
        source.buffer = cryBuffer;
        cryGain = musicContext.createGain();
        cryGain.gain.value = window.PokekoroAudioMix?.get('se') ?? 1;
        source.connect(cryGain).connect(musicContext.destination);
        crySource = source;
        source.onended = () => {
          if (crySource === source) crySource = null;
          source.disconnect();
          cryGain?.disconnect();
          finish();
        };
        timer = setTimeout(finish, config.audio.cryMs + 500);
        source.start(0, config.audio.cryOffsetSeconds || 0);
        return;
      }
      cry.volume = window.PokekoroAudioMix?.get('se') ?? 1;
      cry.currentTime = 0;
      cry.addEventListener('ended', finish);
      cry.addEventListener('error', finish);
      timer = setTimeout(finish, config.audio.cryMs + 500);
      cry.play()?.catch(finish);
    });
  }
  function canPlayBgm() {
    return (
      titleReady &&
      settings.sound &&
      !root.hidden &&
      !document.hidden &&
      document.querySelector('#boot-screen').hidden
    );
  }
  function syncBgm() {
    if (!canPlayBgm()) {
      bgm.pause();
      return;
    }
    if (bgm.paused) {
      // Mobile browsers unlock audio on a tap; rejection leaves the next gesture free to retry.
      bgm
        .play()
        ?.then(() => {
          if (!canPlayBgm()) bgm.pause();
        })
        .catch(() => {});
    }
  }
  function unlockBgm(event) {
    if (!titleReady || !event.isTrusted || root.hidden || document.hidden || !settings.sound)
      return;
    if (event.target.closest?.('#enter-game, #sound-toggle')) return;
    unlockMusicGraph();
    syncBgm();
  }
  document.addEventListener('pointerdown', unlockBgm, { capture: true, passive: true });
  document.addEventListener('keydown', unlockBgm, { capture: true });
  document.addEventListener('touchend', unlockBgm, { capture: true, passive: true });
  document.addEventListener('click', unlockBgm, { capture: true });
  window.addEventListener('pagehide', () => {
    if (starting) reset();
    bgm.pause();
    stopCry();
  });
  window.addEventListener('pageshow', syncBgm);
  document.addEventListener('title:start', () => {
    bgm.pause();
    stopCry();
  });
  document.addEventListener('studio:ready', () => {
    revealMenu();
    syncBgm();
  });

  root.style.setProperty('--cloud-duration', `${config.motion.cloudsSeconds}s`);
  root.style.setProperty('--hero-idle-duration', `${config.motion.idleSeconds}s`);
  root.style.setProperty('--departure-duration', `${config.motion.departureMs}ms`);
  for (const image of root.querySelectorAll('[data-title-image]')) {
    image.addEventListener('error', () => {
      image.hidden = true;
      if (image === action) root.classList.add('action-unavailable');
      if (image.matches('.hero-glance, .companion-eat')) {
        root.classList.add('idle-poses-unavailable');
        refreshIdleScene();
      }
    });
    image.src = config.assets[image.dataset.titleImage];
  }
  const poseFrames = [root.querySelector('.companion-eat'), root.querySelector('.hero-glance')];
  const posePreparation = Promise.all(
    poseFrames.map(async (image) => {
      try {
        if (typeof image.decode === 'function') await image.decode();
        else if (!image.complete)
          await new Promise((resolve, reject) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', reject, { once: true });
          });
        return image.complete && image.naturalWidth > 0;
      } catch {
        return false;
      }
    }),
  ).then((results) => results.every(Boolean));
  for (const layer of root.querySelectorAll('[data-title-background]')) {
    layer.style.backgroundImage = `url("${config.assets[layer.dataset.titleBackground]}")`;
  }

  // Readiness includes decoded CSS backgrounds, not just <img> download events.
  async function decoded(image) {
    try {
      if (typeof image.decode === 'function') await image.decode();
      else if (!image.complete)
        await new Promise((resolve, reject) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', reject, { once: true });
        });
      return image.naturalWidth > 0;
    } catch {
      return false;
    }
  }
  const backgroundPreparation = [
    ...new Set(
      [...root.querySelectorAll('[data-title-background]')].map(
        (layer) => config.assets[layer.dataset.titleBackground],
      ),
    ),
  ].map((src) => {
    const image = new Image();
    image.src = src;
    return decoded(image);
  });
  Promise.all(
    [...root.querySelectorAll('[data-title-image]')]
      .map(decoded)
      .concat(backgroundPreparation, [cryPreparation]),
  )
    .then(() => document.fonts?.ready)
    .catch(() => {})
    .then(() => {
      window.PokekoroTitleAssetsReady = true;
      document.dispatchEvent(new CustomEvent('title:assetsready'));
    });

  function canShowTitle() {
    return (
      !starting &&
      !root.hidden &&
      !document.hidden &&
      document.querySelector('#boot-screen').hidden &&
      !document.querySelector('dialog[open]')
    );
  }
  function canPlayScene() {
    return canShowTitle() && !root.classList.contains('idle-poses-unavailable');
  }
  function stopLeaves() {
    leafGeneration++;
    clearTimeout(leafTimer);
    clearTimeout(leafCleanupTimer);
    leafTimer = leafCleanupTimer = 0;
    leafLayer.replaceChildren();
  }
  function refreshLeaves() {
    stopLeaves();
    if (!canShowTitle() || motionPreference.matches) return;
    const breeze = config.breeze;
    const token = leafGeneration;
    const delay = breeze.minDelayMs + Math.random() * (breeze.maxDelayMs - breeze.minDelayMs);
    leafTimer = setTimeout(() => {
      if (token !== leafGeneration || !canShowTitle() || motionPreference.matches) return;
      leafTimer = 0;
      const count =
        breeze.minLeaves + Math.floor(Math.random() * (breeze.maxLeaves - breeze.minLeaves + 1));
      let cleanupAfter = 0;
      for (let i = 0; i < count; i++) {
        const leaf = document.createElement('span');
        const shape = document.createElement('i');
        leaf.className = 'wind-leaf';
        shape.className = 'wind-leaf-shape';
        const life = breeze.minLifeMs + Math.random() * (breeze.maxLifeMs - breeze.minLifeMs);
        const stagger = i * breeze.staggerMs;
        leaf.style.setProperty('--leaf-y', `${37 + Math.random() * 11}%`);
        leaf.style.setProperty('--leaf-size', `${10 + Math.random() * 6}px`);
        leaf.style.setProperty('--leaf-x', `${-(root.clientWidth + 65)}px`);
        leaf.style.setProperty(
          '--leaf-drop',
          `${root.clientHeight * (0.12 + Math.random() * 0.12)}px`,
        );
        leaf.style.setProperty('--leaf-life', `${life}ms`);
        leaf.style.setProperty('--leaf-delay', `${stagger}ms`);
        leaf.style.setProperty('--leaf-color', ['#b6d44b', '#88b74f', '#d3dc6a'][i % 3]);
        shape.style.animationDelay = `${-Math.random() * 1200}ms`;
        leaf.append(shape);
        leafLayer.append(leaf);
        leaf.addEventListener('animationend', (event) => {
          if (event.target === leaf) leaf.remove();
        });
        cleanupAfter = Math.max(cleanupAfter, life + stagger);
      }
      leafCleanupTimer = setTimeout(() => {
        if (token === leafGeneration) refreshLeaves();
      }, cleanupAfter + 120);
    }, delay);
  }
  function refreshTitleActivity() {
    syncBgm();
    refreshIdleScene();
    refreshLeaves();
  }
  function canIdle() {
    return canPlayScene() && !motionPreference.matches;
  }
  function stopIdleScene() {
    idleGeneration++;
    clearTimeout(idleTimer);
    idleTimer = 0;
    idlePlaying = false;
    companionTap.disabled = starting || !titleReady;
    companionTap.removeAttribute('aria-busy');
    root.classList.remove('companion-is-eating', 'hero-is-glancing');
    root.dataset.idlePhase = 'waiting';
  }
  function refreshIdleScene() {
    stopIdleScene();
    if (!canIdle()) return;
    const { minDelayMs, maxDelayMs } = config.idleScene;
    const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
    const token = idleGeneration;
    idleTimer = setTimeout(() => playIdleScene(token), delay);
  }
  async function playIdleScene(token, fromTap = false) {
    const eligible = () => (fromTap ? canPlayScene() : canIdle());
    if (idlePlaying || token !== idleGeneration || !eligible()) return;
    idleTimer = 0;
    // Lock on the first tap, including while the first pose is still loading/decoding.
    idlePlaying = true;
    companionTap.disabled = true;
    companionTap.setAttribute('aria-busy', 'true');
    root.dataset.idlePhase = 'preparing';
    const valid = () => token === idleGeneration && eligible();
    const ready = await posePreparation;
    if (!valid()) return;
    if (!ready) {
      root.classList.add('idle-poses-unavailable');
      refreshIdleScene();
      return;
    }
    // Give the decoded, precomposited frames a paint opportunity before the first swap.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (!valid()) return;
    const wait = (ms) =>
      new Promise((resolve) => {
        idleTimer = setTimeout(resolve, ms);
      });
    root.classList.add('companion-is-eating');
    root.dataset.idlePhase = 'eating';
    await wait(config.idleScene.eatMs);
    if (!valid()) return;
    root.classList.remove('companion-is-eating');
    root.dataset.idlePhase = 'returned';
    await wait(config.idleScene.lookDelayMs);
    if (!valid()) return;
    root.classList.add('hero-is-glancing');
    root.dataset.idlePhase = 'glancing';
    await wait(config.idleScene.lookMs);
    if (!valid()) return;
    refreshIdleScene();
  }

  companionTap.addEventListener('click', () => {
    // A tap never restarts or queues a scene that is already playing, even if it was automatic.
    if (idlePlaying || !canPlayScene()) return;
    stopIdleScene();
    void playIdleScene(idleGeneration, true);
  });

  document.addEventListener('audio:mixchange', () => {
    restoreMusicVolume();
    cry.volume = window.PokekoroAudioMix?.get('se') ?? 1;
    if (cryGain && musicContext)
      cryGain.gain.setTargetAtTime(cry.volume, musicContext.currentTime, 0.015);
  });
  function applySettings(persist = false) {
    if (persist) unlockMusicGraph();
    syncBgm();
    sound.querySelector('.sound-status').textContent = settings.sound ? 'ON' : 'OFF';
    sound.setAttribute('aria-pressed', String(settings.sound));
    sound.setAttribute('aria-label', `サウンド ${settings.sound ? 'ON' : 'OFF'}`);
    document.dispatchEvent(
      new CustomEvent('title:soundchange', {
        detail: { enabled: settings.sound, userGesture: persist },
      }),
    );
    refreshIdleScene();
    if (persist) {
      try {
        localStorage.setItem(settingsKey, JSON.stringify(settings));
      } catch {
        /* Optional storage. */
      }
    }
  }
  sound.addEventListener('click', () => {
    settings.sound = !settings.sound;
    applySettings(true);
  });
  optionsButton.addEventListener('click', () => {
    if (!starting && titleReady) options.showModal();
  });
  document.querySelector('#close-title-options').addEventListener('click', () => options.close());

  function reset() {
    stopLeaves();
    stopIdleScene();
    sequence++;
    stopCry();
    restoreMusicVolume();
    starting = false;
    departureDice?.cancel();
    departureDice = null;
    window.PokekoroSfx?.stopRoll();
    root.classList.remove('is-departing', 'is-starting', 'hero-is-active');
    root.removeAttribute('aria-busy');
    delete root.dataset.startPhase;
    titleReady = false;
    bgm.pause();
    tapPrompt.disabled = true;
    root.classList.add('is-menu-waiting');
    for (const button of titleButtons) button.disabled = true;
    revealMenu();
    refreshTitleActivity();
  }
  start.addEventListener('click', async () => {
    if (starting || !titleReady) return;
    stopLeaves();
    stopIdleScene();
    unlockMusicGraph();
    restoreMusicVolume();
    syncBgm();
    void playStartCry();
    starting = true;
    companionTap.disabled = true;
    const token = ++sequence;
    root.setAttribute('aria-busy', 'true');
    for (const button of [start, rules, optionsButton]) button.disabled = true;
    root.dataset.startPhase = 'throwing';
    root.classList.add('is-starting');
    const cube = root.querySelector('.title-dice-cube'),
      die = cube.getBoundingClientRect(),
      screen = root.getBoundingClientRect();
    const fromX = screen.right - die.left + die.width + 24;
    const frames = motionPreference.matches
      ? [
          { opacity: 0, transform: 'translateX(15px)' },
          { opacity: 1, transform: 'translateX(0)' },
        ]
      : [
          { offset: 0, transform: `translate(${fromX}px,-75px) rotate(-720deg) scale(1.2)` },
          { offset: 0.47, transform: 'translate(42px,-34px) rotate(-300deg) scale(1.16)' },
          { offset: 0.68, transform: 'translate(16px,0) rotate(-125deg) scale(1.12,.9)' },
          { offset: 0.83, transform: 'translate(5px,-10px) rotate(-40deg) scale(1.07)' },
          { offset: 1, transform: 'translate(0,0) rotate(0deg) scale(1)' },
        ];
    window.PokekoroSfx?.play('throw');
    window.PokekoroSfx?.startRoll('throw');
    departureDice = cube.animate(frames, {
      duration: motionPreference.matches ? 180 : config.motion.diceThrowMs,
      easing: 'ease-out',
      fill: 'forwards',
    });
    try {
      await departureDice.finished;
    } catch {
      return;
    }
    if (token !== sequence) return;
    window.PokekoroSfx?.stopRoll();
    window.PokekoroSfx?.play('land');
    root.dataset.startPhase = 'settled';
    await new Promise((resolve) =>
      setTimeout(resolve, motionPreference.matches ? 100 : config.motion.diceSettleMs),
    );
    if (token !== sequence) return;
    window.PokekoroSfx?.play('diceResult');
    root.dataset.startPhase = 'walking';
    root.classList.add('is-departing');
    if (action.complete && action.naturalWidth) root.classList.add('hero-is-active');
    const duration = motionPreference.matches ? config.audio.cryMs : config.motion.departureMs;
    await new Promise((resolve) => setTimeout(resolve, duration * 0.24));
    if (token !== sequence) return;
    if (action.complete && action.naturalWidth) root.classList.add('hero-is-active');
    await new Promise((resolve) => setTimeout(resolve, duration * 0.76));
    if (token !== sequence) return;
    document.dispatchEvent(new CustomEvent('title:start'));
  });
  window.PokekoroTitle = Object.freeze({ reset });
  // Suspend the scene whenever title visibility, a dialog, or system motion settings change.
  const idleObserver = new MutationObserver(refreshTitleActivity);
  for (const element of [
    root,
    document.querySelector('#boot-screen'),
    ...document.querySelectorAll('dialog'),
  ]) {
    idleObserver.observe(element, { attributes: true, attributeFilter: ['hidden', 'open'] });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && starting) reset();
    if (!document.hidden && !titleReady) revealMenu();
    refreshTitleActivity();
  });
  motionPreference.addEventListener?.('change', refreshTitleActivity);
  applySettings();
  refreshLeaves();
})();
