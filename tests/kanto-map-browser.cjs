'use strict';
const assert = require('node:assert/strict'),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8892', '--bind', '127.0.0.1'], {
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
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8892');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7];
        state.clearedMaps = ['pewter-city', 'pewter-gym', 'celadon-city'];
        state.mapId = 'cerulean-city';
        state.pos = 6;
        state.pendingMapId = null;
        document.dispatchEvent(new CustomEvent('title:start'));
        showTab('map');
      });
      await p.locator('#game-menu-toggle').tap();
      await p.locator('[data-menu-action="kanto"]').tap();
      assert.equal(await p.locator('#journey').isVisible(), true);
      assert.equal(await p.evaluate(() => new Set(KANTO_PLACES.flatMap((x) => x.maps)).size), 30);
      assert.deepEqual(
        await p.evaluate(() =>
          MAP_ORDER.filter((id) => !KANTO_PLACES.some((p) => p.maps.includes(id))),
        ),
        [],
      );
      await p.locator('[data-kanto-place="saffron"]').tap();
      assert.equal(await p.locator('.kanto-destinations [data-revisit]').count(), 0);
      assert.match(await p.locator('.kanto-destinations').innerText(), /シルフ/);
      await p.locator('[data-kanto-place="celadon"]').tap();
      assert.equal(await p.locator('.kanto-destinations [data-revisit]').count(), 1);
      await p.locator('#kanto-map').scrollIntoViewIfNeeded();
      await p.screenshot({ path: `/workspace/kanto-map-${viewport.width}.png` });
      assert.equal(
        await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await p.locator('.kanto-destinations [data-revisit="celadon-city"]').tap();
      assert.equal(await p.evaluate(() => state.mapId), 'celadon-city');
      assert.equal(await p.evaluate(() => state.mapReturn.pos), 6);
      assert.equal(await p.evaluate(() => state.mapReturn.mapId), 'cerulean-city');
      await p.evaluate(() => {
        showTab('journey');
      });
      await p.locator('#return-adventure').tap();
      assert.equal(await p.evaluate(() => state.mapId), 'cerulean-city');
      assert.equal(await p.evaluate(() => state.pos), 6);
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      assert.equal(await p.evaluate(() => state.pos), 6);
      assert.deepEqual(errors, []);
      console.log(
        'PASS all30 mapped, geography selection, locked targets, cleared travel and original progress/reload',
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
