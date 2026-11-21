'use strict';
// 最後の2課題は本物の編成UI・サイコロを使う。操作の成功後だけ段階を進める。
(() => {
  const coach = document.createElement('section');
  coach.id = 'practice-coach';
  coach.setAttribute('role', 'status');
  const mapHelp = document.createElement('dialog');
  mapHelp.id = 'map-lesson-guide';
  mapHelp.setAttribute('aria-labelledby', 'map-lesson-title');
  mapHelp.innerHTML =
    '<h2 id="map-lesson-title">マップの すすみかた</h2><p>サイコロを おして はなすと、出た目の数だけ 道のマスをすすむよ。</p><p><strong>草むら</strong>：ポケモンとの出会い<br><strong>トレーナー</strong>：対戦<br><strong>道具</strong>：アイテム発見<br><strong>交換所</strong>：ボールの交換</p><p>いちばん奥の <strong>ボス</strong>を倒して、つぎのマップを目指そう！</p><button id="practice-map-understood" class="primary" type="button">マップに もどる</button>';
  document.body.append(mapHelp);
  mapHelp.querySelector('button').onclick = () => {
    state.opening.mapIntroSeen = true;
    save();
    mapHelp.close();
    if (active()) refresh();
  };
  let highlighted = null;
  const stage = () => state.opening.stage;
  const active = () =>
    !$('#game-shell').hidden &&
    !window.PokekoroDebug?.isActive?.() &&
    ['partyLesson', 'diceLesson'].includes(stage());
  function mark(target, words) {
    highlighted?.classList.remove('practice-target');
    highlighted = target;
    if (!target) return;
    target.classList.add('practice-target');
    coach.textContent = words;
    if ($('#pokedex-device').open) $('#pokedex-device').prepend(coach);
    else if (stage() === 'partyLesson') $('#party').prepend(coach);
    else $('#map > .layout').prepend(coach);
    if (stage() === 'partyLesson') target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    target.focus({ preventScroll: true });
  }
  function refresh() {
    if (!active()) return;
    if (stage() === 'partyLesson') {
      if ($('#pokedex-device').open)
        mark(
          $(`[data-dex-id="${state.opening.starterId}"]`),
          'えらんだ なかまを おして いれかえよう！',
        );
      else mark($('#cards [data-party-slot="0"]'), '「いれかえる」を おしてみよう！');
    } else {
      mark($('#roll'), 'サイコロを おして はなそう！');
      coach.innerHTML =
        '<div><strong>出た目の数だけ 道をすすもう！</strong><small>いちばん奥の ボスがゴール。</small></div><button id="practice-map-help" type="button">マップの説明</button>';
      coach.querySelector('button').onclick = () => {
        if (!busy) mapHelp.showModal();
      };
    }
  }
  function show() {
    if (!active()) return;
    busy = false;
    showTab(stage() === 'partyLesson' ? 'party' : 'map');
    render();
    refresh();
  }
  function allowed(target) {
    if (stage() === 'partyLesson')
      return $('#pokedex-device').open
        ? !!target.closest(`[data-dex-id="${state.opening.starterId}"]`)
        : !!target.closest('#cards [data-party-slot="0"]');
    return !!target.closest('#roll, #practice-map-help, #map-lesson-guide');
  }
  for (const type of ['pointerdown', 'click', 'keydown'])
    document.addEventListener(
      type,
      (event) => {
        if (!active()) return;
        if (type === 'keydown' && !['Enter', ' ', 'Escape'].includes(event.key)) return;
        if (!allowed(event.target)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        if (type !== 'click') return;
        // 子要素の本編ハンドラーが完了した後、実際の編成結果を検証する。
        setTimeout(() => {
          if (!active()) return;
          if (
            stage() === 'partyLesson' &&
            state.party[0] === state.opening.starterId &&
            !partyTypeError(state.party)
          ) {
            window.PokekoroSfx?.play('success');
            if ($('#pokedex-device').open) $('#pokedex-device').close();
            state.opening.stage = 'diceLesson';
            save();
            show();
            // マップの説明を、古い一行メッセージで上書きしない。
          } else refresh();
        });
      },
      true,
    );
  $('#pokedex-device').addEventListener('cancel', (event) => {
    if (active()) event.preventDefault();
  });
  document.addEventListener('map:arrived', (event) => {
    if (!active() || stage() !== 'diceLesson' || state.pos <= 0) return;
    state.opening.stage = 'complete';
    state.opening.mapIntroSeen = true;
    delete state.opening.practiceStep;
    save();
    highlighted?.classList.remove('practice-target');
    coach.textContent = 'じょうず！ サイコロで すすめたね！';
    window.PokekoroSfx?.play('success');
    event.detail.lessonFinished = new Promise((resolve) =>
      setTimeout(() => {
        coach.remove();
        resolve();
      }, 1100),
    );
  });
  window.PokekoroPracticeOnboarding = Object.freeze({ show });
})();
