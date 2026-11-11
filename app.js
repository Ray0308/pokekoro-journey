'use strict';
const $=s=>document.querySelector(s), names=['フシギダネ','フシギソウ','フシギバナ','ヒトカゲ','リザード','リザードン','ゼニガメ','カメール','カメックス'],types=['くさ','ほのお','みず'],icons=['🌿','🔥','💧'],colors=['#79b879','#f6a16c','#7ebcda'];
const PARTY_SIZE=6;
const MAP_ASSETS=Object.freeze({player:'assets/map/player.webp',island:'assets/map/island.webp'});
const mons=names.map((name,i)=>({id:i+1,name,type:Math.floor(i/3),power:[11,14,17][i%3]}));
let state={owned:[1,4,7],party:[1,4,7],pos:0,lap:1,balls:8,super:2};try{let s=JSON.parse(localStorage.getItem('pokekoro-v1'));if(s&&Array.isArray(s.owned)&&Array.isArray(s.party)&&s.party.length&&s.party.length<=PARTY_SIZE&&s.party.every(id=>s.owned.includes(id)&&mons[id-1])&&Number.isInteger(s.pos)&&s.pos>=0&&s.pos<15&&Number.isFinite(s.balls)&&Number.isFinite(s.super)&&s.balls>=0&&s.super>=0)state=s}catch{}
let activePuzzlePointer=null;
let preparing=false,battleEpoch=0,capturePending=false;
let busy=false,battle=null,raf=0,grid=[],path=[],drag=false,lastClear=0,combo=0,maxCombo=0,startAt=0,running=false,elapsed=0;
const squares=['start','wild','item','wild','trainer','wild','item','trainer','wild','wild','item','trainer','wild','wild','goal'];
const label={start:'出発',wild:'草むら',item:'道具',trainer:'トレーナー',goal:'ゴール'},symbol={start:'🏕️',wild:'🌿',item:'🎁',trainer:'⚔️',goal:'⚑'};
function save(){localStorage.setItem('pokekoro-v1',JSON.stringify(state))}function img(id){return `assets/${id}.jpg`}
const routePoints=[[17,77],[34,84],[54,84],[74,77],[84,61],[84,44],[75,28],[57,21],[37,22],[20,31],[15,49],[31,60],[50,65],[66,53],[50,41]];
function drawRoute(){
 const d=routePoints.map((p,i)=>`${i?'L':'M'} ${p[0]*9} ${p[1]*9}`).join(' ');
 let svg=`<svg class="route-lines" viewBox="0 0 900 900" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="#416d3a" stroke-opacity=".5" stroke-width="38" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#f7e1a8" stroke-width="27" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#c6aa71" stroke-width="2" stroke-dasharray="3 10"/><path d="${routePoints.slice(0,state.pos+1).map((p,i)=>`${i?'L':'M'} ${p[0]*9} ${p[1]*9}`).join(' ')}" fill="none" stroke="#f6bf4e" stroke-width="12" stroke-linejoin="round"/></svg>`;
 return `<img class="map-art" src="${MAP_ASSETS.island}" alt="">`+svg+squares.map((s,i)=>{const p=routePoints[i],portrait=s==='wild'?`<span class="node-portrait"><img src="${img([1,4,7,2,5,8,3,6,9][i%9])}" alt=""></span>`:`<svg class="node-symbol" aria-hidden="true"><use href="assets/ui-icons.svg#${s==='wild'?'grass':s}"/></svg>`;return `<div class="tile node-${s} ${i===state.pos?'current':''} ${i<state.pos?'visited':''}" style="left:${p[0]}%;top:${p[1]}%" aria-label="${i+1}マス目 ${label[s]}${i===state.pos?' 現在地':''}"><span class="node-number">${String(i+1).padStart(2,'0')}</span>${portrait}<small>${label[s]}</small>${i===state.pos?`<span class="player-marker">ここ！</span><img class="player-pawn" src="${MAP_ASSETS.player}" alt="主人公のコマ">`:''}</div>`}).join('');
}
function render(){ $('#lap').textContent=`${state.lap} 周目 · ${state.pos+1}/15`;$('#route').innerHTML=drawRoute();$('#inventory').innerHTML=`<span><img class="ball-icon" src="assets/poke-ball.jpg" alt="モンスターボール"> ${state.balls} 個</span><span><img class="ball-icon" src="assets/great-ball.jpg" alt="スーパーボール"> ${state.super} 個</span>`;$('#miniParty').innerHTML=Array.from({length:PARTY_SIZE},(_,i)=>state.party[i]?`<img src="${img(state.party[i])}" alt="${mons[state.party[i]-1].name}">`:`<span class="party-empty" aria-label="空き枠">＋</span>`).join('');$('#count').textContent=`${state.owned.length} / 9`;$('#cards').innerHTML=mons.map(m=>{let own=state.owned.includes(m.id),sel=state.party.includes(m.id);return `<button class="card ${!own?'locked':''} ${sel?'selected':''}" data-id="${m.id}" ${!own?'disabled':''}><img src="${img(m.id)}" alt="${own?m.name:'未発見'}"><small>No. ${String(m.id).padStart(3,'0')} · ${icons[m.type]} ${types[m.type]}</small><strong>${own?m.name:'？？？'}</strong><span class="badge">${own?`攻撃 ${m.power} · ${sel?'✓ 編成中':'編成する'}`:'草原で見つけよう'}</span></button>`}).join('');$('#roll').disabled=busy;save()}
$('#cards').onclick=e=>{let b=e.target.closest('[data-id]');if(!b||busy)return;let id=+b.dataset.id;if(state.party.includes(id)){if(state.party.length===1){alert('パーティには1匹以上必要です。');return}state.party=state.party.filter(x=>x!==id)}else{if(state.party.length>=PARTY_SIZE){alert('最大6匹です。仲間を外してから選んでください。');return}state.party.push(id)}render()};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));$('#map').hidden=b.dataset.tab!=='map';$('#party').hidden=b.dataset.tab!=='party'});$('#help').onclick=()=>$('#guide').showModal();
async function rollDice(){if(busy)return;busy=true;render();let n=1+Math.floor(Math.random()*6);await mapDiceDrop(n);if(state.pos===14){state.pos=0;state.lap++;render()}let target=Math.min(14,state.pos+n);$('#message').textContent=`${n}が出た！ マスを進んでいます…`;while(state.pos<target){await new Promise(resolve=>setTimeout(resolve,300));state.pos++;render()}let s=squares[state.pos];$('#message').textContent=`${n}が出た！ ${label[s]}に到着。`;tone(520,.06);await new Promise(resolve=>setTimeout(resolve,450));if(s==='item'){state.balls+=3;busy=false;$('#message').textContent='モンスターボールを3個見つけた！';render()}else openBattle(s==='trainer'||s==='goal',s==='goal')}
function openBattle(trainer,boss){activePuzzlePointer=null;clearPuzzleSelection();battleEpoch++;preparing=false;capturePending=false;lastSecond=-1;$('#battle').classList.remove('hurry','resolving','attack-release','gathering-power');$('#energy-layer')?.remove();$('#leave').disabled=false;$('#battle-fx').innerHTML='';$('#callout').textContent='';$('#ready-overlay').hidden=false;$('#ready-overlay').innerHTML='<strong>3つ つないで<br>パワーをためよう！</strong><span>30秒後に まとめてアタック！</span>';$('#timebar').style.width='100%';$('#combobar').style.width='0%';$('#puzzle-tip').textContent='同じマークを3つ以上なぞろう！';let m=mons[boss?8:Math.floor(Math.random()*9)];battle={m,trainer,boss,damage:0,shownDamage:0,phase:'ready',hp:boss?620:trainer?460:300+(m.id-1)%3*65,total:boss?620:trainer?460:300+(m.id-1)%3*65};combo=maxCombo=0;lastClear=0;elapsed=0;running=false;path=[];grid=Array.from({length:36},()=>Math.floor(Math.random()*3));$('#kind').textContent=boss?'⚑ 草原のボス':trainer?'⚔ トレーナーバトル':'🌿 野生のポケモン';$('#weakness-tip').textContent=`${icons[[1,2,0][m.type]]} ${types[[1,2,0][m.type]]}で こうかばつぐん！`;$('#enemyname').textContent=m.name;$('#enemyimg').src=img(m.id);$('#enemyimg').alt=m.name;$('#clock').textContent='30.0';$('#combo').textContent='属性を3個以上つなごう';$('#chain').textContent='0 CHAIN';$('#start').hidden=false;updateHP();updateCharge();draw();$('#encounter-label').textContent=boss?'ボスが あらわれた！':trainer?'トレーナーと しょうぶ！':'野生のポケモンが あらわれた！';$('#encounter-name').textContent=m.name;$('#encounter-img').src=img(m.id);$('#encounter-img').alt=m.name;$('#encounter').showModal();tone(520,.15)}
function updateHP(){$('#hpbar').style.width=`${100*battle.hp/battle.total}%`;$('#hptext').textContent=`HP ${Math.ceil(battle.hp)} / ${battle.total} · ${types[battle.m.type]}タイプ`}
const canvas=$('#board'),ctx=canvas.getContext('2d');function draw(){ctx.clearRect(0,0,420,420);for(let i=0;i<36;i++){let x=(i%6)*70+35,y=Math.floor(i/6)*70+35;ctx.beginPath();ctx.shadowColor=path.includes(i)?'#ffe36a':'#51317344';ctx.shadowBlur=path.includes(i)?16:0;ctx.shadowOffsetY=4;ctx.arc(x,y,path.includes(i)?31:28,0,Math.PI*2);ctx.fillStyle=colors[grid[i]];ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.beginPath();ctx.ellipse(x-5,y-15,15,6,-.3,0,Math.PI*2);ctx.fillStyle='#ffffff66';ctx.fill();ctx.beginPath();ctx.arc(x,y,path.includes(i)?31:28,0,Math.PI*2);ctx.strokeStyle=path.includes(i)?'#6a35ab':'#ffffffaa';ctx.lineWidth=path.includes(i)?5:2;ctx.stroke();ctx.font='29px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(icons[grid[i]],x,y+1);if(path.includes(i)){ctx.font='bold 12px sans-serif';ctx.fillStyle='#4d2b73';ctx.fillText(String(path.indexOf(i)+1),x+18,y-20)}}if(path.length){ctx.strokeStyle='#fff5b5';ctx.lineWidth=6;ctx.lineJoin='round';ctx.beginPath();path.forEach((i,j)=>{let x=i%6*70+35,y=Math.floor(i/6)*70+35;j?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}}
function cell(e){let r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*420/r.width,y=(e.clientY-r.top)*420/r.height;if(x<0||y<0||x>=420||y>=420)return -1;return Math.floor(y/70)*6+Math.floor(x/70)}
canvas.onpointerdown=e=>{if(e.cancelable)e.preventDefault();clearPuzzleSelection();if(!running||activePuzzlePointer!==null)return;let i=cell(e);if(i<0)return;activePuzzlePointer=e.pointerId;drag=true;path=[i];tone(380,.035);try{canvas.setPointerCapture(e.pointerId)}catch{}draw()};canvas.onpointermove=e=>{if(e.pointerId!==activePuzzlePointer)return;if(e.cancelable)e.preventDefault();if(!drag||!running)return;let i=cell(e),last=path.at(-1);if(i<0||i===last)return;if(path.length>1&&i===path.at(-2)){path.pop();draw();return}if(!path.includes(i)&&grid[i]===grid[last]&&Math.abs(i%6-last%6)<=1&&Math.abs(Math.floor(i/6)-Math.floor(last/6))<=1){path.push(i);$('#chain').textContent=`${path.length} つなぎ！`;$('#puzzle-tip').textContent=path.length>=3?'はなして チャージ！':'あと'+(3-path.length)+'つ つなごう！';tone(380+path.length*55,.04);draw()}};
canvas.onpointerup=e=>{if(e.pointerId!==activePuzzlePointer)return;if(e.cancelable)e.preventDefault();activePuzzlePointer=null;if(!drag)return;drag=false;if(running&&performance.now()-startAt>=30000){path=[];resolveAttack();return}if(running&&path.length>=3){let now=performance.now();combo=lastClear&&now-lastClear<=2000?combo+1:1;maxCombo=Math.max(maxCombo,combo);lastClear=now;let t=grid[path[0]],power=state.party.reduce((s,id)=>s+(mons[id-1].type===t?mons[id-1].power:0),0)||4;let weak=(t===0&&battle.m.type===2)||(t===2&&battle.m.type===1)||(t===1&&battle.m.type===0);let damage=Math.round(power*path.length/3*(1+Math.min(combo-1,9)*.15)*(weak?2:1));battle.damage+=damage;flyCharge(path.slice(),t,damage);attackFX(path.slice(),t,damage,weak,combo);$('#combo').textContent=`${combo} COMBO ×${(1+Math.min(combo-1,9)*.15).toFixed(2)} · +${damage}パワー${weak?' 効果抜群！':''}`;for(let c=0;c<6;c++){let keep=[];for(let row=5;row>=0;row--){let i=row*6+c;if(!path.includes(i))keep.push(grid[i])}for(let row=5;row>=0;row--)grid[row*6+c]=keep[5-row]??Math.floor(Math.random()*3)}}if(path.length>0&&path.length<3)$('#puzzle-tip').textContent='3つ以上つなぐと パワーがたまるよ！';path=[];draw()};canvas.onpointercancel=e=>{if(e.pointerId!==activePuzzlePointer)return;resetPuzzlePointer()};canvas.onlostpointercapture=e=>{if(e.pointerId===activePuzzlePointer)resetPuzzlePointer()};
$('#start').onclick=async()=>{if(preparing||running)return;preparing=true;$('#start').hidden=true;const epoch=battleEpoch;for(const n of ['3','2','1','GO!']){if(epoch!==battleEpoch)return;$('#ready-overlay').innerHTML=`<strong class="countdown-number">${n}</strong>`;tone(n==='GO!'?880:440,.12);await new Promise(resolve=>setTimeout(resolve,n==='GO!'?250:550))}if(epoch!==battleEpoch)return;$('#ready-overlay').hidden=true;preparing=false;running=true;battle.phase='charging';startAt=performance.now();raf=requestAnimationFrame(tick)};
function tick(now){if(!running)return;elapsed=(now-startAt)/1000;let left=Math.max(0,30-elapsed);$('#clock').textContent=left.toFixed(1);$('#timebar').style.width=`${left/30*100}%`;$('#combobar').style.width=lastClear?`${Math.max(0,1-(now-lastClear)/2000)*100}%`:'0%';$('#battle').classList.toggle('hurry',left<=5);if(left<=5&&Math.ceil(left)!==lastSecond){lastSecond=Math.ceil(left);tone(650,.06)}if(elapsed>=30){resolveAttack();return}raf=requestAnimationFrame(tick)}

function result(html){$('#resultBody').innerHTML=html;$('#result').showModal();if(battle&&battle.hp===0){celebrate();tone(660,.1);setTimeout(()=>tone(880,.15),130)}}function done(){busy=false;render();$('#result').close();$('#message').textContent='次の出会いを探しにいこう。'}
function endBattle(win){if(!battle)return;battleEpoch++;preparing=false;running=false;drag=false;cancelAnimationFrame(raf);$('#battle').close();if(!win){state.balls++;render();result('<h2>もう一度、挑戦しよう。</h2><p>相手は逃げてしまった！<br>参加報酬：モンスターボール1個</p><button class="primary" id="done">マップへ戻る</button>');$('#done').onclick=done;return}if(battle.trainer){state.super+=battle.boss?3:1;state.balls+=2;render();result(`<h2>${battle.boss?'草原クリア！':'トレーナーに勝利！'}</h2><p>スーパーボール ${battle.boss?3:1}個<br>モンスターボール 2個を獲得！</p><button id="done" class="primary">旅を続ける</button>`);$('#done').onclick=done;return}let base=Math.min(.8,.4+Math.min(1,battle.damage/battle.total-1)*.15+maxCombo*.015);result(`<small>CATCH CHANCE</small><h2>${battle.m.name}を捕まえよう！</h2><img src="${img(battle.m.id)}" alt="${battle.m.name}"><p>ボールを選んで捕獲に挑戦。<br>ためたパワー・最大コンボで確率アップ！</p><button id="normal" class="primary ball-choice" ${state.balls?'':'disabled'}><img src="assets/poke-ball.jpg" alt=""><span>モンスターボール<small>つかまる確率 ${Math.round(base*100)}% · 残り${state.balls}個</small></span></button><button id="super" class="primary ball-choice" ${state.super?'':'disabled'}><img src="assets/great-ball.jpg" alt=""><span>スーパーボール<small>つかまる確率 ${Math.round(Math.min(.95,base+.2)*100)}% · 残り${state.super}個</small></span></button><button id="skip">見送る</button>`);$('#normal').onclick=()=>catchMon(false,base);$('#super').onclick=()=>catchMon(true,Math.min(.95,base+.2));$('#skip').onclick=done}
async function catchMon(superBall,chance){if(capturePending)return;if(superBall){if(!state.super)return;state.super--}else{if(!state.balls)return;state.balls--}capturePending=true;save();let ok=Math.random()<chance;$('#resultBody').innerHTML=`<div class="catch-ball"><img src="assets/${superBall?'great-ball':'poke-ball'}.jpg" alt="${superBall?'スーパーボール':'モンスターボール'}"></div><h2>つかまるかな…？</h2><p>ドキドキ…</p>`;tone(330,.12);await new Promise(resolve=>setTimeout(resolve,1400));let duplicate=state.owned.includes(battle.m.id);if(ok){if(duplicate)state.balls+=2;else state.owned.push(battle.m.id)}render();$('#resultBody').innerHTML=`<h2>${ok?'やった！ 捕獲成功！':'あっ！ 逃げられた…'}</h2><img src="${img(battle.m.id)}" alt="${battle.m.name}"><p>${ok?(duplicate?'すでに仲間のポケモンです。<br>モンスターボール2個に交換しました。':`${battle.m.name}のカードを獲得！<br>図鑑からパーティに編成できます。`):'また草むらで探してみよう。'}</p><button class="primary" id="done">旅を続ける</button>`;$('#done').onclick=done;if(ok){celebrate();tone(880,.2)}else tone(220,.2);capturePending=false}
$('#leave').onclick=()=>{if(confirm('バトルを撤退しますか？')){battleEpoch++;preparing=false;running=false;cancelAnimationFrame(raf);$('#battle').close();busy=false;render()}};$('#battle').addEventListener('cancel',e=>e.preventDefault());$('#result').addEventListener('cancel',e=>e.preventDefault());document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||preparing)){elapsed=(performance.now()-startAt)/1000;endBattle(false)}});render();

