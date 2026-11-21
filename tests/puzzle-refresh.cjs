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
vm.runInContext(
  `
const assist=createPuzzleAssist();
const diagonal=Array.from({length:30},(_,i)=>i+100);diagonal[0]=diagonal[7]=diagonal[14]=2;
assert.deepEqual(puzzleHintPath(diagonal),[0,7,14]);
const wrap=Array.from({length:30},(_,i)=>i+200);wrap[5]=wrap[6]=wrap[7]=100;
assert.equal(puzzleHintPath(wrap).length,0,'no row wrapping');
const choices=Array.from({length:30},(_,i)=>i+100);choices[0]=choices[1]=choices[2]=2;choices[12]=choices[13]=choices[14]=9;
assert.deepEqual(puzzleHintPath(choices,[9]),[12,13,14]);
assert.deepEqual(puzzleHintPath(choices,[17]),[0,1,2],'legal fallback is not deadlock');
assist.touch(100);
assert.equal(assist.update(diagonal,[],1599),'none');
assert.equal(assist.path.length,0);
assert.equal(assist.update(diagonal,[],1600),'hint');
assert.deepEqual(assist.path,[0,7,14]);
assist.touch(2000);assert.equal(assist.path.length,0);
assert.equal(assist.update(diagonal,[],4000,true),'none','held pointer is never interrupted');
assist.touch(4100);assert.equal(assist.update(diagonal,[],5500),'none');
assert.equal(assist.update(diagonal,[],5600),'hint');
assist.touch(6000);
assert.equal(assist.update(Array.from({length:30},(_,i)=>i),[],6000),'refresh','deadlock refresh is immediate');
assert.equal(assist.update(Array.from({length:30},(_,i)=>i),[],6001,true),'none','never replace under a held pointer');
assert.equal(assist.path.length,0);
assert.equal(assist.update(diagonal,[],6001),'none','fresh idle interval after refresh');
assert.deepEqual(puzzleHintPath(null),[]);
`,
  context,
);
console.log(
  'PASS 1.5s hint boundary, diagonal/legal paths, useful preference, touch/hold reset and deadlock',
);
