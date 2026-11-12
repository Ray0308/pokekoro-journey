'use strict';
// Atlas cells follow the supplied reference: six columns, three rows.
const TYPE_SYMBOL_CELLS=[7,1,2,13,3,0,6,8,12,14,4,5,9,10,11,15,16,17];
const typeSymbolAtlas=new Image();typeSymbolAtlas.src='assets/types/symbols.png';
typeSymbolAtlas.onload=()=>{if(typeof draw==='function'&&typeof battle!=='undefined'&&battle)draw()};
function drawTypeGem(context,x,y,color,icon,selected,type){
 const r=selected?30:27;
 context.save();context.translate(x,y);
 const rgba=alpha=>{const hex=color.slice(1);return `rgba(${parseInt(hex.slice(0,2),16)},${parseInt(hex.slice(2,4),16)},${parseInt(hex.slice(4,6),16)},${alpha})`};
 function sphere(){context.beginPath();context.arc(0,0,r,0,Math.PI*2)}
 // Soft contact shadow anchors the transparent sphere above the board.
 context.save();context.scale(1,.3);const shadow=context.createRadialGradient(2,r/.3,1,2,r/.3,r*.9);shadow.addColorStop(0,'#23304a50');shadow.addColorStop(1,'#23304a00');context.fillStyle=shadow;context.fillRect(-r,r/.3-r,r*2,r*2);context.restore();
 sphere();context.shadowColor=selected?'#ffe17d':rgba(.7);context.shadowBlur=selected?14:8;
 const body=context.createRadialGradient(-8,-10,1,1,2,r*1.2);body.addColorStop(0,rgba(.38));body.addColorStop(.42,rgba(.62));body.addColorStop(.72,rgba(.87));body.addColorStop(1,rgba(.98));context.fillStyle=body;context.fill();context.shadowBlur=0;
 context.save();sphere();context.clip();
 const shade=context.createLinearGradient(-r,-r,r,r);shade.addColorStop(0,'#ffffff75');shade.addColorStop(.35,'#ffffff08');shade.addColorStop(.58,'#182c4100');shade.addColorStop(1,'#122c5c9c');context.fillStyle=shade;context.fillRect(-r,-r,r*2,r*2);
 // Refracted light pools at the lower rim, rather than washing out the symbol.
 const caustic=context.createRadialGradient(4,r*.66,0,4,r*.66,r*.72);caustic.addColorStop(0,'#eaffff9c');caustic.addColorStop(.32,'#d8ffff45');caustic.addColorStop(1,'#d8ffff00');context.fillStyle=caustic;context.fillRect(-r,-r,r*2,r*2);
 const gloss=context.createRadialGradient(-r*.32,-r*.65,0,-r*.32,-r*.65,r*.65);gloss.addColorStop(0,'#ffffffc0');gloss.addColorStop(.35,'#ffffff70');gloss.addColorStop(1,'#ffffff00');context.fillStyle=gloss;context.beginPath();context.ellipse(-r*.18,-r*.65,r*.67,r*.25,-.28,0,Math.PI*2);context.fill();context.restore();
 sphere();context.strokeStyle=selected?'#ffe57e':'#ffffff95';context.lineWidth=selected?3:1.2;context.stroke();
 context.beginPath();context.arc(0,0,r-2,Math.PI*1.08,Math.PI*1.6);context.strokeStyle='#ffffffdf';context.lineWidth=2;context.lineCap='round';context.stroke();
 context.beginPath();context.arc(0,0,r-3,Math.PI*.16,Math.PI*.47);context.strokeStyle='#d5ffffad';context.lineWidth=1.7;context.stroke();
 if(typeSymbolAtlas.complete&&typeSymbolAtlas.naturalWidth){const cell=TYPE_SYMBOL_CELLS[type];context.shadowColor='#14304a99';context.shadowBlur=3;context.shadowOffsetY=1;context.drawImage(typeSymbolAtlas,cell%6*130,Math.floor(cell/6)*130,130,130,-22,-22,44,44)}
 context.restore();
}
