'use strict';
const assert = require('node:assert/strict'),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process');
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
      const p = await browser.newPage({
          viewport,
          hasTouch: true,
          ignoreHTTPSErrors: true,
          reducedMotion: 'reduce',
        }),
        errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8897');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      for (const [id, face, result] of [
        [2, 5, 'critical'],
        [144, 2, 'miss'],
        [144, 3, 'hit'],
      ]) {
        const expected = await p.evaluate(
          ({ id, face }) => {
            for (const d of document.querySelectorAll('dialog[open]')) d.close();
            state.opening.stage = 'complete';
            state.party = [id, 7, 446];
            state.owned = [...state.party];
            busy = false;
            document.dispatchEvent(new CustomEvent('title:start'));
            openBattle(false, false);
            $('#encounter').close();
            $('#battle').showModal();
            battle.hp = battle.total = 10000;
            battle.m = { ...POKEDEX[55], type: null, types: [] };
            battle.combat.turn = 1;
            battle.combat.members[0].gauge = PokemonSkillRules.cost(id);
            PokekoroTurns.prepare(false);
            updateHP();
            fitBattle();
            window.accuracyRandom = Math.random;
            Math.random = () => (face - 0.5) / 6;
            window.accuracyFX = window.PokekoroBattleFX;
            window.accuracyHits = 0;
            window.PokekoroBattleFX = {
              ...accuracyFX,
              skill: async (...args) => {
                window.accuracyHits++;
                return accuracyFX.skill(...args);
              },
            };
            return PokemonSkillRules.attackDamage(battle.combat, battle.combat.members[0], {
              enemy: battle.m,
              enemyHP: battle.hp,
              diceFace: face,
            });
          },
          { id, face },
        );
        await p.locator(`[data-battle-member="${id}"]`).tap();
        assert.match(await p.locator('#turn-use-skill').innerText(), /〜/);
        assert.match(
          await p.locator('.turn-skill-description').innerText(),
          id === 2 ? /5・6/ : /1・2/,
        );
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
        await p.waitForSelector(`.skill-dice-reveal[data-result="${result}"]`);
        assert.match(
          await p.locator('.skill-dice-reveal').innerText(),
          result === 'critical' ? /1.3倍/ : result === 'miss' ? /0ダメージ/ : /命中/,
        );
        assert.equal(await p.evaluate(() => battle.hp), 10000);
        await p.screenshot({ path: `/workspace/accuracy-${result}-${viewport.width}.png` });
        await p.waitForFunction(() => battle.phase === 'ready');
        assert.equal(await p.evaluate(() => battle.hp), 10000 - expected);
        assert.equal(await p.evaluate(() => battle.combat.members[0].gauge), 0);
        assert.equal(await p.evaluate(() => window.accuracyHits), result === 'miss' ? 0 : 1);
        if (result === 'miss') assert.equal(await p.evaluate(() => battle.attackTotal), 0);
        await p.locator(`[data-battle-member="${id}"]`).tap();
        assert(await p.locator('#turn-use-skill').isDisabled());
        await p.evaluate(() => {
          Math.random = window.accuracyRandom;
          window.PokekoroBattleFX = window.accuracyFX;
        });
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS visible critical/miss/hit dice, HP timing, exact damage, miss spends gauge without hit FX, once-only use',
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
