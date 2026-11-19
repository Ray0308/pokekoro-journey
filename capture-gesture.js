'use strict';
// 投球ジェスチャーだけを扱う。在庫・成功率・捕獲結果は既存の捕獲処理が確定する。
window.PokekoroCaptureGesture = (() => {
  let active = null;
  function open({ host, body, ball, mon, onThrow, onCancel = () => {} }) {
    if (active) return false;
    const previous = [...body.childNodes];
    const ui = document.createElement('section');
    ui.id = 'capture-gesture';
    ui.innerHTML =
      '<h2>ボールを なげよう！</h2><p class="swipe-help" role="status">ボールを 上へ スワイプ！</p><div class="swipe-field"><img class="swipe-target" alt=""><span class="swipe-arrow" aria-hidden="true">↑</span><button class="swipe-ball" type="button" aria-keyshortcuts="Enter Space"><img alt=""></button></div><p class="swipe-ball-name"></p><button class="swipe-back" type="button">ボールを えらびなおす</button>';
    ui.querySelector('.swipe-target').src = pokemonPortrait(mon.id);
    ui.querySelector('.swipe-target').alt = mon.label;
    const handle = ui.querySelector('.swipe-ball'),
      help = ui.querySelector('.swipe-help');
    handle.querySelector('img').src = ball.image;
    handle.setAttribute('aria-label', ball.name + 'を上へスワイプ、またはEnterキーで投げる');
    ui.querySelector('.swipe-ball-name').textContent = ball.name;
    body.replaceChildren(ui);
    let hold = null,
      settled = false;
    function release() {
      if (hold && handle.hasPointerCapture?.(hold.id)) handle.releasePointerCapture(hold.id);
      hold = null;
      handle.style.translate = '';
      handle.classList.remove('dragging');
    }
    function clean() {
      release();
      host.removeEventListener('cancel', cancelEvent);
      host.removeEventListener('close', closeEvent);
      document.removeEventListener('visibilitychange', hidden);
      active = null;
    }
    function cancel() {
      if (settled) return;
      settled = true;
      clean();
      body.replaceChildren(...previous);
      onCancel();
    }
    function cancelEvent(event) {
      event.preventDefault();
      cancel();
    }
    function closeEvent() {
      cancel();
    }
    function hidden() {
      if (document.hidden) release();
    }
    function launch() {
      if (settled || !host.open) return;
      settled = true;
      clean();
      handle.disabled = true;
      onThrow();
    }
    handle.onpointerdown = (event) => {
      if (hold || !event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      hold = { id: event.pointerId, x: event.clientX, y: event.clientY };
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('dragging');
    };
    handle.onpointermove = (event) => {
      if (!hold || hold.id !== event.pointerId) return;
      event.preventDefault();
      handle.style.translate = `${Math.max(-90, Math.min(90, event.clientX - hold.x))}px ${Math.max(-180, Math.min(25, event.clientY - hold.y))}px`;
    };
    handle.onpointerup = (event) => {
      if (!hold || hold.id !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - hold.x,
        up = hold.y - event.clientY;
      release();
      if (up >= 40 && up >= Math.abs(dx) * 0.65) launch();
      else help.textContent = 'ボールを おして、上へ なぞって はなそう！';
    };
    handle.onpointercancel = release;
    handle.onlostpointercapture = () => {
      if (hold) release();
    };
    handle.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) launch();
      }
    };
    ui.querySelector('.swipe-back').onclick = cancel;
    host.addEventListener('cancel', cancelEvent);
    host.addEventListener('close', closeEvent);
    document.addEventListener('visibilitychange', hidden);
    active = { cancel };
    handle.focus({ preventScroll: true });
    return true;
  }
  return Object.freeze({ open });
})();
