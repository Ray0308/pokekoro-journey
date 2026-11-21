'use strict';
// 見た目とSEだけを担当する。ダメージ計算や報酬条件は変更しない。
// Presentation only: charge, damage, encounter rules and rewards stay in app.js.
(() => {
  const dialog = document.querySelector('#battle'),
    motion = matchMedia('(prefers-reduced-motion: reduce)');
  let generation = 0;
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
    generation++;
    document.querySelector('#battle-turn-status')?.classList.remove('is-action');
    for (const animation of effectAnimations) animation.cancel();
    effectAnimations.clear();
    document
      .querySelectorAll(
        '.enemy-counter-effect,.enemy-skill-effect,.battle-hit-ring,.battle-type-particle,.battle-effect-label',
      )
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
  const TYPE_KINDS = [
    'leaf',
    'flame',
    'drop',
    'poison',
    'wind',
    'impact',
    'bolt',
    'ice',
    'fist',
    'ground',
    'psychic',
    'bug',
    'rock',
    'ghost',
    'dragon',
    'dark',
    'metal',
    'star',
  ];
  const typeKind = (type) => TYPE_KINDS[type] || 'impact';
  function pointAt(target, host = dialog) {
    const r = target.getBoundingClientRect(),
      h = host.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - h.left + host.scrollLeft - host.clientLeft,
      y: r.top + r.height / 2 - h.top + host.scrollTop - host.clientTop,
    };
  }
  function effectNode(target, className, color, host = dialog) {
    const n = document.createElement('i'),
      p = pointAt(target, host);
    n.className = className;
    n.setAttribute('aria-hidden', 'true');
    n.style.left = p.x + 'px';
    n.style.top = p.y + 'px';
    n.style.setProperty('--skill-color', color);
    n.style.setProperty('--counter-color', color);
    host.append(n);
    return n;
  }
  async function transient(node, frames, ms, readable = false) {
    try {
      await effectAnimate(
        node,
        motion.matches
          ? readable
            ? [{ opacity: 1 }, { opacity: 1 }]
            : [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }]
          : frames,
        motion.matches && !readable ? 120 : ms,
      );
    } finally {
      node.remove();
    }
  }
  function announce(text, color) {
    const line = document.querySelector('#battle-turn-status');
    if (!line || line.hidden) return;
    line.classList.add('is-action');
    line.style.setProperty('--action-color', color);
    line.textContent = text;
  }
  function label(target, text, color, host = dialog) {
    const node = effectNode(target, 'battle-effect-label', color, host);
    node.textContent = text;
    // 長い名前や画面端の仲間でも、文字をdialog内に収める。
    const p = pointAt(target, host),
      half = Math.min(68, host.clientWidth / 2 - 8);
    node.style.left = Math.max(half, Math.min(host.clientWidth - half, p.x)) + 'px';
    return transient(
      node,
      [
        { translate: '0 5px', opacity: 0 },
        { translate: '0 -8px', opacity: 1, offset: 0.2 },
        { translate: '0 -13px', opacity: 1, offset: 0.8 },
        { translate: '0 -18px', opacity: 0 },
      ],
      520,
      true,
    );
  }
  function typedImpact(target, type, host = dialog, blocked = false) {
    const color = blocked ? '#56b7da' : POKEMON_TYPE_COLORS[type] || '#efd188';
    const ring = effectNode(target, 'battle-hit-ring' + (blocked ? ' is-guard' : ''), color, host);
    ring.dataset.kind = typeKind(type);
    const tasks = [
      transient(
        ring,
        [
          { scale: '.4', opacity: 0 },
          { scale: '1', opacity: 1, offset: 0.25 },
          { scale: blocked ? '1.2' : '1.6', opacity: 0 },
        ],
        240,
      ),
    ];
    if (!motion.matches && !blocked)
      for (let i = 0; i < 6; i++) {
        const n = effectNode(target, 'battle-type-particle', color, host),
          angle = (i / 6) * Math.PI * 2;
        n.dataset.kind = typeKind(type);
        tasks.push(
          transient(
            n,
            [
              { translate: '0 0', scale: '.7', opacity: 1 },
              {
                translate: Math.cos(angle) * 35 + 'px ' + Math.sin(angle) * 27 + 'px',
                scale: '.4',
                rotate: i * 55 + 'deg',
                opacity: 0,
              },
            ],
            250,
          ),
        );
      }
    return Promise.all(tasks);
  }
  async function typedFlight(source, target, type, host = dialog) {
    if (!host.open || !source?.isConnected || !target?.isConnected) return;
    const a = pointAt(source, host),
      b = pointAt(target, host),
      color = POKEMON_TYPE_COLORS[type] || '#efd188';
    const node = effectNode(target, 'enemy-counter-effect is-attack', color, host);
    node.dataset.type = String(type);
    node.dataset.kind = typeKind(type);
    const cell = TYPE_SYMBOL_CELLS[type] ?? TYPE_SYMBOL_CELLS[5],
      symbol = document.createElement('b');
    symbol.className = 'counter-symbol';
    symbol.style.backgroundPosition = `${((cell % 6) / 5) * 100}% ${(Math.floor(cell / 6) / 2) * 100}%`;
    node.append(symbol);
    node.style.setProperty(
      '--shot-angle',
      (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 'deg',
    );
    await transient(
      node,
      [
        { translate: a.x - b.x + 'px ' + (a.y - b.y) + 'px', scale: '.7', opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { translate: '0 0', scale: '1.25', opacity: 1 },
      ],
      300,
    );
  }
  async function groupAttack(sources = [], type = 5, damage = 0) {
    const token = generation,
      enemy = dialog.querySelector('#enemyimg');
    if (!dialog.open || !enemy) return;
    const color = POKEMON_TYPE_COLORS[type] || '#efd188';
    announce(damage > 0 ? 'みんなで アタック！' : '攻撃パワーが たまっていない！', color);
    if (damage <= 0) return;
    await Promise.all(
      sources.map(({ node }) =>
        effectAnimate(node, [{ scale: '1' }, { scale: '1.09', offset: 0.5 }, { scale: '1' }], 160),
      ),
    );
    if (token !== generation || !dialog.open) return;
    await Promise.all(
      (sources.length ? sources : [{ node: document.querySelector('.attack-charge'), type }]).map(
        ({ node, type: t }) => typedFlight(node, enemy, t ?? type),
      ),
    );
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
    type = 5,
  ) {
    if (!host.open || !target || !enemy) return;
    const token = generation;
    const bounds = host.getBoundingClientRect();
    const center = (node) => {
      const r = node.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - bounds.left + host.scrollLeft - host.clientLeft,
        y: r.top + r.height / 2 - bounds.top + host.scrollTop - host.clientTop,
      };
    };
    if (host === dialog)
      announce(
        `${POKEMON_TYPE_NAMES[type] || ''}の反撃 → ${blocked ? 'みんなをガード' : POKEDEX[Number(target.dataset.battleMember) - 1]?.label || '仲間'}`,
        POKEMON_TYPE_COLORS[type],
      );
    const from = center(enemy),
      to = center(target);
    const effect = document.createElement('i');
    effect.className = 'enemy-counter-effect' + (blocked ? ' is-guard' : '');
    const kind = typeKind(type);
    effect.dataset.kind = kind;
    effect.dataset.type = String(type);
    effect.style.setProperty('--counter-color', POKEMON_TYPE_COLORS[type] || '#ffd76b');
    const symbol = document.createElement('b'),
      cell = TYPE_SYMBOL_CELLS[type] ?? TYPE_SYMBOL_CELLS[5];
    symbol.className = 'counter-symbol';
    symbol.style.backgroundPosition = `${((cell % 6) / 5) * 100}% ${(Math.floor(cell / 6) / 2) * 100}%`;
    effect.append(symbol);
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
              {
                translate: `${(from.x - to.x) * 0.5}px ${(from.y - to.y) * 0.5 - (kind === 'drop' || kind === 'leaf' ? 26 : 0)}px`,
                rotate:
                  kind === 'rock' || kind === 'metal'
                    ? '160deg'
                    : kind === 'bolt'
                      ? '-15deg'
                      : '0deg',
                opacity: 1,
                offset: 0.5,
              },
              { translate: '0 0', rotate: '0deg', scale: blocked ? '2.5' : '1.8', opacity: 1 },
            ],
        motion.matches ? 90 : 280,
      );
      effect.remove();
      if (token === generation && host.open && target.isConnected) {
        await Promise.all([
          typedImpact(target, type, host, blocked),
          label(
            target,
            blocked ? 'ガード！' : '命中！',
            blocked ? '#3693b9' : POKEMON_TYPE_COLORS[type],
            host,
          ),
        ]);
      }
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
    name = '',
    actor = '',
    damage = 0,
    amount = 0,
    multiplier = 1,
    onImpact = () => {},
  }) {
    if (!host.open || !source) return;
    const token = generation;
    const valid = () => token === generation && host.open && source.isConnected;
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
    if (host === dialog)
      announce(
        `${actor ? actor + 'の ' : ''}${name || PokemonSkillRules.categoryNames[category]}！`,
        color,
      );
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
      node.dataset.category = category;
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
      if (category === 'attack') return typedFlight(source, target, type, host);
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
    if (!valid()) return;
    if (category === 'attack' && enemy) {
      await fly(enemy);
      if (valid()) {
        onImpact();
        await Promise.all([
          typedImpact(enemy, type, host),
          label(enemy, damage > 0 ? '-' + damage.toLocaleString() : 'こうかなし', color, host),
        ]);
      }
    } else if (category === 'guard') {
      await Promise.all([
        label(host.querySelector('#battle-party') || source, 'ガード待機', color, host),
        ...(targets.length ? targets : [source]).map((target) => pulse(target, 'skill-shield')),
      ]);
    } else if (category === 'boost') {
      await Promise.all([
        label(host.querySelector('#battle-party') || source, `次の攻撃×${multiplier}`, color, host),
        ...(targets.length ? targets : [source]).map((target) =>
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
      ]);
    } else if (category === 'support') {
      await Promise.all(
        targets.map(async (target, index) => {
          await fly(target);
          if (valid())
            await Promise.all([
              pulse(target),
              index === 0
                ? label(
                    targets.length > 1 ? host.querySelector('#battle-party') || target : target,
                    `ゲージ＋${amount}`,
                    color,
                    host,
                  )
                : Promise.resolve(),
            ]);
        }),
      );
    } else if (category === 'revive') {
      await Promise.all(
        targets.map(async (target) => {
          const glow = Promise.all([
            pulse(target, 'skill-revive'),
            label(target, 'ふっかつ！', color, host),
          ]);
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
    groupAttack,
    damage: (value, type = 5) => {
      if (dialog.open) {
        void typedImpact(dialog.querySelector('#enemyimg'), type);
        void label(
          dialog.querySelector('#enemyimg'),
          value > 0 ? '-' + value.toLocaleString() : 'パワーなし',
          POKEMON_TYPE_COLORS[type],
        );
      }
    },
  });
})();
