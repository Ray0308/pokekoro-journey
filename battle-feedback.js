'use strict';
// 見た目とSEだけを担当する。ダメージ計算や報酬条件は変更しない。
// Presentation only: charge, damage, encounter rules and rewards stay in app.js.
(() => {
  const dialog = document.querySelector('#battle'),
    motion = matchMedia('(prefers-reduced-motion: reduce)');
  let timers = new Set(),
    highestCombo = 0,
    highestCharge = 0;
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const sound = (name, value) => window.PokekoroSfx?.play(name, value);
  function reset() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
    highestCombo = highestCharge = 0;
    dialog
      .querySelectorAll('.battle-reward-fx,.power-note,#battle-power-tag')
      .forEach((e) => e.remove());
    dialog.classList.remove('enemy-defeated', 'power-breakthrough');
    delete dialog.dataset.attackTier;
    delete dialog.dataset.comboTier;
    for (const key of ['--attack-color', '--attack-size', '--impact-scale'])
      dialog.style.removeProperty(key);
    const image = document.querySelector('#enemyimg');
    image.getAnimations().forEach((a) => a.cancel());
  }
  function burst(target, count, color, celebrate = false) {
    if (motion.matches) return;
    const bounds = dialog.getBoundingClientRect(),
      rect = target.getBoundingClientRect(),
      layer = document.createElement('div');
    layer.className = 'battle-reward-fx';
    layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i'),
        angle = (i / count) * Math.PI * 2,
        reach = celebrate ? 70 + (i % 4) * 16 : 42 + (i % 3) * 19;
      p.className = celebrate ? 'victory-spark' : 'impact-spark';
      p.style.cssText = `left:${rect.left - bounds.left + rect.width / 2}px;top:${rect.top - bounds.top + rect.height / 2}px;--dx:${Math.cos(angle) * reach}px;--dy:${Math.sin(angle) * reach}px;--spark:${color};--turn:${i * 53}deg;animation-delay:${(i % 3) * 20}ms`;
      layer.append(p);
    }
    dialog.append(layer);
    later(() => layer.remove(), 1000);
  }
  function combo(count, damage, weak, cells, type, safari) {
    const tier = count >= 8 ? 3 : count >= 5 ? 2 : count >= 3 ? 1 : 0;
    dialog.dataset.comboTier = tier;
    const callout = document.querySelector('#callout'),
      word =
        count >= 8
          ? 'とまらない！！'
          : count >= 5
            ? 'すごすぎ！！'
            : count >= 3
              ? 'いいちょうし！'
              : cells >= 7
                ? 'ロングチェイン！'
                : 'ナイス！';
    callout.innerHTML = `<strong>${count}<small> コンボ！</small></strong><span>${word}</span>`;
    const tip = document.querySelector('#puzzle-tip');
    tip.textContent = safari
      ? 'つづけて消して なかよく なろう！'
      : weak
        ? 'こうかばつぐん！ たくさん たまった！'
        : count >= 3
          ? 'そのちょうし！ つづけて つなごう！'
          : cells >= 7
            ? 'ながく つなぐと パワーアップ！'
            : tip.textContent;
    if (tier > highestCombo) {
      highestCombo = tier;
      sound('comboRise', tier);
    }
    dialog.querySelectorAll('.power-note').forEach((e) => e.remove());
    const note = document.createElement('b');
    note.className = 'power-note';
    note.style.setProperty('--spark', POKEMON_TYPE_COLORS[type]);
    note.textContent = '＋' + damage.toLocaleString();
    document.querySelector('.puzzle-stage').append(note);
    later(() => note.remove(), 650);
  }
  function charge(value, total, safari, charging) {
    const ratio = value / total,
      tier = ratio >= 1.6 ? 3 : ratio >= 1 ? 2 : ratio >= 0.5 ? 1 : 0;
    let tag = document.querySelector('#battle-power-tag');
    if (!tag) {
      tag = document.createElement('span');
      tag.id = 'battle-power-tag';
      document
        .querySelector('.attack-charge>div')
        .insertBefore(tag, document.querySelector('#charge-value'));
    }
    tag.textContent = safari
      ? ratio >= 1
        ? 'なかよし！'
        : ''
      : ['チャージ中', 'あとすこし！', '撃破パワー！', 'オーバーパワー！'][tier];
    tag.dataset.tier = tier;
    if (!safari && charging && tier >= 2 && tier > highestCharge) {
      highestCharge = tier;
      dialog.classList.remove('power-breakthrough');
      void dialog.offsetWidth;
      dialog.classList.add('power-breakthrough');
      sound('breakthrough', tier);
      later(() => dialog.classList.remove('power-breakthrough'), 700);
    }
  }
  function prepare(damage, total, type) {
    const ratio = damage / total,
      tier = ratio >= 1.6 ? 3 : ratio >= 1 ? 2 : ratio >= 0.5 ? 1 : 0;
    dialog.dataset.attackTier = tier;
    dialog.style.setProperty('--attack-color', POKEMON_TYPE_COLORS[type] || '#ffd557');
    dialog.style.setProperty('--attack-size', [0.7, 1, 1.25, 1.5][tier]);
    dialog.style.setProperty('--impact-scale', [0.8, 1, 1.25, 1.5][tier]);
    return tier;
  }
  function impact(tier) {
    burst(
      document.querySelector('.enemy'),
      [8, 12, 18, 24][tier],
      getComputedStyle(dialog).getPropertyValue('--attack-color'),
    );
    sound('impact', tier);
  }
  function defeat(tier) {
    dialog.classList.add('enemy-defeated');
    burst(document.querySelector('.enemy'), tier >= 3 ? 24 : 16, '#ffdb63', true);
    sound('knockout', tier);
  }
  document.addEventListener('title:start', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      dialog.querySelectorAll('.battle-reward-fx,.power-note').forEach((e) => e.remove());
    }
  });
  window.PokekoroBattleFX = Object.freeze({ reset, combo, charge, prepare, impact, defeat });
})();
