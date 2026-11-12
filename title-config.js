'use strict';
// Final assets and replaceable scenery are declared here, never inside title.js.
window.POKEKORO_TITLE = Object.freeze({
  assets: Object.freeze({
    logo: 'assets/title-logo-fixed.webp',
    heroIdle: 'assets/title/sprites/hero-idle.webp',
    heroAction: 'assets/title/sprites/hero-action.webp',
    heroGlance: 'assets/title/sprites/hero-glance.webp',
    companion: 'assets/title/sprites/companion-back.webp',
    companionEat: 'assets/title/sprites/companion-eat.webp',
    clouds: 'assets/title/placeholders/clouds.webp',
    scene: 'assets/title/background-v2.webp',
    foregroundHill: 'assets/title/foreground-hill-v2.webp',
  }),
  defaults: Object.freeze({ sound: true }),
  audio: Object.freeze({ titleBgm: 'assets/audio/title-opening.mp3', volume: 0.35, startCry: 'assets/audio/munchlax-cry.mp3', cryMs: 2100, cryOffsetSeconds: 0.025 }),
  motion: Object.freeze({ cloudsSeconds: 85, idleSeconds: 3.2, departureMs: 2400, diceThrowMs: 1100, diceSettleMs: 220 }),
  breeze: Object.freeze({ minDelayMs: 1200, maxDelayMs: 2800, minLeaves: 4, maxLeaves: 6, minLifeMs: 5500, maxLifeMs: 7500, staggerMs: 250 }),
  idleScene: Object.freeze({ minDelayMs: 10000, maxDelayMs: 18000, eatMs: 2000, lookDelayMs: 150, lookMs: 850 }),
});
