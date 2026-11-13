'use strict';
// 連戦の進行と送球演出。編成の抽選はtrainer-rules.js、報酬の確定は既存endBattleが担当する。
function hasNextTrainerPokemon() {
  return !!battle?.series && battle.series.index < battle.series.team.length - 1;
}
function battleDuration() {
  return battle?.roundSeconds || 30;
}
function nextTrainerRound() {
  if (!hasNextTrainerPokemon() || !battle.roundStarted || battle.roundClosed) return;
  battle.roundClosed = true;
  battle.rewardResolved = true;
  battleEpoch++;
  preparing = running = drag = false;
  cancelAnimationFrame(raf);
  const next = { ...battle.series, index: battle.series.index + 1 };
  $('#battle').close();
  openBattle(true, battle.boss, next);
}
async function showNextTrainerEncounter() {
  const dialog = $('#encounter'),
    epoch = battleEpoch,
    profile = battle.trainerAppearance;
  const trainer = $('#encounter-trainer'),
    image = $('#encounter-img'),
    ball = $('#encounter-send-ball');
  trainer.src = profile.image;
  trainer.alt = profile.name;
  ball.src = profile.ball;
  dialog.classList.add('boss-encounter');
  dialog.dataset.phase = 'boss-line';
  $('#encounter-speech').textContent = hasNextTrainerPokemon()
    ? '「つぎは このこで しょうぶだ！」'
    : '「さいごの きりふだだ！」';
  $('#encounter-label').textContent = profile.name + 'の つぎの ポケモン！';
  $('#encounter-name').textContent =
    `${battle.series.index + 1} / ${battle.series.team.length}ひきめ`;
  $('#encounter-go').disabled = true;
  dialog.showModal();
  await Promise.all([trainer, image, ball].map((node) => node.decode().catch(() => {})));
  if (epoch !== battleEpoch || !dialog.open) return;
  await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 120 : 650));
  if (epoch !== battleEpoch || !dialog.open) return;
  dialog.dataset.phase = 'boss-send';
  $('#encounter-name').textContent = 'いけ！ ' + battle.m.label + '！';
  sfx('ballThrow');
  await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 120 : ENCOUNTER_TIMING.sendMs));
  if (epoch !== battleEpoch || !dialog.open) return;
  dialog.dataset.phase = 'revealed';
  $('#encounter-name').textContent = battle.m.label;
  $('#encounter-img').alt = battle.m.label;
  $('#encounter-go').disabled = false;
  tone(740, 0.12);
}
