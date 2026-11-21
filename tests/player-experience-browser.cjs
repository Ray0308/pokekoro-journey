require('node:fs').mkdirSync('/tmp/audit76', { recursive: true });
// 任意のPlaywright検証。通常画面・道具獲得・捕獲3結果・図鑑編成・ガイドを確認する。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const server = spawn('python', ['-m', 'http.server', '8831', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    for (const [width, height] of [
      [390, 664],
      [320, 568],
      [844, 390],
      [1280, 900],
    ]) {
      const p = await b.newPage({
        viewport: { width, height },
        reducedMotion: width === 390 ? 'no-preference' : 'reduce',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8831');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7];
        state.balls = 8;
        document.dispatchEvent(new CustomEvent('title:start'));
      });
      assert.equal(await p.evaluate(() => PokekoroDebug.isActive()), false);
      assert.equal(await p.locator('#debug-tools-button').isVisible(), false);
      const guide = await p.locator('#guide').textContent();
      assert(guide.includes('10びょう'));
      assert(!guide.includes('小さなダメージ'));
      await p.evaluate(() => {
        battle = { hp: 0 };
        state.pos = 1;
        Math.random = () => 0;
        rollDice();
      });
      await p.waitForSelector('.item-find');
      assert.equal(await p.evaluate(() => state.balls), 11);
      assert.equal(await p.evaluate(() => busy), true);
      assert.equal(await p.locator('.confetti').count(), 0);
      await p.locator('#result').screenshot({ path: `/tmp/audit76/item-${width}.png` });
      assert(await p.locator('#result').evaluate((d) => d.scrollWidth <= d.clientWidth + 1));
      await p.locator('#item-find-done').click();
      assert.equal(await p.evaluate(() => busy), false);
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      assert.equal(await p.evaluate(() => state.balls), 11);
      assert.equal(await p.evaluate(() => state.pos), 2);
      await p.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      for (const kind of ['new', 'duplicate', 'miss']) {
        await p.evaluate((kind) => {
          state.owned = kind === 'duplicate' ? [1, 4, 7, 25] : [1, 4, 7];
          state.balls = 5;
          Math.random = () => (kind === 'miss' ? 0.999 : 0);
          openBattle(false, false);
          $('#encounter').close();
          battle.m = POKEDEX[24];
          battle.combat = null;
          battle.hp = 0;
          battle.damage = battle.total;
          battle.victory = true;
          endBattle(true);
        }, kind);
        await p.locator('#normal').click();
        await p.locator('.swipe-ball').press('Enter');
        await p.waitForSelector(`.capture-outcome[data-outcome='${kind}']`);
        await p
          .locator('#result')
          .screenshot({ path: `/tmp/audit76/capture-${kind}-${width}.png` });
        assert(await p.locator('#result').evaluate((d) => d.scrollWidth <= d.clientWidth + 1));
        assert.equal(await p.evaluate(() => state.balls), kind === 'duplicate' ? 6 : 4);
        assert.equal(await p.evaluate(() => state.owned.includes(25)), kind !== 'miss');
        if (kind === 'new') {
          await p.locator('#capture-view').scrollIntoViewIfNeeded();
          await p.locator('#capture-view').click();
          assert.equal(await p.locator('#result').evaluate((d) => d.open), false);
          assert.equal(await p.locator('#device-name').textContent(), 'ピカチュウ');
          await p.locator('#device-party').click();
          assert(await p.evaluate(() => state.party.includes(25)));
          await p.locator('#device-close').click();
        } else {
          await p.locator('#done').scrollIntoViewIfNeeded();
          await p.locator('#done').click();
        }
      }
      await p.evaluate(() => {
        state.mapId = 'viridian';
        state.pos = 6;
        state.balls = 20;
        state.super = 0;
        state.kurtHouses[kurtVisitKey(state)] = false;
        PokekoroBallExchange.open();
      });
      await p.locator('#exchange-normal-super').fill('2');
      await p.locator('[data-recipe="normal-super"] .exchange-submit').click();
      assert.deepEqual(await p.evaluate(() => [state.balls, state.super]), [10, 2]);
      assert.match(await p.locator('#exchange-status').textContent(), /×2/);
      await p.locator('#exchange-status').scrollIntoViewIfNeeded();
      await p.locator('#ball-exchange').screenshot({ path: `/tmp/audit76/exchange-${width}.png` });
      await p.locator('#exchange-close').click();
      await p.evaluate(() => PokekoroBallExchange.open());
      assert.equal(await p.locator('#exchange-status.exchange-complete').count(), 0);
      await p.locator('#exchange-close').click();
      await p.evaluate(() => {
        $('#guide').showModal();
      });
      await p.locator('#guide > button').scrollIntoViewIfNeeded();
      assert(await p.locator('#guide').evaluate((d) => d.scrollWidth <= d.clientWidth + 1));
      await p.locator('#guide > button').click();
      assert.deepEqual(errors, []);
      console.log(
        'PASS',
        width,
        height,
        'normal debug hidden; item once; new/duplicate/miss; dex+party; guide',
      );
      await p.close();
    }
    const p = await b.newPage({ ignoreHTTPSErrors: true });
    await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8831');
    await p.waitForFunction(() => $('#boot-screen').hidden);
    await p.evaluate(() => {
      state.opening.stage = 'complete';
      state.party = [1, 4, 7];
      state.owned = [1, 4, 7];
      for (let i = 0; i < 5; i++) $('#title-debug').click();
    });
    await p.locator('#debug-start').click();
    assert(await p.evaluate(() => PokekoroDebug.isActive()));
    assert(await p.locator('#debug-tools-button').isVisible());
    console.log('PASS explicit debug mode still available');
    await p.close();
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
