const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process'),
  assert = require('node:assert/strict');
const s = spawn('python', ['-m', 'http.server', '8867', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const viewport of [
      { width: 390, height: 664 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      const p = await b.newPage({ viewport, hasTouch: true, ignoreHTTPSErrors: true });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8867');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7];
        document.dispatchEvent(new CustomEvent('title:start'));
        window.launches = 0;
        $('#result').showModal();
        PokekoroCaptureGesture.open({
          host: $('#result'),
          body: $('#resultBody'),
          ball: BALLS[0],
          mon: POKEDEX[24],
          onThrow: () => window.launches++,
        });
      });
      const geometry = () =>
        p.evaluate(() =>
          Object.fromEntries(
            [
              '#result',
              '#capture-gesture',
              '.swipe-field',
              '.swipe-target',
              '.swipe-ball-name',
              '.swipe-back',
            ].map((selector) => {
              const r = document.querySelector(selector).getBoundingClientRect();
              return [selector, { x: r.x, y: r.y, w: r.width, h: r.height }];
            }),
          ),
        );
      const initial = await geometry();
      const ball = await p.locator('.swipe-ball').boundingBox(),
        x = ball.x + ball.width / 2,
        y = ball.y + ball.height / 2,
        cdp = await p.context().newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      const down = await geometry();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const tapped = await geometry();
      if (process.env.CAPTURE_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/capture-fixed-${viewport.width}.png` });
      if (process.env.CAPTURE_MEASURE) {
        console.log(viewport.width, JSON.stringify({ initial, tapped }));
      } else {
        function same(before, after) {
          for (const selector of Object.keys(before))
            for (const key of ['x', 'y', 'w', 'h'])
              assert(
                Math.abs(before[selector][key] - after[selector][key]) < 1,
                `${viewport.width} ${selector}.${key} moved ${before[selector][key]} -> ${after[selector][key]}`,
              );
        }
        same(initial, down);
        same(initial, tapped);
        for (let i = 0; i < 2; i++) {
          await p.locator('.swipe-ball').tap();
          same(initial, await geometry());
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + 8, y: y - 22 }],
        });
        same(initial, await geometry());
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        same(initial, await geometry());
        assert.equal(await p.evaluate(() => window.launches), 0);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + 8, y: y - 75 }],
        });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.equal(await p.evaluate(() => window.launches), 1);
        assert.deepEqual(errors, []);
        console.log(
          'PASS stable capture frame/text positions, tap/repeat/drag/cancel, one throw',
          viewport.width,
        );
      }
      await cdp.detach();
      await p.close();
    }
  } finally {
    await b.close();
    s.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  s.kill();
});
