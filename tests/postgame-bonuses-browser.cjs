'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8891', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    for (const viewport of [
      { width: 390, height: 664 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      const p = await browser.newPage({
          viewport,
          hasTouch: true,
          ignoreHTTPSErrors: true,
          reducedMotion: 'reduce',
        }),
        errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8891');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      const result = await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.balls = 20;
        state.party = [1, 4, 7, 25, 32, 446];
        state.owned = [...state.party];
        state.hallOfFame = HallOfFameRules.normalize({ count: 3 });
        state.clearedMaps = [...MAP_ORDER];
        state.mapId = 'indigo-lorelei';
        state.pos = 14;
        state.bossLosses = {};
        document.dispatchEvent(new CustomEvent('title:start'));
        openBattle(true, true);
        $('#encounter').close();
        const hp = battle.total,
          team = JSON.stringify(battle.series.team);
        const label = $('#kind').textContent;
        const next = { ...battle.series, index: 1 };
        openBattle(true, true, next);
        $('#encounter').close();
        const continued = battle.series.hallBonus.clears;
        state.bossLosses[bossLossKey()] = 2;
        openBattle(true, true);
        $('#encounter').close();
        const assisted = battle.assisted,
          assistedHP = battle.total,
          expectedAssist = Math.round(
            PokemonBattleStats.enemyHP(battle.m, battle.series.team[0].hp) * 0.9,
          );
        return {
          hp,
          assistedHP,
          expectedAssist,
          assisted,
          label,
          continued,
          team,
          count: state.hallOfFame.count,
        };
      });
      assert.match(result.label, /強化再戦/);
      assert.equal(result.continued, 3);
      assert(result.assisted);
      assert.equal(result.assistedHP, result.expectedAssist);
      assert.equal(result.count, 3);
      await p.evaluate(() => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
        state.mapId = 'mt-moon';
        state.pos = 2;
        state.bossLosses = {};
        busy = false;
        openBattle(false, false);
        $('#encounter').close();
        battle.hp = 0;
        battle.damage = battle.total;
        maxCombo = 0;
        battle.victory = true;
        endBattle(true);
      });
      assert.match(await p.locator('#normal').innerText(), /成功 43%/);
      const caught = await p.evaluate(async () => {
        const old = Math.random;
        Math.random = () => 0.415;
        const before = state.balls;
        try {
          await catchMon('normal', 0, true);
          return { outcome: $('.capture-outcome').dataset.outcome, before, after: state.balls };
        } finally {
          Math.random = old;
        }
      });
      assert.match(caught.outcome, /caught|new|duplicate/);
      assert(caught.after === caught.before - 1 || caught.after === caught.before + 1);
      await p.evaluate(() => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
        PokekoroHall.open(true);
      });
      assert.match(await p.locator('#hall-of-fame').innerText(), /捕獲率 ＋3ポイント/);
      await p.screenshot({ path: `/workspace/postgame-bonus-${viewport.width}.png` });
      assert(
        await p.locator('#hall-next').evaluate((n) => {
          const r = n.getBoundingClientRect();
          return (
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          );
        }),
      );
      await p.locator('#hall-next').tap();
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      assert.equal(await p.evaluate(() => HallOfFameRules.captureBonus(state)), 0.03);
      assert.deepEqual(errors, []);
      console.log(
        'PASS live bonus display/throw decision, league continuation and 2-loss assist, history touch and saved clear count',
        viewport.width,
      );
      await p.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
