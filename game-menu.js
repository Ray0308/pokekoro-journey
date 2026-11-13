'use strict';
// メニューは進行状態を変えず、各画面への入口として使う。
(() => {
  const toggle = document.querySelector('#game-menu-toggle'),
    menu = document.querySelector('#game-menu'),
    bag = document.querySelector('#item-bag');
  function position() {
    const rect = toggle.getBoundingClientRect();
    menu.style.top = Math.max(8, rect.bottom + 6) + 'px';
    menu.style.maxHeight =
      Math.max(120, (window.visualViewport?.height || innerHeight) - rect.bottom - 18) + 'px';
  }
  function close(feedback = true) {
    if (feedback) window.PokekoroSfx?.play('menuClose');
    menu.close();
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.onclick = () => {
    if (menu.open) {
      close();
      return;
    }
    if (busy || capturePending) return;
    position();
    menu.showModal();
    window.PokekoroSfx?.play('menuOpen');
    toggle.setAttribute('aria-expanded', 'true');
  };
  menu.addEventListener('close', () => toggle.setAttribute('aria-expanded', 'false'));
  menu.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  menu.addEventListener('click', (event) => {
    const rect = menu.getBoundingClientRect();
    if (
      event.target === menu &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      close();
  });
  menu.addEventListener('keydown', (event) => {
    const items = [...menu.querySelectorAll('[role="menuitem"]')],
      index = items.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index + items.length - 1) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    items[next].focus();
  });
  function showBag() {
    document.querySelector('#item-bag-list').innerHTML = BALLS.map(
      (ball) =>
        `<div class="bag-item"><img src="${ball.image}" alt=""><span>${ball.name}</span><strong>× ${state[ball.key]}</strong></div>`,
    ).join('');
    const typed = document.createElement('details');
    typed.className = 'type-ball-bag';
    typed.innerHTML = `<summary>属性ボール（${state.typeBalls.reduce((a, b) => a + b, 0)}個）</summary><div>${
      ownedTypeBalls(state)
        .map(
          (b) =>
            `<div class="bag-type-ball"><img src="${b.image}" alt=""><span>${b.name}</span><strong>×${captureBallStock(b, state)}</strong></div>`,
        )
        .join('') || '<p>ガンテツの家で 交換できるよ</p>'
    }</div>`;
    document.querySelector('.type-ball-bag')?.remove();
    document.querySelector('#item-bag-rainbow').before(typed);
    const ticket = state.rainbowTickets[0];
    document.querySelector('#item-bag-rainbow').innerHTML =
      `<div class="bag-ticket"><img src="${RAINBOW_CONFIG.ticketImage}" alt=""><div><strong>虹のチケット ×${state.rainbowTickets.length}</strong><small>${ticket ? '帰り：' + MAPS[ticket.returnMapId].name : 'ボスから まれに 手に入るよ'}</small></div><button id="bag-use-ticket" ${ticket && !isRainbow() ? '' : 'disabled'}>つかう</button></div>`;
    document.querySelector('#bag-use-ticket').onclick = () => {
      if (!ticket || isRainbow()) return;
      bag.close();
      enterRainbow(ticket.id);
    };
    bag.showModal();
  }
  menu.querySelectorAll('[data-menu-action]').forEach(
    (button) =>
      (button.onclick = () => {
        const action = button.dataset.menuAction;
        close(false);
        if (action === 'dex') window.PokekoroDex?.open();
        else if (action === 'party') {
          showTab('party');
          renderDex();
        } else if (action === 'bag') showBag();
        else if (action === 'badges') {
          showTab('journey');
          document.querySelector('#journey').scrollTop = 0;
        } else if (action === 'settings') document.querySelector('#title-options').showModal();
      }),
  );
  document.querySelector('#item-bag-back').onclick = () => bag.close();
  document.addEventListener('title:start', () => {
    if (menu.open) close();
    if (bag.open) bag.close();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && menu.open) close();
  });
  window.addEventListener('resize', () => {
    if (menu.open) position();
  });
  window.visualViewport?.addEventListener('resize', () => {
    if (menu.open) position();
  });
})();
