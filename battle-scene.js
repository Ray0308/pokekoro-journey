'use strict';
// 実在する属性だけをステータスに表示する。背景・足場は現在地の設定から組み立てる。
(() => {
  const scene = document.querySelector('#battle .enemy'),
    backdrop = document.querySelector('#battle-backdrop'),
    location = document.querySelector('#battle-location'),
    status = document.querySelector('.enemy-status'),
    types = document.querySelector('#enemy-types'),
    hpRow = document.querySelector('.enemy-hp-row'),
    ownedMark = document.querySelector('#enemy-owned');
  function update(battle, owned) {
    const list = pokemonTypes(battle.m);
    types.innerHTML = list.length
      ? list
          .map((type) => {
            const cell = TYPE_SYMBOL_CELLS[type];
            return `<span class="enemy-type" style="--enemy-type:${POKEMON_TYPE_COLORS[type]}"><i aria-hidden="true"><b style="background-position:${((cell % 6) / 5) * 100}% ${(Math.floor(cell / 6) / 2) * 100}%"></b></i>${POKEMON_TYPE_NAMES[type]}</span>`;
          })
          .join('')
      : '<span class="enemy-type-unknown">タイプ ？？？</span>';
    const roster = document.querySelector('#trainer-roster');
    roster.hidden = !battle.series;
    if (battle.series) {
      const { team, index } = battle.series;
      roster.setAttribute(
        'aria-label',
        `相手の手持ち${team.length}匹、残り${team.length - index}匹`,
      );
      roster.innerHTML =
        team
          .map(
            (_, i) =>
              `<i class="${i < index ? 'defeated' : i === index ? 'active' : ''}" aria-hidden="true"></i>`,
          )
          .join('') +
        `<small>${index === team.length - 1 ? 'きりふだ' : 'あと' + (team.length - index) + 'ひき'}</small>`;
    } else roster.replaceChildren();
    ownedMark.hidden = !owned.includes(battle.m.id);
    const ratio = Math.max(0, battle.hp / battle.total);
    status.dataset.hp = ratio <= 0.2 ? 'low' : ratio <= 0.5 ? 'mid' : 'high';
    hpRow.setAttribute('aria-valuemax', String(battle.total));
    hpRow.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(battle.hp))));
    document.querySelector('#hptext').textContent = battle.safari
      ? '倒さずに なかよく なろう！'
      : `${battle.level ? 'Lv.' + battle.level + ' · ' : ''}${Math.max(0, Math.ceil(battle.hp))} / ${battle.total}`;
  }
  function set(map, battle, owned) {
    backdrop.style.backgroundImage = `url("${map.background}")`;
    scene.style.setProperty('--battle-ground', map.colors.surface);
    scene.style.setProperty('--battle-platform', map.colors.surfaceEnd);
    scene.style.setProperty('--battle-platform-edge', map.colors.rim);
    scene.dataset.environment = map.kind;
    location.textContent = map.name;
    update(battle, owned);
  }
  window.PokekoroBattleScene = Object.freeze({ set, update });
})();
