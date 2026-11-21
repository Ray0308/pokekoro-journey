'use strict';
// 初代風の文字選択。ゲーム状態を直接参照せず、入力更新と確定を呼び出し元へ返す。
const OpeningNameEntry = (() => {
  const segmenter =
    typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
      : null;
  const units = (text) =>
    segmenter ? [...segmenter.segment(text)].map((s) => s.segment) : Array.from(text);
  const erase = (text) => units(text).slice(0, -1).join('');
  function append(text, key, limit) {
    const next = (text + key).normalize('NFC');
    return units(next).length <= limit ? next : null;
  }
  function mark(text, kind) {
    const parts = units(text),
      last = parts.pop();
    if (!last) return null;
    const decomposed = last.normalize('NFD'),
      base = decomposed[0];
    const supported =
      kind === '゜'
        ? 'はひふへほハヒフヘホ'
        : 'かきくけこさしすせそたちつてとはひふへほうカキクケコサシスセソタチツテトハヒフヘホウ';
    if (!supported.includes(base)) return null;
    const accent = kind === '゜' ? '\u309a' : '\u3099';
    return parts.join('') + (decomposed.includes(accent) ? base : (base + accent).normalize('NFC'));
  }
  const kana = [
    'アカサタナハマヤラワ',
    'イキシチニヒミ リヲ',
    'ウクスツヌフムユルン',
    'エケセテネヘメ レ ',
    'オコソトノホモヨロ ',
    'ァィゥェォャュョッー',
  ];
  const toHiragana = (char) => {
    const code = char.codePointAt(0);
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : char;
  };
  const latin = [
    '0123456789',
    'ABCDEFGHIJ',
    'KLMNOPQRST',
    'UVWXYZ    ',
    'abcdefghij',
    'klmnopqrst',
    'uvwxyz    ',
  ];
  function render(
    host,
    { draft = '', mode = 'katakana', limit, onChange, onMode, onDone, onBack },
  ) {
    host.innerHTML =
      '<form id="opening-name-form" class="name-screen"><div class="name-entry-heading"><strong id="opening-name-title">あなたの なまえは？</strong><output id="opening-name" aria-label="入力した名前" aria-live="polite"></output></div><div class="name-mode" aria-label="文字の種類"></div><div class="name-characters" role="group" aria-label="文字を選ぶ"></div><div class="name-edit"><button type="button" data-mark="゛">゛<small>だくてん</small></button><button type="button" data-mark="゜">゜<small>はんだくてん</small></button><button type="button" id="opening-name-delete">けす</button><button type="submit" id="opening-name-done">おわり</button></div><p id="opening-name-error" role="alert" hidden></p><button type="button" id="opening-name-back">なまえの えらびなおし</button></form>';
    const form = host.querySelector('form'),
      grid = host.querySelector('.name-characters'),
      output = host.querySelector('output'),
      error = host.querySelector('#opening-name-error');
    const message = (text) => {
      error.textContent = text;
      error.hidden = !text;
    };
    function preview() {
      output.replaceChildren();
      const letters = units(draft);
      for (let i = 0; i < limit; i++) {
        const slot = document.createElement('span');
        slot.textContent = letters[i] || '＿';
        output.append(slot);
      }
      output.setAttribute('aria-label', '入力した名前：' + (draft || 'まだありません'));
      host.querySelector('#opening-name-delete').disabled = !draft;
    }
    function update(value) {
      if (value === null) {
        message(`なまえは ${limit}もじまでに してね。`);
        return;
      }
      draft = value;
      onChange(value);
      message('');
      preview();
    }
    function keys() {
      grid.replaceChildren();
      const rows = mode === 'latin' ? latin : kana;
      for (const char of Array.from(rows.join(''))) {
        if (char === ' ') {
          const blank = document.createElement('span');
          blank.setAttribute('aria-hidden', 'true');
          grid.append(blank);
          continue;
        }
        const value = mode === 'hiragana' ? toHiragana(char) : char;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = value;
        button.dataset.nameChar = value;
        button.tabIndex = grid.querySelector('button') ? -1 : 0;
        button.onclick = () => update(append(draft, value, limit));
        grid.append(button);
      }
      for (const tab of host.querySelectorAll('[data-name-mode]'))
        tab.setAttribute('aria-pressed', String(tab.dataset.nameMode === mode));
    }
    for (const [value, label] of [
      ['katakana', 'カタカナ'],
      ['hiragana', 'ひらがな'],
      ['latin', 'ABC・123'],
    ]) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.textContent = label;
      tab.dataset.nameMode = value;
      tab.onclick = () => {
        mode = value;
        onMode(value);
        keys();
      };
      host.querySelector('.name-mode').append(tab);
    }
    host.querySelectorAll('[data-mark]').forEach(
      (button) =>
        (button.onclick = () => {
          const value = mark(draft, button.dataset.mark);
          if (value === null) message('だくてんを つける もじを えらんでね。');
          else update(value);
        }),
    );
    host.querySelector('#opening-name-delete').onclick = () => update(erase(draft));
    host.querySelector('#opening-name-back').onclick = onBack;
    grid.onkeydown = (event) => {
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -10, ArrowDown: 10 }[event.key];
      if (!delta) return;
      const nodes = [...grid.children];
      let index = nodes.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      for (let i = 0; i < nodes.length; i++) {
        index = (index + delta + nodes.length) % nodes.length;
        if (nodes[index].matches('button')) {
          event.target.tabIndex = -1;
          nodes[index].tabIndex = 0;
          nodes[index].focus();
          break;
        }
      }
    };
    form.onkeydown = (event) => {
      if (event.key === 'Backspace') {
        event.preventDefault();
        update(erase(draft));
      }
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      const invalid = OpeningRules.nameError(draft);
      if (invalid) {
        message(invalid);
        return;
      }
      onDone(draft);
    };
    if (!['katakana', 'hiragana', 'latin'].includes(mode)) mode = 'katakana';
    keys();
    preview();
  }
  return Object.freeze({ render, units, append, erase, mark, toHiragana });
})();
if (typeof module !== 'undefined') module.exports = OpeningNameEntry;
