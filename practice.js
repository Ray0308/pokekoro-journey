'use strict';
// 実践課題は専用dialogと状態で実行し、計算・技判定は本編のルールを共有する。
(() => {
  const dialog = document.createElement('dialog');
  dialog.id = 'practice';
  dialog.setAttribute('aria-label', 'オーキドの れんしゅう');
  dialog.innerHTML =
    '<header><strong>オーキドの れんしゅう</strong><span id="practice-clock"></span></header><div class="practice-enemy"><img alt=""><div><strong id="practice-enemy-name"></strong><progress id="practice-hp"></progress><span id="practice-hp-text"></span></div></div><div id="practice-roster"></div><p id="practice-hint" role="status"></p><div id="practice-power"></div><div id="practice-result" role="status" aria-live="polite"></div><div class="practice-board"><canvas id="practice-board" width="420" height="350" aria-label="ひかる同じマーク3つをなぞってはなそう"></canvas><button id="practice-start" class="primary" hidden>▶ スタート</button></div><section id="practice-skill" hidden><h3></h3><p></p><button id="practice-use" class="primary"></button></section>';
  document.body.append(dialog);
  const $p = (s) => dialog.querySelector(s),
    canvas = $p('canvas'),
    ctx = canvas.getContext('2d');
  let model,
    path = [],
    pointer = null,
    running = false,
    until = 0,
    raf = 0,
    generation = 0,
    feedback = false;
  const prompts = {
    trace: 'ひかる 3つを なぞって はなそう！',
    round: 'スタートを おして 10びょう あそぼう！',
    charge: 'どくを つないで わざを ためよう！',
    skillOpen: 'ひかる ニドラン♂を おしてね！',
    skillUse: '「どくばりを つかう」を おそう！',
    neutral: 'まずは どくを 3つ けそう！',
    advantage: 'つぎは でんきを 3つ けそう！',
    counter: 'あいてが のこると はんげき！ スタートを おそう！',
    faintOpen: 'おやすみした ニドラン♂を おしてね！',
    faintTry: 'どくばりを つかってみよう！',
    gray: 'うすい どくも 3つ けしてみよう！',
    live: 'げんきな なかまの みずで こうげき！',
  };
  function active() {
    return dialog.open && !!model;
  }
  function sound(name) {
    window.PokekoroSfx?.play(name);
  }
  function draw() {
    if (!model) return;
    ctx.clearRect(0, 0, 420, 350);
    const alive = BattleTurnRules.alive(model.combat);
    for (let i = 0; i < model.board.length; i++) {
      if (model.board[i] === null) continue;
      const x = (i % 6) * 70 + 35,
        y = Math.floor(i / 6) * 70 + 35;
      ctx.globalAlpha = partyTypePower(alive, model.board[i]) === 0 ? 0.3 : 1;
      drawTypeGem(
        ctx,
        x,
        y,
        POKEMON_TYPE_COLORS[model.board[i]],
        POKEMON_TYPE_ICONS[model.board[i]],
        path.includes(i),
        model.board[i],
      );
      ctx.globalAlpha = 1;
      if (model.step !== 'round' && PracticeRules.cells.includes(i)) {
        ctx.strokeStyle = '#d79c18';
        ctx.lineWidth = 5;
        ctx.strokeRect(x - 32, y - 32, 64, 64);
        ctx.fillStyle = '#203d34';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(String(PracticeRules.cells.indexOf(i) + 1), x - 27, y - 17);
      }
    }
  }
  function render() {
    if (!model) return;
    $p('.practice-enemy img').src = pokemonPortrait(model.enemy.id);
    $p('.practice-enemy img').alt = model.enemy.label;
    $p('#practice-enemy-name').textContent =
      model.enemy.label + (['neutral', 'advantage'].includes(model.step) ? '（みず）' : '');
    $p('#practice-hp').max = model.total;
    $p('#practice-hp').value = model.hp;
    $p('#practice-hp-text').textContent = `HP ${model.hp} / ${model.total}`;
    $p('#practice-hint').textContent =
      model.step === 'round' && running
        ? 'どくを つないで パワーを ためよう！'
        : prompts[model.step];
    $p('#practice-power').textContent = `こうげきパワー ${model.power}`;
    $p('#practice-roster').innerHTML = model.combat.members
      .map(
        (m) =>
          `<button data-practice-member="${m.id}" style="--ready-type:${POKEMON_TYPE_COLORS[POKEDEX[m.id - 1].type]}" class="${!m.fainted && m.gauge >= PokemonSkillRules.cost(m.id) ? 'skill-ready' : ''} ${m.fainted ? 'fainted' : ''} ${['skillOpen', 'faintOpen'].includes(model.step) && m.id === 32 ? 'practice-target' : ''}" ${!['skillOpen', 'faintOpen'].includes(model.step) || m.id !== 32 ? 'disabled' : ''}><img src="${pokemonPortrait(m.id)}" alt="${POKEDEX[m.id - 1].label}"><span>${m.fainted ? 'ひんし' : m.gauge + '/' + PokemonSkillRules.cost(m.id)}</span></button>`,
      )
      .join('');
    $p('#practice-start').hidden = !['round', 'counter'].includes(model.step) || running;
    $p('#practice-start').classList.toggle('practice-target', !$p('#practice-start').hidden);
    $p('#practice-skill').hidden = !['skillUse', 'faintTry'].includes(model.step);
    if (!$p('#practice-skill').hidden) {
      const skill = PokemonSkillRules.forPokemon(32);
      $p('#practice-skill h3').textContent = 'ニドラン♂の ' + skill.name;
      $p('#practice-skill p').textContent = PokemonSkillRules.description(32);
      $p('#practice-use').textContent = skill.name + 'を つかう';
      $p('#practice-use').className = 'primary practice-target';
    }
    $p('.practice-board').hidden = ['skillUse', 'faintTry'].includes(model.step);
    draw();
  }
  function enter(step) {
    generation++;
    running = false;
    cancelAnimationFrame(raf);
    path = [];
    pointer = null;
    feedback = false;
    dialog.classList.remove('practice-attack');
    model = PracticeRules.create(step);
    state.opening.practiceStep = model.step;
    save();
    $p('#practice-clock').textContent = model.step === 'round' ? '10.0' : '';
    $p('#practice-result').textContent = '';
    render();
  }
  async function praise(words, next) {
    const token = generation;
    feedback = true;
    $p('#practice-result').textContent = words;
    $p('#practice-result').classList.remove('practice-success');
    void $p('#practice-result').offsetWidth;
    $p('#practice-result').classList.add('practice-success');
    sound('success');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    if (token !== generation || !active()) return;
    if (next) enter(next);
    else finish();
  }
  function finish() {
    generation++;
    cancelAnimationFrame(raf);
    running = false;
    dialog.close();
    model = null;
    document.dispatchEvent(new CustomEvent('battle:audiofocus', { detail: { active: false } }));
    window.PokekoroOpening.practiceComplete();
  }
  function refill() {
    for (let i = 0; i < model.board.length; i++)
      model.board[i] = [3, 2, 6][(i + Math.floor(i / 6)) % 3];
    for (const i of PracticeRules.cells) model.board[i] = model.targetType;
  }
  async function cleared(result, used) {
    const step = model.step;
    used.forEach((i) => (model.board[i] = null));
    draw();
    sound('clear');
    $p('#practice-power').textContent =
      `こうげきパワー ${result.before} → ${result.after}（+${result.amount}）`;
    if (step === 'round') {
      refill();
      draw();
      return;
    }
    if (step === 'trace') return praise('じょうず！ 3つ けせたね！', 'round');
    if (step === 'charge') {
      render();
      if (model.combat.members[0].gauge >= PokemonSkillRules.cost(32))
        return praise('わざが たまった！', 'skillOpen');
      $p('#practice-result').textContent = 'いいね！ もういちど つなごう！';
      refill();
      draw();
      return;
    }
    if (step === 'neutral') {
      return praise(`いいね！ どくは ${result.amount}パワー`, 'advantage');
    }
    if (step === 'advantage')
      return praise(
        `すごい！ どく ${PracticeRules.power(model, 3, 3)} → でんき ${result.amount}！ 2ばい！`,
        'counter',
      );
    if (step === 'gray') {
      if (result.amount !== 0 || result.before !== result.after)
        throw Error('練習の0パワー条件が不正');
      return praise('けせたね！ でも パワーは 0 のまま！', 'live');
    }
    if (step === 'live') {
      if (result.amount <= 0) return;
      model.hp = Math.max(0, model.hp - result.amount);
      render();
      $p('#practice-result').textContent = `みず +${result.amount}！`;
      dialog.classList.add('practice-attack');
      return praise('ピカチュウを たおした！ じょうず！', null);
    }
  }
  function index(event) {
    const r = canvas.getBoundingClientRect(),
      x = ((event.clientX - r.left) * 420) / r.width,
      y = ((event.clientY - r.top) * 350) / r.height;
    return x < 0 || y < 0 || x >= 420 || y >= 350
      ? -1
      : Math.floor(y / 70) * 6 + Math.floor(x / 70);
  }
  function canTrace() {
    return (
      active() &&
      !feedback &&
      (model.step === 'round'
        ? running
        : ['trace', 'charge', 'neutral', 'advantage', 'gray', 'live'].includes(model.step))
    );
  }
  canvas.onpointerdown = (event) => {
    event.preventDefault();
    if (!canTrace() || pointer !== null) return;
    const i = index(event);
    if (i < 0) return;
    pointer = event.pointerId;
    path = [i];
    canvas.setPointerCapture(pointer);
    draw();
  };
  canvas.onpointermove = (event) => {
    if (pointer !== event.pointerId || !canTrace()) return;
    event.preventDefault();
    const i = index(event),
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
  canvas.onpointerup = (event) => {
    if (pointer !== event.pointerId) return;
    event.preventDefault();
    pointer = null;
    const used = [...path];
    path = [];
    if (!canTrace() || (running && performance.now() >= until)) {
      draw();
      return;
    }
    const result = PracticeRules.clear(model, used);
    if (result) void cleared(result, used);
    else {
      $p('#practice-result').textContent = 'だいじょうぶ！ ひかる 3つを なぞろう！';
      draw();
    }
  };
  canvas.onpointercancel = canvas.onlostpointercapture = () => {
    pointer = null;
    path = [];
    draw();
  };
  function tick(now) {
    if (!running || !active()) return;
    $p('#practice-clock').textContent = (Math.max(0, until - now) / 1000).toFixed(1);
    if (now < until) {
      raf = requestAnimationFrame(tick);
      return;
    }
    running = false;
    pointer = null;
    path = [];
    if (!model.clears) {
      $p('#practice-result').textContent = 'もういちど やってみよう！';
      render();
      return;
    }
    model.hp = Math.max(0, model.hp - model.power);
    render();
    dialog.classList.add('practice-attack');
    void praise(`みんなで アタック！ ${model.power}パワー！ じょうず！`, 'charge');
  }
  $p('#practice-start').onclick = async () => {
    if (feedback || running) return;
    if (model.step === 'counter') {
      const token = generation;
      feedback = true;
      window.PokekoroBattleFX?.counterWindup(dialog, $p('.practice-enemy img'));
      await new Promise((resolve) => setTimeout(resolve, 220));
      if (token !== generation || !active()) return;
      const hit = BattleTurnRules.retaliate(model.combat, () => 0);
      if (hit.id !== 32 || BattleTurnRules.alive(model.combat).length !== 2)
        throw Error('反撃練習の条件が不正');
      await window.PokekoroBattleFX?.counterHit(
        $p('[data-practice-member="32"]'),
        false,
        dialog,
        $p('.practice-enemy img'),
        model.enemy.type,
      );
      if (token !== generation || !active()) return;
      feedback = false;
      model.step = 'faintOpen';
      render();
      sound('hit');
      state.opening.practiceStep = 'faintOpen';
      save();
      $p('#practice-result').textContent = 'ニドラン♂が ひんしに なった！';
      return;
    }
    if (model.step !== 'round') return;
    model.power = 0;
    model.clears = 0;
    running = true;
    until = performance.now() + 10000;
    render();
    raf = requestAnimationFrame(tick);
  };
  $p('#practice-roster').onclick = (event) => {
    if (
      feedback ||
      Number(event.target.closest('[data-practice-member]')?.dataset.practiceMember) !== 32
    )
      return;
    if (model.step === 'skillOpen') enter('skillUse');
    else if (model.step === 'faintOpen') enter('faintTry');
  };
  $p('#practice-use').onclick = async () => {
    if (feedback || !['skillUse', 'faintTry'].includes(model.step)) return;
    const result = BattleTurnRules.skill(model.combat, 32, {
      enemy: model.enemy,
      enemyHP: model.hp,
    });
    if (model.step === 'faintTry') {
      if (result.ok) throw Error('ひんしの技が使えてしまった');
      $p('#practice-skill p').textContent = result.reason;
      void praise('ひんしの なかまは わざを つかえないよ！', 'gray');
      return;
    }
    if (!result.ok) {
      $p('#practice-result').textContent = result.reason;
      return;
    }
    const token = generation;
    feedback = true;
    await window.PokekoroBattleFX?.skill({
      category: result.skill.category,
      type: PokemonSkillRules.attackType(result.skill, POKEDEX[31]),
      source: $p('[data-practice-member="32"]'),
      host: dialog,
      enemy: $p('.practice-enemy img'),
    });
    if (token !== generation || !active()) return;
    feedback = false;
    model.hp -= result.damage;
    render();
    void praise(`どくばり！ ${result.damage}ダメージ！ できたね！`, 'neutral');
  };
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  document.addEventListener('visibilitychange', () => {
    if (!active() || !running || !document.hidden) return;
    running = false;
    cancelAnimationFrame(raf);
    pointer = null;
    path = [];
    // 再開時は短い練習ラウンドを最初から。時間切れや本編敗北へ送らない。
    enter('round');
    $p('#practice-result').textContent = 'スタートで もういちど あそぼう！';
  });
  window.PokekoroPractice = Object.freeze({
    open() {
      if (
        state.opening.stage !== 'practice' ||
        state.opening.version < 3 ||
        window.PokekoroDebug?.isActive?.()
      )
        return;
      busy = true;
      generation++;
      dialog.classList.remove('practice-attack');
      enter(state.opening.practiceStep);
      dialog.showModal();
      document.dispatchEvent(new CustomEvent('battle:audiofocus', { detail: { active: true } }));
    },
  });
})();
