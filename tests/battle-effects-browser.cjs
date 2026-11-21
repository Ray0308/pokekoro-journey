// 演出の発生元・属性・命中時の数値同期・中断掃除を実際の技UIで確認する。
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8850', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const viewport of [
      { width: 390, height: 664 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      const p = await b.newPage({
        viewport,
        hasTouch: true,
        reducedMotion: 'no-preference',
        ignoreHTTPSErrors: true,
      });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8850');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      const setup = () => {
        state.opening.stage = 'complete';
        state.party = [4, 1, 7];
        state.owned = [4, 1, 7];
        document.dispatchEvent(new CustomEvent('title:start'));
        openBattle(false, false);
        $('#encounter').close();
        $('#battle').showModal();
        battle.hp = battle.total = battle.maxHP = 100000;
        updateHP();
        battle.combat.members[0].gauge = PokemonSkillRules.cost(4);
        PokekoroTurns.prepare();
      };
      await p.evaluate(setup);
      const expected = await p.evaluate(() =>
        PokemonSkillRules.attackDamage(battle.combat, battle.combat.members[0], {
          enemy: battle.m,
          enemyHP: battle.hp,
        }),
      );
      await p.locator('[data-battle-member="4"]').tap();
      await p.evaluate(() => {
        let flightReady, labelReady;
        window.fxFlight = new Promise((r) => (flightReady = r));
        window.fxLabel = new Promise((r) => (labelReady = r));
        const observer = new MutationObserver((records) => {
          for (const record of records)
            for (const node of record.addedNodes) {
              if (node.matches?.('.enemy-counter-effect.is-attack')) {
                for (const anim of node.getAnimations()) {
                  anim.pause();
                  anim.currentTime = 160;
                }
                flightReady({
                  kind: node.dataset.kind,
                  status: $('#battle-turn-status').textContent,
                  hp: battle.hp,
                });
              }
              if (node.matches?.('.battle-effect-label')) {
                for (const anim of node.getAnimations()) {
                  anim.pause();
                  anim.currentTime = 150;
                }
                labelReady({ text: node.textContent, hp: battle.hp });
                observer.disconnect();
              }
            }
        });
        observer.observe($('#battle'), { childList: true });
      });
      const casting = p.locator('#turn-use-skill').tap();
      const flight = await p.evaluate(() => window.fxFlight);
      assert.equal(flight.kind, 'flame');
      assert.match(flight.status, /ヒトカゲ.*ひのこ/);
      assert.equal(flight.hp, 100000, 'HP stays until impact');
      if (process.env.FX_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/battle-projectile-${viewport.width}.png` });
      await p.evaluate(() =>
        document
          .querySelector('.enemy-counter-effect.is-attack')
          .getAnimations()
          .forEach((a) => a.play()),
      );
      const hit = await p.evaluate(() => window.fxLabel);
      assert.equal(hit.hp, 100000 - expected, 'HP changes at impact');
      assert.equal(hit.text, '-' + expected.toLocaleString());
      await casting;
      const box = await p.locator('.battle-effect-label').boundingBox();
      assert(box.x >= 0 && box.x + box.width <= viewport.width, 'damage fits viewport');
      if (process.env.FX_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/battle-effects-${viewport.width}.png` });
      await p.evaluate(() =>
        document
          .querySelector('.battle-effect-label')
          .getAnimations()
          .forEach((a) => a.play()),
      );
      await p.waitForFunction(() => battle.phase === 'ready');
      assert.equal(await p.evaluate(() => battle.hp), 100000 - expected, 'damage only once');
      assert.equal(
        await p.locator('.battle-effect-label,.battle-hit-ring,.enemy-counter-effect').count(),
        0,
      );
      await p.evaluate(() => {
        battle.damage = 123;
        battle.typeCharge = { 1: 123 };
        window.groupLabel = new Promise((resolve) => {
          const o = new MutationObserver((rs) => {
            for (const r of rs)
              for (const n of r.addedNodes)
                if (n.matches?.('.battle-effect-label')) {
                  resolve(n.textContent);
                  o.disconnect();
                }
          });
          o.observe($('#battle'), { childList: true });
        });
        window.groupDone = PokekoroTurns.resolve();
      });
      assert.equal(await p.evaluate(() => window.groupLabel), '-123');
      await p.evaluate(() => window.groupDone);
      assert.equal(await p.evaluate(() => battle.hp), 100000 - expected - 123);
      // 盤面操作中には攻撃の輪や大きなポップアップを生成しない。
      assert.equal(
        await p.locator('.battle-effect-label,.battle-hit-ring,.enemy-counter-effect').count(),
        0,
      );
      await p.evaluate(() => {
        window.pendingFX = PokekoroBattleFX.skill({
          category: 'attack',
          type: 6,
          name: 'テスト',
          source: document.querySelector('[data-battle-member="4"]'),
          damage: 999,
          onImpact: () => (window.staleHit = true),
        });
        PokekoroBattleFX.reset();
      });
      await p.evaluate(() => window.pendingFX);
      assert.equal(await p.evaluate(() => !!window.staleHit), false, 'cancelled cast cannot hit');
      assert.equal(
        await p
          .locator(
            '.enemy-skill-effect,.enemy-counter-effect,.battle-effect-label,.battle-hit-ring',
          )
          .count(),
        0,
      );
      assert.deepEqual(errors, []);
      console.log(
        'PASS effect origin, fire shape, HP/number sync, group attack, reset, viewport',
        viewport.width,
      );
      await p.close();
    }
    const p = await b.newPage({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' });
    await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8850');
    await p.waitForFunction(() => $('#boot-screen').hidden);
    const seen = await p.evaluate(async () => {
      state.opening.stage = 'complete';
      state.party = [4, 1, 7];
      document.dispatchEvent(new CustomEvent('title:start'));
      openBattle(false, false);
      $('#encounter').close();
      $('#battle').showModal();
      PokekoroTurns.prepare();
      const kinds = [];
      for (let type = 0; type < 18; type++) {
        const found = new Promise((resolve) => {
          const o = new MutationObserver((rs) => {
            for (const r of rs)
              for (const n of r.addedNodes)
                if (n.matches?.('.enemy-counter-effect.is-attack')) {
                  resolve(n.dataset.kind);
                  o.disconnect();
                }
          });
          o.observe($('#battle'), { childList: true });
        });
        const task = PokekoroBattleFX.skill({
          category: 'attack',
          type,
          source: document.querySelector('[data-battle-member="4"]'),
          damage: 10,
        });
        kinds.push(await found);
        await task;
      }
      return kinds;
    });
    assert.equal(new Set(seen).size, 18);
    assert(!seen.includes(undefined));
    assert.equal(await p.locator('.battle-type-particle').count(), 0);
    console.log('PASS 18 attack kinds and reduced-motion cleanup');
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  server.kill();
});
