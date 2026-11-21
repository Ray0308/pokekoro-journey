const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8874', '--bind', '127.0.0.1'], {
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
    ].filter((v) => !process.env.VISUAL_WIDTH || v.width === Number(process.env.VISUAL_WIDTH))) {
      const p = await b.newPage({ viewport, hasTouch: true, ignoreHTTPSErrors: true });
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8874');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening = { version: 5, stage: 'oakGreeting' };
        document.dispatchEvent(new CustomEvent('title:start'));
      });
      assert.match(
        await p.locator('.opening-oak').evaluate((n) => getComputedStyle(n).animationName),
        /oak-arrive/,
      );
      assert(
        Number(
          await p
            .locator('.opening-message p')
            .evaluate((n) => parseFloat(getComputedStyle(n).fontSize)),
        ) >= 15,
      );
      await p.waitForTimeout(1400);
      if (process.env.VISUAL_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/tutorial-oak-${viewport.width}.png` });
      await p.evaluate(() => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
        state.opening = { version: 5, stage: 'practice', starterId: 1 };
        state.party = [1, 446];
        state.owned = [1, 446];
        PokekoroMockPractice.open();
      });
      assert.equal(await p.locator('.tutorial-hole').count(), 1);
      const hole = await p.locator('.tutorial-hole').boundingBox(),
        canvas = await p.locator('#mock-practice canvas').boundingBox();
      assert(Math.abs(hole.width - canvas.width / 2 - 10) < 1);
      assert(Math.abs(hole.y - canvas.y - canvas.height * 0.4 + 5) < 1);
      assert.equal(
        await p.locator('.tutorial-spotlight').evaluate((n) => getComputedStyle(n).pointerEvents),
        'none',
      );
      if (process.env.VISUAL_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/tutorial-trace-${viewport.width}.png` });
      await p.evaluate(() => {
        const m = MockPracticeRules.create(1);
        m.phase = 'ready';
        m.rounds = 1;
        m.combat.turn = 1;
        m.combat.members[0].gauge = PokemonSkillRules.cost(1);
        state.opening.mockBattle = MockPracticeRules.snapshot(m);
        PokekoroMockPractice.open();
      });
      await p.locator('[data-mock-member="1"]').tap();
      assert(await p.locator('#mock-skill .skill-hero').isVisible());
      const hit = await p.locator('#mock-use').evaluate((n) => {
        const r = n.getBoundingClientRect();
        return (
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
        );
      });
      assert(hit, 'guided skill button visible and hit');
      if (process.env.VISUAL_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/tutorial-skill-${viewport.width}.png` });
      await p.locator('#mock-use').tap();
      await p.waitForFunction(() => PokekoroMockPractice.inspect().phase === 'done');
      await p.evaluate(() => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
        PokekoroTutorialVisuals.hide();
        state.opening = { version: 5, stage: 'diceLesson', starterId: 1 };
        state.mapId = 'viridian';
        state.party = [1, 446, 25];
        state.owned = [1, 446, 25];
        PokekoroPracticeOnboarding.show();
      });
      assert(await p.locator('#map-lesson-guide').isVisible());
      assert.equal(await p.locator('.map-lesson-icons img').count(), 6);
      await p.waitForFunction(() =>
        [...document.querySelectorAll('.map-lesson-icons img')].every(
          (n) => n.complete && n.naturalWidth > 0,
        ),
      );
      assert(
        await p
          .locator('.map-lesson-icons img')
          .evaluateAll((ns) => ns.every((n) => n.complete && n.naturalWidth > 0)),
      );
      if (process.env.VISUAL_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/tutorial-map-${viewport.width}.png` });
      await p.locator('#practice-map-understood').tap();
      await p.waitForSelector('.tutorial-hole');
      assert(await p.locator('.tutorial-hole').isVisible());
      assert(await p.evaluate(() => state.opening.mapIntroSeen));
      await p.evaluate(() => {
        state.opening.stage = 'complete';
        PokekoroTutorialVisuals.hide();
        $('#practice-coach')?.remove();
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
      });
      for (const category of ['attack', 'boost', 'guard', 'board', 'support', 'revive']) {
        const id = await p.evaluate((category) => {
          const mon = POKEDEX.find(
            (m) =>
              ![1, 4, 7].includes(m.id) && PokemonSkillRules.forPokemon(m.id).category === category,
          );
          state.party = [1, 4, 7, mon.id];
          state.owned = [...state.party];
          openBattle(false, false);
          $('#encounter').close();
          $('#battle').showModal();
          if (category === 'revive') {
            battle.combat.members[0].hp = 0;
            battle.combat.members[0].fainted = true;
          }
          battle.combat.members.find((m) => m.id === mon.id).gauge = PokemonSkillRules.cost(mon.id);
          PokekoroTurns.prepare(false);
          return mon.id;
        }, category);
        await p.locator(`[data-battle-member="${id}"]`).tap();
        assert(await p.locator('#turn-actions .skill-hero').isVisible());
        if (process.env.VISUAL_SCREENSHOTS)
          await p.screenshot({
            path: `/workspace/tutorial-normal-${category}-${viewport.width}.png`,
          });
        assert(
          await p.locator('#turn-use-skill').evaluate((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.top >= 0 &&
              r.bottom <= innerHeight &&
              n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
            );
          }),
          category + ' action stays visible',
        );
        if (process.env.VISUAL_SCREENSHOTS && ['attack', 'support'].includes(category))
          await p.screenshot({
            path: `/workspace/tutorial-normal-${category}-${viewport.width}.png`,
          });
        await p.locator('#turn-next').tap();
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS Oak arrival, readable message, trace hole, pass-through touch, rich skill/use and automatic pictorial map guide',
        viewport.width,
      );
      await p.close();
    }
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  server.kill();
  process.exitCode = 1;
});
