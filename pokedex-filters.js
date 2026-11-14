'use strict';
// 図鑑とパーティーで共有する純粋な検索処理。所持・遭遇の判定を検索より先に行う。
const PokekoroDexFilter = (() => {
  const small = 'ぁぃぅぇぉっゃゅょゎゕゖ',
    large = 'あいうえおつやゆよわかけ';
  function normalizeName(name) {
    return String(name ?? '')
      .normalize('NFKC')
      .replace(/[ァ-ヶ]/gu, (letter) => String.fromCharCode(letter.charCodeAt(0) - 0x60))
      .normalize('NFD')
      .replace(/[\u3099\u309a\s]/gu, '')
      .replace(/[ぁぃぅぇぉっゃゅょゎゕゖ]/gu, (letter) => large[small.indexOf(letter)]);
  }
  function filter(entries, { name = '', type = null, owned = [], seen = [], picking = false }) {
    const ownedIds = new Set(owned),
      seenIds = new Set([...seen, ...owned]),
      query = normalizeName(name),
      active = !!query || type !== null;
    return entries.filter((mon) => {
      // 未遭遇の名前やタイプを、検索結果や件数から先に明かさない。
      if (picking ? !ownedIds.has(mon.id) : active && !seenIds.has(mon.id)) return false;
      return (
        (!query || normalizeName(mon.name).startsWith(query)) &&
        (type === null || pokemonTypes(mon).includes(type))
      );
    });
  }
  return Object.freeze({ normalizeName, filter });
})();
