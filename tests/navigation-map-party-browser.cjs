'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8880', '--bind', '127.0.0.1'], {
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
      const p = await browser.newPage({ viewport, hasTouch: true, ignoreHTTPSErrors: true });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8880');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7, 25, 32, 446];
        state.owned = [...state.party, 133];
        document.dispatchEvent(new CustomEvent('title:start'));
        render();
        window.noReloadMarker = 123;
      });
      await p.waitForFunction(() => !mapArtLoading);
      await p.locator('.map-brand').tap();
      assert.equal(await p.evaluate(() => window.noReloadMarker), 123);
      assert(await p.locator('#title-screen').isHidden());
      await p.locator('#game-menu-toggle').tap();
      await p.locator('[data-menu-action=title]').tap();
      assert(await p.locator('#title-screen').isVisible());
      await p.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      await p.evaluate(() => {
        showTab('party');
        renderDex();
        PokekoroDex.open(133);
      });
      assert(await p.locator('#device-strength').isVisible());
      assert.match(await p.locator('#device-strength').innerText(), /こうげき/);
      await p.locator('#device-party').tap();
      assert(await p.locator('#pokedex-device').isHidden());
      assert(await p.locator('#party-add-choice').isVisible());
      assert.equal(await p.locator('#cards .pokemon-strength').count(), 6);
      await p.screenshot({ path: `/workspace/party-replace-${viewport.width}.png` });
      await p.locator('[data-party-slot="4"]').scrollIntoViewIfNeeded();
      assert(
        await p.locator('[data-party-slot="4"]').evaluate((n) => {
          const r = n.getBoundingClientRect();
          return (
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          );
        }),
        'replacement slot must be visible',
      );
      await p.locator('#party-add-choice button').tap();
      assert.deepEqual(await p.evaluate(() => state.party), [1, 4, 7, 25, 32, 446]);
      await p.evaluate(() => choosePartyReplacement(133));
      await p.locator('[data-party-slot="4"]').tap();
      assert.deepEqual(await p.evaluate(() => state.party), [1, 4, 7, 25, 133, 446]);
      assert(await p.evaluate(() => state.owned.includes(32) && state.owned.includes(133)));
      assert.deepEqual(
        await p.evaluate(() => JSON.parse(localStorage.getItem('pokekoro-v1')).party),
        [1, 4, 7, 25, 133, 446],
      );
      await p.evaluate(() => {
        PokekoroDex.open(1025);
      });
      assert(await p.locator('#device-strength').isHidden());
      await p.locator('#device-close').tap();
      if (!process.env.PUBLIC_URL) {
        let release;
        const gate = new Promise((resolve) => (release = resolve));
        await p.route('**/assets/map/pewter-city.webp', async (r) => {
          await gate;
          await r.continue();
        });
        await p.evaluate(() => {
          showTab('map');
          state.mapId = 'pewter-city';
          state.pos = 0;
          render();
          render();
        });
        assert(await p.locator('#roll').isDisabled());
        assert.equal(await p.locator('#route').evaluate((n) => getComputedStyle(n).opacity), '0');
        release();
        await p.waitForFunction(() => !mapArtLoading);
        assert(await p.locator('#roll').isEnabled());
        assert.equal(await p.locator('#route .tile').count(), 15);
        await p.evaluate(() => render());
        assert(
          !(await p.locator('#route').evaluate((n) => n.classList.contains('map-art-pending'))),
        );
        await p.route('**/assets/map/cerulean-city-v2.webp', (r) => r.abort());
        await p.evaluate(() => {
          state.mapId = 'cerulean-city';
          render();
        });
        await p.waitForFunction(() => !mapArtLoading);
        assert(await p.locator('#roll').isEnabled());
        assert.match(await p.locator('#message').innerText(), /よみこめません/);
        await p.evaluate(() => {
          state.mapId = 'viridian';
          render();
        });
        assert(
          !(await p.locator('.map-scene').evaluate((n) => n.classList.contains('map-loading'))),
        );
      }
      await p.evaluate(() => {
        state.party = [1, 4, 7];
        state.owned = [...state.owned, 1, 4, 7];
        openBattle(false, false);
        $('#encounter').close();
        $('#battle').showModal();
        fitBattle();
      });
      assert(await p.locator('#board').evaluate((n) => getComputedStyle(n).touchAction === 'none'));
      assert(
        await p
          .locator('#board')
          .evaluate((n) => n.getBoundingClientRect().bottom <= innerHeight - 28),
        'board away from bottom edge',
      );
      await p.screenshot({ path: `/workspace/battle-bottom-safe-${viewport.width}.png` });
      assert.deepEqual(errors, []);
      console.log(
        'PASS header/menu, visible strength, full-party choose/cancel/save, decode-gated map/retry, bottom margin',
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
