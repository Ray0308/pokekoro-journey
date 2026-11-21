'use strict';
(() => {
  state.hallOfFame = HallOfFameRules.normalize(state.hallOfFame);
  const dialog = document.createElement('dialog');
  dialog.id = 'hall-of-fame';
  dialog.setAttribute('aria-labelledby', 'hall-heading');
  document.body.append(dialog);
  let history = false;
  const escape = (text) =>
    String(text).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const hall = () => state.hallOfFame || (state.hallOfFame = HallOfFameRules.normalize(null));
  const pending = () => !!hall().pending;
  function teamMarkup(entry) {
    return `<div class="hall-team" aria-label="殿堂入りした仲間">${entry.team.map((id, i) => `<figure style="--hall-delay:${i * 85}ms"><img src="${pokemonPortrait(id)}" alt="${escape(POKEDEX[id - 1].label)}"><figcaption>${escape(POKEDEX[id - 1].label)}</figcaption></figure>`).join('')}</div>`;
  }
  function paint() {
    const entry = hall().records.find((r) => r.id === hall().pending?.id);
    const stage = history ? 'history' : hall().pending?.stage;
    dialog.dataset.stage = stage;
    let body, label;
    if (history) {
      body = `<small>HALL OF FAME</small><h2 id="hall-heading">殿堂入りの きろく</h2><p>これまで ${hall().count}回！</p>${[
        ...hall().records,
      ]
        .reverse()
        .map(
          (r) =>
            `<section class="hall-history-entry"><h3>第${r.id}回 ${escape(r.name)}</h3>${teamMarkup(r)}</section>`,
        )
        .join('')}<small>最近50回までの なかまを きろくするよ。</small>`;
      label = 'とじる';
    } else if (stage === 'ceremony') {
      body = `<div class="hall-crown" aria-hidden="true">★</div><small>ぼうけん クリア！</small><h2 id="hall-heading">殿堂入り おめでとう！</h2><p class="hall-trainer">${escape(entry.name)}</p><strong class="hall-number">第${entry.id}回 殿堂入り</strong><p>いっしょに たたかった なかまたち</p>${teamMarkup(entry)}<p class="hall-finish">きみたちは さいこうの チームだ！</p>`;
      label = 'オーキド博士の もとへ';
    } else {
      const celebrate = stage === 'oak-celebrate';
      body = `<small>オーキドはかせ</small><h2 id="hall-heading">${celebrate ? 'おめでとう！' : 'つぎの ぼうけんへ！'}</h2><div class="hall-oak-scene"><img class="hall-oak" src="assets/opening/oak.webp" alt="オーキド博士"><div class="hall-speech">${celebrate ? `${escape(entry.name)}！<br>チャンピオンに かったんじゃな！<br><br>なかまたちと ここまで よく がんばった。<br>きみも いちにんまえの<br>トレーナーじゃ！` : 'これからは きみに<br>ポケモンの ちょうさを たのみたい。<br><br>めずらしい ポケモンを さがす<br>あたらしい ぼうけんじゃ！<br><br>くわしい いらいは、じゅんびが<br>ととのったら つたえるぞ。'}</div></div>`;
      label = celebrate ? 'はなしを きく' : 'あたらしい 冒険へ！';
    }
    dialog.innerHTML = `<div class="hall-body">${body}</div><footer><button id="hall-next" class="primary">${label}</button></footer>`;
    dialog.querySelector('#hall-next').onclick = next;
    dialog.querySelector('.hall-body').scrollTop = 0;
    dialog.querySelector('#hall-heading').setAttribute('tabindex', '-1');
    dialog.querySelector('#hall-heading').focus({ preventScroll: true });
  }
  function open(showHistory = false) {
    if (!showHistory && !pending()) return false;
    history = showHistory;
    $('#result').close();
    if (!dialog.open) dialog.showModal();
    paint();
    if (!history && hall().pending.stage === 'ceremony')
      requestAnimationFrame(() => {
        if (dialog.open && !history && hall().pending?.stage === 'ceremony') sfx('hallOfFame');
      });
    return true;
  }
  function next() {
    if (history) {
      dialog.close();
      return;
    }
    const current = hall().pending;
    if (!current) return;
    const index = HallOfFameRules.stages.indexOf(current.stage);
    if (index < 2) {
      current.stage = HallOfFameRules.stages[index + 1];
      save();
      paint();
      return;
    }
    hall().pending = null;
    hall().researchIntroduced = true;
    save();
    dialog.close();
    render();
    done();
  }
  dialog.addEventListener('close', () => {
    if (history) document.querySelector('[data-hall-history]')?.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', (e) => {
    if (!history) e.preventDefault();
  });
  document.addEventListener('title:start', () => {
    if (pending()) open();
  });
  $('#journey').addEventListener('click', (e) => {
    if (e.target.closest('[data-hall-history]') && !busy && !capturePending) open(true);
  });
  window.PokekoroHall = Object.freeze({
    pending,
    open,
    recordChampion(b) {
      return HallOfFameRules.add(state, b, b.combat?.members.map((m) => m.id) || state.party);
    },
    historyButton() {
      return hall().count
        ? `<br><button data-hall-history>殿堂入りの きろく（${hall().count}回）</button>`
        : '';
    },
  });
  renderJourney();
})();
