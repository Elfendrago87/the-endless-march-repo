'use strict';
// All tunable gameplay data lives here: player feel, sword attacks,
// enemy archetypes, the scrolling stage and the ten wave compositions.
//
// The Endless March is a belt-scroller: actors stand on a floor band and have
//   x  - horizontal position
//   z  - depth into the floor band (0 = back edge / horizon, DEPTH = front)
//   y  - elevation: the body rect's top; bottom (y + h) is 0 on the ground,
//        negative while airborne.
// Attacks connect when their box overlaps in x/elevation AND the two actors
// are within the attack's depth tolerance.

const GAME_VERSION = '0.6.0';
const VIEW_W = 1280;
const VIEW_H = 720;
const ZOOM = 1.5;          // world units -> screen pixels (final wave pulls back)
const FLOOR_Y = 250;       // world y of the horizon (back edge of the floor)
const DEPTH = 190;         // walkable depth band
const DEPTH_TOL = 16;      // default depth tolerance for melee hits
// The lane rule: you only hit what shares your lane. Every player attack uses
// this depth tolerance; the Warrior's sword wave is the one attack that
// crosses lanes (and magic, which strikes the whole screen).
const LANE = 16;
const GRAVITY = 2300;
const SPAWN_TIME = 0.75;   // seconds an enemy spends rising out of the ground

// ---------------------------------------------------------------- player
const PLAYER_CFG = {
  w: 22, h: 50, maxHp: 100, lives: 3, maxPots: 6, startPots: 1,
  walkSpeed: 160, depthSpeed: 110, runSpeed: 310, accel: 2600,
  gravity: GRAVITY, maxFall: 1150,
  jumpVel: 760, runJumpBoost: 1.05,
  doubleTap: 0.25,          // seconds between taps to start running
  hurtInvuln: 0.5, hurtStun: 0.3,
  downTime: 0.8, getupTime: 0.4, getupInvuln: 1.0,
  comboWindow: 0.32,
  maxAirAttacks: 1,
  healBetweenWaves: 15, restHeal: 25, foodHeal: 30,
  bladeLength: 96,          // the sword is nearly twice the character's height
};

// Sword attacks. Timings in seconds. `box` is relative to the foot-centre in
// elevation space, facing right. `sweep` = blade angle at start/end of the
// active frames. `depth` = depth tolerance. `knockdown` sends enemies flying.
const PLAYER_ATTACKS = {
  a1: {
    name: 'a1', dmg: 15, startup: 0.07, active: 0.09, recovery: 0.22,
    chainAfter: 0.05, next: 'a2', comboIndex: 1, depth: LANE,
    lunge: 110, kb: 180, kbUp: -100, stagger: 0.4, hitstop: 0.045, shake: 0.08,
    box: { x: 4, y: -62, w: 90, h: 66 }, sweep: [-2.2, 0.9], thickness: 20,
  },
  a2: {
    name: 'a2', dmg: 18, startup: 0.08, active: 0.09, recovery: 0.24,
    chainAfter: 0.06, next: 'a3', comboIndex: 2, depth: LANE,
    lunge: 130, kb: 220, kbUp: -120, stagger: 0.45, hitstop: 0.055, shake: 0.13,
    box: { x: 0, y: -72, w: 98, h: 76 }, sweep: [1.1, -2.0], thickness: 24,
  },
  a3: {
    name: 'a3', dmg: 28, startup: 0.18, active: 0.11, recovery: 0.42,
    chainAfter: 99, next: null, comboIndex: 0, heavy: true, knockdown: true, depth: LANE,
    lunge: 200, kb: 520, kbUp: -520, stagger: 0.6, hitstop: 0.11, shake: 0.4,
    box: { x: -12, y: -102, w: 136, h: 110 }, sweep: [-2.95, 1.35], thickness: 40,
    // the finisher releases a sword wave: it rolls forward across every lane
    wave: { dmg: 12, speed: 560, range: 400, kb: 260, kbUp: -300, stagger: 0.45 },
  },
  air: {
    name: 'air', dmg: 18, startup: 0.06, active: 0.14, recovery: 0.2,
    chainAfter: 99, next: null, comboIndex: 0, air: true, knockdown: true, depth: LANE,
    lunge: 0, kb: 320, kbUp: -380, stagger: 0.4, hitstop: 0.06, shake: 0.12,
    box: { x: -20, y: -60, w: 116, h: 120 }, sweep: [-1.8, 2.4], thickness: 26,
  },
  dash: { // running attack: a shoulder-first lunge that carries momentum
    name: 'dash', dmg: 22, startup: 0.05, active: 0.2, recovery: 0.38,
    chainAfter: 99, next: null, comboIndex: 0, knockdown: true, heavy: true, depth: LANE,
    lunge: 360, kb: 460, kbUp: -460, stagger: 0.5, hitstop: 0.08, shake: 0.25,
    box: { x: 0, y: -62, w: 104, h: 62 }, sweep: [-0.7, 0.35], thickness: 18,
  },
  back: { // attack+jump together: a full spin that clears both sides
    name: 'back', dmg: 14, startup: 0.06, active: 0.16, recovery: 0.42,
    chainAfter: 99, next: null, comboIndex: 0, knockdown: true, depth: LANE,
    lunge: 0, kb: 380, kbUp: -420, stagger: 0.5, hitstop: 0.07, shake: 0.18, bothSides: true,
    box: { x: -96, y: -70, w: 192, h: 74 }, sweep: [-2.9, 3.4], thickness: 22,
  },
};

