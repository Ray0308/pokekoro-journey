const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ assert });
vm.runInContext(fs.readFileSync('party-rules.js', 'utf8'), context);
vm.runInContext(
  `
function hasTriple(board, types) {
  for(let row=0;row<PUZZLE_LAYOUT.rows;row++)
    for(let col=0;col<PUZZLE_LAYOUT.columns-2;col++) {
      const i=row*PUZZLE_LAYOUT.columns+col;
      if(types.includes(board[i])&&board[i]===board[i+1]&&board[i]===board[i+2]) return true;
    }
  return false;
}
const original=Array.from({length:30},(_,i)=>i%18),snapshot=[...original];
for(let seed=1;seed<=1000;seed++) {
  let value=seed;
  const rng=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296};
  const next=refreshedPuzzle(original,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17],[2,6],rng);
  assert.equal(next.length,30);
  assert.ok(next.every(v=>Number.isInteger(v)&&v>=0&&v<18));
  assert.ok(hasTriple(next,[2,6]));
  assert.deepEqual(original,snapshot);
}
for(const rng of [()=>0,()=>1,()=>NaN]) {
  const next=refreshedPuzzle(Array(30).fill(1),[1,2],[2],rng);
  assert.ok(next.every(v=>v===1||v===2));
  assert.ok(hasTriple(next,[2]));
}
assert.notDeepEqual(refreshedPuzzle(Array(30).fill(1),[1,2],[],()=>0),Array(30).fill(1));
assert.ok(hasTriple(refreshedPuzzle(original,[1,2],[17],()=>0),[1,2]));
assert.ok(hasTriple(refreshedPuzzle(Array(30).fill(1),[1],[],()=>0),[1]));
assert.equal(refreshedPuzzle(original,[]),null);
assert.equal(refreshedPuzzle(null,[1]),null);
assert.equal(refreshedPuzzle(Array(36).fill(1),[1]),null);
`,
  context,
);
console.log(
  'PASS: refresh guarantees playable 30-cell boards, preferred types, immutable input and bounded RNG',
);
