// 任意のUI検証。別保存のブラウザコンテキストで実際のマウス・タッチ操作を行う。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const rules = require('../opening-rules.js');
const server = spawn('python', ['-m', 'http.server', '8810', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox'],
      headless: true,
    });
    async function setup(viewport, step, version = 3) {
      const context = await browser.newContext({
        viewport,
        reducedMotion: 'reduce',
        hasTouch: viewport.width < 900,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
      const seed = {
        ...rules.fresh(),
        party: [446],
        owned: [446],
        playerName: 'サトシ',
        opening: {
          version,
          stage: 'practice',
          starterId: 4,
          ...(step ? { practiceStep: step } : {}),
        },
      };
      await page.addInitScript((s) => {
        if (!localStorage.getItem('seeded')) {
          localStorage.setItem('seeded', '1');
          localStorage.setItem('pokekoro-v1', JSON.stringify(s));
        }
      }, seed);
      await page.goto('http://127.0.0.1:8810');
      await page.waitForFunction(() => document.querySelector('#boot-screen').hidden);
      await page.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      await page.click('#opening-next');
      return { page, context, errors };
    }
    async function wait(page, step) {
      await page.waitForFunction((s) => state.opening.practiceStep === s, step, { timeout: 12000 });
    }
    async function stage(page) {
      return page.evaluate(() => state.opening.stage);
    }
    async function trace(page, touch, n = 3) {
      await page.locator('#practice-board').scrollIntoViewIfNeeded();
      const b = await page.locator('#practice-board').boundingBox();
      const pts = Array.from({ length: n }, (_, i) => ({
        x: b.x + ((i + 0.5) * b.width) / 6,
        y: b.y + (2.5 * b.height) / 5,
      }));
      if (touch) {
        const client = await page.context().newCDPSession(page);
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [pts[0]],
        });
        for (const pt of pts.slice(1))
          await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach();
      } else {
        await page.mouse.move(pts[0].x, pts[0].y);
        await page.mouse.down();
        for (const pt of pts.slice(1)) await page.mouse.move(pt.x, pt.y);
        await page.mouse.up();
      }
    }
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 664 },
    ]) {
      const touch = viewport.width < 900;
      const { page: p, context, errors } = await setup(viewport);
      const press = async (sel) => (touch ? p.locator(sel).tap() : p.click(sel));
      await wait(p, 'trace');
      await trace(p, touch, 2);
      assert.equal(await p.evaluate(() => state.opening.practiceStep), 'trace');
      await trace(p, touch);
      await wait(p, 'round');
      await press('#practice-start');
      assert.ok(Number(await p.locator('#practice-clock').innerText()) > 9);
      await trace(p, touch);
      await wait(p, 'charge');
      for (let i = 0; i < 3; i++) await trace(p, touch);
      await wait(p, 'skillOpen');
      assert.match(await p.locator('[data-practice-member="32"]').innerText(), /8\/8/);
      await press('[data-practice-member="32"]');
      await wait(p, 'skillUse');
      await press('#practice-use');
      await wait(p, 'neutral');
      await trace(p, touch);
      assert.match(await p.locator('#practice-result').innerText(), /11/);
      await wait(p, 'advantage');
      await trace(p, touch);
      assert.match(await p.locator('#practice-result').innerText(), /22/);
      await wait(p, 'counter');
      await press('#practice-start');
      await wait(p, 'faintOpen');
      assert.match(await p.locator('[data-practice-member="32"]').innerText(), /ひんし/);
      await press('[data-practice-member="32"]');
      await wait(p, 'faintTry');
      await press('#practice-use');
      assert.match(await p.locator('#practice-skill p').innerText(), /おやすみ/);
      await wait(p, 'gray');
      await trace(p, touch);
      assert.match(await p.locator('#practice-power').innerText(), /0 → 0/);
      await wait(p, 'live');
      await p.screenshot({ path: `/tmp/practice-live-${viewport.width}.png` });
      await trace(p, touch);
      await p.waitForFunction(() => state.opening.stage === 'throw');
      await p.click('#opening-next');
      await p.waitForFunction(() => state.opening.stage === 'caught');
      for (const s of ['caught', 'return', 'dex', 'register', 'depart']) {
        assert.equal(await stage(p), s);
        await p.click('#opening-next');
      }
      assert.equal(await stage(p), 'partyLesson');
      await press('#cards [data-party-slot="0"]');
      await p.waitForFunction(() => document.querySelector('#pokedex-device').open);
      await press('[data-dex-id="4"]');
      await p.waitForFunction(() => state.opening.stage === 'diceLesson');
      assert.deepEqual(await p.evaluate(() => state.party), [4, 446, 25]);
      if (touch) {
        await p.locator('#roll').tap();
      } else {
        await p.click('#roll');
      }
      await p.waitForFunction(() => state.opening.stage === 'complete', {}, { timeout: 12000 });
      assert.ok(await p.evaluate(() => state.pos > 0));
      assert.deepEqual(await p.evaluate(() => state.owned), [446, 4, 25]);
      assert.equal(await p.evaluate(() => state.balls), 8);
      assert.equal(await p.evaluate(() => state.super), 2);
      assert.deepEqual(errors, []);
      console.log('FULL PASS', viewport);
      await context.close();
    }
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      const { page, context, errors } = await setup(viewport, 'gray');
      await page.screenshot({ path: `/tmp/practice-gray-${viewport.width}.png` });
      assert.equal(
        await page.locator('#practice').evaluate((d) => d.scrollWidth > d.clientWidth + 1),
        false,
      );
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#boot-screen').hidden);
      await page.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      await page.click('#opening-next');
      await wait(page, 'gray');
      assert.match(await page.locator('[data-practice-member="32"]').innerText(), /ひんし/);
      await trace(page, true);
      await wait(page, 'live');
      assert.deepEqual(errors, []);
      console.log('RESUME/LAYOUT PASS', viewport);
      await context.close();
    }
    const old = await setup({ width: 390, height: 664 }, null, 2);
    assert.equal(await old.page.locator('#practice').isVisible(), false);
    assert.equal(await old.page.locator('#encounter').isVisible(), true);
    assert.deepEqual(old.errors, []);
    await old.context.close();
    console.log('LEGACY v2 practice unchanged PASS');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
