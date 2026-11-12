'use strict';
(() => {
 const dialog=document.querySelector('#pokedex-device'),synth=window.speechSynthesis;
 const supported=!!synth&&typeof window.SpeechSynthesisUtterance==='function';
 let selected=1,utterance=null,speechToken=0,openingTimer=0,soundEnabled=true;
 try{const saved=JSON.parse(localStorage.getItem('pokekoro-title-v1'));if(typeof saved?.sound==='boolean')soundEnabled=saved.sound}catch{}
 function status(text){document.querySelector('#device-status').textContent=text}
 function updateSpeechButton(){
  const button=document.querySelector('#device-speak'),hasText=!!POKEDEX[selected-1].description;
  button.disabled=!supported||!soundEnabled||!hasText;
  button.textContent=utterance?'■ とめる':!soundEnabled?'サウンドOFF':'▶ よみあげ';
 }
 function stopReading(){speechToken++;if(supported)synth.cancel();utterance=null;dialog.classList.remove('is-speaking');updateSpeechButton()}
 function renderEntry(){
  const mon=POKEDEX[selected-1],owned=state.owned.includes(selected);
  document.querySelector('#device-number').textContent='No.'+pokemonNumber(selected);
  document.querySelector('#device-name').textContent=mon.label;
  const image=document.querySelector('#device-image');image.src=pokemonPortrait(selected);image.alt=mon.label;
  document.querySelector('#device-type').textContent=mon.type===null?'タイプ：—':types[mon.type]+'タイプ';
  document.querySelector('#device-description').textContent=mon.description||'せつめいは まだ とうろくされていません。';
  document.querySelector('#device-owned').textContent=owned?'✓ つかまえた！':'まだ つかまえていません';
  const party=document.querySelector('#device-party');party.disabled=!owned;party.textContent=state.party.includes(selected)?'パーティーから はずす':'パーティーに いれる';
  document.querySelector('#device-prev').disabled=selected===1;document.querySelector('#device-next').disabled=selected===POKEDEX_SIZE;
  document.querySelector('#device-jump').value=String(selected);
  status(!supported?'この端末では よみあげを利用できません':!mon.description?'せつめいは これから追加されます':'ボタンを押すと せつめいを読むよ');updateSpeechButton();
 }
 function select(id){if(!validPokemonId(id))return;stopReading();selected=id;renderEntry()}
 function open(id=selected){
  if(busy||!validPokemonId(id))return;select(id);
  if(!dialog.open){dialog.showModal();clearTimeout(openingTimer);if(!matchMedia('(prefers-reduced-motion: reduce)').matches){dialog.classList.add('is-opening');openingTimer=setTimeout(()=>dialog.classList.remove('is-opening'),550)}}
 }
 function read(){
  if(utterance){stopReading();status('よみあげを とめました');return}
  const mon=POKEDEX[selected-1];if(!supported||!soundEnabled||!mon.description)return;
  stopReading();const token=speechToken;
  utterance=new SpeechSynthesisUtterance(mon.label+'。'+mon.description);utterance.lang='ja-JP';utterance.rate=.92;utterance.pitch=.95;
  const voice=synth.getVoices().find(v=>v.lang?.toLowerCase().startsWith('ja'));if(voice)utterance.voice=voice;
  utterance.onstart=()=>{if(token===speechToken){dialog.classList.add('is-speaking');status('よみあげ中…');updateSpeechButton()}};
  function finished(error){if(token!==speechToken)return;utterance=null;dialog.classList.remove('is-speaking');updateSpeechButton();status(error?'よみあげを始められませんでした。もう一度ためしてね':'よみおわりました')}
  utterance.onend=()=>finished(false);utterance.onerror=event=>finished(!['canceled','interrupted'].includes(event.error));
  try{synth.speak(utterance);updateSpeechButton()}catch{finished(true)}
 }
 document.querySelector('#open-pokedex').onclick=()=>open();
 document.querySelector('#device-close').onclick=()=>dialog.close();
 document.querySelector('#device-speak').onclick=read;
 document.querySelector('#device-prev').onclick=()=>select(selected-1);
 document.querySelector('#device-next').onclick=()=>select(selected+1);
 document.querySelector('#device-jump').addEventListener('change',event=>{const id=Number(event.target.value);if(validPokemonId(id))select(id);else{event.target.value=String(selected);status('1〜1025の 番号をいれてね')}});
 document.querySelector('#device-party').onclick=()=>{const message=togglePokemonParty(selected);renderEntry();if(message)status(message)};
 dialog.addEventListener('close',()=>{stopReading();clearTimeout(openingTimer);dialog.classList.remove('is-opening')});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopReading()});
 window.addEventListener('pagehide',stopReading);
 document.addEventListener('title:soundchange',event=>{soundEnabled=!!event.detail.enabled;if(!soundEnabled)stopReading();updateSpeechButton()});
 window.PokekoroDex=Object.freeze({open});
})();
