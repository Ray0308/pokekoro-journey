const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ assert });
vm.runInContext(fs.readFileSync('party-rules.js', 'utf8'), context);
vm.runInContext(
  `
assert.equal(PUZZLE_LAYOUT.count, 30);
assert.equal(PUZZLE_LAYOUT.width / PUZZLE_LAYOUT.columns, PUZZLE_LAYOUT.height / PUZZLE_LAYOUT.rows);
let grid = Array.from({length:30}, (_,i)=>i);
randomPartyType = () => 17;
refillPuzzle([24,25,26,27,28,29,12,13]);
assert.equal(grid.length,30);
assert.equal(grid[24],18);
assert.equal(grid[18],6);
assert.equal(grid[12],0);
assert.equal(grid[6],17);
assert.equal(grid[0],17);
assert.ok(grid.every(Number.isInteger));
refillPuzzle(Array.from({length:30},(_,i)=>i));
assert.equal(grid.length,30);
assert.ok(grid.every(x=>x===17));
`,
  context,
);
console.log(
  'PASS: 6×5 square cells, bottom-row clears, gravity and complete refill preserve 30 cells',
);
