'use strict';
const assert = require('node:assert/strict'),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8896', '--bind', '127.0.0.1'], {
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
      const p = await browser.newPage({
          viewport,
          hasTouch: true,
          ignoreHTTPSErrors: true,
          reducedMotion: viewport.width === 390 ? 'no-preference' : 'reduce',
        }),
        errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8896');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [135, 1, 7];
        state.owned = [...state.party];
        document.dispatchEvent(new CustomEvent('title:start'));
        openBattle(false, false);
        $('#encounter').close();
        $('#battle').showModal();
        battle.hp = battle.total = 10000;
        battle.m = { ...POKEDEX[55], type: null, types: [] };
        battle.combat.turn = 1;
        battle.combat.members[0].gauge = PokemonSkillRules.cost(135);
        PokekoroTurns.prepare(false);
        updateHP();
        fitBattle();
      });
      await p.locator('[data-battle-member="135"]').tap();
      assert.match(await p.locator('#turn-use-skill').innerText(), /〜/);
      assert.match(await p.locator('.skill-summary').innerText(), /サイコロ/);
      const expected = await p.evaluate(() => {
        window.diceTestRandom = Math.random;
        Math.random = () => 0.99;
        return PokemonSkillRules.damageRange(battle.combat, 135, {
          enemy: battle.m,
          enemyHP: battle.hp,
        })[1];
      });
      await p.locator('#turn-next').tap();
      await p.locator('[data-battle-member="135"]').tap();
      assert.equal(await p.locator('.skill-dice-reveal').count(), 0);
      await p.screenshot({ path: `/workspace/dice-preview-${viewport.width}.png` });
      assert(
        await p.locator('#turn-use-skill').evaluate((n) => {
          const r = n.getBoundingClientRect();
          return (
            r.bottom <= innerHeight &&
            n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          );
        }),
      );
      await p.locator('#turn-use-skill').tap();
      await p.waitForSelector('.skill-dice-reveal[data-face="6"]');
      assert.match(await p.locator('.skill-dice-reveal').innerText(), /威力14倍/);
      assert.equal(await p.evaluate(() => battle.hp), 10000);
      assert(await p.locator('#turn-use-skill').isDisabled());
      await p.screenshot({ path: `/workspace/dice-skill-${viewport.width}.png` });
      await p.waitForFunction(() => battle.phase === 'ready');
      assert.equal(await p.evaluate(() => battle.hp), 10000 - expected);
      assert.equal(await p.evaluate(() => battle.combat.members[0].gauge), 0);
      assert.equal(await p.locator('.skill-dice-reveal').count(), 0);
      await p.locator('[data-battle-member="135"]').tap();
      assert(await p.locator('#turn-use-skill').isDisabled());
      await p.evaluate(() => {
        Math.random = window.diceTestRandom;
      });
      assert.deepEqual(errors, []);
      console.log(
        'PASS range preview, reopen without roll, one visible d6=6 and x14, HP waits, one exact hit and gauge consumption',
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
