// Optional browser check: league progress, champion styling, rewards and reset.
const {
  chromium,
} = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
require('node:fs').mkdirSync('/tmp/league84', { recursive: true });
const server = spawn('python', ['-m', 'http.server', '8844', '--bind', '127.0.0.1'], {
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
      const p = await browser.newPage({
        viewport: { width, height },
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8844');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7];
        document.dispatchEvent(new CustomEvent('title:start'));
      });
      for (let i = 0; i < 5; i++) {
        await p.evaluate((i) => {
          for (const d of document.querySelectorAll('dialog[open]')) d.close();
          battleEpoch++;
          busy = false;
          state.mapId = [
            'indigo-lorelei',
            'indigo-bruno',
            'indigo-agatha',
            'indigo-lance',
            'indigo-champion',
          ][i];
          state.pendingMapId = null;
          state.mapReturn = null;
          state.pos = 0;
          render();
        }, i);
        assert(await p.locator('.league-stage-label').isVisible());
        assert.equal(
          await p.locator('.league-stage-label').textContent(),
          i === 4 ? 'チャンピオン戦' : `四天王 ${i + 1} / 4`,
        );
        assert.equal(
          await p.locator('#map').evaluate((n) => n.classList.contains('league-champion')),
          i === 4,
        );
        assert(
          (await p.locator('#route .map-art').getAttribute('src')).endsWith('league-room.webp'),
        );
        assert.equal(await p.locator('#route .tile').count(), 15);
        await p.screenshot({ path: `/tmp/league84/map-${width}-${i}.png` });
        if (process.env.PUBLIC_URL && width === 390) {
          await p
            .locator('#map img')
            .evaluateAll((xs) => Promise.all(xs.map((x) => x.decode().catch(() => {}))));
          await p
            .locator('#map')
            .screenshot({ path: `/tmp/league84/${25 + i}_リーグ_v0.9.2.84.png` });
        }
        await p.evaluate(() => openBattle(true, true));
        assert.equal(
          await p.locator('#encounter').getAttribute('data-league'),
          i === 4 ? 'champion' : '',
        );
        assert.equal(
          await p.evaluate(() => battle.series.profile.name),
          ['カンナ', 'シバ', 'キクコ', 'ワタル', 'ライバル'][i],
        );
        assert.match(await p.locator('#kind').textContent(), i === 4 ? /チャンピオン戦/ : /四天王/);
        await p.evaluate(() => {
          battleEpoch++;
          $('#encounter').close();
          $('#battle').showModal();
          battle.roundStarted = true;
        });
        await p.screenshot({ path: `/tmp/league84/battle-${width}-${i}.png` });
        assert(
          await p
            .locator('#battle-backdrop')
            .evaluate((n) => getComputedStyle(n).backgroundImage.includes('league-room.webp')),
        );
        await p.evaluate(() => {
          battle.series.index = battle.series.team.length - 1;
          battle.hp = 0;
          battle.victory = true;
          endBattle(true);
        });
        assert.match(
          await p.locator('.trainer-victory-heading small').textContent(),
          i === 4 ? /チャンピオン戦/ : /四天王/,
        );
      }
      await p.evaluate(() => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
        busy = false;
        state.mapId = 'viridian';
        render();
        openBattle(false, false);
      });
      assert.equal(
        await p.locator('#map').evaluate((n) => n.classList.contains('league-champion')),
        false,
      );
      assert.equal(await p.locator('#encounter').getAttribute('data-league'), '');
      assert.equal(await p.locator('#battle').getAttribute('data-league'), '');
      assert.deepEqual(errors, []);
      await p.close();
      console.log(
        'PASS',
        width,
        height,
        '5 stages, shared art, bosses, rewards, champion styling/reset',
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
