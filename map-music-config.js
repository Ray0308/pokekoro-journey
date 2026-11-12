'use strict';
const MAP_MUSIC_TRACKS=Object.freeze({field:MAP_AUDIO.src,gym:'assets/audio/map-gym.mp3',cave:'assets/audio/map-cave.mp3',hideout:'assets/audio/map-hideout.mp3',league:'assets/audio/map-league.mp3',water:'assets/audio/map-water.mp3'});
function mapMusicTheme(mapId){
 const map=MAPS[mapId];if(!map)return 'field';
 if(mapId.startsWith('indigo-')||mapId==='victory-road')return 'league';
 if(map.badge)return 'gym';
 if(['mt-moon','diglett-cave','rock-tunnel','seafoam-islands','cerulean-cave'].includes(mapId))return 'cave';
 if(['hideout','tower','mansion'].includes(map.kind))return 'hideout';
 if(mapId==='ss-anne'||mapId==='rainbow-cloud')return 'water';
 return 'field';
}
