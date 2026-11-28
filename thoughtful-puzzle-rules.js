'use strict';
// 時間を使わず3回の選択を評価する。課題未達でも攻撃できる。
const ThoughtfulPuzzleRules = (() => {
  const config = Object.freeze({ moves: 3, powerScale: 3, gaugeScale: 2 });
  function create({ trainer = false, boss = false, pool = [], round = 1, rng = Math.random } = {}) {
    const goals = [
      { kind: 'long', target: 5, label: '5こ以上を 1回つなごう' },
      { kind: 'total', target: 12, label: '3手で 合計12こ つなごう' },
      { kind: 'longTwice', target: 2, label: '4こ以上を 2回つなごう' },
    ];
    if (new Set(pool).size >= 2)
      goals.push({ kind: 'types', target: 2, label: 'ちがうマークを 2種類つかおう' });
    if (trainer && !boss)
      goals[1] = { kind: 'total', target: 15, label: '3手で 合計15こ つなごう' };
    const goal = goals[Math.min(goals.length - 1, Math.max(0, Math.floor(rng() * goals.length)))];
    // 先読みには総消去数＋長いつなぎ。後半地域への依存や無効タイプの指定はしない。
    return {
      round,
      trainer,
      boss,
      goal,
      choice: 'power',
      used: 0,
      total: 0,
      longest: 0,
      longCount: 0,
      types: [],
      settled: false,
    };
  }
  function choose(plan, choice) {
    if (!plan.boss || plan.used || plan.settled || !['power', 'gauge'].includes(choice))
      return false;
    plan.choice = choice;
    return true;
  }
  function record(plan, count, type) {
    if (
      plan.settled ||
      plan.used >= config.moves ||
      !Number.isInteger(count) ||
      count < 3 ||
      count > 30
    )
      return false;
    plan.used++;
    plan.total += count;
    if (count >= 4) plan.longCount++;
    plan.longest = Math.max(plan.longest, count);
    if (!plan.types.includes(type)) plan.types.push(type);
    return true;
  }
  function progress(plan) {
    return plan.goal.kind === 'longTwice'
      ? plan.longCount
      : plan.goal.kind === 'long'
        ? plan.longest
        : plan.goal.kind === 'types'
          ? plan.types.length
          : plan.total;
  }
  function achieved(plan) {
    return progress(plan) >= plan.goal.target && (!plan.trainer || plan.boss || plan.total >= 12);
  }
  function settle(plan) {
    if (plan.settled || plan.used !== config.moves) return null;
    plan.settled = true;
    const success = achieved(plan);
    return {
      success,
      multiplier: success && plan.choice === 'power' ? 1.5 : 1,
      gauge: success && plan.choice === 'gauge' ? 4 : 0,
    };
  }
  return Object.freeze({ config, create, choose, record, progress, achieved, settle });
})();