// Archer: arrows fly down the lane you stand in. `shot` spawns arrows at the
// start of the active frames instead of a sword hitbox. The third shot of the
// combo is a fire arrow: it pierces, knocks down and sets its targets burning.
const ARCHER_ATTACKS = {
  a1: {
    name: 'a1', startup: 0.11, active: 0.05, recovery: 0.2, chainAfter: 0.05, next: 'a2', comboIndex: 1,
    sweep: [0, 0], depth: LANE,
    shot: { speed: 820, dmg: 12, kb: 160, kbUp: -80, stagger: 0.3 },
  },
  a2: {
    name: 'a2', startup: 0.11, active: 0.05, recovery: 0.2, chainAfter: 0.05, next: 'a3', comboIndex: 2,
    sweep: [0, 0], depth: LANE,
    shot: { speed: 820, dmg: 12, kb: 160, kbUp: -80, stagger: 0.3 },
  },
  a3: {
    name: 'a3', startup: 0.3, active: 0.05, recovery: 0.36, chainAfter: 99, next: null, comboIndex: 0, heavy: true,
    sweep: [0, 0], depth: LANE,
    shot: { speed: 900, dmg: 20, kb: 420, kbUp: -420, stagger: 0.5, knockdown: true, heavy: true, fire: true, pierce: true },
  },
  air: {
    name: 'air', startup: 0.08, active: 0.05, recovery: 0.24, chainAfter: 99, next: null, comboIndex: 0, air: true,
    sweep: [0.6, 0.6], depth: LANE,
    shot: { speed: 760, dmg: 13, kb: 220, kbUp: -200, stagger: 0.35, knockdown: true, angle: 0.6 },
  },
  dash: { // running attack: skid to a stop and loose a heavy piercing shot down the lane
    name: 'dash', startup: 0.12, active: 0.05, recovery: 0.4, chainAfter: 99, next: null, comboIndex: 0,
    sweep: [0, 0], depth: LANE, lunge: 60,
    shot: { speed: 900, dmg: 16, kb: 300, kbUp: -340, stagger: 0.4, knockdown: true, pierce: true },
  },
  back: { // a sweeping kick with the bow that clears both sides
    name: 'back', dmg: 11, startup: 0.06, active: 0.16, recovery: 0.4, chainAfter: 99, next: null, comboIndex: 0,
    knockdown: true, depth: LANE, lunge: 0, kb: 340, kbUp: -400, stagger: 0.45, hitstop: 0.06, shake: 0.15, bothSides: true,
    box: { x: -70, y: -60, w: 140, h: 62 }, sweep: [-2.9, 3.4], thickness: 14, slashR: 58,
  },
};

