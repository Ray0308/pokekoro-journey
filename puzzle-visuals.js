'use strict';
// Atlas cells follow the supplied reference: six columns, three rows.
const TYPE_SYMBOL_CELLS=[7,1,2,13,3,0,6,8,12,14,4,5,9,10,11,15,16,17];
const typeSymbolAtlas=new Image();typeSymbolAtlas.src='assets/types/symbols.png';
typeSymbolAtlas.onload=()=>{if(typeof draw==='function'&&typeof battle!=='undefined'&&battle)draw()};
function drawTypeGem(context,x,y,color,icon,selected,type){
 const r=selected?30:27;
 context.save();context.translate(x,y);
 context.beginPath();context.arc(0,0,r,0,Math.PI*2);
 context.shadowColor=selected?'#ffe17d':color;context.shadowBlur=selected?12:5;context.shadowOffsetY=selected?0:2;
 const body=context.createRadialGradient(-7,-10,2,3,8,40);body.addColorStop(0,color);body.addColorStop(.58,color);body.addColorStop(1,'#24344c');context.fillStyle=body;context.fill();context.shadowBlur=0;context.shadowOffsetY=0;
 context.strokeStyle=selected?'#ffe57e':'#ffffffb0';context.lineWidth=selected?3:1.5;context.stroke();
 // Keep specular reflections at the rim, away from the large white symbol.
 context.beginPath();context.arc(-1,-1,r-4,Math.PI*1.08,Math.PI*1.63);context.strokeStyle='#ffffff90';context.lineWidth=2.5;context.lineCap='round';context.stroke();
 const halo=context.createRadialGradient(0,10,1,0,10,22);halo.addColorStop(0,'#ffffff18');halo.addColorStop(1,'#ffffff00');context.fillStyle=halo;context.beginPath();context.arc(0,0,r-3,0,Math.PI*2);context.fill();
 if(typeSymbolAtlas.complete&&typeSymbolAtlas.naturalWidth){const cell=TYPE_SYMBOL_CELLS[type];context.shadowColor='#1b34455c';context.shadowBlur=2;context.shadowOffsetY=1;context.drawImage(typeSymbolAtlas,cell%6*130,Math.floor(cell/6)*130,130,130,-22,-22,44,44)}
 context.restore();
}
