'use strict';
// This file owns all debug UI and flags. Comment out its single script tag to remove it.
(() => {
 const SAVE_KEY='pokekoro-debug-v1',PREFS_KEY='pokekoro-debug-settings-v1';
 let active=false,forceTickets=false,normalSnapshot=null;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const style=document.createElement('style');style.textContent=`
 #title-debug{position:absolute;left:max(9px,env(safe-area-inset-left));bottom:max(7px,env(safe-area-inset-bottom));z-index:20;padding:5px 8px;min-height:28px;border:1px solid #ffffff70;border-radius:6px;background:#173b4788;color:#fff;font-size:9px;box-shadow:none}
 #debug-panel{width:min(92vw,440px);max-height:90dvh;padding:20px;border:2px solid #8b72ad;border-radius:14px;background:#f7f4fb;color:#423653;overflow:auto}
 #debug-panel::backdrop{background:#20243bbf}#debug-panel h2{margin:0 0 8px;font-size:20px;color:#60477b}#debug-panel p{font-size:11px;line-height:1.7;color:#766485;margin:6px 0 14px}
 #debug-panel label{display:block;font-size:12px;margin:12px 0;color:#55436d}#debug-panel select{display:block;width:100%;padding:10px;margin-top:5px;border:1px solid #c1aecf;border-radius:7px;font-size:14px;background:white;color:#493c59}
 #debug-panel .debug-check{display:flex;gap:8px;align-items:center;font-size:13px}#debug-panel input[type=checkbox]{width:18px;height:18px;accent-color:#8d66b2}
 .debug-actions{display:flex;gap:8px;margin-top:17px}.debug-actions button{flex:1;min-height:43px;border-radius:8px;border:1px solid #c5b4d7;background:#e9e0f3;color:#634781;padding:9px;font-size:13px;box-shadow:none}#debug-start{background:#8964a8;color:white;border-color:#74548e}
 .debug-status{display:none;position:fixed;z-index:15;right:9px;bottom:max(21px,calc(env(safe-area-inset-bottom) + 17px));padding:3px 6px;border-radius:4px;background:#6c388ccc;color:white;font-size:8px;pointer-events:none}body.debug-mode-active:not(.at-title) .debug-status{display:block}
 `;document.head.append(style);
 const launch=document.createElement('button');launch.id='title-debug';launch.textContent='デバッグ';launch.type='button';document.querySelector('#title-screen').append(launch);
 const panel=document.createElement('dialog');panel.id='debug-panel';panel.setAttribute('aria-labelledby','debug-title');
 panel.innerHTML=`<h2 id="debug-title">デバッグモード</h2><p>通常セーブとは別に保存します。虹のチケット確定は、デバッグ中の通常マップのボス勝利だけに適用されます。</p><label>開始するマップ<select id="debug-map">${[...MAP_ORDER,RAINBOW_CONFIG.mapId].map(id=>`<option value="${id}">${MAPS[id].special?'特別':MAPS[id].chapter}：${MAPS[id].name}</option>`).join('')}</select></label><label>開始位置<select id="debug-position"><option value="0">出発地点</option><option value="13">ボスの手前</option><option value="14">ボスマス（ボタンで再挑戦）</option></select></label><label id="debug-return-label" hidden>虹の雲のチケット獲得元<select id="debug-return-source">${MAP_ORDER.map(id=>`<option value="${id}">${MAPS[id].name}</option>`).join('')}</select></label><label class="debug-check"><input id="debug-force-ticket" type="checkbox" checked>虹のチケットを確定ドロップ</label><p>虹の雲への直接移動ではチケットを消費しません。名前・画像・タイプなどは本編と同じ仮設定です。</p><div class="debug-actions"><button id="debug-close">とじる</button><button id="debug-start">この設定で開始</button></div>`;document.body.append(panel);
 const badge=document.createElement('span');badge.className='debug-status';document.body.append(badge);
 const map=panel.querySelector('#debug-map'),position=panel.querySelector('#debug-position'),force=panel.querySelector('#debug-force-ticket'),source=panel.querySelector('#debug-return-source');
 try{const prefs=JSON.parse(localStorage.getItem(PREFS_KEY));if(prefs){if(Object.hasOwn(MAPS,prefs.map))map.value=prefs.map;if(['0','13','14'].includes(String(prefs.position)))position.value=String(prefs.position);force.checked=prefs.force!==false;if(MAP_ORDER.includes(prefs.source))source.value=prefs.source}}catch{}
 function updateSource(){panel.querySelector('#debug-return-label').hidden=map.value!==RAINBOW_CONFIG.mapId}
 map.addEventListener('change',updateSource);updateSource();
 function setActive(value){active=value;document.body.classList.toggle('debug-mode-active',active);badge.textContent=forceTickets?'DEBUG・虹チケ確定':'DEBUG'}
 window.PokekoroDebug=Object.freeze({isActive:()=>active,forceRainbowTicket:()=>active&&forceTickets,saveKey:()=>active?SAVE_KEY:null});
 launch.onclick=()=>panel.showModal();panel.querySelector('#debug-close').onclick=()=>panel.close();
 panel.querySelector('#debug-start').onclick=()=>{
  const mapId=map.value;if(!Object.hasOwn(MAPS,mapId))return;
  if(!active)normalSnapshot=clone(state);
  let saved=null;try{saved=JSON.parse(localStorage.getItem(SAVE_KEY))}catch{}
  // Start from a valid in-memory schema; only retain debug collection and inventories.
  const next=clone(active?state:normalSnapshot||state);
  if(saved&&Array.isArray(saved.owned)&&Array.isArray(saved.party)){
   const owned=[...new Set(saved.owned.filter(validPokemonId))],party=[...new Set(saved.party.filter(id=>validPokemonId(id)&&owned.includes(id)))].slice(0,PARTY_SIZE);
   if(party.length){next.owned=owned;next.party=party;for(const key of ['balls','super','hyper','master'])if(Number.isSafeInteger(saved[key])&&saved[key]>=0)next[key]=saved[key];if(Array.isArray(saved.clearedMaps))next.clearedMaps=[...new Set(saved.clearedMaps.filter(id=>MAP_ORDER.includes(id)))];if(Array.isArray(saved.rainbowTickets))next.rainbowTickets=saved.rainbowTickets.map(normalizeRainbowTicket).filter(Boolean);if(Number.isSafeInteger(saved.tour)&&saved.tour>0)next.tour=saved.tour;if(Array.isArray(saved.typeBalls))next.typeBalls=saved.typeBalls;if(saved.kurtHouses&&typeof saved.kurtHouses==='object')next.kurtHouses=saved.kurtHouses;next.nextRainbowTicketId=Math.max(next.nextRainbowTicketId,...next.rainbowTickets.map(t=>t.id+1))}
  }
  normalizeTypeBalls(next);forceTickets=force.checked;setActive(true);state=next;resetDicePresentation();battleEpoch++;preparing=false;running=false;capturePending=false;cancelAnimationFrame(raf);battle=null;busy=false;
  state.mapId=mapId;state.pos=Number(position.value);state.lap=1;state.pendingMapId=null;state.rainbowVisit=null;
  if(mapId===RAINBOW_CONFIG.mapId){const from=source.value,nextMap=MAPS[from].nextMap||MAP_ORDER[0];state.rainbowVisit={id:state.nextRainbowTicketId++,sourceMapId:from,returnMapId:nextMap,returnTour:state.tour+(from===MAP_ORDER.at(-1)?1:0),bossId:RAINBOW_CONFIG.bossIds[0],exitPending:false}}
  try{localStorage.setItem(PREFS_KEY,JSON.stringify({map:mapId,position:position.value,force:forceTickets,source:source.value}))}catch{}
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();window.PokekoroTitle?.reset();showTab('map');render();document.dispatchEvent(new CustomEvent('title:start'));document.querySelector('#message').textContent='デバッグ：'+activeMap().name;
 };
 // The regular Start button always restores the untouched normal progress.
 document.querySelector('#enter-game').addEventListener('click',()=>{
  if(!active)return;resetDicePresentation();battleEpoch++;battle=null;busy=false;preparing=false;running=false;capturePending=false;cancelAnimationFrame(raf);state=clone(normalSnapshot);setActive(false);render();
 },true);
})();
