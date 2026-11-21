// 配置の検査用。マップ全景と位置0/7/14を3寸法で出力し、数値検査と肉眼確認を分ける。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const out = process.env.MAP_AUDIT_DIR;
if (out) fs.mkdirSync(out, { recursive: true });
const server = spawn('python', ['-m', 'http.server', '8871', '--bind', '127.0.0.1'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  const report = [];
  try {
    for (const viewport of [
      { width: 390, height: 664 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      const p = await browser.newPage({
        viewport,
        hasTouch: true,
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8871');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7];
        document.dispatchEvent(new CustomEvent('title:start'));
      });
      const ids = await p.evaluate(() => MAP_ORDER.slice(13));
      for (const id of ids) {
        for (const pos of [0, 7, 14]) {
          await p.evaluate(
            ({ id, pos }) => {
              state.mapId = id;
              state.pos = pos;
              render();
            },
            { id, pos },
          );
          await p.locator('.map-art').evaluate((i) => i.decode());
          const check = await p.evaluate(() => {
            const route = $('#route').getBoundingClientRect();
            const roll = $('#roll'),
              rr = roll.getBoundingClientRect();
            const rollVisible =
              rr.left >= 0 &&
              rr.top >= 0 &&
              rr.right <= innerWidth + 1 &&
              rr.bottom <= innerHeight + 1 &&
              roll.contains(
                document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2),
              );
            const ns = [...document.querySelectorAll('#route .tile')].map((n) => {
              const r = n.getBoundingClientRect();
              return { x: r.x - route.x, y: r.y - route.y, w: r.width, h: r.height };
            });
            const overlap = [];
            for (let i = 0; i < ns.length; i++)
              for (let j = i + 1; j < ns.length; j++) {
                const a = ns[i],
                  b = ns[j];
                if (
                  Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) <
                  (a.w + b.w) / 2 - 0.5
                )
                  overlap.push([i, j]);
              }
            return {
              rollVisible,
              id: state.mapId,
              pos: state.pos,
              count: ns.length,
              events: currentSquares().length,
              finite: mapRoutePoints().every((p) => p.every(Number.isFinite)),
              inside: ns.every(
                (n) =>
                  n.x >= -1 &&
                  n.y >= -1 &&
                  n.x + n.w <= route.width + 1 &&
                  n.y + n.h <= route.height + 1,
              ),
              overlap,
              width: route.width,
              height: route.height,
              background: $('.map-art').naturalWidth,
              markerInside: [
                ...document.querySelectorAll(
                  '#route .current .player-pawn, #route .current .player-marker',
                ),
              ].every((n) => {
                const r = n.getBoundingClientRect();
                return (
                  !r.width ||
                  (r.left >= route.left - 1 &&
                    r.right <= route.right + 1 &&
                    r.top >= route.top - 1 &&
                    r.bottom <= route.bottom + 1)
                );
              }),
              progress: $('#lap').textContent,
              points: mapRoutePoints(),
            };
          });
          assert.equal(check.count, 15, id);
          if (viewport.width === 844) assert(check.width >= 190, 'landscape map remains readable');
          assert.equal(check.events, 15, id);
          assert(
            check.finite &&
              check.inside &&
              check.markerInside &&
              check.rollVisible &&
              check.background > 0,
            id + JSON.stringify(check),
          );
          assert.deepEqual(check.overlap, [], id + ' circle overlap');
          assert.match(check.progress, new RegExp(`${pos + 1}/15`));
          report.push({ ...check, viewport });
          if (out) {
            await p
              .locator('#route')
              .screenshot({ path: path.join(out, `${id}-${viewport.width}-${pos}.png`) });
            if (pos === 0)
              await p.screenshot({ path: path.join(out, `${id}-${viewport.width}-screen.png`) });
          }
        }
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS 17 maps x 3 positions, 15 nodes/events, circle spacing/bounds, art, progress',
        viewport.width,
      );
      await p.close();
    }
    if (out)
      fs.writeFileSync(path.join(out, 'layout-report.json'), JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
