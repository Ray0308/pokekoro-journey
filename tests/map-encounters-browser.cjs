// Optional browser integration: every region, actual capture, legacy save and special encounters.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process'),
  assert = require('node:assert/strict');
const server = spawn('python', ['-m', 'http.server', '8845', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    const p = await browser.newPage({
      viewport: { width: 390, height: 664 },
      hasTouch: true,
      reducedMotion: 'reduce',
      ignoreHTTPSErrors: true,
    });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8845');
    await p.waitForFunction(() => $('#boot-screen').hidden);
    await p.evaluate(() => {
      state.opening.stage = 'complete';
      state.party = [1, 4, 7];
      state.owned = [1, 4, 7];
      document.dispatchEvent(new CustomEvent('title:start'));
    });
    const result = await p.evaluate(() => {
      const rand = Math.random;
      const ids = [];
      for (const id of MAP_ORDER) {
        state.mapId = id;
        state.pendingMapId = null;
        state.mapReturn = null;
        state.pos = 1;
        render();
        for (const r of [0, 0.5, 0.999999]) {
          Math.random = () => r;
          const chosen = pickEncounterId();
          if (!MAP_ENCOUNTERS[id].some((x) => x[0] === chosen) || RAINBOW_IDS.includes(chosen))
            throw Error(id);
        }
        openBattle(false, false);
        if (!MAP_ENCOUNTERS[id].some((x) => x[0] === battle.m.id)) throw Error('Battle ' + id);
        ids.push(id);
        battleEpoch++;
        $('#encounter').close();
      }
      Math.random = rand;
      return ids;
    });
    assert.equal(result.length, 30);
    await p.evaluate(() => {
      state.mapId = 'viridian';
      state.pos = 1;
      state.pendingMapId = null;
      state.balls = 10;
      Math.random = () => 0;
      openBattle(false, false);
      $('#encounter').close();
      battle.hp = 0;
      battle.damage = battle.total;
      battle.victory = true;
      battle.roundStarted = true;
      endBattle(true);
    });
    const target = await p.evaluate(() => battle.m.id);
    await p.locator('#normal').tap();
    await p.locator('.swipe-ball').press('Enter');
    await p.waitForSelector('.capture-outcome');
    assert.equal(await p.evaluate(() => state.owned.includes(battle.m.id)), true);
    assert.equal(await p.evaluate(() => state.balls), target === 1 ? 11 : 9);
    await p.locator('#done').tap();
    await p.reload();
    await p.waitForFunction(() => $('#boot-screen').hidden);
    assert.equal(await p.evaluate((id) => state.owned.includes(id), target), true);
    await p.evaluate(() => {
      document.dispatchEvent(new CustomEvent('title:start'));
      state.mapId = 'safari-zone';
      state.pos = 14;
      openBattle(false, true);
    });
    assert([113, 115, 128].includes(await p.evaluate(() => battle.m.id)));
    assert.equal(await p.evaluate(() => battle.safari), true);
    await p.evaluate(() => {
      battleEpoch++;
      $('#encounter').close();
      state.mapId = 'cerulean-cave';
      render();
      openBattle(false, true);
    });
    assert.equal(await p.evaluate(() => battle.m.id), 150);
    assert((await p.locator('#journey-list').textContent()).includes('ミュウツー'));
    assert(!(await p.locator('#journey-list').textContent()).includes('No.0150'));
    assert(
      await p.evaluate(() => {
        const rand = Math.random;
        state.mapId = 'rainbow-cloud';
        for (const r of [0.01, 0.75, 0.99]) {
          Math.random = () => r;
          if (!RAINBOW_IDS.includes(pickEncounterId())) return false;
        }
        Math.random = rand;
        return true;
      }),
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS 30 regions and actual encounters, capture/save/reload, Safari final, Mewtwo label and rainbow routing',
    );
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
