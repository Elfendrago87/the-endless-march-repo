'use strict';
// All tunable gameplay data lives here: player feel, sword attacks,
// enemy archetypes, arena layouts and the ten wave compositions.

const VIEW_W = 1280;
const VIEW_H = 720;
const GRAVITY = 2300;
const SPAWN_TIME = 0.75; // seconds an enemy spends materialising (harmless, unhittable)

// ---------------------------------------------------------------- player
const PLAYER_CFG = {
  w: 22, h: 50, maxHp: 100,
  runSpeed: 340, groundAccel: 3600, groundDecel: 4400, airAccel: 2400, airDecel: 1500,
  gravity: GRAVITY, fallMul: 1.3, maxFall: 1150,
  jumpVel: 900, jumpCut: 0.45, coyote: 0.1, jumpBuffer: 0.12,
  dashSpeed: 900, dashTime: 0.16, dashCooldown: 0.6, dashInvuln: 0.22,
  hurtInvuln: 0.9, hurtStun: 0.28,
  comboWindow: 0.32,   // time after a swing's recovery in which the combo continues
  maxAirAttacks: 2,    // per airtime - no infinite juggling
  pogoVel: 520,        // one small bounce per airtime when an air slash hits below
  healBetweenWaves: 20,
  bladeLength: 96,     // the sword is nearly twice the character's height
};

// Sword attacks. Timings in seconds. `box` is relative to the foot-centre,
// facing right. `sweep` = blade angle (radians, canvas space) at start/end
// of the active frames.
const PLAYER_ATTACKS = {
  a1: {
    name: 'a1', dmg: 15, startup: 0.07, active: 0.09, recovery: 0.22,
    chainAfter: 0.05, dashCancel: 0.08, next: 'a2', comboIndex: 1,
    lunge: 150, kb: 260, kbUp: -140, stagger: 0.28, hitstop: 0.045, shake: 0.08,
    box: { x: 4, y: -62, w: 94, h: 66 }, sweep: [-2.2, 0.9], thickness: 20,
  },
  a2: {
    name: 'a2', dmg: 18, startup: 0.08, active: 0.09, recovery: 0.24,
    chainAfter: 0.06, dashCancel: 0.08, next: 'a3', comboIndex: 2,
    lunge: 180, kb: 380, kbUp: -190, stagger: 0.34, hitstop: 0.055, shake: 0.13,
    box: { x: 0, y: -72, w: 102, h: 76 }, sweep: [1.1, -2.0], thickness: 24,
  },
  a3: {
    name: 'a3', dmg: 28, startup: 0.18, active: 0.11, recovery: 0.42,
    chainAfter: 99, dashCancel: 0.2, next: null, comboIndex: 0, heavy: true,
    lunge: 290, kb: 760, kbUp: -330, stagger: 0.6, hitstop: 0.11, shake: 0.4,
    box: { x: -12, y: -102, w: 140, h: 110 }, sweep: [-2.95, 1.35], thickness: 40,
  },
  air: {
    name: 'air', dmg: 16, startup: 0.06, active: 0.12, recovery: 0.2,
    chainAfter: 0.1, dashCancel: 0.06, next: null, comboIndex: 0, air: true,
    lunge: 0, kb: 300, kbUp: -60, stagger: 0.3, hitstop: 0.05, shake: 0.1,
    box: { x: -26, y: -60, w: 120, h: 116 }, sweep: [-1.8, 2.4], thickness: 24,
  },
};

