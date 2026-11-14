'use strict';
// 個別技の判定と効果。UIは同じinspect結果を表示し、発動直前にも再検証する。
// 技の説明文を解析して動かさず、検査済みの構造化設定だけを使う。
const PokemonSkillRules = (() => {
  const forPokemon = (id) => POKEMON_SKILL_DATA.moves[POKEMON_SKILL_DATA.pokemon[id]];
  const cost = (id) => forPokemon(id).cost;
  const categoryNames = Object.freeze({
    attack: '攻撃',
    boost: '強化',
    guard: '防御',
    board: '盤面変更',
    support: 'サポート',
    revive: '復活',
  });
  const fail = (reason) => ({ ok: false, reason });
  function attackType(skill, mon) {
    return skill.attackType === 'self' ? mon.type : skill.type;
  }
  function attackDamage(combat, member, context) {
    const mon = POKEDEX[member.id - 1],
      skill = forPokemon(member.id);
    if (skill.category !== 'attack' || !context.enemy || context.enemyHP <= 0) return 0;
    if (skill.mode === 'percent')
      return Math.max(
        0,
        Math.min(
          context.enemyHP - 1,
          skill.damageCap,
          Math.max(1, Math.floor((context.enemyHP * skill.percent) / 100)),
        ),
      );
    let multiplier = skill.power;
    if (skill.mode === 'counter' && combat.lastCounterFainted) multiplier = skill.enhancedPower;
    if (skill.mode === 'fainted')
      multiplier = Math.min(
        skill.powerCap,
        multiplier + combat.members.filter((m) => m.fainted).length * skill.powerStep,
      );
    const kind =
      skill.damageClass === 'best' ? PokemonBattleStats.category(mon) : skill.damageClass;
    return Math.round(
      PokemonBattleStats.power(mon, context.enemy, kind) *
        multiplier *
        pokemonTypeMultiplier(attackType(skill, mon), context.enemy),
    );
  }
  function targets(combat, id) {
    const skill = forPokemon(id);
    if (skill.category === 'revive') return combat.members.filter((m) => m.fainted);
    if (skill.category === 'support')
      return combat.members.filter((m) => m.id !== id && !m.fainted && m.gauge < cost(m.id));
    if (skill.category === 'board' && skill.mode === 'allyType')
      return combat.members.filter((m) => !m.fainted);
    return [];
  }
  function boardPlan(combat, member, skill, context) {
    const board = context.board,
      pool = context.pool;
    if (
      !Array.isArray(board) ||
      ![PUZZLE_LAYOUT.count, 36].includes(board.length) ||
      board.some((t) => !Number.isInteger(t) || t < 0 || t > 17) ||
      !Array.isArray(pool) ||
      !pool.length ||
      pool.some((t) => !Number.isInteger(t) || t < 0 || t > 17)
    )
      return fail('盤面を準備してから使おう');
    if (skill.mode === 'redraw') {
      if (!board.some((t) => pool.some((p) => p !== t))) return fail('盤面を変えられないよ');
      return { ok: true, pool, board };
    }
    let type = skill.convertType;
    if (skill.mode === 'allyType') {
      const target = targets(combat, member.id).find((m) => m.id === context.targetId);
      if (!target) return fail('ブロックの属性を選んでね');
      type = POKEDEX[target.id - 1].type;
    } else if (
      !combat.members.some((m) => !m.fainted && pokemonTypes(POKEDEX[m.id - 1]).includes(type))
    )
      type = POKEDEX[member.id - 1].type;
    const indices = board.map((t, i) => (t === type ? -1 : i)).filter((i) => i >= 0);
    if (!indices.length) return fail('その属性のブロックで いっぱいだよ');
    return { ok: true, type, indices, board };
  }
  function inspect(combat, id, context = {}) {
    const member = combat.members.find((m) => m.id === id);
    if (!member || member.fainted) return fail('この仲間は おやすみ中');
    const skill = forPokemon(id);
    if (member.usedTurn === combat.turn) return fail('このターンは もう技を使ったよ');
    if (member.gauge < skill.cost)
      return fail(`あと${Math.ceil(skill.cost - member.gauge)}ゲージで使えるよ`);
    if (!Number.isFinite(context.enemyHP) || context.enemyHP < 0) return fail('相手を確認してね');
    if (skill.category === 'attack') {
      if (context.enemyHP <= 0) return fail('相手は もう倒れているよ');
      if (skill.mode === 'sacrifice' && combat.members.filter((m) => !m.fainted).length < 2)
        return fail('ほかに戦える仲間が必要だよ');
      const damage = attackDamage(combat, member, context);
      if (damage <= 0)
        return fail(
          skill.mode === 'percent'
            ? 'この技では これ以上けずれないよ'
            : 'この相手には こうかがないよ',
        );
      return { ok: true, damage, skill };
    }
    if (context.enemyHP <= 0 && !context.hasNextEnemy) return fail('バトルは もう終わっているよ');
    if (skill.category === 'boost') {
      if (combat.nextBoost > 1) return fail('次の攻撃は もう強化されているよ');
      return { ok: true, skill };
    }
    if (skill.category === 'guard') {
      if (combat.guard) return fail('ガードは もう準備できているよ');
      return { ok: true, skill };
    }
    if (skill.category === 'support') {
      if (combat.supportTurn === combat.turn) return fail('サポートは パズルの合間に1回までだよ');
      const candidates = targets(combat, id);
      const recipients =
        skill.target === 'allAllies'
          ? candidates
          : candidates.filter((m) => m.id === context.targetId);
      if (!recipients.length) return fail('ゲージを増やせる ほかの仲間を選んでね');
      return { ok: true, skill, recipients };
    }
    if (skill.category === 'revive') {
      if (combat.reviveUsed) return fail('復活は 1戦闘に1回までだよ');
      const target = targets(combat, id).find((m) => m.id === context.targetId);
      if (!target) return fail('ひんしの仲間を選んでね');
      return { ok: true, skill, target };
    }
    if (skill.category === 'board') {
      const plan = boardPlan(combat, member, skill, context);
      return plan.ok ? { ok: true, skill, plan } : plan;
    }
    return fail('この技は使えないよ');
  }
  function use(combat, id, context = {}) {
    const result = inspect(combat, id, context);
    if (!result.ok) return result;
    const member = combat.members.find((m) => m.id === id),
      skill = result.skill;
    if (skill.category === 'boost') combat.nextBoost = skill.multiplier;
    if (skill.category === 'guard') combat.guard = true;
    const affected = [];
    let detail = '';
    if (skill.category === 'support') {
      for (const recipient of result.recipients) {
        const before = recipient.gauge;
        recipient.gauge = Math.min(cost(recipient.id), before + skill.amount);
        if (recipient.gauge === cost(recipient.id)) recipient.gaugeProgress = 0;
        affected.push(recipient.id);
      }
      combat.supportTurn = combat.turn;
      detail =
        skill.target === 'allAllies'
          ? `仲間の技ゲージが +${skill.amount}！`
          : `${POKEDEX[result.recipients[0].id - 1].label}の技ゲージが +${skill.amount}！`;
    }
    if (skill.category === 'revive') {
      result.target.fainted = false;
      result.target.gauge = 0;
      result.target.gaugeProgress = 0;
      combat.reviveUsed = true;
      affected.push(result.target.id);
      detail = `${POKEDEX[result.target.id - 1].label}が ふっかつ！`;
    }
    if (skill.category === 'board') {
      const plan = result.plan,
        rng = context.rng || Math.random;
      const randomIndex = (n) =>
        Math.min(n - 1, Math.floor(Math.max(0, Math.min(1, Number(rng()) || 0)) * n));
      const before = [...plan.board];
      if (skill.mode === 'redraw') {
        for (let i = 0; i < plan.board.length; i++)
          plan.board[i] = plan.pool[randomIndex(plan.pool.length)];
        // 同じ盤面を引き直した場合も、有効な別属性があれば最低1マスは変える。
        if (plan.board.every((t, i) => t === before[i])) {
          const i = plan.board.findIndex((t) => plan.pool.some((p) => p !== t));
          plan.board[i] = plan.pool.find((p) => p !== plan.board[i]);
        }
      } else {
        const indices = [...plan.indices];
        for (let i = 0; i < Math.min(skill.amount, indices.length); i++) {
          const next = i + randomIndex(indices.length - i);
          [indices[i], indices[next]] = [indices[next], indices[i]];
          plan.board[indices[i]] = plan.type;
        }
      }
      // 次の相手の登場で通常盤面を作り直しても、予約した盤面を次のパズルへ引き継ぐ。
      combat.pendingBoard = [...plan.board];
      detail =
        skill.mode === 'redraw'
          ? 'ブロックを ぜんぶ入れ替えた！'
          : `${POKEMON_TYPE_NAMES[plan.type]}ブロックが ${plan.board.filter((t, i) => t !== before[i]).length}個ふえた！`;
    }
    member.gauge -= skill.cost;
    member.usedTurn = combat.turn;
    if (skill.category === 'attack' && skill.mode === 'sacrifice') {
      member.fainted = true;
      member.gauge = 0;
      member.gaugeProgress = 0;
    }
    return { ...result, affected, message: `${POKEDEX[id - 1].label}の ${skill.name}！${detail}` };
  }
  function description(id) {
    const skill = forPokemon(id),
      mon = POKEDEX[id - 1];
    if (skill.category === 'attack') {
      if (skill.mode === 'percent')
        return `相手の今のHPを${skill.percent}%けずる（最大${skill.damageCap}）。とどめには使えない。`;
      const type = POKEMON_TYPE_NAMES[attackType(skill, mon)];
      if (skill.mode === 'counter')
        return `通常は威力×${skill.power}。直前の反撃で仲間が倒れたら×${skill.enhancedPower}の${type}攻撃。`;
      if (skill.mode === 'fainted') return `ひんしの仲間が多いほど強くなる ${type}攻撃。`;
      return `威力×${skill.power}の${type}攻撃。${skill.mode === 'sacrifice' ? '使うと自分もひんしになる。' : ''}`;
    }
    if (skill.category === 'boost')
      return `次の10秒パズルの通常攻撃を×${skill.multiplier}。使った仲間が倒れても効果は残る。`;
    if (skill.category === 'guard') return '次の反撃を1回ふせぐ。';
    if (skill.category === 'support')
      return `${skill.target === 'allAllies' ? 'ほかの生存仲間みんな' : 'ほかの仲間1匹'}の技ゲージを+${skill.amount}。サポートはパズルの合間に1回。`;
    if (skill.category === 'revive')
      return 'ひんしの仲間1匹を復活。ゲージ0から再開。パーティ全体で1戦闘に1回。';
    if (skill.mode === 'redraw') return '次の盤面のブロックをぜんぶ入れ替える。';
    if (skill.mode === 'allyType')
      return `次の盤面の${skill.amount}マスを、選んだ仲間の第1タイプに変える。`;
    return `次の盤面の${skill.amount}マスを${POKEMON_TYPE_NAMES[skill.convertType]}に変える。担当の仲間がいなければ自分の属性に変える。`;
  }
  return Object.freeze({
    forPokemon,
    cost,
    categoryNames,
    attackType,
    attackDamage,
    targets,
    inspect,
    use,
    description,
  });
})();
