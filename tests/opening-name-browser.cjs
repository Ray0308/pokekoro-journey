const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const server = spawn('python', ['-m', 'http.server', '8854', '--bind', '127.0.0.1'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'ignore',
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [];
  try {
    for (const viewport of [
      { width: 390, height: 664 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      const p = await b.newPage({
        viewport,
        hasTouch: true,
        reducedMotion: 'reduce',
        ignoreHTTPSErrors: true,
      });
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8854');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      assert.deepEqual(await p.evaluate(() => state.party), []);
      await p.evaluate(() => {
        state.opening.stage = 'nameChoice';
        document.dispatchEvent(new CustomEvent('title:start'));
      });
      assert.deepEqual(await p.locator('[data-name-choice]').allTextContents(), [
        'じぶんできめる',
        'グリーン',
        'レッド',
        'レン',
      ]);
      if (process.env.NAME_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/name-choices-${viewport.width}.png` });
      await p.locator('[data-name-choice="0"]').tap();
      assert.equal(await p.locator('#opening input').count(), 0, 'No native mobile keyboard');
      await p.locator('#opening-name-done').tap();
      assert(await p.locator('#opening-name-error').isVisible());
      await p.locator('[data-name-char="カ"]').tap();
      await p.locator('[data-mark="゛"]').tap();
      await p.locator('[data-name-char="ハ"]').tap();
      await p.locator('[data-mark="゜"]').tap();
      assert.equal(await p.evaluate(() => state.opening.nameDraft), 'ガパ');
      await p.locator('#opening-name-delete').tap();
      await p.locator('[data-name-mode="hiragana"]').tap();
      await p.locator('[data-name-char="れ"]').tap();
      await p.locator('[data-name-mode="latin"]').tap();
      await p.locator('[data-name-char="7"]').tap();
      assert.equal(await p.evaluate(() => state.opening.nameDraft), 'ガれ7');
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      assert.equal(await p.evaluate(() => state.opening.stage), 'nameInput');
      assert.equal(await p.evaluate(() => state.opening.nameDraft), 'ガれ7');
      assert.deepEqual(
        await p.evaluate(() => state.party),
        [],
        'Empty party save resumes before invitation',
      );
      await p.evaluate(() => document.dispatchEvent(new CustomEvent('title:start')));
      for (let i = 0; i < 3; i++) await p.locator('#opening-name-delete').tap();
      await p.locator('[data-name-mode="katakana"]').tap();
      await p.locator('[data-name-char="レ"]').tap();
      await p.locator('[data-name-char="ン"]').tap();
      await p.locator('[data-name-char="ア"]').focus();
      await p.keyboard.press('ArrowRight');
      await p.keyboard.press('Enter');
      assert.equal(await p.evaluate(() => state.opening.nameDraft), 'レンカ');
      await p.locator('#opening-name-delete').tap();
      if (process.env.NAME_SCREENSHOTS)
        await p.screenshot({ path: `/workspace/name-keyboard-${viewport.width}.png` });
      const layout = await p.evaluate(() => {
        const f = $('#opening-name-form'),
          g = $('.name-characters');
        return {
          overflow: f.scrollWidth > f.clientWidth + 1,
          columns: getComputedStyle(g).gridTemplateColumns.split(' ').length,
        };
      });
      assert.equal(layout.columns, 10);
      assert.equal(layout.overflow, false);
      if (viewport.width >= 600)
        assert(
          await p.evaluate(() => $('#opening-name').getBoundingClientRect().top >= 0),
          'Name stays visible in landscape',
        );
      await p.locator('#opening-name-done').tap();
      assert.match(await p.locator('.opening-message').innerText(), /レン/);
      await p.locator('#opening-name-no').tap();
      assert.equal(await p.evaluate(() => state.opening.nameDraft), 'レン');
      await p.locator('#opening-name-done').tap();
      await p.locator('#opening-name-yes').tap();
      assert.equal(await p.evaluate(() => state.playerName), 'レン');
      for (
        let i = 0;
        i < 8 && (await p.evaluate(() => state.opening.stage)) !== 'companionInvite';
        i++
      )
        await p.locator('#opening-next').tap();
      assert.equal(await p.evaluate(() => state.opening.stage), 'companionInvite');
      assert.deepEqual(await p.evaluate(() => state.owned), []);
      assert.equal(await p.locator('.opening-snack').count(), 0);
      await p.locator('#opening-invite').tap();
      assert.deepEqual(await p.evaluate(() => state.party), [446]);
      await p.reload();
      await p.waitForFunction(() => $('#boot-screen').hidden);
      assert.equal(await p.evaluate(() => state.opening.stage), 'nameGift');
      assert.deepEqual(await p.evaluate(() => state.owned), [446]);
      await p.close();
      console.log(
        'PASS custom panel, edits, arrows, save/resume, explicit invitation',
        viewport.width,
      );
    }
    for (const [index, name] of [
      [1, 'グリーン'],
      [2, 'レッド'],
      [3, 'レン'],
    ]) {
      const p = await b.newPage({ ignoreHTTPSErrors: true });
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(process.env.PUBLIC_URL || 'http://127.0.0.1:8854');
      await p.waitForFunction(() => $('#boot-screen').hidden);
      await p.evaluate(() => {
        state.opening.stage = 'nameChoice';
        document.dispatchEvent(new CustomEvent('title:start'));
      });
      await p.locator(`[data-name-choice="${index}"]`).click();
      await p.locator('#opening-name-no').click();
      assert.equal(await p.evaluate(() => state.opening.stage), 'nameChoice');
      await p.locator(`[data-name-choice="${index}"]`).click();
      await p.locator('#opening-name-yes').click();
      assert.equal(await p.evaluate(() => state.playerName), name);
      await p.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS all preset names, confirmation retry and no JS errors');
  } finally {
    await b.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  server.kill();
});
