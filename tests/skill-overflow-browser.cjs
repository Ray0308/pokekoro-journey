'use strict';
const assert = require('node:assert/strict'),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8900', '--bind', '127.0.0.1'], {
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
      { width: 393, height: 852 },
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
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8900');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      for (const id of [446, 144, 113]) {
        await p.evaluate((id) => {
          for (const d of document.querySelectorAll('dialog[open]')) d.close();
          state.opening.stage = 'complete';
          state.party = [id, ...[4, 7, 25, 32, 1].filter((n) => n !== id)];
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
        }, id);
        await p.locator(`[data-battle-member="${id}"]`).tap();
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
        const inspect = () =>
          p.locator('.turn-skill-description').evaluate((n) => {
            const body = n.closest('.turn-skill-body'),
              r = n.getBoundingClientRect(),
              b = body.getBoundingClientRect(),
              footer = document.querySelector('.turn-skill-footer').getBoundingClientRect();
            return {
              full: r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.bottom <= footer.top + 1,
              height: r.height,
              scroll: n.scrollHeight,
              client: n.clientHeight,
              bodyScroll: body.scrollHeight,
              bodyClient: body.clientHeight,
            };
          });
        let rect = await inspect();
        if (viewport.height >= 800 && id === 446)
          assert(rect.full, 'stockpile description fully visible on iPhone viewport');
        assert(rect.client >= rect.scroll - 1, 'description must not shrink/clip internally');
        if (!rect.full) {
          await p.locator('.turn-skill-body').evaluate((n) => (n.scrollTop = n.scrollHeight));
          rect = await inspect();
          assert(rect.full, 'full description reachable above footer by scrolling body');
        }
        await p.screenshot({ path: `/workspace/skill-overflow-${id}-${viewport.width}.png` });
        await p.locator('#turn-next').tap();
        await p.locator(`[data-battle-member="${id}"]`).tap();
        assert.equal(await p.locator('.turn-skill-body').evaluate((n) => n.scrollTop), 0);
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS stockpile/risky/targeted descriptions unshrunk and readable above fixed touch footer, reopen resets scroll',
        viewport.width,
        viewport.height,
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