// ---------------------------------------------------------------- enemies
// ai: behaviour routine. kbResist: 0 = full knockback, 1 = immovable.
// superArmor: never staggered. poise: only staggered by heavy hits (on cooldown).
const ENEMY_TYPES = {
  seeker: {
    ai: 'melee', w: 26, h: 46, hp: 30, speed: 150, accel: 1400, jump: 860,
    range: 62, windup: 0.45, active: 0.12, recovery: 0.5, cooldown: 0.6, step: 170,
    dmg: 10, kb: 300, box: { x: 0, y: -42, w: 60, h: 38 },
  },
  chaser: {
    ai: 'lunge', w: 30, h: 30, hp: 20, speed: 290, accel: 2200, jump: 860,
    lungeRange: 230, windup: 0.34, lungeSpeed: 720, lungeTime: 0.24, recovery: 0.6, cooldown: 0.45,
    dmg: 12, kb: 340, box: { x: -18, y: -32, w: 44, h: 32 },
  },
  brute: {
    ai: 'heavy', w: 58, h: 84, hp: 100, speed: 80, accel: 600,
    range: 125, windup: 0.9, active: 0.14, recovery: 1.0, cooldown: 0.8,
    dmg: 25, kb: 620, box: { x: -6, y: -74, w: 150, h: 80 },
    kbResist: 0.85, superArmor: true, big: true,
  },
  ranged: {
    ai: 'ranged', w: 24, h: 42, hp: 25, speed: 140, accel: 1200,
    keepMin: 230, keepMax: 520, windup: 0.65, recovery: 0.45, cooldown: 1.6,
    projSpeed: 430, dmg: 10, kb: 220,
  },
  flyer: {
    ai: 'flyer', w: 34, h: 22, hp: 30, speed: 230, hoverHeight: 210,
    windup: 0.5, diveSpeed: 760, diveTime: 0.8, recovery: 0.8, cooldown: 1.2,
    dmg: 14, kb: 320, box: { x: -22, y: -28, w: 44, h: 32 },
  },
  splitter: {
    ai: 'melee', w: 36, h: 40, hp: 40, speed: 125, accel: 1200, jump: 820,
    range: 62, windup: 0.5, active: 0.12, recovery: 0.55, cooldown: 0.7, step: 150,
    dmg: 10, kb: 280, box: { x: 0, y: -38, w: 62, h: 36 },
    split: { type: 'splitling', count: 2 },
  },
  splitling: {
    ai: 'melee', w: 20, h: 22, hp: 12, speed: 235, accel: 2000, jump: 780,
    range: 44, windup: 0.3, active: 0.1, recovery: 0.4, cooldown: 0.5, step: 220,
    dmg: 6, kb: 200, box: { x: 0, y: -22, w: 42, h: 22 },
  },
  shielder: {
    ai: 'shield', w: 32, h: 52, hp: 60, speed: 105, accel: 900,
    range: 72, windup: 0.5, active: 0.14, recovery: 0.8, cooldown: 1.0, bashSpeed: 380,
    turnDelay: 0.55, dmg: 12, kb: 380, box: { x: 6, y: -52, w: 54, h: 50 },
    kbResist: 0.5,
  },
  assassin: {
    ai: 'assassin', w: 22, h: 46, hp: 35, speed: 210, accel: 1800, shadowSpeed: 540,
    windup: 0.4, active: 0.12, dmg: 14, kb: 320, box: { x: 0, y: -44, w: 60, h: 40 },
  },
  elite: {
    ai: 'elite', w: 42, h: 68, hp: 150, speed: 190, accel: 1600, jump: 900,
    dmgTaken: 0.8, kbResist: 0.75, poise: 2.5, big: true,
    moves: {
      volley: { windup: 0.6, recovery: 0.5, dmg: 10, kb: 240, speed: 470 },
      dash:   { windup: 0.45, time: 0.26, speed: 860, recovery: 0.55, dmg: 18, kb: 420, box: { x: -20, y: -68, w: 84, h: 68 } },
      slam:   { windup: 0.75, active: 0.15, recovery: 0.8, dmg: 26, kb: 600, box: { x: -125, y: -58, w: 250, h: 64 } },
    },
  },
};

