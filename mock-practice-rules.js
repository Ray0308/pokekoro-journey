'use strict';
// 研究所の模擬戦。自分の2匹・同じ練習相手・獲得したゲージを維持する。
const MockPracticeRules = (() => {
  const starters = [1, 4, 7],
    guide = [12, 13, 14];
  const validNumber = (n, max = 10000000) => Number.isFinite(n) && n >= 0 && n <= max;
  function create(starter, saved) {
    if (!starters.includes(starter)) throw Error('Invalid mock partner');
    const team = [starter, 446],
      pool = partyTypes(team),
      combat = BattleTurnRules.create(team);
    const m = {
      starter,
      team,
      pool,
      combat,
      enemy: POKEDEX[24],
      phase: 'trace',
      board: Array.from(
        { length: PUZZLE_LAYOUT.count },
        (_, i) => pool[(i + Math.floor(i / 6)) % pool.length],
      ),
      power: 0,
      totalDamage: 0,
      rounds: 0,
      clears: 0,
      skillUsed: false,
      typeCharge: {},
    };
    for (const i of guide) m.board[i] = POKEDEX[starter - 1].type;
    if (saved?.starter !== starter || !['trace', 'ready', 'done'].includes(saved.phase)) return m;
    if (
      !Array.isArray(saved.board) ||
      saved.board.length !== 30 ||
      !saved.board.every((t) => pool.includes(t))
    )
      return m;
    if (
      !Array.isArray(saved.gauges) ||
      saved.gauges.length !== 2 ||
      !saved.gauges.every(
        (g, i) =>
          g.id === team[i] &&
          Number.isInteger(g.value) &&
          g.value >= 0 &&
          g.value <= PokemonSkillRules.cost(g.id),
      )
    )
      return m;
    if (!['power', 'totalDamage', 'rounds', 'clears'].every((k) => validNumber(saved[k]))) return m;
    m.phase = saved.phase;
    m.board = [...saved.board];
    m.power = saved.power;
    m.totalDamage = saved.totalDamage;
    m.rounds = Math.floor(saved.rounds);
    m.clears = Math.floor(saved.clears);
    m.skillUsed = !!saved.skillUsed;
    combat.turn = m.rounds;
    combat.nextBoost = saved.nextBoost === 1.5 ? 1.5 : 1;
    if (saved.typeCharge && typeof saved.typeCharge === 'object')
      for (const type of pool)
        if (validNumber(saved.typeCharge[type])) m.typeCharge[type] = saved.typeCharge[type];
    saved.gauges.forEach((g, i) => {
      combat.members[i].gauge = g.value;
      combat.members[i].gaugeProgress =
        Number.isSafeInteger(g.progress) &&
        g.progress >= 0 &&
        g.progress < PokemonBattleStats.config.gaugeUnit
          ? g.progress
          : 0;
      combat.members[i].usedTurn = g.usedTurn === combat.turn ? combat.turn : -1;
    });
    return m;
  }
  function snapshot(m) {
    return {
      starter: m.starter,
      phase: m.phase,
      board: [...m.board],
      power: m.power,
      totalDamage: m.totalDamage,
      rounds: m.rounds,
      clears: m.clears,
      skillUsed: m.skillUsed,
      nextBoost: m.combat.nextBoost,
      typeCharge: { ...m.typeCharge },
      gauges: m.combat.members.map((g) => ({
        id: g.id,
        value: g.gauge,
        progress: g.gaugeProgress,
        usedTurn: g.usedTurn,
      })),
    };
  }
  function refill(board, cleared, pool, rng) {
    const out = [...board],
      removed = new Set(cleared);
    for (let col = 0; col < 6; col++) {
      const keep = [];
      for (let row = 4; row >= 0; row--)
        if (!removed.has(row * 6 + col)) keep.push(board[row * 6 + col]);
      for (let row = 4; row >= 0; row--)
        out[row * 6 + col] =
          keep[4 - row] ??
          pool[
            Math.min(
              pool.length - 1,
              Math.floor(Math.max(0, Math.min(0.999999, Number(rng()) || 0)) * pool.length),
            )
          ];
    }
    return out;
  }
  function clear(m, path, rng = Math.random, combo = 1) {
    if (!['trace', 'round'].includes(m.phase) || !PracticeRules.validPath(m.board, path))
      return null;
    const type = m.board[path[0]],
      amount = Math.round(
        puzzleCharge(
          partyTypePower(m.team, type, m.enemy),
          path.length,
          combo,
          pokemonTypeMultiplier(type, m.enemy),
          m.pool.length,
        ) * m.combat.boost,
      );
    m.power += amount;
    m.typeCharge[type] = (m.typeCharge[type] || 0) + amount;
    m.clears++;
    BattleTurnRules.charge(m.combat, type, path.length);
    m.board = refill(m.board, path, m.pool, rng);
    if (m.phase === 'trace') m.phase = 'ready';
    return { type, amount };
  }
  function begin(m) {
    if (m.phase !== 'ready') return false;
    BattleTurnRules.begin(m.combat);
    if (m.rounds > 0) {
      m.power = 0;
      m.typeCharge = {};
      m.clears = 0;
    }
    m.phase = 'round';
    return true;
  }
  function end(m) {
    if (m.phase !== 'round') return false;
    m.totalDamage += m.power;
    m.rounds++;
    m.phase = m.skillUsed && m.power > 0 ? 'done' : 'ready';
    m.power = 0;
    m.typeCharge = {};
    return true;
  }
  function inspect(m, id) {
    return BattleTurnRules.inspectSkill(m.combat, id, { enemy: m.enemy, enemyHP: 1000000 });
  }
  function use(m, id) {
    if (m.phase !== 'ready' || m.rounds < 1)
      return { ok: false, reason: 'まずは10びょう あそんでみよう！' };
    const result = BattleTurnRules.skill(m.combat, id, { enemy: m.enemy, enemyHP: 1000000 });
    if (!result.ok) return result;
    m.skillUsed = true;
    if (result.skill.category === 'attack') {
      m.totalDamage += result.damage;
      m.phase = 'done';
    }
    return result;
  }
  return Object.freeze({ create, snapshot, clear, begin, end, inspect, use, guide, refill });
})();
if (typeof module !== 'undefined') module.exports = MockPracticeRules;
