// VM内で実行する属性ボールの回帰テスト。ブラウザや音声APIへの依存はない。
const check = (v, m) => {
  if (!v) throw Error(m);
};
let old = { tour: 2, mapId: 'viridian', balls: 20, super: 2, hyper: 1, master: 3 };
normalizeTypeBalls(old);
check(old.typeBalls.length === 18 && old.typeBalls.every((v) => v === 0), 'legacy migration');
let malformed = {
  tour: 2,
  typeBalls: [4, -1, 1.5, Infinity],
  kurtHouses: { '2:viridian': true, '2:safari-zone': true, 'wrong': true },
};
normalizeTypeBalls(malformed);
check(
  malformed.typeBalls[0] === 4 &&
    malformed.typeBalls.slice(1).every((v) => v === 0) &&
    Object.keys(malformed.kurtHouses).length === 1,
  'invalid save',
);
let calls = 0;
ensureKurtVisit(old, () => {
  calls++;
  return 0.09;
});
for (let i = 0; i < 10; i++)
  ensureKurtVisit(old, () => {
    calls++;
    return 0.9;
  });
check(calls === 1 && isKurtHouse(old), 'stable house');
const reloaded = JSON.parse(JSON.stringify(old));
normalizeTypeBalls(reloaded);
ensureKurtVisit(reloaded, () => {
  throw Error('rerolled');
});
check(isKurtHouse(reloaded), 'reload');
let houses = 0;
for (let i = 1; i <= 1000; i++) {
  const s = { tour: i, mapId: 'viridian' };
  normalizeTypeBalls(s);
  ensureKurtVisit(s, () => ((i - 1) % 100) / 100);
  if (isKurtHouse(s)) houses++;
}
check(houses === 100, '10 percent threshold');
for (const id of ['safari-zone', 'rainbow-cloud']) {
  old.mapId = id;
  ensureKurtVisit(old, () => {
    throw Error('special map RNG');
  });
  check(!isKurtHouse(old), 'special exclusion');
}
old.mapId = 'viridian';
old.balls = 20;
for (let type = 0; type < 18; type++) {
  const q = typeBallTradeQuote(old, type, 2);
  check(q.cost === 10 && q.balls === 10 && q.typeStock === 2, 'all types quote');
}
for (const n of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER])
  check(typeBallTradeQuote(old, 0, n) === null, 'invalid trade');
check(typeBallTradeQuote(old, 18, 1) === null && old.balls === 20, 'no mutation');
const z = TYPE_BALLS[4],
  charizard = POKEDEX[5];
check(typeBallMatches(z, charizard), 'secondary match');
check(ballCatchChance(z, 0.4, charizard) === 0.8, 'match bonus');
check(ballCatchChance(TYPE_BALLS[2], 0.4, charizard) === 0.4, 'nonmatch');
check(ballCatchChance(z, 0.8, charizard) === 0.99, 'cap');
check(ballCatchChance(z, 0.4, POKEDEX[149]) === 0.4, 'psychic does not match flying');
check(ballCatchChance(z, 0.4, { types: [] }) === 0.4, 'unknown metadata');
check(ballCatchChance(z, 0.4, { types: [4, 4] }) === 0.8, 'bonus once');
