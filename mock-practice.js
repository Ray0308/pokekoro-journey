'use strict';
// version 5の研究所模擬戦。相手・編成・ゲージを途中の課題で作り直さない。
(() => {
  const dialog = document.createElement('dialog');
  dialog.id = 'mock-practice';
  dialog.setAttribute('aria-label', '研究所の もぎせん');
  dialog.innerHTML =
    '<header><strong>けんきゅうじょの もぎせん</strong><b id="mock-clock"></b></header><div class="mock-opponent"><img alt="オーキドのピカチュウ"><span>オーキドの ピカチュウ</span></div><div id="mock-roster"></div><p id="mock-hint" role="status"></p><div id="mock-power"></div><p id="mock-result" role="status" aria-live="polite"></p><div class="mock-board"><canvas width="420" height="350" aria-label="同じマークを3つ以上なぞる盤面"></canvas><button id="mock-start" class="primary" hidden>▶ スタート</button><span id="mock-countdown" hidden></span><section id="mock-skill" hidden><h3></h3><p></p><button id="mock-use" class="primary"></button><button id="mock-skill-back">もどる</button></section><button id="mock-finish" class="primary" hidden>もぎせんを おえる</button></div>';
  document.body.append(dialog);
  const $m = (s) => dialog.querySelector(s),
    canvas = $m('canvas'),
    ctx = canvas.getContext('2d'),
    rules = MockPracticeRules;
  let model = null,
    path = [],
    pointer = null,
    running = false,
    locked = false,
    generation = 0,
    until = 0,
    raf = 0,
    selected = null,
    combo = 0,
    lastClear = 0;
  const active = () => dialog.open && !!model;
  const sound = (name, n) => window.PokekoroSfx?.play(name, n);
  const checkpoint = () => {
    state.opening.mockBattle = rules.snapshot(model);
    save();
  };
  function draw(holes = []) {
    if (!model) return;
    ctx.clearRect(0, 0, 420, 350);
    if (path.length) {
      ctx.beginPath();
      path.forEach((index, n) => {
        const x = (index % 6) * 70 + 35,
          y = Math.floor(index / 6) * 70 + 35;
        n ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.strokeStyle = '#9b7740';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    model.board.forEach((type, index) => {
      if (holes.includes(index)) return;
      const x = (index % 6) * 70 + 35,
        y = Math.floor(index / 6) * 70 + 35;
      drawTypeGem(
        ctx,
        x,
        y,
        POKEMON_TYPE_COLORS[type],
        POKEMON_TYPE_ICONS[type],
        path.includes(index),
        type,
      );
      if (model.phase === 'trace' && rules.guide.includes(index)) {
        ctx.strokeStyle = '#b67e21';
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 32, y - 32, 64, 64);
      }
    });
  }
  function render() {
    if (!model) return;
    dialog.dataset.phase = model.phase;
    $m('.mock-opponent img').src = pokemonPortrait(25);
    const ready = model.combat.members.filter((m) => rules.inspect(model, m.id).ok);
    $m('#mock-roster').innerHTML = model.combat.members
      .map((m) => {
        const mon = POKEDEX[m.id - 1],
          cost = PokemonSkillRules.cost(m.id),
          can = rules.inspect(model, m.id).ok;
        return `<button data-mock-member="${m.id}" style="--ready-type:${POKEMON_TYPE_COLORS[mon.type]}" class="${can ? 'skill-ready' : ''}" ${running || locked || model.rounds === 0 || model.phase === 'done' ? 'disabled' : ''}><img src="${pokemonPortrait(m.id)}" alt=""><strong>${mon.label}</strong><span>${m.gauge}/${cost}${can ? ' わざOK' : ''}</span><i><b style="width:${(m.gauge / cost) * 100}%"></b></i></button>`;
      })
      .join('');
    $m('#mock-power').textContent =
      `こうげきパワー ${model.power.toLocaleString()}${model.combat.boost > 1 ? '　×' + model.combat.boost : ''}`;
    $m('#mock-hint').textContent =
      model.phase === 'trace'
        ? 'オーキド：まずは 同じマークを3つ なぞって はなそう。'
        : running
          ? 'オーキド：すきなマークを つないでみよう！'
          : model.phase === 'done'
            ? 'オーキド：じょうずじゃ！ これで ぼうけんの じゅんびが できたのう。'
            : model.rounds === 0
              ? 'オーキド：つぎは10びょう。ためたパワーで まとめてアタックじゃ！'
              : ready.length
                ? 'オーキド：わざが たまったなかまを おしてみよう！'
                : 'オーキド：ゲージも ふえておるぞ。もう10びょう ためしてみよう！';
    $m('#mock-start').hidden = model.phase !== 'ready' || running || locked;
    $m('#mock-start').textContent = model.rounds === 0 ? '▶ スタート' : '▶ もう10びょう あそぶ';
    $m('#mock-finish').hidden = model.phase !== 'done' || locked;
    canvas.classList.toggle('is-ready', ['ready', 'done'].includes(model.phase));
    draw();
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function cancelPointer() {
    pointer = null;
    path = [];
    draw();
  }
  function index(event) {
    const r = canvas.getBoundingClientRect(),
      x = ((event.clientX - r.left) * 420) / r.width,
      y = ((event.clientY - r.top) * 350) / r.height;
    return x < 0 || y < 0 || x >= 420 || y >= 350
      ? -1
      : Math.floor(y / 70) * 6 + Math.floor(x / 70);
  }
  const canTrace = () =>
    active() &&
    !locked &&
    (model.phase === 'trace' || (model.phase === 'round' && running && performance.now() < until));
  canvas.onpointerdown = (e) => {
    e.preventDefault();
    if (!canTrace() || pointer !== null) return;
    const i = index(e);
    if (i < 0) return;
    pointer = e.pointerId;
    path = [i];
    canvas.setPointerCapture(pointer);
    draw();
  };
  canvas.onpointermove = (e) => {
    if (pointer !== e.pointerId || !canTrace()) return;
    e.preventDefault();
    const i = index(e),
      last = path.at(-1);
    if (i < 0 || i === last) return;
    if (path.length > 1 && i === path.at(-2)) path.pop();
    else if (
      !path.includes(i) &&
      model.board[i] === model.board[last] &&
      Math.abs((i % 6) - (last % 6)) <= 1 &&
      Math.abs(Math.floor(i / 6) - Math.floor(last / 6)) <= 1
    )
      path.push(i);
    draw();
  };
  canvas.onpointerup = async (e) => {
    if (pointer !== e.pointerId) return;
    e.preventDefault();
    pointer = null;
    const used = [...path];
    path = [];
    if (!canTrace()) {
      draw();
      return;
    }
    const before = model.phase,
      now = performance.now(),
      nextCombo = lastClear && now - lastClear < 2000 ? combo + 1 : 1,
      result = rules.clear(model, used, Math.random, nextCombo);
    if (!result) {
      $m('#mock-result').textContent = '同じマークを3つ以上 つないで はなしてみよう。';
      draw();
      return;
    }
    combo = nextCombo;
    lastClear = now;
    sound('clear');
    locked = true;
    draw(used);
    $m('#mock-result').textContent =
      `${POKEMON_TYPE_NAMES[result.type]} ＋${result.amount}パワー！`;
    const token = generation;
    await wait(110);
    if (token !== generation || !active()) return;
    locked = false;
    render();
    if (before === 'trace') {
      checkpoint();
      $m('#mock-result').textContent = 'つながったね！ なかまの ゲージも ふえたぞ。';
      sound('success');
    }
  };
  canvas.onpointercancel = canvas.onlostpointercapture = cancelPointer;
  async function release() {
    if (!active() || model.phase !== 'round') return;
    running = false;
    cancelPointer();
    locked = true;
    render();
    const token = generation;
    const entries = Object.entries(model.typeCharge).sort((a, b) => b[1] - a[1]),
      type = Number(entries[0]?.[0] ?? POKEDEX[model.starter - 1].type);
    const sources = model.team
      .map((id) => ({
        node: $m(`[data-mock-member="${id}"]`),
        type: pokemonTypes(POKEDEX[id - 1]).find((t) => model.typeCharge[t] > 0),
      }))
      .filter((x) => x.type !== undefined);
    await window.PokekoroBattleFX?.groupAttack(sources, type, model.power, dialog);
    if (token !== generation || !active()) return;
    const amount = model.power;
    rules.end(model);
    checkpoint();
    if (amount > 0) window.PokekoroBattleFX?.damage(amount, type, dialog, $m('.mock-opponent img'));
    sound('impact', 1);
    $m('#mock-result').textContent =
      amount > 0
        ? `みんなで アタック！ ${amount.toLocaleString()}ダメージ！`
        : 'だいじょうぶ。時間を気にせず もう一度ためしてみよう。';
    await wait(600);
    if (token !== generation || !active()) return;
    locked = false;
    render();
  }
  window.PokekoroBattlePause.register({
    active: () => active() && (running || !$m('#mock-countdown').hidden),
    pause() {
      const snapshot = { generation, running };
      running = false;
      cancelAnimationFrame(raf);
      const held = pointer;
      pointer = null;
      path = [];
      if (held !== null && canvas.hasPointerCapture(held)) canvas.releasePointerCapture(held);
      draw();
      return snapshot;
    },
    resume(snapshot, duration) {
      if (!active() || snapshot.generation !== generation) return;
      if (snapshot.running) {
        until += duration;
        if (lastClear) lastClear += duration;
        running = true;
        raf = requestAnimationFrame(tick);
      }
    },
  });
  function tick(now) {
    if (!running || !active()) return;
    $m('#mock-clock').textContent = (Math.max(0, until - now) / 1000).toFixed(1);
    if (now >= until) {
      void release();
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  $m('#mock-start').onclick = async () => {
    if (!active() || locked || model.phase !== 'ready') return;
    selected = null;
    $m('#mock-skill').hidden = true;
    locked = true;
    render();
    const token = generation;
    const badge = $m('#mock-countdown');
    badge.hidden = false;
    for (const text of model.rounds === 0 ? ['3', '2', '1', 'GO!'] : ['GO!']) {
      badge.textContent = text;
      sound('tap');
      await window.PokekoroBattlePause.delay(text === 'GO!' ? 180 : 400);
      if (token !== generation || !active()) return;
    }
    badge.hidden = true;
    rules.begin(model);
    combo = 0;
    lastClear = 0;
    running = true;
    locked = false;
    until = performance.now() + 10000;
    render();
    raf = requestAnimationFrame(tick);
  };
  $m('#mock-roster').onclick = (e) => {
    const id = Number(e.target.closest('[data-mock-member]')?.dataset.mockMember);
    if (!id || locked || running || model.phase !== 'ready') return;
    const check = rules.inspect(model, id);
    if (model.rounds < 1 || !check.ok) {
      $m('#mock-result').textContent =
        model.rounds < 1
          ? 'まずは スタートで 10びょう ためしてみよう！'
          : `${POKEDEX[id - 1].label}の ゲージは ${model.combat.members.find((m) => m.id === id).gauge}/${PokemonSkillRules.cost(id)}。同じ属性をつなぐと たまるよ。`;
      return;
    }
    selected = id;
    const skill = PokemonSkillRules.forPokemon(id);
    $m('#mock-skill h3').textContent = `${POKEDEX[id - 1].label}の ${skill.name}`;
    $m('#mock-skill p').textContent = PokemonSkillRules.description(id);
    $m('#mock-use').textContent = skill.name + 'を つかう';
    $m('#mock-skill').hidden = false;
  };
  $m('#mock-skill-back').onclick = () => {
    $m('#mock-skill').hidden = true;
    selected = null;
  };
  $m('#mock-use').onclick = async () => {
    if (locked || !selected) return;
    const id = selected,
      result = rules.use(model, id);
    if (!result.ok) {
      $m('#mock-result').textContent = result.reason;
      return;
    }
    locked = true;
    $m('#mock-skill').hidden = true;
    render();
    const token = generation,
      mon = POKEDEX[id - 1];
    $m('#mock-hint').textContent = mon.label + 'の ' + result.skill.name + '！';
    await window.PokekoroBattleFX?.skill({
      category: result.skill.category,
      type: PokemonSkillRules.attackType(result.skill, mon),
      name: result.skill.name,
      actor: mon.label,
      damage: result.damage || 0,
      multiplier: result.skill.multiplier || 1,
      source: $m(`[data-mock-member="${id}"]`),
      targets: [...dialog.querySelectorAll('[data-mock-member]')],
      host: dialog,
      enemy: $m('.mock-opponent img'),
    });
    if (token !== generation || !active()) return;
    locked = false;
    checkpoint();
    render();
    sound('success');
    $m('#mock-result').textContent =
      result.skill.category === 'boost'
        ? `次のこうげきが ×${result.skill.multiplier}！ 10びょうで ためしてみよう。`
        : `${result.skill.name}！ ${result.damage.toLocaleString()}ダメージ！`;
  };
  $m('#mock-finish').onclick = () => {
    if (locked || model?.phase !== 'done') return;
    generation++;
    cancelAnimationFrame(raf);
    window.PokekoroBattleFX?.reset();
    dialog.close();
    model = null;
    delete state.opening.mockBattle;
    document.dispatchEvent(new CustomEvent('battle:audiofocus', { detail: { active: false } }));
    window.PokekoroOpening.practiceComplete();
  };
  dialog.addEventListener('cancel', (e) => e.preventDefault());
  window.PokekoroMockPractice = Object.freeze({
    open() {
      if (
        state.opening.stage !== 'practice' ||
        state.opening.version < 5 ||
        window.PokekoroDebug?.isActive?.()
      )
        return;
      generation++;
      model = rules.create(state.opening.starterId, state.opening.mockBattle);
      running = locked = false;
      pointer = null;
      path = [];
      selected = null;
      $m('#mock-result').textContent = '';
      $m('#mock-clock').textContent = '';
      $m('#mock-skill').hidden = true;
      $m('#mock-countdown').hidden = true;
      busy = true;
      checkpoint();
      render();
      dialog.showModal();
      document.dispatchEvent(new CustomEvent('opening:scene'));
      document.dispatchEvent(new CustomEvent('battle:audiofocus', { detail: { active: true } }));
    },
    inspect: () => (model ? rules.snapshot(model) : null),
  });
})();
