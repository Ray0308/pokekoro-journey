'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8888', '--bind', '127.0.0.1'], {
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
        reducedMotion: viewport.width === 390 ? 'no-preference' : 'reduce',
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8888');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.playerName = 'レッド';
        state.party = [1, 4, 7, 25, 32, 446];
        state.owned = [...state.party];
        state.hallOfFame = HallOfFameRules.normalize(null);
        state.mapId = 'indigo-champion';
        state.pos = 14;
        document.dispatchEvent(new CustomEvent('title:start'));
        openBattle(true, true);
        $('#encounter').close();
        battle.roundStarted = true;
      });
      await p.evaluate(() => {
        battle.hp = 0;
        battle.victory = true;
        endBattle(true);
      });
      assert.equal(
        await p.evaluate(() => state.hallOfFame.count),
        0,
        'intermediate enemy does not count',
      );
      await p.evaluate(() => {
        $('#encounter').close();
        battle.roundStarted = true;
        battle.series.index = battle.series.team.length - 1;
        battle.hp = 0;
        battle.victory = true;
        endBattle(true);
        endBattle(true);
      });
      assert.equal(await p.evaluate(() => state.hallOfFame.count), 1);
      const stock = await p.evaluate(() =>
        JSON.stringify([state.balls, state.super, state.master]),
      );
      assert.match(await p.locator('#done').innerText(), /殿堂入り/);
      await p.locator('#done').tap();
      assert.equal(await p.locator('#hall-of-fame').getAttribute('data-stage'), 'ceremony');
      await p.waitForFunction(() => !PokekoroMapAudio.inspect().playing);
      assert.equal(await p.locator('#hall-of-fame .hall-team img').count(), 6);
      assert.match(await p.locator('#hall-of-fame').innerText(), /レッド/);
      await p
        .locator('#hall-of-fame .hall-team img')
        .evaluateAll((ns) => Promise.all(ns.map((n) => n.decode())));
      if (viewport.width === 390) await p.waitForTimeout(1000);
      assert.equal(
        await p
          .locator('#hall-of-fame .hall-team img')
          .evaluateAll((ns) => ns.every((n) => n.complete && n.naturalWidth > 0)),
        true,
      );
      await p.screenshot({ path: `/workspace/hall-ceremony-${viewport.width}.png` });
      const hit = async () =>
        assert(
          await p.locator('#hall-next').evaluate((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.top >= 0 &&
              r.bottom <= innerHeight &&
              n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
            );
          }),
          'next button visible and touchable',
        );
      await hit();
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      assert.equal(await p.evaluate(() => state.hallOfFame.count), 1);
      assert.equal(
        await p.evaluate(() => JSON.stringify([state.balls, state.super, state.master])),
        stock,
      );
      await p.locator('#hall-next').tap();
      assert.equal(await p.locator('#hall-of-fame').getAttribute('data-stage'), 'oak-celebrate');
      await hit();
      await p.screenshot({ path: `/workspace/hall-oak-${viewport.width}.png` });
      await p.locator('#hall-next').tap();
      assert.equal(await p.locator('#hall-of-fame').getAttribute('data-stage'), 'oak-request');
      assert.match(await p.locator('#hall-of-fame').innerText(), /ちょうさ/);
      await hit();
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      assert.equal(await p.locator('#hall-of-fame').getAttribute('data-stage'), 'oak-request');
      await p.locator('#hall-next').tap();
      assert(await p.locator('#hall-of-fame').isHidden());
      assert.equal(await p.evaluate(() => state.mapId), 'cerulean-cave');
      assert.equal(await p.evaluate(() => state.hallOfFame.researchIntroduced), true);
      await p.waitForFunction(() => !mapArtLoading);
      await p.evaluate(() => {
        state.playerName = 'グリーン';
        state.party = [2, 5, 8];
        showTab('journey');
        renderJourney();
      });
      await p.locator('[data-hall-history]').tap();
      assert.match(await p.locator('#hall-of-fame').innerText(), /レッド/);
      assert.equal(await p.locator('#hall-of-fame .hall-team img').count(), 6);
      await p.locator('#hall-next').tap();
      await p.evaluate(() => {
        showTab('map');
        state.mapReturn = { mapId: 'cerulean-cave', pos: 6, lap: 1, pendingMapId: null };
        state.mapId = 'indigo-champion';
        state.pos = 14;
        busy = false;
        openBattle(true, true);
        $('#encounter').close();
        battle.roundStarted = true;
        battle.series.index = battle.series.team.length - 1;
        battle.hp = 0;
        battle.victory = true;
        endBattle(true);
        done();
      });
      assert.equal(await p.evaluate(() => state.hallOfFame.count), 2);
      for (let i = 0; i < 3; i++) await p.locator('#hall-next').tap();
      assert(await p.locator('#revisit-origin').isVisible());
      await p.locator('#revisit-origin').tap();
      assert.deepEqual(await p.evaluate(() => [state.mapId, state.pos]), ['cerulean-cave', 6]);
      assert.deepEqual(errors, []);
      console.log(
        'PASS champion only/once, ceremony+Oak, 6 snapshots, touch/restore/no duplicate rewards, history, repeat and revisit',
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
