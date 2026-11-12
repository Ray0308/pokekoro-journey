'use strict';
// Canvas coordinates stay at 420 × 420; pointer hit areas remain unchanged.
function drawTypeGem(context,x,y,color,icon,selected){
 const r=selected?30:27;
 context.save();context.translate(x,y);
 function outline(){context.beginPath();for(let i=0;i<8;i++){const angle=(i*45-112.5)*Math.PI/180,px=Math.cos(angle)*r,py=Math.sin(angle)*r;i?context.lineTo(px,py):context.moveTo(px,py)}context.closePath()}
 outline();context.shadowColor=selected?'#ffe17d':'#173b4866';context.shadowBlur=selected?12:4;context.shadowOffsetY=3;
 const gem=context.createRadialGradient(-10,-13,2,3,10,42);gem.addColorStop(0,'#f6ffff');gem.addColorStop(.32,color);gem.addColorStop(.75,color);gem.addColorStop(1,'#203a58');context.fillStyle=gem;context.fill();context.shadowBlur=0;context.shadowOffsetY=0;
 outline();context.save();context.clip();
 context.fillStyle='#ffffff55';context.beginPath();context.moveTo(-26,-12);context.lineTo(-11,-25);context.lineTo(15,-25);context.lineTo(9,-11);context.lineTo(-10,-9);context.closePath();context.fill();
 context.fillStyle='#14334a38';context.beginPath();context.moveTo(10,-10);context.lineTo(26,-12);context.lineTo(26,13);context.lineTo(11,25);context.lineTo(-11,25);context.lineTo(-9,11);context.lineTo(10,10);context.closePath();context.fill();
 context.strokeStyle='#ffffff50';context.lineWidth=1;context.beginPath();context.moveTo(-10,-10);context.lineTo(10,-10);context.lineTo(14,6);context.lineTo(0,16);context.lineTo(-14,6);context.closePath();context.stroke();context.restore();
 outline();context.strokeStyle=selected?'#ffe57e':'#f4ffffbb';context.lineWidth=selected?3:1.8;context.stroke();
 context.fillStyle='#ffffffbf';context.beginPath();context.ellipse(-11,-16,7,2,-.65,0,Math.PI*2);context.fill();
 context.font='23px sans-serif';context.textAlign='center';context.textBaseline='middle';context.shadowColor='#ffffffa0';context.shadowBlur=3;context.fillText(icon,0,2);context.restore();
}
