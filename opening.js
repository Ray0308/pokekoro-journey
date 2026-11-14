'use strict';
// 初回だけの案内。練習は本編と同じ盤面・投球を使い、報酬処理には入れない。
(() => {
  const dialog = document.createElement('dialog');
  dialog.id = 'opening';
  dialog.setAttribute('aria-labelledby', 'opening-speaker');
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  document.body.append(dialog);
  let preview = null;
  let throwing = false;
  const pending = () => state.opening.stage !== 'complete' && !window.PokekoroDebug?.isActive?.();
  const stage = () => state.opening.stage;
  const portrait = (id, cls = '') =>
    `<img class="${cls}" src="${pokemonPortrait(id)}" alt="${mons[id - 1].label}">`;
  function move(next) {
    state.opening.stage = next;
    save();
    show();
  }
  function next() {
    move(OpeningRules.stages[OpeningRules.stages.indexOf(stage()) + 1]);
  }
  function show() {
    if (!pending()) return;
    busy = true;
    const current = stage();
    const [speaker, words] = OPENING_STORY[current];
    const forest = ['meet', 'friend'].includes(current);
    const dex = ['dex', 'register'].includes(current);
    dialog.dataset.scene = forest ? 'forest' : dex ? 'dex' : 'lab';
    const chosen = preview || state.opening.starterId;
    let scene = forest
      ? `${portrait(446, 'opening-companion')}<span class="opening-snack" aria-hidden="true">🍪</span>`
      : `<img class="opening-oak" src="assets/opening/oak.webp" alt="オーキド博士">`;
    if (['chosen', 'borrow', 'practice', 'caught'].includes(current))
      scene += portrait(
        current === 'borrow' || current === 'practice' ? 32 : current === 'caught' ? 25 : chosen,
        'opening-partner',
      );
    if (dex)
      scene = `<div class="opening-dex"><i></i><strong>ポケモンずかん</strong><div class="opening-dex-screen">${current === 'register' ? [446, state.opening.starterId, 25].map((id) => portrait(id)).join('') : '<span>POKÉDEX<br>READY</span>'}</div><small>${current === 'register' ? '3びき とうろく！' : 'あたらしい ぼうけんの きろく'}</small></div>`;
    if (current === 'depart')
      scene = `<div class="opening-team">${[446, state.opening.starterId, 25].map((id) => `<div>${portrait(id)}<span>${mons[id - 1].label}</span></div>`).join('')}</div>`;
    dialog.innerHTML = `<div class="opening-heading"><span>はじめての ぼうけん</span><small>${forest ? 'ゴンベとの であい' : 'オーキドけんきゅうじょ'}</small></div><div class="opening-scene">${scene}</div><div class="opening-message"><h2 id="opening-speaker">${speaker}</h2><p>${words}</p></div><div class="opening-actions"></div>`;
    const actions = dialog.querySelector('.opening-actions');
    if (current === 'choose') {
      actions.innerHTML = `<div class="opening-starters">${OpeningRules.starters
        .map(
          (id) =>
            `<button data-starter="${id}" aria-pressed="${chosen === id}">${portrait(id)}<strong>${mons[id - 1].label}</strong><small>${pokemonTypes(
              mons[id - 1],
            )
              .map((type) => types[type])
              .join('・')}</small></button>`,
        )
        .join(
          '',
        )}</div><button class="primary" id="opening-confirm" ${chosen ? '' : 'disabled'}>この ポケモンに きめる！</button>`;
      actions.querySelectorAll('[data-starter]').forEach((button) =>
        button.addEventListener('click', () => {
          preview = Number(button.dataset.starter);
          // 選択途中も保存し、確定するまではパーティーに入れない。
          state.opening.starterId = preview;
          save();
          sfx('tap');
          show();
        }),
      );
      actions.querySelector('#opening-confirm').onclick = () => {
        sfx('success');
        next();
      };
    } else {
      const button = document.createElement('button');
      button.className = 'primary';
      button.id = 'opening-next';
      button.textContent =
        current === 'practice'
          ? 'れんしゅう スタート！'
          : current === 'throw'
            ? 'れんしゅうボールを なげる（100%）'
            : current === 'depart'
              ? 'ぼうけん スタート！'
              : current === 'dex'
                ? 'ずかんを うけとる'
                : 'つぎへ ▶';
      button.onclick =
        current === 'practice'
          ? practice
          : current === 'throw'
            ? capture
            : current === 'depart'
              ? finish
              : next;
      actions.append(button);
    }
    if (!dialog.open) dialog.showModal();
    document.dispatchEvent(new CustomEvent('opening:scene'));
    actions.querySelector('button')?.focus({ preventScroll: true });
  }
  function practice() {
    if (stage() !== 'practice') return;
    dialog.close();
    openBattle(false, false, null, true);
    $('#kind').textContent = 'つかまえる れんしゅう';
    $('#weakness-tip').textContent = 'かりた ニドラン♂と れんしゅうしよう！';
    $('#puzzle-tip').textContent = 'どくのマークを 3ついじょう なぞって、はなそう！';
  }
  function stopPractice() {
    battleEpoch++;
    preparing = running = drag = false;
    activePuzzlePointer = null;
    path = [];
    cancelAnimationFrame(raf);
    clearPuzzleSelection();
    window.PokekoroBattleFX?.reset();
    window.PokekoroSfx?.stopAll();
    for (const id of ['battle', 'encounter']) $('#' + id).close();
    battle = null;
    document.dispatchEvent(new CustomEvent('battle:audiofocus', { detail: { active: false } }));
  }
  function cancelPractice() {
    if (!battle?.tutorial) return;
    stopPractice();
    move('practice');
  }
  async function resolvePractice() {
    if (!battle?.tutorial) return;
    const cleared = battle.damage > 0;
    const epoch = battleEpoch;
    if (cleared) {
      running = preparing = drag = false;
      activePuzzlePointer = null;
      path = [];
      cancelAnimationFrame(raf);
      battle.phase = 'resolving';
      $('#battle').classList.remove('hurry');
      $('#ready-overlay').hidden = false;
      $('#ready-overlay').innerHTML =
        '<strong>ニドラン♂の アタック！</strong><span>じょうずに つなげたね！</span>';
      const tier =
        window.PokekoroBattleFX?.prepare(battle.damage, battle.hp, battle.puzzleTypes[0]) || 0;
      sfx('gather', 0.3);
      await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 80 : 300));
      if (epoch !== battleEpoch) return;
      sfx('release', tier);
      window.PokekoroBattleFX?.impact(tier);
      battle.hp = 0;
      updateHP();
      await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 100 : 600));
      if (epoch !== battleEpoch) return;
    }
    stopPractice();
    if (cleared) {
      sfx('success');
      move('throw');
    } else {
      move('practice');
      dialog.querySelector('.opening-message p').textContent =
        'だいじょうぶ！ おなじ マークを 3ついじょう なぞって、ゆびを はなしてみよう。もういちど れんしゅうじゃ！';
    }
  }
  async function capture() {
    if (throwing || stage() !== 'throw') return;
    throwing = capturePending = true;
    dialog.close();
    $('#result').showModal();
    try {
      await playCaptureThrow(BALLS[0], mons[24]);
      sfx('success');
      move('caught');
    } finally {
      throwing = capturePending = false;
      $('#result').close();
    }
  }
  function finish() {
    if (!OpeningRules.complete(state)) return;
    save();
    dialog.close();
    busy = false;
    render();
    $('#roll').focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('opening:scene'));
  }
  window.PokekoroOpening = Object.freeze({
    pending,
    canPractice: () => pending() && stage() === 'practice',
    resolvePractice,
    cancelPractice,
  });
  document.addEventListener('title:start', () => {
    if (pending()) {
      save();
      show();
    }
  });
})();
