'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8882', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    const p = await browser.newPage({
      viewport: { width: 390, height: 664 },
      hasTouch: true,
      ignoreHTTPSErrors: true,
      reducedMotion: 'reduce',
    });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8882');
    await p.waitForFunction(() => $('#boot-screen').hidden);
    await p.evaluate(() => {
      state.opening.stage = 'complete';
      state.party = [1, 4, 7, 11, 25, 446];
      state.owned = [...state.party];
      document.dispatchEvent(new CustomEvent('title:start'));
    });
    for (const [mapId, boss] of [
      ['viridian', false],
      ['pewter-gym', true],
      ['cerulean-gym', true],
      ['rocket-hideout', false],
      ['viridian-gym', true],
      ['indigo-champion', true],
    ]) {
      const result = await p.evaluate(
        ([mapId, boss]) => {
          for (const d of document.querySelectorAll('dialog[open]')) d.close();
          busy = false;
          capturePending = false;
          state.mapId = mapId;
          state.bossLosses = {};
          openBattle(true, boss);
          $('#encounter').close();
          $('#battle').showModal();
          battle.roundStarted = true;
          fitBattle();
          const member = battle.series.team[0],
            ace = battle.series.team.length === 1;
          const oldBase = Math.round(
            (boss ? (ace ? 620 : 360) : ace ? 460 : 260) * (0.8 + member.level * 0.01),
          );
          return {
            hp: battle.total,
            previousHP: Math.max(
              1,
              Math.round(member.hp * Math.max(0.75, Math.min(1.6, 0.7 + battle.m.stats.hp / 240))),
            ),
            old: PokemonBattleStats.enemyHP(battle.m, oldBase),
            wild: PokemonBattleStats.enemyHP(battle.m, 365),
            expected: PokemonBattleStats.enemyHP(battle.m, member.hp),
            duration: battleDuration(),
          };
        },
        [mapId, boss],
      );
      assert.equal(result.hp, result.expected);
      assert.equal(result.hp, Math.max(1, Math.round(result.previousHP * 0.9)));
      assert(result.hp > result.old * 1.8);
      assert(result.hp > result.wild);
      assert.equal(result.duration, 10);
      assert.match(await p.locator('#battle').innerText(), new RegExp(String(result.hp)));
      console.log('PASS runtime trainer HP', mapId, result.old + ' -> ' + result.hp);
    }
    await p.evaluate(() => {
      for (const d of document.querySelectorAll('dialog[open]')) d.close();
      busy = false;
      state.mapId = 'pewter-gym';
      openBattle(true, true);
      $('#encounter').close();
      $('#battle').showModal();
      battle.roundStarted = true;
      battle.phase = 'ready';
      battle.damage = 400;
      battle.typeCharge = {};
      void PokekoroTurns.resolve();
    });
    await p.waitForFunction(() => battle.phase === 'ready' && battle.counterPending);
    assert(
      await p.evaluate(() => battle.hp === battle.total - 400 && battle.hp > 0),
      'old one-hit damage no longer defeats trainer',
    );
    const next = await p.evaluate(() => {
      battle.combat.members[0].gauge = 3;
      battle.combat.guard = true;
      const total = battle.series.team.length;
      battle.hp = 0;
      nextTrainerRound();
      return {
        index: battle.series.index,
        total,
        hp: battle.total,
        gauge: battle.combat.members[0].gauge,
        guard: battle.combat.guard,
        expected: PokemonBattleStats.enemyHP(battle.m, battle.series.team[1].hp),
      };
    });
    assert.equal(next.index, 1);
    assert.equal(next.gauge, 3);
    assert.equal(next.guard, true);
    assert.equal(next.hp, next.expected);
    await p.evaluate(() => {
      for (const d of document.querySelectorAll('dialog[open]')) d.close();
      busy = false;
      openBattle(false, false);
    });
    assert(
      await p.evaluate(
        () => !battle.series && battle.total === PokemonBattleStats.enemyHP(battle.m, 365),
      ),
      'wild uses the same reduced HP rule',
    );
    assert.deepEqual(errors, []);
    console.log('PASS extra battle turn, ace HP, carried gauge/guard, reduced wild');
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
