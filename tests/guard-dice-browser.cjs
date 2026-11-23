'use strict';
const assert = require('node:assert/strict'),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8901', '--bind', '127.0.0.1'], {
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
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8901');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      for (const [id, face] of [
        [153, 1],
        [153, 2],
        [181, 5],
        [181, 6],
      ]) {
        await p.evaluate(
          ({ id, face }) => {
            for (const d of document.querySelectorAll('dialog[open]')) d.close();
            state.opening.stage = 'complete';
            state.party = [id, 1, 7, 446];
            state.owned = [...state.party];
            document.dispatchEvent(new CustomEvent('title:start'));
            busy = false;
            openBattle(false, false);
            $('#encounter').close();
            $('#battle').showModal();
            battle.hp = battle.total = 10000;
            battle.combat.turn = 1;
            for (const m of battle.combat.members)
              m.gauge = m.id === id ? PokemonSkillRules.cost(id) : 0;
            PokekoroTurns.prepare(false);
            fitBattle();
            window.guardOldRng = Math.random;
            Math.random = () => (face - 0.5) / 6;
            window.guardOldFx = PokekoroBattleFX;
            window.guardFxCalls = 0;
            window.PokekoroBattleFX = {
              ...guardOldFx,
              skill: async (...args) => {
                window.guardFxCalls++;
                return guardOldFx.skill(...args);
              },
            };
          },
          { id, face },
        );
        await p.locator(`[data-battle-member="${id}"]`).tap();
        assert.match(await p.locator('#turn-use-skill').innerText(), /ゲージ20.*偶数/);
        assert.match(await p.locator('.turn-skill-description').innerText(), /1・3・5/);
        await p.locator('#turn-use-skill').tap();
        await p.waitForSelector(
          `.skill-dice-reveal[data-result="${face % 2 ? 'guard-failed' : 'guard'}"]`,
        );
        assert.match(
          await p.locator('.skill-dice-reveal').innerText(),
          face % 2 ? /まもり失敗/ : /まもり成功/,
        );
        await p.screenshot({ path: `/workspace/guard-${id}-${face}-${viewport.width}.png` });
        await p.waitForFunction(() => battle.phase === 'ready');
        const outcome = await p.evaluate(() => ({
          guard: battle.combat.guard,
          boost: battle.combat.nextBoost,
          gauges: battle.combat.members.map((m) => m.gauge),
          fx: window.guardFxCalls,
          hp: battle.hp,
        }));
        assert.equal(outcome.guard, face % 2 === 0);
        assert.equal(outcome.gauges[0], 0);
        assert.equal(outcome.hp, 10000);
        assert.equal(outcome.fx, face % 2 ? 0 : 1);
        assert.equal(outcome.boost, id === 153 && face % 2 === 0 ? 1.25 : 1);
        assert.equal(outcome.gauges[1], id === 181 && face % 2 === 0 ? 2 : 0);
        await p.locator(`[data-battle-member="${id}"]`).tap();
        assert(await p.locator('#turn-use-skill').isDisabled());
        await p.evaluate(() => {
          Math.random = guardOldRng;
          window.PokekoroBattleFX = guardOldFx;
        });
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS real odd/even guard dice, 20-gauge cost, failed composite no bonuses/no FX, success shield+boost/charge, once-only',
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
