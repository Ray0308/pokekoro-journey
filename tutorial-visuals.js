'use strict';
// 操作対象だけを明るくする視覚案内。入力を遮らず、実際の成功で既存の課題が進む。
(() => {
  let current = null;
  function hide() {
    current?.layer.remove();
    current = null;
  }
  function place() {
    if (!current) return;
    const { target, region, hole, label } = current;
    if (!target.isConnected) return hide();
    const r = target.getBoundingClientRect();
    const box = region ? region(r) : r;
    Object.assign(hole.style, {
      left: box.left - 5 + 'px',
      top: box.top - 5 + 'px',
      width: box.width + 10 + 'px',
      height: box.height + 10 + 'px',
    });
    const w = Math.min(260, innerWidth - 24);
    Object.assign(label.style, {
      width: w + 'px',
      left: Math.max(12, Math.min(innerWidth - w - 12, box.left + box.width / 2 - w / 2)) + 'px',
      top:
        Math.max(
          12,
          Math.min(
            innerHeight - 64,
            box.bottom + 75 < innerHeight ? box.bottom + 14 : box.top - 62,
          ),
        ) + 'px',
    });
    label.dataset.side = box.bottom + 75 < innerHeight ? 'below' : 'above';
  }
  function show(host, target, words, region, trace = false) {
    hide();
    if (!target || !host) return;
    const layer = document.createElement('div');
    layer.className = 'tutorial-spotlight';
    layer.setAttribute('aria-hidden', 'true');
    const hole = document.createElement('div');
    hole.className = 'tutorial-hole';
    if (trace)
      hole.innerHTML =
        '<svg viewBox="0 0 300 100" preserveAspectRatio="none"><path d="M50 50 H250"/><circle cx="50" cy="50" r="35"/><circle cx="150" cy="50" r="35"/><circle cx="250" cy="50" r="35"/></svg><span class="tutorial-hand">☝</span>';
    const label = document.createElement('div');
    label.className = 'tutorial-cue';
    label.textContent = words;
    layer.append(hole, label);
    host.append(layer);
    current = { layer, hole, label, target, region };
    place();
  }
  window.addEventListener('resize', place);
  document.addEventListener('scroll', place, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hide();
  });
  function skillHero(
    mon,
    skill,
    gauge,
    { enemy, usable = true, used = false, fainted = false } = {},
  ) {
    const node = document.createElement('div');
    node.className = 'skill-hero';
    node.style.setProperty('--skill-color', POKEMON_TYPE_COLORS[mon.type]);
    const attack = skill.category === 'attack' && enemy;
    const cues = {
      guard: 'みんなを まもる！',
      boost: 'こうげきを つよく！',
      support: 'なかまを おうえん！',
      revive: 'なかまを げんきに！',
      board: 'ブロックを かえる！',
    };
    node.dataset.status = used ? 'used' : fainted ? 'fainted' : usable ? 'ready' : 'charging';
    node.innerHTML = `<div class="skill-picture"><figure class="skill-actor"><img src="${pokemonPortrait(mon.id)}" alt="${mon.label}"><figcaption>${mon.label}</figcaption></figure>${attack ? `<div class="skill-direction" aria-label="相手へ攻撃"><span>こうげき</span><b>➜</b></div><figure class="skill-recipient"><img src="${pokemonPortrait(enemy.id)}" alt="${enemy.label}"><figcaption>${enemy.label}</figcaption></figure>` : `<div class="skill-purpose"><b>${{ guard: '🛡', boost: '↑', support: '✦', revive: '♥', board: '▦' }[skill.category] || '★'}</b><span>${cues[skill.category] || 'わざを つかう！'}</span></div>`}</div><div class="skill-summary"><strong class="skill-status">${used ? '✓ このターンは つかったよ' : fainted ? 'ひんしで おやすみ中' : usable ? 'わざを つかえるよ！' : 'ゲージを ためよう！'}</strong><span>${POKEMON_TYPE_ICONS[mon.type]} ${POKEMON_TYPE_NAMES[mon.type]} · ${PokemonSkillRules.categoryNames[skill.category]}</span><div class="skill-gauge" role="progressbar" aria-label="わざゲージ" aria-valuemin="0" aria-valuenow="${gauge}" aria-valuemax="${skill.cost}"><i style="width:${Math.min(100, (gauge / skill.cost) * 100)}%"></i></div><small>${used ? 'つぎのターンに また ためよう' : `⚡ ${gauge} / ${skill.cost}`}</small></div>`;
    return node;
  }
  window.PokekoroTutorialVisuals = { show, hide, skillHero };
})();
