const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8864', '--bind', '127.0.0.1'], {
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
    ]) {
      const p = await b.newPage({
        viewport,
        hasTouch: true,
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8864');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.owned = [1, 4, 7];
        state.party = [1, 4, 7];
        state.mapId = 'viridian';
        state.pos = 6;
        state.balls = 8;
        state.super = 2;
        document.dispatchEvent(new CustomEvent('title:start'));
        render();
      });
      const snapshot = () =>
        p.evaluate(() =>
          JSON.stringify({
            map: state.mapId,
            pos: state.pos,
            party: state.party,
            balls: state.balls,
            super: state.super,
            mapReturn: state.mapReturn,
          }),
        );
      const before = await snapshot();
      async function hit(selector) {
        const g = await p.locator(selector).evaluate((n) => {
          const r = n.getBoundingClientRect();
          return {
            inside:
              r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1,
            hit: n.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)),
          };
        });
        assert(g.inside && g.hit, selector + JSON.stringify(g));
        await p.locator(selector).tap();
      }
      await hit('#game-menu-toggle');
      assert.equal(await p.locator('[data-menu-action="map"]').innerText(), '← マップにもどる');
      await hit('#game-menu-close');
      assert.equal(await p.locator('#game-menu').isVisible(), false);
      assert.equal(await p.locator('#game-menu-toggle').getAttribute('aria-expanded'), 'false');
      for (const action of ['party', 'badges']) {
        await p.locator('#game-menu-toggle').tap();
        await p.locator(`[data-menu-action="${action}"]`).tap();
        const view = action === 'party' ? 'party' : 'journey';
        assert.equal(await p.evaluate(() => document.body.dataset.gameView), view);
        assert.equal(
          await p.locator('.game-navigation [data-tab="map"]').innerText(),
          'マップにもどる',
        );
        if (process.env.MENU_SCREENSHOTS)
          await p.screenshot({ path: `/workspace/menu-return-${action}-${viewport.width}.png` });
        await p.locator('#game-menu-toggle').tap();
        await hit('#game-menu-close');
        assert.equal(
          await p.evaluate(() => document.body.dataset.gameView),
          view,
          'close preserves screen',
        );
        await p.locator('#game-menu-toggle').tap();
        if (process.env.MENU_SCREENSHOTS)
          await p.screenshot({ path: `/workspace/menu-open-${viewport.width}.png` });
        const link = p.locator('[data-menu-action="map"]');
        const r = await link.boundingBox();
        assert(r.x >= 0 && r.y >= 0 && r.y + r.height <= viewport.height + 1);
        assert(
          await link.evaluate((n) =>
            n.contains(
              document.elementFromPoint(
                n.getBoundingClientRect().left + n.clientWidth / 2,
                n.getBoundingClientRect().top + n.clientHeight / 2,
              ),
            ),
          ),
        );
        await link.tap();
        assert.equal(await p.evaluate(() => document.body.dataset.gameView), 'map');
        assert(await p.locator('#map').isVisible());
        assert.equal(await p.locator('#game-menu').isVisible(), false);
        assert.equal(await snapshot(), before, 'navigation does not change progress');
      }
      await p.locator('#game-menu-toggle').tap();
      await p.locator('[data-menu-action="party"]').tap();
      await hit('.game-navigation [data-tab="map"]');
      assert.equal(await p.evaluate(() => document.body.dataset.gameView), 'map');
      await p.locator('#game-menu-toggle').tap();
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('#game-menu').isVisible(), false);
      await p.locator('#game-menu-toggle').tap();
      await p.locator('#game-menu-close').focus();
      await p.keyboard.press('ArrowUp');
      assert.equal(await p.evaluate(() => document.activeElement.dataset.menuAction), 'map');
      await p.keyboard.press('End');
      assert.equal(await p.evaluate(() => document.activeElement.dataset.menuAction), 'map');
      await p.keyboard.press('Enter');
      assert.equal(await p.evaluate(() => document.body.dataset.gameView), 'map');
      assert.deepEqual(errors, []);
      console.log(
        'PASS explicit close/map return, party/badges/top back, keyboard, visible hits, progress preserved',
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
