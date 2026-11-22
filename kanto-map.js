'use strict';
// 地理と攻略順を分離。位置はユーザー提供のカントー全図を基準にする。
const KANTO_PLACES = Object.freeze([
  {
    id: 'indigo',
    name: 'セキエイ高原',
    x: 14,
    y: 12,
    maps: ['indigo-lorelei', 'indigo-bruno', 'indigo-agatha', 'indigo-lance', 'indigo-champion'],
  },
  { id: 'pewter', name: 'ニビシティ', x: 26, y: 20, maps: ['pewter-city', 'pewter-gym'] },
  { id: 'moon', name: 'おつきみやま', x: 45, y: 20, maps: ['mt-moon'] },
  {
    id: 'cerulean',
    name: 'ハナダシティ',
    x: 66,
    y: 20,
    maps: ['cerulean-city', 'cerulean-gym', 'cerulean-cave'],
  },
  { id: 'forest', name: 'トキワの森', x: 26, y: 35, maps: ['viridian'] },
  { id: 'viridian-city', name: 'トキワシティ', x: 26, y: 51, maps: ['viridian-gym'] },
  { id: 'pallet', name: 'マサラタウン', x: 26, y: 73, maps: [] },
  {
    id: 'celadon',
    name: 'タマムシシティ',
    x: 48,
    y: 40,
    maps: ['celadon-city', 'celadon-gym', 'rocket-hideout'],
  },
  { id: 'saffron', name: 'ヤマブキシティ', x: 66, y: 40, maps: ['silph-co', 'saffron-gym'] },
  { id: 'lavender', name: 'シオンタウン', x: 88, y: 40, maps: ['pokemon-tower'] },
  { id: 'rock', name: 'イワヤマトンネル', x: 88, y: 20, maps: ['rock-tunnel'] },
  {
    id: 'vermilion',
    name: 'クチバシティ',
    x: 66,
    y: 59,
    maps: ['ss-anne', 'vermilion-gym', 'diglett-cave'],
  },
  { id: 'fuchsia', name: 'セキチクシティ', x: 60, y: 78, maps: ['safari-zone', 'fuchsia-gym'] },
  { id: 'cinnabar', name: 'グレンタウン', x: 26, y: 93, maps: ['pokemon-mansion', 'cinnabar-gym'] },
  { id: 'seafoam', name: 'ふたごじま', x: 45, y: 93, maps: ['seafoam-islands'] },
  { id: 'route23', name: '23ばんどうろ', x: 14, y: 39, maps: ['route-23', 'victory-road'] },
]);
(() => {
  const host = document.createElement('section');
  host.id = 'kanto-map';
  host.setAttribute('aria-labelledby', 'kanto-heading');
  $('#journey-badges').before(host);
  let selected = null;
  const roads = [
    ['M260 730V510', '1'],
    ['M260 510V200', '2'],
    ['M260 200H450', '3'],
    ['M450 200H660', '4'],
    ['M660 200V400', '5'],
    ['M660 400V590', '6'],
    ['M480 400H660', '7'],
    ['M660 400H880', '8'],
    ['M660 200H880', '9'],
    ['M880 200V400', '10'],
    ['M660 590H880', '11'],
    ['M880 400V700', '12'],
    ['M880 700H760V780H600', '13・14・15'],
    ['M480 400H390V780H600', '16・17・18'],
    ['M600 780V930H450', '19・20'],
    ['M450 930H260V730', '20・21'],
    ['M260 510H140V120', '22・23'],
    ['M660 200V90H770', '24・25'],
  ];
  function render() {
    if (!selected)
      selected = KANTO_PLACES.find((p) => p.maps.includes(state.mapId))?.id || 'pallet';
    const place = KANTO_PLACES.find((p) => p.id === selected) || KANTO_PLACES[0];
    host.innerHTML = `<h3 id="kanto-heading">カントーの ぜんたいマップ</h3><p class="kanto-help">まちを タップして 行き先を えらぼう！</p><div class="kanto-chart"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><rect width="1000" height="1000" fill="#80cbe5"/><path d="M70 0H770L810 110 940 160 960 730 790 850 650 850 650 980H180V810L100 740Z" fill="#83bb69"/><path d="M320 530L550 480 600 620 520 700 330 700Z" fill="#80cbe5"/><path d="M80 60L200 30 210 150 90 210Z M340 60L590 30 580 130 360 150Z" fill="#699c58"/>${roads.map(([d]) => `<path d="${d}" fill="none" stroke="#e9d697" stroke-width="23" stroke-linejoin="round"/>`).join('')}<path d="M660 590H720V350H260" fill="none" stroke="#c6ad77" stroke-width="9" stroke-dasharray="12 12"/><text x="475" y="340">ディグダのあな</text><text x="735" y="155">24・25</text><text x="840" y="300">10</text><text x="690" y="300">5</text><text x="690" y="500">6</text><text x="600" y="390">7</text><text x="780" y="390">8</text><text x="760" y="190">9</text><text x="360" y="190">3</text><text x="560" y="190">4</text><text x="760" y="580">11</text><text x="900" y="580">12</text><text x="270" y="640">1</text><text x="360" y="640">17</text><text x="630" y="860">19</text><text x="540" y="920">20</text><text x="230" y="840">21</text></svg>${KANTO_PLACES.map(
      (p) => {
        const current = p.maps.includes(state.mapId),
          clear = p.maps.some((id) => state.clearedMaps.includes(id));
        return `<button type="button" data-kanto-place="${p.id}" style="left:${p.x}%;top:${p.y}%" class="kanto-pin ${current ? 'is-current' : ''} ${clear ? 'is-cleared' : ''}" aria-pressed="${p.id === selected}" aria-label="${p.name}${current ? '、いまここ' : ''}"><i aria-hidden="true">${current ? '●' : clear ? '✓' : '◆'}</i><span>${p.name}</span></button>`;
      },
    ).join(
      '',
    )}</div><p class="kanto-key">● いまここ　✓ クリアした場所　<span>道路の数字は ばんどうろ</span></p><div class="kanto-destinations" aria-live="polite"><h4>${place.name}</h4>${place.maps.length ? place.maps.map((id) => `<div><span>${MAPS[id].name}<small>${id === state.mapId ? '● いまここ' : state.clearedMaps.includes(id) ? '✓ クリア済み' : 'これから'}</small></span>${id === state.mapId ? '<button data-kanto-current>マップを みる</button>' : state.clearedMaps.includes(id) ? `<button data-revisit="${id}">ここへ 行く</button>` : '<span class="kanto-locked">クリア後に 移動できるよ</span>'}</div>`).join('') : '<p>ぼうけんの はじまりの まち</p>'}</div>`;
  }
  host.addEventListener('click', (e) => {
    const pin = e.target.closest('[data-kanto-place]');
    if (pin) {
      selected = pin.dataset.kantoPlace;
      render();
      host.querySelector(`[data-kanto-place="${selected}"]`).focus({ preventScroll: true });
    }
    if (e.target.closest('[data-kanto-current]')) showTab('map');
  });
  window.PokekoroKanto = Object.freeze({
    render,
    focusMap(id) {
      const place = KANTO_PLACES.find((p) => p.maps.includes(id));
      if (!place) return false;
      selected = place.id;
      showTab('journey');
      render();
      host.scrollIntoView({ block: 'start' });
      return true;
    },
  });
  render();
})();
