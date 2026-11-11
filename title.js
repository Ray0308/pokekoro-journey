'use strict';
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
  let sequence = 0;
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
  } catch { /* Storage is optional; gameplay and settings still work in memory. */ }

  root.style.setProperty('--cloud-duration', `${config.motion.cloudsSeconds}s`);
  root.style.setProperty('--hero-idle-duration', `${config.motion.idleSeconds}s`);
  root.style.setProperty('--departure-duration', `${config.motion.departureMs}ms`);
  for (const image of root.querySelectorAll('[data-title-image]')) {
    image.src = config.assets[image.dataset.titleImage];
    image.addEventListener('error', () => {
      image.hidden = true;
      if (image === action) root.classList.add('action-unavailable');
      if (image.matches('.hero-glance, .companion-eat')) {
        root.classList.add('idle-poses-unavailable');
        refreshIdleScene();
      }
    });
  }
  for (const layer of root.querySelectorAll('[data-title-background]')) {
    layer.style.backgroundImage = `url("${config.assets[layer.dataset.titleBackground]}")`;
  }

  function canShowTitle() {
    return !starting && !root.hidden && !document.hidden &&
      document.querySelector('#boot-screen').hidden && !document.querySelector('dialog[open]');
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
      const count = breeze.minLeaves + Math.floor(Math.random() * (breeze.maxLeaves - breeze.minLeaves + 1));
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
        leaf.style.setProperty('--leaf-drop', `${root.clientHeight * (.12 + Math.random() * .12)}px`);
        leaf.style.setProperty('--leaf-life', `${life}ms`);
        leaf.style.setProperty('--leaf-delay', `${stagger}ms`);
        leaf.style.setProperty('--leaf-color', ['#b6d44b', '#88b74f', '#d3dc6a'][i % 3]);
        shape.style.animationDelay = `${-Math.random() * 1200}ms`;
        leaf.append(shape);
        leafLayer.append(leaf);
        leaf.addEventListener('animationend', event => { if (event.target === leaf) leaf.remove(); });
        cleanupAfter = Math.max(cleanupAfter, life + stagger);
      }
      leafCleanupTimer = setTimeout(() => {
        if (token === leafGeneration) refreshLeaves();
      }, cleanupAfter + 120);
    }, delay);
  }
  function refreshTitleActivity() {
    refreshIdleScene();
    refreshLeaves();
  }
  function canIdle() { return canPlayScene() && !motionPreference.matches; }
  function stopIdleScene() {
    idleGeneration++;
    clearTimeout(idleTimer);
    idleTimer = 0;
    idlePlaying = false;
    companionTap.disabled = starting;
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
    const eligible = () => fromTap ? canPlayScene() : canIdle();
    if (idlePlaying || token !== idleGeneration || !eligible()) return;
    idleTimer = 0;
    const frames = [root.querySelector('.companion-eat'), root.querySelector('.hero-glance')];
    if (!frames.every(image => image.complete && image.naturalWidth)) {
      refreshIdleScene();
      return;
    }
    idlePlaying = true;
    companionTap.disabled = true;
    companionTap.setAttribute('aria-busy', 'true');
    const wait = ms => new Promise(resolve => { idleTimer = setTimeout(resolve, ms); });
    const valid = () => token === idleGeneration && eligible();
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

  function applySettings(persist = false) {
    sound.querySelector('.sound-status').textContent = settings.sound ? 'ON' : 'OFF';
    sound.setAttribute('aria-pressed', String(settings.sound));
    sound.setAttribute('aria-label', `サウンド ${settings.sound ? 'ON' : 'OFF'}`);
    document.dispatchEvent(new CustomEvent('title:soundchange', { detail: { enabled: settings.sound, userGesture: persist } }));
    refreshIdleScene();
    if (persist) {
      try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch { /* Optional storage. */ }
    }
  }
  sound.addEventListener('click', () => { settings.sound = !settings.sound; applySettings(true); });
  optionsButton.addEventListener('click', () => { if (!starting) options.showModal(); });
  document.querySelector('#close-title-options').addEventListener('click', () => options.close());

  function reset() {
    stopLeaves();
    stopIdleScene();
    sequence++;
    starting = false;
    root.classList.remove('is-departing', 'hero-is-active');
    root.removeAttribute('aria-busy');
    for (const button of [start, rules, optionsButton]) button.disabled = false;
    refreshTitleActivity();
  }
  start.addEventListener('click', async () => {
    if (starting) return;
    stopLeaves();
    stopIdleScene();
    starting = true;
    companionTap.disabled = true;
    const token = ++sequence;
    root.setAttribute('aria-busy', 'true');
    for (const button of [start, rules, optionsButton]) button.disabled = true;
    root.classList.add('is-departing');
    const duration = motionPreference.matches ? 120 : config.motion.departureMs;
    await new Promise(resolve => setTimeout(resolve, duration * .24));
    if (token !== sequence) return;
    if (action.complete && action.naturalWidth) root.classList.add('hero-is-active');
    await new Promise(resolve => setTimeout(resolve, duration * .76));
    if (token !== sequence) return;
    document.dispatchEvent(new CustomEvent('title:start'));
  });
  window.PokekoroTitle = Object.freeze({ reset });
  // Suspend the scene whenever title visibility, a dialog, or system motion settings change.
  const idleObserver = new MutationObserver(refreshTitleActivity);
  for (const element of [root, document.querySelector('#boot-screen'), ...document.querySelectorAll('dialog')]) {
    idleObserver.observe(element, { attributes: true, attributeFilter: ['hidden', 'open'] });
  }
  document.addEventListener('visibilitychange', refreshTitleActivity);
  motionPreference.addEventListener?.('change', refreshTitleActivity);
  applySettings();
  refreshLeaves();
})();
