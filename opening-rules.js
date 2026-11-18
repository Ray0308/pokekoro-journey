'use strict';
// 初回進行は本編の在庫と分離する。旧セーブには初回報酬を付与しない。
const OpeningRules = (() => {
  const stages = [
    'meet',
    'friend',
    'lab',
    'world',
    'oakGreeting',
    'oakIntro',
    'oakWorld',
    'oakLife',
    'oakResearch',
    'oakGonbe',
    'oakFriend',
    'nameLead',
    'nameInput',
    'nameConfirm',
    'nameWelcome',
    'nameJourney',
    'nameGift',
    'nameChoose',
    'choose',
    'chosen',
    'borrow',
    'practice',
    'throw',
    'caught',
    'return',
    'dex',
    'register',
    'depart',
    'partyLesson',
    'diceLesson',
    'complete',
  ];
  const starters = [1, 4, 7];
  function fresh() {
    return {
      owned: [446],
      party: [446],
      pos: 0,
      lap: 1,
      balls: 0,
      super: 0,
      opening: { version: 3, stage: 'meet', starterId: null },
    };
  }
  // 表示上の文字単位で最大8文字。結合文字やサロゲートペアを途中で切らない。
  const nameLimit = 8;
  const segmenter =
    typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
      : null;
  function normalizeName(value) {
    return typeof value === 'string' ? value.trim() : '';
  }
  function nameError(value) {
    const name = normalizeName(value);
    const count = segmenter ? [...segmenter.segment(name)].length : Array.from(name).length;
    return !name ? 'なまえを いれてね。' : count > nameLimit ? 'なまえは 8もじまでに してね。' : '';
  }
  function confirmName(state) {
    const o = state.opening;
    if (o.stage !== 'nameConfirm' || state.playerName || nameError(o.nameDraft)) return false;
    state.playerName = normalizeName(o.nameDraft);
    delete o.nameDraft;
    o.stage = 'nameWelcome';
    return true;
  }
  // 旧オープニングは従来の lab/world → choose 経路を維持し、名前を強制しない。
  function nextStage(state) {
    const o = state.opening;
    if (o.stage === 'friend') return o.version >= 2 ? 'oakGreeting' : 'lab';
    if (o.stage === 'world') return 'choose';
    return stages[stages.indexOf(o.stage) + 1];
  }
  function normalize(state, existing) {
    if (!state.opening || typeof state.opening !== 'object' || Array.isArray(state.opening))
      state.opening = { version: 1, stage: existing ? 'complete' : 'meet', starterId: null };
    const o = state.opening;
    if (!stages.includes(o.stage)) o.stage = existing ? 'complete' : 'meet';
    if (!starters.includes(o.starterId)) {
      o.starterId = null;
      if (stages.indexOf(o.stage) > stages.indexOf('choose') && o.stage !== 'complete')
        o.stage = 'choose';
    }
    if (typeof state.playerName === 'string' && !nameError(state.playerName))
      state.playerName = normalizeName(state.playerName);
    else delete state.playerName;
    if (state.playerName && ['nameLead', 'nameInput', 'nameConfirm'].includes(o.stage))
      o.stage = 'nameWelcome';
    if (o.stage === 'nameConfirm' && nameError(o.nameDraft)) o.stage = 'nameInput';
    return state;
  }
  function complete(state) {
    const o = state.opening;
    if (o.stage === 'complete' || o.pokedexReceived || !starters.includes(o.starterId))
      return false;
    state.party = [446, o.starterId, 25];
    state.owned = [...new Set([...state.owned, ...state.party])];
    state.seen = [...new Set([...(state.seen || []), ...state.party])];
    state.balls += 8;
    state.super += 2;
    o.stage = 'complete';
    o.pokedexReceived = true;
    return true;
  }
  return Object.freeze({
    fresh,
    normalize,
    complete,
    stages,
    starters,
    nameLimit,
    normalizeName,
    nameError,
    confirmName,
    nextStage,
  });
})();
if (typeof module !== 'undefined') module.exports = OpeningRules;
