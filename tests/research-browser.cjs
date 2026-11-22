'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8890', '--bind', '127.0.0.1'], {
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
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8890');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7, 25, 32, 446];
        state.owned = [...state.party];
        state.clearedMaps = [...MAP_ORDER];
        state.mapId = 'viridian';
        state.pos = 0;
        state.mapReturn = null;
        state.pendingMapId = null;
        state.revisitClearMapId = null;
        state.hallOfFame = HallOfFameRules.normalize(null);
        document.dispatchEvent(new CustomEvent('title:start'));
        render();
      });
      assert.equal(await p.evaluate(() => currentSquares().includes('mission')), false);
      assert(await p.locator('#research-hud').isHidden());
      await p.evaluate(() => {
        state.hallOfFame = {
          count: 1,
          records: [{ id: 1, name: 'レッド', team: [1, 4, 7], date: '2026-11-21' }],
          pending: null,
          researchIntroduced: true,
        };
        state.research = ResearchRules.normalize(null);
        const slot = ResearchRules.slot(MAPS.viridian.squares);
        state.pos = slot - 1;
        window.PokekoroDebug = { ...PokekoroDebug, diceValue: () => 1 };
        render();
      });
      await p.waitForFunction(() => !mapArtLoading);
      assert.equal(await p.locator('.node-mission').count(), 1);
      assert.equal(await p.locator('#route .tile').count(), 15);
      await p.locator('#roll').tap();
      await p.waitForSelector('#research-accept');
      const offer = await p.evaluate(() => JSON.stringify(state.research.offer));
      assert.equal(await p.evaluate(() => state.research.active), null);
      await p.locator('#research-close').tap();
      await p.locator('#research-hud').tap();
      assert.equal(await p.evaluate(() => JSON.stringify(state.research.offer)), offer);
      await p.locator('#research-close').tap();
      const origin = await p.evaluate(() => {
        state.research.offer = { id: 1, mapId: 'pewter-gym', pos: 4, pokemonId: 150 };
        state.research.nextId = 2;
        PokekoroResearch.open();
        return JSON.stringify({
          mapId: state.mapId,
          pos: state.pos,
          lap: state.lap,
          pendingMapId: state.pendingMapId,
        });
      });
      await p.screenshot({ path: `/workspace/research-offer-${viewport.width}.png` });
      await p.locator('#research-accept').tap();
      assert.equal(await p.evaluate(() => state.research.active.left), 5);
      assert.equal(await p.evaluate(() => state.research.active.phase), 'active');
      assert(
        await p.locator('#research-travel').evaluate((n) => {
          const r = n.getBoundingClientRect();
          return (
            r.bottom <= innerHeight &&
            n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          );
        }),
      );
      await p.locator('#research-travel').tap();
      await p.waitForFunction(() => !mapArtLoading);
      assert.deepEqual(await p.evaluate(() => [state.mapId, state.pos]), ['pewter-gym', 0]);
      assert.equal(await p.evaluate(() => JSON.stringify(state.mapReturn)), origin);
      assert.equal(await p.locator('.research-target').count(), 1);
      await p.evaluate(() => {
        window.PokekoroDebug = { ...PokekoroDebug, diceValue: () => 4 };
      });
      await p.locator('#roll').tap();
      await p.waitForFunction(() => state.research.active?.pending?.raw === 4);
      assert.equal(await p.locator('[data-research-die]').count(), 0);
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      await p.locator('#research-resume').tap();
      await p.waitForFunction(() => battle?.researchMissionId === 1);
      assert.deepEqual(
        await p.evaluate(() => [
          battle.m.id,
          battle.trainer,
          battle.boss,
          state.pos,
          state.research.active.left,
          state.research.active.adjusted,
        ]),
        [150, false, false, 4, 4, false],
      );
      assert.equal(await p.evaluate(() => state.hallOfFame.count), 1);
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      await p.locator('#research-resume').tap();
      await p.waitForFunction(() => battle?.researchMissionId === 1);
      assert.equal(await p.evaluate(() => battle.m.id), 150);
      await p.evaluate(() => {
        $('#encounter').close();
        battle.hp = 0;
        battle.victory = true;
        endBattle(true);
      });
      assert.equal(await p.evaluate(() => state.research.active.phase), 'capture');
      await p.locator('#skip').tap();
      assert.equal(await p.evaluate(() => state.research.active), null);
      assert.equal(await p.evaluate(() => state.research.completed), 1);
      assert(await p.locator('#research-hud').isHidden());
      assert.equal(await p.evaluate(() => JSON.stringify(state.mapReturn)), origin);
      await p.evaluate(() => {
        window.PokekoroDebug = { ...PokekoroDebug, diceValue: () => 1 };
        state.pos = 0;
        state.research.active = {
          id: 2,
          mapId: 'mt-moon',
          pos: 10,
          pokemonId: 3,
          left: 1,
          phase: 'active',
          adjusted: true,
          pending: null,
        };
        render();
      });
      await p.waitForFunction(() => !mapArtLoading);
      await p.locator('#roll').tap();
      await p.waitForFunction(() => state.research.last?.outcome === 'expired');
      assert.equal(await p.evaluate(() => state.research.active), null);
      assert.equal(await p.evaluate(() => state.research.completed), 1);
      assert(await p.locator('#research-hud').isHidden());
      assert.deepEqual(errors, []);
      console.log(
        'PASS unlock/tile offer, accept only, travel/bookmark, target mark, raw dice without adjustment, reload-stable deadline/die/encounter, rare capture flow and expiry',
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