document.addEventListener('title:start',()=>{ $('#title-screen').hidden=true;$('#game-shell').hidden=false;document.body.classList.remove('at-title');window.scrollTo(0,0);$('#roll').focus({preventScroll:true})});

$('#back-title').onclick=()=>{if(busy)return;$('#game-shell').hidden=true;$('#title-screen').hidden=false;document.body.classList.add('at-title');window.PokekoroTitle?.reset();window.scrollTo(0,0);$('#enter-game').focus({preventScroll:true})};

let soundOn=true,audioContext=null,lastSecond=-1;
const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function tone(frequency,duration){if(!soundOn)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audioContext??=new AC();if(audioContext.state==='suspended')audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(frequency,audioContext.currentTime);g.gain.setValueAtTime(.045,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration)}catch{}}
document.addEventListener('title:soundchange',e=>{soundOn=!!e.detail.enabled;if(soundOn&&e.detail.userGesture)tone(660,.1)});
function pulse(el,cls){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}
function attackFX(cells,type,damage,weak,count){const layer=$('#battle-fx');let html='';for(const cell of cells){const x=(cell%6+.5)/6*100,y=(Math.floor(cell/6)+.5)/6*100;for(let j=0;j<(reduceMotion?1:5);j++){const angle=j*1.2566;html+=`<b class="burst-particle" style="left:${x}%;top:${y}%;--dx:${Math.cos(angle)*45}px;--dy:${Math.sin(angle)*45}px;--spark:${colors[type]}">${j%2?'✦':'●'}</b>`}html+=`<b class="pop-ring" style="left:${x}%;top:${y}%;--spark:${colors[type]}"></b>`}layer.innerHTML=html;const token=++fxToken;setTimeout(()=>{if(token===fxToken)layer.innerHTML=''},650);$('#callout').innerHTML=`<strong>${cells.length>=7?'すごい!!':cells.length>=5?'いいね！':'ナイス！'}</strong><span>${count} コンボ!</span>`;pulse($('#callout'),'callout-pop');$('#puzzle-tip').textContent='つづけて消して パワーアップ！';tone(520+Math.min(count,10)*50,.11);if(cells.length>=7&&!reduceMotion)pulse($('.puzzle-stage'),'big-hit');}
let fxToken=0;
function celebrate(){const box=$('#resultBody');box.querySelector('.confetti')?.remove();const layer=document.createElement('div');layer.className='confetti';layer.setAttribute('aria-hidden','true');layer.innerHTML=Array.from({length:reduceMotion?0:30},(_,i)=>`<i style="--x:${(i*37)%100}%;--delay:${i%6*.07}s;--rot:${i*43}deg;--c:${['#ffcf45','#af83f5','#6bd6cd','#ff8c99'][i%4]}"></i>`).join('');box.append(layer);}

