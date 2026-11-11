'use strict';
(() => {
  const config = window.POKEKORO_TITLE;
  const root = document.querySelector('#title-screen');
  const start = document.querySelector('#enter-game');
  const rules = document.querySelector('#help');
  const optionsButton = document.querySelector('#open-options');
  const options = document.querySelector('#title-options');
  const sound = document.querySelector('#sound-toggle');
  const companion = document.querySelector('#companion-toggle');
  const action = root.querySelector('.hero-action');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const settingsKey = 'pokekoro-title-v1';
  let starting = false;
  let sequence = 0;
  let settings = { ...config.defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey));
    if (saved && typeof saved.sound === 'boolean') settings.sound = saved.sound;
    if (saved && typeof saved.companion === 'boolean') settings.companion = saved.companion;
  } catch { /* Storage is optional; gameplay and settings still work in memory. */ }

  root.style.setProperty('--cloud-duration', `${config.motion.cloudsSeconds}s`);
  root.style.setProperty('--hero-idle-duration', `${config.motion.idleSeconds}s`);
  root.style.setProperty('--departure-duration', `${config.motion.departureMs}ms`);
  for (const image of root.querySelectorAll('[data-title-image]')) {
    image.src = config.assets[image.dataset.titleImage];
    image.addEventListener('error', () => {
      image.hidden = true;
      if (image === action) root.classList.add('action-unavailable');
    });
  }
  for (const layer of root.querySelectorAll('[data-title-background]')) {
    layer.style.backgroundImage = `url("${config.assets[layer.dataset.titleBackground]}")`;
  }

  function applySettings(persist = false) {
    root.classList.toggle('without-companion', !settings.companion);
    sound.querySelector('.sound-status').textContent = settings.sound ? 'ON' : 'OFF';
    sound.setAttribute('aria-pressed', String(settings.sound));
    sound.setAttribute('aria-label', `サウンド ${settings.sound ? 'ON' : 'OFF'}`);
    companion.querySelector('span').textContent = settings.companion ? 'ON' : 'OFF';
    companion.setAttribute('aria-pressed', String(settings.companion));
    companion.setAttribute('aria-label', `青い相棒 ${settings.companion ? 'ON' : 'OFF'}`);
    document.dispatchEvent(new CustomEvent('title:soundchange', { detail: { enabled: settings.sound, userGesture: persist } }));
    if (persist) {
      try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch { /* Optional storage. */ }
    }
  }
  sound.addEventListener('click', () => { settings.sound = !settings.sound; applySettings(true); });
  companion.addEventListener('click', () => { settings.companion = !settings.companion; applySettings(true); });
  optionsButton.addEventListener('click', () => { if (!starting) options.showModal(); });
  document.querySelector('#close-title-options').addEventListener('click', () => options.close());

  function reset() {
    sequence++;
    starting = false;
    root.classList.remove('is-departing', 'hero-is-active');
    root.removeAttribute('aria-busy');
    for (const button of [start, rules, optionsButton]) button.disabled = false;
  }
  start.addEventListener('click', async () => {
    if (starting) return;
    starting = true;
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
  applySettings();
})();
