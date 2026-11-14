const assert = require('node:assert/strict');
const rules = require('../opening-rules.js');
for (const id of rules.starters) {
  const state = rules.fresh();
  assert.deepEqual(state.party, [446]);
  state.opening.starterId = id;
  state.opening.stage = 'depart';
  assert.equal(rules.complete(state), true);
  assert.deepEqual(state.party, [446, id, 25]);
  assert.deepEqual(state.owned, [446, id, 25]);
  assert.equal(state.owned.includes(32), false);
  assert.equal(state.seen.includes(32), false);
  assert.equal(state.balls, 8);
  assert.equal(state.super, 2);
  assert.equal(rules.complete(state), false);
  assert.equal(state.balls, 8);
}
const legacy = {
  owned: [1, 4, 7, 150],
  party: [1, 4, 7],
  balls: 79,
  super: 45,
  pos: 8,
  mapId: 'cerulean-city',
};
const before = structuredClone(legacy);
rules.normalize(legacy, true);
assert.equal(legacy.opening.stage, 'complete');
assert.equal(rules.complete(legacy), false);
delete legacy.opening;
assert.deepEqual(legacy, before);
const partial = rules.fresh();
partial.opening = { stage: 'throw', starterId: 7 };
assert.equal(rules.normalize(partial, true).opening.stage, 'throw');
partial.opening.starterId = 150;
assert.equal(rules.normalize(partial, true).opening.stage, 'choose');
assert.equal(rules.complete(partial), false);
console.log(
  'Opening: new/legacy saves, all starters, resume, loan isolation and one-time gifts OK',
);
