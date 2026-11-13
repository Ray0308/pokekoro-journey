'use strict';
// 全操作は active で制限し、通常進行のスナップショットと別セーブを使う。
// This file owns all debug UI and flags. Comment out its single script tag to remove it.
(() => {
  const SAVE_KEY = 'pokekoro-debug-v1',
    PREFS_KEY = 'pokekoro-debug-settings-v1';
  let active = false,
    forceTickets = false,
    forceHouse = false,
    forcedDice = 0,
    pendingRoll = null,
    normalSnapshot = null;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const style = document.createElement('style');
  style.textContent = `
 #title-debug{position:absolute;left:max(9px,env(safe-area-inset-left));bottom:max(7px,env(safe-area-inset-bottom));z-index:20;padding:5px 8px;min-height:28px;border:1px solid #ffffff70;border-radius:6px;background:#173b4788;color:#fff;font-size:9px;box-shadow:none}
 #debug-panel{width:min(92vw,440px);max-height:90dvh;padding:20px;border:2px solid #8b72ad;border-radius:14px;background:#f7f4fb;color:#423653;overflow:auto}
 #debug-panel::backdrop{background:#20243bbf}#debug-panel h2{margin:0 0 8px;font-size:20px;color:#60477b}#debug-panel p{font-size:11px;line-height:1.7;color:#766485;margin:6px 0 14px}
 #debug-panel label{display:block;font-size:12px;margin:12px 0;color:#55436d}#debug-panel select{display:block;width:100%;padding:10px;margin-top:5px;border:1px solid #c1aecf;border-radius:7px;font-size:14px;background:white;color:#493c59}
 #debug-panel .debug-check{display:flex;gap:8px;align-items:center;font-size:13px}#debug-panel input[type=checkbox]{width:18px;height:18px;accent-color:#8d66b2}
 .debug-actions{display:flex;gap:8px;margin-top:17px}.debug-actions button{flex:1;min-height:43px;border-radius:8px;border:1px solid #c5b4d7;background:#e9e0f3;color:#634781;padding:9px;font-size:13px;box-shadow:none}#debug-start{background:#8964a8;color:white;border-color:#74548e}
 #debug-tools-button{display:none}body.debug-mode-active #game-shell nav #debug-tools-button{display:block;padding:5px 8px;min-height:32px;flex:0 0 auto;font-size:10px;background:#e7d9f5;border:1px solid #9c79b8;color:#684782;border-radius:7px}#debug-tools{width:min(92vw,370px);max-height:85dvh;overflow:auto;padding:20px;border:2px solid #9875b4;border-radius:14px;background:#faf5ff;color:#5b416f}#debug-tools h2{font-size:20px;margin:0 0 10px}#debug-tools label{display:block;font-size:14px;margin:15px 0}#debug-tools select{width:100%;padding:10px;margin-top:6px;font-size:16px}#debug-tools input{width:18px;height:18px;vertical-align:middle}#debug-tools p{font-size:11px;line-height:1.6}#debug-tools-close{width:100%;min-height:40px}#debug-instant-win{display:none}body.debug-mode-active #battle .battlehead{gap:4px}body.debug-mode-active #battle .battlehead>span{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}body.debug-mode-active #battle #debug-instant-win{display:block;flex-shrink:0;padding:5px 8px;min-height:30px;background:#d34d61;color:white;font-size:11px;box-shadow:none;border-radius:7px}
 #debug-roll-picker{width:min(92vw,360px);max-height:85dvh;overflow:auto;padding:20px;border:2px solid #9875b4;border-radius:16px;background:#faf5ff;color:#5b416f}#debug-roll-picker h2{font-size:20px;text-align:center;margin:0 0 12px}#debug-roll-picker p{font-size:12px;text-align:center;margin:0 0 14px}.debug-roll-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.debug-roll-grid button{min-height:70px;padding:8px;border:2px solid #c8b5da;background:#fff;color:#614079;border-radius:12px;font-size:28px;box-shadow:0 3px #c8b5da}.debug-roll-grid small{display:block;font-size:11px}#debug-roll-random,#debug-roll-cancel{width:100%;min-height:42px;margin-top:12px;font-size:14px}#debug-roll-random{background:#ffe09d;color:#795324}#debug-roll-picker::backdrop{background:#263141a8}
 .debug-status{display:none;position:fixed;z-index:15;right:9px;bottom:max(21px,calc(env(safe-area-inset-bottom) + 17px));padding:3px 6px;border-radius:4px;background:#6c388ccc;color:white;font-size:8px;pointer-events:none}body.debug-mode-active:not(.at-title) #debug-tools-button{display:none}body.debug-mode-active #game-shell nav #debug-tools-button{display:block;padding:5px 8px;min-height:32px;flex:0 0 auto;font-size:10px;background:#e7d9f5;border:1px solid #9c79b8;color:#684782;border-radius:7px}#debug-tools{width:min(92vw,370px);max-height:85dvh;overflow:auto;padding:20px;border:2px solid #9875b4;border-radius:14px;background:#faf5ff;color:#5b416f}#debug-tools h2{font-size:20px;margin:0 0 10px}#debug-tools label{display:block;font-size:14px;margin:15px 0}#debug-tools select{width:100%;padding:10px;margin-top:6px;font-size:16px}#debug-tools input{width:18px;height:18px;vertical-align:middle}#debug-tools p{font-size:11px;line-height:1.6}#debug-tools-close{width:100%;min-height:40px}#debug-instant-win{display:none}body.debug-mode-active #battle .battlehead{gap:4px}body.debug-mode-active #battle .battlehead>span{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}body.debug-mode-active #battle #debug-instant-win{display:block;flex-shrink:0;padding:5px 8px;min-height:30px;background:#d34d61;color:white;font-size:11px;box-shadow:none;border-radius:7px}
 #debug-roll-picker{width:min(92vw,360px);max-height:85dvh;overflow:auto;padding:20px;border:2px solid #9875b4;border-radius:16px;background:#faf5ff;color:#5b416f}#debug-roll-picker h2{font-size:20px;text-align:center;margin:0 0 12px}#debug-roll-picker p{font-size:12px;text-align:center;margin:0 0 14px}.debug-roll-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.debug-roll-grid button{min-height:70px;padding:8px;border:2px solid #c8b5da;background:#fff;color:#614079;border-radius:12px;font-size:28px;box-shadow:0 3px #c8b5da}.debug-roll-grid small{display:block;font-size:11px}#debug-roll-random,#debug-roll-cancel{width:100%;min-height:42px;margin-top:12px;font-size:14px}#debug-roll-random{background:#ffe09d;color:#795324}#debug-roll-picker::backdrop{background:#263141a8}
 .debug-status{display:block}
 `;
  document.head.append(style);
  const launch = document.createElement('button');
  launch.id = 'title-debug';
  launch.textContent = 'デバッグ';
  launch.type = 'button';
  document.querySelector('#title-screen').append(launch);
  const panel = document.createElement('dialog');
  panel.id = 'debug-panel';
  panel.setAttribute('aria-labelledby', 'debug-title');
  panel.innerHTML = `<h2 id="debug-title">デバッグモード</h2><p>通常セーブとは別に保存します。虹のチケット確定は、デバッグ中の通常マップのボス勝利だけに適用されます。</p><label>開始するマップ<select id="debug-map">${[...MAP_ORDER, RAINBOW_CONFIG.mapId].map((id) => `<option value="${id}">${MAPS[id].special ? '特別' : MAPS[id].chapter}：${MAPS[id].name}</option>`).join('')}</select></label><label>開始位置<select id="debug-position"><option value="0">出発地点</option><option value="6">交換所・ガンテツの家</option><option value="13">ボスの手前</option><option value="14">ボスマス（ボタンで再挑戦）</option></select></label><label id="debug-return-label" hidden>虹の雲のチケット獲得元<select id="debug-return-source">${MAP_ORDER.map((id) => `<option value="${id}">${MAPS[id].name}</option>`).join('')}</select></label><label class="debug-check"><input id="debug-force-ticket" type="checkbox" checked>虹のチケットを確定ドロップ</label><label class="debug-check"><input id="debug-force-kurt" type="checkbox">ガンテツの家を確定出現</label><label>サイコロの出目<select id="debug-dice-setting"><option value="0">ランダム</option>${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n}</option>`).join('')}</select></label><p>虹の雲への直接移動ではチケットを消費しません。名前・タイプ・図鑑説明は本編と共通です。</p><div class="debug-actions"><button id="debug-close">とじる</button><button id="debug-start">この設定で開始</button></div>`;
  document.body.append(panel);
  const toolsButton = document.createElement('button');
  toolsButton.id = 'debug-tools-button';
  toolsButton.textContent = 'DEBUG';
  document.querySelector('#game-menu-toggle').before(toolsButton);
  const toolsDialog = document.createElement('dialog');
  toolsDialog.id = 'debug-tools';
  toolsDialog.setAttribute('aria-label', 'デバッグ操作');
  toolsDialog.innerHTML =
    '<h2>デバッグ操作</h2><label>サイコロの出目<select id="debug-dice-live"><option value="0">ランダム</option>' +
    [1, 2, 3, 4, 5, 6].map((n) => '<option value="' + n + '">' + n + '</option>').join('') +
    '</select></label><label><input id="debug-kurt-live" type="checkbox">ガンテツの家を確定出現</label><p>変更はすぐ反映されます。ガンテツの家は通常マップの交換所に出現します。<br>バトル中の「即撃破」で報酬・捕獲まで進めます（サファリは即クリア）。</p><button id="debug-tools-close">もどる</button>';
  document.body.append(toolsDialog);
  const rollPicker = document.createElement('dialog');
  rollPicker.id = 'debug-roll-picker';
  rollPicker.setAttribute('aria-labelledby', 'debug-roll-title');
  rollPicker.innerHTML =
    '<h2 id="debug-roll-title">今回の出目を えらぶ</h2><p>えらんだ目で サイコロを振るよ</p><div class="debug-roll-grid">' +
    [1, 2, 3, 4, 5, 6]
      .map(
        (n) =>
          '<button data-debug-roll="' +
          n +
          '" aria-label="' +
          n +
          'マス進む">' +
          n +
          '<small>マス</small></button>',
      )
      .join('') +
    '</div><button id="debug-roll-random" data-debug-roll="0">ランダムで振る</button><button id="debug-roll-cancel">やめる</button>';
  document.body.append(rollPicker);
  function chooseRoll() {
    if (
      !active ||
      busy ||
      capturePending ||
      state.pendingMapId ||
      state.pos === 14 ||
      rainbowExitReady()
    )
      return false;
    if (!rollPicker.open) {
      rollPicker.showModal();
      window.PokekoroSfx?.play('menuOpen');
    }
    return true;
  }
  rollPicker.addEventListener('click', (e) => {
    const b = e.target.closest('[data-debug-roll]');
    if (!b || !active || busy) return;
    pendingRoll = Number(b.dataset.debugRoll);
    rollPicker.close();
    rollDice();
  });
  document.querySelector('#debug-roll-cancel').onclick = () => rollPicker.close();
  const instant = document.createElement('button');
  instant.id = 'debug-instant-win';
  instant.textContent = '即撃破';
  document.querySelector('.battlehead').append(instant);
  document.addEventListener('battle:prepare', () => {
    instant.textContent = battle?.safari ? '即クリア' : '即撃破';
  });
  const badge = document.createElement('span');
  badge.className = 'debug-status';
  document.body.append(badge);
  const map = panel.querySelector('#debug-map'),
    position = panel.querySelector('#debug-position'),
    force = panel.querySelector('#debug-force-ticket'),
    source = panel.querySelector('#debug-return-source');
  const houseSetting = panel.querySelector('#debug-force-kurt'),
    diceSetting = panel.querySelector('#debug-dice-setting'),
    houseLive = toolsDialog.querySelector('#debug-kurt-live'),
    diceLive = toolsDialog.querySelector('#debug-dice-live');
  const validDice = (value) => ([0, 1, 2, 3, 4, 5, 6].includes(Number(value)) ? Number(value) : 0);
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY));
    if (prefs) {
      if (Object.hasOwn(MAPS, prefs.map)) map.value = prefs.map;
      if (['0', '6', '13', '14'].includes(String(prefs.position)))
        position.value = String(prefs.position);
      force.checked = prefs.force !== false;
      houseSetting.checked = prefs.kurt === true;
      diceSetting.value = String(validDice(prefs.dice));
      if (MAP_ORDER.includes(prefs.source)) source.value = prefs.source;
    }
  } catch {}
  function updateSource() {
    panel.querySelector('#debug-return-label').hidden = map.value !== RAINBOW_CONFIG.mapId;
  }
  map.addEventListener('change', updateSource);
  updateSource();
  function setActive(value) {
    active = value;
    if (!active) pendingRoll = null;
    document.body.classList.toggle('debug-mode-active', active);
    badge.textContent = [
      'DEBUG',
      forceTickets ? '虹チケ確定' : '',
      forceHouse ? 'ガンテツ確定' : '',
      forcedDice ? '出目' + forcedDice : '',
    ]
      .filter(Boolean)
      .join('・');
  }
  window.PokekoroDebug = Object.freeze({
    isActive: () => active,
    forceRainbowTicket: () => active && forceTickets,
    saveKey: () => (active ? SAVE_KEY : null),
    forceKurtHouse: () => active && forceHouse,
    diceValue: () => {
      if (!active) return 0;
      const value = pendingRoll === null ? forcedDice : pendingRoll;
      pendingRoll = null;
      return value;
    },
    chooseRoll,
  });
  function savePrefs() {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          map: map.value,
          position: position.value,
          force: forceTickets,
          source: source.value,
          kurt: houseSetting.checked,
          dice: validDice(diceSetting.value),
        }),
      );
    } catch {}
  }
  toolsButton.onclick = () => {
    if (!active) return;
    houseLive.checked = forceHouse;
    diceLive.value = String(forcedDice);
    toolsDialog.showModal();
  };
  document.querySelector('#debug-tools-close').onclick = () => toolsDialog.close();
  houseLive.onchange = () => {
    if (!active) return;
    forceHouse = houseLive.checked;
    houseSetting.checked = forceHouse;
    savePrefs();
    setActive(true);
    render();
  };
  diceLive.onchange = () => {
    if (!active) return;
    forcedDice = validDice(diceLive.value);
    diceSetting.value = String(forcedDice);
    savePrefs();
    setActive(true);
  };
  instant.onclick = () => {
    if (
      !active ||
      !battle ||
      !document.querySelector('#battle').open ||
      capturePending ||
      battle.rewardResolved ||
      battle.phase === 'finished'
    )
      return;
    battleEpoch++;
    running = false;
    preparing = false;
    activePuzzlePointer = null;
    drag = false;
    path = [];
    cancelAnimationFrame(raf);
    window.PokekoroSfx?.stopAll();
    window.PokekoroBattleFX?.reset();
    document.querySelector('#energy-layer')?.remove();
    document.querySelector('#battle-fx').replaceChildren();
    document.dispatchEvent(new CustomEvent('battle:audiofocus', { detail: { active: false } }));
    battle.damage = Math.max(battle.damage, battle.total);
    battle.shownDamage = battle.damage;
    updateCharge();
    if (!battle.safari) {
      battle.hp = 0;
      updateHP();
      markBattleVictory();
    }
    battle.phase = 'finished';
    endBattle(true);
  };
  launch.onclick = () => panel.showModal();
  panel.querySelector('#debug-close').onclick = () => panel.close();
  panel.querySelector('#debug-start').onclick = () => {
    const mapId = map.value;
    if (!Object.hasOwn(MAPS, mapId)) return;
    if (!active) normalSnapshot = clone(state);
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch {}
    // Start from a valid in-memory schema; only retain debug collection and inventories.
    const next = clone(active ? state : normalSnapshot || state);
    if (saved && Array.isArray(saved.owned) && Array.isArray(saved.party)) {
      const owned = [...new Set(saved.owned.filter(validPokemonId))],
        party = [
          ...new Set(saved.party.filter((id) => validPokemonId(id) && owned.includes(id))),
        ].slice(0, PARTY_SIZE);
      if (party.length) {
        next.owned = owned;
        next.party = party;
        for (const key of ['balls', 'super', 'hyper', 'master'])
          if (Number.isSafeInteger(saved[key]) && saved[key] >= 0) next[key] = saved[key];
        if (Array.isArray(saved.clearedMaps))
          next.clearedMaps = [...new Set(saved.clearedMaps.filter((id) => MAP_ORDER.includes(id)))];
        if (Array.isArray(saved.rainbowTickets))
          next.rainbowTickets = saved.rainbowTickets.map(normalizeRainbowTicket).filter(Boolean);
        if (Number.isSafeInteger(saved.tour) && saved.tour > 0) next.tour = saved.tour;
        if (Array.isArray(saved.typeBalls)) next.typeBalls = saved.typeBalls;
        if (saved.kurtHouses && typeof saved.kurtHouses === 'object')
          next.kurtHouses = saved.kurtHouses;
        next.nextRainbowTicketId = Math.max(
          next.nextRainbowTicketId,
          ...next.rainbowTickets.map((t) => t.id + 1),
        );
      }
    }
    normalizeTypeBalls(next);
    forceTickets = force.checked;
    forceHouse = houseSetting.checked;
    forcedDice = validDice(diceSetting.value);
    setActive(true);
    state = next;
    resetDicePresentation();
    battleEpoch++;
    preparing = false;
    running = false;
    capturePending = false;
    cancelAnimationFrame(raf);
    battle = null;
    busy = false;
    state.mapId = mapId;
    state.pos = Number(position.value);
    state.lap = 1;
    state.pendingMapId = null;
    state.rainbowVisit = null;
    if (mapId === RAINBOW_CONFIG.mapId) {
      const from = source.value,
        nextMap = MAPS[from].nextMap || MAP_ORDER[0];
      state.rainbowVisit = {
        id: state.nextRainbowTicketId++,
        sourceMapId: from,
        returnMapId: nextMap,
        returnTour: state.tour + (from === MAP_ORDER.at(-1) ? 1 : 0),
        bossId: RAINBOW_CONFIG.bossIds[0],
        exitPending: false,
      };
    }
    savePrefs();
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    window.PokekoroTitle?.reset();
    showTab('map');
    render();
    document.dispatchEvent(new CustomEvent('title:start'));
    document.querySelector('#message').textContent = 'デバッグ：' + activeMap().name;
  };
  // The regular Start button always restores the untouched normal progress.
  document.querySelector('#enter-game').addEventListener(
    'click',
    () => {
      if (!active) return;
      resetDicePresentation();
      battleEpoch++;
      battle = null;
      busy = false;
      preparing = false;
      running = false;
      capturePending = false;
      cancelAnimationFrame(raf);
      state = clone(normalSnapshot);
      setActive(false);
      render();
    },
    true,
  );
})();