document.querySelectorAll('[data-version]').forEach(el=>el.textContent=`Ver. ${GAME_VERSION}`);
$('#open-credits').onclick=e=>{e.preventDefault();$('#credits').showModal()};
$('#close-credits').onclick=()=>$('#credits').close();

// Match the Ray Edu Labo introduction used in Micra Rails.
(function studioIntro(){
 const splash=$('#boot-screen'),logo=$('#boot-logo');splash.hidden=false;
 let started=false;
 function reveal(){if(started)return;started=true;setTimeout(()=>{splash.classList.add('is-leaving');setTimeout(()=>{splash.hidden=true},reduceMotion?0:2100)},reduceMotion?800:2800)}
 if(logo.complete)reveal();else{logo.addEventListener('load',reveal,{once:true});logo.addEventListener('error',reveal,{once:true});setTimeout(reveal,4000)}
})();

$('#encounter-go').onclick=()=>{$('#encounter').close();$('#battle').showModal();fitBattle()};
$('#encounter').addEventListener('cancel',e=>e.preventDefault());
function fitBattle(){const view=window.visualViewport;const height=view?view.height:window.innerHeight;const width=view?view.width:window.innerWidth;const size=Math.max(120,Math.min(420,width-28,height*.39));$('#battle').style.setProperty('--puzzle-size',`${size}px`)}
window.addEventListener('resize',fitBattle);if(window.visualViewport)window.visualViewport.addEventListener('resize',fitBattle);

