// ブラウザと補助スクリプトの構文を、実行せずに確認する。
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
let checked = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'assets', '.git'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|cjs)$/.test(file)) {
      acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'script' });
      checked++;
    }
  }
}
walk(root);
console.log(`${checked} JavaScript files: syntax OK`);
