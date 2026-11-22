'use strict';
// 音源と場面の対応。曲の切り替え処理そのものはmap-audio.jsに置く。
const MAP_MUSIC_TRACKS = Object.freeze({
  field: MAP_AUDIO.src,
  pewter: 'assets/audio/map-pewter-chip-v1.mp3',
  cerulean: 'assets/audio/map-cerulean-chip-v1.mp3',
  celadon: 'assets/audio/map-celadon-chip-v1.mp3',
  forest: 'assets/audio/map-forest-chip-v1.mp3',
  ship: 'assets/audio/map-ship-chip-v1.mp3',
  tower: 'assets/audio/map-tower-chip-v1.mp3',
  safari: 'assets/audio/map-safari-chip-v1.mp3',
  silph: 'assets/audio/map-silph-chip-v1.mp3',
  mansion: 'assets/audio/map-mansion-chip-v1.mp3',
  route23: 'assets/audio/map-route23-chip-v1.mp3',
  wild: 'assets/audio/grass-encounter.mp3',
  trainer: 'assets/audio/trainer-encounter.mp3',
  trainerBattle: 'assets/audio/trainer-battle.mp3',
  bossVs: 'assets/audio/boss-vs-user-v1.mp3',
  victory: 'assets/audio/battle-victory.mp3',
  trainerVictory: 'assets/audio/trainer-victory.mp3',
  gym: 'assets/audio/map-gym-chip-v1.mp3',
  cave: 'assets/audio/map-cave-chip-v1.mp3',
  hideout: 'assets/audio/map-hideout-chip-v1.mp3',
  league: 'assets/audio/map-league-chip-v1.mp3',
  water: 'assets/audio/map-water-chip-v1.mp3',
  pokedex: 'assets/audio/map-pokedex-chip-v1.mp3',
});
const MAP_PLACE_MUSIC = Object.freeze({
  viridian: 'forest',
  'pewter-city': 'pewter',
  'cerulean-city': 'cerulean',
  'celadon-city': 'celadon',
  'ss-anne': 'ship',
  'pokemon-tower': 'tower',
  'safari-zone': 'safari',
  'silph-co': 'silph',
  'pokemon-mansion': 'mansion',
  'route-23': 'route23',
});
function mapMusicTheme(mapId) {
  const map = MAPS[mapId];
  if (!map) return 'field';
  if (MAP_PLACE_MUSIC[mapId]) return MAP_PLACE_MUSIC[mapId];
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
  pewter: 0.289,
  cerulean: 0.409,
  celadon: 0.265,
  forest: 0.326,
  ship: 0.283,
  tower: 0.313,
  safari: 0.464,
  silph: 0.432,
  mansion: 0.332,
  route23: 0.224,
  wild: 0.26,
  trainer: 0.405,
  trainerBattle: 0.225,
  bossVs: 0.18,
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
const MAP_MUSIC_TAIL = Object.freeze({
  field: 4.0,
  trainer: 0.47,
  trainerVictory: 0.95,
  bossVs: 5.1,
});
function mapMusicBounds(key, duration) {
  const start = Math.min(MAP_MUSIC_CUE[key] ?? 0, Math.max(0, duration - 0.1));
  return { start, end: Math.max(start + 0.05, duration - (MAP_MUSIC_TAIL[key] ?? 0)) };
}

// ジムの一般トレーナーやロケット団ボスは通常曲。チャンピオンはライバルとして対象。
function trainerMusicTheme(mapId, b, fighting = false) {
  if (
    b?.boss &&
    (MAPS[mapId]?.badge || b.series?.classId === 'rival' || mapId.startsWith('indigo-'))
  )
    return 'bossVs';
  return fighting ? 'trainerBattle' : 'trainer';
}
