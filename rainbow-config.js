'use strict';
// Number-only categories. Ultra Beasts, Paradox Pokémon and pseudo-legendaries are excluded.
const RAINBOW_POOLS=Object.freeze({
 subLegendary:Object.freeze([144,145,146,243,244,245,377,378,379,380,381,480,481,482,485,486,488,638,639,640,641,642,645,772,773,785,786,787,788,891,892,894,895,896,897,905,1001,1002,1003,1004,1014,1015,1016,1017]),
 legendary:Object.freeze([150,249,250,382,383,384,483,484,487,643,644,646,716,717,718,789,790,791,792,800,888,889,890,898,1007,1008,1024]),
 mythical:Object.freeze([151,251,385,386,489,490,491,492,493,494,647,648,649,719,720,721,801,802,807,808,809,893,1025])
});
const RAINBOW_CONFIG=Object.freeze({mapId:'rainbow-cloud',ticketRate:.02,ticketImage:'assets/rainbow-ticket.svg',weights:Object.freeze([70,25,5]),bossIds:Object.freeze([...RAINBOW_POOLS.legendary.filter(id=>id!==789&&id!==790),...RAINBOW_POOLS.mythical])});
const RAINBOW_IDS=Object.freeze([...new Set(Object.values(RAINBOW_POOLS).flat())]);
const NORMAL_ENCOUNTER_IDS=Object.freeze(POKEDEX.map(m=>m.id).filter(id=>!RAINBOW_IDS.includes(id)));
