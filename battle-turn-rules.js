'use strict';
// 戦闘中だけの状態。セーブや元のパーティーは書き換えず、次の戦闘では全員復帰する。
const BattleTurnRules = (() => {
  const config = Object.freeze({ seconds: 10, maxTurns: 6, gauge: 12, skillPower: 12, boost: 1.5 });
  function create(party) {
    return {
      turn: 0,
      boost: 1,
      nextBoost: 1,
      guard: false,
      members: party.map((id) => ({ id, gauge: 0, fainted: false })),
    };
  }
  const alive = (combat) => combat.members.filter((m) => !m.fainted).map((m) => m.id);
  const canContinue = (combat) => combat.turn < config.maxTurns && alive(combat).length > 0;
  function begin(combat) {
    if (!canContinue(combat)) return false;
    combat.turn++;
    combat.boost = combat.nextBoost;
    combat.nextBoost = 1;
    return true;
  }
  function charge(combat, type, cells) {
    for (const member of combat.members)
      if (!member.fainted && pokemonTypes(POKEDEX[member.id - 1]).includes(type))
        member.gauge = Math.min(config.gauge, member.gauge + Math.max(0, cells));
  }
  function skill(combat, id, kind, enemy) {
    const member = combat.members.find((m) => m.id === id);
    if (!member || member.fainted || member.gauge < config.gauge) return { ok: false };
    let damage = 0;
    if (kind === 'attack') {
      const mon = POKEDEX[id - 1];
      damage = Math.round(mon.power * config.skillPower * pokemonTypeMultiplier(mon.type, enemy));
      if (damage === 0) return { ok: false, reason: 'この相手には こうかがないよ' };
    } else if (kind === 'boost') {
      if (combat.nextBoost > 1) return { ok: false };
      combat.nextBoost = config.boost;
    } else if (kind === 'guard') {
      if (combat.guard) return { ok: false };
      combat.guard = true;
    } else return { ok: false };
    member.gauge -= config.gauge;
    return { ok: true, damage };
  }
  function retaliate(combat, rng = Math.random) {
    if (combat.guard) {
      combat.guard = false;
      return { blocked: true };
    }
    const candidates = combat.members.filter((m) => !m.fainted);
    if (!candidates.length) return { blocked: false, id: null };
    const member =
      candidates[
        Math.min(candidates.length - 1, Math.floor(Math.max(0, rng()) * candidates.length))
      ];
    member.fainted = true;
    member.gauge = 0;
    return { blocked: false, id: member.id };
  }
  return Object.freeze({ config, create, alive, canContinue, begin, charge, skill, retaliate });
})();
