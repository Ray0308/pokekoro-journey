'use strict';
// Final assets and replaceable scenery are declared here, never inside title.js.
window.POKEKORO_TITLE = Object.freeze({
  assets: Object.freeze({
    logo: 'assets/title-logo.webp',
    heroIdle: 'assets/title/sprites/hero-idle.webp',
    heroAction: 'assets/title/sprites/hero-action.webp',
    heroGlance: 'assets/title/sprites/hero-glance.webp',
    companion: 'assets/title/sprites/companion-back.webp',
    companionEat: 'assets/title/sprites/companion-eat.webp',
    clouds: 'assets/title/placeholders/clouds.webp',
    mountains: 'assets/title/placeholders/mountains.webp',
    forest: 'assets/title/placeholders/forest.webp',
    river: 'assets/title/placeholders/river.webp',
    foreground: 'assets/title/placeholders/foreground.webp',
  }),
  defaults: Object.freeze({ sound: true, companion: true }),
  motion: Object.freeze({ cloudsSeconds: 85, idleSeconds: 3.2, departureMs: 950 }),
  idleScene: Object.freeze({ minDelayMs: 10000, maxDelayMs: 18000, eatMs: 2000, lookDelayMs: 150, lookMs: 850 }),
});
