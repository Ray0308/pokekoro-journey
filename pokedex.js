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
    soundEnabled = true,
    listPage = 0;
  const LIST_SIZE = 24;
  let replaceSlot = null;
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
      start = listPage * LIST_SIZE;
    document.querySelector('#device-list-count').textContent =
      replaceSlot === null
        ? `みつけた ${seen.size}　つかまえた ${owned.size}`
        : '入れ替える ポケモンを えらぼう';
    document.querySelector('#device-list-rows').innerHTML = POKEDEX.slice(start, start + LIST_SIZE)
      .map(
        (mon) =>
          `<button class="device-list-row" data-dex-id="${mon.id}" ${(replaceSlot === null ? seen.has(mon.id) : owned.has(mon.id)) ? '' : 'disabled'}><span class="dex-caught">${owned.has(mon.id) ? '<img src="assets/poke-ball.jpg" alt="つかまえた">' : ''}</span><span>No.${pokemonNumber(mon.id)}</span><strong>${seen.has(mon.id) ? mon.label : '────'}</strong></button>`,
      )
      .join('');
    document.querySelector('#device-list-page').textContent =
      `${start + 1}–${Math.min(start + LIST_SIZE, POKEDEX_SIZE)} / ${POKEDEX_SIZE}`;
    document.querySelector('#device-list-prev').disabled = listPage === 0;
    document.querySelector('#device-list-next').disabled = start + LIST_SIZE >= POKEDEX_SIZE;
    document.querySelector('#device-list-rows').scrollTop = 0;
  }
  function view(mode) {
    stopReading();
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
    if (id !== undefined) listPage = Math.floor((id - 1) / LIST_SIZE);
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
    listPage = 0;
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
  document.querySelector('#device-list-tab').onclick = () => {
    listPage = Math.floor((selected - 1) / LIST_SIZE);
    view('list');
  };
  document.querySelector('#device-detail-tab').onclick = () => view('detail');
  document.querySelector('#device-list-prev').onclick = () => {
    listPage = Math.max(0, listPage - 1);
    renderList();
  };
  document.querySelector('#device-list-next').onclick = () => {
    listPage = Math.min(Math.ceil(POKEDEX_SIZE / LIST_SIZE) - 1, listPage + 1);
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