// Rogue: two daggers. Every press is a twin strike - two quick hits (`hits`
// = active windows inside the active phase, each a fresh hit). The run key is
// the evasive dash; attacking out of a dash or a run is the dash twin strike,
// which cuts straight through the enemy line.
const ROGUE_ATTACKS = {
  a1: {
    name: 'a1', dmg: 8, startup: 0.05, active: 0.17, recovery: 0.16, chainAfter: 0.04, next: 'a2', comboIndex: 1, depth: LANE,
    lunge: 90, kb: 110, kbUp: -60, stagger: 0.35, hitstop: 0.03, shake: 0.05,
    hits: [{ at: 0, dur: 0.06 }, { at: 0.09, dur: 0.06 }],
    box: { x: 2, y: -56, w: 62, h: 54 }, sweep: [-1.3, 0.9], sweep2: [1.2, -0.9], thickness: 10, slashR: 44,
  },
  a2: {
    name: 'a2', dmg: 8, startup: 0.05, active: 0.17, recovery: 0.16, chainAfter: 0.04, next: 'a3', comboIndex: 2, depth: LANE,
    lunge: 100, kb: 130, kbUp: -70, stagger: 0.38, hitstop: 0.03, shake: 0.06,
    hits: [{ at: 0, dur: 0.06 }, { at: 0.09, dur: 0.06 }],
    box: { x: 2, y: -58, w: 64, h: 56 }, sweep: [1.1, -1.2], sweep2: [-1.0, 1.1], thickness: 10, slashR: 44,
  },
  a3: { // cross cut: both blades at once
    name: 'a3', dmg: 18, startup: 0.12, active: 0.1, recovery: 0.32, chainAfter: 99, next: null, comboIndex: 0, heavy: true,
    knockdown: true, depth: LANE, lunge: 150, kb: 440, kbUp: -440, stagger: 0.55, hitstop: 0.08, shake: 0.28,
    box: { x: -4, y: -64, w: 84, h: 66 }, sweep: [-2.0, 1.2], sweep2: [2.0, -1.2], thickness: 18, slashR: 50, cross: true,
  },
  air: {
    name: 'air', dmg: 14, startup: 0.05, active: 0.14, recovery: 0.2, chainAfter: 99, next: null, comboIndex: 0, air: true,
    knockdown: true, depth: LANE, lunge: 0, kb: 280, kbUp: -360, stagger: 0.4, hitstop: 0.05, shake: 0.1,
    box: { x: -16, y: -54, w: 82, h: 110 }, sweep: [-1.4, 2.2], sweep2: [-1.2, 2.0], thickness: 14, slashR: 48,
  },
  dash: { // dash twin strike: lunge through the line, two cuts, untouchable while it lasts
    name: 'dash', dmg: 10, startup: 0.03, active: 0.24, recovery: 0.3, chainAfter: 99, next: null, comboIndex: 0,
    knockdown: true, iframes: true, depth: LANE, lunge: 560, kb: 360, kbUp: -380, stagger: 0.45, hitstop: 0.04, shake: 0.14,
    hits: [{ at: 0, dur: 0.1 }, { at: 0.12, dur: 0.1 }],
    box: { x: -14, y: -58, w: 74, h: 58 }, sweep: [-0.6, 0.5], sweep2: [0.6, -0.5], thickness: 12, slashR: 46,
  },
  back: { // blade spin
    name: 'back', dmg: 7, startup: 0.05, active: 0.2, recovery: 0.36, chainAfter: 99, next: null, comboIndex: 0,
    knockdown: true, depth: LANE, lunge: 0, kb: 320, kbUp: -380, stagger: 0.4, hitstop: 0.04, shake: 0.12, bothSides: true,
    hits: [{ at: 0, dur: 0.08 }, { at: 0.1, dur: 0.08 }],
    box: { x: -64, y: -60, w: 128, h: 62 }, sweep: [-2.9, 3.4], sweep2: [0.3, 6.5], thickness: 12, slashR: 50,
  },
};

