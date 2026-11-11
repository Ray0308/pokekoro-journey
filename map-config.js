'use strict';
// Add maps here; save mapId, background and UI palette remain independent of progress.
const MAPS=Object.freeze({
 viridian:Object.freeze({name:'トキワの森',nextMap:'meadow',background:'assets/map/forest.webp',trainerIcon:'assets/map/viridian-trainer.webp',
  boss:Object.freeze({name:'むしとりしょうねん',image:'assets/map/viridian-boss.webp',icon:'assets/map/viridian-boss-icon.webp',pokemonId:9,ball:'assets/poke-ball.jpg'}),
  colors:Object.freeze({surface:'#b6d9bd',surfaceEnd:'#e1ecce',dock:'#244c40',dockEnd:'#183d35',edge:'#c6d6a0',rim:'#406650',ink:'#e0edcf',muted:'#c6d9b7',slot:'#a6c39b',road:'#dcc18b',roadEdge:'#416d3a'})}),
 // Temporary second area: replace artwork, boss and nextMap as the adventure grows.
 meadow:Object.freeze({name:'ひだまりの草原',background:'assets/map/meadow.webp',trainerIcon:'assets/map/viridian-trainer.webp',
  boss:Object.freeze({name:'むしとりしょうねん',image:'assets/map/viridian-boss.webp',icon:'assets/map/viridian-boss-icon.webp',pokemonId:9,ball:'assets/poke-ball.jpg'}),
  colors:Object.freeze({surface:'#e7e2af',surfaceEnd:'#f4eccd',dock:'#655335',dockEnd:'#443d2d',edge:'#e3d7a3',rim:'#96815b',ink:'#fff0cf',muted:'#e4d2a9',slot:'#d2b980',road:'#e1c18c',roadEdge:'#8c8051'})})
});
