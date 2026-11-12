'use strict';
const POKEMON_TYPE_NAMES=['くさ','ほのお','みず','どく','ひこう','ノーマル','でんき','こおり','かくとう','じめん','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
const POKEMON_TYPE_ICONS=['🌿','🔥','💧','☠','🪽','●','⚡','❄','✊','⛰','🔮','🐛','🪨','👻','🐉','🌙','⚙','✨'];
const POKEMON_TYPE_COLORS=['#51b668','#fd9647','#5cacdd','#b557c9','#97b0e9','#949897','#f5d55a','#7ecfc9','#d8394d','#cf8755','#fd8d89','#98be2d','#cbbe87','#6765c6','#0570b6','#5e5f71','#4e979e','#f099e0'];
function pokemonTypes(mon){return [...new Set(mon?.types||(Number.isInteger(mon?.type)?[mon.type]:[]))].filter(t=>Number.isInteger(t)&&t>=0&&t<18).slice(0,2)}
function partyTypes(party){return [...new Set(party.flatMap(id=>pokemonTypes(POKEDEX[id-1])))]}
function partyTypeError(next){if(!next.length||next.length>6)return 'パーティーは 1〜6匹です';if(partyTypes(next).length<3)return 'パーティーには 3属性以上 必要です';return ''}
function pokemonTypePower(mon,type){const ts=pokemonTypes(mon),index=ts.indexOf(type);return index<0?0:mon.power*(ts.length===1?1:index===0?.8:.5)}
function partyTypePower(party,type){return party.reduce((sum,id)=>sum+pokemonTypePower(POKEDEX[id-1],type),0)}
function randomPartyType(){const pool=battle?.puzzleTypes||partyTypes(state.party);return pool[Math.floor(Math.random()*pool.length)]}
