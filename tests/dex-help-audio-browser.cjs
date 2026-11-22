'use strict';
const assert = require('node:assert/strict'),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8898', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
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
      await p.addInitScript(() => {
        window.musicStarts = 0;
        const AC = window.AudioContext;
        window.AudioContext = class extends AC {
          createBufferSource() {
            const n = super.createBufferSource(),
              start = n.start.bind(n);
            n.start = (...args) => {
              if (n.buffer?.duration > 10) window.musicStarts++;
              return start(...args);
            };
            return n;
          }
        };
      });
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8898');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7, 215, 144];
        state.mapId = 'viridian';
        document.dispatchEvent(new CustomEvent('title:start'));
        PokekoroDex.open(215);
      });
      assert(
        await p.locator('.pokemon-skill-help').evaluate((n) => {
          const r = n.getBoundingClientRect();
          return (
            r.height >= 44 &&
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          );
        }),
      );
      await p.screenshot({ path: `/workspace/dex-help-button-${viewport.width}.png` });
      await p.locator('.pokemon-skill-help').tap();
      await p.waitForFunction(
        () => PokekoroMapAudio.inspect().theme === 'pokedex' && PokekoroMapAudio.inspect().playing,
      );
      assert.match(await p.locator('#pokemon-skill-info').innerText(), /こおりのつぶて/);
      assert.match(await p.locator('#pokemon-skill-info').innerText(), /ゲージ 8/);
      assert(
        await p.locator('#skill-info-close').evaluate((n) => {
          const r = n.getBoundingClientRect();
          return (
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          );
        }),
      );
      await p.screenshot({ path: `/workspace/dex-skill-help-${viewport.width}.png` });
      await p.locator('#skill-info-close').tap();
      assert(await p.locator('#pokedex-device').isVisible());
      const before = await p.evaluate(() => ({
        audio: PokekoroMapAudio.inspect(),
        starts: window.musicStarts,
      }));
      await p.locator('#device-habitat').tap();
      await p.waitForFunction(
        () => $('#pokemon-habitat-dialog').open && PokekoroMapAudio.inspect().playing,
      );
      await p.screenshot({ path: `/workspace/dex-habitat-audio-${viewport.width}.png` });
      const after = await p.evaluate(() => ({
        audio: PokekoroMapAudio.inspect(),
        starts: window.musicStarts,
      }));
      assert.equal(after.audio.theme, 'pokedex');
      assert(after.audio.position >= before.audio.position);
      assert.equal(after.starts, before.starts, 'opening habitat must not restart music');
      await p.locator('#habitat-close').tap();
      await p.evaluate(() => PokekoroDex.open(144));
      await p.locator('.pokemon-skill-help').tap();
      assert.match(await p.locator('#pokemon-skill-info').innerText(), /1・2/);
      assert.match(await p.locator('#pokemon-skill-info').innerText(), /ゲージ 18/);
      await p.evaluate(() =>
        document.dispatchEvent(
          new CustomEvent('title:soundchange', { detail: { enabled: false } }),
        ),
      );
      await p.waitForFunction(() => !PokekoroMapAudio.inspect().playing);
      await p.locator('#skill-info-close').tap();
      await p.locator('#device-habitat').tap();
      assert.equal(await p.evaluate(() => PokekoroMapAudio.inspect().playing), false);
      await p.locator('#habitat-close').tap();
      await p.evaluate(() => PokekoroDex.open(999));
      assert.equal(await p.locator('.pokemon-skill-help').count(), 0);
      assert.deepEqual(errors, []);
      console.log(
        'PASS direct move help, touch close, current gauge/dice explanation, continuous habitat BGM without restart, mute and unseen secrecy',
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
