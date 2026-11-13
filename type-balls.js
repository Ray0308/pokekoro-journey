'use strict';
// セーブ移行・出現固定・交換見積もり・捕獲補正の共通ルール。UIから独立させて検証する。
const KURT_CONFIG = Object.freeze({
  rate: 0.1,
  cost: 5,
  matchBonus: 0.4,
  matchCap: 0.99,
  house: 'assets/map/kurt-house.webp',
  portrait: 'assets/trainers/kurt.jpg',
});
const TYPE_BALLS = Object.freeze(
  POKEMON_TYPE_NAMES.map((name, typeIndex) =>
    Object.freeze({
      id: 'type-' + typeIndex,
      name: name + 'ボール',
      typeIndex,
      image: 'assets/balls/type-' + typeIndex + '.png',
    }),
  ),
);
function normalizeTypeBalls(stock) {
  stock.typeBalls = Array.from({ length: 18 }, (_, i) =>
    Number.isSafeInteger(stock.typeBalls?.[i]) && stock.typeBalls[i] >= 0 ? stock.typeBalls[i] : 0,
  );
  const valid = {};
  if (
    stock.kurtHouses &&
    typeof stock.kurtHouses === 'object' &&
    !Array.isArray(stock.kurtHouses)
  ) {
    for (const [key, value] of Object.entries(stock.kurtHouses)) {
      const colon = key.indexOf(':'),
        tour = Number(key.slice(0, colon)),
        id = key.slice(colon + 1);
      if (
        colon > 0 &&
        Number.isSafeInteger(tour) &&
        tour >= stock.tour - 1 &&
        tour <= stock.tour &&
        MAP_ORDER.includes(id) &&
        id !== 'safari-zone' &&
        typeof value === 'boolean'
      )
        valid[key] = value;
    }
  }
  stock.kurtHouses = valid;
}
function kurtVisitKey(stock) {
  return stock.tour + ':' + stock.mapId;
}
function kurtEligible(stock) {
  return (
    MAP_ORDER.includes(stock.mapId) &&
    stock.mapId !== 'safari-zone' &&
    (!MAPS[stock.mapId].squares || MAPS[stock.mapId].squares.includes('exchange'))
  );
}
function ensureKurtVisit(stock, rng = Math.random) {
  if (!kurtEligible(stock)) return;
  const key = kurtVisitKey(stock);
  if (!Object.hasOwn(stock.kurtHouses, key)) stock.kurtHouses[key] = rng() < KURT_CONFIG.rate;
  for (const saved of Object.keys(stock.kurtHouses))
    if (Number(saved.split(':')[0]) < stock.tour - 1) delete stock.kurtHouses[saved];
}
function isKurtHouse(stock) {
  return (
    kurtEligible(stock) &&
    (globalThis.PokekoroDebug?.forceKurtHouse?.() ||
      stock.kurtHouses?.[kurtVisitKey(stock)] === true)
  );
}
function captureBallStock(ball, stock) {
  return Number.isInteger(ball.typeIndex) ? stock.typeBalls[ball.typeIndex] : stock[ball.key];
}
function typeBallMatches(ball, mon) {
  return Number.isInteger(ball.typeIndex) && pokemonTypes(mon).includes(ball.typeIndex);
}
function ballCatchChance(ball, base, mon) {
  const match = typeBallMatches(ball, mon),
    typed = Number.isInteger(ball.typeIndex);
  return Math.min(
    typed ? (match ? KURT_CONFIG.matchCap : 0.8) : ball.cap,
    Math.max(0, base) + (typed ? (match ? KURT_CONFIG.matchBonus : 0) : ball.bonus),
  );
}
function ownedTypeBalls(stock) {
  return TYPE_BALLS.filter((ball) => captureBallStock(ball, stock) > 0);
}
function typeBallTradeQuote(stock, type, quantity) {
  if (
    !Number.isInteger(type) ||
    type < 0 ||
    type >= 18 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  )
    return null;
  const cost = quantity * KURT_CONFIG.cost,
    count = stock.typeBalls[type];
  if (
    !Number.isSafeInteger(cost) ||
    !Number.isSafeInteger(stock.balls) ||
    stock.balls < cost ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    !Number.isSafeInteger(count + quantity)
  )
    return null;
  return { cost, quantity, type, balls: stock.balls - cost, typeStock: count + quantity };
}
