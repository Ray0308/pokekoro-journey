// 任意のブラウザ検証。技の確認・18属性の反撃・投球の実タッチと在庫・練習捕獲を確認する。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('child_process');
const assert = require('node:assert/strict');
const server = spawn('python', ['-m', 'http.server', '8820', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    async function page(reduce = 'reduce') {
      const c = await b.newContext({
          viewport: { width: 390, height: 664 },
          hasTouch: true,
          reducedMotion: reduce,
        }),
        p = await c.newPage();
      p.errors = [];
      p.on('pageerror', (e) => p.errors.push(e.message));
      await p.goto('http://127.0.0.1:8820');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      return p;
    }
    async function battle(p, pending = false) {
      await p.evaluate((pending) => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7];
        state.balls = 5;
        document.dispatchEvent(new CustomEvent('title:start'));
        openBattle(false, false);
        $('#encounter').close();
        $('#battle').showModal();
        battle.hp = battle.total = 100000;
        battle.combat.members[0].gauge = PokemonSkillRules.cost(1);
        battle.combat.guard = true;
        PokekoroTurns.prepare(pending);
      }, pending);
    }
    async function swipe(p) {
      const r = await p.locator('.swipe-ball').boundingBox(),
        x = r.x + r.width / 2,
        y = r.y + r.height / 2;
      const c = await p.context().newCDPSession(p);
      await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await c.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + 8, y: y - 90 }],
      });
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await c.detach();
    }
    let p = await page();
    await battle(p);
    assert.equal(await p.locator('[data-battle-member="1"]').getAttribute('class'), 'skill-ready');
    assert.equal(
      await p
        .locator('[data-battle-member="1"]')
        .evaluate((n) => n.style.getPropertyValue('--ready-type')),
      await p.evaluate(() => POKEMON_TYPE_COLORS[0]),
    );
    await p.click('#start');
    await p.waitForSelector('#skill-start-confirm[open]');
    assert.equal(await p.evaluate(() => running || preparing), false);
    await p.click('#skill-check');
    await p.waitForFunction(() => battle.phase === 'skills');
    assert.equal(await p.evaluate(() => battle.phase), 'skills');
    await p.click('#turn-use-skill');
    await p.waitForFunction(() => battle.phase === 'ready');
    assert.ok(
      !(await p.locator('[data-battle-member="1"]').getAttribute('class')).includes('skill-ready'),
    );
    assert.deepEqual(p.errors, []);
    await p.context().close();
    console.log('PASS glow, ready confirmation, check skills and use');
    p = await page();
    await battle(p, true);
    await p.click('#start');
    await p.click('#skill-continue');
    await p.waitForFunction(() => running);
    assert.equal(await p.locator('#skill-start-confirm').isVisible(), false);
    assert.deepEqual(p.errors, []);
    await p.context().close();
    console.log('PASS confirmed counter -> automatic puzzle without second prompt');
    p = await page('no-preference');
    await battle(p);
    const effects = await p.evaluate(async () => {
      const out = [];
      for (let type = 0; type < 18; type++) {
        const task = PokekoroBattleFX.counterHit(
          document.querySelector('[data-battle-member="1"]'),
          false,
          undefined,
          undefined,
          type,
        );
        const n = document.querySelector('.enemy-counter-effect');
        out.push({
          type: n.dataset.type,
          kind: n.dataset.kind,
          color: n.style.getPropertyValue('--counter-color'),
        });
        await task;
      }
      return out;
    });
    assert.equal(new Set(effects.map((e) => e.type)).size, 18);
    assert.ok(new Set(effects.map((e) => e.kind)).size >= 12);
    assert.deepEqual(p.errors, []);
    await p.context().close();
    console.log('PASS 18 typed retaliation effects');
    for (const mode of ['normal', 'type', 'safari', 'keyboard']) {
      p = await page();
      await battle(p);
      await p.evaluate((mode) => {
        Math.random = () => 0;
        battle.m = POKEDEX[24];
        if (mode === 'safari') battle.safari = true;
        battle.combat = null;
        battle.hp = 0;
        battle.damage = battle.total * 2;
        battle.victory = true;
        endBattle(true);
      }, mode);
      if (mode === 'type')
        await p.evaluate(() => {
          state.typeBalls[0] = 2;
          catchMon(TYPE_BALLS[0].id, 1);
        });
      else await p.locator('.ball-choice').first().click();
      await p.waitForSelector('#capture-gesture');
      const stock = await p.evaluate(
        (mode) => (mode === 'type' ? state.typeBalls[0] : state.balls),
        mode,
      );
      await p.locator('.swipe-ball').tap();
      assert.equal(
        await p.evaluate((mode) => (mode === 'type' ? state.typeBalls[0] : state.balls), mode),
        stock,
      );
      await p.click('.swipe-back');
      assert.equal(await p.locator('#capture-gesture').count(), 0);
      if (mode === 'type') await p.evaluate(() => catchMon(TYPE_BALLS[0].id, 1));
      else await p.locator('.ball-choice').first().click();
      if (mode === 'keyboard') await p.locator('.swipe-ball').press('Enter');
      else await swipe(p);
      await p.waitForFunction(() => !capturePending && !document.querySelector('#capture-gesture'));
      assert.equal(
        await p.evaluate((mode) => (mode === 'type' ? state.typeBalls[0] : state.balls), mode),
        stock - 1,
      );
      assert.deepEqual(p.errors, []);
      await p.context().close();
      console.log('PASS capture tap/back/no cost -> throw/one cost', mode);
    }
    p = await page();
    await p.evaluate(() => {
      state.opening = { version: 3, stage: 'throw', starterId: 4 };
      document.dispatchEvent(new CustomEvent('title:start'));
    });
    await p.click('#opening-next');
    await p.waitForSelector('#capture-gesture');
    await swipe(p);
    await p.waitForFunction(() => state.opening.stage === 'caught');
    assert.deepEqual(p.errors, []);
    await p.context().close();
    console.log('PASS tutorial swipe -> guaranteed Pikachu');
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
