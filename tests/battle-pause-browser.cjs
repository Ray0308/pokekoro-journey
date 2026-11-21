const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8868', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    for (const [width, height, mode] of [
      [390, 664, 'normal'],
      [320, 568, 'safari'],
      [844, 390, 'mock'],
    ]) {
      const p = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8868');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate((mode) => {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => window.testHidden || false,
        });
        state.owned = [1, 4, 7, 446];
        state.party = [1, 4, 7];
        if (mode === 'mock') {
          state.opening.stage = 'practice';
          state.opening.starterId = 1;
          state.opening.version = 5;
          const m = MockPracticeRules.create(1);
          m.phase = 'ready';
          state.opening.mockBattle = MockPracticeRules.snapshot(m);
        } else state.opening.stage = 'complete';
        document.dispatchEvent(new CustomEvent('title:start'));
        if (mode !== 'mock') {
          if (mode === 'safari') state.mapId = 'safari-zone';
          openBattle(false, false);
          $('#encounter').close();
          $('#battle').showModal();
          if (battle.combat) PokekoroTurns.prepare(false);
        }
      }, mode);
      if (mode === 'mock') {
        await p.locator('#opening-next').tap();
        await p.waitForSelector('#mock-practice[open]');
      }
      const start = mode === 'mock' ? '#mock-start' : '#start';
      const clock = mode === 'mock' ? '#mock-clock' : '#clock';
      const count = mode === 'mock' ? '#mock-countdown' : '#ready-overlay';
      const visibility = async (hidden) =>
        p.evaluate((hidden) => {
          window.testHidden = hidden;
          document.dispatchEvent(new Event('visibilitychange'));
        }, hidden);
      const snapshot = () =>
        p.evaluate(
          (mode) =>
            JSON.stringify(
              mode === 'mock'
                ? PokekoroMockPractice.inspect()
                : {
                    hp: battle.hp,
                    damage: battle.damage,
                    combat: battle.combat,
                    balls: state.balls,
                    losses: state.bossLosses,
                    grid,
                  },
            ),
          mode,
        );
      await p.locator(start).tap();
      await p.waitForTimeout(80);
      await visibility(true);
      const number = await p.locator(count).innerText();
      await p.waitForTimeout(900);
      assert.equal(await p.locator(count).innerText(), number, 'countdown freezes');
      await visibility(false);
      await p.waitForTimeout(150);
      assert.equal(await p.locator(count).innerText(), number, 'no auto resume');
      await p.keyboard.press('Escape');
      assert(await p.locator('#battle-pause').isVisible());
      const button = p.locator('#battle-pause button');
      const r = await button.boundingBox();
      assert(r.x >= 0 && r.y >= 0 && r.y + r.height <= height);
      await button.tap();
      await p.waitForFunction(
        (mode) => (mode === 'mock' ? PokekoroMockPractice.inspect().phase === 'round' : running),
        mode,
      );
      await p.waitForTimeout(400);
      if (mode !== 'mock') {
        const r = await p.locator('#board').boundingBox();
        if (r) {
          await p.mouse.move(r.x + r.width / 12, r.y + r.height / 10);
          await p.mouse.down();
          assert(await p.evaluate(() => activePuzzlePointer !== null));
        }
      }
      await visibility(true);
      if (mode !== 'mock') {
        assert(await p.evaluate(() => activePuzzlePointer === null && path.length === 0));
        await p.mouse.up();
      }
      if (process.env.PAUSE_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/battle-paused-${mode}.png` });
      const before = await snapshot(),
        time = await p.locator(clock).innerText();
      await p.waitForTimeout(mode === 'normal' ? 10500 : 1200);
      assert.equal(await snapshot(), before, 'HP/gauge/power/board/stock unchanged');
      assert.equal(await p.locator(clock).innerText(), time);
      await visibility(false);
      await visibility(true);
      await visibility(false);
      assert.equal(await p.locator('#battle-pause[open]').count(), 1);
      await button.tap();
      await p.waitForTimeout(150);
      assert(
        Math.abs(Number(await p.locator(clock).innerText()) - Number(time)) < 0.5,
        'time resumes from remaining',
      );
      await visibility(true);
      const repeated = await snapshot();
      await p.waitForTimeout(250);
      await visibility(false);
      await button.tap();
      assert.equal(await snapshot(), repeated);
      if (mode === 'normal') {
        await p.evaluate(() => {
          startAt = performance.now() - 9950;
        });
        await p.waitForFunction(() => battle.phase === 'ready' && battle.counterPending, {
          timeout: 10000,
        });
        assert.equal(await p.locator('#result[open]').count(), 0, 'not a loss');
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS countdown, manual resume, timer/state preservation, repeat, visible touch',
        mode,
        width,
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
