const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8872', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const p = await b.newPage({
      viewport: { width: 390, height: 664 },
      hasTouch: true,
      ignoreHTTPSErrors: true,
      reducedMotion: 'reduce',
    });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8872');
    await p.waitForFunction(() => $('#boot-screen').hidden);
    await p.evaluate(() => {
      state.opening.stage = 'complete';
      state.party = [1, 4, 7];
      state.owned = [1, 4, 7];
      state.clearedMaps = [];
      state.rainbowTickets = [];
      state.mapReturn = null;
      state.tour = 1;
      document.dispatchEvent(new CustomEvent('title:start'));
      Math.random = () => 0.99;
    });
    const ids = await p.evaluate(() => MAP_ORDER);
    const report = [];
    for (const [i, id] of ids.entries()) {
      const r = await p.evaluate((id) => {
        state.mapId = id;
        state.pos = 14;
        state.pendingMapId = null;
        busy = false;
        render();
        const map = activeMap(),
          squares = currentSquares();
        openBattle(true, true);
        $('#encounter').close();
        $('#battle').showModal();
        battle.roundStarted = true;
        const profile = battle.trainerAppearance?.name || battle.m.label;
        if (battle.series) battle.series.index = battle.series.team.length - 1;
        const before = JSON.stringify({
          balls: state.balls,
          super: state.super,
          master: state.master,
        });
        battle.hp = 0;
        battle.victory = true;
        if (battle.safari) endSafari(true);
        else endBattle(true);
        const after = JSON.stringify({
          balls: state.balls,
          super: state.super,
          master: state.master,
        });
        endBattle(true);
        const twice = JSON.stringify({
          balls: state.balls,
          super: state.super,
          master: state.master,
        });
        return {
          id,
          name: map.name,
          next: map.nextMap,
          pending: state.pendingMapId,
          cleared: state.clearedMaps.includes(id),
          profile,
          squares,
          before,
          after,
          twice,
        };
      }, id);
      assert.equal(r.squares.length, 15);
      assert.equal(r.squares[0], 'start');
      assert.equal(r.squares.at(-1), 'goal');
      assert.equal(r.next, ids[(i + 1) % ids.length]);
      assert.equal(r.pending, r.next);
      assert(r.cleared);
      assert.equal(r.after, r.twice, 'rewards once ' + id);
      // Pending advancement must survive reload, without granting another reward.
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      const restored = await p.evaluate(() => ({
        id: state.mapId,
        pending: state.pendingMapId,
        pos: state.pos,
        stock: JSON.stringify({ balls: state.balls, super: state.super, master: state.master }),
      }));
      assert.equal(restored.pending, r.next);
      assert.equal(restored.stock, r.after);
      await p.evaluate(() => {
        document.dispatchEvent(new CustomEvent('title:start'));
        advanceMap();
      });
      assert.equal(await p.evaluate(() => state.mapId), r.next);
      assert.equal(await p.evaluate(() => state.pos), 0);
      report.push(r);
      if ((i + 1) % 10 === 0) console.log('PASS boss win/reload/advance', i + 1);
    }
    assert.equal(await p.evaluate(() => state.tour), 2, 'one full tour increment');
    // Every cleared map can be revisited and beaten without replacing the main journey.
    for (const [reviewIndex, id] of ids.entries()) {
      await p.evaluate((id) => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
        busy = false;
        state.mapId = 'viridian';
        state.pos = 6;
        state.pendingMapId = null;
        state.mapReturn = null;
        if (id === 'viridian') state.mapId = 'pewter-city';
        render();
        revisitMap(id);
      }, id);
      const origin = await p.evaluate(() => JSON.stringify(state.mapReturn));
      assert.notEqual(origin, 'null');
      await p.evaluate(() => {
        state.pos = 14;
        render();
        openBattle(true, true);
        $('#encounter').close();
        $('#battle').showModal();
        battle.roundStarted = true;
        if (battle.series) battle.series.index = battle.series.team.length - 1;
        battle.hp = 0;
        battle.victory = true;
        if (battle.safari) endSafari(true);
        else endBattle(true);
      });
      assert.equal(
        await p.evaluate(() => state.pendingMapId),
        null,
        'no advancing on revisit ' + id,
      );
      await p.evaluate(() => done());
      assert.equal(await p.evaluate(() => state.pos), 14, 'revisit waits at completed map ' + id);
      assert(await p.locator('#revisit-next').isVisible());
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      assert.equal(await p.evaluate(() => JSON.stringify(state.mapReturn)), origin);
      await p.evaluate(() => {
        document.dispatchEvent(new CustomEvent('title:start'));
      });
      await p.locator('#revisit-origin').tap();
      assert.equal(await p.evaluate(() => state.pos), 6);
      if ((reviewIndex + 1) % 10 === 0)
        console.log('PASS revisit win/reload/return', reviewIndex + 1);
    }
    assert.deepEqual(errors, []);
    if (process.env.MAP_PROGRESS_REPORT)
      fs.writeFileSync(process.env.MAP_PROGRESS_REPORT, JSON.stringify(report, null, 2));
    console.log(
      'PASS all 30 map links, boss win, single rewards, reload/advance, tour, revisit win/reload/return',
    );
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
