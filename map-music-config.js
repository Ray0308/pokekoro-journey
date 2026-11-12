'use strict';
const MAP_MUSIC_TRACKS=Object.freeze({field:MAP_AUDIO.src,wild:'assets/audio/grass-encounter.mp3',trainer:'assets/audio/trainer-encounter.mp3',trainerBattle:'assets/audio/trainer-battle.mp3',victory:'assets/audio/battle-victory.mp3',trainerVictory:'assets/audio/trainer-victory.mp3',gym:'assets/audio/map-gym.mp3',cave:'assets/audio/map-cave.mp3',hideout:'assets/audio/map-hideout.mp3',league:'assets/audio/map-league.mp3',water:'assets/audio/map-water.mp3'});
function mapMusicTheme(mapId){
 const map=MAPS[mapId];if(!map)return 'field';
 if(mapId.startsWith('indigo-')||mapId==='victory-road')return 'league';
 if(map.badge)return 'gym';
 if(['mt-moon','diglett-cave','rock-tunnel','seafoam-islands','cerulean-cave'].includes(mapId))return 'cave';
 if(['hideout','tower','mansion'].includes(map.kind))return 'hideout';
 if(mapId==='ss-anne'||mapId==='rainbow-cloud')return 'water';
 return 'field';
}

// The supplied field recording is quieter than the synthesized themes.
function mapMusicVolume(theme){return theme==='field'?.5:theme==='wild'?.36:MAP_AUDIO.volume}



// Measured first musical onset: keep the tiny pre-attack, skip the export lead-in.
const MAP_MUSIC_CUE=Object.freeze({trainerBattle:.62});
