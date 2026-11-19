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
  const effectAnimations = new Set();
  const sound = (name, value) => window.PokekoroSfx?.play(name, value);
  function reset() {
    for (const animation of effectAnimations) animation.cancel();
    effectAnimations.clear();
    document
      .querySelectorAll('.enemy-counter-effect,.enemy-skill-effect')
      .forEach((node) => node.remove());
    for (const t of timers) clearTimeout(t);
    timers.clear();
    highestCombo = highestCharge = 0;
    dialog.querySelectorAll('.battle-reward-fx,#battle-power-tag').forEach((e) => e.remove());
    dialog.classList.remove('enemy-defeated', 'power-breakthrough', 'trainer-complete');
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
  function combo(count, damage, effectiveness, cells, type, safari) {
    const tier = count >= 8 ? 3 : count >= 5 ? 2 : count >= 3 ? 1 : 0;
    dialog.dataset.comboTier = tier;
    const effect = !safari && effectiveness !== 1 ? typeEffectivenessLabel(effectiveness) : '';
    const tip = document.querySelector('#puzzle-tip');
    tip.textContent = safari
      ? 'つづけて消して なかよく なろう！'
      : effect
        ? effect + (effectiveness === 0 ? ' 別の属性で つなごう！' : '')
        : count >= 3
          ? 'そのちょうし！ つづけて つなごう！'
          : cells >= 7
            ? 'ながく つなぐと パワーアップ！'
            : tip.textContent;
    if (tier > highestCombo) {
      highestCombo = tier;
      sound('comboRise', tier);
    }
    // 加算値は既存の #combo に表示済み。盤面を覆う追従文字は出さない。
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
  function defeat(tier, complete = false) {
    dialog.classList.add('enemy-defeated');
    dialog.classList.toggle('trainer-complete', complete);
    burst(document.querySelector('.enemy'), complete || tier >= 3 ? 24 : 16, '#ffdb63', true);
    sound('knockout', tier);
  }
  // 反撃中だけの見た目。既存transformを壊さず、キャンセル時も待機を解放する。
  function effectAnimate(node, frames, duration) {
    if (!node?.animate) return Promise.resolve();
    const animation = node.animate(frames, { duration, easing: 'ease-out' });
    effectAnimations.add(animation);
    return animation.finished.catch(() => {}).finally(() => effectAnimations.delete(animation));
  }
  function counterWindup(host = dialog, enemy = host.querySelector('#enemyimg')) {
    if (!host.open || !enemy || motion.matches) return;
    void effectAnimate(
      enemy,
      [
        { translate: '0 0', scale: '1' },
        { translate: '0 -7px', scale: '1.05', offset: 0.55 },
        { translate: '0 8px', scale: '1' },
      ],
      220,
    );
  }
  async function counterHit(
    target,
    blocked,
    host = dialog,
    enemy = host.querySelector('#enemyimg'),
  ) {
    if (!host.open || !target || !enemy) return;
    const bounds = host.getBoundingClientRect();
    const center = (node) => {
      const r = node.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - bounds.left + host.scrollLeft - host.clientLeft,
        y: r.top + r.height / 2 - bounds.top + host.scrollTop - host.clientTop,
      };
    };
    const from = center(enemy),
      to = center(target);
    const effect = document.createElement('i');
    effect.className = 'enemy-counter-effect' + (blocked ? ' is-guard' : '');
    effect.setAttribute('aria-hidden', 'true');
    effect.style.left = to.x + 'px';
    effect.style.top = to.y + 'px';
    host.append(effect);
    try {
      // 動きを減らす設定では弾を飛ばさず、対象の短い発光だけにする。
      await effectAnimate(
        effect,
        motion.matches
          ? [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }]
          : [
              {
                translate: from.x - to.x + 'px ' + (from.y - to.y) + 'px',
                scale: '0.5',
                opacity: 0,
              },
              { opacity: 1, offset: 0.15 },
              { translate: '0 0', scale: blocked ? '2.5' : '1.8', opacity: 1 },
            ],
        motion.matches ? 90 : 280,
      );
    } finally {
      effect.remove();
    }
  }
  // 技の計算結果を見せるだけの共通演出。対象DOMは毎回描画後に渡す。
  async function skillEffect({
    category,
    type,
    source,
    targets = [],
    host = dialog,
    enemy = host.querySelector('#enemyimg'),
    board = host.querySelector('#board'),
    changed = [],
  }) {
    if (!host.open || !source) return;
    const color =
      category === 'revive'
        ? '#76cf9c'
        : category === 'guard'
          ? '#74d6f2'
          : category === 'boost'
            ? '#ffd267'
            : category === 'support'
              ? '#c19af7'
              : POKEMON_TYPE_COLORS[type] || '#fff2a6';
    const point = (target) => {
      const r = target.getBoundingClientRect(),
        h = host.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - h.left + host.scrollLeft - host.clientLeft,
        y: r.top + r.height / 2 - h.top + host.scrollTop - host.clientTop,
      };
    };
    const make = (target, kind) => {
      const node = document.createElement('i'),
        p = point(target);
      node.className = 'enemy-skill-effect ' + kind;
      node.setAttribute('aria-hidden', 'true');
      node.style.left = p.x + 'px';
      node.style.top = p.y + 'px';
      node.style.setProperty('--skill-color', color);
      host.append(node);
      return node;
    };
    const play = async (node, frames, ms) => {
      try {
        await effectAnimate(
          node,
          motion.matches ? [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }] : frames,
          motion.matches ? 90 : ms,
        );
      } finally {
        node.remove();
      }
    };
    const pulse = (target, kind = 'skill-ring') =>
      play(
        make(target, kind),
        [
          { scale: '0.6', opacity: 0 },
          { scale: '1', opacity: 1, offset: 0.35 },
          { scale: '1.5', opacity: 0 },
        ],
        360,
      );
    const fly = async (target) => {
      const a = point(source),
        b = point(target);
      await play(
        make(target, 'skill-orb'),
        [
          { translate: a.x - b.x + 'px ' + (a.y - b.y) + 'px', scale: '0.5', opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { translate: '0 0', scale: '1.2', opacity: 1 },
        ],
        300,
      );
    };
    await pulse(source, 'skill-cast');
    // 撤退・交代のresetでキャンセルされた古い演出は続けない。
    if (!host.open || !source.isConnected) return;
    if (category === 'attack' && enemy) {
      await fly(enemy);
      if (host.open && source.isConnected) await pulse(enemy, 'skill-impact');
    } else if (category === 'guard') {
      await Promise.all(
        (targets.length ? targets : [source]).map((target) => pulse(target, 'skill-shield')),
      );
    } else if (category === 'boost') {
      await Promise.all(
        (targets.length ? targets : [source]).map((target) =>
          play(
            make(target, 'skill-rise'),
            [
              { translate: '0 10px', opacity: 0 },
              { translate: '0 -2px', opacity: 1, offset: 0.4 },
              { translate: '0 -18px', opacity: 0 },
            ],
            380,
          ),
        ),
      );
    } else if (category === 'support') {
      await Promise.all(
        targets.map(async (target) => {
          await fly(target);
          if (host.open && source.isConnected) await pulse(target);
        }),
      );
    } else if (category === 'revive') {
      await Promise.all(
        targets.map(async (target) => {
          const glow = pulse(target, 'skill-revive');
          await effectAnimate(
            target,
            motion.matches
              ? [{ opacity: 0.4 }, { opacity: 1 }]
              : [
                  { opacity: 0.3, translate: '0 7px' },
                  { opacity: 1, translate: '0 0' },
                ],
            motion.matches ? 90 : 380,
          );
          await glow;
        }),
      );
    } else if (category === 'board' && board) {
      const r = board.getBoundingClientRect(),
        h = host.getBoundingClientRect();
      await Promise.all(
        changed.map((index) => {
          const node = make(board, 'skill-cell');
          node.style.width = r.width / 6 - 4 + 'px';
          node.style.height = r.height / 5 - 4 + 'px';
          node.style.left =
            r.left -
            h.left +
            host.scrollLeft -
            host.clientLeft +
            (((index % 6) + 0.5) * r.width) / 6 +
            'px';
          node.style.top =
            r.top -
            h.top +
            host.scrollTop -
            host.clientTop +
            ((Math.floor(index / 6) + 0.5) * r.height) / 5 +
            'px';
          return play(
            node,
            [
              { scale: '0.75', opacity: 0 },
              { scale: '1', opacity: 1, offset: 0.4 },
              { scale: '1.05', opacity: 0 },
            ],
            400,
          );
        }),
      );
    }
  }
  document.addEventListener('title:start', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      dialog.querySelectorAll('.battle-reward-fx').forEach((e) => e.remove());
    }
  });
  window.PokekoroBattleFX = Object.freeze({
    reset,
    combo,
    charge,
    prepare,
    impact,
    defeat,
    counterWindup,
    counterHit,
    skill: skillEffect,
  });
})();
