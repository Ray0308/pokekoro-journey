// 任意のブラウザ検証。通常反撃・ガード・動きを減らす設定・撤退時の掃除を確認する。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const server = spawn('python', ['-m', 'http.server', '8816', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  let b;
  try {
    b = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox'],
    });
    for (const [vp, reduce, guard, cancel] of [
      [{ width: 390, height: 664 }, 'no-preference', false, false],
      [{ width: 844, height: 390 }, 'no-preference', true, false],
      [{ width: 320, height: 568 }, 'reduce', false, false],
      [{ width: 390, height: 664 }, 'no-preference', false, true],
    ]) {
      const c = await b.newContext({ viewport: vp, reducedMotion: reduce });
      const p = await c.newPage(),
        errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      p.on('dialog', (d) => d.accept());
      await p.goto('http://127.0.0.1:8816');
      await p.waitForFunction(() => document.querySelector('#boot-screen').hidden);
      await p.evaluate((guard) => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7, 25, 446, 32];
        document.dispatchEvent(new CustomEvent('title:start'));
        openBattle(false, false);
        document.querySelector('#encounter').close();
        document.querySelector('#battle').showModal();
        battle.roundStarted = true;
        battle.combat.guard = guard;
        PokekoroTurns.prepare(true);
      }, guard);
      await p.click('#start');
      await p.waitForSelector('.enemy-counter-effect', { timeout: 5000 });
      if (cancel) {
        await p.click('#leave');
        await p.waitForTimeout(800);
        assert.equal(await p.locator('#battle').isVisible(), false);
        assert.equal(await p.locator('.enemy-counter-effect').count(), 0);
      } else {
        await p.waitForFunction(() => running);
        assert.equal(
          await p.evaluate(() => battle.combat.members.filter((m) => m.fainted).length),
          guard ? 0 : 1,
        );
        assert.equal(await p.locator('.enemy-counter-effect').count(), 0);
      }
      assert.deepEqual(errors, []);
      await c.close();
      console.log('PASS', vp, reduce, { guard, cancel });
    }
  } finally {
    if (b) await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
