'use strict';
const assert = require('node:assert/strict'),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8894', '--bind', '127.0.0.1'], {
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
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8894');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7, 25];
        state.seen = [25, 150, 151];
        state.clearedMaps = [...MAP_ORDER];
        state.mapId = 'viridian';
        state.pos = 6;
        state.pendingMapId = null;
        document.dispatchEvent(new CustomEvent('title:start'));
        PokekoroDex.open(999);
      });
      assert.equal(await p.locator('#device-habitat').isVisible(), false);
      await p.evaluate(() => {
        PokekoroDex.open(25);
      });
      await p.locator('#device-habitat').tap();
      await p.screenshot({ path: `/workspace/pokemon-habitat-${viewport.width}.png` });
      assert.equal(await p.locator('.habitat-body section').count(), 3);
      assert.match(await p.locator('#pokemon-habitat-dialog').innerText(), /ピカチュウ/);
      assert(
        await p.locator('#habitat-close').evaluate((n) => {
          const r = n.getBoundingClientRect();
          return (
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          );
        }),
      );
      const world = await p
        .locator('[data-habitat-world]')
        .first()
        .getAttribute('data-habitat-world');
      await p.locator('[data-habitat-world]').first().tap();
      assert(await p.locator('#journey').isVisible());
      assert.equal(await p.evaluate(() => state.pos), 6);
      assert.equal(await p.evaluate(() => state.mapReturn), null);
      assert.equal(
        await p.evaluate((id) => KANTO_PLACES.find((p) => p.maps.includes(id)).id, world),
        await p.locator('.kanto-pin[aria-pressed=true]').getAttribute('data-kanto-place'),
      );
      await p.evaluate(() => {
        showTab('map');
        PokekoroDex.open(25);
      });
      await p.locator('#device-habitat').tap();
      const target = await p
        .locator('[data-habitat-travel]')
        .first()
        .getAttribute('data-habitat-travel');
      await p.locator('[data-habitat-travel]').first().tap();
      assert.equal(await p.evaluate(() => state.mapId), target);
      assert.equal(await p.evaluate(() => state.mapReturn.pos), 6);
      await p.evaluate(() => returnToAdventure());
      assert.equal(await p.evaluate(() => state.mapId), 'viridian');
      await p.evaluate(() => {
        PokekoroDex.open(151);
      });
      await p.locator('#device-habitat').tap();
      assert.match(await p.locator('#pokemon-habitat-dialog').innerText(), /虹チケット/);
      assert.equal(await p.locator('[data-habitat-travel]').count(), 0);
      await p.locator('#habitat-close').tap();
      assert(await p.locator('#pokedex-device').isVisible());
      assert.deepEqual(errors, []);
      console.log(
        'PASS unseen secrecy, actual ranked locations, touch footer, world selection without travel, cleared revisit/bookmark, mythical special',
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
