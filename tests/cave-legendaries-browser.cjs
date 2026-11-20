const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process'),
  assert = require('node:assert/strict');
const server = spawn('python', ['-m', 'http.server', '8846', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const p = await b.newPage({
      viewport: { width: 390, height: 664 },
      reducedMotion: 'reduce',
      ignoreHTTPSErrors: true,
    });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8846');
    await p.waitForFunction(() => $('#boot-screen').hidden);
    await p.evaluate(() => {
      state.opening.stage = 'complete';
      state.party = [1, 4, 7];
      state.owned = [1, 4, 7];
      state.mapId = 'cerulean-cave';
      state.pos = 14;
      state.master = 4;
      state.balls = 10;
      state.pendingMapId = null;
      state.mapReturn = null;
      state.caveBossId = null;
      document.dispatchEvent(new CustomEvent('title:start'));
      render();
      openBattle(false, true);
      $('#encounter').close();
    });
    assert.equal(await p.evaluate(() => battle.m.id), 150);
    await p.evaluate(() => {
      battle.hp = 0;
      battle.damage = battle.total;
      battle.victory = true;
      endBattle(true);
    });
    await p.locator('#master').click();
    await p.locator('.swipe-ball').press('Enter');
    await p.waitForSelector('.capture-outcome');
    assert.equal(await p.evaluate(() => state.owned.includes(150)), true);
    const target = await p.evaluate(() => state.caveBossId);
    assert(await p.evaluate((id) => CAVE_LEGENDARY_IDS.includes(id), target));
    await p.locator('#done').click();
    await p.evaluate(() => {
      state.mapId = 'cerulean-cave';
      state.pos = 14;
      state.pendingMapId = null;
      state.mapReturn = null;
      render();
    });
    assert.equal(await p.evaluate(() => activeBossId()), target);
    assert(
      (await p.locator('#journey-list').textContent()).includes(
        await p.evaluate((id) => mons[id - 1].label, target),
      ),
    );
    assert(
      (await p.locator('.node-goal .boss-portrait img').getAttribute('src')).includes(
        String(target),
      ) ||
        (await p.evaluate(
          () =>
            $('#route .node-goal .boss-portrait img').src ===
            new URL(pokemonPortrait(activeBossId()), location.href).href,
        )),
    );
    await p.reload();
    await p.waitForFunction(() => $('#boot-screen').hidden);
    await p.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
    assert.equal(await p.evaluate(() => activeBossId()), target);
    await p.evaluate(() => {
      openBattle(false, true);
      $('#encounter').close();
      battle.hp = 0;
      battle.victory = true;
      endBattle(true);
      Math.random = () => 0.999999;
    });
    await p.locator('#normal').click();
    await p.locator('.swipe-ball').press('Enter');
    await p.waitForSelector('.capture-outcome[data-outcome="miss"]');
    assert.equal(await p.evaluate(() => state.caveBossId), target);
    await p.locator('#done').click();
    await p.evaluate(() => {
      state.mapId = 'cerulean-cave';
      state.pendingMapId = null;
      state.pos = 14;
      render();
      openBattle(false, true);
      $('#encounter').close();
      battle.hp = 0;
      battle.victory = true;
      endBattle(true);
    });
    assert.equal(await p.evaluate(() => battle.m.id), target);
    await p.locator('#master').click();
    await p.locator('.swipe-ball').press('Enter');
    await p.waitForSelector('.capture-outcome');
    assert.equal(await p.evaluate((id) => state.owned.includes(id), target), true);
    assert.notEqual(await p.evaluate(() => state.caveBossId), target);
    assert.notEqual(await p.evaluate(() => state.caveBossId), 150);
    assert.deepEqual(errors, []);
    console.log(
      'PASS actual Mewtwo capture -> other legendary, map/roster match, reload, failed capture retains target, next successful capture rotates',
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
