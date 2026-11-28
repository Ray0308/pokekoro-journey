'use strict';
// モードは戦闘開始時に固定し、途中の切替・リフレッシュで手数を戻さない。
(() => {
  const rules = ThoughtfulPuzzleRules;
  const key = 'pokekoro-puzzle-mode-v1';
  const select = $('#puzzle-mode');
  let mode = 'timed';
  try {
    if (localStorage.getItem(key) === 'thoughtful') mode = 'thoughtful';
  } catch {
    /* 保存不可でもメモリ上で遊べる。 */
  }
  select.value = mode;
  select.onchange = () => {
    mode = select.value === 'thoughtful' ? 'thoughtful' : 'timed';
    try {
      localStorage.setItem(key, mode);
    } catch {
      /* 設定保存は任意。 */
    }
  };
  const panel = document.createElement('section');
  panel.id = 'thoughtful-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'じっくりパズルのお題');
  panel.innerHTML =
    '<div class="thoughtful-heading"><strong>じっくり・3手でアタック</strong><button id="thoughtful-hint" type="button">💡 ヒント</button></div><div id="thoughtful-goal" role="status" aria-live="polite"></div><div id="thoughtful-choices" aria-label="達成ボーナス"></div>';
  $('.puzzle-stage').before(panel);
  const active = () => !!battle?.thoughtfulMode;
  function init(current) {
    current.thoughtfulMode = mode === 'thoughtful' && !!current.combat;
    $('#battle').classList.toggle('thoughtful-battle', current.thoughtfulMode);
    current.thoughtful = null;
    prepare();
  }
  function prepare() {
    if (!active()) {
      render();
      return;
    }
    const round = battle.combat.turn + 1;
    if (!battle.thoughtful || battle.thoughtful.round !== round)
      battle.thoughtful = rules.create({
        trainer: battle.trainer,
        boss: battle.boss,
        pool: battle.puzzleTypes,
        round,
      });
    render();
  }
  function render() {
    panel.hidden = !active() || battle.phase === 'skills' || battle.phase === 'finished';
    if (!active()) {
      $('#puzzle-refresh').textContent = '↻ リフレッシュ';
      $('#puzzle-refresh').title = '時間は止めずに盤面を並べ直す';
      return;
    }
    const plan = battle.thoughtful;
    if (!plan) return;
    const count = rules.config.moves - plan.used;
    $('#clock').textContent = `あと${count}手`;
    $('#timebar').style.width = `${(count / rules.config.moves) * 100}%`;
    $('#thoughtful-goal').textContent =
      `${rules.achieved(plan) ? '★ たっせい！' : '🎯'} ${plan.goal.label}（${rules.progress(plan)}/${plan.goal.target}）${plan.trainer && !plan.boss && plan.goal.kind !== 'total' ? ` ＋合計12こ（${plan.total}/12）` : ''}`;
    const choices = $('#thoughtful-choices');
    choices.replaceChildren();
    for (const choice of plan.boss ? ['power', 'gauge'] : ['power']) {
      const button = document.createElement(plan.boss ? 'button' : 'span');
      if (plan.boss) button.type = 'button';
      button.textContent = choice === 'power' ? '⚔ 達成で パワー×1.5' : '⚡ 達成で 全員ゲージ＋4';
      button.dataset.thoughtfulChoice = choice;
      if (plan.boss) {
        button.setAttribute('aria-pressed', String(plan.choice === choice));
        button.disabled = battle.phase !== 'ready' || plan.used > 0;
        button.onclick = () => {
          if (battle.phase === 'ready' && rules.choose(plan, choice)) render();
        };
      }
      choices.append(button);
    }
    requestAnimationFrame(fitBattle);
    $('#thoughtful-hint').disabled = !running || preparing;
    $('#puzzle-refresh').textContent = '↻ ならべなおす';
    $('#puzzle-refresh').title = '手数を使わず盤面を並べ直す（お題と達成状況はそのまま）';
  }
  function ready() {
    render();
    if (!active()) return;
    $('#ready-overlay').innerHTML =
      '<strong>じっくり 考えよう！</strong><span>時間制限なし・3回つないだら攻撃<br>お題たっせいで ボーナス！</span>';
    $('#puzzle-tip').textContent = '3こ以上つなごう。お題はできなくても攻撃できるよ';
  }
  function commit(count, type) {
    if (!active()) return;
    const plan = battle.thoughtful;
    if (!rules.record(plan, count, type)) return;
    const result = rules.settle(plan);
    if (result) {
      if (result.multiplier > 1) {
        let total = 0;
        for (const type of Object.keys(battle.typeCharge)) {
          battle.typeCharge[type] = Math.round(battle.typeCharge[type] * result.multiplier);
          total += battle.typeCharge[type];
        }
        battle.damage = total;
      }
      if (result.gauge) {
        for (const member of battle.combat.members) {
          if (member.fainted) continue;
          member.gauge = Math.min(PokemonSkillRules.cost(member.id), member.gauge + result.gauge);
          if (member.gauge === PokemonSkillRules.cost(member.id)) member.gaugeProgress = 0;
        }
      }
      updateCharge();
      render();
      void resolveAttack();
    } else render();
  }
  $('#thoughtful-hint').onclick = () => {
    if (!active() || !running || preparing || drag) return;
    const preferred = battle.puzzleTypes.filter(
      (type) =>
        partyTypePower(PokekoroTurns.aliveParty(), type, battle.m) > 0 &&
        battleTypeMultiplier(type, battle) > 0,
    );
    puzzleAssist.update(grid, preferred, performance.now() + 1501, false);
    draw();
  };
  window.PokekoroThoughtful = { active, init, prepare, render, ready, commit };
})();
