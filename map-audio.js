'use strict';
(() => {
  const audio = document.createElement('audio');
  audio.id = 'map-bgm';audio.src = MAP_AUDIO.src;audio.loop = true;audio.preload = 'metadata';audio.volume = MAP_AUDIO.volume;
  document.body.append(audio);
  let enabled = true, priming = false, context = null, gain = null;
  try { const saved = JSON.parse(localStorage.getItem('pokekoro-title-v1'));if (typeof saved?.sound === 'boolean') enabled = saved.sound; } catch {}
  function canPlay() { return enabled && !document.hidden && !document.querySelector('#game-shell').hidden && !document.querySelector('dialog[open]'); }
  function unlock() {
    try {
      if (!context) {
        const AC = window.AudioContext || window.webkitAudioContext;if (!AC) return;
        context = new AC();gain = context.createGain();gain.gain.value = 0;
        context.createMediaElementSource(audio).connect(gain).connect(context.destination);audio.volume = 1;
      }
      if (context.state !== 'running') context.resume().catch(() => {});
    } catch {}
  }
  function level(value, ramp = false) {
    if (!gain) { audio.volume = value;return; }
    const now = context.currentTime;gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    if (ramp) gain.gain.linearRampToValueAtTime(value, now + .25);
    else gain.gain.setValueAtTime(value, now);
  }
  function sync() {
    if (!canPlay()) {
      level(0);
      // A silent first playback unlocks this media element during the Start gesture on iOS.
      if (priming && enabled && !document.hidden && document.querySelector('#title-screen').dataset.startPhase === 'walking') return;
      priming = false;audio.pause();return;
    }
    unlock();level(MAP_AUDIO.volume, true);
    if (audio.paused) audio.play()?.catch(() => {});
  }
  document.addEventListener('click', event => {
    if (!event.target.closest?.('#enter-game') || !enabled || document.querySelector('#enter-game').disabled) return;
    unlock();priming = true;level(0);audio.play()?.catch(() => { priming = false; });
  }, true);
  function userGesture() { if (canPlay()) { unlock();sync(); } }
  document.addEventListener('pointerdown', userGesture, { capture: true, passive: true });
  document.addEventListener('keydown', userGesture, true);
  document.addEventListener('title:start', () => { if (priming) audio.currentTime = 0;priming = false;sync(); });
  document.addEventListener('title:soundchange', event => { enabled = !!event.detail.enabled;sync(); });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { priming = false;audio.pause(); });
  window.addEventListener('pageshow', sync);
  const observer = new MutationObserver(sync);
  for (const element of [document.querySelector('#game-shell'), document.querySelector('#title-screen'), ...document.querySelectorAll('dialog')]) observer.observe(element, { attributes: true, attributeFilter: ['hidden', 'open', 'data-start-phase'] });
  sync();
})();
