'use strict';
const BALL_EXCHANGE_RULES=Object.freeze([
 Object.freeze({id:'normal-super',from:'normal',to:'super',cost:5}),
 Object.freeze({id:'super-hyper',from:'super',to:'hyper',cost:5})
]);
// Revalidate stock at commit time; only these two recipes are allowed.
function ballExchangeQuote(stock,id,quantity){
 const rule=BALL_EXCHANGE_RULES.find(r=>r.id===id);if(!rule||!Number.isSafeInteger(quantity)||quantity<1)return null;
 const from=BALLS.find(b=>b.id===rule.from),to=BALLS.find(b=>b.id===rule.to),cost=rule.cost*quantity;
 if(!Number.isSafeInteger(cost)||!Number.isSafeInteger(stock[from.key])||stock[from.key]<cost||!Number.isSafeInteger(stock[to.key])||stock[to.key]<0||!Number.isSafeInteger(stock[to.key]+quantity))return null;
 return {from,to,cost,quantity,fromStock:stock[from.key]-cost,toStock:stock[to.key]+quantity};
}
(() => {
 let trading=false;
 const dialog=document.querySelector('#ball-exchange'),rows=document.querySelector('#exchange-recipes'),status=document.querySelector('#exchange-status');
 function update(row){const id=row.dataset.recipe,input=row.querySelector('input'),quote=ballExchangeQuote(state,id,Number(input.value));row.querySelector('.exchange-submit').disabled=!quote;row.querySelector('.exchange-preview').textContent=quote?`${quote.cost}個つかって ${quote.quantity}個もらう`:'交換できる個数を えらんでね';row.querySelector('[data-adjust="minus"]').disabled=Number(input.value)<=1||input.disabled;row.querySelector('[data-adjust="plus"]').disabled=Number(input.value)>=Number(input.max)||input.disabled}
 function renderRows(){rows.innerHTML=BALL_EXCHANGE_RULES.map(rule=>{const from=BALLS.find(b=>b.id===rule.from),to=BALLS.find(b=>b.id===rule.to),max=Math.floor(state[from.key]/rule.cost),id='exchange-'+rule.id;return `<section class="exchange-recipe" data-recipe="${rule.id}"><div class="exchange-rate"><span><img src="${from.image}" alt=""><strong>${from.name}</strong><small>×${rule.cost}</small></span><b aria-hidden="true">→</b><span><img src="${to.image}" alt=""><strong>${to.name}</strong><small>×1</small></span></div><p class="exchange-stock">もちもの：${from.name} ${state[from.key]}個 ／ ${to.name} ${state[to.key]}個</p><label for="${id}">もらう個数</label><div class="exchange-quantity"><button data-adjust="minus" aria-label="${to.name}の個数を減らす">−</button><input id="${id}" type="number" inputmode="numeric" min="1" max="${max}" step="1" value="${max?1:0}" ${max?'':'disabled'}><button data-adjust="plus" aria-label="${to.name}の個数を増やす">＋</button><button data-adjust="max" ${max?'':'disabled'}>最大</button></div><p class="exchange-preview"></p><button class="primary exchange-submit">交換する</button>${max?'':'<small class="exchange-shortage">'+from.name+'が あと'+(rule.cost-state[from.key])+'個 必要だよ</small>'}</section>`}).join('');rows.querySelectorAll('.exchange-recipe').forEach(update)}
 rows.addEventListener('input',e=>{const row=e.target.closest('.exchange-recipe');if(row)update(row)});
 rows.addEventListener('click',e=>{const row=e.target.closest('.exchange-recipe'),button=e.target.closest('button');if(!row||!button||button.disabled||trading)return;const input=row.querySelector('input');if(button.dataset.adjust){const max=Number(input.max),current=Number(input.value);input.value=button.dataset.adjust==='max'?max:Math.max(1,Math.min(max,(Number.isSafeInteger(current)?current:1)+(button.dataset.adjust==='plus'?1:-1)));update(row);return}
 if(!button.classList.contains('exchange-submit'))return;
 const quote=ballExchangeQuote(state,row.dataset.recipe,Number(input.value));if(!quote){status.textContent='ボールの数を もう一度 たしかめてね';renderRows();return}
 trading=true;setTimeout(()=>{trading=false;rows.querySelectorAll('.exchange-recipe').forEach(update)},400);state[quote.from.key]=quote.fromStock;state[quote.to.key]=quote.toStock;save();render();renderRows();rows.querySelectorAll('.exchange-submit').forEach(b=>b.disabled=true);status.textContent=`${quote.from.name}${quote.cost}個を ${quote.to.name}${quote.quantity}個に 交換した！`;window.PokekoroSfx?.play('success');
 });
 document.querySelector('#exchange-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>document.querySelector('#roll').focus({preventScroll:true}));
 document.addEventListener('title:start',()=>{if(dialog.open)dialog.close()});
 window.PokekoroBallExchange=Object.freeze({open(){if(isSafari()||isRainbow()||currentSquares()[state.pos]!=='exchange')return;busy=false;render();status.textContent='あまったボールを 上のボールに 交換しよう！';renderRows();dialog.showModal()}});
})();
