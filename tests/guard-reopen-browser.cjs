'use strict';
const assert = require('node:assert/strict'),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8903', '--bind', '127.0.0.1'], {
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
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8903');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        state.party = [247, 366, 7];
        state.owned = [...state.party];
        document.dispatchEvent(new CustomEvent('title:start'));
        openBattle(false, false);
        $('#encounter').close();
        $('#battle').showModal();
        battle.hp = battle.total = 10000;
        battle.combat.turn = 1;
        for (const m of battle.combat.members)
          m.gauge = m.id === 247 ? PokemonSkillRules.cost(m.id) : 0;
        Math.random = () => 0.2;
        PokekoroTurns.prepare(false);
        fitBattle();
      });
      await p.locator('[data-battle-member="247"]').tap();
      await p.locator('#turn-use-skill').tap();
      await p.waitForFunction(() => battle.phase === 'ready');
      assert.equal(await p.evaluate(() => battle.combat.guard), true);
      await p.evaluate(() => {
        BattleTurnRules.begin(battle.combat);
        for (const m of battle.combat.members)
          m.gauge = m.id === 247 || m.id === 366 ? PokemonSkillRules.cost(m.id) : 0;
        PokekoroTurns.prepare(true);
      });
      const before = await p.evaluate(() => JSON.stringify(battle.combat));
      for (const id of [247, 366, 247]) {
        assert.match(await p.locator(`[data-battle-member="${id}"]`).innerText(), /ガード中/);
        assert(
          !(await p.locator(`[data-battle-member="${id}"]`).getAttribute('class')).includes(
            'skill-ready',
          ),
        );
        await p.locator(`[data-battle-member="${id}"]`).tap();
        assert(await p.locator('#turn-actions').isHidden());
        assert.equal(await p.evaluate(() => battle.phase), 'ready');
        assert.equal(await p.evaluate(() => JSON.stringify(battle.combat)), before);
        assert.match(await p.locator('#puzzle-tip').innerText(), /じゅんびずみ/);
      }
      await p.locator('[data-battle-member="7"]').tap();
      assert(await p.locator('#turn-actions').isVisible());
      assert(await p.locator('#turn-next').isEnabled());
      await p.locator('[data-battle-member="247"]').tap();
      assert(await p.locator('#turn-actions').isHidden());
      assert.equal(await p.evaluate(() => JSON.stringify(battle.combat)), before);
      await p.evaluate(() => {
        for (let i = 0; i < 10; i++) {
          document.querySelector('[data-battle-member="247"]').click();
          document.querySelector('[data-battle-member="366"]').click();
        }
      });
      assert.equal(await p.evaluate(() => JSON.stringify(battle.combat)), before);
      await p.screenshot({ path: `/workspace/pupitar-guard-ready-${viewport.width}.png` });
      assert(
        await p.locator('#start').evaluate((n) => {
          const r = n.getBoundingClientRect();
          return (
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          );
        }),
      );
      await p.locator('#start').tap();
      await p.waitForFunction(() => running, { timeout: 10000 });
      assert.equal(await p.evaluate(() => battle.combat.guard), false);
      assert.equal(await p.evaluate(() => battle.combat.members.some((m) => m.fainted)), false);
      assert.equal(await p.evaluate(() => battle.combat.members[0].gauge), 18);
      assert.deepEqual(errors, []);
      console.log(
        'PASS Pupitar/Clamperl active Iron Defense repeat/recharged/rapid tap stays ready, no extra cost, close restored, guard blocks once and puzzle resumes',
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