// The three paths. `stats` override PLAYER_CFG for that class.
const CLASSES = {
  warrior: {
    key: 'warrior', name: 'WARRIOR', weapon: 'sword', attacks: PLAYER_ATTACKS, rest: -2.35,
    lines: ['the enormous sword.', 'slow, heavy, sweeping.', 'the third slash sends a sword wave', 'across every lane.'],
    stats: { maxHp: 100 },
  },
  archer: {
    key: 'archer', name: 'ARCHER', weapon: 'bow', attacks: ARCHER_ATTACKS, rest: 1.05,
    lines: ['arrows down the lane you stand in.', 'every third shot is a fire arrow:', 'it pierces, and it burns.', 'line up: arrows keep to their lane.'],
    stats: { maxHp: 90, walkSpeed: 170, depthSpeed: 118, runSpeed: 325 },
  },
  rogue: {
    key: 'rogue', name: 'ROGUE', weapon: 'daggers', attacks: ROGUE_ATTACKS, rest: 1.25, rest2: 1.45,
    lines: ['twin daggers. every strike cuts twice.', 'SHIFT dashes - untouchable while it lasts.', 'attack out of a dash: twin strike.'],
    stats: { maxHp: 85, walkSpeed: 185, depthSpeed: 128, runSpeed: 350 },
    dash: { speed: 640, time: 0.17, cooldown: 0.5, invuln: 0.22, strikeWindow: 0.15 },
  },
};
const CLASS_ORDER = ['warrior', 'archer', 'rogue'];

// Grab: attack point-blank into a staggered / idle small enemy.
const GRAB_CFG = { range: 38, depth: 12, kneeDmg: 8, knees: 2, throwDmg: 20, splashDmg: 10, holdTime: 1.2 };

// Magic: spends every stored pot; more pots, bigger spell.
const MAGIC_CFG = { baseDmg: 10, perPot: 9, castTime: 1.5, strikeAt: 0.75 };

