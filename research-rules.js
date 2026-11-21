'use strict';
const ResearchRules = (() => {
  const budget = 5,
    allIds = [...RESEARCH_CATALOG.finalIds, ...RESEARCH_CATALOG.legendIds];
  const index = (n, rng) =>
    Math.min(n - 1, Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, Number(rng()) || 0)) * n));
  const choose = (items, rng) => items[index(items.length, rng)];
  function slot(stops = []) {
    return (
      [3, 6, 9, 11, 1, 2, 4, 5, 7, 8, 10, 12, 13].find((i) => stops[i] === 'wild') ??
      [3, 6, 9, 11, 1, 2, 4, 5, 7, 8, 10, 12, 13].find((i) =>
        ['trainer', 'item'].includes(stops[i]),
      ) ??
      3
    );
  }
  function validOffer(m) {
    return (
      m &&
      Number.isSafeInteger(m.id) &&
      m.id > 0 &&
      MAP_ORDER.includes(m.mapId) &&
      Number.isInteger(m.pos) &&
      m.pos >= 4 &&
      m.pos <= 10 &&
      allIds.includes(m.pokemonId)
    );
  }
  function normalize(value) {
    const number = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
    const copy = (m) => ({ id: m.id, mapId: m.mapId, pos: m.pos, pokemonId: m.pokemonId });
    const active =
      validOffer(value?.active) &&
      Number.isInteger(value.active.left) &&
      value.active.left >= 0 &&
      value.active.left <= budget &&
      ['active', 'encounter', 'capture'].includes(value.active.phase)
        ? {
            ...copy(value.active),
            left: value.active.left,
            phase: value.active.phase,
            adjusted: value.active.adjusted === true,
            pending: null,
          }
        : null;
    const p = value?.active?.pending;
    if (
      active &&
      active.phase === 'active' &&
      p &&
      (MAP_ORDER.includes(p.mapId) || p.mapId === RAINBOW_CONFIG.mapId) &&
      Number.isInteger(p.from) &&
      p.from >= 0 &&
      p.from < 14 &&
      Number.isInteger(p.raw) &&
      p.raw >= 1 &&
      p.raw <= 6 &&
      (p.value === null ||
        (Number.isInteger(p.value) &&
          p.value >= 1 &&
          p.value <= 6 &&
          Math.abs(p.value - p.raw) <= 1))
    ) {
      active.pending = { mapId: p.mapId, from: p.from, raw: p.raw, value: p.value };
    }
    if (active?.phase === 'active' && active.left === 0 && !active.pending)
      return {
        nextId: number(value?.nextId) || 1,
        offer: null,
        active: null,
        completed: number(value?.completed),
        failed: number(value?.failed) + 1,
        last: { outcome: 'expired' },
      };
    const offer = !active && validOffer(value?.offer) ? copy(value.offer) : null;
    return {
      nextId: Math.max(1, number(value?.nextId), (active?.id || offer?.id || 0) + 1),
      offer,
      active,
      completed: number(value?.completed),
      failed: number(value?.failed),
      last:
        value?.last &&
        ['caught', 'escaped', 'seen', 'defeated', 'expired', 'cancelled'].includes(
          value.last.outcome,
        )
          ? { outcome: value.last.outcome }
          : null,
    };
  }
  function generate(save, rng = Math.random) {
    const research = save.research;
    if (research.active || research.offer) return research.active || research.offer;
    const maps = MAP_ORDER.filter((id) => id !== 'safari-zone' && save.clearedMaps.includes(id));
    if (!maps.length) return null;
    let pool = rng() < 0.25 ? RESEARCH_CATALOG.legendIds : RESEARCH_CATALOG.finalIds;
    const missing = pool.filter((id) => !save.owned.includes(id));
    if (missing.length) pool = missing;
    const pokemonId = choose(pool, rng),
      mon = POKEDEX[pokemonId - 1];
    let destinations = maps.filter((id) => MAP_ENCOUNTERS[id]?.some(([n]) => n === pokemonId));
    if (!destinations.length) {
      const ranked = maps.map((id) => ({
        id,
        score:
          MAP_ENCOUNTERS[id].filter(([n]) => pokemonTypes(POKEDEX[n - 1]).includes(mon.type))
            .length / MAP_ENCOUNTERS[id].length,
      }));
      const best = Math.max(...ranked.map((m) => m.score));
      destinations = ranked.filter((m) => m.score >= best * 0.8).map((m) => m.id);
    }
    const other = destinations.filter((id) => id !== save.mapId);
    if (other.length) destinations = other;
    const mapId = choose(destinations, rng),
      stop = slot(MAPS[mapId].squares);
    const positions = [4, 5, 6, 7, 8, 9, 10].filter((pos) => pos !== stop);
    const offer = { id: research.nextId++, mapId, pos: choose(positions, rng), pokemonId };
    research.offer = offer;
    return offer;
  }
  function accept(research) {
    if (!research.offer || research.active) return false;
    research.active = {
      ...research.offer,
      left: budget,
      phase: 'active',
      adjusted: false,
      pending: null,
    };
    research.offer = null;
    research.last = null;
    return true;
  }
  function reserve(research, mapId, from, raw) {
    const m = research.active;
    if (!m || m.phase !== 'active') return null;
    if (m.pending) return m.pending;
    if (m.left <= 0) return null;
    m.left--;
    m.pending = { mapId, from, raw, value: m.adjusted ? raw : null };
    return m.pending;
  }
  function select(research, value) {
    const m = research.active,
      p = m?.pending;
    if (p?.value !== null && p?.value !== undefined) return value === p.value;
    if (
      !p ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 6 ||
      Math.abs(value - p.raw) > 1 ||
      (m.adjusted && value !== p.raw)
    )
      return false;
    if (value !== p.raw) m.adjusted = true;
    p.value = value;
    return true;
  }
  function finish(research, outcome) {
    if (!research.active) return false;
    if (['expired', 'cancelled'].includes(outcome)) research.failed++;
    else research.completed++;
    research.active = null;
    research.offer = null;
    research.last = { outcome };
    return true;
  }
  function arrive(research, mapId, pos) {
    const m = research.active;
    if (!m || m.phase !== 'active' || !m.pending) return null;
    m.pending = null;
    if (m.mapId === mapId && m.pos === pos) {
      m.phase = 'encounter';
      return { missionId: m.id, pokemonId: m.pokemonId };
    }
    if (m.left === 0) finish(research, 'expired');
    return null;
  }
  return Object.freeze({
    budget,
    slot,
    normalize,
    generate,
    accept,
    reserve,
    select,
    finish,
    arrive,
  });
})();
