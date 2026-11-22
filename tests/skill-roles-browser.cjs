'use strict';
const assert = require('node:assert/strict'),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8895', '--bind', '127.0.0.1'], {
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
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8895');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [19, 130, 43, 153, 181, 242];
        state.owned = [...state.party];
        document.dispatchEvent(new CustomEvent('title:start'));
        showTab('party');
        renderDex();
      });
      assert.equal(await p.locator('#party .pokemon-role').count(), 6);
      await p.screenshot({ path: `/workspace/skill-roles-party-${viewport.width}.png` });
      for (const [id, role] of [
        [43, '攻撃＆ゲージ支援'],
        [153, '防御＆強化'],
        [242, '全体ゲージ支援'],
      ]) {
        await p.evaluate((id) => {
          for (const d of document.querySelectorAll('dialog[open]')) d.close();
          busy = false;
          state.party = [id, 1, 7, 6, 446, 923];
          state.owned = [...state.party];
          openBattle(false, false);
          $('#encounter').close();
          $('#battle').showModal();
          battle.hp = battle.total = 10000;
          battle.m = { ...POKEDEX[55], types: [], type: null };
          battle.combat.turn = 1;
          for (const m of battle.combat.members)
            m.gauge = m.id === id ? PokemonSkillRules.cost(id) : 0;
          PokekoroTurns.prepare(false);
          updateHP();
          fitBattle();
        }, id);
        await p.locator(`[data-battle-member="${id}"]`).tap();
        assert.match(await p.locator('.skill-summary').innerText(), new RegExp(role));
        assert(
          await p.locator('#turn-use-skill').evaluate((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.top >= 0 &&
              r.bottom <= innerHeight &&
              n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
            );
          }),
        );
        await p.screenshot({ path: `/workspace/skill-role-${id}-${viewport.width}.png` });
        await p.locator('#turn-use-skill').tap();
        await p.waitForFunction(() => battle.phase === 'ready');
        const stateAfter = await p.evaluate(() => ({
          hp: battle.hp,
          guard: battle.combat.guard,
          boost: battle.combat.nextBoost,
          gauges: battle.combat.members.map((m) => m.gauge),
        }));
        assert.equal(stateAfter.gauges[0], 0);
        if (id === 43) {
          assert(stateAfter.hp < 10000);
          assert.equal(stateAfter.gauges[1], 1);
        }
        if (id === 153) {
          assert(stateAfter.guard);
          assert.equal(stateAfter.boost, 1.25);
        }
        if (id === 242) {
          assert(stateAfter.gauges.slice(1).every((v) => v === 3));
          assert.equal(stateAfter.hp, 10000);
        }
        await p.locator(`[data-battle-member="${id}"]`).tap();
        assert(await p.locator('#turn-use-skill').isDisabled());
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS visible team/skill roles, real drain+charge, guard+boost, all-ally support, once-only tap and bounded actions',
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
