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
    move(OpeningRules.nextStage(state));
  }
  function show() {
    if (!pending()) return;
    busy = true;
    if (OpeningRules.upgradeMock(state)) save();
    const current = stage();
    if (['partyLesson', 'diceLesson'].includes(current)) {
      dialog.close();
      window.PokekoroPracticeOnboarding.show();
      return;
    }
    const [speaker, words] =
      (state.opening.version >= 5 && OPENING_MOCK_STORY[current]) || OPENING_STORY[current];
    const companion = ['oakGonbe', 'oakFriend', 'companionInvite'].includes(current);
    const dex = ['dex', 'register'].includes(current);
    dialog.dataset.stage = current;
    dialog.setAttribute(
      'aria-labelledby',
      current === 'nameInput' ? 'opening-name-title' : 'opening-speaker',
    );
    dialog.dataset.scene = dex ? 'dex' : 'lab';
    const chosen = preview || state.opening.starterId;
    let scene = `<img class="opening-oak" src="assets/opening/oak.webp" alt="オーキド博士">`;
    if (companion) scene += portrait(446, 'opening-partner');
    if (['chosen', 'borrow', 'practice', 'caught', 'mockGift'].includes(current))
      scene += portrait(
        current === 'borrow' || current === 'practice'
          ? state.opening.version >= 5
            ? 25
            : 32
          : current === 'caught' || current === 'mockGift'
            ? 25
            : chosen,
        'opening-partner',
      );
    if (dex)
      scene = `<div class="opening-dex"><i></i><strong>ポケモンずかん</strong><div class="opening-dex-screen">${current === 'register' ? [446, state.opening.starterId, 25].map((id) => portrait(id)).join('') : '<span>POKÉDEX<br>READY</span>'}</div><small>${current === 'register' ? '3びき とうろく！' : 'あたらしい ぼうけんの きろく'}</small></div>`;
    if (current === 'depart')
      scene = `<div class="opening-team">${[446, state.opening.starterId, 25].map((id) => `<div>${portrait(id)}<span>${mons[id - 1].label}</span></div>`).join('')}</div>`;
    dialog.innerHTML = `<div class="opening-heading"><span>${current === 'oakGreeting' ? 'けんきゅうじょに とうちゃく！' : 'はじめての ぼうけん'}</span><small>${current === 'nameInput' ? 'なまえを きめる' : 'オーキドけんきゅうじょ'}</small></div><div class="opening-scene">${scene}</div><div class="opening-message"><h2 id="opening-speaker">${speaker}</h2><p></p></div><div class="opening-actions"></div>`;
    // 名前はHTMLとして挿入せず、台詞のテキストとして表示する。
    dialog.querySelector('.opening-message p').textContent = words.replace(
      '{playerName}',
      () => state.playerName || OpeningRules.normalizeName(state.opening.nameDraft),
    );
    const actions = dialog.querySelector('.opening-actions');
    if (current === 'nameChoice') {
      const menu = document.createElement('div');
      menu.className = 'opening-name-choices';
      for (const [index, name] of OpeningRules.nameChoices.entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = name;
        button.dataset.nameChoice = String(index);
        button.onclick = () => {
          state.opening.nameSource = index === 0 ? 'custom' : 'preset';
          if (index !== 0) state.opening.nameDraft = name;
          move(index === 0 ? 'nameInput' : 'nameConfirm');
        };
        menu.append(button);
      }
      actions.append(menu);
    } else if (current === 'nameInput') {
      OpeningNameEntry.render(actions, {
        draft: typeof state.opening.nameDraft === 'string' ? state.opening.nameDraft : '',
        mode: state.opening.nameMode || 'katakana',
        limit: OpeningRules.nameLimit,
        onChange: (value) => {
          state.opening.nameDraft = value;
          sfx('tap');
          save();
        },
        onMode: (value) => {
          state.opening.nameMode = value;
          save();
        },
        onDone: (value) => {
          state.opening.nameDraft = OpeningRules.normalizeName(value);
          state.opening.nameSource = 'custom';
          move('nameConfirm');
        },
        onBack: () => move('nameChoice'),
      });
    } else if (current === 'nameConfirm') {
      actions.innerHTML =
        '<div class="opening-name-confirm"><button class="primary" id="opening-name-yes">はい</button><button id="opening-name-no">いいえ</button></div>';
      actions.querySelector('#opening-name-yes').onclick = () => {
        if (!OpeningRules.confirmName(state)) return;
        save();
        show();
      };
      actions.querySelector('#opening-name-no').onclick = () =>
        move(state.opening.nameSource === 'preset' ? 'nameChoice' : 'nameInput');
    } else if (current === 'companionInvite') {
      const button = document.createElement('button');
      button.className = 'primary';
      button.id = 'opening-invite';
      button.textContent = 'ゴンベ、いっしょに いこう！';
      button.onclick = () => {
        if (!OpeningRules.acceptCompanion(state)) return;
        sfx('success');
        save();
        show();
      };
      actions.append(button);
    } else if (current === 'choose') {
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
            ? state.opening.version >= 5
              ? 'ボールを なげてみる'
              : 'れんしゅうボールを なげる（100%）'
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
      if (current === 'throw' && state.opening.version >= 3) {
        const ball = document.createElement('img');
        ball.src = BALLS[0].image;
        ball.alt = 'モンスターボール';
        ball.className = 'practice-capture-ball';
        button.prepend(ball);
        button.classList.add('practice-target');
      }
      actions.append(button);
    }
    if (current === 'register') sfx('success');
    if (!dialog.open) dialog.showModal();
    document.dispatchEvent(new CustomEvent('opening:scene'));
    actions
      .querySelector(current === 'nameInput' ? '[data-name-char]' : 'button')
      ?.focus({ preventScroll: true });
  }
  function practice() {
    if (stage() !== 'practice') return;
    dialog.close();
    if (state.opening.version >= 5) {
      window.PokekoroMockPractice.open();
      return;
    }
    if (state.opening.version >= 3) {
      window.PokekoroPractice.open();
      return;
    }
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
    throwing = true;
    dialog.close();
    $('#result').showModal();
    window.PokekoroCaptureGesture.open({
      host: $('#result'),
      body: $('#resultBody'),
      ball: BALLS[0],
      mon: mons[24],
      onCancel: () => {
        throwing = false;
        $('#result').close();
        dialog.showModal();
      },
      onThrow: async () => {
        capturePending = true;
        try {
          await playCaptureThrow(BALLS[0], mons[24]);
          sfx('success');
          move('caught');
        } finally {
          throwing = capturePending = false;
          $('#result').close();
        }
      },
    });
  }

  function finish() {
    if (!OpeningRules.complete(state)) return;
    if (state.opening.version >= 3)
      state.opening.stage = state.opening.version >= 5 ? 'diceLesson' : 'partyLesson';
    save();
    dialog.close();
    busy = false;
    render();
    if (['partyLesson', 'diceLesson'].includes(state.opening.stage))
      window.PokekoroPracticeOnboarding.show();
    else $('#roll').focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('opening:scene'));
  }
  window.PokekoroOpening = Object.freeze({
    pending,
    practiceComplete() {
      if (stage() === 'practice' && state.opening.version >= 3)
        move(state.opening.version >= 5 ? 'mockGift' : 'throw');
    },
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