// ---------------------------------------------------------------- enemies
// behavior: behaviour routine. kbResist: 0 = full knockback, 1 = immovable.
// superArmor: never staggered or knocked down by normal hits.
// poise: only staggered by heavy hits (on cooldown). depth: attack depth tolerance.
const ENEMY_TYPES = {
  seeker: {
    behavior: 'melee', w: 26, h: 46, hp: 30, speed: 105, depthSpeed: 80, accel: 1200,
    range: 62, windup: 0.45, active: 0.12, recovery: 0.5, cooldown: 0.8, step: 140,
    dmg: 10, kb: 260, box: { x: 0, y: -42, w: 60, h: 38 },
  },
  chaser: {
    behavior: 'lunge', w: 30, h: 30, hp: 20, speed: 220, depthSpeed: 150, accel: 1800,
    lungeRange: 220, windup: 0.36, lungeSpeed: 560, lungeTime: 0.28, recovery: 0.65, cooldown: 0.6,
    dmg: 12, kb: 300, box: { x: -18, y: -32, w: 44, h: 32 },
  },
  brute: {
    behavior: 'heavy', w: 58, h: 84, hp: 100, speed: 62, depthSpeed: 50, accel: 500,
    range: 120, windup: 0.9, active: 0.14, recovery: 1.0, cooldown: 1.0,
    dmg: 25, kb: 420, knockdown: true, depth: 30, box: { x: -6, y: -74, w: 146, h: 80 },
    kbResist: 0.85, superArmor: true, big: true,
  },
  ranged: {
    behavior: 'ranged', w: 24, h: 42, hp: 25, speed: 110, depthSpeed: 90, accel: 1000,
    keepMin: 200, keepMax: 380, windup: 0.65, recovery: 0.45, cooldown: 1.7,
    projSpeed: 360, dmg: 10, kb: 220,
  },
  flyer: {
    behavior: 'flyer', w: 34, h: 22, hp: 30, speed: 170, depthSpeed: 120, accel: 900, hover: 150,
    windup: 0.55, diveSpeed: 620, diveTime: 0.8, recovery: 0.9, cooldown: 1.4,
    dmg: 14, kb: 300, knockdown: true, depth: 22, box: { x: -22, y: -28, w: 44, h: 32 },
  },
  splitter: {
    behavior: 'melee', w: 36, h: 40, hp: 40, speed: 95, depthSpeed: 70, accel: 1000,
    range: 62, windup: 0.5, active: 0.12, recovery: 0.55, cooldown: 0.8, step: 130,
    dmg: 10, kb: 260, box: { x: 0, y: -38, w: 62, h: 36 },
    split: { type: 'splitling', count: 2 },
  },
  splitling: {
    behavior: 'melee', w: 20, h: 22, hp: 12, speed: 190, depthSpeed: 140, accel: 1800,
    range: 44, windup: 0.3, active: 0.1, recovery: 0.4, cooldown: 0.5, step: 180,
    dmg: 6, kb: 180, box: { x: 0, y: -22, w: 42, h: 22 },
  },
  shielder: {
    behavior: 'shield', w: 32, h: 52, hp: 60, speed: 85, depthSpeed: 70, accel: 800,
    range: 70, windup: 0.5, active: 0.14, recovery: 0.8, cooldown: 1.1, bashSpeed: 320,
    turnDelay: 0.55, dmg: 12, kb: 340, box: { x: 6, y: -52, w: 54, h: 50 },
    kbResist: 0.5, noGrab: true,
  },
  assassin: {
    behavior: 'assassin', w: 22, h: 46, hp: 35, speed: 170, depthSpeed: 130, accel: 1600, shadowSpeed: 420,
    windup: 0.42, active: 0.12, dmg: 14, kb: 300, box: { x: 0, y: -44, w: 60, h: 40 },
  },
  elite: {
    behavior: 'elite', w: 42, h: 68, hp: 170, speed: 140, depthSpeed: 100, accel: 1400,
    dmgTaken: 0.8, kbResist: 0.75, poise: 2.5, big: true, noGrab: true,
    moves: {
      volley: { windup: 0.6, recovery: 0.5, dmg: 10, kb: 240, speed: 380 },
      dash:   { windup: 0.45, time: 0.3, speed: 640, recovery: 0.6, dmg: 18, kb: 400, knockdown: true, box: { x: -20, y: -68, w: 84, h: 68 } },
      slam:   { windup: 0.75, active: 0.15, recovery: 0.8, dmg: 26, kb: 460, knockdown: true, depth: 48, box: { x: -125, y: -58, w: 250, h: 64 } },
    },
  },
  // Not hostile. Carries a sack; every hit shakes loose a pot or food.
  thief: {
    behavior: 'thief', w: 18, h: 30, hp: 2, speed: 150, depthSpeed: 90, accel: 1400, noGrab: true, harmless: true,
  },
};

// ---------------------------------------------------------------- stage
// One long road. The camera locks at each wave's lockX; between waves the
// player walks on (GO ->). Scenery is distant black silhouettes on the horizon.
const STAGE = {
  length: 10500,
  segments: [
    { x: 0, scenery: 'plain' },
    { x: 2700, scenery: 'ruins' },
    { x: 5500, scenery: 'fortress' },
    { x: 8400, scenery: 'void' },
  ],
  door: { x: 10150, slabW: 300, slabH: 290, doorW: 110, doorH: 200 },
};

