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
  let titleReady=false,menuReadyTimer=0,primedDuringIntro=false;
  const titleButtons=[start,rules,optionsButton];
  titleButtons.forEach(button=>button.disabled=true);
  root.classList.add('is-menu-waiting');
  function revealMenu(){clearTimeout(menuReadyTimer);if(document.hidden||root.hidden||!document.querySelector('#boot-screen').hidden)return;menuReadyTimer=setTimeout(()=>{if(document.hidden||root.hidden)return;titleReady=true;root.classList.remove('is-menu-waiting');titleButtons.forEach(button=>button.disabled=starting);refreshTitleActivity()},config.motion.menuDelayMs)}
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

  const bgm = document.createElement('audio');
  bgm.id = 'title-bgm';
  bgm.src = config.audio.titleBgm;
  bgm.loop = true;
  bgm.preload = 'auto';
  bgm.volume = config.audio.volume;
  document.body.append(bgm);
  const cry = document.createElement('audio');
  cry.id = 'title-start-cry';cry.src = config.audio.startCry;cry.preload = 'auto';
  document.body.append(cry);
  let musicContext = null, musicGain = null, finishCry = null;
  function unlockMusicGraph() {
    try {
      if (!musicContext) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        musicContext = new AC();musicGain = musicContext.createGain();
        musicGain.gain.value = config.audio.volume;
        musicContext.createMediaElementSource(bgm).connect(musicGain).connect(musicContext.destination);
        musicContext.createMediaElementSource(cry).connect(musicContext.destination);
        bgm.volume = 1;
      }
      if (musicContext.state === 'suspended') musicContext.resume().catch(() => {});
    } catch { /* Media-element volume remains the fallback. */ }
  }
  function restoreMusicVolume() {
    if (musicGain) { musicGain.gain.cancelScheduledValues(musicContext.currentTime);musicGain.gain.setValueAtTime(config.audio.volume, musicContext.currentTime); }
    else bgm.volume = config.audio.volume;
  }
  function fadeMusic(duration) {
    if (musicGain) {
      const now = musicContext.currentTime;musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(musicGain.gain.value, now);
      musicGain.gain.linearRampToValueAtTime(0, now + duration / 1000);
    }
    return new Promise(resolve => {
      const began = performance.now(), token = sequence, volume = bgm.volume;
      function tick(now) {
        if (token !== sequence) { resolve();return; }
        const progress = Math.min(1, (now - began) / duration);
        if (!musicGain) bgm.volume = volume * (1 - progress);
        if (progress < 1) requestAnimationFrame(tick);
        else { resolve(); }
      }
      requestAnimationFrame(tick);
    });
  }
  function stopCry() { cry.pause();cry.currentTime = 0;finishCry?.(); }
  function playStartCry() {
    return new Promise(resolve => {
      let timer;
      function finish() { clearTimeout(timer);cry.removeEventListener('ended', finish);cry.removeEventListener('error', finish);finishCry = null;resolve(); }
      finishCry = finish;
      if (!settings.sound) { timer = setTimeout(finish, config.audio.cryMs);return; }
      cry.currentTime = 0;cry.addEventListener('ended', finish);cry.addEventListener('error', finish);
      timer = setTimeout(finish, config.audio.cryMs + 500);
      cry.play()?.catch(finish);
    });
  }
  function canPlayBgm() {
    return settings.sound && !root.hidden && !document.hidden &&
      document.querySelector('#boot-screen').hidden;
  }
  function syncBgm() {
    if (!canPlayBgm()) { if(!(primedDuringIntro&&settings.sound&&!root.hidden&&!document.hidden))bgm.pause(); return; }
    if (bgm.paused) {
      // Mobile browsers unlock audio on a tap; rejection leaves the next gesture free to retry.
      bgm.play()?.then(() => { if (!canPlayBgm()) bgm.pause(); }).catch(() => {});
    }
  }
  function unlockBgm(event) {
    if(!event.isTrusted||root.hidden||document.hidden||!settings.sound)return;
    if (event.target.closest?.('#enter-game, #sound-toggle')&&titleReady) return;
    unlockMusicGraph();
    if(!document.querySelector('#boot-screen').hidden&&musicGain){
      musicGain.gain.setValueAtTime(0,musicContext.currentTime);primedDuringIntro=true;
      bgm.play()?.catch(()=>{primedDuringIntro=false});
    }else syncBgm();
  }
  document.addEventListener('pointerdown', unlockBgm, { capture: true, passive: true });
  document.addEventListener('keydown', unlockBgm, { capture: true });
  document.addEventListener('touchend', unlockBgm, { capture:true,passive:true });
  document.addEventListener('click', unlockBgm, { capture:true });
  window.addEventListener('pagehide', () => { if (starting) reset();bgm.pause();stopCry(); });
  window.addEventListener('pageshow', syncBgm);
  document.addEventListener('title:start', () => { bgm.pause();stopCry(); });
  document.addEventListener('studio:ready',()=>{if(primedDuringIntro)bgm.currentTime=0;primedDuringIntro=false;restoreMusicVolume();syncBgm();revealMenu()});

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
  const posePreparation = Promise.all(poseFrames.map(async image => {
    try {
      if (typeof image.decode === 'function') await image.decode();
      else if (!image.complete) await new Promise((resolve, reject) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', reject, { once: true });
      });
      return image.complete && image.naturalWidth > 0;
    } catch { return false; }
  })).then(results => results.every(Boolean));
  for (const layer of root.querySelectorAll('[data-title-background]')) {
    layer.style.backgroundImage = `url("${config.assets[layer.dataset.titleBackground]}")`;
  }

  // Readiness includes decoded CSS backgrounds, not just <img> download events.
  async function decoded(image){
    try{if(typeof image.decode==='function')await image.decode();else if(!image.complete)await new Promise((resolve,reject)=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',reject,{once:true})});return image.naturalWidth>0}catch{return false}
  }
  const backgroundPreparation=[...new Set([...root.querySelectorAll('[data-title-background]')].map(layer=>config.assets[layer.dataset.titleBackground]))].map(src=>{const image=new Image();image.src=src;return decoded(image)});
  Promise.all([...root.querySelectorAll('[data-title-image]')].map(decoded).concat(backgroundPreparation)).then(()=>document.fonts?.ready).catch(()=>{}).then(()=>{
    window.PokekoroTitleAssetsReady=true;document.dispatchEvent(new CustomEvent('title:assetsready'));
  });

  function canShowTitle() {
    return titleReady && !starting && !root.hidden && !document.hidden &&
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
    syncBgm();
    refreshIdleScene();
    refreshLeaves();
  }
  function canIdle() { return canPlayScene() && !motionPreference.matches; }
  function stopIdleScene() {
    idleGeneration++;
    clearTimeout(idleTimer);
    idleTimer = 0;
    idlePlaying = false;
    companionTap.disabled = starting||!titleReady;
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
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (!valid()) return;
    const wait = ms => new Promise(resolve => { idleTimer = setTimeout(resolve, ms); });
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
    if (persist) unlockMusicGraph();
    syncBgm();
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
  optionsButton.addEventListener('click', () => { if (!starting&&titleReady) options.showModal(); });
  document.querySelector('#close-title-options').addEventListener('click', () => options.close());

  function reset() {
    stopLeaves();
    stopIdleScene();
    sequence++;
    stopCry();restoreMusicVolume();
    starting = false;
    root.classList.remove('is-departing', 'hero-is-active');
    root.removeAttribute('aria-busy');
    delete root.dataset.startPhase;
    titleReady=false;root.classList.add('is-menu-waiting');for (const button of titleButtons) button.disabled = true;revealMenu();
    refreshTitleActivity();
  }
  start.addEventListener('click', async () => {
    if (starting||!titleReady) return;
    stopLeaves();
    stopIdleScene();
    unlockMusicGraph();syncBgm();
    starting = true;
    companionTap.disabled = true;
    const token = ++sequence;
    root.setAttribute('aria-busy', 'true');
    for (const button of [start, rules, optionsButton]) button.disabled = true;
    root.dataset.startPhase = 'walking';
    root.classList.add('is-departing');
    if (action.complete && action.naturalWidth) root.classList.add('hero-is-active');
    const duration = motionPreference.matches ? config.audio.cryMs : config.motion.departureMs;
    void playStartCry();
    const fading = fadeMusic(duration);
    await new Promise(resolve => setTimeout(resolve, duration * .24));
    if (token !== sequence) return;
    if (action.complete && action.naturalWidth) root.classList.add('hero-is-active');
    await new Promise(resolve => setTimeout(resolve, duration * .76));
    if (token !== sequence) return;
    await fading;
    if (token !== sequence) return;
    document.dispatchEvent(new CustomEvent('title:start'));
  });
  window.PokekoroTitle = Object.freeze({ reset });
  // Suspend the scene whenever title visibility, a dialog, or system motion settings change.
  const idleObserver = new MutationObserver(refreshTitleActivity);
  for (const element of [root, document.querySelector('#boot-screen'), ...document.querySelectorAll('dialog')]) {
    idleObserver.observe(element, { attributes: true, attributeFilter: ['hidden', 'open'] });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && starting) reset();if(document.hidden)clearTimeout(menuReadyTimer);else if(!titleReady)revealMenu();refreshTitleActivity(); });
  motionPreference.addEventListener?.('change', refreshTitleActivity);
  applySettings();
  refreshLeaves();
})();
