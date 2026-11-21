const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8875', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const [mode, viewport] of [
      ['normal', { width: 390, height: 664 }],
      ['safari', { width: 320, height: 568 }],
      ['mock', { width: 844, height: 390 }],
    ]) {
      const p = await b.newPage({ viewport, hasTouch: true, ignoreHTTPSErrors: true });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8875');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate((mode) => {
        window.lastHint = [];
        const original = drawPuzzleHint;
        drawPuzzleHint = (ctx, hint, now, still) => {
          window.lastHint = [...hint];
          original(ctx, hint, now, still);
        };
        state.owned = [1, 4, 7, 25, 446];
        state.party = [1, 4, 7, 25];
        if (mode === 'mock') {
          state.opening = { version: 5, stage: 'practice', starterId: 1 };
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
        }
      }, mode);
      if (mode === 'mock') {
        await p.locator('#opening-next').tap();
        await p.locator('#mock-start').tap();
        await p.waitForFunction(() => PokekoroMockPractice.inspect().phase === 'round');
      } else {
        await p.locator('#start').tap();
        await p.waitForFunction(() => running);
      }
      const snapshot = () =>
        p.evaluate(
          (mode) =>
            JSON.stringify(
              mode === 'mock'
                ? PokekoroMockPractice.inspect()
                : {
                    damage: battle.damage,
                    hp: battle.hp,
                    combat: battle.combat,
                    balls: state.balls,
                    startAt,
                    grid,
                  },
            ),
          mode,
        );
      const before = await snapshot();
      await p.waitForTimeout(1100);
      assert.deepEqual(await p.evaluate(() => window.lastHint), []);
      await p.waitForFunction(() => window.lastHint.length === 3);
      assert.equal(await snapshot(), before, 'hint gives no power, gauge, stock or board change');
      const hint = await p.evaluate(() => window.lastHint);
      const board = await p.evaluate(
        (mode) => (mode === 'mock' ? PokekoroMockPractice.inspect().board : grid),
        mode,
      );
      assert.equal(new Set(hint).size, 3);
      assert(hint.every((i) => board[i] === board[hint[0]]));
      if (process.env.ASSIST_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/puzzle-assist-${mode}.png` });
      if (mode !== 'mock') {
        const r = await p.locator('#board').boundingBox();
        const c = await p.context().newCDPSession(p);
        const i = hint[0];
        const point = {
          x: r.x + (((i % 6) + 0.5) * r.width) / 6,
          y: r.y + ((Math.floor(i / 6) + 0.5) * r.height) / 5,
        };
        await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        assert.equal(await p.evaluate(() => puzzleAssist.path.length), 0);
        await p.waitForTimeout(1600);
        assert.equal(await p.evaluate(() => puzzleAssist.path.length), 0);
        await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await c.detach();
        const frozen = await p.evaluate(() =>
          JSON.stringify({
            damage: battle.damage,
            hp: battle.hp,
            combat: battle.combat,
            balls: state.balls,
            startAt,
          }),
        );
        await p.evaluate(() => {
          grid = Array.from(
            { length: 30 },
            (_, i) => battle.puzzleTypes[(Math.floor(i / 6) % 2) * 2 + (i % 2)],
          );
          window.deadBoard = [...grid];
          window.deadBoardAt = performance.now();
          puzzleAssist.touch(performance.now());
          lastPuzzleRefreshAt = performance.now();
          draw();
        });
        await p.waitForFunction(() => grid.some((v, i) => v !== window.deadBoard[i]));
        assert.equal(
          await p.evaluate(() =>
            JSON.stringify({
              damage: battle.damage,
              hp: battle.hp,
              combat: battle.combat,
              balls: state.balls,
              startAt,
            }),
          ),
          frozen,
          'auto refresh preserves battle values and clock origin',
        );
        assert(
          await p.evaluate(() => lastPuzzleRefreshAt - window.deadBoardAt < 500),
          'deadlock bypasses both idle delay and manual cooldown',
        );
        assert(await p.evaluate(() => puzzleHintPath(grid).length === 3));
        assert.equal(await p.evaluate(() => puzzleAssist.path.length), 0);
        assert.deepEqual(errors, []);
      }
      console.log(
        'PASS idle hint/no reward/touch hold and deadlock refresh with unchanged timer/resources',
        mode,
      );
      await p.close();
    }
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
