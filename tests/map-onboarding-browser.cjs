const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const server = spawn('python', ['-m', 'http.server', '8861', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const [version, viewport] of [
      [3, { width: 390, height: 844 }],
      [3, { width: 320, height: 568 }],
      [5, { width: 390, height: 664 }],
      [5, { width: 844, height: 390 }],
    ]) {
      const p = await b.newPage({
        viewport,
        hasTouch: true,
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.addInitScript((v) => {
        localStorage.setItem(
          'pokekoro-v1',
          JSON.stringify({
            owned: [446, 4, 25],
            party: [4, 446, 25],
            pos: 0,
            lap: 1,
            balls: 8,
            super: 2,
            mapId: 'viridian',
            playerName: 'レン',
            opening: { version: v, stage: 'diceLesson', starterId: 4, pokedexReceived: true },
          }),
        );
      }, version);
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8861');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        Math.random = () => 0;
        document.dispatchEvent(new CustomEvent('title:start'));
      });
      await p.waitForSelector('#practice-coach');
      assert.equal(await p.locator('#map > #practice-coach').count(), 0);
      assert.equal(await p.locator('#map > .layout > #practice-coach').count(), 1);
      assert.match(await p.locator('#practice-coach').innerText(), /出た目/);
      assert.match(await p.locator('#practice-coach').innerText(), /ボス/);
      async function check() {
        const g = await p.evaluate(() => {
          const r = $('#roll').getBoundingClientRect(),
            m = $('#map .mapcard').getBoundingClientRect(),
            c = $('#practice-coach').getBoundingClientRect();
          const x = r.left + r.width / 2,
            y = r.top + r.height / 2;
          return {
            hit: !!document.elementFromPoint(x, y)?.closest('#roll'),
            rollVisible:
              r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1,
            mapWidth: m.width,
            coachHeight: c.height,
            viewHeight: innerHeight,
          };
        });
        assert(g.hit, JSON.stringify(g));
        assert(g.rollVisible, JSON.stringify(g));
        assert(g.mapWidth > viewport.width * 0.6 || viewport.width > 600, JSON.stringify(g));
        assert(g.coachHeight < g.viewHeight * 0.38, JSON.stringify(g));
      }
      assert(await p.locator('#map-lesson-guide').isVisible());
      assert.equal(await p.locator('.map-lesson-icons img').count(), 6);
      await p.locator('#practice-map-understood').tap();
      await check();
      if (process.env.MAP_SCREENSHOTS)
        await p.screenshot({
          path: `/workspace/map-onboarding-${viewport.width}-${viewport.height}.png`,
        });
      assert.equal(await p.evaluate(() => state.balls), 8);
      assert.equal(await p.evaluate(() => state.super), 2);
      if (version === 5) {
        await p.locator('#practice-map-help').tap();
        assert.match(await p.locator('#map-lesson-guide').innerText(), /草むら.*[\s\S]*トレーナー/);
        await p.locator('#practice-map-understood').tap();
        assert.equal(await p.locator('#map-lesson-guide').isVisible(), false);
        await check();
      }
      // 絵付き説明を閉じ、矢印付きの実サイコロから着地まで進める。
      await p.locator('#roll').tap();
      await p.waitForFunction(() => state.opening.stage === 'complete' && state.pos > 0, null, {
        timeout: 15000,
      });
      await p.waitForFunction(() => !document.querySelector('#practice-coach'));
      assert.equal(await p.evaluate(() => state.opening.pokedexReceived), true);
      assert.deepEqual(await p.evaluate(() => state.party), [4, 446, 25]);
      assert.deepEqual(errors, []);
      console.log(
        'PASS saved diceLesson, bounded guide, dice hit-test, touch -> arrival/complete',
        version,
        viewport,
      );
      await p.close();
    }
    const p = await b.newPage({
      viewport: { width: 390, height: 664 },
      hasTouch: true,
      ignoreHTTPSErrors: true,
    });
    await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8861');
    await p.waitForFunction(() => $('#boot-screen').hidden);
    await p.evaluate(() => {
      state.opening = { version: 3, stage: 'partyLesson', starterId: 4, pokedexReceived: true };
      state.party = [446, 4, 25];
      state.owned = [446, 4, 25];
      document.dispatchEvent(new CustomEvent('title:start'));
    });
    await p.locator('#cards [data-party-slot="0"]').tap();
    await p.locator('[data-dex-id="4"]').tap();
    await p.waitForFunction(() => state.opening.stage === 'diceLesson');
    assert.match(await p.locator('#practice-coach').innerText(), /マップの説明/);
    assert.equal(await p.locator('#map > .layout > #practice-coach').count(), 1);
    console.log('PASS legacy partyLesson -> map instructions retained');
    if (await p.locator('#map-lesson-guide').isVisible())
      await p.locator('#practice-map-understood').tap();
    await p.locator('#roll').tap();
    await p.waitForFunction(() => state.opening.stage === 'complete', null, { timeout: 15000 });
    await p.close();
    const fresh = await b.newPage({
      viewport: { width: 390, height: 664 },
      hasTouch: true,
      ignoreHTTPSErrors: true,
    });
    await fresh.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8861');
    await fresh.waitForFunction(() => $('#boot-screen').hidden);
    await fresh.evaluate(() => {
      Math.random = () => 0;
      state.opening = { version: 5, stage: 'depart', starterId: 4 };
      state.owned = [446];
      state.party = [446];
      document.dispatchEvent(new CustomEvent('title:start'));
    });
    await fresh.locator('#opening-next').tap();
    assert.equal(await fresh.evaluate(() => state.opening.stage), 'diceLesson');
    assert.equal(await fresh.evaluate(() => state.balls), 8);
    await fresh.locator('#practice-map-understood').tap();
    await fresh.locator('#roll').tap();
    await fresh.waitForFunction(() => state.opening.stage === 'complete' && state.pos > 0, null, {
      timeout: 15000,
    });
    assert.equal(await fresh.evaluate(() => state.opening.pokedexReceived), true);
    console.log('PASS fresh departure -> actual dice -> first map event');
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  server.kill();
});