function fitViewport(){document.documentElement.style.setProperty('--app-height',`${Math.round(window.visualViewport?window.visualViewport.height:window.innerHeight)}px`);fitBattle()}
window.addEventListener('resize',fitViewport);if(window.visualViewport)window.visualViewport.addEventListener('resize',fitViewport);fitViewport();

function updateCharge(value=battle.damage){const p=value/battle.total;$('#charge-value').textContent=value.toLocaleString();$('#chargebar').style.width=`${Math.min(100,p*100)}%`;$('.attack-charge').classList.toggle('charged',p>=1);$('#charge-hint').textContent=p>=1?'撃破ライン突破！ もっとためて捕獲率アップ！':`あと ${Math.max(0,battle.total-value)} パワーで撃破ライン！`;}
async function resolveAttack(){
 if(!battle||battle.phase==='resolving'||battle.phase==='finished')return;
 running=false;activePuzzlePointer=null;drag=false;preparing=false;path=[];elapsed=30;cancelAnimationFrame(raf);battle.phase='resolving';const epoch=battleEpoch;
 $('#clock').textContent='0.0';$('#timebar').style.width='0%';$('#combobar').style.width='0%';$('#battle').classList.remove('hurry');$('#battle').classList.add('resolving');$('#ready-overlay').hidden=false;$('#ready-overlay').innerHTML='<strong>タイムアップ！</strong><span>ためたパワーで 一斉攻撃！</span>';$('#puzzle-tip').textContent='いくぞ！ みんなでアタック！';tone(440,.15);
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,reduceMotion?Math.min(250,ms):ms));
 await wait(1200);if(epoch!==battleEpoch)return;updateCharge();
 $('#battle').classList.add('gathering-power');$('#ready-overlay').innerHTML='<strong>ぐぐぐ…！</strong><span>みんなの力を ひとつに！</span>';const orb=makeEnergyOrb();tone(280,.35);
 await wait(1000);if(epoch!==battleEpoch)return;$('#battle').classList.remove('gathering-power');orb.classList.add('energy-launch');tone(1200,.25);
 $('#ready-overlay').innerHTML='<strong>はっしゃ！！</strong><span>ポケモンに めいちゅう！</span>';
 await wait(450);if(epoch!==battleEpoch)return;orb.remove();
 $('#ready-overlay').innerHTML=`<strong>いっけー！！</strong><span>${battle.damage.toLocaleString()} パワー解放！</span>`;$('#battle').classList.add('attack-release');pulse($('.enemy'),'enemy-hit');tone(880,.3);
 const d=document.createElement('b');d.className='damage-number final-damage';d.innerHTML=`${battle.damage.toLocaleString()}<small>まとめて ダメージ！</small>`;$('.enemy').append(d);
 const remaining=Math.max(0,battle.total-battle.damage);battle.hp=remaining;updateHP();$('#chargebar').style.width='0%';
 await wait(1200);if(epoch!==battleEpoch)return;d.remove();$('#ready-overlay').innerHTML=`<strong>${remaining===0?'やった！ 勝利！':'あと一歩…！'}</strong><span>${remaining===0?'みんなのパワーが とどいた！':'次はもっと パワーをためよう！'}</span>`;if(remaining===0)tone(1040,.2);
 await wait(800);if(epoch!==battleEpoch)return;battle.phase='finished';endBattle(remaining===0);
}

