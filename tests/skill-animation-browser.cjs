// 任意のブラウザ検証。実際の技UIから6系統を発動し、待機復帰と演出の掃除を確認する。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('child_process');
const s = spawn('python', ['-m', 'http.server', '8818', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    for (const [category, id] of Object.entries({
      attack: 1,
      guard: 10,
      board: 35,
      support: 113,
      boost: 129,
      revive: 923,
    })) {
      const c = await b.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true });
      const p = await c.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto('http://127.0.0.1:8818');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(
        ({ id, category }) => {
          state.opening.stage = 'complete';
          state.party = [id, ...[4, 7, 25, 446, 32].filter((n) => n !== id)];
          document.dispatchEvent(new CustomEvent('title:start'));
          openBattle(false, false);
          $('#encounter').close();
          $('#battle').showModal();
          battle.hp = 10000;
          battle.maxHP = 10000;
          const m = battle.combat.members.find((m) => m.id === id);
          m.gauge = PokemonSkillRules.cost(id);
          if (category === 'revive') battle.combat.members.find((m) => m.id !== id).fainted = true;
          PokekoroTurns.prepare();
        },
        { id, category },
      );
      await p.click(`[data-battle-member="${id}"]`);
      await p.click('#turn-use-skill');
      await p.waitForSelector('.enemy-skill-effect');
      if (category === 'board') {
        await p.waitForSelector('.skill-cell');
        if (
          (await p.locator('#board').evaluate((n) => getComputedStyle(n).visibility)) !== 'visible'
        )
          throw Error('board hidden');
      }
      await p.waitForFunction(() => battle.phase === 'ready');
      if (await p.locator('.enemy-skill-effect').count()) throw Error('effect leak');
      if (errors.length) throw Error(errors.join());
      console.log('PASS', category);
      await c.close();
    }
  } finally {
    await b.close();
    s.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
