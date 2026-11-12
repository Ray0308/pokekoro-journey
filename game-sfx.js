'use strict';
(() => {
 const CONFIG=Object.freeze({volume:.30,diceVolume:1.9,maxVoices:40,rollHoldMs:66,rollThrowMs:55});
 let enabled=true,context=null,master=null,diceBus=null,effectBus=null,noise=null,rollTimer=0,rollMode=null,rollBegan=0,rollBeat=0,seed=901;
 const voices=new Set(),recent=new Map();
 try{const saved=JSON.parse(localStorage.getItem('pokekoro-title-v1'));if(typeof saved?.sound==='boolean')enabled=saved.sound}catch{}
 function unlock(){if(!enabled||document.hidden)return false;try{if(!context){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;context=new AC({latencyHint:'interactive'});master=context.createGain();master.gain.value=CONFIG.volume;const compressor=context.createDynamicsCompressor();compressor.threshold.value=-12;compressor.ratio.value=5;master.connect(compressor).connect(context.destination);diceBus=context.createGain();diceBus.gain.value=CONFIG.diceVolume;diceBus.connect(master);noise=context.createBuffer(1,Math.ceil(context.sampleRate*.16),context.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1}}if(context.state==='suspended')context.resume().catch(()=>{});return context.state!=='closed'}catch{return false}}
 function track(node,connections){while(voices.size>=CONFIG.maxVoices){const old=voices.values().next().value;voices.delete(old);try{old.stop()}catch{}}voices.add(node);node.onended=()=>{voices.delete(node);node.disconnect();connections.forEach(n=>n.disconnect())}}
 function note(frequency,duration=.1,delay=0,volume=.12,end=frequency,wave='sine'){if(!unlock())return;const now=context.currentTime+delay,o=context.createOscillator(),g=context.createGain();o.type=wave;o.frequency.setValueAtTime(frequency,now);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+duration);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(volume,now+.004);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g).connect(effectBus||master);track(o,[g]);o.start(now);o.stop(now+duration+.01)}
 function tapNoise(duration=.045,frequency=1200,volume=.17,delay=0){if(!unlock())return;const now=context.currentTime+delay,source=context.createBufferSource(),filter=context.createBiquadFilter(),g=context.createGain();source.buffer=noise;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.8;g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);source.connect(filter).connect(g).connect(effectBus||master);track(source,[filter,g]);source.start(now);source.stop(now+duration)}
 function notes(sequence,step=.075,volume=.12){sequence.forEach((f,i)=>note(f,.16,i*step,volume,f*.99,'triangle'))}
 function play(name,value=0){if(!enabled||document.hidden)return;const now=performance.now(),cooldown=name==='step'?75:name==='gem'?65:35;if(now-(recent.get(name)??-10000)<cooldown)return;recent.set(name,now);if(!unlock())return;effectBus=['roll','throw','land','diceResult'].includes(name)?diceBus:null;
  switch(name){
   case 'roll':{const f=[720,960,820,1100][rollBeat++%4];tapNoise(.025,2100,.2);note(f,.045,0,.18,f*.76,'triangle');note(f*1.9,.018,0,.045,f*1.7,'square');break;}
   case 'throw':note(450,.16,0,.15,1550,'triangle');tapNoise(.09,2700,.16);break;
   case 'land':tapNoise(.055,2400,.4);note(420,.105,0,.26,120,'triangle');note(1700,.025,0,.09,1100,'square');tapNoise(.025,1900,.16,.075);break;
   case 'diceResult':notes([1047,1397,2093],.075,.2);note(2093,.22,.15,.055,2093);break;
   case 'step':tapNoise(.035,700,.1);note(150,.04,0,.055,95);break;
   case 'menuOpen':notes([440,660],.045,.08);break;
   case 'menuClose':notes([550,370],.04,.065);break;
   case 'select':note(850,.045,0,.07,1050);break;
   case 'confirm':notes([660,990],.045,.08);break;
   case 'gem':tapNoise(.08,4400,.12);notes([950+Math.min(value,10)*40,1450+Math.min(value,10)*45],.035,.07);break;
   case 'charge':note(700,.07,0,.055,1150);break;
   case 'gather':note(170,.6,0,.12,600);break;
   case 'release':note(650,.23,0,.14,1450);tapNoise(.16,1800,.12);break;
   case 'hit':tapNoise(.12,850,.22);note(130,.16,0,.12,45);break;
   case 'ballThrow':note(300,.18,0,.09,1200);tapNoise(.12,2500,.06);break;
   case 'ballHit':tapNoise(.05,2000,.22);notes([1000,1400],.04,.09);break;
   case 'ballShake':tapNoise(.045,650,.12);note(360,.06,0,.075,220);break;
   case 'success':notes([523,659,784,1047],.1,.13);break;
   case 'fail':notes([440,330,220],.1,.09);break;
   case 'badge':notes([523,659,784,1047,1319],.12,.14);break;
   case 'arrive':notes([392,523,659],.08,.1);break;
  }
  effectBus=null;
 }
 function stopRoll(){clearTimeout(rollTimer);rollTimer=0;rollMode=null}
 function startRoll(mode='hold'){stopRoll();if(!enabled||!unlock())return;rollMode=mode;rollBeat=0;rollBegan=performance.now();function tick(){if(!rollMode||!enabled||document.hidden)return;play('roll');const delay=mode==='hold'?CONFIG.rollHoldMs:CONFIG.rollThrowMs+Math.min(110,(performance.now()-rollBegan)*.095);rollTimer=setTimeout(tick,delay)}tick()}
 function stopAll(){stopRoll();for(const node of voices){try{node.stop()}catch{}}voices.clear();recent.clear()}
 document.addEventListener('title:soundchange',e=>{enabled=!!e.detail.enabled;if(!enabled)stopAll();else if(e.detail.userGesture)unlock()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll()});window.addEventListener('pagehide',stopAll);window.addEventListener('blur',stopRoll);document.addEventListener('title:start',stopRoll);
 document.addEventListener('pointerdown',e=>{if(e.isTrusted)unlock()},{capture:true,passive:true});document.addEventListener('keydown',e=>{if(e.isTrusted)unlock()},true);
 document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b||b.disabled||b.closest('#boot-screen')||['roll','enter-game','game-menu-toggle'].includes(b.id))return;if(b.closest('#game-menu'))play('confirm');else if(b.closest('#pokedex-device')||b.hasAttribute('data-tab'))play('select');else if(b.id.startsWith('close-')||['device-close','item-bag-back'].includes(b.id))play('menuClose');else if(b.closest('#battle')||b.closest('#result'))return;else play('select')},true);
 window.PokekoroSfx=Object.freeze({play,startRoll,stopRoll,stopAll,tone:(f,d)=>note(f,d,0,.12),config:CONFIG});
})();
