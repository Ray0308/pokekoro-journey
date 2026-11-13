'use strict';
const $=s=>document.querySelector(s), types=POKEMON_TYPE_NAMES,icons=POKEMON_TYPE_ICONS,colors=POKEMON_TYPE_COLORS;
const PARTY_SIZE=6;
const MAP_ASSETS=Object.freeze({player:'assets/map/player.webp',grass:'assets/map/grass.webp',center:'assets/map/pokemon-center.webp'});
const mons=POKEDEX;
let state={owned:[1,4,7],party:[1,4,7],pos:0,lap:1,balls:8,super:2};try{let s=JSON.parse(localStorage.getItem('pokekoro-v1'));if(s&&Array.isArray(s.owned)&&Array.isArray(s.party)&&s.party.length&&s.party.length<=PARTY_SIZE&&s.party.every(id=>validPokemonId(id)&&s.owned.includes(id))&&Number.isInteger(s.pos)&&s.pos>=0&&s.pos<15&&Number.isFinite(s.balls)&&Number.isFinite(s.super)&&s.balls>=0&&s.super>=0)state=s}catch{}
state.owned=[...new Set(state.owned.filter(validPokemonId))];
state.seen=[...new Set([...(Array.isArray(state.seen)?state.seen.filter(validPokemonId):[]),...state.owned])];
function pokemonSeen(id){return state.owned.includes(id)||(Array.isArray(state.seen)&&state.seen.includes(id))}
function markPokemonSeen(id){if(!validPokemonId(id))return;state.seen=[...new Set([...(state.seen||[]),...state.owned,id])];save()}
state.party=[...new Set(state.party.filter(id=>validPokemonId(id)&&state.owned.includes(id)))].slice(0,PARTY_SIZE);
// Repair legacy parties using already owned Pokémon, without granting new ones.
if(partyTypes(state.party).length<3&&partyTypes(state.owned).length>=3){
 const repaired=[];for(const id of [...state.party,...state.owned]){if(repaired.includes(id))continue;if(partyTypes([...repaired,id]).length>partyTypes(repaired).length)repaired.push(id);if(partyTypes(repaired).length>=3)break}
 for(const id of state.party)if(repaired.length<PARTY_SIZE&&!repaired.includes(id))repaired.push(id);
 state.party=repaired;
}
// Migrate old saves without resetting inventory, party, position or laps.
state.hyper=Number.isSafeInteger(state.hyper)&&state.hyper>=0?state.hyper:0;
state.master=Number.isSafeInteger(state.master)&&state.master>=0?state.master:0;
const remapMapId=id=>Object.hasOwn(MAP_ALIASES,id)?MAP_ALIASES[id]:id;
state.mapId=remapMapId(state.mapId);
state.mapId=Object.hasOwn(MAPS,state.mapId)?state.mapId:'viridian';
state.clearedMaps=Array.isArray(state.clearedMaps)?[...new Set(state.clearedMaps.map(remapMapId).filter(id=>Object.hasOwn(MAPS,id)))]:[];
state.tour=Number.isSafeInteger(state.tour)&&state.tour>0?state.tour:1;
function normalizeRainbowTicket(ticket){
 if(!ticket||!Number.isSafeInteger(ticket.id)||ticket.id<1||!MAP_ORDER.includes(ticket.sourceMapId))return null;
 const returnMapId=MAP_ORDER.includes(ticket.returnMapId)?ticket.returnMapId:MAPS[ticket.sourceMapId].nextMap||MAP_ORDER[0];
 return {id:ticket.id,sourceMapId:ticket.sourceMapId,returnMapId,returnTour:Number.isSafeInteger(ticket.returnTour)&&ticket.returnTour>0?ticket.returnTour:state.tour};
}
state.rainbowTickets=Array.isArray(state.rainbowTickets)?state.rainbowTickets.map(normalizeRainbowTicket).filter(Boolean):[];
state.rainbowTickets=state.rainbowTickets.filter((ticket,i,list)=>list.findIndex(t=>t.id===ticket.id)===i);
const visitTicket=normalizeRainbowTicket(state.rainbowVisit);
state.rainbowVisit=state.mapId===RAINBOW_CONFIG.mapId&&visitTicket?{...visitTicket,bossId:RAINBOW_CONFIG.bossIds.includes(state.rainbowVisit.bossId)?state.rainbowVisit.bossId:RAINBOW_CONFIG.bossIds[0],exitPending:!!state.rainbowVisit.exitPending}:null;
if(state.mapId===RAINBOW_CONFIG.mapId&&!state.rainbowVisit){state.mapId=MAP_ORDER[0];state.pos=0}
state.nextRainbowTicketId=Math.max(Number.isSafeInteger(state.nextRainbowTicketId)?state.nextRainbowTicketId:1,1,...state.rainbowTickets.map(t=>t.id+1),state.rainbowVisit?state.rainbowVisit.id+1:1);
state.pendingMapId=remapMapId(state.pendingMapId);
state.pendingMapId=!state.rainbowVisit&&state.clearedMaps.includes(state.mapId)&&MAPS[state.mapId].nextMap===state.pendingMapId&&MAP_ORDER.includes(state.pendingMapId)?state.pendingMapId:null;
if(!state.loopVersion&&!state.rainbowVisit&&!state.pendingMapId&&state.pos===14&&state.clearedMaps.includes(state.mapId)&&MAPS[state.mapId].nextMap)state.pendingMapId=MAPS[state.mapId].nextMap;
state.loopVersion=1;
const BALLS=Object.freeze([
 {id:'normal',key:'balls',name:'モンスターボール',image:'assets/poke-ball.jpg',bonus:0,cap:.8},
 {id:'super',key:'super',name:'スーパーボール',image:'assets/great-ball.jpg',bonus:.2,cap:.95},
 {id:'hyper',key:'hyper',name:'ハイパーボール',image:'assets/hyper-ball.webp',bonus:.35,cap:.99},
 {id:'master',key:'master',name:'マスターボール',image:'assets/master-ball.webp',bonus:1,cap:1}
]);
const BALL_DROPS=Object.freeze({normal:.80,super:.17,hyper:.03,bossMaster:.03});
function itemBallDrop(){const r=Math.random();return r<BALL_DROPS.normal?{key:'balls',name:'モンスターボール',count:3}:r<1-BALL_DROPS.hyper?{key:'super',name:'スーパーボール',count:1}:{key:'hyper',name:'ハイパーボール',count:1}}
function isRainbow(){return state.mapId===RAINBOW_CONFIG.mapId}
function currentSquares(){return activeMap().squares||squares}
function rainbowExitReady(){return isRainbow()&&state.rainbowVisit?.exitPending}
function activeBossId(){return isRainbow()?state.rainbowVisit?.bossId||RAINBOW_CONFIG.bossIds[0]:activeMap().boss?.pokemonId||9}
function pickEncounterId(){
 let pool=activeMap().encounterIds?.filter(validPokemonId);
 if(isRainbow()){
  const roll=Math.random()*100,w=RAINBOW_CONFIG.weights;
  pool=roll<w[0]?RAINBOW_POOLS.subLegendary:roll<w[0]+w[1]?RAINBOW_POOLS.legendary:RAINBOW_POOLS.mythical;
 }
 if(!pool?.length)pool=NORMAL_ENCOUNTER_IDS;
 return pool[Math.floor(Math.random()*pool.length)];
}
function grantRainbowTicket(){
 const next=activeMap().nextMap||MAP_ORDER[0];
 const ticket={id:state.nextRainbowTicketId++,sourceMapId:state.mapId,returnMapId:next,returnTour:state.tour+(state.mapId===MAP_ORDER.at(-1)&&next===MAP_ORDER[0]?1:0)};
 state.rainbowTickets.push(ticket);return ticket;
}
function enterRainbow(ticketId){
 if(isRainbow()||capturePending||$('#battle').open||$('#encounter').open)return;
 if(busy&&!($('#result').open&&battle?.trainer&&battle?.rewardResolved))return;
 const index=state.rainbowTickets.findIndex(ticket=>ticket.id===ticketId);if(index<0)return;
 const ticket=state.rainbowTickets.splice(index,1)[0];
 resetDicePresentation();battleEpoch++;state.rainbowVisit={...ticket,bossId:RAINBOW_CONFIG.bossIds[Math.floor(Math.random()*RAINBOW_CONFIG.bossIds.length)],exitPending:false};
 state.mapId=RAINBOW_CONFIG.mapId;state.pos=0;state.lap=1;state.pendingMapId=null;busy=false;battle=null;$('#result').close();showTab('map');render();$('#message').textContent='虹の雲に とうちゃく！';
}
function leaveRainbow(){
 const visit=state.rainbowVisit;if(!visit||!visit.exitPending||capturePending)return;
 resetDicePresentation();battleEpoch++;state.mapId=visit.returnMapId;state.tour=Math.max(state.tour,visit.returnTour);state.rainbowVisit=null;state.pendingMapId=null;state.pos=0;state.lap=1;busy=false;battle=null;$('#result').close();showTab('map');render();$('#message').textContent=activeMap().name+'に もどった！';
}
function renderRainbowHub(){
 const hub=$('#rainbow-hub'),ticket=state.rainbowTickets[0];
 hub.innerHTML=isRainbow()?`<div class="rainbow-hub-card"><strong>虹の雲を ぼうけん中</strong><p>ボス戦のあと：${MAPS[state.rainbowVisit.returnMapId].name}へ</p></div>`:`<div class="rainbow-hub-card"><img src="${RAINBOW_CONFIG.ticketImage}" alt="虹のチケット"><div><strong>虹のチケット ×${state.rainbowTickets.length}</strong><p>${ticket?'獲得：'+MAPS[ticket.sourceMapId].name+'<br>帰り：'+MAPS[ticket.returnMapId].name:'通常マップのボスから まれに手に入るよ'}</p></div><button id="use-rainbow-ticket" ${ticket?'':'disabled'}>虹の雲へ</button></div>`;
 if(ticket&&!isRainbow())$('#use-rainbow-ticket').onclick=()=>enterRainbow(ticket.id);
}
function activeMap(){return MAPS[state.mapId]||MAPS.viridian}
function applyMapTheme(){const map=activeMap();$('#map').style.setProperty('--map-aspect',map.aspectRatio||1);$('#map .board-legend span:first-child').innerHTML=`<img src="${MAP_ASSETS.grass}" alt="">野生`;$('#map .board-legend span:nth-child(3)').innerHTML='<img src="assets/map/item-ball.png" alt="">道具';$('#map').dataset.map=state.mapId;$('#map').classList.toggle('rainbow-map',isRainbow());for(const [key,color] of Object.entries(map.colors))$('#map').style.setProperty('--map-'+key,color);$('#map .maphead h2').textContent=map.name;$('#route').setAttribute('aria-label',map.name+'の双六マップ');$('#map .board-legend span:nth-child(2)').innerHTML=(map.trainerIcon?`<img src="${map.trainerIcon}" alt="">`:'<svg><use href="assets/ui-icons.svg#trainer"/></svg>')+'トレーナー'}
let activePuzzlePointer=null;
let preparing=false,battleEpoch=0,capturePending=false;
let diceHold=null,diceEpoch=0;
let busy=false,battle=null,raf=0,grid=[],path=[],drag=false,lastClear=0,combo=0,maxCombo=0,startAt=0,running=false,elapsed=0;
const squares=['start','wild','item','wild','trainer','wild','item','trainer','wild','wild','item','trainer','wild','wild','goal'];
const label={start:'ポケモンセンター',wild:'草むら',item:'道具',trainer:'トレーナー',goal:'ボス'},symbol={start:'🏕️',wild:'🌿',item:'🎁',trainer:'⚔️',goal:'⚑'};
function save(){localStorage.setItem(window.PokekoroDebug?.saveKey?.()||'pokekoro-v1',JSON.stringify(state))}function img(id){return pokemonImage(id)}
const routePoints=[[17,77],[34,84],[54,84],[74,77],[84,61],[84,44],[75,28],[57,21],[37,22],[20,31],[15,49],[31,60],[50,65],[66,53],[50,41]];
const dungeonRoutePoints=[[16,80],[34,84],[54,82],[75,76],[83,59],[65,54],[46,58],[25,54],[15,38],[31,24],[50,21],[70,25],[83,40],[66,40],[49,40]];
function mapRoutePoints(){const points=activeMap().routePoints||(activeMap().route==='dungeon'?dungeonRoutePoints:routePoints),inset=activeMap().routeInset;return inset?points.map(([x,y])=>[x*inset.scaleX+inset.x,y*inset.scaleY+inset.y]):points}
function tileLabel(kind){if(isSafari()&&kind==='goal')return '特別な出会い';return kind==='wild'?(activeMap().wildLabel||label.wild):label[kind]}
// Use the entire route for tangents, including the travelled prefix, so both roads align.
function routePath(last=routePoints.length-1){
 const points=mapRoutePoints().map(([x,y])=>[x*9,y*9]);
 let d=`M ${points[0][0]} ${points[0][1]}`;
 for(let i=0;i<last;i++){
  const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],e=points[Math.min(points.length-1,i+2)];
  d+=` C ${b[0]+(c[0]-a[0])/6} ${b[1]+(c[1]-a[1])/6} ${c[0]-(e[0]-b[0])/6} ${c[1]-(e[1]-b[1])/6} ${c[0]} ${c[1]}`;
 }
 return d;
}
function drawRoute(){
 const d=routePath();
 let svg=`<svg class="route-lines" viewBox="0 0 900 900" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--map-roadEdge)" stroke-opacity=".5" stroke-width="33" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="var(--map-road)" stroke-width="25" stroke-linecap="round" stroke-linejoin="round"/><path d="${routePath(state.pos)}" fill="none" stroke="#f6bf4e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
 return `<img class="map-art" src="${activeMap().background}" alt="">`+svg+currentSquares().map((s,i)=>{const p=mapRoutePoints()[i],portrait=s==='goal'&&isSafari()?`<img class="map-grass" src="${MAP_ASSETS.grass}" alt="特別な出会い">`:s==='goal'&&activeMap().boss?.wild?`<span class="boss-portrait"><img src="${pokemonPortrait(activeBossId())}" alt=""></span>`:s==='start'?`<img class="center-icon" src="${MAP_ASSETS.center}" alt="">`:s==='goal'&&activeMap().boss?.icon?`<span class="boss-portrait"><img src="${activeMap().boss.icon}" alt=""></span>`:s==='trainer'&&activeMap().trainerIcon?`<img class="trainer-portrait" src="${activeMap().trainerIcon}" alt="">`:s==='item'?`<img class="item-field-icon" src="assets/map/item-ball.png" alt="">`:s==='wild'?`<img class="map-grass" src="${MAP_ASSETS.grass}" alt="">`:`<svg class="node-symbol" aria-hidden="true"><use href="assets/ui-icons.svg#${s==='wild'?'grass':s}"/></svg>`;return `<div class="tile node-${s} ${i===state.pos?'current':''} ${i<state.pos?'visited':''}" style="left:${p[0]}%;top:${p[1]}%" aria-label="${i+1}マス目 ${tileLabel(s)}${i===state.pos?' 現在地':''}"><span class="node-number">${String(i+1).padStart(2,'0')}</span>${portrait}<small>${tileLabel(s)}</small>${i===state.pos?`<span class="player-marker">ここ！</span><img class="player-pawn" src="${MAP_ASSETS.player}" alt="主人公のコマ">`:''}</div>`}).join('');
}
function render(){ applyMapTheme();updateSafariMapLegend();$('#roll .roll-copy>span').textContent=rainbowExitReady()?'旅に戻る':state.pendingMapId?'次のマップへ':'サイコロを振る';if(!$('#roll').classList.contains('dice-holding'))$('#roll small').textContent=rainbowExitReady()?'タップして 元の旅へ！':state.pendingMapId?'タップして つぎの ぼうけんへ！':'おして はなして ころがそう！'; $('#lap').textContent=`${state.tour}周目 · ${state.pos+1}/15`;$('#route').innerHTML=drawRoute();$('#inventory').innerHTML=BALLS.map(b=>`<span aria-label="${b.name} ${state[b.key]}個"><img class="ball-icon" src="${b.image}" alt=""> ${state[b.key]}</span>`).join('');$('#miniParty').innerHTML=Array.from({length:PARTY_SIZE},(_,i)=>state.party[i]?`<img src="${img(state.party[i])}" alt="${mons[state.party[i]-1].label}">`:`<span class="party-empty" aria-label="空き枠">＋</span>`).join('');renderDex();$('#roll').disabled=busy;renderJourney();save()}
function renderDex(){
 $('#party-type-warning').hidden=partyTypes(state.party).length<5;
 $('#count').textContent=`${state.party.length} / ${PARTY_SIZE}匹`;$('.party-hint').textContent=`${partyTypes(state.party).length}属性 · チャージ ×${typeDiversityBonus(partyTypes(state.party).length).toFixed(2)}`;
 $('#cards').innerHTML=Array.from({length:PARTY_SIZE},(_,slot)=>{const id=state.party[slot],mon=id?mons[id-1]:null;return `<article class="party-slot ${mon?'':'is-empty'}"><button class="party-member" data-id="${id||''}" ${mon?'':'disabled'}>${mon?`<img src="${img(id)}" alt=""><span><small>No.${pokemonNumber(id)}</small><strong>${mon.label}</strong><span class="party-types" aria-label="属性">${pokemonTypes(mon).length?pokemonTypes(mon).map(t=>`<span class="party-type" style="--type-color:${POKEMON_TYPE_COLORS[t]}">${POKEMON_TYPE_NAMES[t]}</span>`).join(''):'<span class="party-type type-unknown">未登録</span>'}</span></span>`:'<span class="party-vacant">＋ あき</span>'}</button><button class="party-replace" data-party-slot="${slot}">${mon?'入れ替える':'えらぶ'}</button></article>`}).join('');
}
function togglePokemonParty(id){
 if(busy)return 'いまは へんせいできません';
 if(!state.owned.includes(id))return 'まだ つかまえていません';
 if(state.party.includes(id)){
  if(state.party.length===1)return 'パーティーには 1匹以上 必要です';
  const next=state.party.filter(value=>value!==id),error=partyTypeError(next);if(error)return error;state.party=next;
 }else{
  if(state.party.length>=PARTY_SIZE)return 'パーティーは 6匹までです';
  const next=[...state.party,id],error=partyTypeError(next);if(error)return error;state.party=next;
 }
 render();return '';
}
$('#cards').onclick=e=>{const swap=e.target.closest('[data-party-slot]');if(swap&&!busy){window.PokekoroDex?.openPicker(Number(swap.dataset.partySlot));return}const card=e.target.closest('[data-id]');if(card&&card.dataset.id&&!busy)window.PokekoroDex?.open(Number(card.dataset.id))};
function showTab(name){
 if(!['map','party','journey'].includes(name))return;
 document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===name));
 for(const id of ['map','party','journey'])$('#'+id).hidden=id!==name;
 document.body.dataset.gameView=name;
}
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{if(capturePending)return;showTab(button.dataset.tab)});
$('#help').onclick=()=>$('#guide').showModal();
async function rollDice(){if(busy)return;if(rainbowExitReady()){leaveRainbow();return}if(state.pendingMapId){advanceMap();return}if(state.pos===14){resetDicePresentation();busy=true;render();openBattle(true,true);return}busy=true;render();const epoch=diceEpoch,mapId=state.mapId;let n=1+Math.floor(Math.random()*6);if(!await mapDiceDrop(n)||epoch!==diceEpoch||mapId!==state.mapId)return;if(state.pos===14){state.pos=0;state.lap++;render()}let target=Math.min(14,state.pos+n);$('#message').textContent=`${n}が出た！ マスを進んでいます…`;while(state.pos<target){await new Promise(resolve=>setTimeout(resolve,300));if(epoch!==diceEpoch||mapId!==state.mapId)return;state.pos++;sfx('step');render()}let s=currentSquares()[state.pos];$('#message').textContent=`${n}が出た！ ${tileLabel(s)}に到着。`;tone(520,.06);await new Promise(resolve=>setTimeout(resolve,450));if(epoch!==diceEpoch||mapId!==state.mapId)return;if(s==='item'){const drop=itemBallDrop();state[drop.key]+=drop.count;busy=false;$('#message').textContent=drop.name+'を'+drop.count+'個見つけた！';render()}else openBattle(s==='trainer'||s==='goal',s==='goal')}
function pickTrainerAppearance(config,rng=Math.random){const variants=config?.imageVariants;return variants?.length?{...config,...variants[Math.floor(rng()*variants.length)]}:config}
function openBattle(trainer,boss){if(partyTypeError(state.party)){showTab('party');$('.party-hint').textContent='3属性以上の パーティーを くもう！';return}window.PokekoroSfx?.stopAll();document.dispatchEvent(new CustomEvent('battle:audiofocus',{detail:{active:false}}));resetDicePresentation();activePuzzlePointer=null;clearPuzzleSelection();battleEpoch++;preparing=false;capturePending=false;lastSecond=-1;$('#battle').classList.remove('hurry','resolving','attack-release','gathering-power','power-full');$('#energy-layer')?.remove();$('#leave').disabled=false;$('#battle-fx').innerHTML='';$('#callout').textContent='';$('#ready-overlay').hidden=false;$('#ready-overlay').innerHTML='<strong>3つ つないで<br>パワーをためよう！</strong><span>30秒後に まとめてアタック！</span>';$('#timebar').style.width='100%';$('#combobar').style.width='0%';$('#puzzle-tip').textContent='同じマークを3つ以上なぞろう！';if(isSafari()||boss&&activeMap().boss?.wild)trainer=false;const id=isSafari()&&boss?SAFARI_RULES.finalIds[Math.floor(Math.random()*SAFARI_RULES.finalIds.length)]:boss?activeBossId():pickEncounterId();let m=mons[id-1];if(isSafari()&&boss)m={...m,label:{115:'ガルーラ',113:'ラッキー',128:'ケンタロス'}[id]};markPokemonSeen(id);battle={m,trainer,boss,safari:isSafari(),trainerAppearance:(trainer||boss)&&activeMap().boss?.imageVariants?pickTrainerAppearance(activeMap().boss):null,puzzleTypes:partyTypes(state.party),damage:0,shownDamage:0,phase:'ready',hp:boss?620:trainer?460:300+(m.id-1)%3*65,total:boss?620:trainer?460:300+(m.id-1)%3*65};combo=maxCombo=0;lastClear=0;elapsed=0;running=false;path=[];grid=Array.from({length:36},()=>randomPartyType());$('#kind').textContent=boss&&activeMap().boss?.wild?'⚑ '+activeMap().name+'・最深部':boss?'⚑ '+(activeMap().boss?.role||'ボストレーナー')+'：'+(activeMap().boss?.name||'ボス'):trainer?'⚔ トレーナーバトル':'🌿 野生のポケモン';$('#weakness-tip').textContent=m.type===null||m.type>2?'パーティーの属性を つなごう！':`${icons[[1,2,0][m.type]]} ${types[[1,2,0][m.type]]}で こうかばつぐん！`;$('#weakness-tip').textContent+=` · ${battle.puzzleTypes.length}属性 ×${typeDiversityBonus(battle.puzzleTypes.length).toFixed(2)}`;$('#enemyname').textContent=m.label;$('#enemyimg').src=img(m.id);$('#enemyimg').alt=m.label;$('#clock').textContent='30.0';$('#combo').textContent='属性を3個以上つなごう';$('#chain').textContent='0 CHAIN';$('#start').hidden=false;updateHP();updateCharge();draw();$('#encounter-label').textContent=boss?'ボスが あらわれた！':trainer?'トレーナーと しょうぶ！':'野生のポケモンが あらわれた！';$('#encounter-name').textContent=m.label;$('#encounter-img').src=pokemonPortrait(m.id);$('#encounter-silhouette').src=pokemonPortrait(m.id);$('#encounter-img').alt=m.label;configureSafariUI();document.dispatchEvent(new CustomEvent('battle:prepare'));showEncounter(trainer||boss&&!activeMap().boss?.wild);tone(520,.15)}
function updateHP(){$('#hpbar').style.width=`${100*battle.hp/battle.total}%`;$('#hptext').textContent=`HP ${Math.ceil(battle.hp)} / ${battle.total} · ${battle.m.type===null?'タイプ：—':types[battle.m.type]+'タイプ'}`}
const canvas=$('#board'),ctx=canvas.getContext('2d');function draw(){ctx.clearRect(0,0,420,420);for(let i=0;i<36;i++){let x=(i%6)*70+35,y=Math.floor(i/6)*70+35;drawTypeGem(ctx,x,y,colors[grid[i]],icons[grid[i]],path.includes(i),grid[i]);if(path.includes(i)){ctx.font='bold 12px sans-serif';ctx.fillStyle='#4d2b73';ctx.fillText(String(path.indexOf(i)+1),x+18,y-20)}}if(path.length){ctx.strokeStyle='#fff5b5';ctx.lineWidth=6;ctx.lineJoin='round';ctx.beginPath();path.forEach((i,j)=>{let x=i%6*70+35,y=Math.floor(i/6)*70+35;j?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}}
function cell(e){let r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*420/r.width,y=(e.clientY-r.top)*420/r.height;if(x<0||y<0||x>=420||y>=420)return -1;return Math.floor(y/70)*6+Math.floor(x/70)}
canvas.onpointerdown=e=>{if(e.cancelable)e.preventDefault();clearPuzzleSelection();if(!running||activePuzzlePointer!==null)return;let i=cell(e);if(i<0)return;activePuzzlePointer=e.pointerId;drag=true;path=[i];tone(380,.035);try{canvas.setPointerCapture(e.pointerId)}catch{}draw()};canvas.onpointermove=e=>{if(e.pointerId!==activePuzzlePointer)return;if(e.cancelable)e.preventDefault();if(!drag||!running)return;let i=cell(e),last=path.at(-1);if(i<0||i===last)return;if(path.length>1&&i===path.at(-2)){path.pop();draw();return}if(!path.includes(i)&&grid[i]===grid[last]&&Math.abs(i%6-last%6)<=1&&Math.abs(Math.floor(i/6)-Math.floor(last/6))<=1){path.push(i);$('#chain').textContent=`${path.length} つなぎ！`;$('#puzzle-tip').textContent=path.length>=3?'はなして チャージ！':'あと'+(3-path.length)+'つ つなごう！';tone(380+path.length*55,.04);draw()}};
canvas.onpointerup=e=>{if(e.pointerId!==activePuzzlePointer)return;if(e.cancelable)e.preventDefault();activePuzzlePointer=null;if(!drag)return;drag=false;if(running&&performance.now()-startAt>=30000){path=[];resolveAttack();return}if(running&&path.length>=3){let now=performance.now();combo=lastClear&&now-lastClear<=2000?combo+1:1;maxCombo=Math.max(maxCombo,combo);lastClear=now;let t=grid[path[0]],power=partyTypePower(state.party,t);let weak=!battle.safari&&((t===0&&battle.m.type===2)||(t===2&&battle.m.type===1)||(t===1&&battle.m.type===0));let damage=puzzleCharge(power,path.length,combo,weak,battle.puzzleTypes.length);battle.damage+=damage;flyCharge(path.slice(),t,damage);attackFX(path.slice(),t,damage,weak,combo);$('#combo').textContent=`${combo} COMBO ×${(1+Math.min(combo-1,9)*.15).toFixed(2)} · +${damage}${battle.safari?'なかよし':'パワー'}${weak?' 効果抜群！':''}`;refillPuzzle(path)}if(path.length>0&&path.length<3)$('#puzzle-tip').textContent='3つ以上つなぐと パワーがたまるよ！';path=[];draw()};canvas.onpointercancel=e=>{if(e.pointerId!==activePuzzlePointer)return;resetPuzzlePointer()};canvas.onlostpointercapture=e=>{if(e.pointerId===activePuzzlePointer)resetPuzzlePointer()};
$('#start').onclick=async()=>{if(preparing||running)return;preparing=true;$('#start').hidden=true;const epoch=battleEpoch;for(const n of ['3','2','1','GO!']){if(epoch!==battleEpoch)return;$('#ready-overlay').innerHTML=`<strong class="countdown-number">${n}</strong>`;tone(n==='GO!'?880:440,.12);await new Promise(resolve=>setTimeout(resolve,n==='GO!'?250:550))}if(epoch!==battleEpoch)return;$('#ready-overlay').hidden=true;preparing=false;running=true;battle.phase='charging';startAt=performance.now();raf=requestAnimationFrame(tick)};
function tick(now){if(!running)return;elapsed=(now-startAt)/1000;let left=Math.max(0,30-elapsed);$('#clock').textContent=left.toFixed(1);$('#timebar').style.width=`${left/30*100}%`;$('#combobar').style.width=lastClear?`${Math.max(0,1-(now-lastClear)/2000)*100}%`:'0%';$('#battle').classList.toggle('hurry',left<=5);if(left<=5&&Math.ceil(left)!==lastSecond){lastSecond=Math.ceil(left);tone(650,.06)}if(elapsed>=30){resolveAttack();return}raf=requestAnimationFrame(tick)}

function renderJourney(){
 renderRainbowHub();
 const cleared=new Set(state.clearedMaps),gyms=MAP_ORDER.filter(id=>MAPS[id].badge),complete=cleared.has(MAP_ORDER.at(-1));
 $('#journey-summary').textContent=complete?`${state.tour}周目・ハナダの洞窟まで クリア済み`:`${state.tour}周目・いまは ${activeMap().name}・バッジ ${gyms.filter(id=>cleared.has(id)).length} / 8`;
 $('#journey-badges').innerHTML=gyms.map(id=>`<span class="journey-badge ${cleared.has(id)?'earned':''}" aria-label="${MAPS[id].badge} ${cleared.has(id)?'獲得済み':'未獲得'}"><img src="${MAPS[id].badgeImage}" alt="">${MAPS[id].badge}<small>${cleared.has(id)?'✓ 獲得済み':'未獲得'}</small></span>`).join('');
 $('#journey-list').innerHTML=MAP_ORDER.map((id,i)=>{const map=MAPS[id],current=id===state.mapId,done=cleared.has(id);return `<li class="${current?'journey-current':''} ${done?'journey-cleared':''}" ${current?'aria-current="step"':''}><span class="journey-step">${String(i+1).padStart(2,'0')}</span><div><strong>${map.name}</strong><small>${map.boss.role}：${map.boss.name}</small></div><span class="journey-status">${current?'いまここ':done?'✓ クリア':'これから'}</span></li>`}).join('');
}
function advanceMap(){
 const next=state.pendingMapId;if(!next||!Object.hasOwn(MAPS,next)||capturePending)return;
 resetDicePresentation();if(state.mapId===MAP_ORDER.at(-1)&&next===MAP_ORDER[0])state.tour++;state.pendingMapId=null;state.mapId=next;state.pos=0;state.lap=1;busy=false;battle=null;
 $('#result').close();render();$('#message').textContent=activeMap().name+'に とうちゃく！';sfx('arrive');
 const card=$('#map .mapcard');card.classList.remove('map-arriving');void card.offsetWidth;card.classList.add('map-arriving');
}
function result(html){$('#resultBody').innerHTML=html;$('#result').showModal();if(battle&&battle.hp===0){celebrate();tone(660,.1);setTimeout(()=>tone(880,.15),130)}}function done(){if(capturePending)return;if(rainbowExitReady()){leaveRainbow();return}if(state.pendingMapId){advanceMap();return}resetDicePresentation();busy=false;render();$('#result').close();$('#message').textContent='次の出会いを探しにいこう。';}
function rewardItemsHtml(items){
 return `<div class="reward-items" style="--reward-count:${items.length}" aria-label="獲得したアイテム">${items.map(item=>{const ball=item.id==='rainbow'?{id:'rainbow',name:'虹のチケット',image:RAINBOW_CONFIG.ticketImage}:BALLS.find(b=>b.id===item.id);return `<div class="reward-card" data-ball="${ball.id}">${['master','rainbow'].includes(ball.id)?'<span class="reward-rare">レア！</span>':''}<img src="${ball.image}" alt=""><span class="reward-name">${ball.name}</span><strong class="reward-count" aria-label="${item.count}個">× ${item.count}</strong></div>`}).join('')}</div>`;
}
function markBattleVictory(){if(!battle||battle.safari||battle.victory)return;battle.victory=true;document.dispatchEvent(new CustomEvent('battle:victory'))}
function endBattle(win){window.PokekoroSfx?.stopAll();document.dispatchEvent(new CustomEvent('battle:audiofocus',{detail:{active:false}}));
 if(battle?.safari){endSafari(win);return}
 if(!battle||battle.rewardResolved)return;if(battle.victory)win=true;if(win)markBattleVictory();battle.rewardResolved=true;
 battleEpoch++;preparing=false;running=false;drag=false;cancelAnimationFrame(raf);$('#battle').close();
 const cloudBoss=isRainbow()&&battle.boss;
 if(cloudBoss)state.rainbowVisit.exitPending=true;
 if(!win){state.balls++;render();result(`<h2>${cloudBoss?'虹の雲の ぼうけん終了':'もう一度、挑戦しよう。'}</h2><p>参加報酬を うけとった！</p>${rewardItemsHtml([{id:'normal',count:1}])}<button class="primary" id="done">${cloudBoss?'旅に戻る':'マップへ戻る'}</button>`);$('#done').onclick=done;return}
 const normalBoss=battle.boss&&!isRainbow();
 const earnedBadge=normalBoss&&!state.clearedMaps.includes(state.mapId)?activeMap().badge:null;
 if(normalBoss){if(!state.clearedMaps.includes(state.mapId))state.clearedMaps.push(state.mapId);state.pendingMapId=activeMap().nextMap||MAP_ORDER[0]}
 const masterDrop=battle.boss&&Math.random()<BALL_DROPS.bossMaster;if(masterDrop)state.master++;
 const ticket=normalBoss&&(window.PokekoroDebug?.forceRainbowTicket?.()||Math.random()<RAINBOW_CONFIG.ticketRate)?grantRainbowTicket():null;
 if(battle.trainer){
  state.super+=battle.boss?3:1;state.balls+=2;render();
  result(`<h2>${battle.boss?(activeMap().leagueFinal?'ワタルに勝利！':activeMap().name+'クリア！'):'トレーナーに勝利！'}</h2><p>アイテムを てにいれた！</p>${rewardItemsHtml([{id:'super',count:battle.boss?3:1},{id:'normal',count:2},...(masterDrop?[{id:'master',count:1}]:[]),...(ticket?[{id:'rainbow',count:1}]:[])])}${earnedBadge?`<div class="reward-badge"><img src="${activeMap().badgeImage}" alt="${earnedBadge}"><span><small>バッジを てにいれた！</small><strong>${earnedBadge}</strong></span></div>`:''}${ticket?'<button id="reward-rainbow" class="rainbow-action">虹の雲へ 行く</button>':''}<button id="done" class="primary">次のマップへ</button>`);
  if(earnedBadge)sfx('badge');else sfx('success');$('#done').onclick=done;if(ticket)$('#reward-rainbow').onclick=()=>enterRainbow(ticket.id);return;
 }
 render();const base=Math.min(.8,.4+Math.min(1,battle.damage/battle.total-1)*.15+maxCombo*.015);
 result(`<small>${cloudBoss?'虹の雲のボス クリア！':battle.boss?'最深部クリア！':'CATCH CHANCE'}</small><h2>${battle.m.label}を捕まえよう！</h2><img src="${img(battle.m.id)}" alt="${battle.m.label}"><p>ボールを選んで捕獲に挑戦。<br>ためたパワー・最大コンボで確率アップ！</p>${masterDrop?'<div class="capture-bonus"><img src="assets/master-ball.webp" alt="">マスターボール ×1 獲得！</div>':''}${ticket?`<div class="capture-bonus"><img src="${RAINBOW_CONFIG.ticketImage}" alt="">虹のチケット ×1 獲得！</div>`:''}<div class="ball-options">${BALLS.map(b=>`<button id="${b.id}" class="primary ball-choice" ${state[b.key]?'':'disabled'}><img src="${b.image}" alt=""><span>${b.name}<small>成功 ${Math.round(Math.min(b.cap,base+b.bonus)*100)}%・残り ${state[b.key]}個</small></span></button>`).join('')}</div><button id="skip">${cloudBoss?'捕まえず 旅に戻る':'見送る'}</button>`);
 BALLS.forEach(b=>{$('#'+b.id).onclick=()=>catchMon(b.id,Math.min(b.cap,base+b.bonus))});$('#skip').onclick=done;
}

async function playCaptureThrow(ball,mon){
 const body=$('#resultBody');body.innerHTML=`<small>つかまえる チャンス！</small><div class="capture-scene" data-phase="ready" aria-hidden="true"><div class="capture-ground"></div><img class="capture-target" src="${pokemonPortrait(mon.id)}" alt=""><div class="capture-flash"></div><div class="capture-ball"><img src="${ball.image}" alt=""></div></div><h2 id="capture-status" aria-live="polite">${ball.name}を なげた！</h2><p>ポケモンを つかまえよう！</p>`;
 const scene=$('.capture-scene'),wait=ms=>new Promise(resolve=>setTimeout(resolve,reduceMotion?Math.min(ms,120):ms));
 await Promise.all([...scene.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));
 scene.dataset.phase='throw';sfx('ballThrow');await wait(650);
 scene.dataset.phase='impact';$('#capture-status').textContent='あたった！';sfx('ballHit');await wait(450);
 scene.dataset.phase='settle';$('#capture-status').textContent='ボールの なかへ！';await wait(350);
 scene.dataset.phase='check';$('#capture-status').textContent='つかまるかな…？';body.querySelector('p').textContent='ドキドキ…';sfx('ballShake');await wait(350);sfx('ballShake');await wait(350);sfx('ballShake');await wait(400);
}
$('#result').addEventListener('cancel',e=>{if(capturePending||state.pendingMapId||rainbowExitReady())e.preventDefault()});
async function catchMon(ballId,chance){if(capturePending)return;const selected=BALLS.find(b=>b.id===ballId);if(!selected||state[selected.key]<1)return;state[selected.key]--;capturePending=true;save();let ok=Math.random()<chance;busy=true;await playCaptureThrow(selected,battle.m);let duplicate=state.owned.includes(battle.m.id);if(ok){if(duplicate)state.balls+=2;else state.owned.push(battle.m.id)}render();$('#resultBody').innerHTML=`<h2>${ok?'やった！ 捕獲成功！':'あっ！ 逃げられた…'}</h2><img src="${img(battle.m.id)}" alt="${battle.m.label}"><p>${ok?(duplicate?'すでに仲間のポケモンです。<br>モンスターボール2個に交換しました。':`${battle.m.label}のカードを獲得！<br>図鑑からパーティに編成できます。`):'また草むらで探してみよう。'}</p><button class="primary" id="done">${rainbowExitReady()?'旅に戻る':battle.safari&&battle.boss?'次のマップへ':'旅を続ける'}</button>`;$('#done').onclick=done;if(ok){celebrate();sfx('success')}else sfx('fail');capturePending=false}
$('#leave').onclick=()=>{if(confirm(battle?.safari?'なかよしチャレンジを やめますか？':'バトルを撤退しますか？')){if(battle?.safari){endBattle(false);return}if(isRainbow()&&battle?.boss){endBattle(false);return}battleEpoch++;window.PokekoroSfx?.stopAll();document.dispatchEvent(new CustomEvent('battle:audiofocus',{detail:{active:false}}));preparing=false;running=false;cancelAnimationFrame(raf);$('#battle').close();busy=false;render()}};$('#battle').addEventListener('cancel',e=>e.preventDefault());$('#result').addEventListener('cancel',e=>e.preventDefault());document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||preparing)){elapsed=(performance.now()-startAt)/1000;endBattle(false)}});render();

document.addEventListener('title:start',()=>{ $('#title-screen').hidden=true;$('#game-shell').hidden=false;document.body.classList.remove('at-title');window.scrollTo(0,0);$('#roll').focus({preventScroll:true})});

$('#back-title').onclick=()=>{if(busy)return;$('#title-options').close();resetDicePresentation();$('#game-shell').hidden=true;$('#title-screen').hidden=false;document.body.classList.add('at-title');window.PokekoroTitle?.reset();window.scrollTo(0,0);$('#enter-game').focus({preventScroll:true})};

let soundOn=true,lastSecond=-1;
const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function tone(frequency,duration){if(soundOn)window.PokekoroSfx?.tone(frequency,duration)}
function sfx(name,value){window.PokekoroSfx?.play(name,value)}
document.addEventListener('title:soundchange',e=>{soundOn=!!e.detail.enabled;if(soundOn&&e.detail.userGesture)tone(660,.1)});
function pulse(el,cls){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}
function attackFX(cells,type,damage,weak,count){const layer=$('#battle-fx');let html='';for(const cell of cells){const x=(cell%6+.5)/6*100,y=(Math.floor(cell/6)+.5)/6*100;for(let j=0;j<(reduceMotion?1:5);j++){const angle=j*1.2566;html+=`<i class="gem-shard" style="left:${x}%;top:${y}%;--dx:${Math.cos(angle)*(26+j*5)}px;--dy:${Math.sin(angle)*(26+j*5)}px;--turn:${70+j*65}deg;--spark:${colors[type]}"></i>`}html+=`<b class="pop-ring" style="left:${x}%;top:${y}%;--spark:${colors[type]}"></b>`}layer.innerHTML=html;const token=++fxToken;setTimeout(()=>{if(token===fxToken)layer.innerHTML=''},650);$('#callout').innerHTML=`<strong>${cells.length>=7?'すごい!!':cells.length>=5?'いいね！':'ナイス！'}</strong><span>${count} コンボ!</span>`;pulse($('#callout'),'callout-pop');$('#puzzle-tip').textContent=battle.safari?'つづけて消して なかよく なろう！':'つづけて消して パワーアップ！';sfx('gem',count);pulse($('#chain'),'chain-pop');$('#callout').dataset.level=Math.min(count,6);if((cells.length>=7||count>=3)&&!reduceMotion)pulse($('.puzzle-stage'),'big-hit');}
let fxToken=0;
function celebrate(){const box=$('#resultBody');box.querySelector('.confetti')?.remove();const layer=document.createElement('div');layer.className='confetti';layer.setAttribute('aria-hidden','true');layer.innerHTML=Array.from({length:reduceMotion?0:30},(_,i)=>`<i style="--x:${(i*37)%100}%;--delay:${i%6*.07}s;--rot:${i*43}deg;--c:${['#ffcf45','#af83f5','#6bd6cd','#ff8c99'][i%4]}"></i>`).join('');box.append(layer);}

document.querySelectorAll('[data-version]').forEach(el=>el.textContent=`Ver. ${GAME_VERSION}`);
$('#open-credits').onclick=e=>{e.preventDefault();$('#credits').showModal()};
$('#close-credits').onclick=()=>$('#credits').close();

// Match the Ray Edu Labo introduction used in Micra Rails.
(function studioIntro(){
 const splash=$('#boot-screen'),logo=$('#boot-logo');splash.hidden=false;
 let started=false,minimumStarted=false,minimumElapsed=false,assetsReady=!!window.PokekoroTitleAssetsReady;
 function revealWhenReady(){
  if(started||!minimumElapsed||!assetsReady)return;started=true;
  // Let decoded title layers reach the compositor before exposing the screen.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{splash.classList.add('is-leaving');setTimeout(()=>{splash.hidden=true;document.dispatchEvent(new CustomEvent('studio:ready'))},reduceMotion?0:2100)}));
 }
 function holdMinimum(){if(minimumStarted)return;minimumStarted=true;setTimeout(()=>{minimumElapsed=true;revealWhenReady()},reduceMotion?800:2800)}
 document.addEventListener('title:assetsready',()=>{assetsReady=true;revealWhenReady()},{once:true});
 if(logo.complete)holdMinimum();else{logo.addEventListener('load',holdMinimum,{once:true});logo.addEventListener('error',holdMinimum,{once:true});setTimeout(holdMinimum,4000)}
})();

async function showBossEncounter(){
 const boss=battle.trainerAppearance||activeMap().boss,dialog=$('#encounter'),epoch=battleEpoch,go=$('#encounter-go');
 const trainer=$('#encounter-trainer'),ball=$('#encounter-send-ball');trainer.src=boss.image;trainer.alt=boss.name;ball.src=boss.ball;
 dialog.classList.add('boss-encounter');dialog.dataset.phase='boss-music';go.disabled=true;$('#encounter-label').textContent='強いトレーナーの けはい…！';$('#encounter-name').textContent='';$('#encounter-img').alt='';dialog.showModal();
 await Promise.all([trainer,$('#encounter-img'),ball].map(image=>image.decode().catch(()=>{})).concat([window.PokekoroMapAudio?.prepareScene('trainer')]));
 if(epoch!==battleEpoch||!dialog.open)return;
 await new Promise(resolve=>setTimeout(resolve,ENCOUNTER_TIMING.bossMusicLeadMs));
 if(epoch!==battleEpoch||!dialog.open)return;
 dialog.dataset.phase='boss-trainer';$('#encounter-label').textContent=(boss.role||'ボストレーナー')+'が あらわれた！';$('#encounter-name').textContent=boss.name;
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,reduceMotion?120:ms));
 await wait(activeMap().badge?ENCOUNTER_TIMING.gymTrainerMs:ENCOUNTER_TIMING.trainerMs);if(epoch!==battleEpoch||!dialog.open)return;
 $('#encounter-speech').textContent='「'+(boss.quote||ENCOUNTER_DIALOGUE[boss.name]||'きみの ちからを みせてもらおう！')+'」';dialog.dataset.phase='boss-line';
 await wait(ENCOUNTER_TIMING.lineMs);if(epoch!==battleEpoch||!dialog.open)return;
 dialog.dataset.phase='boss-send';$('#encounter-label').textContent=boss.name+'が ボールを なげた！';$('#encounter-name').textContent='いけ！ '+battle.m.label+'！';tone(520,.12);
 await Promise.all([wait(activeMap().badge?ENCOUNTER_TIMING.gymSendMs:ENCOUNTER_TIMING.sendMs),window.PokekoroMapAudio?.prepareScene('trainerBattle')]);if(epoch!==battleEpoch||!dialog.open)return;
 dialog.dataset.phase='revealed';$('#encounter-label').textContent=boss.name+'の ポケモン！';$('#encounter-name').textContent=battle.m.label;$('#encounter-img').alt=battle.m.label;go.disabled=false;tone(740,.15);
}
async function showEncounter(immediate){
 const dialog=$('#encounter'),image=$('#encounter-img'),name=$('#encounter-name'),go=$('#encounter-go'),epoch=battleEpoch;
 dialog.classList.remove('boss-encounter');dialog.dataset.numberOnly=String(battle.m.placeholder);if((battle.boss||battle.trainer&&battle.trainerAppearance)&&activeMap().boss&&!activeMap().boss.wild){showBossEncounter();return}
 dialog.dataset.phase=immediate||reduceMotion?'revealed':'grass';
 go.disabled=dialog.dataset.phase!=='revealed';
 name.textContent=go.disabled?'だれかな？':battle.m.label;
 image.alt=go.disabled?'':battle.m.label;
 if(go.disabled)$('#encounter-label').textContent='くさむらが ゆれている…';
 dialog.showModal();
 if(battle.trainer&&immediate){go.disabled=true;await window.PokekoroMapAudio?.prepareScene('trainerBattle');if(epoch===battleEpoch&&dialog.open)go.disabled=false;return}
 if(!go.disabled)return;
 try{await image.decode()}catch{}
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 await wait(600);if(epoch!==battleEpoch||!dialog.open)return;
 dialog.dataset.phase='silhouette';$('#encounter-label').textContent='ポケモンの けはい！';tone(440,.08);
 await Promise.all([wait(activeMap().badge?ENCOUNTER_TIMING.gymSendMs:ENCOUNTER_TIMING.sendMs),window.PokekoroMapAudio?.prepareScene('trainerBattle')]);if(epoch!==battleEpoch||!dialog.open)return;
 dialog.dataset.phase='revealed';$('#encounter-label').textContent='野生のポケモンが あらわれた！';name.textContent=battle.m.label;image.alt=battle.m.label;go.disabled=false;tone(660,.12);
}
$('#encounter-go').onclick=()=>{if($('#encounter-go').disabled)return;$('#encounter').close();$('#battle').showModal();document.dispatchEvent(new CustomEvent('battle:enter'));fitBattle()};
$('#encounter').addEventListener('cancel',e=>e.preventDefault());
function fitBattle(){const view=window.visualViewport;const height=view?view.height:window.innerHeight;const width=view?view.width:window.innerWidth;const size=Math.max(120,Math.min(420,width-28,height*.39));$('#battle').style.setProperty('--puzzle-size',`${size}px`)}
window.addEventListener('resize',fitBattle);if(window.visualViewport)window.visualViewport.addEventListener('resize',fitBattle);

function fitViewport(){document.documentElement.style.setProperty('--app-height',`${Math.round(window.visualViewport?window.visualViewport.height:window.innerHeight)}px`);fitBattle()}
window.addEventListener('resize',fitViewport);if(window.visualViewport)window.visualViewport.addEventListener('resize',fitViewport);fitViewport();

function updateCharge(value=battle.damage){const p=value/battle.total;$('#charge-value').textContent=value.toLocaleString();$('#chargebar').style.width=`${Math.min(100,p*100)}%`;$('.attack-charge').classList.toggle('charged',p>=1);$('#charge-hint').textContent=battle.safari?(p>=1?'なかよし目標 達成！ もっとためて 捕獲率アップ！':`あと ${Math.max(0,battle.total-value)} で なかよし目標！`):p>=1?'撃破ライン突破！ もっとためて捕獲率アップ！':`あと ${Math.max(0,battle.total-value)} パワーで撃破ライン！`;}
async function resolveAttack(){
 if(!battle||battle.phase==='resolving'||battle.phase==='finished')return;
 if(battle.safari){await resolveSafari();return}
 running=false;activePuzzlePointer=null;drag=false;preparing=false;path=[];elapsed=30;cancelAnimationFrame(raf);battle.phase='resolving';const epoch=battleEpoch;
 $('#clock').textContent='0.0';$('#timebar').style.width='0%';$('#combobar').style.width='0%';$('#battle').classList.remove('hurry');$('#battle').classList.add('resolving');$('#ready-overlay').hidden=false;$('#ready-overlay').innerHTML='<strong>タイムアップ！</strong><span>ためたパワーで 一斉攻撃！</span>';$('#puzzle-tip').textContent='いくぞ！ みんなでアタック！';tone(440,.15);
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,reduceMotion?Math.min(250,ms):ms));
 await wait(650);if(epoch!==battleEpoch)return;updateCharge();
 $('#battle').classList.add('gathering-power');$('#ready-overlay').innerHTML='<strong>ぐぐぐ…！</strong><span>みんなの力を ひとつに！</span>';const orb=makeEnergyOrb();document.dispatchEvent(new CustomEvent('battle:audiofocus',{detail:{active:true}}));sfx('gather',reduceMotion ? .5 : 2);
 await wait(1100);if(epoch!==battleEpoch)return;$('#battle').classList.add('power-full');$('#ready-overlay').innerHTML='<strong>パワー ぜんかい！！</strong><span>いくぞーーっ！！</span>';
 await wait(900);if(epoch!==battleEpoch)return;$('#battle').classList.remove('gathering-power','power-full');orb.classList.add('energy-launch');sfx('release');
 $('#ready-overlay').innerHTML='<strong>はっしゃ！！</strong><span>ポケモンに めいちゅう！</span>';
 await wait(450);if(epoch!==battleEpoch)return;orb.remove();
 $('#ready-overlay').innerHTML=`<strong>いっけー！！</strong><span>${battle.damage.toLocaleString()} パワー解放！</span>`;$('#battle').classList.add('attack-release');pulse($('.enemy'),'enemy-hit');sfx('hit');document.dispatchEvent(new CustomEvent('battle:audiofocus',{detail:{active:false}}));
 const d=document.createElement('b');d.className='damage-number final-damage';d.innerHTML=`${battle.damage.toLocaleString()}<small>まとめて ダメージ！</small>`;$('.enemy').append(d);
 const remaining=Math.max(0,battle.total-battle.damage);battle.hp=remaining;updateHP();$('#chargebar').style.width='0%';if(remaining===0)markBattleVictory();
 await wait(1200);if(epoch!==battleEpoch)return;d.remove();$('#ready-overlay').innerHTML=`<strong>${remaining===0?'やった！ 勝利！':'あと一歩…！'}</strong><span>${remaining===0?'みんなのパワーが とどいた！':'次はもっと パワーをためよう！'}</span>`;if(remaining===0)tone(1040,.2)
 await wait(800);if(epoch!==battleEpoch)return;battle.phase='finished';endBattle(remaining===0);
}

// Pointer capture keeps release reliable even when a finger leaves the button.
function diceLayer(){
 const layer=document.createElement('div');layer.className='map-dice-event';layer.setAttribute('aria-hidden','true');layer.innerHTML=`<div class="dice-ground"></div><div class="dice-drop"><div class="map-die" data-value="5"><div class="dice-cube">${[1,6,3,4,2,5].map((n,i)=>`<div class="dice-face cube-side side-${i}" data-value="${n}">${'<i></i>'.repeat(9)}</div>`).join('')}</div></div></div><strong class="dice-announcement"></strong>`;$('.island-board').append(layer);return layer;
}
function resetDicePresentation(){
 window.PokekoroSfx?.stopRoll();
 diceEpoch++;
 const pointer=diceHold?.pointer;diceHold=null;
 for(const layer of document.querySelectorAll('.map-dice-event')){
  for(const element of [layer,...layer.querySelectorAll('*')])element.getAnimations?.().forEach(animation=>animation.cancel());
  layer.remove();
 }
 const button=$('#roll');button.classList.remove('dice-holding');
 if(pointer!==undefined&&button.hasPointerCapture?.(pointer)){try{button.releasePointerCapture(pointer)}catch{}}
 $('#roll small').textContent=rainbowExitReady()?'タップして 元の旅へ！':state.pendingMapId?'タップして つぎの ぼうけんへ！':'おして はなして ころがそう！';
}
function cancelDiceHold(){
 if(!diceHold)return;resetDicePresentation();busy=false;
}
const rollButton=$('#roll');
rollButton.onpointerdown=e=>{
 if(busy||e.button!==0||!e.isPrimary)return;e.preventDefault();if(rainbowExitReady()||state.pendingMapId||state.pos===14){rollDice();return}
 diceHold={pointer:e.pointerId};busy=true;rollButton.setPointerCapture(e.pointerId);
 window.PokekoroSfx?.startRoll();diceLayer().classList.add('dice-held');rollButton.classList.add('dice-holding');$('#roll small').textContent='はなして ストップ！';
};
rollButton.onpointerup=e=>{
 if(!diceHold||diceHold.pointer!==e.pointerId)return;e.preventDefault();diceHold=null;
 rollButton.classList.remove('dice-holding');$('#roll small').textContent='おして はなして ころがそう！';busy=false;rollDice();
};
rollButton.onpointercancel=cancelDiceHold;
rollButton.onlostpointercapture=cancelDiceHold;
rollButton.onclick=e=>{if(e.detail===0&&!diceHold)rollDice()};
rollButton.oncontextmenu=e=>e.preventDefault();
window.addEventListener('blur',cancelDiceHold);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelDiceHold()});
async function mapDiceDrop(value){
 sfx('throw');window.PokekoroSfx?.startRoll('throw');
 const epoch=diceEpoch,mapId=state.mapId;
 const layer=$('.map-dice-event')||diceLayer(),cube=layer.querySelector('.dice-cube');
 // Continue from the exact held rotation rather than restarting a new spin.
 const spin=cube.getAnimations()[0],phase=spin?((Number(spin.currentTime)||0)%700)/700:0;
 const x=-18+720*phase,y=-24+720*phase;
 const face={1:[0,0],2:[-90,0],3:[0,-90],4:[0,90],5:[90,0],6:[0,180]}[value];
 const endX=Math.ceil((x-face[0])/360)*360+face[0]+720;
 const endY=Math.ceil((y-face[1])/360)*360+face[1]+720;
 cube.style.animation='none';cube.style.transition='none';
 cube.style.transform=`rotateX(${x}deg) rotateY(${y}deg)`;
 layer.classList.remove('dice-held');layer.classList.add('dice-thrown');
 const duration=reduceMotion?120:1200;
 const rotation=cube.animate([{transform:`rotateX(${x}deg) rotateY(${y}deg)`},{transform:`rotateX(${endX}deg) rotateY(${endY}deg)`}],{duration,easing:'cubic-bezier(.12,.45,.25,1)',fill:'forwards'});
 try{
 await rotation.finished;
 if(epoch!==diceEpoch||mapId!==state.mapId)return false;
 cube.style.transform=`rotateX(${endX}deg) rotateY(${endY}deg)`;rotation.cancel();
 $('#dice').dataset.value=value;$('#dice').setAttribute('aria-label',`サイコロ ${value}`);layer.querySelector('.map-die').dataset.value=value;
 layer.querySelector('.dice-announcement').textContent=`${value} マス すすむ！`;layer.classList.add('dice-landed');window.PokekoroSfx?.stopRoll();sfx('land');
 await new Promise(resolve=>setTimeout(resolve,reduceMotion?250:650));if(epoch!==diceEpoch||mapId!==state.mapId)return false;sfx('diceResult');return true;
 }catch{if(epoch===diceEpoch){busy=false;render()}return false}
 finally{window.PokekoroSfx?.stopRoll();rotation.cancel();layer.remove()}
}
function energyLayer(){let layer=$('#energy-layer');if(!layer){layer=document.createElement('div');layer.id='energy-layer';layer.setAttribute('aria-hidden','true');$('#battle').append(layer)}return layer}
function flyCharge(cells,type,amount){
 const epoch=battleEpoch,layer=energyLayer(),dialog=$('#battle').getBoundingClientRect(),board=canvas.getBoundingClientRect(),gauge=$('.attack-charge-track').getBoundingClientRect();const tx=gauge.left-dialog.left+gauge.width/2,ty=gauge.top-dialog.top+gauge.height/2;
 for(const [j,cell] of cells.entries()){const x=board.left-dialog.left+(cell%6+.5)*board.width/6,y=board.top-dialog.top+(Math.floor(cell/6)+.5)*board.height/6,light=document.createElement('i');light.className='charge-light';light.style.cssText=`left:${x}px;top:${y}px;--dx:${tx-x}px;--dy:${ty-y}px;--spark:${colors[type]};animation-delay:${reduceMotion?0:110+j*12}ms`;layer.append(light);setTimeout(()=>light.remove(),910+j*12)}
 setTimeout(()=>{if(epoch!==battleEpoch||battle.phase!=='charging')return;battle.shownDamage+=amount;updateCharge(battle.shownDamage);pulse($('.attack-charge'),'charge-pop');sfx('charge')},reduceMotion?100:760+cells.length*12);
}
function makeEnergyOrb(){const layer=energyLayer(),dialog=$('#battle').getBoundingClientRect(),g=$('.attack-charge').getBoundingClientRect(),enemy=$('.enemy').getBoundingClientRect();const orb=document.createElement('div');orb.className='energy-orb';orb.style.cssText=`left:${g.left-dialog.left+g.width/2}px;top:${g.top-dialog.top+g.height/2}px;--target-y:${enemy.top+enemy.height/2-(g.top+g.height/2)}px`;layer.append(orb);return orb}

// iOS Safari: keep long presses and drag gestures inside the puzzle interaction.
function clearPuzzleSelection(){const selection=window.getSelection?.();if(selection&&selection.rangeCount)selection.removeAllRanges()}
function resetPuzzlePointer(){activePuzzlePointer=null;drag=false;path=[];draw()}
const puzzleStage=$('.puzzle-stage');
for(const event of ['selectstart','contextmenu','dragstart'])puzzleStage.addEventListener(event,e=>e.preventDefault());
for(const event of ['touchstart','touchmove'])puzzleStage.addEventListener(event,e=>{if(e.cancelable)e.preventDefault()},{passive:false});