// ---------------------------------------------------------------- waves
// Each wave is a list of phases; a phase is a list of [enemyType, count].
// A phase's enemies are interleaved and trickle in (maxAlive / interval).
// The next phase begins once the previous one is spawned and at most
// `advanceAt` enemies remain alive. `tokens` = how many enemies may be
// winding up / attacking at once. `thieves` wander through mid-wave.
// `rest` = a night camp follows the wave.
const WAVES = [
  { // 1 - learn to walk the road and swing
    lockX: 0, maxAlive: 2, interval: 1.4, tokens: 1,
    phases: [[['seeker', 2]], [['seeker', 2]]],
  },
  { // 2 - faster enemies
    lockX: 900, maxAlive: 3, interval: 1.1, tokens: 2, thieves: 1,
    phases: [[['seeker', 2], ['chaser', 1]], [['chaser', 1], ['seeker', 1]]],
  },
  { // 3 - projectiles
    lockX: 1800, maxAlive: 4, interval: 1.0, tokens: 2, rest: true,
    phases: [[['seeker', 2], ['chaser', 1]], [['ranged', 1], ['seeker', 1], ['chaser', 1]]],
  },
  { // 4 - threats from above
    lockX: 2900, maxAlive: 4, interval: 1.0, advanceAt: 1, tokens: 2,
    phases: [[['chaser', 2], ['ranged', 1]], [['flyer', 2], ['chaser', 1], ['ranged', 1]]],
  },
  { // 5 - heavy enemies
    lockX: 3800, maxAlive: 4, interval: 1.0, tokens: 2, thieves: 1,
    phases: [[['seeker', 2], ['ranged', 1]], [['brute', 1], ['seeker', 1]], [['brute', 1], ['ranged', 1], ['seeker', 1]]],
  },
  { // 6 - density
    lockX: 4700, maxAlive: 6, interval: 0.7, advanceAt: 1, tokens: 3, rest: true,
    phases: [[['chaser', 3], ['flyer', 1]], [['splitter', 2], ['chaser', 1], ['flyer', 1]], [['splitter', 1], ['chaser', 2]]],
  },
  { // 7 - positional combat
    lockX: 5800, maxAlive: 4, interval: 1.0, advanceAt: 1, tokens: 2,
    phases: [[['shielder', 1], ['seeker', 2]], [['brute', 1], ['seeker', 2]], [['shielder', 1], ['brute', 1], ['seeker', 1]]],
  },
  { // 8 - pressure from every direction
    lockX: 6700, maxAlive: 5, interval: 0.8, advanceAt: 1, tokens: 3, thieves: 1,
    phases: [
      [['assassin', 1], ['chaser', 2], ['ranged', 1]],
      [['flyer', 2], ['ranged', 1], ['chaser', 1]],
      [['assassin', 2], ['flyer', 1], ['chaser', 1]],
    ],
  },
  { // 9 - the hardest conventional wave
    lockX: 7600, maxAlive: 6, interval: 0.8, advanceAt: 1, tokens: 3,
    phases: [
      [['shielder', 1], ['ranged', 1], ['chaser', 2]],
      [['brute', 1], ['assassin', 1], ['flyer', 2]],
      [['assassin', 1], ['ranged', 2], ['chaser', 2], ['shielder', 1], ['brute', 1]],
    ],
  },
  { // 10 - a test of everything. Vast and empty. Controlled, not endless.
    lockX: 8700, zoom: 1.2, final: true, maxAlive: 4, interval: 1.2, advanceAt: 0, phaseDelay: 1.6, tokens: 2,
    phases: [
      [['shielder', 1], ['ranged', 1], ['flyer', 1]],
      [['brute', 1], ['assassin', 1], ['chaser', 1]],
      [['elite', 1]],
      [['elite', 1], ['ranged', 1], ['flyer', 1]],
    ],
  },
];
