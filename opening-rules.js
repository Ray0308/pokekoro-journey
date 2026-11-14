'use strict';
// 初回進行は本編の在庫と分離する。旧セーブには初回報酬を付与しない。
const OpeningRules = (() => {
  const stages = [
    'meet',
    'friend',
    'lab',
    'world',
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
      opening: { version: 1, stage: 'meet', starterId: null },
    };
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
    return state;
  }
  function complete(state) {
    const o = state.opening;
    if (o.stage === 'complete' || !starters.includes(o.starterId)) return false;
    state.party = [446, o.starterId, 25];
    state.owned = [...new Set([...state.owned, ...state.party])];
    state.seen = [...new Set([...(state.seen || []), ...state.party])];
    state.balls += 8;
    state.super += 2;
    o.stage = 'complete';
    o.pokedexReceived = true;
    return true;
  }
  return Object.freeze({ fresh, normalize, complete, stages, starters });
})();
if (typeof module !== 'undefined') module.exports = OpeningRules;
