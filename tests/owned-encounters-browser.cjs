'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8893', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    const p = await browser.newPage({ ignoreHTTPSErrors: true });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8893');
    await p.waitForFunction(() => $('#boot-screen').hidden);
    const result = await p.evaluate(() => {
      const rng = Math.random;
      let checked = 0;
      try {
        for (const mapId of MAP_ORDER) {
          state.mapId = mapId;
          const pool = MAP_ENCOUNTERS[mapId];
          state.owned = pool.filter((_, i) => i % 2 === 0).map(([id]) => id);
          for (let i = 0; i < 100; i++) {
            Math.random = () => i / 100;
            const expected = chooseMapEncounter(mapId, Math.random, state.owned);
            if (pickEncounterId() !== expected) throw Error('ownership not used ' + mapId);
            checked++;
          }
        }
        state.mapId = 'viridian';
        state.party = [1, 4, 7];
        state.owned = [1, 4, 7, 25];
        state.opening.stage = 'complete';
        save();
        state.mapId = RAINBOW_CONFIG.mapId;
        Math.random = () => 0;
        const cloud = pickEncounterId();
        state.owned = [...RAINBOW_IDS];
        const after = pickEncounterId();
        if (cloud !== after) throw Error('rainbow changed');
        state.mapId = 'viridian';
        state.owned = [1, 4, 7, 25];
        save();
        return checked;
      } finally {
        Math.random = rng;
      }
    });
    assert.equal(result, 3000);
    await p.reload();
    await p.waitForFunction(() => $('#boot-screen').hidden);
    assert.deepEqual(await p.evaluate(() => state.owned), [1, 4, 7, 25]);
    assert(
      await p.evaluate(() => {
        for (let i = 0; i < 100; i++) {
          const rng = () => i / 100;
          if (
            pickEncounterId === null ||
            !MAP_ENCOUNTERS.viridian.some(
              ([id]) => id === chooseMapEncounter('viridian', rng, state.owned),
            )
          )
            return false;
        }
        return true;
      }),
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS app uses current ownership on all30 maps including Safari, rainbow unchanged, ownership survives reload',
    );
    await p.close();
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