// ---------------------------------------------------------------- arenas
// solids: full collision. platforms: one-way (land from above, drop with down+jump).
// spawns: foot positions; air spawns are for flyers.
const ARENAS = {
  hall: {
    width: 1280, groundY: 620,
    solids: [
      { x: 0, y: -400, w: 40, h: 1120 }, { x: 1240, y: -400, w: 40, h: 1120 },
      { x: 0, y: 620, w: 1280, h: 100 },
    ],
    platforms: [
      { x: 170, y: 470, w: 230 }, { x: 880, y: 470, w: 230 }, { x: 525, y: 330, w: 230 },
    ],
    spawns: [
      { x: 90, y: 620 }, { x: 1190, y: 620 }, { x: 285, y: 470 }, { x: 995, y: 470 }, { x: 640, y: 330 },
      { x: 160, y: 170, air: true }, { x: 1120, y: 170, air: true }, { x: 640, y: 110, air: true },
    ],
    start: { x: 640, y: 620 },
  },
  steps: {
    width: 1920, groundY: 620,
    solids: [
      { x: 0, y: -400, w: 40, h: 1120 }, { x: 1880, y: -400, w: 40, h: 1120 },
      { x: 0, y: 620, w: 1920, h: 100 },
      { x: 900, y: 540, w: 120, h: 80 }, // low central pillar
    ],
    platforms: [
      { x: 250, y: 480, w: 210 }, { x: 510, y: 350, w: 190 },
      { x: 1220, y: 350, w: 190 }, { x: 1460, y: 480, w: 210 },
    ],
    spawns: [
      { x: 100, y: 620 }, { x: 1820, y: 620 }, { x: 605, y: 350 }, { x: 1315, y: 350 },
      { x: 355, y: 480 }, { x: 1565, y: 480 }, { x: 960, y: 540 },
      { x: 300, y: 150, air: true }, { x: 960, y: 110, air: true }, { x: 1620, y: 150, air: true },
    ],
    start: { x: 600, y: 620 },
  },
  rift: {
    width: 2240, groundY: 620,
    solids: [
      { x: 0, y: -400, w: 40, h: 1120 }, { x: 2200, y: -400, w: 40, h: 1120 },
      { x: 0, y: 620, w: 980, h: 100 },
      { x: 980, y: 700, w: 300, h: 20 },   // shallow trench between the two grounds
      { x: 1280, y: 620, w: 960, h: 100 },
    ],
    platforms: [
      { x: 1010, y: 470, w: 240 }, { x: 300, y: 450, w: 200 }, { x: 1740, y: 450, w: 200 },
      { x: 600, y: 310, w: 180 }, { x: 1460, y: 310, w: 180 },
    ],
    spawns: [
      { x: 100, y: 620 }, { x: 2140, y: 620 }, { x: 400, y: 450 }, { x: 1840, y: 450 },
      { x: 690, y: 310 }, { x: 1550, y: 310 }, { x: 1600, y: 620 }, { x: 640, y: 620 },
      { x: 400, y: 140, air: true }, { x: 1130, y: 110, air: true }, { x: 1840, y: 140, air: true },
    ],
    start: { x: 760, y: 620 },
  },
  // Wave 10: vast, empty, imposing. The door rises at the far right once it is over.
  final: {
    width: 3600, groundY: 620, final: true, zoom: 0.85,
    solids: [
      { x: 0, y: -600, w: 40, h: 1320 }, { x: 3560, y: -600, w: 40, h: 1320 },
      { x: 0, y: 620, w: 3600, h: 100 },
    ],
    platforms: [
      { x: 700, y: 450, w: 240 }, { x: 1500, y: 420, w: 260 }, { x: 2300, y: 450, w: 240 },
    ],
    spawns: [
      { x: 120, y: 620 }, { x: 3300, y: 620 }, { x: 820, y: 450 }, { x: 1630, y: 420 },
      { x: 2420, y: 450 }, { x: 2000, y: 620 }, { x: 1200, y: 620 }, { x: 2700, y: 620 },
      { x: 500, y: 120, air: true }, { x: 1600, y: 80, air: true }, { x: 2600, y: 120, air: true },
    ],
    start: { x: 300, y: 620 },
    door: { x: 3220, slabW: 380, slabH: 540, doorW: 130, doorH: 260 },
  },
};

