'use strict';
// 次の相手を先に表示し、待機中だけ仲間のタップで個別技を開く。各待機後に世代を確認する。
(() => {
  const rules = BattleTurnRules;
  let selected = null,
    targetId = null;
  let resumeAfterCounter = false;
  const panel = document.querySelector('#turn-actions'),
    roster = document.querySelector('#battle-party');
  const blackout = document.createElement('div');
  blackout.id = 'battle-blackout';
  blackout.hidden = true;
  blackout.setAttribute('role', 'status');
  blackout.setAttribute('aria-live', 'assertive');
  blackout.innerHTML = '<strong>めのまえが<br>まっくらになった…</strong>';
  $('#battle').append(blackout);
  const enabled = () => !!battle?.combat && !battle.safari;
  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, reduceMotion ? Math.min(ms, 120) : ms));
  const startConfirm = document.createElement('dialog');
  startConfirm.id = 'skill-start-confirm';
  startConfirm.setAttribute('aria-labelledby', 'skill-confirm-title');
  startConfirm.innerHTML =
    '<h2 id="skill-confirm-title">わざを つかわずに はじめる？</h2><p></p><div><button id="skill-check" class="primary">わざを みる</button><button id="skill-continue">そのまま スタート</button></div>';
  document.body.append(startConfirm);
  async function confirmStart() {
    if (!enabled()) return true;
    if (resumeAfterCounter) {
      resumeAfterCounter = false;
      return true;
    }
    if (battle.phase !== 'ready' || startConfirm.open) return false;
    const combat = battle.combat;
    const ready = combat.members.filter((m) => {
      if (m.fainted || m.usedTurn === combat.turn || m.gauge < rules.skillCost(m.id)) return false;
      const target = PokemonSkillRules.targets(combat, m.id)[0];
      return rules.inspectSkill(combat, m.id, { ...skillContext(), targetId: target?.id }).ok;
    });
    if (!ready.length) return true;
    const epoch = battleEpoch,
      turn = combat.turn;
    startConfirm.querySelector('p').textContent =
      ready.map((m) => POKEDEX[m.id - 1].label).join('・') + 'の わざが つかえるよ！';
    const answer = new Promise((resolve) =>
      startConfirm.addEventListener('close', () => resolve(startConfirm.returnValue), {
        once: true,
      }),
    );
    startConfirm.returnValue = '';
    $('#skill-check').onclick = () => startConfirm.close('skills');
    $('#skill-continue').onclick = () => startConfirm.close('start');
    startConfirm.showModal();
    $('#skill-check').focus();
    const choice = await answer;
    if (
      epoch !== battleEpoch ||
      !enabled() ||
      battle.combat.turn !== turn ||
      battle.phase !== 'ready'
    )
      return false;
    if (choice === 'skills') openSkills(ready[0].id);
    return choice === 'start';
  }
  function init(current) {
    current.combat =
      current.safari || current.tutorial
        ? null
        : current.series?.combat || rules.create(state.party);
    if (current.series) current.series.combat = current.combat;
    resumeAfterCounter = false;
    startConfirm.close();
    current.attackTotal = 0;
    selected = null;
    targetId = null;
    $('#battle').classList.remove('in-skill-break', 'party-wiped-out');
    blackout.hidden = true;
    $('#turn-next').disabled = false;
    panel.hidden = true;
    $('#battle').classList.toggle('turn-battle', !!current.combat);
    render();
  }
  // 図鑑のタイプ順をそのまま使い、左上にメイン・右下にサブを描く。
  function typeBadges(mon) {
    return pokemonTypes(mon)
      .map((type, index) => {
        const cell = TYPE_SYMBOL_CELLS[type];
        return `<b class="member-type member-type-${index ? 'sub' : 'main'}" data-type="${type}" title="${index ? 'サブ' : 'メイン'}タイプ：${POKEMON_TYPE_NAMES[type]}" style="--member-type:${POKEMON_TYPE_COLORS[type]}"><em style="background-position:${((cell % 6) / 5) * 100}% ${(Math.floor(cell / 6) / 2) * 100}%"></em></b>`;
      })
      .join('');
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
    if (battle.phase === 'skills' && !combat.members.some((m) => m.id === selected))
      selected =
        combat.members.find(
          (m) => !m.fainted && m.usedTurn !== combat.turn && m.gauge >= rules.skillCost(m.id),
        )?.id ??
        combat.members.find((m) => !m.fainted)?.id ??
        null;
    $('#battle-turn-status').textContent =
      `${Math.max(1, combat.turn)}ターン目・${rules.config.seconds}秒 ｜ のこり${rules.alive(combat).length}匹${combat.guard ? ' ｜ ガード待機' : ''}${combat.nextBoost > 1 ? ' ｜ 次は×' + combat.nextBoost : ''}${combat.boost > 1 && battle.phase === 'charging' ? ' ｜ 攻撃×' + combat.boost : ''}${combat.reviveUsed ? ' ｜ 復活済み' : ''}`;
    roster.innerHTML = combat.members
      .map((m) => {
        const mon = POKEDEX[m.id - 1],
          cap = rules.skillCost(m.id),
          used = m.usedTurn === combat.turn,
          ready = m.gauge >= cap && !used;
        return `<button type="button" data-battle-member="${m.id}" style="--ready-type:${POKEMON_TYPE_COLORS[mon.type]}" class="${m.fainted ? 'is-fainted' : ready ? 'skill-ready' : ''}" ${!['ready', 'skills'].includes(battle.phase) ? 'disabled' : ''} aria-pressed="${selected === m.id}" aria-label="${mon.label} ${pokemonTypes(
          mon,
        )
          .map(
            (type, index) => (index ? 'サブタイプ ' : 'メインタイプ ') + POKEMON_TYPE_NAMES[type],
          )
          .join(
            '、',
          )} の技 ${m.fainted ? 'ひんし' : used ? 'このターンは使用済み' : '技ゲージ' + m.gauge + '/' + cap}"><span class="battle-member-portrait" aria-hidden="true"><img src="${pokemonPortrait(m.id)}" alt="">${typeBadges(mon)}</span><span>${m.fainted ? 'ひんし' : used ? '使用ずみ' : ready ? 'わざ OK' : m.gauge + '/' + cap}</span><i><b style="width:${(100 * m.gauge) / cap}%"></b></i></button>`;
      })
      .join('');
    if (battle.phase !== 'skills') return;
    const member =
      combat.members.find((m) => m.id === selected) ||
      combat.members.find(
        (m) => !m.fainted && m.usedTurn !== combat.turn && m.gauge >= rules.skillCost(m.id),
      ) ||
      combat.members.find((m) => !m.fainted);
    selected = member?.id ?? null;
    const mon = member && POKEDEX[member.id - 1];
    if (!mon) return;
    const skill = rules.skillFor(mon.id),
      candidates = PokemonSkillRules.targets(combat, mon.id);
    $('#battle').dataset.skillAttack = String(skill.category === 'attack');
    const targeted =
      skill.category === 'revive' ||
      (skill.category === 'support' && skill.target === 'ally') ||
      (skill.category === 'board' && skill.mode === 'allyType');
    $('#battle').dataset.skillTargeted = String(targeted);
    if (!candidates.some((m) => m.id === targetId)) targetId = candidates[0]?.id ?? null;
    const preview = rules.inspectSkill(combat, mon.id, skillContext());
    const damage =
      skill.category === 'attack' ? rules.attackDamage(mon.id, battle.m, combat, battle.hp) : 0;
    panel.querySelector('.skill-dice-reveal')?.remove();
    panel.querySelector('.skill-hero')?.remove();
    panel.querySelector('.turn-skill-body').prepend(
      window.PokekoroTutorialVisuals.skillHero(mon, skill, member.gauge, {
        enemy: battle.m,
        usable: preview.ok,
        used: member.usedTurn === combat.turn,
        fainted: member.fainted,
      }),
    );
    panel.style.setProperty('--skill-color', POKEMON_TYPE_COLORS[mon.type]);
    const recipient = panel.querySelector('.skill-recipient');
    if (recipient) {
      recipient.insertAdjacentHTML(
        'beforeend',
        '<div class="skill-target-hp"><span></span><i><b></b></i></div>',
      );
      updateHP();
    }
    $('#turn-skill-name').textContent = skill.name;
    $('#turn-skill-help').textContent = preview.ok
      ? targeted
        ? 'つかう なかまを えらぼう！'
        : 'わざを つかう？ とじても OK！'
      : preview.reason;
    $('#turn-skill-options').innerHTML =
      (targeted
        ? `<div class="turn-target-label">${skill.category === 'revive' ? '復活させる仲間' : skill.category === 'board' ? 'ブロックの属性を選ぼう' : 'ゲージを渡す仲間'}</div><div class="turn-targets">${candidates.map((m) => `<button type="button" data-skill-target="${m.id}" aria-pressed="${targetId === m.id}"><img src="${pokemonPortrait(m.id)}" alt=""><span>${POKEDEX[m.id - 1].label}<small>${m.fainted ? 'ひんし' : skill.category === 'board' ? types[POKEDEX[m.id - 1].type] : m.gauge + '/' + rules.skillCost(m.id)}</small></span></button>`).join('') || '<span>対象になる仲間がいないよ</span>'}</div>`
        : '') + `<p class="turn-skill-description">${PokemonSkillRules.description(mon.id)}</p>`;
    const use = $('#turn-use-skill');
    use.dataset.battleSkill = String(skill.id);
    use.dataset.skillCategory = skill.category;
    use.disabled = !preview.ok;
    use.replaceChildren();
    const label = document.createElement('strong'),
      hint = document.createElement('small');
    label.textContent =
      member.usedTurn === combat.turn ? 'このターンは つかったよ' : skill.name + 'を つかう！';
    hint.textContent = !preview.ok
      ? ''
      : targeted && targetId
        ? '→ ' + POKEDEX[targetId - 1].label
        : skill.category === 'attack'
          ? ['dice', 'critical', 'risky'].includes(skill.mode)
            ? PokemonSkillRules.damageRange(combat, mon.id, skillContext()).join('〜') +
              'ダメージ 🎲'
            : damage + 'ダメージ'
          : 'ゲージ' + skill.cost;
    use.append(label, hint);
    $('#turn-next').textContent = 'とじる';
  }
  function skillContext() {
    return {
      enemy: battle.m,
      enemyHP: battle.hp,
      hasNextEnemy: hasNextTrainerPokemon(),
      board: grid,
      pool: battle.puzzleTypes,
      targetId,
    };
  }
  function begin() {
    if (!enabled()) return true;
    if (battle.phase !== 'ready' || !rules.begin(battle.combat)) return false;
    if (battle.combat.pendingBoard) {
      grid = [...battle.combat.pendingBoard];
      battle.combat.pendingBoard = null;
      draw();
    }
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
    const readyBefore = battle.combat.members.filter(
      (m) => m.gauge >= rules.skillCost(m.id),
    ).length;
    rules.charge(battle.combat, type, cells);
    if (battle.combat.members.filter((m) => m.gauge >= rules.skillCost(m.id)).length > readyBefore)
      sfx('breakthrough', 1);
    render();
  }
  function aliveParty() {
    return battle?.tutorial ? [32] : enabled() ? rules.alive(battle.combat) : state.party;
  }
  async function wipeout(epoch) {
    if (epoch !== battleEpoch || battle.phase === 'wipeout') return;
    battle.phase = 'wipeout';
    battle.lossReason = 'めのまえが まっくらになった…';
    $('#leave').disabled = true;
    panel.hidden = true;
    blackout.hidden = false;
    // 表示直後のレイアウトを確定し、全画面の暗転へ移る。演出を減らす設定ではCSSで即時表示。
    blackout.getBoundingClientRect();
    $('#battle').classList.add('party-wiped-out');
    sfx('fail');
    // 動きを減らす設定でも文章を読む時間は確保する。新しい戦闘への古い終了処理は進めない。
    await new Promise((resolve) => setTimeout(resolve, 1800));
    if (epoch !== battleEpoch) return;
    battle.phase = 'finished';
    endBattle(false);
  }
  async function finish(epoch) {
    if (epoch !== battleEpoch) return;
    if (hasNextTrainerPokemon() && !rules.canContinue(battle.combat)) {
      await wipeout(epoch);
      return;
    }
    panel.hidden = true;
    $('#start').hidden = true;
    $('#battle').classList.remove('in-skill-break');
    battle.phase = 'resolving';
    $('#leave').disabled = true;
    markBattleVictory();
    window.PokekoroBattleFX?.defeat(2, battle.trainer && !hasNextTrainerPokemon());
    $('#ready-overlay').hidden = false;
    $('#ready-overlay').innerHTML =
      `<strong>${battle.trainer && !hasNextTrainerPokemon() ? 'ぜんぶ たおした！' : battle.m.label + 'を<br>たおした！'}</strong><span>${hasNextTrainerPokemon() ? 'つぎの ポケモンが くるぞ！' : 'みんなの力で 勝利！'}</span>`;
    await wait(750);
    if (epoch !== battleEpoch) return;
    battle.damage = battle.attackTotal;
    battle.phase = 'finished';
    endBattle(true);
  }
  function prepare(counterPending = false) {
    if (!enabled()) return;
    battle.phase = 'ready';
    battle.counterPending = counterPending;
    selected = targetId = null;
    panel.hidden = true;
    $('#battle').classList.remove('in-skill-break', 'resolving', 'attack-release');
    window.PokekoroBattleFX?.reset();
    battle.damage = battle.shownDamage = 0;
    battle.typeCharge = {};
    $('#clock').textContent = '10.0';
    $('#timebar').style.width = '100%';
    $('#combobar').style.width = '0%';
    $('#ready-overlay').hidden = false;
    $('#ready-overlay').innerHTML =
      '<strong>準備ができたら<br>スタート！</strong><span>仲間をタップすると 技を見られるよ</span>';
    $('#puzzle-tip').textContent = counterPending
      ? 'スタートで相手の反撃を受けて、次のパズルへ'
      : '仲間をタップで技。準備ができたらスタート！';
    $('#start').hidden = false;
    $('#start').textContent = '▶ スタート';
    updateCharge();
    render();
  }
  function closeSkills() {
    if (enabled() && battle.phase === 'skills') prepare(!!battle.counterPending);
  }
  function openSkills(id) {
    if (!enabled() || !['ready', 'skills'].includes(battle.phase)) return;
    $('#battle').classList.add('in-skill-break');
    $('#ready-overlay').hidden = true;
    battle.phase = 'skills';
    selected = id;
    targetId = null;
    $('#turn-next').disabled = false;
    panel.hidden = false;
    $('#puzzle-tip').textContent = '技を使うか、とじてスタートしよう';
    render();
    panel.querySelector('.turn-skill-body').scrollTop = 0;
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
    const sources = battle.combat.members
      .filter((member) => !member.fainted)
      .map((member) => {
        const mon = POKEDEX[member.id - 1];
        const usedType = pokemonTypes(mon)
          .filter((t) => (battle.typeCharge[t] || 0) > 0)
          .sort((a, b) => battle.typeCharge[b] - battle.typeCharge[a])[0];
        return {
          node: roster.querySelector(`[data-battle-member="${member.id}"]`),
          type: usedType,
        };
      })
      .filter((entry) => entry.node && entry.type !== undefined);
    await window.PokekoroBattleFX?.groupAttack(sources, type, battle.damage);
    if (epoch !== battleEpoch) return;
    battle.attackTotal += battle.damage;
    battle.hp = Math.max(0, battle.hp - battle.damage);
    $('#battle').classList.add('attack-release');
    if (battle.damage > 0) {
      window.PokekoroBattleFX?.damage(battle.damage, type);
      window.PokekoroBattleFX?.impact(tier);
    }
    updateHP();
    if (battle.hp === 0) {
      markBattleVictory();
      if (!hasNextTrainerPokemon()) $('#leave').disabled = true;
    }
    await wait(420);
    if (epoch !== battleEpoch) return;
    if (battle.hp === 0) {
      await finish(epoch);
      return;
    }
    prepare(true);
  }

  async function useSkill(moveId) {
    if (!enabled() || battle.phase !== 'skills') return;
    if (rules.skillFor(selected).id !== Number(moveId)) return;
    const boardBefore = [...grid];
    const outcome = rules.skill(battle.combat, selected, skillContext());
    if (!outcome.ok) return;
    const epoch = battleEpoch;
    battle.phase = 'skill-animation';
    render();
    $('#turn-skill-options')
      .querySelectorAll('button')
      .forEach((button) => (button.disabled = true));
    $('#turn-next').disabled = true;
    $('#turn-use-skill').disabled = true;
    $('#turn-skill-help').textContent = outcome.message;
    if (outcome.diceFace) {
      const dice = document.createElement('div');
      dice.className = 'skill-dice-reveal is-rolling';
      dice.setAttribute('role', 'status');
      dice.innerHTML = '<b>🎲</b><strong>サイコロを ふるよ！</strong>';
      panel.append(dice);
      sfx('step');
      await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 80 : 450));
      if (epoch !== battleEpoch) return;
      dice.classList.remove('is-rolling');
      dice.dataset.face = String(outcome.diceFace);
      dice.dataset.result = outcome.missed ? 'miss' : outcome.critical ? 'critical' : 'hit';
      dice.innerHTML = `<b>${['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][outcome.diceFace]}</b><strong>${outcome.diceFace}が でた！</strong><small>${outcome.missed ? 'はずれた！ 0ダメージ' : outcome.critical ? '急所に あたった！ 1.3倍！' : outcome.skill.mode === 'dice' ? `${outcome.skill.power}＋${outcome.diceFace}×${outcome.skill.diceStep}＝威力${outcome.multiplier}倍` : `命中！ 威力×${outcome.multiplier}`}</small>`;
      await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 350 : 850));
      if (epoch !== battleEpoch) return;
      dice.remove();
    }
    if (outcome.missed) {
      prepare(!!battle.counterPending);
      return;
    }
    sfx(
      outcome.skill.category === 'attack'
        ? 'release'
        : outcome.skill.category === 'guard'
          ? 'ballHit'
          : 'breakthrough',
      1,
    );
    for (const id of outcome.affected)
      roster.querySelector(`[data-battle-member="${id}"]`)?.classList.add('just-restored');
    if (outcome.skill.category === 'board') {
      // 技解説で隠した盤面を戻し、変化したマスを操作不能のまま見せる。
      $('#battle').classList.remove('in-skill-break');
      panel.hidden = true;
      $('#ready-overlay').hidden = true;
      draw();
    }
    const recipients = ['boost', 'guard'].includes(outcome.skill.category)
      ? rules.alive(battle.combat)
      : outcome.affected;
    let applied = false;
    const applyDamage = () => {
      if (applied || epoch !== battleEpoch) return;
      applied = true;
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
    };
    await window.PokekoroBattleFX?.skill({
      category: outcome.skill.category,
      name: outcome.skill.name,
      actor: POKEDEX[selected - 1].label,
      actorId: selected,
      enemy:
        outcome.skill.category === 'attack'
          ? panel.querySelector('.skill-recipient img') || $('#enemyimg')
          : $('#enemyimg'),
      damage: outcome.damage || 0,
      amount: outcome.skill.amount || 0,
      multiplier: outcome.skill.multiplier || 1,
      onImpact: applyDamage,
      type:
        outcome.skill.category === 'attack'
          ? PokemonSkillRules.attackType(outcome.skill, POKEDEX[selected - 1])
          : POKEDEX[selected - 1].type,
      source: roster.querySelector(`[data-battle-member="${selected}"]`),
      targets: recipients
        .map((id) => roster.querySelector(`[data-battle-member="${id}"]`))
        .filter(Boolean),
      changed: grid
        .map((value, index) => (value !== boardBefore[index] ? index : -1))
        .filter((index) => index >= 0),
    });
    if (epoch !== battleEpoch) return;
    applyDamage();
    if (epoch !== battleEpoch) return;
    $('#turn-next').disabled = false;
    if (battle.hp === 0) {
      await finish(epoch);
      return;
    }
    prepare(!!battle.counterPending);
  }
  async function next() {
    if (!enabled() || battle.phase !== 'ready' || !battle.counterPending) return;
    const epoch = battleEpoch;
    if (battle.hp === 0) {
      battle.phase = 'resolving';
      await finish(epoch);
      return;
    }
    battle.phase = 'counterattack';
    $('#start').hidden = true;
    $('#battle').classList.remove('in-skill-break');
    panel.hidden = true;
    $('#ready-overlay').hidden = false;
    $('#ready-overlay').innerHTML = '<strong>敵の反撃！</strong><span>みんな、きをつけて！</span>';
    window.PokekoroBattleFX?.counterWindup();
    await wait(220);
    if (epoch !== battleEpoch) return;
    const hit = rules.retaliate(battle.combat);
    await window.PokekoroBattleFX?.counterHit(
      hit.blocked ? roster : roster.querySelector(`[data-battle-member="${hit.id}"]`),
      hit.blocked,
      undefined,
      undefined,
      battle.m.type,
    );
    if (epoch !== battleEpoch) return;
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
      await wipeout(epoch);
      return;
    }
    prepare(false);
    resumeAfterCounter = true;
    $('#start').click();
  }
  roster.onclick = (event) => {
    const button = event.target.closest('[data-battle-member]');
    if (button && !button.disabled && ['ready', 'skills'].includes(battle.phase)) {
      const id = Number(button.dataset.battleMember);
      if (battle.phase === 'skills' && selected === id) closeSkills();
      else openSkills(id);
      sfx('dexPage');
    }
  };
  $('#turn-skill-options').onclick = (event) => {
    const target = event.target.closest('[data-skill-target]');
    if (target && battle.phase === 'skills') {
      targetId = Number(target.dataset.skillTarget);
      render();
      sfx('dexPage');
      return;
    }
  };
  $('#turn-use-skill').onclick = (event) => {
    if (!event.currentTarget.disabled) void useSkill(event.currentTarget.dataset.battleSkill);
  };
  $('#turn-next').onclick = closeSkills;
  window.PokekoroTurns = Object.freeze({
    init,
    confirmStart,
    begin,
    charge,
    aliveParty,
    render,
    resolve,
    prepare,
    advance: next,
  });
})();
