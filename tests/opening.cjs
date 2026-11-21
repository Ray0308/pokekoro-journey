const assert = require('node:assert/strict');
const rules = require('../opening-rules.js');
for (const id of rules.starters) {
  const state = rules.fresh();
  assert.deepEqual(state.party, []);
  state.opening.starterId = id;
  state.opening.stage = 'depart';
  assert.equal(rules.complete(state), true);
  assert.deepEqual(state.party, [id, 446, 25]);
  assert.deepEqual(state.owned, [id, 446, 25]);
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

// 新規だけ名前経路へ進め、旧版の途中セーブは従来経路を維持する。
const named = rules.fresh();
assert.equal(named.opening.version, 5);
named.opening.stage = 'friend';
assert.equal(rules.nextStage(named), 'oakGreeting');
for (const stage of ['meet', 'friend', 'lab', 'world', 'choose', 'practice', 'complete']) {
  const old = { ...rules.fresh(), opening: { version: 1, stage, starterId: 4 } };
  const snapshot = structuredClone(old);
  rules.normalize(old, true);
  assert.deepEqual(old, snapshot);
  if (stage === 'friend') assert.equal(rules.nextStage(old), 'lab');
  if (stage === 'world') assert.equal(rules.nextStage(old), 'choose');
}
for (const input of ['', ' ', '　 \t\n', 'あいうえおかきくけ', '123456789'])
  assert.notEqual(rules.nameError(input), '');
for (const input of ['さとし', 'サトシ', '智', 'Player01', 'か\u3099'.repeat(8)])
  assert.equal(rules.nameError(input), '');
assert.equal(rules.normalizeName('　 サトシ  '), 'サトシ');
named.opening.stage = 'nameConfirm';
named.opening.nameDraft = '　ヒカリ　';
assert.equal(rules.confirmName(named), true);
assert.equal(named.playerName, 'ヒカリ');
assert.equal(named.opening.stage, 'nameWelcome');
assert.equal('nameDraft' in named.opening, false);
assert.equal(rules.confirmName(named), false);
assert.equal(rules.normalize(JSON.parse(JSON.stringify(named)), true).playerName, 'ヒカリ');
const interrupted = rules.fresh();
interrupted.opening.stage = 'nameConfirm';
interrupted.opening.nameDraft = 'ハルカ';
assert.equal(rules.normalize(interrupted, true).opening.stage, 'nameConfirm');
assert.equal(interrupted.playerName, undefined);
interrupted.opening.nameDraft = '　';
assert.equal(rules.normalize(interrupted, true).opening.stage, 'nameInput');
interrupted.playerName = 'ハルカ';
assert.equal(rules.normalize(interrupted, true).opening.stage, 'nameWelcome');
assert.equal(rules.fresh().playerName, undefined);
console.log('Opening names: validation, Unicode, confirmation, resume and legacy route OK');

// 初回報酬を受け取った後、編成練習中の再読込でも再付与しない。
const learning = rules.fresh();
learning.opening.starterId = 4;
learning.opening.stage = 'depart';
assert.equal(rules.complete(learning), true);
learning.opening.stage = 'partyLesson';
const learningSaved = JSON.parse(JSON.stringify(learning));
assert.equal(rules.normalize(learningSaved, true).opening.stage, 'partyLesson');
assert.equal(rules.complete(learningSaved), false);
assert.equal(learningSaved.balls, 8);
assert.equal(learningSaved.super, 2);

// 研究所での紹介と同行の選択より前に、ゴンベを勝手に所持させない。
const intro = rules.fresh();
assert.equal(intro.opening.stage, 'oakGreeting');
assert.deepEqual(intro.owned, []);
assert.equal(rules.awaitingCompanion(intro), true);
intro.opening.stage = 'oakResearch';
assert.equal(rules.nextStage(intro), 'nameLead');
intro.opening.stage = 'nameLead';
assert.equal(rules.nextStage(intro), 'nameChoice');
assert.deepEqual(rules.nameChoices, ['じぶんできめる', 'グリーン', 'レッド', 'レン']);
intro.opening.stage = 'nameJourney';
assert.equal(rules.nextStage(intro), 'oakGonbe');
intro.opening.stage = 'oakFriend';
assert.equal(rules.nextStage(intro), 'companionInvite');
assert.equal(rules.acceptCompanion(intro), false);
intro.opening.stage = 'companionInvite';
assert.equal(rules.acceptCompanion(intro), true);
assert.deepEqual(intro.owned, [446]);
assert.deepEqual(intro.party, [446]);
assert.equal(intro.opening.stage, 'nameGift');
assert.equal(rules.acceptCompanion(intro), false);
assert.equal(rules.awaitingCompanion(intro), false);
const keyboard = require('../opening-name.js');
assert.equal(keyboard.append('レ', 'ン', 8), 'レン');
assert.equal(keyboard.append('12345678', '9', 8), null);
assert.equal(keyboard.mark('カ', '゛'), 'ガ');
assert.equal(keyboard.mark('ガ', '゛'), 'カ');
assert.equal(keyboard.mark('ハ', '゜'), 'パ');
assert.equal(keyboard.mark('パ', '゛'), 'バ');
assert.equal(keyboard.mark('う', '゛'), 'ゔ');
assert.equal(keyboard.mark('A', '゛'), null);
assert.equal(keyboard.erase('か\u3099'), '');
assert.equal(keyboard.erase('レン'), 'レ');
assert.equal(keyboard.append('か'.repeat(7), 'か\u3099', 8), 'か'.repeat(7) + 'が');
console.log(
  'PASS laboratory invitation, explicit companion joining, preset names and kana editing',
);

assert.equal(keyboard.toHiragana('ー'), 'ー');
assert.equal(keyboard.toHiragana('ァ'), 'ぁ');

const oldPractice = {
  ...rules.fresh(),
  owned: [446],
  party: [446],
  opening: { version: 4, stage: 'practice', starterId: 4, practiceStep: 'gray' },
  balls: 0,
  super: 0,
};
rules.normalize(oldPractice, true);
assert.equal(oldPractice.opening.version, 5);
assert.equal(oldPractice.opening.practiceStep, undefined);
assert.deepEqual(oldPractice.owned, [446]);
const v4 = { ...rules.fresh(), opening: { version: 4, stage: 'depart', starterId: 4 } };
rules.complete(v4);
assert.deepEqual(v4.party, [446, 4, 25]);
