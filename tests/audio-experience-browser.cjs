const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process'),
  assert = require('node:assert/strict');
const server = spawn('python', ['-m', 'http.server', '8847', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const p = await b.newPage({
      viewport: { width: 390, height: 664 },
      reducedMotion: 'reduce',
      ignoreHTTPSErrors: true,
    });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.addInitScript(() => {
      window.audioNodes = [];
      const AC = window.AudioContext;
      window.AudioContext = class extends AC {
        createBufferSource() {
          const node = super.createBufferSource(),
            record = { node, context: this, started: false, stopAt: Infinity };
          const start = node.start.bind(node),
            stop = node.stop.bind(node);
          node.start = (...args) => {
            record.started = true;
            return start(...args);
          };
          node.stop = (at = 0) => {
            record.stopAt = at;
            return stop(at);
          };
          window.audioNodes.push(record);
          return node;
        }
      };
    });
    await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8847');
    await p.waitForFunction(() => $('#boot-screen').hidden);
    await p.evaluate(() => {
      state.opening.stage = 'complete';
      state.party = [1, 4, 7];
      state.owned = [1, 4, 7];
      state.mapId = 'viridian';
      document.dispatchEvent(new CustomEvent('title:start'));
    });
    await p.locator('#roll').focus();
    await p.keyboard.press('Tab');
    await p.evaluate(() => PokekoroMapAudio.sync());
    const theme = async (key) =>
      p.waitForFunction(
        (key) => PokekoroMapAudio.inspect().theme === key && PokekoroMapAudio.inspect().playing,
        key,
        { timeout: 30000 },
      );
    await theme('field');
    assert(
      await p.evaluate(() => {
        const x = PokekoroMapAudio.inspect();
        return x.backend === 'decoded' && x.loop.start === 0.08 && x.loop.end < 56;
      }),
    );
    const pos = await p.evaluate(() => PokekoroMapAudio.inspect().position);
    await p.evaluate(() => $('#guide').showModal());
    await p.waitForTimeout(150);
    assert.equal(await p.evaluate(() => PokekoroMapAudio.inspect().theme), 'field');
    assert(await p.evaluate((x) => PokekoroMapAudio.inspect().position > x, pos));
    await p.evaluate(() => $('#guide').close());
    await p.evaluate(() => {
      openBattle(false, false);
    });
    await theme('wild');
    await p.locator('#encounter-go').click();
    await theme('wild');
    await p.evaluate(() => {
      battle.hp = 0;
      battle.victory = true;
      battle.damage = battle.total;
      endBattle(true);
    });
    await theme('victory');
    await p.evaluate(() => done());
    await theme('field');
    await p.evaluate(() => showItemFind({ key: 'balls', count: 3 }));
    await p.waitForTimeout(150);
    assert.equal(await p.evaluate(() => PokekoroMapAudio.inspect().theme), 'field');
    assert.equal(await p.evaluate(() => PokekoroMapAudio.inspect().playing), true);
    await p.locator('#item-find-done').click();
    console.log(
      'PASS field loop bounds, guide continuity, wild/victory, item reward avoids stale win music',
    );
    await p.evaluate(() => {
      state.mapId = 'pewter-gym';
      state.pos = 14;
      state.pendingMapId = null;
      render();
      openBattle(true, true);
    });
    await theme('trainer');
    await p.waitForFunction(() => !$('#encounter-go').disabled, { timeout: 15000 });
    await p.locator('#encounter-go').click();
    await theme('trainerBattle');
    assert.equal(await p.evaluate(() => PokekoroMapAudio.inspect().loop.start), 0.62);
    const sourceCount = await p.evaluate(() => audioNodes.filter((x) => x.node.loop).length);
    await p.evaluate(() => {
      battle.hp = 0;
      endBattle(true);
    });
    await p.waitForFunction(() => battle.continuation && $('#battle').open);
    assert.equal(await p.evaluate(() => PokekoroMapAudio.inspect().theme), 'trainerBattle');
    assert.equal(await p.evaluate(() => audioNodes.filter((x) => x.node.loop).length), sourceCount);
    await p.evaluate(() => {
      battle.series.index = battle.series.team.length - 1;
      battle.hp = 0;
      battle.victory = true;
      endBattle(true);
    });
    await theme('trainerVictory');
    assert.equal(await p.evaluate(() => PokekoroMapAudio.inspect().loop.start), 0.77);
    console.log('PASS trainer intro/battle/continuous second opponent/final win');
    await p.evaluate(() => {
      for (const d of document.querySelectorAll('dialog[open]')) d.close();
      busy = false;
      battleEpoch++;
      state.mapId = 'safari-zone';
      state.pos = 1;
      state.pendingMapId = null;
      render();
      openBattle(false, false);
    });
    await theme('water');
    await p.evaluate(() => {
      $('#encounter').close();
      endBattle(true);
    });
    await p.waitForTimeout(150);
    assert.equal(await p.evaluate(() => PokekoroMapAudio.inspect().theme), 'water');
    await p.evaluate(() => done());
    await theme('field');
    await p.evaluate(() => {
      document.dispatchEvent(new CustomEvent('title:soundchange', { detail: { enabled: false } }));
    });
    await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => PokekoroMapAudio.inspect().playing), false);
    await p.evaluate(() =>
      document.dispatchEvent(
        new CustomEvent('title:soundchange', { detail: { enabled: true, userGesture: true } }),
      ),
    );
    await theme('field');
    console.log('PASS Safari calm BGM and capture continuity, mute/resume');
    await p.evaluate(() => {
      window.OfflineAudioContext = undefined;
      window.webkitOfflineAudioContext = undefined;
      state.mapId = 'rocket-hideout';
      render();
    });
    await p.waitForFunction(
      () =>
        PokekoroMapAudio.inspect().backend === 'media' &&
        PokekoroMapAudio.inspect().theme === 'hideout' &&
        !$('#map-bgm').paused,
    );
    await p.waitForTimeout(150);
    assert.equal(
      await p.evaluate(
        () =>
          audioNodes.filter((x) => x.node.loop && x.started && x.stopAt > x.context.currentTime)
            .length,
      ),
      0,
    );
    await p.evaluate(() => {
      state.mapId = 'viridian';
      render();
    });
    await p.waitForFunction(
      () =>
        PokekoroMapAudio.inspect().backend === 'decoded' &&
        PokekoroMapAudio.inspect().theme === 'field',
    );
    assert.equal(await p.evaluate(() => $('#map-bgm').paused), true);
    await p.waitForTimeout(100);
    assert.equal(
      await p.evaluate(
        () =>
          audioNodes.filter((x) => x.node.loop && x.started && x.stopAt > x.context.currentTime)
            .length,
      ),
      1,
    );
    console.log('PASS decode failure -> media fallback -> decoded, no double music');
    await p.route('**/map-cave-chip-v1.mp3', async (route) => {
      await new Promise((r) => setTimeout(r, 2800));
      await route.continue();
    });
    const elapsed = await p.evaluate(async () => {
      const start = performance.now();
      await PokekoroMapAudio.prepareScene('cave');
      return performance.now() - start;
    });
    assert(elapsed < 2300);
    await p.evaluate(() => {
      const input = $('#volume-se');
      input.value = '0';
      input.dispatchEvent(new Event('input'));
      for (let i = 0; i < 70; i++) PokekoroSfx.tone(300 + i * 10, 0.15);
    });
    assert(await p.evaluate(() => PokekoroSfx.inspect().voices <= 40));
    await p.waitForTimeout(160);
    assert(await p.evaluate(() => PokekoroSfx.inspect().volume < 0.001));
    await p.evaluate(() => {
      PokekoroSfx.startRoll();
      window.dispatchEvent(new Event('blur'));
    });
    assert.equal(await p.evaluate(() => PokekoroSfx.inspect().rolling), false);
    await p.evaluate(() => {
      PokekoroSfx.startRoll();
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await p.evaluate(() => PokekoroSfx.inspect().voices), 0);
    assert.equal(await p.evaluate(() => PokekoroSfx.inspect().rolling), false);
    assert.equal(await p.evaluate(() => PokekoroMapAudio.inspect().playing), false);
    await p.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await theme('field');
    console.log(
      'PASS SE voice limit/zero volume/blur stop, hidden handlers stop music and SE, visible resume',
    );
    const titlePage = await b.newPage({
      viewport: { width: 390, height: 664 },
      reducedMotion: 'reduce',
      ignoreHTTPSErrors: true,
    });
    await titlePage.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8847');
    await titlePage.waitForFunction(() => $('#boot-screen').hidden);
    await titlePage.evaluate(() => {
      state.opening.stage = 'complete';
      state.owned = [1, 4, 7];
      state.party = [1, 4, 7];
      state.mapId = 'viridian';
      save();
    });
    await titlePage.locator('#title-tap-prompt').click();
    await titlePage.waitForFunction(
      () => !$('#title-bgm').paused && Number.isFinite($('#title-bgm').duration),
    );
    await titlePage.evaluate(() => {
      const audio = $('#title-bgm');
      audio.currentTime = audio.duration - 5.05;
      audio.dispatchEvent(new Event('timeupdate'));
    });
    assert(await titlePage.evaluate(() => $('#title-bgm').currentTime < 1));
    await titlePage.locator('#enter-game').click();
    await titlePage.waitForFunction(() => !$('#game-shell').hidden);
    assert.equal(await titlePage.evaluate(() => $('#title-bgm').paused), true);
    await titlePage.waitForFunction(() => PokekoroMapAudio.inspect().playing);
    console.log('PASS title loop skips silent tail and actual Start transfers music to map');
    await titlePage.close();
    assert.deepEqual(errors, []);
    console.log('PASS slow music preparation bounded, no JS errors');
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
