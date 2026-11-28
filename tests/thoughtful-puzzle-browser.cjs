'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8897', '--bind', '127.0.0.1'], {
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
      const page = await browser.newPage({
        viewport,
        hasTouch: true,
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8897');
      await page.waitForFunction(() => $('#boot-screen').hidden);
      await page.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7, 25, 446, 491];
        state.owned = [...state.party];
        document.dispatchEvent(new CustomEvent('title:start'));
        $('#title-options').showModal();
      });
      await page.locator('#puzzle-mode').selectOption('thoughtful');
      await page.locator('#close-title-options').tap();
      await page.evaluate(() => {
        state.mapId = 'viridian';
        openBattle(false, false);
        $('#encounter').close();
        $('#battle').showModal();
        battle.roundStarted = true;
        battle.hp = battle.total = 100000;
        PokekoroTurns.prepare();
        fitBattle();
      });
      assert.equal(await page.evaluate(() => battle.thoughtfulMode), true);
      assert.match(await page.locator('#clock').innerText(), /3手/);
      await page.locator('#start').tap();
      await page.waitForFunction(() => running);
      // Elapsed real time cannot spend moves, trigger attacks, or reveal an automatic hint.
      const initial = await page.evaluate(() =>
        JSON.stringify({ hp: battle.hp, gauge: battle.combat.members, plan: battle.thoughtful }),
      );
      await page.evaluate(() => {
        startAt -= 120000;
      });
      await page.waitForTimeout(1700);
      assert.equal(
        await page.evaluate(() =>
          JSON.stringify({ hp: battle.hp, gauge: battle.combat.members, plan: battle.thoughtful }),
        ),
        initial,
      );
      assert.equal(await page.evaluate(() => puzzleAssist.path.length), 0);
      const touch = await page.context().newCDPSession(page);
      async function chain(count = 5) {
        await page.evaluate(() => {
          // Known path exercises actual touch, refill, scoring, and move commitment.
          grid = Array.from(
            { length: 30 },
            (_, i) => battle.puzzleTypes[(i + Math.floor(i / 6)) % battle.puzzleTypes.length],
          );
          for (let i = 0; i < 6; i++) grid[i] = battle.puzzleTypes[0];
          draw();
        });
        const rect = await page.locator('#board').boundingBox();
        assert(rect.y >= 0 && rect.y + rect.height <= viewport.height + 1, 'board stays onscreen');
        const point = (i) => ({
          x: rect.x + ((i + 0.5) * rect.width) / 6,
          y: rect.y + rect.height / 10,
        });
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [point(0)],
        });
        for (let i = 1; i < count; i++)
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [point(i)],
          });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await chain(2);
      assert.equal(
        await page.evaluate(() => battle.thoughtful.used),
        0,
        'invalid chain spends no move',
      );
      await chain();
      assert.equal(await page.evaluate(() => battle.thoughtful.used), 1);
      assert(await page.evaluate(() => battle.damage > 0));
      await page.locator('#thoughtful-hint').tap();
      assert.equal(await page.evaluate(() => puzzleAssist.path.length), 3);
      assert.equal(await page.evaluate(() => battle.thoughtful.used), 1);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => window.testHidden || false,
        });
        window.testHidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(await page.evaluate(() => running), false);
      await page.evaluate(() => {
        window.testHidden = false;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.locator('#battle-pause button').tap();
      assert.equal(await page.evaluate(() => battle.thoughtful.used), 1);
      await page.screenshot({ path: `/tmp/thoughtful-${viewport.width}.png` });
      // Time cannot expire while holding or waiting between moves.
      await page.evaluate(() => {
        startAt -= 120000;
      });
      await chain();
      assert.equal(await page.evaluate(() => battle.thoughtful.used), 2);
      await chain();
      await page.waitForFunction(() => battle.phase === 'ready' && battle.counterPending);
      assert(await page.evaluate(() => battle.hp < 100000));
      assert.equal(
        await page.evaluate(() => battle.thoughtful.used),
        0,
        'next turn gets fresh moves',
      );
      assert.equal(await page.evaluate(() => battle.combat.turn), 1);
      assert.equal(
        await page.evaluate(() => battle.combat.members.filter((m) => m.fainted).length),
        0,
      );
      // Skills and closing the panel must keep the next puzzle's mission/choice.
      const plan = await page.evaluate(() => JSON.stringify(battle.thoughtful));
      await page.locator('[data-battle-member="491"]').tap();
      assert.match(await page.locator('.turn-skill-description').innerText(), /3手パズル/);
      await page.locator('#turn-next').tap();
      assert.equal(await page.evaluate(() => JSON.stringify(battle.thoughtful)), plan);
      await page.locator('#start').tap();
      if (await page.locator('#skill-start-confirm').isVisible())
        await page.locator('#skill-continue').tap();
      await page.waitForFunction(() => running && battle.combat.turn === 2);
      assert.equal(
        await page.evaluate(() => battle.combat.members.filter((m) => m.fainted).length),
        1,
      );
      // New enemy gets a new plan; fixed boss lets the player choose gauge rather than power.
      await page.evaluate(() => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
        running = false;
        cancelAnimationFrame(raf);
        busy = false;
        state.mapId = 'pewter-gym';
        openBattle(true, true);
        $('#encounter').close();
        $('#battle').showModal();
        battle.roundStarted = true;
        PokekoroTurns.prepare();
        fitBattle();
      });
      await page.locator('[data-thoughtful-choice="gauge"]').tap();
      assert.equal(await page.evaluate(() => battle.thoughtful.choice), 'gauge');
      await page.locator('#start').tap();
      await page.waitForFunction(() => running);
      assert.equal(await page.locator('[data-thoughtful-choice="power"]').isDisabled(), true);
      await page.evaluate(() => {
        battle.thoughtful.goal = { kind: 'long', target: 5, label: '5こ以上を 1回つなごう' };
        battle.hp = battle.total = 100000;
        for (const m of battle.combat.members) m.gauge = 0;
      });
      await chain();
      await chain();
      const gaugeBefore = await page.evaluate(() => battle.combat.members[1].gauge);
      await chain();
      await page.waitForFunction(() => battle.phase === 'ready');
      assert.equal(
        await page.evaluate(() => battle.combat.members[1].gauge),
        gaugeBefore + 4,
        'boss choice gives non-cleared living ally gauge',
      );
      // Manual or automatic reshuffling cannot refund used moves or reroll mission.
      await page.locator('#start').tap();
      if (await page.locator('#skill-start-confirm').isVisible())
        await page.locator('#skill-continue').tap();
      await page.waitForFunction(() => running);
      await chain();
      const beforeRefresh = await page.evaluate(() => JSON.stringify(battle.thoughtful));
      await page.evaluate(() => refreshBattlePuzzle(true));
      assert.equal(await page.evaluate(() => JSON.stringify(battle.thoughtful)), beforeRefresh);
      await page.evaluate(() => {
        grid = Array.from(
          { length: 30 },
          (_, i) => battle.puzzleTypes[((i % 6) + Math.floor(i / 6) * 3) % 6],
        );
        if (puzzleHintPath(grid).length)
          throw new Error('deadlock fixture must have no legal chain');
      });
      await page.waitForFunction(() => puzzleHintPath(grid).length >= 3);
      assert.equal(
        await page.evaluate(() => JSON.stringify(battle.thoughtful)),
        beforeRefresh,
        'deadlock recovery preserves moves and mission',
      );
      // Finishing the first trainer opponent carries gauges/guard, with fresh next-opponent moves.
      await page.evaluate(() => {
        running = false;
        cancelAnimationFrame(raf);
        battle.hp = 0;
        battle.combat.guard = true;
        battle.combat.members[0].gauge = 3;
        nextTrainerRound();
        $('#encounter').close();
        $('#battle').showModal();
        battle.roundStarted = true;
        PokekoroTurns.prepare();
        fitBattle();
      });
      assert.equal(await page.evaluate(() => battle.series.index), 1);
      assert.equal(await page.evaluate(() => battle.thoughtful.used), 0);
      assert.equal(await page.evaluate(() => battle.combat.guard), true);
      assert.equal(await page.evaluate(() => battle.combat.members[0].gauge), 3);
      await page.evaluate(() => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
        busy = false;
        state.mapId = 'viridian';
        openBattle(false, false);
        $('#encounter').close();
        $('#battle').showModal();
        battle.hp = 1;
        battle.roundStarted = true;
        PokekoroTurns.prepare();
        fitBattle();
      });
      await page.locator('#start').tap();
      await page.waitForFunction(() => running);
      await chain();
      await chain();
      await chain();
      await page.waitForFunction(() => $('#result').open);
      assert.equal(await page.evaluate(() => battle.phase), 'finished');
      assert.equal(await page.evaluate(() => battle.hp), 0);
      // Storage persists across reload; ordinary mode/Safari remain separate.
      await page.reload();
      await page.waitForFunction(() => $('#boot-screen').hidden);
      assert.equal(await page.locator('#puzzle-mode').inputValue(), 'thoughtful');
      await page.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [1, 4, 7];
        state.owned = [...state.party];
        state.mapId = 'safari-zone';
        document.dispatchEvent(new CustomEvent('title:start'));
        openBattle(false, false);
      });
      assert.equal(await page.evaluate(() => battle.thoughtfulMode), false);
      assert.equal(await page.evaluate(() => battleDuration()), 30);
      await page.evaluate(() => {
        $('#puzzle-mode').value = 'timed';
        $('#puzzle-mode').dispatchEvent(new Event('change'));
        state.mapId = 'viridian';
        openBattle(false, false);
      });
      assert.equal(await page.evaluate(() => battle.thoughtfulMode), false);
      assert.equal(await page.evaluate(() => battleDuration()), 10);
      assert.deepEqual(errors, []);
      console.log(
        'PASS thoughtful touch, unlimited time, 3 moves, optional goals, boss choices, skills/counter, refresh, persistence, timed/Safari',
        viewport,
      );
      await page.close();
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
