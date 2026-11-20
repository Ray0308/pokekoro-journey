// Optional Chromium integration: retry assistance, persistent revisits and Safari interruption.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
fs.mkdirSync('/tmp/retry78', { recursive: true });
const server = spawn('python', ['-m', 'http.server', '8838', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    for (const [width, height] of [
      [390, 664],
      [320, 568],
      [844, 390],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8838');
      await page.waitForFunction(() => $('#boot-screen').hidden);
      await page.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7];
        state.mapId = 'pewter-gym';
        state.pos = 14;
        state.bossLosses = {};
        state.pendingMapId = null;
        state.mapReturn = null;
        document.dispatchEvent(new CustomEvent('title:start'));
        render();
      });
      const open = async () =>
        page.evaluate(() => {
          openBattle(true, true);
          $('#encounter').close();
          $('#battle').showModal();
          battle.roundStarted = true;
          return {
            hp: battle.total,
            normal: PokemonBattleStats.enemyHP(battle.m, battle.series.team[0].hp),
          };
        });
      let hp = await open();
      assert.equal(hp.hp, hp.normal);
      for (let i = 1; i <= 3; i++) {
        await page.evaluate(() => {
          battle.lossReason = 'なかまが みんな ひんしに なった！';
          endBattle(false);
          endBattle(false);
        });
        assert.equal(await page.evaluate(() => state.bossLosses[bossLossKey()]), Math.min(i, 2));
        assert.equal(await page.locator('.retry-experience').count(), i >= 2 ? 1 : 0);
        await page.locator('#result').screenshot({ path: `/tmp/retry78/loss-${width}-${i}.png` });
        assert(await page.locator('#result').evaluate((d) => d.scrollWidth <= d.clientWidth + 1));
        await page.locator(i === 1 ? '#retry-start' : '#retry-boss').tap();
        assert.equal(await page.evaluate(() => state.pos), i === 1 ? 0 : 13);
        hp = await open();
        assert.equal(hp.hp, i >= 2 ? Math.max(1, Math.round(hp.normal * 0.9)) : hp.normal);
      }
      await page.evaluate(() => {
        $('#encounter').close();
        busy = false;
        battle = null;
        save();
      });
      await page.reload();
      await page.waitForFunction(() => $('#boot-screen').hidden);
      assert.equal(await page.evaluate(() => bossAssistActive()), true);
      await page.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      await open();
      await page.evaluate(() => {
        battle.series.index = battle.series.team.length - 1;
        battle.victory = true;
        battle.hp = 0;
        endBattle(true);
      });
      assert.equal(await page.evaluate(() => bossAssistActive()), false);
      await page.evaluate(() => {
        $('#result').close();
        busy = false;
        battle = null;
        state.mapId = 'cerulean-city';
        state.pos = 7;
        state.lap = 2;
        state.pendingMapId = null;
        state.clearedMaps = ['viridian', 'pewter-gym', 'safari-zone'];
        render();
        showTab('journey');
      });
      await page.locator('[data-revisit="viridian"]').tap();
      assert.deepEqual(
        await page.evaluate(() => [
          state.mapId,
          state.pos,
          state.mapReturn.mapId,
          state.mapReturn.pos,
        ]),
        ['viridian', 0, 'cerulean-city', 7],
      );
      await page.reload();
      await page.waitForFunction(() => $('#boot-screen').hidden);
      await page.evaluate(() => {
        document.dispatchEvent(new CustomEvent('title:start'));
        showTab('journey');
      });
      await page.locator('#return-adventure').tap();
      assert.deepEqual(
        await page.evaluate(() => [state.mapId, state.pos, state.lap, state.mapReturn]),
        ['cerulean-city', 7, 2, null],
      );
      await page.evaluate(() => {
        state.pendingMapId = 'cerulean-gym';
        state.clearedMaps.push('cerulean-city');
        render();
        showTab('journey');
      });
      await page.locator('[data-revisit="pewter-gym"]').tap();
      await open();
      await page.evaluate(() => {
        battle.series.index = battle.series.team.length - 1;
        battle.victory = true;
        battle.hp = 0;
        endBattle(true);
        done();
      });
      assert.equal(await page.evaluate(() => state.pendingMapId), null);
      assert.equal(await page.evaluate(() => state.pos), 0);
      await page.evaluate(() => {
        showTab('journey');
      });
      await page.locator('#return-adventure').tap();
      assert.equal(await page.evaluate(() => state.pendingMapId), 'cerulean-gym');
      await page.evaluate(() => {
        state.pendingMapId = null;
        state.mapId = 'safari-zone';
        state.clearedMaps = [];
        openBattle(false, true);
        $('#encounter').close();
        endBattle(false);
      });
      assert.equal(await page.evaluate(() => state.clearedMaps.includes('safari-zone')), false);
      assert.equal(await page.evaluate(() => state.pendingMapId), null);
      await page.evaluate(() => {
        done();
        openBattle(false, true);
        $('#encounter').close();
        battle.damage = battle.total;
        endBattle(true);
      });
      assert.equal(await page.evaluate(() => battle.safari && battleDuration() === 30), true);
      assert.equal(
        await page.evaluate(() => state.pendingMapId),
        await page.evaluate(() => MAPS['safari-zone'].nextMap),
      );
      await page.evaluate(() => {
        done();
        state.pendingMapId = null;
        state.mapId = 'viridian';
        state.pos = 6;
        state.balls = 20;
        state.kurtHouses[kurtVisitKey(state)] = true;
        render();
        PokekoroKurt.open();
      });
      await page.locator('#kurt-quantity').fill('2');
      const before = await page.evaluate(() => state.typeBalls[partyTypes(state.party)[0]]);
      await page.locator('#kurt-trade').tap();
      assert.equal(await page.evaluate(() => state.balls), 10);
      assert.equal(
        await page.evaluate(() => state.typeBalls[partyTypes(state.party)[0]]),
        before + 2,
      );
      assert.match(await page.locator('#kurt-status').textContent(), /できあがり！/);
      await page.locator('#kurt-status').scrollIntoViewIfNeeded();
      await page.locator('#kurt-house').screenshot({ path: `/tmp/retry78/kurt-${width}.png` });
      assert(await page.locator('#kurt-house').evaluate((d) => d.scrollWidth <= d.clientWidth + 1));
      await page.locator('#kurt-close').tap();
      assert.deepEqual(errors, []);
      await page.close();
      console.log(
        'PASS',
        width,
        height,
        'retry threshold/cap, HP, persistence, victory reset, touch travel/resume, Safari progression',
      );
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
