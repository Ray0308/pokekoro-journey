'use strict';
// 図鑑表示とパーティー入れ替えの候補選択。遭遇済みと所持済みの表示を区別する。
(() => {
  const dialog = document.querySelector('#pokedex-device'),
    synth = window.speechSynthesis;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  let selected = 1,
    utterance = null,
    speechToken = 0,
    openingTimer = 0,
    soundEnabled = true;
  const LIST_SIZE = 24;
  let replaceSlot = null,
    filterPanel = null;
  // 図鑑と入れ替え候補では条件・ページを分け、詳細から戻ったときは条件を保つ。
  const listFilters = {
    dex: { name: '', type: null, page: 0 },
    party: { name: '', type: null, page: 0 },
  };
  const kanaRows = [
    'あいうえお',
    'かきくけこ',
    'さしすせそ',
    'たちつてと',
    'なにぬねの',
    'はひふへほ',
    'まみむめも',
    'や ゆ よ',
    'らりるれろ',
    'わ を ん',
  ];
  function currentFilter() {
    return listFilters[replaceSlot === null ? 'dex' : 'party'];
  }
  function filteredEntries() {
    return PokekoroDexFilter.filter(POKEDEX, {
      ...currentFilter(),
      owned: state.owned,
      seen: state.seen || [],
      picking: replaceSlot !== null,
    });
  }
  function pageForSelected() {
    const index = filteredEntries().findIndex((mon) => mon.id === selected);
    if (index >= 0) currentFilter().page = Math.floor(index / LIST_SIZE);
  }
  function closeFilterPanel() {
    filterPanel = null;
    document.querySelector('#device-filter-panel').hidden = true;
    dialog.removeAttribute('data-filter-panel');
    document.querySelector('#device-name-filter').setAttribute('aria-expanded', 'false');
    document.querySelector('#device-type-filter').setAttribute('aria-expanded', 'false');
  }
  function updateFilterQuery() {
    const query = currentFilter().name;
    document.querySelector('#device-name-query').textContent =
      query || 'なまえの はじめを 入れてね';
    document.querySelector('#device-name-backspace').disabled = !query;
    document.querySelector('#device-name-clear').disabled = !query;
    document.querySelector('#device-name-voice').disabled = !query;
    document.querySelector('#device-name-small').disabled = !query;
    document.querySelector('#device-filter-apply').textContent =
      `${filteredEntries().length}匹を 表示する`;
  }
  function showFilterPanel(kind) {
    if (filterPanel === kind) {
      closeFilterPanel();
      return;
    }
    filterPanel = kind;
    dialog.dataset.filterPanel = kind;
    document.querySelector('#device-filter-panel').hidden = false;
    document.querySelector('#device-kana-panel').hidden = kind !== 'name';
    document.querySelector('#device-types-panel').hidden = kind !== 'type';
    document.querySelector('#device-filter-heading').textContent =
      kind === 'name' ? 'なまえで さがす' : 'タイプで さがす';
    document.querySelector('#device-name-filter').setAttribute('aria-expanded', kind === 'name');
    document.querySelector('#device-type-filter').setAttribute('aria-expanded', kind === 'type');
    updateFilterQuery();
    document.querySelector('#device-filter-panel .device-filter-options').scrollTop = 0;
    document.querySelector('#device-filter-done').focus({ preventScroll: true });
  }
  function changeName(next) {
    currentFilter().name = next.slice(0, 12);
    currentFilter().page = 0;
    renderList();
    updateFilterQuery();
  }
  function transformLast(kind) {
    const query = currentFilter().name;
    if (!query) return;
    const last = query.slice(-1);
    let next = last;
    if (kind === 'voice') {
      for (const cycle of [
        'かが',
        'きぎ',
        'くぐ',
        'けげ',
        'こご',
        'さざ',
        'しじ',
        'すず',
        'せぜ',
        'そぞ',
        'ただ',
        'ちぢ',
        'つづ',
        'てで',
        'とど',
        'はばぱ',
        'ひびぴ',
        'ふぶぷ',
        'へべぺ',
        'ほぼぽ',
        'うゔ',
      ]) {
        const index = cycle.indexOf(last);
        if (index >= 0) {
          next = cycle[(index + 1) % cycle.length];
          break;
        }
      }
    } else {
      const normal = 'あいうえおつやゆよわ',
        small = 'ぁぃぅぇぉっゃゅょゎ';
      if (normal.includes(last)) next = small[normal.indexOf(last)];
      else if (small.includes(last)) next = normal[small.indexOf(last)];
    }
    changeName(query.slice(0, -1) + next);
  }
  try {
    const saved = JSON.parse(localStorage.getItem('pokekoro-title-v1'));
    if (typeof saved?.sound === 'boolean') soundEnabled = saved.sound;
  } catch {}
  function status(text) {
    document.querySelector('#device-status').textContent = text;
  }
  function sound(name) {
    window.PokekoroSfx?.play(name);
  }
  function speechFocus(active) {
    document.dispatchEvent(new CustomEvent('dex:speech', { detail: { active } }));
  }
  function updateSpeechButton() {
    const button = document.querySelector('#device-speak'),
      hasText = pokemonSeen(selected) && !!POKEDEX[selected - 1].description;
    const audible = soundEnabled && (window.PokekoroAudioMix?.get('se') ?? 1) > 0;
    button.disabled = !supported || !audible || !hasText;
    button.textContent = utterance ? '■ とめる' : !audible ? 'よみあげ OFF' : '▶ よみあげ';
  }
  function stopReading() {
    if (utterance) speechFocus(false);
    speechToken++;
    if (supported) synth.cancel();
    utterance = null;
    dialog.classList.remove('is-speaking');
    updateSpeechButton();
  }
  function renderEntry() {
    const mon = POKEDEX[selected - 1],
      owned = state.owned.includes(selected),
      seen = pokemonSeen(selected);
    document.querySelector('#device-number').textContent = 'No.' + pokemonNumber(selected);
    document.querySelector('#device-name').textContent = seen ? mon.label : '────';
    const image = document.querySelector('#device-image');
    image.hidden = !seen;
    if (seen) image.src = pokemonPortrait(selected);
    else image.removeAttribute('src');
    image.alt = seen ? mon.label : '';
    document.querySelector('#device-type').textContent = !seen
      ? 'タイプ：—'
      : mon.type === null
        ? 'タイプ：—'
        : pokemonTypes(mon)
            .map((t) => types[t])
            .join('・') + 'タイプ';
    document.querySelector('#device-description').textContent = !seen
      ? 'まだ であっていません。'
      : mon.description || 'せつめいは まだ とうろくされていません。';
    const stats = document.querySelector('#device-stats');
    stats.hidden = !seen;
    // 未遭遇の種族値・役割は出さない。開閉状態も次の個体へ持ち越さない。
    if (Number(stats.dataset.pokemon) !== selected) stats.open = false;
    stats.dataset.pokemon = String(selected);
    document.querySelector('#device-battle-style').textContent = seen
      ? `${PokemonBattleStats.style(mon)} ｜ わざの溜まり：${PokemonBattleStats.gaugeLabel(mon)}`
      : '';
    document.querySelector('#device-skill').textContent = seen
      ? `${PokemonSkillRules.forPokemon(selected).name}（ゲージ${PokemonSkillRules.cost(selected)}）：${PokemonSkillRules.description(selected)}`
      : '';
    document.querySelector('#device-stat-list').innerHTML = seen
      ? [
          ['hp', 'HP'],
          ['attack', 'こうげき'],
          ['defense', 'ぼうぎょ'],
          ['specialAttack', 'とくこう'],
          ['specialDefense', 'とくぼう'],
          ['speed', 'すばやさ'],
        ]
          .map(
            ([key, label]) =>
              `<div><dt>${label}</dt><dd><meter min="0" max="255" value="${mon.stats[key]}" aria-label="${label}"></meter><b>${mon.stats[key]}</b></dd></div>`,
          )
          .join('')
      : '';
    document.querySelector('#device-owned').textContent = owned
      ? '✓ つかまえた！'
      : 'まだ つかまえていません';
    const party = document.querySelector('#device-party');
    party.disabled = !owned;
    party.textContent = state.party.includes(selected)
      ? 'パーティーから はずす'
      : 'パーティーに いれる';
    document.querySelector('#device-prev').disabled = selected === 1;
    document.querySelector('#device-next').disabled = selected === POKEDEX_SIZE;
    document.querySelector('#device-jump').value = String(selected);
    status(
      !supported
        ? 'この端末では よみあげを利用できません'
        : !mon.description
          ? 'せつめいは これから追加されます'
          : 'ボタンを押すと せつめいを読むよ',
    );
    updateSpeechButton();
  }
  function select(id) {
    if (!validPokemonId(id)) return;
    stopReading();
    selected = id;
    renderEntry();
  }
  function renderList() {
    const owned = new Set(state.owned),
      seen = new Set([...(state.seen || []), ...state.owned]),
      filter = currentFilter(),
      entries = filteredEntries();
    filter.page = Math.max(0, Math.min(filter.page, Math.ceil(entries.length / LIST_SIZE) - 1));
    const start = filter.page * LIST_SIZE;
    document.querySelector('#device-list-count').textContent =
      replaceSlot === null
        ? `みつけた ${seen.size}　つかまえた ${owned.size}`
        : '入れ替える ポケモンを えらぼう';
    const active = !!filter.name || filter.type !== null;
    document.querySelector('#device-filter-summary').textContent = [
      filter.name ? `「${filter.name}」ではじまる` : '',
      filter.type !== null ? `${types[filter.type]}タイプ` : '',
      active
        ? `${entries.length}匹`
        : replaceSlot === null
          ? 'すべての 図鑑番号'
          : `えらべる ${entries.length}匹`,
    ]
      .filter(Boolean)
      .join(' ・ ');
    document.querySelector('#device-filter-reset').disabled = !active;
    document.querySelector('#device-name-filter').setAttribute('aria-pressed', !!filter.name);
    document
      .querySelector('#device-type-filter')
      .setAttribute('aria-pressed', filter.type !== null);
    document.querySelectorAll('[data-filter-type]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.filterType === String(filter.type));
    });
    document.querySelector('#device-list-rows').innerHTML = entries.length
      ? entries
          .slice(start, start + LIST_SIZE)
          .map((mon) => {
            const known = seen.has(mon.id),
              inParty = state.party.includes(mon.id);
            return `<button class="device-list-row" data-dex-id="${mon.id}" ${known ? '' : 'disabled'}><span class="dex-caught">${owned.has(mon.id) ? '<img src="assets/poke-ball.jpg" alt="つかまえた">' : ''}</span><span>No.${pokemonNumber(mon.id)}</span><strong>${known ? mon.label : '────'}${
              known
                ? `<small>${pokemonTypes(mon)
                    .map((type) => types[type])
                    .join('・')}${inParty ? ' ／ パーティー' : ''}</small>`
                : ''
            }</strong></button>`;
          })
          .join('')
      : '<p class="device-empty">みつからなかったよ<br><small>なまえや タイプを 変えてみよう</small></p>';
    document.querySelector('#device-list-page').textContent = entries.length
      ? `${start + 1}–${Math.min(start + LIST_SIZE, entries.length)} / ${entries.length}`
      : '0 / 0';
    document.querySelector('#device-list-prev').disabled = filter.page === 0;
    document.querySelector('#device-list-next').disabled = start + LIST_SIZE >= entries.length;
    document.querySelector('#device-list-rows').scrollTop = 0;
  }
  function view(mode) {
    stopReading();
    closeFilterPanel();
    dialog.dataset.view = mode;
    document.querySelector('#device-list-view').hidden = mode !== 'list';
    document.querySelector('#device-list-tab').setAttribute('aria-pressed', mode === 'list');
    document.querySelector('#device-detail-tab').setAttribute('aria-pressed', mode === 'detail');
    if (mode === 'list') renderList();
  }
  function open(id) {
    if (busy || (id !== undefined && !validPokemonId(id))) return;
    replaceSlot = null;
    dialog.classList.remove('is-picking');
    select(id === undefined ? selected : id);
    if (id !== undefined) pageForSelected();
    view(id === undefined ? 'list' : 'detail');
    if (!dialog.open) {
      dialog.showModal();
      sound('dexOpen');
      clearTimeout(openingTimer);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        dialog.classList.add('is-opening');
        openingTimer = setTimeout(() => dialog.classList.remove('is-opening'), 550);
      }
    }
  }
  function openPicker(slot) {
    if (busy || !Number.isInteger(slot) || slot < 0 || slot >= PARTY_SIZE) return;
    open();
    replaceSlot = slot;
    dialog.classList.add('is-picking');
    view('list');
  }
  function replaceWith(id) {
    if (busy || replaceSlot === null || !state.owned.includes(id)) return;
    const slot = replaceSlot,
      next = [...state.party],
      old = next[slot],
      existing = next.indexOf(id);
    if (existing >= 0) {
      if (old) {
        next[slot] = id;
        next[existing] = old;
      } else {
        dialog.close();
        return;
      }
    } else if (old) next[slot] = id;
    else next.push(id);
    const error = partyTypeError(next);
    if (error) {
      document.querySelector('#device-list-count').textContent = error;
      sound('dexError');
      return;
    }
    state.party = next;
    render();
    dialog.close();
  }
  function read() {
    if (utterance) {
      stopReading();
      sound('dexPage');
      status('よみあげを とめました');
      return;
    }
    const mon = POKEDEX[selected - 1];
    if (
      !supported ||
      !soundEnabled ||
      (window.PokekoroAudioMix?.get('se') ?? 1) === 0 ||
      !pokemonSeen(selected) ||
      !mon.description
    )
      return;
    stopReading();
    const token = speechToken;
    utterance = new SpeechSynthesisUtterance(mon.label + '。' + mon.description);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.92;
    utterance.pitch = 0.95;
    utterance.volume = window.PokekoroAudioMix?.get('se') ?? 1;
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('ja'));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      if (token === speechToken) {
        dialog.classList.add('is-speaking');
        status('よみあげ中…');
        updateSpeechButton();
      }
    };
    function finished(error) {
      if (token !== speechToken) return;
      utterance = null;
      speechFocus(false);
      dialog.classList.remove('is-speaking');
      updateSpeechButton();
      status(error ? 'よみあげを始められませんでした。もう一度ためしてね' : 'よみおわりました');
    }
    utterance.onend = () => finished(false);
    utterance.onerror = (event) => finished(!['canceled', 'interrupted'].includes(event.error));
    try {
      sound('dexRead');
      speechFocus(true);
      synth.speak(utterance);
      updateSpeechButton();
    } catch {
      finished(true);
    }
  }
  document.querySelector('#device-kana-grid').innerHTML = kanaRows
    .map((row) =>
      [...row]
        .map((letter) =>
          letter === ' '
            ? '<span aria-hidden="true"></span>'
            : `<button type="button" data-kana="${letter}">${letter}</button>`,
        )
        .join(''),
    )
    .join('');
  document.querySelector('#device-type-grid').innerHTML = [
    { id: null, label: 'すべて' },
    ...types.map((label, id) => ({ id, label })),
  ]
    .map(
      ({ id, label }) =>
        `<button type="button" data-filter-type="${id}" aria-pressed="false">${label}</button>`,
    )
    .join('');
  document.querySelector('#device-name-filter').onclick = () => showFilterPanel('name');
  document.querySelector('#device-type-filter').onclick = () => showFilterPanel('type');
  document.querySelector('#device-filter-reset').onclick = () => {
    Object.assign(currentFilter(), { name: '', type: null, page: 0 });
    renderList();
    updateFilterQuery();
  };
  document.querySelector('#device-kana-grid').onclick = (event) => {
    const button = event.target.closest('[data-kana]');
    if (button) changeName(currentFilter().name + button.dataset.kana);
  };
  document.querySelector('#device-name-long').onclick = () =>
    changeName(currentFilter().name + 'ー');
  document.querySelector('#device-name-backspace').onclick = () =>
    changeName(currentFilter().name.slice(0, -1));
  document.querySelector('#device-name-clear').onclick = () => changeName('');
  document.querySelector('#device-name-voice').onclick = () => transformLast('voice');
  document.querySelector('#device-name-small').onclick = () => transformLast('small');
  document.querySelector('#device-type-grid').onclick = (event) => {
    const button = event.target.closest('[data-filter-type]');
    if (!button) return;
    currentFilter().type =
      button.dataset.filterType === 'null' ? null : Number(button.dataset.filterType);
    currentFilter().page = 0;
    renderList();
    updateFilterQuery();
  };
  function finishFiltering() {
    const kind = filterPanel;
    closeFilterPanel();
    document
      .querySelector(kind === 'type' ? '#device-type-filter' : '#device-name-filter')
      .focus({ preventScroll: true });
  }
  document.querySelector('#device-filter-done').onclick = finishFiltering;
  document.querySelector('#device-filter-apply').onclick = finishFiltering;
  dialog.addEventListener('cancel', (event) => {
    if (!filterPanel) return;
    event.preventDefault();
    finishFiltering();
  });
  document.querySelector('#device-list-tab').onclick = () => {
    pageForSelected();
    view('list');
  };
  document.querySelector('#device-detail-tab').onclick = () => view('detail');
  document.querySelector('#device-list-prev').onclick = () => {
    currentFilter().page = Math.max(0, currentFilter().page - 1);
    renderList();
  };
  document.querySelector('#device-list-next').onclick = () => {
    currentFilter().page++;
    renderList();
  };
  document.querySelector('#device-list-rows').onclick = (event) => {
    const row = event.target.closest('[data-dex-id]');
    if (row && !row.disabled) {
      if (replaceSlot !== null) replaceWith(Number(row.dataset.dexId));
      else {
        sound('dexPage');
        select(Number(row.dataset.dexId));
        view('detail');
      }
    }
  };
  document.querySelector('#open-pokedex').onclick = () => open();
  document.querySelector('#device-close').onclick = () => dialog.close();
  document.querySelector('#device-speak').onclick = read;
  document.querySelector('#device-prev').onclick = () => select(selected - 1);
  document.querySelector('#device-next').onclick = () => select(selected + 1);
  document.querySelector('#device-jump').addEventListener('change', (event) => {
    const id = Number(event.target.value);
    if (validPokemonId(id)) {
      select(id);
      sound('dexPage');
    } else {
      event.target.value = String(selected);
      status('1〜1025の 番号をいれてね');
      sound('dexError');
    }
  });
  document.querySelector('#device-party').onclick = () => {
    const message = togglePokemonParty(selected);
    renderEntry();
    if (message) status(message);
    sound(message ? 'dexError' : 'dexPage');
  };
  dialog.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (
      !button ||
      button.disabled ||
      !dialog.open ||
      ['device-close', 'device-speak', 'device-party'].includes(button.id) ||
      button.hasAttribute('data-dex-id')
    )
      return;
    sound('dexPage');
  });
  dialog.addEventListener('close', () => {
    sound('dexClose');
    replaceSlot = null;
    closeFilterPanel();
    dialog.classList.remove('is-picking');
    stopReading();
    clearTimeout(openingTimer);
    dialog.classList.remove('is-opening');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopReading();
  });
  window.addEventListener('pagehide', stopReading);
  document.addEventListener('title:soundchange', (event) => {
    soundEnabled = !!event.detail.enabled;
    if (!soundEnabled) stopReading();
    updateSpeechButton();
  });
  document.addEventListener('audio:mixchange', () => {
    if ((window.PokekoroAudioMix?.get('se') ?? 1) === 0) stopReading();
    updateSpeechButton();
  });
  window.PokekoroDex = Object.freeze({ open, openPicker });
})();
