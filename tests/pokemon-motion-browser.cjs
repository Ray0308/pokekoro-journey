const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8876', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const [mode, viewport] of [
      ['normal', { width: 390, height: 664 }],
      ['safari', { width: 320, height: 568 }],
      ['mock', { width: 844, height: 390 }],
    ]) {
      const p = await b.newPage({ viewport, hasTouch: true, ignoreHTTPSErrors: true });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8876');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate((mode) => {
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7];
        if (mode === 'mock') {
          state.opening = { version: 5, stage: 'practice', starterId: 1 };
        } else state.opening.stage = 'complete';
        document.dispatchEvent(new CustomEvent('title:start'));
        if (mode !== 'mock') {
          if (mode === 'safari') state.mapId = 'safari-zone';
          openBattle(false, false);
          $('#encounter').close();
          $('#battle').showModal();
        }
      }, mode);
      if (mode === 'mock') await p.locator('#opening-next').tap();
      const selector = mode === 'mock' ? '.mock-opponent img' : '#enemyimg';
      await p.waitForFunction(
        (s) =>
          document
            .querySelector(s)
            .getAnimations()
            .some((a) => a.id === 'pokemon-enter'),
        selector,
      );
      const frames = await p.locator(selector).evaluate((n) =>
        n
          .getAnimations()
          .find((a) => a.id === 'pokemon-enter')
          .effect.getKeyframes(),
      );
      assert(
        frames.every((f) => !f.scale),
        'no image stretching',
      );
      const snapshot = () =>
        p.evaluate(
          (mode) =>
            JSON.stringify(
              mode === 'mock'
                ? PokekoroMockPractice.inspect()
                : {
                    hp: battle.hp,
                    damage: battle.damage,
                    combat: battle.combat,
                    balls: state.balls,
                  },
            ),
          mode,
        );
      const before = await snapshot();
      await p.waitForFunction(
        (s) =>
          document
            .querySelector(s)
            .getAnimations()
            .some((a) => a.id === 'pokemon-idle'),
        selector,
      );
      const board = mode === 'mock' ? '#mock-practice canvas' : '#board';
      const r1 = await p.locator(board).boundingBox();
      const y1 = await p.locator(selector).evaluate((n) => n.getBoundingClientRect().y);
      await p.waitForTimeout(800);
      const y2 = await p.locator(selector).evaluate((n) => n.getBoundingClientRect().y);
      assert(Math.abs(y2 - y1) > 0.1 && Math.abs(y2 - y1) < 4);
      assert.deepEqual(await p.locator(board).boundingBox(), r1, 'puzzle does not move');
      assert.equal(await snapshot(), before);
      await p.evaluate((s) => {
        const n = document.querySelector(s);
        n.src = n.getAttribute('src');
      }, selector);
      await p.waitForTimeout(40);
      assert.equal(
        await p
          .locator(selector)
          .evaluate((n) => n.getAnimations().filter((a) => a.id === 'pokemon-enter').length),
        0,
        'render same Pokemon does not reenter',
      );
      await p.evaluate((s) => PokekoroPokemonMotion.hit(document.querySelector(s)), selector);
      assert(
        await p
          .locator(selector)
          .evaluate((n) => n.getAnimations().some((a) => a.id === 'pokemon-hit')),
      );
      await p.waitForFunction(
        (s) =>
          document
            .querySelector(s)
            .getAnimations()
            .some((a) => a.id === 'pokemon-idle'),
        selector,
      );
      if (mode === 'normal') {
        await p.evaluate(() => {
          window.hitPromise = PokekoroBattleFX.counterHit(
            document.querySelector('[data-battle-member="1"]'),
            false,
            $('#battle'),
            $('#enemyimg'),
            8,
          );
        });
        await p.waitForFunction(() =>
          document
            .querySelector('[data-battle-member="1"] img')
            .getAnimations()
            .some((a) => a.id === 'pokemon-hit'),
        );
        await p.evaluate(() => window.hitPromise);
        await p.evaluate(() => {
          window.hitPromise = PokekoroBattleFX.counterHit(
            document.querySelector('[data-battle-member="1"]'),
            true,
            $('#battle'),
            $('#enemyimg'),
            8,
          );
        });
        await p.evaluate(() => window.hitPromise);
        assert.equal(
          await p
            .locator('[data-battle-member="1"] img')
            .evaluate((n) => n.getAnimations().filter((a) => a.id === 'pokemon-hit').length),
          0,
          'guard is not a damage recoil',
        );
      }
      await p.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(
        await p
          .locator(selector)
          .evaluate((n) => n.getAnimations().filter((a) => a.id.startsWith('pokemon-')).length),
        0,
      );
      await p.evaluate(() => {
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
        $('#battle-pause').showModal();
      });
      await p.waitForTimeout(30);
      assert.equal(
        await p
          .locator(selector)
          .evaluate((n) => n.getAnimations().filter((a) => a.id.startsWith('pokemon-')).length),
        0,
        'resume confirmation stays still',
      );
      await p.evaluate(() => $('#battle-pause').close());
      await p.waitForFunction(
        (s) =>
          document
            .querySelector(s)
            .getAnimations()
            .some((a) => a.id === 'pokemon-idle'),
        selector,
      );
      await p.emulateMedia({ reducedMotion: 'reduce' });
      await p.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
      await p.waitForFunction(
        (s) =>
          document
            .querySelector(s)
            .getAnimations()
            .filter((a) => a.id.startsWith('pokemon-')).length === 0,
        selector,
      );
      await p.evaluate((s) => PokekoroPokemonMotion.hit(document.querySelector(s)), selector);
      assert.equal(
        await p
          .locator(selector)
          .evaluate((n) => n.getAnimations().filter((a) => a.id.startsWith('pokemon-')).length),
        0,
        'reduced motion',
      );
      await p.emulateMedia({ reducedMotion: 'no-preference' });
      await p.waitForFunction(
        (s) =>
          document
            .querySelector(s)
            .getAnimations()
            .some((a) => a.id === 'pokemon-idle'),
        selector,
      );
      assert.equal(await snapshot(), before, 'motion changes no battle state');
      await p.evaluate(() => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
      });
      await p.waitForTimeout(30);
      assert.equal(
        await p
          .locator(selector)
          .evaluate((n) => n.getAnimations().filter((a) => a.id.startsWith('pokemon-')).length),
        0,
        'close cancels',
      );
      assert.deepEqual(errors, []);
      console.log(
        'PASS entrance/idle/recoil, no scale/layout/state change, same src, guard, pause/reduced motion/close',
        mode,
      );
      await p.close();
    }
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
