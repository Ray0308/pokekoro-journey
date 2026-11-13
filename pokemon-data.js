'use strict';
// 全国図鑑番号はセーブのキー。画像は全種の公式アートを使い、未登録の名前・属性は推測しない。
const POKEDEX_SIZE = 1025;
const POKEMON_OVERRIDES = Object.freeze({
  1: {
    name: 'フシギダネ',
    type: 0,
    types: [0, 3],
    power: 11,
    description: '生まれて しばらくの あいだ 背中の タネに つまった 栄養を とって 育つ。',
  },
  2: { name: 'フシギソウ', type: 0, types: [0, 3], power: 14 },
  3: { name: 'フシギバナ', type: 0, types: [0, 3], power: 17 },
  4: { name: 'ヒトカゲ', type: 1, power: 11 },
  5: { name: 'リザード', type: 1, power: 14 },
  6: { name: 'リザードン', type: 1, types: [1, 4], power: 17 },
  7: { name: 'ゼニガメ', type: 2, power: 11 },
  8: { name: 'カメール', type: 2, power: 14 },
  9: { name: 'カメックス', type: 2, power: 17 },
});
function validPokemonId(id) {
  return Number.isInteger(id) && id >= 1 && id <= POKEDEX_SIZE;
}
function pokemonNumber(id) {
  return String(id).padStart(4, '0');
}
const POKEDEX = Object.freeze(
  Array.from({ length: POKEDEX_SIZE }, (_, i) => {
    const id = i + 1,
      known = POKEMON_OVERRIDES[id];
    return Object.freeze({
      id,
      description: known?.description ?? null,
      name: known?.name ?? null,
      label: known?.name ?? `No.${pokemonNumber(id)}`,
      type: known?.type ?? null,
      types: Object.freeze(known?.types ?? (Number.isInteger(known?.type) ? [known.type] : [])),
      power: known?.power ?? 11,
      image: known?.image ?? `assets/pokemon/official-artwork/${id}.svg`,
      portrait: known?.portrait ?? `assets/pokemon/official-artwork/${id}.svg`,
      placeholder: !known?.name,
    });
  }),
);
const numberArtCache = new Map();
function numberedPokemonArt(id) {
  if (!validPokemonId(id)) return '';
  if (!numberArtCache.has(id))
    numberArtCache.set(
      id,
      'data:image/svg+xml,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="77" fill="none" stroke="#a8bdc5" stroke-width="5" stroke-dasharray="5 7"/><path d="M28 100h144" stroke="#d4e0e3" stroke-width="2"/><rect x="25" y="77" width="150" height="46" rx="15" fill="#edf4f5"/><text x="100" y="108" text-anchor="middle" fill="#3e6572" font-family="sans-serif" font-size="29" font-weight="bold">No.${pokemonNumber(id)}</text></svg>`,
        ),
    );
  return numberArtCache.get(id);
}
function pokemonImage(id) {
  return validPokemonId(id) ? POKEDEX[id - 1].image || numberedPokemonArt(id) : '';
}
function pokemonPortrait(id) {
  return validPokemonId(id) ? POKEDEX[id - 1].portrait || numberedPokemonArt(id) : '';
}
// errorはバブルしないため捕捉段階で処理する。再描画された画像にも適用し、再試行のループを防ぐ。
if (typeof document !== 'undefined') {
  document.addEventListener(
    'error',
    (event) => {
      const image = event.target;
      if (image?.tagName !== 'IMG') return;
      const match = image
        .getAttribute('src')
        ?.match(/(?:^|\/)assets\/pokemon\/official-artwork\/(\d+)\.svg$/);
      if (match && validPokemonId(Number(match[1])))
        image.src = numberedPokemonArt(Number(match[1]));
    },
    true,
  );
}
