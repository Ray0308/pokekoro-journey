// 任意のPlaywright検証。投球の実判定、表示値、バッジ境界、サファリ除外を確認する。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const server = spawn('python', ['-m', 'http.server', '8829', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    for (const [mode, cleared, roll, expected] of [
      ['normal', false, 0.6, true],
      ['normal', true, 0.6, false],
      ['type', false, 0.6, true],
      ['type', true, 0.6, false],
      ['hyper', false, 0.94, true],
      ['master', false, 0.999, true],
      ['safari', false, 0.6, false],
    ]) {
      const page = await browser.newPage({
        viewport: { width: 390, height: 664 },
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8829');
      await page.waitForFunction(() => $('#boot-screen').hidden);
      await page.evaluate(
        ({ mode, cleared }) => {
          state.opening.stage = 'complete';
          state.mapId = 'viridian';
          state.tour = 1;
          state.clearedMaps = cleared ? ['pewter-gym'] : [];
          state.trainerWins = {};
          state.owned = [1, 4, 7];
          state.party = [1, 4, 7];
          state.balls = 5;
          state.hyper = 5;
          state.master = 5;
          state.typeBalls[0] = 5;
          document.dispatchEvent(new CustomEvent('title:start'));
          openBattle(false, false);
          $('#encounter').close();
          battle.m = POKEDEX[24];
          battle.combat = null;
          battle.hp = 0;
          battle.damage = battle.total;
          battle.victory = true;
          endBattle(true);
          battle.captureBase = 0.4;
          if (mode === 'safari') battle.safari = true;
        },
        { mode, cleared },
      );
      assert.match(await page.locator('#normal small').textContent(), /40%/);
      const stock = await page.evaluate(
        (mode) =>
          captureBallStock(
            [...BALLS, ...TYPE_BALLS].find(
              (b) => b.id === (mode === 'type' ? 'type-0' : mode === 'safari' ? 'normal' : mode),
            ),
            state,
          ),
        mode,
      );
      await page.evaluate(
        ({ mode, roll }) => {
          Math.random = () => roll;
          catchMon(mode === 'type' ? 'type-0' : mode === 'safari' ? 'normal' : mode, 0.4);
        },
        { mode, roll },
      );
      await page.locator('.swipe-ball').press('Enter');
      await page.waitForFunction(
        () => !capturePending && !document.querySelector('#capture-gesture'),
      );
      assert.equal(await page.evaluate(() => state.owned.includes(25)), expected);
      assert.equal(
        await page.evaluate(
          (mode) =>
            captureBallStock(
              [...BALLS, ...TYPE_BALLS].find(
                (b) => b.id === (mode === 'type' ? 'type-0' : mode === 'safari' ? 'normal' : mode),
              ),
              state,
            ),
          mode,
        ),
        stock - 1,
      );
      assert.deepEqual(errors, []);
      await page.close();
      console.log('PASS capture', mode, cleared ? 'after badge' : 'before badge', roll, expected);
    }
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8829');
    await page.waitForFunction(() => $('#boot-screen').hidden);
    for (const id of ['viridian', 'pewter-city']) {
      await page.evaluate((id) => {
        state.opening.stage = 'complete';
        document.dispatchEvent(new CustomEvent('title:start'));
        state.mapId = id;
        state.pos = 0;
        render();
      }, id);
      assert.equal(await page.locator('#route .tile.node-wild').count(), 9);
      assert.equal(await page.locator('#route .tile.node-trainer').count(), 1);
      assert.equal(await page.locator('#route .tile').count(), 15);
    }
    console.log('PASS early map encounter counts');
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
