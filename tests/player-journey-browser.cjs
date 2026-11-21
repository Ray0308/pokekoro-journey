// 任意のブラウザ検証。実タイトル・名前・御三家・再開、全30マップ、メニュー。
require('node:fs').mkdirSync('/tmp/audit76', { recursive: true });
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('child_process');
const assert = require('node:assert/strict');
const server = spawn('python', ['-m', 'http.server', '8832', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto('http://127.0.0.1:8832');
    await p.waitForFunction(() => $('#boot-screen').hidden);
    await p.locator('#title-tap-prompt').click();
    await p.locator('#enter-game').click();
    assert.equal(await p.evaluate(() => state.opening.stage), 'oakGreeting');
    for (let i = 0; i < 20 && (await p.evaluate(() => state.opening.stage)) !== 'nameChoice'; i++)
      await p.locator('#opening-next').click();
    await p.locator('[data-name-choice="0"]').click();
    await p.locator('#opening-name-done').click();
    assert(await p.locator('#opening-name-error').isVisible());
    for (const char of ['テ', 'ス', 'ト']) await p.locator(`[data-name-char="${char}"]`).click();
    await p.locator('#opening-name-done').click();
    await p.locator('#opening-name-no').click();
    for (let i = 0; i < 3; i++) await p.locator('#opening-name-delete').click();
    await p.locator('[data-name-mode="hiragana"]').click();
    for (const char of ['あ', 'お', 'い']) await p.locator(`[data-name-char="${char}"]`).click();
    await p.locator('#opening-name-done').click();
    await p.locator('#opening-name-yes').click();
    assert.equal(await p.evaluate(() => state.playerName), 'あおい');
    assert.deepEqual(await p.evaluate(() => state.party), []);
    for (let i = 0; i < 12 && (await p.evaluate(() => state.opening.stage)) !== 'choose'; i++) {
      if (await p.locator('#opening-invite').count()) await p.locator('#opening-invite').click();
      else await p.locator('#opening-next').click();
    }
    assert.deepEqual(await p.evaluate(() => state.party), [446]);
    await p.locator('[data-starter="4"]').click();
    await p.locator('#opening-confirm').click();
    await p.screenshot({ path: '/tmp/audit76/start-chosen.png' });
    await p.reload();
    await p.waitForFunction(() => $('#boot-screen').hidden);
    assert.equal(await p.evaluate(() => state.playerName), 'あおい');
    assert.equal(await p.evaluate(() => state.opening.starterId), 4);
    console.log('PASS real title, laboratory/name panel/redo, invitation, starter and reload');
    await p.evaluate(() => {
      state.opening.stage = 'complete';
      state.party = [1, 4, 7];
      state.owned = [1, 4, 7];
      document.dispatchEvent(new CustomEvent('title:start'));
    });
    const report = await p.evaluate(() => {
      const out = [];
      for (const id of MAP_ORDER) {
        state.mapId = id;
        state.pos = 0;
        render();
        const nodes = mapRoutePoints();
        out.push({
          id,
          nodes: nodes.length,
          events: currentSquares().length,
          finite: nodes.every(
            (p) => p.length === 2 && p.every((v) => Number.isFinite(v) && v >= 0 && v <= 100),
          ),
        });
      }
      return out;
    });
    assert(report.every((x) => x.nodes === 15 && x.events === 15 && x.finite));
    console.log(
      'PASS all',
      report.length,
      'main maps: 15 positions/events, finite coordinates, render',
    );
    for (const action of ['dex', 'party', 'bag', 'badges', 'settings']) {
      await p.locator('#game-menu-toggle').click();
      await p.locator(`[data-menu-action="${action}"]`).click();
      await p.evaluate(() => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
      });
    }
    assert.deepEqual(errors, []);
    console.log('PASS menu dex/party/bag/badges/settings, no JS errors');
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
