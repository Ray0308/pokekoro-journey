'use strict';
// 画像だけの小さな動き。ゲームの待ち時間・数値・画像のtransformを変更しない。
(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [
    { host: document.querySelector('#battle'), image: document.querySelector('#enemyimg') },
    {
      host: document.querySelector('#mock-practice'),
      image: document.querySelector('.mock-opponent img'),
    },
  ].filter((s) => s.host && s.image);
  const records = new Map();
  function record(node, host, enemy = false) {
    if (!records.has(node))
      records.set(node, {
        node,
        host,
        enemy,
        idle: null,
        action: null,
        token: 0,
        src: '',
        open: false,
        pending: false,
      });
    return records.get(node);
  }
  const allowed = (r) =>
    r.node.isConnected &&
    r.host.open &&
    !document.hidden &&
    !preference.matches &&
    !document.querySelector('#battle-pause')?.open &&
    !r.host.classList.contains('enemy-defeated');
  function cancel(r) {
    r.token++;
    r.pending = false;
    r.idle?.cancel();
    r.action?.cancel();
    r.idle = r.action = null;
  }
  function idle(r) {
    if (!r.enemy || !allowed(r) || r.pending || r.action || r.host.classList.contains('resolving'))
      return;
    if (r.idle && r.idle.playState !== 'idle') return;
    r.idle = r.node.animate(
      [
        { translate: '0 0', rotate: '0deg' },
        { translate: '0 -2px', rotate: '.25deg', offset: 0.5 },
        { translate: '0 0', rotate: '0deg' },
      ],
      { duration: 3000, iterations: Infinity, easing: 'ease-in-out' },
    );
    r.idle.id = 'pokemon-idle';
  }
  function action(r, kind) {
    if (!allowed(r)) {
      cancel(r);
      return;
    }
    cancel(r);
    const token = r.token;
    const frames =
      kind === 'enter'
        ? [
            { translate: '0 10px', rotate: '-1deg', opacity: 0 },
            { translate: '0 -3px', rotate: '.4deg', opacity: 1, offset: 0.65 },
            { translate: '0 0', rotate: '0deg', opacity: 1 },
          ]
        : [
            { translate: '0 0', rotate: '0deg' },
            { translate: '5px 1px', rotate: '2deg', offset: 0.25 },
            { translate: '-2px 0', rotate: '-1deg', offset: 0.65 },
            { translate: '0 0', rotate: '0deg' },
          ];
    const animation = r.node.animate(frames, {
      duration: kind === 'enter' ? 460 : 230,
      easing: 'ease-out',
    });
    animation.id = 'pokemon-' + kind;
    r.action = animation;
    animation.finished
      .catch(() => {})
      .finally(() => {
        if (r.token !== token) {
          if (!r.enemy && !r.action && records.get(r.node) === r) records.delete(r.node);
          return;
        }
        r.action = null;
        if (r.enemy) idle(r);
        else records.delete(r.node);
      });
  }
  function sync() {
    for (const scene of scenes) {
      const r = record(scene.image, scene.host, true),
        src = r.node.getAttribute('src') || '';
      const entering = r.host.open && (!r.open || src !== r.src);
      r.open = r.host.open;
      r.src = src;
      if (!allowed(r)) {
        cancel(r);
        continue;
      }
      if (entering && src) {
        cancel(r);
        r.pending = true;
        const token = r.token;
        r.node
          .decode()
          .catch(() => {})
          .then(() => {
            if (r.token !== token) return;
            r.pending = false;
            if (r.node.getAttribute('src') === src && allowed(r)) action(r, 'enter');
          });
      } else {
        if (r.host.classList.contains('resolving')) {
          r.idle?.cancel();
          r.idle = null;
        } else idle(r);
      }
    }
  }
  for (const scene of scenes) {
    new MutationObserver(sync).observe(scene.host, {
      attributes: true,
      attributeFilter: ['open', 'class'],
    });
    new MutationObserver(sync).observe(scene.image, { attributes: true, attributeFilter: ['src'] });
  }
  const pause = document.querySelector('#battle-pause');
  if (pause)
    new MutationObserver(sync).observe(pause, { attributes: true, attributeFilter: ['open'] });
  document.addEventListener('visibilitychange', () => {
    for (const r of records.values()) if (document.hidden) cancel(r);
    sync();
  });
  preference.addEventListener('change', () => {
    for (const r of records.values()) cancel(r);
    sync();
  });
  window.PokekoroPokemonMotion = {
    hit(target) {
      const image = target?.tagName === 'IMG' ? target : target?.querySelector('img');
      const host = image?.closest('dialog');
      if (image && host)
        action(
          record(
            image,
            host,
            scenes.some((s) => s.image === image),
          ),
          'hit',
        );
    },
    reset() {
      for (const r of records.values()) cancel(r);
      sync();
    },
  };
  sync();
})();
