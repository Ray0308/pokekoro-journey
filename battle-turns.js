'use strict';
// 10秒パズル→一斉攻撃→任意の技→反撃を接続する。各待機後に世代を確認する。
(() => {
  const rules = BattleTurnRules;
  let selected = null;
  const panel = document.querySelector('#turn-actions'),
    roster = document.querySelector('#battle-party');
  const enabled = () => !!battle?.combat && !battle.safari;
  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, reduceMotion ? Math.min(ms, 120) : ms));
  function init(current) {
    current.combat = current.safari ? null : current.series?.combat || rules.create(state.party);
    if (current.series) current.series.combat = current.combat;
    current.attackTotal = 0;
    selected = null;
    $('#battle').classList.remove('in-skill-break');
    $('#turn-next').disabled = false;
    panel.hidden = true;
    $('#battle').classList.toggle('turn-battle', !!current.combat);
    render();
  }
  function render() {
    roster.hidden = !enabled();
    $('#battle-turn-status').hidden = !enabled();
    if (!enabled()) return;
    const combat = battle.combat;
    const matchup = bestTypeMatchup(battle.m, partyTypes(rules.alive(combat)));
    $('#weakness-tip').textContent =
      matchup?.factor > 1
        ? `${icons[matchup.type]} ${types[matchup.type]} ×${matchup.factor}で こうかばつぐん！`
        : matchup?.factor === 0
          ? 'こうかのある属性なし。技や編成を見直そう'
          : '戦える仲間の 属性をつなごう！';
    if (battle.phase === 'skills' && !combat.members.some((m) => m.id === selected && !m.fainted))
      selected =
        combat.members.find((m) => !m.fainted && m.gauge >= rules.config.gauge)?.id ??
        combat.members.find((m) => !m.fainted)?.id ??
        null;
    $('#battle-turn-status').textContent =
      `${Math.max(1, combat.turn)} / ${rules.config.maxTurns}ターン・${rules.config.seconds}秒${combat.guard ? ' ｜ ガード待機' : ''}${combat.nextBoost > 1 ? ' ｜ 次は×1.5' : ''}${combat.boost > 1 && battle.phase === 'charging' ? ' ｜ 攻撃×1.5' : ''}`;
    roster.innerHTML = combat.members
      .map((m) => {
        const mon = POKEDEX[m.id - 1],
          ready = m.gauge >= rules.config.gauge;
        return `<button type="button" data-battle-member="${m.id}" class="${m.fainted ? 'is-fainted' : ready ? 'skill-ready' : ''}" ${battle.phase !== 'skills' || m.fainted ? 'disabled' : ''} aria-pressed="${selected === m.id}" aria-label="${mon.label} ${m.fainted ? 'ひんし' : '技ゲージ' + m.gauge + '/' + rules.config.gauge}"><img src="${pokemonPortrait(m.id)}" alt=""><span>${m.fainted ? 'ひんし' : ready ? 'わざ OK' : m.gauge + '/' + rules.config.gauge}</span><i><b style="width:${(100 * m.gauge) / rules.config.gauge}%"></b></i></button>`;
      })
      .join('');
    if (battle.phase !== 'skills') return;
    const member =
      combat.members.find((m) => m.id === selected && !m.fainted) ||
      combat.members.find((m) => !m.fainted && m.gauge >= rules.config.gauge) ||
      combat.members.find((m) => !m.fainted);
    selected = member?.id ?? null;
    const mon = member && POKEDEX[member.id - 1],
      ready = member?.gauge >= rules.config.gauge;
    $('#turn-skill-name').textContent = mon ? mon.label + 'の わざ' : '戦える仲間が いない…';
    $('#turn-skill-help').textContent = ready
      ? 'ゲージを使う？ 温存してもいいよ'
      : `上の仲間を選ぼう。ゲージ${rules.config.gauge}で技が使えるよ`;
    if (mon)
      $('#turn-skill-help').textContent +=
        ` ｜ ${PokemonBattleStats.style(mon)}・わざの溜まり：${PokemonBattleStats.gaugeLabel(mon)}`;
    const damage = mon ? rules.attackDamage(mon.id, battle.m) : 0;
    $('#turn-skill-options').innerHTML = [
      [
        'attack',
        '全力アタック',
        `${types[mon?.type ?? 5]}・${damage}ダメージ`,
        !ready || damage === 0 || battle.hp === 0,
      ],
      [
        'boost',
        'パワーチャージ',
        '次の10秒の攻撃 ×1.5',
        !ready || combat.nextBoost > 1 || combat.turn >= rules.config.maxTurns,
      ],
      [
        'guard',
        'まもりのかべ',
        '次の反撃を1回 無効',
        !ready || combat.guard || combat.turn >= rules.config.maxTurns,
      ],
    ]
      .map(
        ([kind, name, help, disabled]) =>
          `<button data-battle-skill="${kind}" ${disabled ? 'disabled' : ''}><strong>${name}</strong><small>${help}</small></button>`,
      )
      .join('');
    $('#turn-next').textContent =
      battle.hp === 0
        ? 'つぎのポケモンへ'
        : combat.turn >= rules.config.maxTurns
          ? '敵の反撃へ'
          : '反撃を受けて 次の10秒へ';
  }
  function begin() {
    if (!enabled()) return true;
    if (battle.phase !== 'ready' || !rules.begin(battle.combat)) return false;
    $('#battle').classList.remove('in-skill-break');
    battle.damage = 0;
    battle.shownDamage = 0;
    battle.typeCharge = {};
    combo = 0;
    lastClear = 0;
    elapsed = 0;
    panel.hidden = true;
    render();
    return true;
  }
  function charge(type, cells) {
    if (!enabled()) return;
    const readyBefore = battle.combat.members.filter((m) => m.gauge >= rules.config.gauge).length;
    rules.charge(battle.combat, type, cells);
    if (battle.combat.members.filter((m) => m.gauge >= rules.config.gauge).length > readyBefore)
      sfx('breakthrough', 1);
    render();
  }
  function aliveParty() {
    return enabled() ? rules.alive(battle.combat) : state.party;
  }
  async function finish(epoch) {
    if (epoch !== battleEpoch) return;
    panel.hidden = true;
    $('#battle').classList.remove('in-skill-break');
    battle.phase = 'resolving';
    $('#leave').disabled = true;
    const exhausted = hasNextTrainerPokemon() && !rules.canContinue(battle.combat);
    if (!exhausted) markBattleVictory();
    else battle.lossReason = '６ターンで 相手を全員 たおしきれなかった！';
    window.PokekoroBattleFX?.defeat(2, battle.trainer && !hasNextTrainerPokemon());
    $('#ready-overlay').hidden = false;
    $('#ready-overlay').innerHTML = exhausted
      ? '<strong>６ターン 終了！</strong><span>あと少し…！ 次こそ勝とう！</span>'
      : `<strong>${battle.trainer && !hasNextTrainerPokemon() ? 'ぜんぶ たおした！' : battle.m.label + 'を<br>たおした！'}</strong><span>${hasNextTrainerPokemon() ? 'つぎの ポケモンが くるぞ！' : 'みんなの力で 勝利！'}</span>`;
    await wait(750);
    if (epoch !== battleEpoch) return;
    battle.damage = battle.attackTotal;
    battle.phase = 'finished';
    endBattle(!exhausted);
  }
  function openSkills() {
    $('#battle').classList.add('in-skill-break');
    window.PokekoroBattleFX?.reset();
    if (battle.hp === 0) window.PokekoroBattleFX?.defeat(1);
    $('#battle').classList.remove('resolving', 'attack-release');
    $('#ready-overlay').hidden = true;
    battle.phase = 'skills';
    battle.damage = battle.shownDamage = 0;
    updateCharge();
    selected = null;
    panel.hidden = false;
    $('#puzzle-tip').textContent =
      battle.hp === 0
        ? '相手を倒した！ 次に備えて 技も使えるよ'
        : '技を使うか、温存して次のターンへ！';
    render();
  }
  async function resolve() {
    if (!enabled() || !['charging', 'ready'].includes(battle.phase)) return;
    const epoch = battleEpoch;
    running = preparing = drag = false;
    activePuzzlePointer = null;
    path = [];
    cancelAnimationFrame(raf);
    battle.phase = 'resolving';
    $('#battle').classList.remove('hurry');
    $('#battle').classList.add('resolving');
    $('#clock').textContent = '0.0';
    $('#timebar').style.width = '0%';
    $('#ready-overlay').hidden = false;
    $('#ready-overlay').innerHTML =
      '<strong>みんなで アタック！</strong><span>' +
      battle.damage.toLocaleString() +
      ' パワー！</span>';
    const type = Number(Object.entries(battle.typeCharge).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0),
      tier = window.PokekoroBattleFX?.prepare(battle.damage, battle.hp, type) || 0;
    sfx('gather', 0.3);
    await wait(180);
    if (epoch !== battleEpoch) return;
    sfx('release', tier);
    await wait(160);
    if (epoch !== battleEpoch) return;
    battle.attackTotal += battle.damage;
    battle.hp = Math.max(0, battle.hp - battle.damage);
    $('#battle').classList.add('attack-release');
    window.PokekoroBattleFX?.impact(tier);
    updateHP();
    if (battle.hp === 0) {
      markBattleVictory();
      if (!hasNextTrainerPokemon()) $('#leave').disabled = true;
    }
    await wait(260);
    if (epoch !== battleEpoch) return;
    if (battle.hp === 0 && (!hasNextTrainerPokemon() || !rules.canContinue(battle.combat))) {
      await finish(epoch);
      return;
    }
    openSkills();
  }

  async function useSkill(kind) {
    if (!enabled() || battle.phase !== 'skills') return;
    const outcome = rules.skill(battle.combat, selected, kind, battle.m);
    if (!outcome.ok) return;
    const epoch = battleEpoch,
      name = POKEDEX[selected - 1].label;
    battle.phase = 'skill-animation';
    render();
    $('#turn-skill-options')
      .querySelectorAll('button')
      .forEach((button) => (button.disabled = true));
    $('#turn-next').disabled = true;
    $('#turn-skill-help').textContent =
      name +
      'の ' +
      { attack: '全力アタック！', boost: 'パワーチャージ！', guard: 'まもりのかべ！' }[kind];
    sfx(kind === 'attack' ? 'release' : 'breakthrough', 1);
    if (outcome.damage) {
      battle.hp = Math.max(0, battle.hp - outcome.damage);
      battle.attackTotal += outcome.damage;
      window.PokekoroBattleFX?.impact(1);
      updateHP();
      if (battle.hp === 0) {
        markBattleVictory();
        if (!hasNextTrainerPokemon()) $('#leave').disabled = true;
      }
    }
    await wait(380);
    if (epoch !== battleEpoch) return;
    $('#turn-next').disabled = false;
    if (battle.hp === 0 && (!hasNextTrainerPokemon() || !rules.canContinue(battle.combat))) {
      await finish(epoch);
      return;
    }
    battle.phase = 'skills';
    render();
  }
  async function next() {
    if (!enabled() || battle.phase !== 'skills') return;
    const epoch = battleEpoch;
    if (battle.hp === 0) {
      battle.phase = 'resolving';
      await finish(epoch);
      return;
    }
    battle.phase = 'counterattack';
    $('#battle').classList.remove('in-skill-break');
    panel.hidden = true;
    $('#ready-overlay').hidden = false;
    $('#ready-overlay').innerHTML = '<strong>敵の反撃！</strong><span>みんな、きをつけて！</span>';
    await wait(220);
    if (epoch !== battleEpoch) return;
    const hit = rules.retaliate(battle.combat);
    render();
    if (hit.id) roster.querySelector(`[data-battle-member="${hit.id}"]`)?.classList.add('just-hit');
    $('#ready-overlay').innerHTML = hit.blocked
      ? '<strong>ガード成功！</strong><span>反撃を ふせいだ！</span>'
      : '<strong>' +
        (hit.id ? POKEDEX[hit.id - 1].label : '仲間') +
        'は<br>ひんしに なった…</strong><span>この戦闘では おやすみ</span>';
    sfx(hit.blocked ? 'ballHit' : 'hit', 1);
    draw();
    await wait(650);
    if (epoch !== battleEpoch) return;
    if (!rules.canContinue(battle.combat)) {
      $('#ready-overlay').innerHTML = rules.alive(battle.combat).length
        ? '<strong>６ターン 終了！</strong><span>次こそ たおそう！</span>'
        : '<strong>戦える仲間が いない…</strong><span>次の挑戦では みんな元気に もどるよ</span>';
      await wait(700);
      if (epoch !== battleEpoch) return;
      battle.lossReason = rules.alive(battle.combat).length
        ? '６ターンで たおしきれなかった！'
        : '戦える仲間が いなくなった…';
      battle.phase = 'finished';
      endBattle(false);
      return;
    }
    battle.phase = 'ready';
    battle.damage = battle.shownDamage = 0;
    battle.typeCharge = {};
    $('#battle').classList.remove('resolving', 'attack-release');
    $('#combobar').style.width = '0%';
    $('#combo').textContent = '残った仲間で パワーをためよう！';
    $('#clock').textContent = '10.0';
    $('#timebar').style.width = '100%';
    $('#start').hidden = false;
    updateCharge();
    $('#start').click();
  }
  roster.onclick = (event) => {
    const button = event.target.closest('[data-battle-member]');
    if (button && !button.disabled && battle.phase === 'skills') {
      selected = Number(button.dataset.battleMember);
      render();
      sfx('dexPage');
    }
  };
  $('#turn-skill-options').onclick = (event) => {
    const button = event.target.closest('[data-battle-skill]');
    if (button && !button.disabled) void useSkill(button.dataset.battleSkill);
  };
  $('#turn-next').onclick = next;
  window.PokekoroTurns = Object.freeze({ init, begin, charge, aliveParty, render, resolve });
})();
