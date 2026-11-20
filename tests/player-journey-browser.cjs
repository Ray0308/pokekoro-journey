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
    assert.equal(await p.evaluate(() => state.opening.stage), 'meet');
    for (let i = 0; i < 20 && (await p.evaluate(() => state.opening.stage)) !== 'nameInput'; i++)
      await p.locator('#opening-next').click();
    assert.equal(await p.evaluate(() => state.opening.stage), 'nameInput');
    await p.locator('#opening-name').fill('  ');
    await p.locator('#opening-name-form button').click();
    assert(await p.locator('#opening-name-error').isVisible());
    await p.locator('#opening-name').fill('テスト');
    await p.locator('#opening-name-form button').click();
    await p.locator('#opening-name-no').click();
    await p.locator('#opening-name').fill('あおい');
    await p.locator('#opening-name-form button').click();
    await p.locator('#opening-name-yes').click();
    assert.equal(await p.evaluate(() => state.playerName), 'あおい');
    for (let i = 0; i < 10 && (await p.evaluate(() => state.opening.stage)) !== 'choose'; i++)
      await p.locator('#opening-next').click();
    await p.locator('[data-starter="4"]').click();
    await p.locator('#opening-confirm').click();
    await p.screenshot({ path: '/tmp/audit76/start-chosen.png' });
    await p.reload();
    await p.waitForFunction(() => $('#boot-screen').hidden);
    assert.equal(await p.evaluate(() => state.playerName), 'あおい');
    assert.equal(await p.evaluate(() => state.opening.starterId), 4);
    console.log('PASS real title, meet, Oak/name validation/redo, starter and reload');
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
