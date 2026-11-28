'use strict';
// ページを離れた時間はパズル・開始カウントに含めない。再開は必ず明示操作。
(() => {
  const adapters = [];
  const delays = new Set();
  let session = null;
  const dialog = document.createElement('dialog');
  dialog.id = 'battle-pause';
  dialog.setAttribute('aria-labelledby', 'battle-pause-title');
  dialog.innerHTML =
    '<h2 id="battle-pause-title">ひとやすみ中</h2><p>パズルは とまっているよ。<br>準備ができたら つづけよう！</p><button class="primary">▶ つづける</button>';
  document.body.append(dialog);
  dialog.addEventListener('cancel', (e) => e.preventDefault());
  function delay(ms) {
    return new Promise((resolve) => {
      let remaining = ms,
        started = 0,
        timer;
      const item = {
        stop() {
          clearTimeout(timer);
          if (started) remaining = Math.max(0, remaining - (performance.now() - started));
          started = 0;
        },
        run() {
          started = performance.now();
          timer = setTimeout(() => {
            delays.delete(item);
            resolve();
          }, remaining);
        },
      };
      delays.add(item);
      if (!session) item.run();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || session) return;
    const adapter = adapters.find((a) => a.active());
    if (!adapter) return;
    session = { adapter, started: performance.now(), snapshot: adapter.pause() };
    for (const item of delays) item.stop();
    dialog.showModal();
  });
  dialog.querySelector('button').onclick = () => {
    if (document.hidden || !session) return;
    const saved = session;
    session = null;
    dialog.close();
    saved.adapter.resume(saved.snapshot, performance.now() - saved.started);
    for (const item of delays) item.run();
  };
  window.PokekoroBattlePause = {
    register: (adapter) => adapters.push(adapter),
    delay,
    get paused() {
      return !!session;
    },
  };
})();
