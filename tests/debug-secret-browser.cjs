const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8877', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const viewport of [
      { width: 390, height: 664 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ].filter((v) => !process.env.DEBUG_WIDTH || v.width === Number(process.env.DEBUG_WIDTH))) {
      const p = await b.newPage({
        viewport,
        hasTouch: true,
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8877');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.owned = [1, 4, 7];
        state.party = [1, 4, 7];
        save();
      });
      const original = await p.evaluate(() => localStorage.getItem('pokekoro-v1'));
      assert.equal(await p.locator('#title-debug').innerText(), '');
      assert.equal(
        await p.locator('#title-debug').evaluate((n) => getComputedStyle(n).opacity),
        '0',
      );
      assert.equal(await p.locator('#title-debug').getAttribute('tabindex'), '-1');
      const r = await p.locator('#title-debug').boundingBox();
      const titleBounds = await p.locator('#title-screen').boundingBox();
      assert(
        r.x - titleBounds.x < 20 &&
          r.y + r.height >= titleBounds.y + titleBounds.height - 20 &&
          r.width <= 70 &&
          r.height <= 50,
        'only existing bottom-left area ' + JSON.stringify({ r, viewport }),
      );
      assert(
        await p.locator('#title-debug').evaluate((n) => {
          const r = n.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === n;
        }),
      );
      const tap = () => p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
      for (let n = 0; n < 4; n++) await tap();
      assert.equal(await p.locator('#debug-panel').isVisible(), false);
      await p.locator('.adventure-logo').tap();
      await tap();
      assert.equal(await p.locator('#debug-panel').isVisible(), false, 'outside tap resets');
      for (let n = 0; n < 4; n++) await tap();
      assert(await p.locator('#debug-panel').isVisible());
      assert.equal(
        await p.evaluate(() => PokekoroDebug.isActive()),
        false,
        'opening settings does not enable debug',
      );
      await p.locator('#debug-close').tap();
      for (let n = 0; n < 4; n++) await tap();
      await p.waitForTimeout(3100);
      await tap();
      assert.equal(await p.locator('#debug-panel').isVisible(), false, 'expired series resets');
      for (let n = 0; n < 4; n++) await tap();
      assert(await p.locator('#debug-panel').isVisible());
      assert.equal(await p.evaluate(() => localStorage.getItem('pokekoro-v1')), original);
      await p.locator('#debug-map').selectOption('pewter-gym');
      await p.locator('#debug-start').tap();
      assert(await p.evaluate(() => PokekoroDebug.isActive()));
      assert(await p.locator('#debug-tools-button').isVisible());
      assert(await p.locator('.debug-status').isVisible());
      assert.equal(
        await p.evaluate(() => localStorage.getItem('pokekoro-v1')),
        original,
        'debug save isolated',
      );
      assert(await p.evaluate(() => !!localStorage.getItem('pokekoro-debug-v1')));
      await p.evaluate(() => $('#back-title').click());
      await p.locator('#title-tap-prompt').tap();
      await p.locator('#enter-game').tap();
      await p.waitForFunction(() => !$('#game-shell').hidden);
      assert.equal(await p.evaluate(() => PokekoroDebug.isActive()), false);
      assert.equal(await p.locator('#debug-tools-button').isVisible(), false);
      assert.equal(
        await p.locator('.debug-status').isVisible(),
        false,
        'no badge after normal start',
      );
      assert.equal(await p.evaluate(() => localStorage.getItem('pokekoro-v1')), original);
      await p.evaluate(() => $('#back-title').click());
      for (let n = 0; n < 5; n++) await p.locator('.adventure-logo').tap();
      assert.equal(await p.locator('#debug-panel').isVisible(), false, 'logo never unlocks');
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      assert.equal(await p.evaluate(() => PokekoroDebug.isActive()), false);
      assert.equal(await p.locator('.debug-status').isVisible(), false);
      assert.deepEqual(errors, []);
      console.log(
        'PASS invisible bottom-left, five taps, timeout/outside reset, logo excluded, explicit start, isolated saves and normal return',
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
  server.kill();
  process.exitCode = 1;
});
