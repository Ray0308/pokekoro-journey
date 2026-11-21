const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8857', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const [starter, viewport] of [
      [1, { width: 390, height: 664 }],
      [4, { width: 320, height: 568 }],
      [7, { width: 844, height: 390 }],
    ]) {
      const p = await b.newPage({
        viewport,
        hasTouch: true,
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8857');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate((id) => {
        state.opening.stage = 'practice';
        state.opening.starterId = id;
        state.opening.version = 5;
        state.owned = [446];
        state.party = [446];
        state.playerName = 'レン';
        document.dispatchEvent(new CustomEvent('title:start'));
      }, starter);
      await p.locator('#opening-next').tap();
      await p.waitForSelector('#mock-practice[open]');
      await p.waitForFunction(() => PokekoroMapAudio.inspect().theme === 'gym');
      assert.deepEqual(
        await p
          .locator('[data-mock-member]')
          .evaluateAll((ns) => ns.map((n) => Number(n.dataset.mockMember))),
        [starter, 446],
      );
      assert.equal(await p.locator('#mock-practice progress').count(), 0, 'No absurd training HP');
      if (process.env.MOCK_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/mock-training-${viewport.width}.png` });
      async function swipe(path) {
        const r = await p.locator('#mock-practice canvas').boundingBox(),
          cdp = await p.context().newCDPSession(p);
        for (let n = 0; n < path.length; n++) {
          const i = path[n],
            point = {
              x: r.x + (((i % 6) + 0.5) * r.width) / 6,
              y: r.y + ((Math.floor(i / 6) + 0.5) * r.height) / 5,
            };
          await cdp.send('Input.dispatchTouchEvent', {
            type: n ? 'touchMove' : 'touchStart',
            touchPoints: [point],
          });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
        await p.waitForTimeout(140);
      }
      await swipe([12, 13]);
      assert.equal(await p.evaluate(() => PokekoroMockPractice.inspect().phase), 'trace');
      await swipe([12, 13, 14]);
      assert.equal(await p.evaluate(() => PokekoroMockPractice.inspect().phase), 'ready');
      const firstGauge = await p.evaluate(() => PokekoroMockPractice.inspect().gauges[0].value);
      assert(firstGauge > 0);
      await p.locator('#mock-start').tap();
      await p.waitForFunction(() => PokekoroMockPractice.inspect()?.phase === 'round');
      assert(
        (await p.evaluate(() => PokekoroMockPractice.inspect().gauges[0].value)) >= firstGauge,
      );
      for (let n = 0; n < 8; n++) {
        const path = await p.evaluate((id) => {
          const board = PokekoroMockPractice.inspect().board,
            preferred = pokemonTypes(POKEDEX[id - 1]);
          function walk(path) {
            if (path.length === 3) return path;
            const last = path.at(-1);
            for (let i = 0; i < 30; i++)
              if (
                !path.includes(i) &&
                board[i] === board[last] &&
                Math.abs((i % 6) - (last % 6)) <= 1 &&
                Math.abs(Math.floor(i / 6) - Math.floor(last / 6)) <= 1
              ) {
                const r = walk([...path, i]);
                if (r) return r;
              }
            return null;
          }
          for (const type of preferred)
            for (let i = 0; i < 30; i++)
              if (board[i] === type) {
                const r = walk([i]);
                if (r) return r;
              }
          return null;
        }, starter);
        if (path) await swipe(path);
      }
      await p.waitForFunction(() => PokekoroMockPractice.inspect()?.rounds >= 1, {
        timeout: 20000,
      });
      await p.waitForSelector('#mock-start:not([hidden])');
      const before = await p.evaluate(() => PokekoroMockPractice.inspect());
      assert(before.totalDamage > 0);
      assert.equal(
        before.gauges[0].value,
        await p.evaluate((id) => PokemonSkillRules.cost(id), starter),
      );
      if (starter === 1) {
        await p.locator('#mock-start').tap();
        await p.waitForFunction(() => PokekoroMockPractice.inspect().phase === 'round');
        await p.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        const interrupted = await p.evaluate(() => PokekoroMockPractice.inspect());
        assert.deepEqual(interrupted.gauges, before.gauges);
        assert.equal(interrupted.phase, 'round');
        assert(await p.locator('#battle-pause[open]').isVisible());
        await p.evaluate(() => {
          delete document.hidden;
          document.dispatchEvent(new Event('visibilitychange'));
        });
      }
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      await p.locator('#opening-next').tap();
      const restored = await p.evaluate(() => PokekoroMockPractice.inspect());
      assert.deepEqual(restored.gauges, before.gauges);
      assert.equal(restored.totalDamage, before.totalDamage);
      assert.equal(restored.rounds, 1);
      await p.locator(`[data-mock-member="${starter}"]`).tap();
      await p.locator('#mock-use').tap();
      await p.waitForSelector('#mock-finish:not([hidden])');
      assert.equal(await p.evaluate(() => PokekoroMockPractice.inspect().gauges[0].value), 0);
      assert.deepEqual(
        await p.evaluate(() => state.owned),
        [446],
        'No lesson Pokemon or inventory granted',
      );
      if (process.env.MOCK_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/mock-skill-${viewport.width}.png` });
      await p.locator('#mock-finish').tap();
      assert.equal(await p.evaluate(() => state.opening.stage), 'mockGift');
      assert.match(await p.locator('.opening-message p').innerText(), /たくそう/);
      await p.locator('#opening-next').tap();
      await p.locator('#opening-next').tap();
      await p.waitForSelector('.swipe-ball');
      await p.locator('.swipe-ball').press('Enter');
      await p.waitForFunction(() => state.opening.stage === 'caught');
      for (let n = 0; n < 8 && (await p.evaluate(() => state.opening.stage)) !== 'diceLesson'; n++)
        await p.locator('#opening-next').tap();
      assert.equal(await p.evaluate(() => state.opening.stage), 'diceLesson');
      assert.deepEqual(await p.evaluate(() => state.party), [starter, 446, 25]);
      assert.equal(await p.evaluate(() => state.balls), 8);
      assert.equal(await p.evaluate(() => state.super), 2);
      assert.match(await p.locator('#practice-coach').innerText(), /出た目/);
      assert.deepEqual(errors, []);
      console.log(
        'PASS mock own partners, gauge continuity, actual 10s, skill, reload, gift/capture/dice',
        starter,
        viewport.width,
      );
      await p.close();
    }
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  server.kill();
});
