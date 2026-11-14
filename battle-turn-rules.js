'use strict';
// 戦闘中だけの状態。セーブや元のパーティーは書き換えず、次の戦闘では全員復帰する。
const BattleTurnRules = (() => {
  const config = Object.freeze({ seconds: 10, gauge: 12, skillPower: 12, boost: 1.5 });
  function create(party) {
    return {
      turn: 0,
      boost: 1,
      nextBoost: 1,
      guard: false,
      members: party.map((id) => ({ id, gauge: 0, gaugeProgress: 0, fainted: false })),
    };
  }
  const alive = (combat) => combat.members.filter((m) => !m.fainted).map((m) => m.id);
  // ターン数は経過の表示だけ。防御・復活等で生存できる限り継続し、全滅だけを敗北条件にする。
  const canContinue = (combat) => alive(combat).length > 0;
  function begin(combat) {
    if (!canContinue(combat)) return false;
    combat.turn++;
    combat.boost = combat.nextBoost;
    combat.nextBoost = 1;
    return true;
  }
  function charge(combat, type, cells) {
    if (!Number.isSafeInteger(cells) || cells <= 0) return;
    const unit = PokemonBattleStats.config.gaugeUnit;
    for (const member of combat.members) {
      const mon = POKEDEX[member.id - 1];
      if (member.fainted || !pokemonTypes(mon).includes(type)) continue;
      const progress = (member.gaugeProgress || 0) + cells * PokemonBattleStats.gaugeUnits(mon);
      member.gauge = Math.min(config.gauge, member.gauge + Math.floor(progress / unit));
      member.gaugeProgress = member.gauge === config.gauge ? 0 : progress % unit;
    }
  }
  function attackDamage(id, enemy) {
    const mon = POKEDEX[id - 1];
    return Math.round(
      PokemonBattleStats.power(mon, enemy) *
        config.skillPower *
        pokemonTypeMultiplier(mon.type, enemy),
    );
  }
  function skill(combat, id, kind, enemy) {
    const member = combat.members.find((m) => m.id === id);
    if (!member || member.fainted || member.gauge < config.gauge) return { ok: false };
    let damage = 0;
    if (kind === 'attack') {
      damage = attackDamage(id, enemy);
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
    member.gaugeProgress = 0;
    return { blocked: false, id: member.id };
  }
  return Object.freeze({
    config,
    create,
    alive,
    canContinue,
    begin,
    charge,
    attackDamage,
    skill,
    retaliate,
  });
})();
