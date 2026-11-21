'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8886', '--bind', '127.0.0.1'], {
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
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8886');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7];
        state.mapId = 'cerulean-city';
        state.pos = 6;
        state.lap = 2;
        state.tour = 3;
        state.pendingMapId = 'cerulean-gym';
        state.clearedMaps = [...MAP_ORDER];
        state.mapReturn = null;
        state.revisitClearMapId = null;
        document.dispatchEvent(new CustomEvent('title:start'));
        revisitMap('pewter-gym');
        state.pos = 14;
        openBattle(true, true);
        $('#encounter').close();
        battle.roundStarted = true;
        battle.series.index = battle.series.team.length - 1;
        battle.hp = 0;
        battle.victory = true;
        endBattle(true);
        done();
      });
      const origin = await p.evaluate(() => JSON.stringify(state.mapReturn));
      const inventory = await p.evaluate(() =>
        JSON.stringify([state.balls, state.super, state.master]),
      );
      assert.equal(await p.evaluate(() => state.pos), 14);
      for (const id of ['revisit-next', 'revisit-origin'])
        assert(
          await p.locator('#' + id).evaluate((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.top >= 0 &&
              r.bottom <= innerHeight &&
              n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
            );
          }),
          id + ' visible and touchable',
        );
      await p.screenshot({ path: `/workspace/revisit-complete-${viewport.width}.png` });
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      assert(await p.locator('#revisit-next').isVisible());
      assert.equal(
        await p.evaluate(() => JSON.stringify([state.balls, state.super, state.master])),
        inventory,
      );
      await p.locator('#revisit-next').tap();
      assert.deepEqual(await p.evaluate(() => [state.mapId, state.pos, state.tour]), [
        'mt-moon',
        0,
        3,
      ]);
      assert.equal(await p.evaluate(() => JSON.stringify(state.mapReturn)), origin);
      await p.evaluate(() => returnToAdventure());
      assert.deepEqual(
        await p.evaluate(() => [
          state.mapId,
          state.pos,
          state.lap,
          state.pendingMapId,
          state.mapReturn,
        ]),
        ['cerulean-city', 6, 2, 'cerulean-gym', null],
      );
      await p.evaluate(() => {
        revisitMap('cerulean-cave');
        state.pos = 14;
        openBattle(false, true);
        $('#encounter').close();
        battle.hp = 0;
        battle.victory = true;
        endBattle(true);
      });
      assert(await p.locator('#skip').isVisible());
      await p.locator('#skip').tap();
      await p.locator('#revisit-next').tap();
      assert.deepEqual(await p.evaluate(() => [state.mapId, state.pos, state.tour]), [
        'viridian',
        0,
        3,
      ]);
      await p.evaluate(() => {
        returnToAdventure();
        revisitMap('safari-zone');
        state.pos = 14;
        openBattle(false, true);
        $('#encounter').close();
        endSafari(false);
        done();
      });
      assert.equal(await p.evaluate(() => state.pos), 14);
      assert.equal(await p.locator('#revisit-next').count(), 0);
      await p.evaluate(() => {
        openBattle(false, true);
        $('#encounter').close();
        battle.damage = battle.total;
        endSafari(true);
      });
      await p.evaluate(() => {
        state.owned.push(battle.m.id);
        render();
        showCaptureOutcome(battle.m, true, false);
      });
      await p.locator('#capture-view').tap();
      assert(await p.locator('#pokedex-device').isVisible());
      assert(await p.evaluate(() => revisitClearReady()));
      await p.locator('#device-close').tap();
      await p.evaluate(() => showTab('map'));
      await p.waitForFunction(() => !mapArtLoading);
      await p.locator('#roll').tap();
      assert(await p.locator('#revisit-next').isVisible());
      await p.locator('#revisit-origin').tap();
      assert.deepEqual(
        await p.evaluate(() => [
          state.mapId,
          state.pos,
          state.lap,
          state.pendingMapId,
          state.mapReturn,
        ]),
        ['cerulean-city', 6, 2, 'cerulean-gym', null],
      );
      assert.deepEqual(errors, []);
      console.log(
        'PASS choice/touch, reload without duplicate rewards, next/bookmark, original pending progress, revisit wrap no tour, Safari abort/completion',
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
