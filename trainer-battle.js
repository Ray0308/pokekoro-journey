'use strict';
// 連戦の進行と送球演出。編成の抽選はtrainer-rules.js、報酬の確定は既存endBattleが担当する。
// パズルの秒数・HPではなく、撃破後と送球の見せ方だけを調整する。
const TRAINER_PRESENTATION = Object.freeze({
  impactSettleMs: 420,
  defeatedHoldMs: 760,
  completionHoldMs: 1350,
  nextLineMs: 450,
  aceLineMs: 800,
  sendMs: 850,
});
function trainerRosterMarkup(series, currentDefeated = false) {
  if (!series) return '';
  const defeated = series.index + (currentDefeated ? 1 : 0);
  return series.team
    .map(
      (_, index) =>
        `<i class="trainer-ball${index < defeated ? ' defeated' : index === series.index ? ' active' : ''}" aria-hidden="true"><b></b></i>`,
    )
    .join('');
}
function setTrainerRoster(element, series, currentDefeated = false) {
  element.hidden = !series;
  if (!series) {
    element.replaceChildren();
    return;
  }
  const remaining = Math.max(0, series.team.length - series.index - (currentDefeated ? 1 : 0));
  element.setAttribute('aria-label', `相手の手持ち${series.team.length}匹、残り${remaining}匹`);
  element.innerHTML = trainerRosterMarkup(series, currentDefeated);
}
function hasNextTrainerPokemon() {
  return !!battle?.series && battle.series.index < battle.series.team.length - 1;
}
// 旧編成データのsecondsではなく、戦闘は10秒・サファリは30秒を使う。
function battleDuration() {
  return battle?.safari ? 30 : BattleTurnRules.config.seconds;
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
  dialog.classList.toggle('trainer-last-pokemon', !hasNextTrainerPokemon());
  dialog.dataset.phase = 'boss-line';
  $('#encounter-speech').textContent = hasNextTrainerPokemon()
    ? '「つぎは このこで しょうぶだ！」'
    : '「さいごの きりふだだ！」';
  $('#encounter-label').textContent = hasNextTrainerPokemon()
    ? profile.name + 'の つぎの ポケモン！'
    : 'さいごの １匹！';
  $('#encounter-name').textContent = profile.name;
  $('#encounter-go').disabled = true;
  $('#encounter-go').textContent = 'バトル スタート！';
  dialog.showModal();
  await Promise.all([trainer, image, ball].map((node) => node.decode().catch(() => {})));
  if (epoch !== battleEpoch || !dialog.open) return;
  await new Promise((resolve) =>
    setTimeout(
      resolve,
      reduceMotion
        ? 120
        : hasNextTrainerPokemon()
          ? TRAINER_PRESENTATION.nextLineMs
          : TRAINER_PRESENTATION.aceLineMs,
    ),
  );
  if (epoch !== battleEpoch || !dialog.open) return;
  dialog.dataset.phase = 'boss-send';
  $('#encounter-name').textContent = 'いけ！ ' + battle.m.label + '！';
  sfx('ballThrow');
  await new Promise((resolve) =>
    setTimeout(resolve, reduceMotion ? 120 : TRAINER_PRESENTATION.sendMs),
  );
  if (epoch !== battleEpoch || !dialog.open) return;
  dialog.dataset.phase = 'revealed';
  $('#encounter-name').textContent = battle.m.label;
  $('#encounter-img').alt = battle.m.label;
  $('#encounter-go').disabled = false;
  tone(740, 0.12);
  // 次の相手は先に戦闘画面へ出す。パズルの開始はそこでスタートを押すまで待つ。
  $('#encounter-go').click();
}