// ---------------------------------------------------------------- waves
// Each wave is a list of phases; a phase is a list of [enemyType, count].
// A phase's enemies are interleaved and trickle in (maxAlive / interval).
// The next phase begins once the previous one is spawned and at most
// `advanceAt` enemies remain alive.
const WAVES = [
  { // 1 - learn to move, jump and swing
    arena: 'hall', maxAlive: 2, interval: 1.4, advanceAt: 0,
    phases: [[['seeker', 2]], [['seeker', 2]]],
  },
  { // 2 - faster enemies
    arena: 'hall', maxAlive: 3, interval: 1.1, advanceAt: 0,
    phases: [[['seeker', 2], ['chaser', 1]], [['chaser', 1], ['seeker', 1]]],
  },
  { // 3 - projectiles
    arena: 'steps', maxAlive: 4, interval: 1.0, advanceAt: 0,
    phases: [[['seeker', 2], ['chaser', 1]], [['ranged', 1], ['seeker', 1], ['chaser', 1]]],
  },
  { // 4 - vertical threats
    arena: 'steps', maxAlive: 4, interval: 1.0, advanceAt: 1,
    phases: [[['chaser', 2], ['ranged', 1]], [['flyer', 2], ['chaser', 1], ['ranged', 1]]],
  },
  { // 5 - heavy enemies
    arena: 'rift', maxAlive: 4, interval: 1.0, advanceAt: 0,
    phases: [[['seeker', 2], ['ranged', 1]], [['brute', 1], ['seeker', 1]], [['brute', 1], ['ranged', 1], ['seeker', 1]]],
  },
  { // 6 - density
    arena: 'steps', maxAlive: 6, interval: 0.7, advanceAt: 1,
    phases: [[['chaser', 3], ['flyer', 1]], [['splitter', 2], ['chaser', 1], ['flyer', 1]], [['splitter', 1], ['chaser', 2]]],
  },
  { // 7 - positional combat, reduced space
    arena: 'hall', maxAlive: 4, interval: 1.0, advanceAt: 1,
    phases: [[['shielder', 1], ['seeker', 2]], [['brute', 1], ['seeker', 2]], [['shielder', 1], ['brute', 1], ['seeker', 1]]],
  },
  { // 8 - pressure from every direction
    arena: 'rift', maxAlive: 5, interval: 0.8, advanceAt: 1,
    phases: [
      [['assassin', 1], ['chaser', 2], ['ranged', 1]],
      [['flyer', 2], ['ranged', 1], ['chaser', 1]],
      [['assassin', 2], ['flyer', 1], ['chaser', 1]],
    ],
  },
  { // 9 - the hardest conventional wave
    arena: 'steps', maxAlive: 6, interval: 0.8, advanceAt: 1,
    phases: [
      [['shielder', 1], ['ranged', 1], ['chaser', 2]],
      [['brute', 1], ['assassin', 1], ['flyer', 2]],
      [['assassin', 1], ['ranged', 2], ['chaser', 2], ['shielder', 1], ['brute', 1]],
    ],
  },
  { // 10 - a test of everything. Controlled, not endless.
    arena: 'final', final: true, maxAlive: 4, interval: 1.2, advanceAt: 0, phaseDelay: 1.6,
    phases: [
      [['shielder', 1], ['ranged', 1], ['flyer', 1]],
      [['brute', 1], ['assassin', 1], ['chaser', 1]],
      [['elite', 1]],
      [['elite', 1], ['ranged', 1], ['flyer', 1]],
    ],
  },
];
