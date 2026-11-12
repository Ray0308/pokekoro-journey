'use strict';
const POKEMON_TYPE_NAMES=['くさ','ほのお','みず','どく','ひこう','ノーマル','でんき','こおり','かくとう','じめん','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
const POKEMON_TYPE_ICONS=['🌿','🔥','💧','☠','🪽','●','⚡','❄','✊','⛰','🔮','🐛','🪨','👻','🐉','🌙','⚙','✨'];
const POKEMON_TYPE_COLORS=['#79b879','#f6a16c','#7ebcda','#b28ac8','#a4b9de','#b7b5a5','#edcf66','#9dd8d8','#ca8e75','#c5ad77','#de91b4','#acc273','#b9aa80','#968bb8','#8d97d9','#9d9390','#acbdc4','#e6b4cf'];
function pokemonTypes(mon){return [...new Set(mon?.types||(Number.isInteger(mon?.type)?[mon.type]:[]))].filter(t=>Number.isInteger(t)&&t>=0&&t<18).slice(0,2)}
function partyTypes(party){return [...new Set(party.flatMap(id=>pokemonTypes(POKEDEX[id-1])))]}
function partyTypeError(next){if(!next.length||next.length>6)return 'パーティーは 1〜6匹です';if(partyTypes(next).length<3)return 'パーティーには 3属性以上 必要です';return ''}
function pokemonTypePower(mon,type){const ts=pokemonTypes(mon),index=ts.indexOf(type);return index<0?0:mon.power*(ts.length===1?1:index===0?.8:.5)}
function partyTypePower(party,type){return party.reduce((sum,id)=>sum+pokemonTypePower(POKEDEX[id-1],type),0)}
function randomPartyType(){const pool=battle?.puzzleTypes||partyTypes(state.party);return pool[Math.floor(Math.random()*pool.length)]}
