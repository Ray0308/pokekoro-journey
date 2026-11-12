'use strict';
const SAFARI_RULES=Object.freeze({mapId:'safari-zone',finalIds:Object.freeze([115,113,128]),base:.25,gaugeBonus:.4,comboBonus:.01,cap:.85});
function isSafari(){return state.mapId===SAFARI_RULES.mapId}
function safariCatchBase(power,total,combo){return Math.min(SAFARI_RULES.cap,SAFARI_RULES.base+Math.min(1,Math.max(0,power)/total)*SAFARI_RULES.gaugeBonus+Math.min(20,combo)*SAFARI_RULES.comboBonus)}
function configureSafariUI(){
 const safari=!!battle.safari;$('#battle').classList.toggle('safari-puzzle',safari);
 $('.attack-charge>div>strong').textContent=safari?'なかよしゲージ':'こうげきパワー';$('.attack-charge-track b').textContent=safari?'なかよし目標':'撃破ライン';$('#start').textContent=safari?'▶ なかよし スタート！':'▶ バトル スタート！';
 if(safari){$('#kind').textContent=battle.boss?'🌿 特別な 野生のポケモン':'🌿 サファリで なかよしチャレンジ';$('#weakness-tip').textContent=`玉をつないで なかよくなろう！ · ${battle.puzzleTypes.length}属性 ×${typeDiversityBonus(battle.puzzleTypes.length).toFixed(2)}`;$('#ready-overlay').innerHTML='<strong>3つ つないで<br>なかよく なろう！</strong><span>30秒で ゲージをためて 捕獲に挑戦！</span>';$('#hptext').textContent='倒さずに なかよく なろう！';$('#encounter-label').textContent=battle.boss?'特別な 野生のポケモンが あらわれた！':'野生のポケモンが あらわれた！'}
}
async function resolveSafari(){
 running=false;activePuzzlePointer=null;drag=false;preparing=false;path=[];elapsed=30;cancelAnimationFrame(raf);battle.phase='resolving';const epoch=battleEpoch;
 $('#clock').textContent='0.0';$('#timebar').style.width='0%';$('#combobar').style.width='0%';$('#battle').classList.remove('hurry');$('#ready-overlay').hidden=false;$('#ready-overlay').innerHTML='<strong>タイムアップ！</strong><span>どれくらい なかよく なれたかな？</span>';$('#puzzle-tip').textContent='ボールで 捕獲に ちょうせん！';updateCharge();
 await new Promise(resolve=>setTimeout(resolve,reduceMotion?150:1000));if(epoch!==battleEpoch)return;battle.phase='finished';endBattle(true);
}
function endSafari(completed){
 if(!battle||battle.rewardResolved)return;battle.rewardResolved=true;battleEpoch++;preparing=false;running=false;drag=false;cancelAnimationFrame(raf);$('#battle').close();
 if(battle.boss){if(!state.clearedMaps.includes(state.mapId))state.clearedMaps.push(state.mapId);state.pendingMapId=activeMap().nextMap}
 const master=completed&&battle.boss&&Math.random()<BALL_DROPS.bossMaster;if(master)state.master++;
 const ticket=completed&&battle.boss&&(window.PokekoroDebug?.forceRainbowTicket?.()||Math.random()<RAINBOW_CONFIG.ticketRate)?grantRainbowTicket():null;
 render();
 if(!completed){result(`<h2>サファリの挑戦 おしまい</h2><p>また なかよく なろう！</p><button id="done" class="primary">${battle.boss?'次のマップへ':'マップへ戻る'}</button>`);$('#done').onclick=done;return}
 const base=safariCatchBase(battle.damage,battle.total,maxCombo);
 result(`<small>${battle.boss?'サファリの 最後の出会い':'なかよしチャレンジ おしまい！'}</small><h2>${battle.m.label}を捕まえよう！</h2><img src="${img(battle.m.id)}" alt="${battle.m.label}"><p>なかよしゲージ ${battle.damage.toLocaleString()}！<br>ゲージとコンボで 捕獲率アップ！</p>${master||ticket?rewardItemsHtml([...(master?[{id:'master',count:1}]:[]),...(ticket?[{id:'rainbow',count:1}]:[])]):''}<div class="ball-options">${BALLS.map(b=>`<button id="${b.id}" class="primary ball-choice" ${state[b.key]?'':'disabled'}><img src="${b.image}" alt=""><span>${b.name}<small>成功 ${Math.round(Math.min(b.cap,base+b.bonus)*100)}%・残り ${state[b.key]}個</small></span></button>`).join('')}</div><button id="skip">${battle.boss?'見送って 次のマップへ':'見送る'}</button>`);
 BALLS.forEach(b=>{$('#'+b.id).onclick=()=>catchMon(b.id,Math.min(b.cap,base+b.bonus))});$('#skip').onclick=done;
}

function updateSafariMapLegend(){const spans=$('#map .board-legend').children;if(spans.length<4)return;spans[1].hidden=isSafari();spans[2].hidden=isSafari();spans[3].textContent=isSafari()?'🌿 特別な出会い':'🏆 ボス'}
