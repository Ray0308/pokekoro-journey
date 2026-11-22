'use strict';
const assert = require('node:assert/strict'),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8899', '--bind', '127.0.0.1'], {
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
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8899');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7, 6];
        state.seen = [1, 4, 7, 6, 25];
        document.dispatchEvent(new CustomEvent('title:start'));
        PokekoroDex.open();
      });
      for (const mode of ['owned', 'missing', 'all']) {
        const b = p.locator(`[data-dex-ownership="${mode}"]`);
        assert(
          await b.evaluate((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.top >= 0 &&
              r.bottom <= innerHeight &&
              r.height >= 44 &&
              n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
            );
          }),
        );
        await b.tap();
        assert.equal(await b.getAttribute('aria-pressed'), 'true');
        const rows = await p
          .locator('#device-list-rows [data-dex-id]')
          .evaluateAll((ns) => ns.map((n) => Number(n.dataset.dexId)));
        if (mode === 'owned') assert.deepEqual(rows, [1, 4, 6, 7]);
        if (mode === 'missing') {
          assert(rows.every((n) => ![1, 4, 6, 7].includes(n)));
          assert.match(await p.locator('#device-filter-summary').innerText(), /未取得/);
          assert(
            !(await p
              .locator('#device-list-rows')
              .innerText()
              .then((t) => t.includes('フシギソウ'))),
          );
        }
        await p.screenshot({ path: `/workspace/dex-${mode}-${viewport.width}.png` });
      }
      await p.locator('[data-dex-ownership="owned"]').tap();
      await p.locator('#device-type-filter').tap();
      await p.locator('[data-filter-type="1"]').tap();
      await p.locator('#device-filter-apply').tap();
      assert.deepEqual(
        await p
          .locator('#device-list-rows [data-dex-id]')
          .evaluateAll((ns) => ns.map((n) => Number(n.dataset.dexId))),
        [4, 6],
      );
      await p.locator('#device-filter-reset').tap();
      assert.equal(
        await p.locator('[data-dex-ownership="all"]').getAttribute('aria-pressed'),
        'true',
      );
      await p.locator('[data-dex-ownership="missing"]').tap();
      await p.locator('#device-close').tap();
      await p.evaluate(() => PokekoroDex.openPicker(0));
      assert(await p.locator('#device-ownership').isHidden());
      assert.deepEqual(
        await p
          .locator('#device-list-rows [data-dex-id]')
          .evaluateAll((ns) => ns.map((n) => Number(n.dataset.dexId))),
        [1, 4, 6, 7],
      );
      assert.deepEqual(errors, []);
      console.log(
        'PASS touch all/owned/missing, masked unseen entries, type combination, reset and independent party picker',
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
