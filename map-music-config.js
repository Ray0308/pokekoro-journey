'use strict';
// 音源と場面の対応。曲の切り替え処理そのものはmap-audio.jsに置く。
const MAP_MUSIC_TRACKS = Object.freeze({
  field: MAP_AUDIO.src,
  wild: 'assets/audio/grass-encounter.mp3',
  trainer: 'assets/audio/trainer-encounter.mp3',
  trainerBattle: 'assets/audio/trainer-battle.mp3',
  victory: 'assets/audio/battle-victory.mp3',
  trainerVictory: 'assets/audio/trainer-victory.mp3',
  gym: 'assets/audio/map-gym-chip-v1.mp3',
  cave: 'assets/audio/map-cave-chip-v1.mp3',
  hideout: 'assets/audio/map-hideout-chip-v1.mp3',
  league: 'assets/audio/map-league-chip-v1.mp3',
  water: 'assets/audio/map-water-chip-v1.mp3',
  pokedex: 'assets/audio/map-pokedex-chip-v1.mp3',
});
function mapMusicTheme(mapId) {
  const map = MAPS[mapId];
  if (!map) return 'field';
  if (mapId.startsWith('indigo-') || mapId === 'victory-road') return 'league';
  if (map.badge) return 'gym';
  if (
    ['mt-moon', 'diglett-cave', 'rock-tunnel', 'seafoam-islands', 'cerulean-cave'].includes(mapId)
  )
    return 'cave';
  if (map.kind === 'tower') return 'cave';
  if (['hideout', 'mansion'].includes(map.kind)) return 'hideout';
  if (mapId === 'ss-anne' || mapId === 'rainbow-cloud') return 'water';
  return 'field';
}

// 実音源のRMS測定に基づき、通常BGMの平均音量を概ね揃える。図鑑は読み上げ用に控えめ。
const MAP_MUSIC_LEVELS = Object.freeze({
  field: 0.4,
  wild: 0.26,
  trainer: 0.405,
  trainerBattle: 0.225,
  victory: 0.61,
  trainerVictory: 0.74,
  gym: 0.304,
  cave: 0.354,
  hideout: 0.389,
  league: 0.233,
  water: 0.311,
  pokedex: 0.205,
});
function mapMusicVolume(theme) {
  return MAP_MUSIC_LEVELS[theme] ?? MAP_AUDIO.volume;
}
// MP3書き出し時の前後の無音を、初回だけでなく繰り返しでも除外する。
const MAP_MUSIC_CUE = Object.freeze({
  field: 0.08,
  wild: 0.08,
  trainer: 0.28,
  trainerBattle: 0.62,
  victory: 0.47,
  trainerVictory: 0.77,
});
const MAP_MUSIC_TAIL = Object.freeze({ field: 4.0, trainer: 0.47, trainerVictory: 0.95 });
function mapMusicBounds(key, duration) {
  const start = Math.min(MAP_MUSIC_CUE[key] ?? 0, Math.max(0, duration - 0.1));
  return { start, end: Math.max(start + 0.05, duration - (MAP_MUSIC_TAIL[key] ?? 0)) };
}
