'use strict';
(() => {
  const audio = document.createElement('audio');
  audio.id = 'map-bgm';audio.src = MAP_AUDIO.src;audio.loop = true;audio.preload = 'metadata';audio.volume = MAP_AUDIO.volume;
  document.body.append(audio);
  let enabled = true, priming = false, context = null, gain = null,currentTheme='field';
  const failedTracks=new Set(),positions=new Map();
  let battlePrefetch=null;
  document.addEventListener('battle:prepare',()=>{if(battle?.trainer&&!battlePrefetch)battlePrefetch=fetch(MAP_MUSIC_TRACKS.trainerBattle,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer()}).catch(()=>{battlePrefetch=null})});
  function isVictoryScene(){return !!battle?.victory&&(document.querySelector('#battle').open||document.querySelector('#result').open)}
  function isTrainerScene(){return !!battle?.trainer&&(document.querySelector('#encounter').open||document.querySelector('#battle').open)}
  function isWildScene(){return !!battle&&!battle.trainer&&(document.querySelector('#encounter').open||document.querySelector('#battle').open)}
  audio.dataset.theme=currentTheme;
  function selectTrack(){const requested=isVictoryScene()?(battle.trainer?'trainerVictory':'victory'):isTrainerScene()?(document.querySelector('#battle').open?'trainerBattle':'trainer'):isWildScene()?'wild':mapMusicTheme(state.mapId),next=failedTracks.has(requested)?'field':requested;if(next===currentTheme)return;positions.set(currentTheme,Number.isFinite(audio.currentTime)?audio.currentTime:0);level(0);audio.pause();currentTheme=next;audio.dataset.theme=next;const position=['wild','trainer','trainerBattle','victory','trainerVictory'].includes(next)?0:positions.get(next)||0;audio.onloadedmetadata=()=>{if(currentTheme===next&&position>0&&Number.isFinite(audio.duration))audio.currentTime=Math.min(position,Math.max(0,audio.duration-.1))};audio.src=MAP_MUSIC_TRACKS[next];audio.load()}

  audio.addEventListener('error',()=>{if(currentTheme==='field')return;failedTracks.add(currentTheme);selectTrack();sync()});
  try { const saved = JSON.parse(localStorage.getItem('pokekoro-title-v1'));if (typeof saved?.sound === 'boolean') enabled = saved.sound; } catch {}
  function canPlay() {if(!enabled||document.hidden||document.querySelector('#game-shell').hidden)return false;const excluded=isVictoryScene()?':not(#battle):not(#result)':(isWildScene()||isTrainerScene())?':not(#encounter):not(#battle)':'';return !document.querySelector('dialog[open]:not(#game-menu):not(#item-bag):not(#title-options)'+excluded)}

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
  function sync(immediate=false) {
    selectTrack();
    if (!canPlay()) {
      level(0);
      // A silent first playback unlocks this media element during the Start gesture on iOS.
      if (priming && enabled && !document.hidden && ['throwing','settled','walking'].includes(document.querySelector('#title-screen').dataset.startPhase)) return;
      priming = false;audio.pause();return;
    }
    unlock();level(mapMusicVolume(currentTheme), immediate!==true);
    if (audio.paused) audio.play()?.catch(() => {});
  }
  document.addEventListener('click', event => {
    if (!event.target.closest?.('#enter-game') || !enabled || document.querySelector('#enter-game').disabled) return;
    selectTrack();unlock();priming = true;level(0);audio.play()?.catch(() => { priming = false; });
  }, true);
  function userGesture() { if (canPlay()) { unlock();sync(); } }
  document.addEventListener('pointerdown', userGesture, { capture: true, passive: true });
  document.addEventListener('keydown', userGesture, true);
  document.addEventListener('title:start', () => { if (priming) audio.currentTime = 0;priming = false;sync(); });
  document.addEventListener('title:soundchange', event => { enabled = !!event.detail.enabled;sync(); });
  document.addEventListener('battle:enter',()=>{unlock();sync(true)});
  document.addEventListener('battle:victory',sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { priming = false;audio.pause(); });
  window.addEventListener('pageshow', sync);
  const observer = new MutationObserver(sync);
  for (const element of [document.querySelector('#game-shell'), document.querySelector('#title-screen'), ...document.querySelectorAll('dialog')]) observer.observe(element, { attributes: true, attributeFilter: ['hidden', 'open', 'data-start-phase'] });
  observer.observe(document.querySelector('#map'),{attributes:true,attributeFilter:['data-map']});
  sync();
})();
