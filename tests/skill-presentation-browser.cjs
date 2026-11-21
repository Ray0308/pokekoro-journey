'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8878', '--bind', '127.0.0.1'], {
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
      const p = await browser.newPage({ viewport, hasTouch: true, ignoreHTTPSErrors: true });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8878');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      const before = await p.evaluate(() => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
        state.opening.stage = 'complete';
        state.party = [32, 7, 4];
        state.owned = [32, 7, 4];
        document.dispatchEvent(new CustomEvent('title:start'));
        openBattle(false, false);
        $('#encounter').close();
        $('#battle').showModal();
        battle.m = { ...POKEDEX[55] };
        $('#enemyname').textContent = battle.m.label;
        $('#enemyimg').src = pokemonPortrait(battle.m.id);
        $('#enemyimg').alt = battle.m.label;
        battle.hp = battle.total = 2000;
        battle.combat.turn = 1;
        battle.combat.members[0].gauge = PokemonSkillRules.cost(32);
        PokekoroTurns.prepare(false);
        updateHP();
        return {
          hp: battle.hp,
          damage: BattleTurnRules.attackDamage(32, battle.m, battle.combat, battle.hp),
        };
      });
      await p.locator('[data-battle-member="32"]').tap();
      assert.equal(await p.locator('.skill-actor img').getAttribute('alt'), 'ニドラン♂');
      assert.equal(await p.locator('.skill-recipient img').getAttribute('alt'), 'マンキー');
      assert(
        await p
          .locator('.skill-actor img')
          .evaluate((n) => n.getBoundingClientRect().height >= 100),
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
      await p.screenshot({ path: `/workspace/skill-nidoran-${viewport.width}.png` });
      await p.locator('#turn-use-skill').tap();
      await p.waitForFunction(() => battle.phase === 'skill-animation');
      assert(
        await p.locator('.skill-actor img').evaluate((n) => n.getAnimations().length > 0),
        'the acting Pokemon moves',
      );
      await p.waitForFunction(() => battle.phase === 'ready');
      assert.equal(
        await p.evaluate(() => battle.hp),
        before.hp - before.damage,
        'one damage application',
      );
      await p.locator('[data-battle-member="32"]').tap();
      assert.equal(await p.locator('.skill-hero').getAttribute('data-status'), 'used');
      assert(await p.locator('#turn-use-skill').isDisabled());
      assert.match(await p.locator('#turn-use-skill').innerText(), /つかったよ/);
      assert.doesNotMatch(await p.locator('#turn-use-skill').innerText(), /ダメージ/);
      await p.screenshot({ path: `/workspace/skill-nidoran-used-${viewport.width}.png` });
      assert.equal(await p.locator('.skill-performer').count(), 0);
      assert.deepEqual(errors, []);
      console.log(
        'PASS pictured actor/target, visible touch action, actor motion, damage once, clear used state',
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