// Pointer capture keeps release reliable even when a finger leaves the button.
let diceHold=null;
function diceLayer(){
 const layer=document.createElement('div');layer.className='map-dice-event';layer.setAttribute('aria-hidden','true');layer.innerHTML=`<div class="dice-ground"></div><div class="dice-drop"><div class="map-die" data-value="5"><div class="dice-cube">${[1,6,3,4,2,5].map((n,i)=>`<div class="dice-face cube-side side-${i}" data-value="${n}">${'<i></i>'.repeat(9)}</div>`).join('')}</div></div></div><strong class="dice-announcement"></strong>`;$('.island-board').append(layer);return layer;
}
function cancelDiceHold(){
 if(!diceHold)return;diceHold=null;$('.map-dice-event')?.remove();$('#roll').classList.remove('dice-holding');$('#roll small').textContent='おして はなして ころがそう！';busy=false;
}
const rollButton=$('#roll');
rollButton.onpointerdown=e=>{
 if(busy||e.button!==0||!e.isPrimary)return;e.preventDefault();
 diceHold={pointer:e.pointerId};busy=true;rollButton.setPointerCapture(e.pointerId);
 diceLayer().classList.add('dice-held');rollButton.classList.add('dice-holding');$('#roll small').textContent='はなして ストップ！';
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
 await rotation.finished;
 cube.style.transform=`rotateX(${endX}deg) rotateY(${endY}deg)`;rotation.cancel();
 $('#dice').dataset.value=value;$('#dice').setAttribute('aria-label',`サイコロ ${value}`);layer.querySelector('.map-die').dataset.value=value;
 layer.querySelector('.dice-announcement').textContent=`${value} マス すすむ！`;layer.classList.add('dice-landed');tone(400,.1);
 await new Promise(resolve=>setTimeout(resolve,reduceMotion?250:650));layer.remove();tone(660,.12);
}
function energyLayer(){let layer=$('#energy-layer');if(!layer){layer=document.createElement('div');layer.id='energy-layer';layer.setAttribute('aria-hidden','true');$('#battle').append(layer)}return layer}
function flyCharge(cells,type,amount){
 const epoch=battleEpoch,layer=energyLayer(),dialog=$('#battle').getBoundingClientRect(),board=canvas.getBoundingClientRect(),gauge=$('.attack-charge-track').getBoundingClientRect();const tx=gauge.left-dialog.left+gauge.width/2,ty=gauge.top-dialog.top+gauge.height/2;
 for(const [j,cell] of cells.entries()){const x=board.left-dialog.left+(cell%6+.5)*board.width/6,y=board.top-dialog.top+(Math.floor(cell/6)+.5)*board.height/6,light=document.createElement('i');light.className='charge-light';light.style.cssText=`left:${x}px;top:${y}px;--dx:${tx-x}px;--dy:${ty-y}px;--spark:${colors[type]};animation-delay:${reduceMotion?0:j*12}ms`;layer.append(light);setTimeout(()=>light.remove(),800+j*12)}
 setTimeout(()=>{if(epoch!==battleEpoch||battle.phase==='finished')return;battle.shownDamage+=amount;updateCharge(battle.shownDamage);pulse($('.attack-charge'),'charge-pop');tone(740,.05)},reduceMotion?100:650+cells.length*12);
}
function makeEnergyOrb(){const layer=energyLayer(),dialog=$('#battle').getBoundingClientRect(),g=$('.attack-charge').getBoundingClientRect(),enemy=$('.enemy').getBoundingClientRect();const orb=document.createElement('div');orb.className='energy-orb';orb.style.cssText=`left:${g.left-dialog.left+g.width/2}px;top:${g.top-dialog.top+g.height/2}px;--target-y:${enemy.top+enemy.height/2-(g.top+g.height/2)}px`;layer.append(orb);return orb}

// iOS Safari: keep long presses and drag gestures inside the puzzle interaction.
function clearPuzzleSelection(){const selection=window.getSelection?.();if(selection&&selection.rangeCount)selection.removeAllRanges()}
function resetPuzzlePointer(){activePuzzlePointer=null;drag=false;path=[];draw()}
const puzzleStage=$('.puzzle-stage');
for(const event of ['selectstart','contextmenu','dragstart'])puzzleStage.addEventListener(event,e=>e.preventDefault());
for(const event of ['touchstart','touchmove'])puzzleStage.addEventListener(event,e=>{if(e.cancelable)e.preventDefault()},{passive:false});
