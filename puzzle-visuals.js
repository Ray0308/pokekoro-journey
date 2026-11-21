'use strict';
// ピースの見た目だけを描く。判定位置と属性データには触れない。
// Keep the supplied type symbols. Tiles use a few flat color planes, like the map sprites.
const TYPE_SYMBOL_CELLS = [7, 1, 2, 13, 3, 0, 6, 8, 12, 14, 4, 5, 9, 10, 11, 15, 16, 17];
const typeSymbolAtlas = new Image();
typeSymbolAtlas.src = 'assets/types/symbols.png';
typeSymbolAtlas.onload = () => {
  if (typeof draw === 'function' && typeof battle !== 'undefined' && battle) draw();
};
function drawTypeGem(context, x, y, color, icon, selected, type) {
  const shade = (hex, amount) => {
    const values = hex
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16));
    return (
      '#' +
      values
        .map((v) =>
          Math.max(
            0,
            Math.min(255, Math.round(amount > 0 ? v + (255 - v) * amount : v * (1 + amount))),
          )
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  };
  const tile = (left, top, size, cut = 5) => {
    context.beginPath();
    context.moveTo(left + cut, top);
    context.lineTo(left + size - cut, top);
    context.lineTo(left + size, top + cut);
    context.lineTo(left + size, top + size - cut);
    context.lineTo(left + size - cut, top + size);
    context.lineTo(left + cut, top + size);
    context.lineTo(left, top + size - cut);
    context.lineTo(left, top + cut);
    context.closePath();
  };
  context.save();
  context.translate(x, y + (selected ? -2 : 0));
  // A hard lower edge, a matte face, and a thin upper highlight: no glass/glow effects.
  tile(-27, -23, 54);
  context.fillStyle = shade(color, -0.35);
  context.fill();
  tile(-27, -27, 54);
  context.fillStyle = shade(color, -0.12);
  context.fill();
  context.strokeStyle = shade(color, -0.38);
  context.lineWidth = 2;
  context.stroke();
  context.beginPath();
  context.moveTo(-21, -24);
  context.lineTo(21, -24);
  context.lineTo(24, -21);
  context.strokeStyle = shade(color, 0.38);
  context.lineWidth = 2;
  context.stroke();
  if (selected) {
    tile(-30, -30, 60, 6);
    context.strokeStyle = '#fff8d3';
    context.lineWidth = 3;
    context.stroke();
    tile(-32, -32, 64, 7);
    context.strokeStyle = '#b18b38';
    context.lineWidth = 2;
    context.stroke();
  }
  if (typeSymbolAtlas.complete && typeSymbolAtlas.naturalWidth) {
    const cell = TYPE_SYMBOL_CELLS[type];
    context.shadowColor = '#17384b70';
    context.shadowBlur = 0;
    context.shadowOffsetY = 1;
    context.drawImage(
      typeSymbolAtlas,
      (cell % 6) * 130,
      Math.floor(cell / 6) * 130,
      130,
      130,
      -21,
      -21,
      42,
      42,
    );
  } else {
    context.font = '800 15px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#fff';
    context.fillText(POKEMON_TYPE_NAMES[type]?.slice(0, 2) || '？', 0, 0);
  }
  context.restore();
}

// ヒントは枠と順番だけ。マークを覆わず、選択や消去としては扱わない。
function drawPuzzleHint(context, hint, now, still = false) {
  if (!hint.length) return;
  context.save();
  context.globalAlpha = still ? 1 : 0.75 + Math.sin(now / 220) * 0.2;
  context.strokeStyle = '#fff5a2';
  context.shadowColor = '#ffe35a';
  context.shadowBlur = 14;
  context.lineWidth = 4;
  hint.forEach((i, n) => {
    const x = (i % 6) * 70,
      y = Math.floor(i / 6) * 70;
    context.strokeRect(x + 5, y + 5, 60, 60);
    context.fillStyle = '#fff9cf';
    context.fillRect(x + 3, y + 1, 17, 18);
    context.shadowBlur = 0;
    context.fillStyle = '#53451d';
    context.font = 'bold 14px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(n + 1), x + 11, y + 10);
    context.shadowBlur = 14;
  });
  context.restore();
}
