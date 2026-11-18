'use strict';
// 練習だけのチェックポイント。通常戦の値やポケモンマスタは変更しない。
const PracticeRules = (() => {
  const steps = [
    'trace',
    'round',
    'charge',
    'skillOpen',
    'skillUse',
    'neutral',
    'advantage',
    'counter',
    'faintOpen',
    'faintTry',
    'gray',
    'live',
  ];
  const team = [32, 7, 403];
  const comparisonTeam = [109, 403, 7];
  const cells = [12, 13, 14];
  function create(step) {
    const index = steps.indexOf(step);
    step = index < 0 ? 'trace' : step;
    const comparing = ['neutral', 'advantage'].includes(step);
    const combat = BattleTurnRules.create(comparing ? comparisonTeam : team);
    // 保存済みの成功地点から再開するときだけ、既に獲得したゲージ・ひんしを再構成。
    if (['skillOpen', 'skillUse'].includes(step)) BattleTurnRules.charge(combat, 3, 9);
    if (['faintOpen', 'faintTry', 'gray', 'live'].includes(step))
      BattleTurnRules.retaliate(combat, () => 0);
    const enemy = POKEDEX[(comparing ? 7 : 25) - 1];
    const targetType = step === 'advantage' ? 6 : step === 'live' ? 2 : 3;
    const board = Array.from(
      { length: PUZZLE_LAYOUT.count },
      (_, i) => [3, 2, 6][(i + Math.floor(i / 6)) % 3],
    );
    for (const i of cells) board[i] = targetType;
    const model = {
      step,
      combat,
      enemy,
      board,
      targetType,
      power: 0,
      hp: 10000,
      total: 10000,
      clears: 0,
    };
    if (step === 'live') model.hp = model.total = power(model, 2, 3);
    return model;
  }
  function power(model, type, count) {
    return puzzleCharge(
      partyTypePower(BattleTurnRules.alive(model.combat), type, model.enemy),
      count,
      1,
      pokemonTypeMultiplier(type, model.enemy),
      3,
    );
  }
  function validPath(board, path) {
    return (
      path.length >= 3 &&
      new Set(path).size === path.length &&
      path.every(
        (i, n) =>
          Number.isInteger(i) &&
          i >= 0 &&
          i < board.length &&
          board[i] === board[path[0]] &&
          (!n ||
            (Math.abs((i % 6) - (path[n - 1] % 6)) <= 1 &&
              Math.abs(Math.floor(i / 6) - Math.floor(path[n - 1] / 6)) <= 1)),
      )
    );
  }
  function clear(model, path) {
    const guided = model.step !== 'round';
    if (
      !validPath(model.board, path) ||
      (guided && (path.length !== 3 || !cells.every((i) => path.includes(i))))
    )
      return null;
    const type = model.board[path[0]],
      amount = power(model, type, path.length);
    const before = model.power;
    model.power += amount;
    model.clears++;
    BattleTurnRules.charge(model.combat, type, path.length);
    return { type, amount, before, after: model.power };
  }
  return Object.freeze({ steps, team, comparisonTeam, cells, create, power, validPath, clear });
})();
