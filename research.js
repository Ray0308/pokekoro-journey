'use strict';
(() => {
  state.research = ResearchRules.normalize(state.research);
  const data = () => state.research || (state.research = ResearchRules.normalize(null));
  const active = () => data().active;
  const unlocked = () => state.hallOfFame?.researchIntroduced === true;
  const dialog = document.createElement('dialog');
  dialog.id = 'research-dialog';
  dialog.setAttribute('aria-labelledby', 'research-heading');
  document.body.append(dialog);
  const hud = document.createElement('button');
  hud.id = 'research-hud';
  hud.type = 'button';
  hud.hidden = true;
  $('#inventory').before(hud);
  const kind = (m) =>
    RESEARCH_CATALOG.legendIds.includes(m.pokemonId)
      ? 'でんせつの ポケモン'
      : 'さいしゅうしんかの ポケモン';
  function renderHUD() {
    hud.hidden = !unlocked() || !(active() || data().offer);
    if (!unlocked()) return;
    const m = active();
    hud.textContent = m
      ? m.phase !== 'active'
        ? '📜 調査の ポケモンに あいにいこう'
        : `${MAPS[m.mapId].name} ${m.pos + 1}マス目・あと${m.left}回 📜`
      : data().offer
        ? '📜 いらいが とどいているよ'
        : '';
    hud.setAttribute('aria-label', hud.textContent + '。依頼をみる');
    $('#route')
      .querySelectorAll('.research-target-label')
      .forEach((n) => n.remove());
    for (const node of $('#route').querySelectorAll('.tile')) {
      const target =
        m &&
        m.phase === 'active' &&
        state.mapId === m.mapId &&
        [...node.parentElement.querySelectorAll('.tile')].indexOf(node) === m.pos;
      node.classList.toggle('research-target', !!target);
      if (target) {
        const mark = document.createElement('span');
        mark.className = 'research-target-label';
        mark.textContent = 'ここ！';
        node.append(mark);
        node.setAttribute('aria-label', node.getAttribute('aria-label') + ' いらいの目的地');
      }
    }
  }
  function paint(body, buttons, mode = 'info') {
    dialog.dataset.mode = mode;
    dialog.innerHTML = `<div class="research-body">${body}</div><footer>${buttons}</footer>`;
    if (!dialog.open) dialog.showModal();
    $('#research-heading').setAttribute('tabindex', '-1');
    $('#research-heading').focus({ preventScroll: true });
  }
  function close() {
    dialog.close();
    busy = false;
    render();
  }
  function offerMarkup(m) {
    const known = pokemonSeen(m.pokemonId);
    return `<small>オーキドはかせの 調査</small><h2 id="research-heading">${active() ? 'いらいを かくにん' : 'めずらしい はんのう！'}</h2><div class="research-mon"><img src="${pokemonPortrait(m.pokemonId)}" alt="${known ? POKEDEX[m.pokemonId - 1].label : 'だれかな？'}" class="${known ? '' : 'research-silhouette'}"><strong>${known ? POKEDEX[m.pokemonId - 1].label : kind(m)}</strong></div><p class="research-place">${MAPS[m.mapId].name}<br><b>${m.pos + 1}マス目</b></p><p>${active() ? `あと <strong>${m.left}回</strong> サイコロを ふるまで！<br>出た目の ぶんだけ すすむよ。` : `引き受けてから サイコロ${ResearchRules.budget}回で<br>ぴったり とまって さがしてみよう！<br>間に合えば かならず あえるよ。`}</p>`;
  }
  function view() {
    if (!unlocked() || capturePending) return;
    const m = active(),
      offer = data().offer;
    if (m?.pending) {
      showResume();
      return;
    }
    if (m && m.phase !== 'active') {
      paint(
        `<h2 id="research-heading">調査の ポケモンを はっけん！</h2><p>さっきの 出会いを つづけよう。</p>`,
        `<button id="research-resume" class="primary">出会いを つづける</button><button id="research-cancel">いらいを やめる</button>`,
      );
      $('#research-resume').onclick = resumeEncounter;
      $('#research-cancel').onclick = cancel;
      return;
    }
    if (!m && !offer) {
      paint(
        '<h2 id="research-heading">オーキドの いらい</h2><p>マップの 📜いらいマスに とまると<br>めずらしい ポケモンの 情報が<br>とどくよ！</p>',
        '<button id="research-close" class="primary">わかった！</button>',
      );
      $('#research-close').onclick = close;
      return;
    }
    paint(
      offerMarkup(m || offer),
      m
        ? '<button id="research-travel" class="primary">現地の 入口へ行く</button><button id="research-close">とじる</button><button id="research-cancel" class="research-small">いらいを やめる</button>'
        : '<button id="research-accept" class="primary">いらいを 引き受ける</button><button id="research-close">いまは やめる</button>',
    );
    if ($('#research-accept'))
      $('#research-accept').onclick = () => {
        if (ResearchRules.accept(data())) {
          save();
          render();
          view();
        }
      };
    if ($('#research-travel'))
      $('#research-travel').onclick = () => {
        const target = active()?.mapId;
        dialog.close();
        busy = false;
        if (target) revisitMap(target, { restart: true });
      };
    if ($('#research-cancel')) $('#research-cancel').onclick = cancel;
    $('#research-close').onclick = close;
  }
  function cancel() {
    ResearchRules.finish(data(), 'cancelled');
    close();
  }
  function ensureOffer() {
    if (!unlocked()) return;
    ResearchRules.generate(state);
    busy = false;
    render();
    view();
  }
  function reserve(raw) {
    if (!unlocked()) return null;
    const p = ResearchRules.reserve(data(), state.mapId, state.pos, raw);
    if (p) save();
    return p;
  }
  function chooseRoll(raw) {
    const p = unlocked() ? active()?.pending : null;
    if (!p) return Promise.resolve(raw);
    // 旧版で確定済みの出目は途中移動の再開用に保持。新しい出目の調整はしない。
    if (p.value === null) {
      p.value = p.raw;
      save();
    }
    return Promise.resolve(p.value);
  }
  function arrive() {
    if (!unlocked() || !active()?.pending) return null;
    const encounter = ResearchRules.arrive(data(), state.mapId, state.pos);
    save();
    render();
    return encounter;
  }
  function encounter() {
    if (!unlocked()) return null;
    const m = active();
    return m && m.phase !== 'active' && m.mapId === state.mapId && m.pos === state.pos
      ? { missionId: m.id, pokemonId: m.pokemonId }
      : null;
  }
  function resumeEncounter() {
    const e = encounter();
    if (!e) {
      cancel();
      return;
    }
    dialog.close();
    busy = false;
    openBattle(false, false, null, false, e);
  }
  function finish(outcome, id = battle?.researchMissionId) {
    if (!id || active()?.id !== id) return false;
    return ResearchRules.finish(data(), outcome);
  }
  function battleEnd(win) {
    if (!battle?.researchMissionId || active()?.id !== battle.researchMissionId) return;
    if (win) active().phase = 'capture';
    else finish('defeated');
  }
  function showResume() {
    paint(
      '<h2 id="research-heading">いらいの つづき</h2><p>サイコロと 出会いの つづきを<br>さいかいしよう！</p>',
      '<button id="research-resume" class="primary">つづける</button><button id="research-cancel">いらいを やめる</button>',
    );
    $('#research-resume').onclick = async () => {
      dialog.close();
      busy = false;
      while (mapArtLoading) await new Promise(requestAnimationFrame);
      if (active()?.pending) void rollDice();
      else if (encounter()) resumeEncounter();
    };
    $('#research-cancel').onclick = cancel;
  }
  hud.onclick = () => {
    if (!busy) view();
  };
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  document.addEventListener('title:start', () => {
    if (unlocked() && (active()?.pending || encounter())) showResume();
  });
  window.PokekoroResearch = Object.freeze({
    unlocked,
    open: view,
    render: renderHUD,
    offer: ensureOffer,
    reserve,
    chooseRoll,
    arrive,
    encounter,
    finish,
    battleEnd,
    pendingRoll: () => (unlocked() ? active()?.pending : null),
    locked: () => unlocked() && !!active() && (!!active().pending || active().phase !== 'active'),
    squares(stops) {
      if (!unlocked() || isRainbow() || state.mapId === 'safari-zone') return stops;
      const next = [...stops];
      next[ResearchRules.slot(stops)] = 'mission';
      return next;
    },
  });
  render();
})();
