// 全画像の欠番・改変と、画像読み込み失敗時の番号表示への復帰を検査する。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'assets/pokemon/official-artwork/manifest.json'), 'utf8'),
);
let onImageError;
const context = vm.createContext({
  document: {
    addEventListener(event, handler, capture) {
      assert.equal(event, 'error');
      assert.equal(capture, true);
      onImageError = handler;
    },
  },
});
vm.runInContext(fs.readFileSync(path.join(root, 'pokemon-data.generated.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'pokemon-data.js'), 'utf8'), context);
const entries = vm.runInContext('POKEDEX', context);
assert.equal(manifest.count, 1025);
assert.equal(manifest.images.length, entries.length);
let totalBytes = 0;
for (let i = 0; i < entries.length; i++) {
  const mon = entries[i],
    image = manifest.images[i];
  assert.equal(mon.id, i + 1);
  assert.equal(image.id, mon.id);
  assert.equal(mon.image, image.path);
  assert.equal(mon.portrait, image.path);
  const bytes = fs.readFileSync(path.join(root, image.path));
  assert.equal(bytes.length, image.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256);
  const embedded = bytes.toString('utf8').match(/href="data:image\/webp;base64,([A-Za-z0-9+/=]+)"/);
  assert.ok(embedded, 'SVG must contain its own image, without external requests');
  const webp = Buffer.from(embedded[1], 'base64');
  assert.equal(webp.toString('ascii', 0, 4), 'RIFF');
  assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
  assert.equal(image.width, 384);
  assert.equal(image.height, 384);
  assert.match(image.source, new RegExp(`/official-artwork/${mon.id}\\.png$`));
  totalBytes += bytes.length;
}
assert.equal(totalBytes, manifest.totalBytes);
function failingImage(src) {
  return { tagName: 'IMG', src, getAttribute: () => src };
}
for (const id of [1, 446, 1025]) {
  const image = failingImage(`assets/pokemon/official-artwork/${id}.svg`);
  onImageError({ target: image });
  assert.ok(image.src.startsWith('data:image/svg+xml,'));
  assert.ok(decodeURIComponent(image.src).includes(`No.${String(id).padStart(4, '0')}`));
  // フォールバック自身の失敗や再表示で、同じ画像へ戻る無限ループを作らない。
  const fallback = failingImage(image.src);
  onImageError({ target: fallback });
  assert.equal(fallback.src, image.src);
}
for (const src of ['assets/pokemon/official-artwork/1026.svg', 'assets/poke-ball.jpg']) {
  const image = failingImage(src);
  onImageError({ target: image });
  assert.equal(image.src, src);
}
onImageError({ target: { tagName: 'SCRIPT' } });
console.log('PASS: 1025 local artwork files, integrity, stable IDs and image-error fallback');
