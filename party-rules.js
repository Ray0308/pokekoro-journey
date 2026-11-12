'use strict';
const POKEMON_TYPE_NAMES=['くさ','ほのお','みず','どく','ひこう','ノーマル','でんき','こおり','かくとう','じめん','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
const POKEMON_TYPE_ICONS=['🌿','🔥','💧','☠','🪽','●','⚡','❄','✊','⛰','🔮','🐛','🪨','👻','🐉','🌙','⚙','✨'];
const POKEMON_TYPE_COLORS=['#51b668','#fd9647','#5cacdd','#b557c9','#97b0e9','#949897','#f5d55a','#7ecfc9','#d8394d','#cf8755','#fd8d89','#98be2d','#cbbe87','#6765c6','#0570b6','#5e5f71','#4e979e','#f099e0'];
function pokemonTypes(mon){return [...new Set(mon?.types||(Number.isInteger(mon?.type)?[mon.type]:[]))].filter(t=>Number.isInteger(t)&&t>=0&&t<18).slice(0,2)}
function partyTypes(party){return [...new Set(party.flatMap(id=>pokemonTypes(POKEDEX[id-1])))]}
function partyTypeError(next){if(!next.length||next.length>6)return 'パーティーは 1〜6匹です';if(partyTypes(next).length<3)return 'パーティーには 3属性以上 必要です';return ''}
function pokemonTypePower(mon,type){const ts=pokemonTypes(mon),index=ts.indexOf(type);return index<0?0:mon.power*(ts.length===1?1:index===0?.8:.5)}
function partyTypePower(party,type){return party.reduce((sum,id)=>sum+pokemonTypePower(POKEDEX[id-1],type),0)}
// Tune the reward and refill help here; all party types remain eligible.
const MULTITYPE_BALANCE=Object.freeze({baseline:3,neighborChance:.25});
function typeDiversityBonus(typeCount){return Math.max(1,typeCount/MULTITYPE_BALANCE.baseline)}
function puzzleCharge(power,count,combo,weak,typeCount){return Math.round(power*count/3*(1+Math.min(Math.max(0,combo-1),9)*.15)*(weak?2:1)*typeDiversityBonus(typeCount))}
function choosePuzzleType(pool,neighbors=[],rng=Math.random){
 const adjacent=neighbors.filter(t=>pool.includes(t));
 if(pool.length>3&&adjacent.length&&rng()<MULTITYPE_BALANCE.neighborChance)return adjacent[Math.floor(rng()*adjacent.length)];
 return pool[Math.floor(rng()*pool.length)];
}
function randomPartyType(neighbors=[]){return choosePuzzleType(battle?.puzzleTypes||partyTypes(state.party),neighbors)}
function refillPuzzle(cleared){
 const removed=new Set(cleared);
 for(let col=0;col<6;col++){
  const keep=[];for(let row=5;row>=0;row--){const i=row*6+col;if(!removed.has(i))keep.push(grid[i])}
  for(let row=5;row>=0;row--)grid[row*6+col]=keep[5-row]??null;
 }
 for(let row=5;row>=0;row--)for(let col=0;col<6;col++){
  const i=row*6+col;if(grid[i]!==null)continue;
  const neighbors=[];if(row<5)neighbors.push(grid[i+6]);if(col>0)neighbors.push(grid[i-1]);if(col<5)neighbors.push(grid[i+1]);
  grid[i]=randomPartyType(neighbors);
 }
}
