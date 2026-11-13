'use strict';
// ガンテツの製作UIと捕獲用の属性ボール選択UI。出現率・補正計算はtype-balls.jsに置く。
function typeBallPickerButton(stock) {
  const total = stock.typeBalls.reduce((a, b) => a + b, 0);
  return total
    ? `<button id="open-type-balls" class="type-ball-open"><img src="${ownedTypeBalls(stock)[0].image}" alt=""><span>属性ボールを つかう<small>もちもの ${total}個 ・ タイプ一致で 捕獲率アップ</small></span></button>`
    : '';
}
(() => {
  const house = document.querySelector('#kurt-house'),
    picker = document.querySelector('#type-ball-picker'),
    choices = document.querySelector('#kurt-types'),
    quantity = document.querySelector('#kurt-quantity'),
    status = document.querySelector('#kurt-status'),
    submit = document.querySelector('#kurt-trade');
  let selectedType = 0,
    trading = false;
  function update() {
    const ball = TYPE_BALLS[selectedType],
      max = Math.floor(state.balls / KURT_CONFIG.cost),
      quote = typeBallTradeQuote(state, selectedType, Number(quantity.value));
    quantity.max = max;
    quantity.disabled = max < 1;
    document.querySelector('#kurt-selection').innerHTML =
      `<img src="${ball.image}" alt=""><span><strong>${ball.name}</strong><small>もちもの ${state.typeBalls[selectedType]}個</small></span>`;
    document.querySelector('#kurt-stock').textContent = 'モンスターボール：' + state.balls + '個';
    document.querySelector('#kurt-preview').textContent = quote
      ? `モンスターボール ${quote.cost}個 → ${ball.name} ${quote.quantity}個`
      : max
        ? 'もらう個数を えらんでね'
        : 'モンスターボールが あと' + (KURT_CONFIG.cost - state.balls) + '個 必要だよ';
    submit.disabled = !quote || trading;
    house.querySelector('[data-kurt-adjust="minus"]').disabled =
      max < 1 || Number(quantity.value) <= 1;
    house.querySelector('[data-kurt-adjust="plus"]').disabled =
      max < 1 || Number(quantity.value) >= max;
    house.querySelector('[data-kurt-adjust="max"]').disabled = max < 1;
    choices
      .querySelectorAll('button')
      .forEach((b) =>
        b.setAttribute('aria-pressed', String(Number(b.dataset.kurtType) === selectedType)),
      );
  }
  choices.addEventListener('click', (e) => {
    const b = e.target.closest('[data-kurt-type]');
    if (!b || trading) return;
    const type = Number(b.dataset.kurtType);
    if (!TYPE_BALLS[type]) return;
    selectedType = type;
    update();
    window.PokekoroSfx?.play('select');
  });
  quantity.addEventListener('input', update);
  house.querySelectorAll('[data-kurt-adjust]').forEach(
    (b) =>
      (b.onclick = () => {
        if (trading) return;
        const max = Math.floor(state.balls / KURT_CONFIG.cost),
          n = Number(quantity.value);
        quantity.value =
          b.dataset.kurtAdjust === 'max'
            ? max
            : Math.max(
                1,
                Math.min(
                  max,
                  (Number.isSafeInteger(n) ? n : 1) + (b.dataset.kurtAdjust === 'plus' ? 1 : -1),
                ),
              );
        update();
      }),
  );
  submit.onclick = () => {
    if (trading || !isKurtHouse(state)) return;
    const quote = typeBallTradeQuote(state, selectedType, Number(quantity.value));
    if (!quote) {
      update();
      return;
    }
    trading = true;
    state.balls = quote.balls;
    state.typeBalls[quote.type] = quote.typeStock;
    save();
    render();
    quantity.value = state.balls >= KURT_CONFIG.cost ? 1 : 0;
    update();
    status.textContent =
      TYPE_BALLS[selectedType].name + 'を ' + quote.quantity + '個 つくってもらった！';
    window.PokekoroSfx?.play('success');
    setTimeout(() => {
      trading = false;
      update();
    }, 400);
  };
  document.querySelector('#kurt-close').onclick = () => house.close();
  house.addEventListener('close', () =>
    document.querySelector('#roll').focus({ preventScroll: true }),
  );
  document.querySelector('#type-ball-back').onclick = () => picker.close();
  function openPicker() {
    if (
      capturePending ||
      !battle ||
      !document.querySelector('#result').open ||
      !Number.isFinite(battle.captureBase)
    )
      return;
    const list = ownedTypeBalls(state).sort(
      (a, b) => Number(typeBallMatches(b, battle.m)) - Number(typeBallMatches(a, battle.m)),
    );
    document.querySelector('#type-ball-choices').innerHTML = list
      .map(
        (ball) =>
          `<button class="type-ball-choice" data-capture-type="${ball.typeIndex}" data-match="${typeBallMatches(ball, battle.m)}"><img src="${ball.image}" alt=""><span><strong>${ball.name}</strong><small>${typeBallMatches(ball, battle.m) ? 'タイプ一致！' : '通常の効果'} ・ 成功 ${Math.round(ballCatchChance(ball, battle.captureBase, battle.m) * 100)}%</small><small>残り ${captureBallStock(ball, state)}個</small></span></button>`,
      )
      .join('');
    picker.showModal();
  }
  document.querySelector('#type-ball-choices').addEventListener('click', (e) => {
    const b = e.target.closest('[data-capture-type]');
    if (!b || capturePending) return;
    const ball = TYPE_BALLS[Number(b.dataset.captureType)];
    if (!ball || captureBallStock(ball, state) < 1 || !battle) return;
    const chance = ballCatchChance(ball, battle.captureBase, battle.m);
    picker.close();
    catchMon(ball.id, chance);
  });
  document.addEventListener('title:start', () => {
    if (house.open) house.close();
    if (picker.open) picker.close();
  });
  window.PokekoroKurt = Object.freeze({
    open() {
      if (
        !isKurtHouse(state) ||
        currentSquares()[state.pos] !== 'kurt' ||
        capturePending ||
        document.querySelector('#battle').open ||
        document.querySelector('#encounter').open
      )
        return;
      busy = false;
      render();
      selectedType = partyTypes(state.party)[0] ?? 0;
      quantity.value = state.balls >= KURT_CONFIG.cost ? 1 : 0;
      status.textContent = '好きな属性を えらんでおくれ！';
      choices.innerHTML = TYPE_BALLS.map(
        (ball) =>
          `<button data-kurt-type="${ball.typeIndex}" aria-pressed="false"><img src="${ball.image}" alt=""><span>${POKEMON_TYPE_NAMES[ball.typeIndex]}</span></button>`,
      ).join('');
      update();
      house.showModal();
    },
    bindCapture() {
      const b = document.querySelector('#open-type-balls');
      if (b) b.onclick = openPicker;
    },
  });
})();
