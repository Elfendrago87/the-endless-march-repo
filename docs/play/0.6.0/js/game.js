'use strict';
// Game state machine, main loop, camera, rendering, HUD and the final door.

const STATE = {
  START: 'START',
  SELECT: 'SELECT',             // choose Warrior / Archer / Rogue
  ADVANCE: 'ADVANCE',           // walking the road to the next wave (GO ->)
  WAVE_INTRO: 'WAVE_INTRO',     // camera locked, banner, player can move
  WAVE: 'WAVE',
  FINAL_WAVE: 'FINAL_WAVE',
  WAVE_COMPLETE: 'WAVE_COMPLETE',
  REST: 'REST',                 // night camp: thieves come for your sack
  DOOR: 'DOOR',
  ENDING: 'ENDING',
  PLAYER_DEAD: 'PLAYER_DEAD',   // out of lives: the run ends
};

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const STEP = 1 / 60;

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stage = new Stage();
    this.player = new Player(this);
    this.enemyPool = new Pool(() => new Enemy(), 48);
    this.enemies = this.enemyPool.items;
    this.waves = new WaveManager(this);
    this.cam = { x: 0, y: 0, zoom: ZOOM };
    this.drawList = [];
    this.thiefTimers = [];
    this.spawnSide = 1;

    const q = new URLSearchParams(location.search);
    this.debug = q.has('debug') || !!window.SEEK_TEST_BUILD;
    this.god = q.has('god');
    this.classKey = CLASS_ORDER.includes(q.get('class')) ? q.get('class') : 'warrior';
    this.selIndex = 0;
    this.firstWave = clamp((parseInt(q.get('wave'), 10) || 1) - 1, 0, WAVES.length - 1);

    this.time = 0;
    this.paused = false;
    this.hitstopT = 0;
    this.slowT = 0; this.slowScale = 1;
    this.fadeIn = 1;
    this.hurtFlash = 0;
    this.hudAlpha = 1;
    this.waveIndex = 0;
    this.locked = true; this.lockX = 0;
    this.night = 0; this.nightTarget = 0;
    this.magic = null;
    this.doorRise = 0; this.doorOpen = 0; this.whiteout = 0; this.endWalk = false; this.endT = 0;
    this.chimed = false;

    this.toTitle();

    Input.init(canvas);
    Input.toView = (x, y) => ({ x: (x * this.dpr - this.viewX) / this.viewScale, y: (y * this.dpr - this.viewY) / this.viewScale });
    Input.onTap = (x, y) => this.onTap(x, y);
    Input.onRawKey = (code) => {
      if (this.debug && code === 'KeyN') this.debugClearWave();
      if (this.debug && code === 'KeyH') { this.player.hp = this.player.maxHp; this.player.pots = PLAYER_CFG.maxPots; }
      if (code === 'KeyM' && Sound.out) Sound.out.gain.value = Sound.out.gain.value > 0 ? 0 : 0.5;
    };
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => { if (this.pausable()) this.paused = true; });
    this.resize();

    this.last = performance.now() / 1000;
    this.acc = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  // ------------------------------------------------------------ plumbing
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    const s = Math.min(w / VIEW_W, h / VIEW_H);
    this.viewScale = s * dpr;
    this.dpr = dpr;
    this.viewX = (w - VIEW_W * s) / 2 * dpr;
    this.viewY = (h - VIEW_H * s) / 2 * dpr;
  }

  loop(ts) {
    const now = ts / 1000;
    const frame = Math.min(0.1, Math.max(0, now - this.last));
    this.last = now;
    this.acc += frame;
    Input.pollGamepad();
    let steps = 0;
    while (this.acc >= STEP && steps < 6) {
      this.step(STEP);
      Input.endStep();
      this.acc -= STEP;
      steps++;
    }
    if (steps >= 6) this.acc = 0;
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  get viewW() { return VIEW_W / this.cam.zoom; }
  get enemyMinX() { return this.locked ? this.cam.x - 150 : 0; }
  get enemyMaxX() { return this.locked ? this.cam.x + this.viewW + 150 : this.stage.length; }
  get fightMinX() { return this.locked ? this.cam.x + 4 : 0; }
  get fightMaxX() { return this.locked ? this.cam.x + this.viewW - 4 : this.stage.length; }

  setState(s) { this.state = s; this.stateT = 0; }

  get combatAllowed() {
    const s = this.state;
    return s === STATE.WAVE || s === STATE.FINAL_WAVE || s === STATE.WAVE_INTRO ||
      s === STATE.WAVE_COMPLETE || s === STATE.ADVANCE || s === STATE.REST;
  }

  pausable() { return this.combatAllowed || this.state === STATE.DOOR; }

  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  slowmo(scale, t) { this.slowScale = scale; this.slowT = t; }

  // ------------------------------------------------------------ flow
  resetWorld() {
    Sound.droneStop(0.1);
    this.enemyPool.clear();
    Projectiles.clear();
    Arrows.clear();
    SwordWaves.clear();
    Items.clear();
    FX.clear();
    this.waves.def = null;
    this.magic = null;
    this.night = 0; this.nightTarget = 0;
    this.whiteout = 0;
    this.doorRise = 0; this.doorOpen = 0; this.endWalk = false; this.endT = 0;
    this.thiefTimers.length = 0;
    this.slowT = 0;
    this.fadeIn = 1;
  }

  toTitle() {
    this.resetWorld();
    this.player.setClass(this.classKey);
    this.player.reset(200, DEPTH * 0.55);
    this.player.control = false;
    this.locked = true; this.lockX = 0;
    this.hudAlpha = 0;
    this.setState(STATE.START);
    this.updateCamera(0, true);
  }

  startRun() {
    this.resetWorld();
    const i = this.firstWave;
    const lock = WAVES[i].lockX;
    this.player.setClass(this.classKey);
    this.player.reset(lock + 140, DEPTH * 0.55);
    this.hudAlpha = 1;
    this.locked = true; this.lockX = lock;
    this.cam.x = lock;
    this.beginWaveIntro(i);
    this.updateCamera(0, true);
  }

  beginWaveIntro(i) {
    this.waveIndex = i;
    this.waves.def = null;
    this.locked = true;
    this.lockX = WAVES[i].lockX;
    this.setState(STATE.WAVE_INTRO);
    Sound.waveStart(!!WAVES[i].final);
  }

  startWave() {
    const def = WAVES[this.waveIndex];
    this.waves.start(this.waveIndex);
    this.thiefTimers.length = 0;
    for (let k = 0; k < (def.thieves || 0); k++) this.thiefTimers.push(rand(4, 14));
    this.setState(def.final ? STATE.FINAL_WAVE : STATE.WAVE);
  }

  onWaveCleared() {
    const final = !!WAVES[this.waveIndex].final;
    this.setState(STATE.WAVE_COMPLETE);
    this.slowmo(0.3, 0.7);
    Sound.waveClear();
    for (const p of Projectiles.pool.items) if (p.active) Projectiles.kill(p);
    if (!final) this.player.hp = Math.min(this.player.maxHp, this.player.hp + PLAYER_CFG.healBetweenWaves);
  }

  startAdvance() {
    this.locked = false;
    this.setState(STATE.ADVANCE);
  }

  startRest() {
    this.setState(STATE.REST);
    this.nightTarget = 1;
    this.thiefTimers.length = 0;
    this.thiefTimers.push(1.8, 3.6, 5.6);
    Sound.chime();
  }

  startDoor() {
    this.locked = false;
    this.setState(STATE.DOOR);
    this.doorRise = 0; this.doorOpen = 0; this.endWalk = false; this.endT = 0; this.whiteout = 0;
    this.player.speedMul = 1;
    Sound.droneStart();
    Sound.rumble();
  }

  // ------------------------------------------------------------ step
  step(dt) {
    Input.buttonsLive = this.pausable() || this.paused;
    if (Input.pressed.pause && this.pausable()) this.paused = !this.paused;
    if (this.paused) {
      if (Input.pressed.confirm) this.paused = false;
      return;
    }
    this.time += dt;
    this.fadeIn = Math.max(0, this.fadeIn - dt * 1.6);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.night = approach(this.night, this.nightTarget, dt * 0.8);
    const hudTarget = (this.state === STATE.START || this.state === STATE.SELECT || this.state === STATE.DOOR || this.state === STATE.ENDING) ? 0 : 1;
    this.hudAlpha = approach(this.hudAlpha, hudTarget, dt * 1.5);

    if (this.hitstopT > 0) {
      this.hitstopT -= dt;
      FX.trauma = Math.max(0, FX.trauma - dt);
      return;
    }

    let sdt = dt;
    if (this.slowT > 0) { this.slowT -= dt; sdt = dt * this.slowScale; }
    this.stateT += dt;

    switch (this.state) {
      case STATE.START:
        this.player.update(dt);
        FX.update(dt);
        if (Input.anyPressed) { this.selIndex = Math.max(0, CLASS_ORDER.indexOf(this.classKey)); this.setState(STATE.SELECT); }
        break;

      case STATE.SELECT: {
        this.player.update(dt);
        const n = CLASS_ORDER.length;
        if (Input.pressed.left) { this.selIndex = (this.selIndex + n - 1) % n; Sound.pickup(); }
        if (Input.pressed.right) { this.selIndex = (this.selIndex + 1) % n; Sound.pickup(); }
        if (this.stateT > 0.2 && (Input.pressed.attack || Input.pressed.jump || Input.pressed.confirm)) {
          this.classKey = CLASS_ORDER[this.selIndex];
          this.startRun();
        } else if (Input.pressed.pause) this.setState(STATE.START);
        break;
      }

      case STATE.ADVANCE: {
        this.updateWorld(sdt);
        const next = WAVES[this.waveIndex + 1];
        if (this.cam.x >= next.lockX - 0.5) {
          this.cam.x = next.lockX;
          this.beginWaveIntro(this.waveIndex + 1);
        }
        break;
      }

      case STATE.WAVE_INTRO:
        this.updateWorld(sdt);
        if (this.stateT >= 1.4) this.startWave();
        break;

      case STATE.WAVE:
      case STATE.FINAL_WAVE:
        this.updateWorld(sdt);
        if (this.state === STATE.PLAYER_DEAD) break;
        if (!this.magic) this.waves.update(sdt);
        this.updateThieves(sdt);
        if (this.waves.complete) this.onWaveCleared();
        break;

      case STATE.WAVE_COMPLETE: {
        this.updateWorld(sdt);
        if (this.state === STATE.PLAYER_DEAD) break;
        const def = WAVES[this.waveIndex];
        if (this.stateT >= (def.final ? 2.2 : 1.9)) {
          if (def.final) this.startDoor();
          else if (def.rest) this.startRest();
          else this.startAdvance();
        }
        break;
      }

      case STATE.REST:
        this.updateWorld(sdt);
        this.updateThieves(sdt);
        if (this.stateT >= 11) {
          this.nightTarget = 0;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + PLAYER_CFG.restHeal);
          FX.ring(this.player.cx, this.player.screenY - 25, 8, 70, 0.6, false, 2);
          this.startAdvance();
        }
        break;

      case STATE.DOOR:
        this.updateWorld(sdt);
        this.updateDoor(dt);
        break;

      case STATE.ENDING:
        if (!this.chimed && this.stateT > 1.5) { this.chimed = true; Sound.chime(); }
        if (this.stateT > 8 && Input.anyPressed) this.toTitle();
        break;

      case STATE.PLAYER_DEAD:
        this.updateWorld(sdt);
        if (this.stateT >= 2.4 && Input.anyPressed) this.startRun();
        break;
    }
    this.updateCamera(dt, false);
  }

  updateWorld(dt) {
    this.player.update(dt);
    if (this.magic) {
      // the world holds its breath while the spell is cast
      this.updateMagic(dt);
    } else {
      const E = this.enemies;
      for (let i = 0; i < E.length; i++) if (E[i].active) E[i].update(dt, this);
      this.separateEnemies();
      this.resolveThrownBodies();
      Projectiles.update(dt, this);
      Arrows.update(dt, this);
      SwordWaves.update(dt, this);
      this.updateBurns(dt);
    }
    this.resolvePlayerHits();
    Items.update(dt, this);
    FX.update(dt);
  }

  separateEnemies() {
    const E = this.enemies;
    const busy = (e) => !e.active || e.behavior === 'flyer' || e.behavior === 'thief' || e.untouchable || e.state === 'shadow' || e.state === 'attack';
    for (let i = 0; i < E.length; i++) {
      const a = E[i];
      if (busy(a)) continue;
      for (let j = i + 1; j < E.length; j++) {
        const b = E[j];
        if (busy(b)) continue;
        if (Math.abs(a.z - b.z) > 12) continue;
        const ov = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        if (ov <= 0) continue;
        const push = Math.min(ov, 6) * 0.5;
        if (a.cx < b.cx) { a.x -= push; b.x += push; } else { a.x += push; b.x -= push; }
        const dz = a.z < b.z ? -0.6 : 0.6;
        a.z = clamp(a.z + dz, 0, DEPTH);
        b.z = clamp(b.z - dz, 0, DEPTH);
      }
    }
  }

  requestToken() {
    const limit = (this.waves.def && this.waves.def.tokens) || 2;
    let held = 0;
    for (const e of this.enemies) if (e.active && e.hasToken) held++;
    return held < limit;
  }

  resolvePlayerHits() {
    const p = this.player;
    if (!p.hitActive) return;
    const a = p.atk, hb = p.hitBox;
    let hits = 0, blocked = false;
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (!e.active || e.lastHitId === p.attackId) continue;
      if (!hitsActor(hb, a.depth, p.z, e)) continue;
      e.lastHitId = p.attackId;
      const ix = (Math.max(hb.x, e.x) + Math.min(hb.x + hb.w, e.x + e.w)) / 2;
      const iy = FLOOR_Y + e.z + (Math.max(hb.y, e.y) + Math.min(hb.y + hb.h, e.y + e.h)) / 2;
      const r = e.hit(a, p.cx, p.bottom, this);
      const dir = e.cx >= p.cx ? 1 : -1;
      if (r === 'blocked') {
        blocked = true;
        FX.ring(ix, iy, 4, 40, 0.2, false, 3);
        FX.burst(ix, iy, 8, 360, { dir: -dir, spread: 1.0, streak: true, grav: 300 });
      } else if (r === 'hit') {
        hits++;
        FX.ring(ix, iy, 2, a.heavy ? 22 : 13, 0.08, false, 0, true);
        FX.ring(ix, iy, 6, a.heavy ? 74 : 42, a.heavy ? 0.26 : 0.18, false, a.heavy ? 5 : 3);
        FX.burst(ix, iy, a.heavy ? 16 : 9, a.heavy ? 640 : 440, { dir: dir, spread: 0.8, streak: true, grav: 600 });
      }
    }
    if (hits > 0) {
      this.hitstop(a.hitstop);
      FX.shake(a.shake);
      Sound.hit(!!a.heavy);
    } else if (blocked) {
      this.hitstop(0.05);
      FX.shake(0.06);
      Sound.block();
      p.vx = -p.facing * 240;
    }
  }

  // ------------------------------------------------------------ grabs & throws
  findGrabTarget(p) {
    const OK = { idle: 1, approach: 1, stagger: 1, recover: 1, stalk: 1 };
    let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (!e.active || e.untouchable || e.c.noGrab || e.c.big || !e.onGround || !OK[e.state]) continue;
      const dx = e.cx - p.cx, adx = Math.abs(dx);
      if (adx > GRAB_CFG.range || Math.abs(e.z - p.z) > GRAB_CFG.depth) continue;
      if (adx > 8 && sign(dx) !== p.facing) continue;
      if (adx < bd) { bd = adx; best = e; }
    }
    return best;
  }

  kneeHit(e, p) {
    e.hp -= GRAB_CFG.kneeDmg;
    e.flashT = 0.1;
    const x = e.cx, y = e.screenY - e.h * 0.5;
    FX.ring(x, y, 4, 30, 0.15, false, 3);
    FX.burst(x, y, 6, 260, { up: 1.0, streak: true });
    this.hitstop(0.05);
    FX.shake(0.08);
    Sound.hit(false);
    if (e.hp <= 0) e.die(p.facing, 220, this);
  }

  // A thrown body bowls over anyone in its path.
  resolveThrownBodies() {
    const E = this.enemies;
    for (const t of E) {
      if (!t.active || t.state !== 'thrown') continue;
      for (const o of E) {
        if (o === t || !o.active || o.behavior === 'thief' || o.lastThrowId === t.throwId) continue;
        if (Math.abs(o.z - t.z) > LANE || !rectsOverlap(t, o)) continue;
        o.lastThrowId = t.throwId;
        const r = o.hit({ dmg: GRAB_CFG.splashDmg, kb: 320, kbUp: -420, knockdown: true, heavy: true, magic: true, stagger: 0.4 }, t.cx, t.bottom, this);
        if (r === 'hit') {
          FX.ring(o.cx, o.screenY - o.h / 2, 6, 50, 0.2, false, 4);
          FX.shake(0.15);
          Sound.hit(true);
        }
      }
    }
  }

  onThrownLanded(e) {
    e.hp -= GRAB_CFG.throwDmg;
    e.flashT = 0.1;
    FX.shake(0.28);
    FX.dust(e.cx, FLOOR_Y + e.z, 16);
    FX.ring(e.cx, FLOOR_Y + e.z, 8, 80, 0.3, false, 4);
    Sound.slam();
    this.hitstop(0.05);
    e.vx *= 0.3;
    if (e.hp <= 0 && !e.dying) {
      e.dying = true;
      e.hp = 0;
      this.onEnemyKilled(e);
      e.setState('dead');
    } else e.setState('down');
  }

  // Fire arrows leave enemies burning for a couple of seconds.
  updateBurns(dt) {
    for (const e of this.enemies) {
      if (!e.active || e.burnT <= 0) continue;
      if (e.dying || e.state === 'dead') { e.burnT = 0; continue; }
      e.burnT -= dt;
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.5;
        e.hp -= 4;
        e.flashT = 0.06;
        Sound.burn();
        if (e.hp <= 0) { e.die(-e.facing, 120, this); continue; }
      }
      if (Math.random() < 0.35) {
        FX.particle(e.cx + rand(-8, 8), e.screenY - e.h * rand(0.3, 0.9), rand(-15, 15), -rand(40, 110), rand(0.3, 0.6), rand(2, 3.5), false, -60, 1.5);
      }
    }
  }

  // ------------------------------------------------------------ magic
  castMagic(level) {
    const targets = [];
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.active || e.dying || e.behavior === 'thief') continue;
      if (e.cx < this.cam.x - 20 || e.cx > this.cam.x + this.viewW + 20) continue;
      targets.push(e);
    }
    // extra spikes scattered over the floor, more with every pot
    const spikes = [];
    for (let i = 0; i < level * 5; i++) {
      spikes.push({ x: this.cam.x + rand(20, this.viewW - 20), z: rand(0, DEPTH), h: rand(0.4, 1), d: rand(0, 0.3) });
    }
    for (const e of targets) spikes.push({ x: e.cx, z: e.z, h: 1.3, d: 0, e });
    this.magic = { t: 0, level, struck: false, spikes, x: p.cx, z: p.z };
    Sound.magic(level);
    FX.ring(p.cx, p.screenY - 40, 10, 160, 0.6, false, 3);
  }

  updateMagic(dt) {
    const m = this.magic;
    m.t += dt;
    if (!m.struck && m.t >= MAGIC_CFG.strikeAt) {
      m.struck = true;
      const dmg = MAGIC_CFG.baseDmg + MAGIC_CFG.perPot * m.level;
      const atk = { dmg, kb: 260, kbUp: -560, knockdown: true, magic: true, heavy: true, stagger: 0.5 };
      for (const s of m.spikes) {
        if (!s.e || !s.e.active || s.e.dying) continue;
        const e = s.e;
        // the spell reaches even those on the floor
        if (e.state === 'down' || e.state === 'getup' || e.state === 'launched') e.setState('stagger');
        e.hit(atk, e.cx - 1, 0, this);
        FX.burst(e.cx, e.screenY - e.h / 2, 12, 420, { streak: true });
      }
      FX.shake(0.3 + m.level * 0.07);
      Sound.slam();
    }
    if (m.t >= MAGIC_CFG.castTime) this.magic = null;
  }

  drawMagic(ctx) {
    const m = this.magic;
    if (!m) return;
    const t = m.t - MAGIC_CFG.strikeAt;
    // gathering: lines drawn into the raised sword
    if (t < 0) {
      const k = m.t / MAGIC_CFG.strikeAt;
      const p = this.player;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU + m.t * 3;
        const r = lerp(220, 20, k);
        const x = p.cx, y = p.screenY - 150;
        ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6);
        ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.48);
      }
      ctx.stroke();
      return;
    }
    // eruption: outlined spikes burst out of the floor
    ctx.lineJoin = 'miter';
    const scale = 40 + m.level * 16;
    for (const s of m.spikes) {
      const lt = t - s.d;
      if (lt < 0) continue;
      const k = lt < 0.12 ? lt / 0.12 : Math.max(0, 1 - (lt - 0.12) / 0.45);
      if (k <= 0) continue;
      const h = scale * s.h * k, x = s.x, y = FLOOR_Y + s.z;
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x - 5, y - h * 0.6);
      ctx.lineTo(x - 1, y - h);
      ctx.lineTo(x + 3, y - h * 0.5);
      ctx.lineTo(x + 6, y - h * 0.75);
      ctx.lineTo(x + 10, y);
      ctx.closePath();
      finish(ctx);
    }
  }

  // Colour inversion pulses when the spell lands.
  magicInvert() {
    const m = this.magic;
    if (!m) return false;
    const t = m.t - MAGIC_CFG.strikeAt;
    return (t >= 0 && t < 0.07) || (t >= 0.14 && t < 0.2) || (m.level >= 4 && t >= 0.28 && t < 0.33);
  }

  // ------------------------------------------------------------ thieves & items
  updateThieves(dt) {
    for (let i = this.thiefTimers.length - 1; i >= 0; i--) {
      this.thiefTimers[i] -= dt;
      if (this.thiefTimers[i] <= 0) {
        this.thiefTimers.splice(i, 1);
        this.spawnThief();
      }
    }
  }

  spawnThief() {
    const e = this.enemyPool.obtain();
    if (!e) return;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = dir > 0 ? this.cam.x - 30 : this.cam.x + this.viewW + 30;
    e.reset('thief', x, rand(20, DEPTH - 20), { enter: dir, facing: dir });
  }

  dropItem(thief) {
    Items.drop(Math.random() < 0.7 ? 'pot' : 'food', thief.cx, thief.z);
    Sound.pickup();
  }

  pickUp(kind, x, z) {
    const p = this.player;
    if (kind === 'pot') p.pots = Math.min(PLAYER_CFG.maxPots, p.pots + 1);
    else p.hp = Math.min(p.maxHp, p.hp + PLAYER_CFG.foodHeal);
    FX.ring(x, FLOOR_Y + z - 10, 4, 36, 0.3, false, 2);
    Sound.pickup();
  }

  // ------------------------------------------------------------ spawning
  spawnWaveEnemy(type) {
    const c = ENEMY_TYPES[type];
    const e = this.enemyPool.obtain();
    if (!e) return false;
    const p = this.player, vw = this.viewW, cx = this.cam.x;
    let z = rand(10, DEPTH - 10);
    if (c.behavior === 'flyer') {
      const x = p.cx > cx + vw / 2 ? cx + rand(60, vw * 0.35) : cx + vw - rand(60, vw * 0.35);
      e.reset(type, x, z, { facing: p.cx >= x ? 1 : -1 });
      Sound.spawn();
    } else if (c.behavior === 'assassin' || Math.random() < 0.3) {
      // rise out of the ground somewhere not too close
      let x = cx + vw / 2;
      for (let tries = 0; tries < 12; tries++) {
        x = cx + rand(50, vw - 50);
        z = rand(10, DEPTH - 10);
        if (Math.hypot(x - p.cx, (z - p.z) * 1.5) > 240) break;
      }
      e.reset(type, x, z, { facing: p.cx >= x ? 1 : -1 });
      Sound.spawn();
    } else {
      // walk in from beyond a screen edge; keep both sides busy
      this.spawnSide = -this.spawnSide;
      let side = this.spawnSide;
      if (p.cx < cx + 140) side = 1; else if (p.cx > cx + vw - 140) side = -1;
      const x = side > 0 ? cx + vw + 40 : cx - 40;
      e.reset(type, x, z, { enter: -side, facing: -side });
    }
    return true;
  }

  onEnemyKilled(e) {
    const big = !!e.c.big;
    const x = e.cx, y = e.screenY - e.h / 2;
    FX.burst(x, y, big ? 40 : 22, big ? 560 : 400, { streak: true, grav: 700 });
    FX.ring(x, y, 8, big ? 130 : 72, 0.4, false, big ? 6 : 4);
    FX.shake(big ? 0.3 : 0.1);
    Sound.enemyDie(big);
    this.waves.onDefeated();
    const split = e.c.split;
    if (split) {
      for (let i = 0; i < split.count; i++) {
        const child = this.enemyPool.obtain();
        if (!child) break;
        const d = i % 2 === 0 ? -1 : 1;
        child.reset(split.type, x + d * 12, e.z + d * 14, { vx: d * 200, vy: -420, spawnDur: 0.3, facing: d });
        this.waves.addExtra(1);
      }
    }
    if (this.waves.def && this.waves.spawned === this.waves.required && this.waves.alive === 0) {
      this.slowmo(0.25, 0.6);
      FX.ring(x, y, 10, 400, 0.8, false, 2);
    }
  }

  onPlayerHurt() { this.hurtFlash = 1; this.hitstop(0.06); }

  // The player's fall animation has finished: spend a life or end the run.
  onPlayerFallen() {
    const p = this.player;
    if (p.lives > 1) {
      p.lives--;
      p.revive();
      // standing back up blasts nearby enemies off their feet
      for (const e of this.enemies) {
        if (!e.active || e.untouchable || e.behavior === 'thief') continue;
        const d = Math.hypot(e.cx - p.cx, (e.z - p.z) * 1.5);
        if (d < 180) e.launch(e.cx >= p.cx ? 1 : -1, 320, -420);
      }
      FX.ring(p.cx, p.screenY - 25, 10, 200, 0.6, false, 4);
      FX.shake(0.3);
      Sound.slam();
      return;
    }
    this.setState(STATE.PLAYER_DEAD);
    this.slowmo(0.35, 0.9);
  }

  debugClearWave() {
    if (!this.waves.def || !(this.state === STATE.WAVE || this.state === STATE.FINAL_WAVE)) return;
    const w = this.waves;
    w.queue.length = 0;
    w.phase = w.def.phases.length - 1;
    w.spawned = w.required;
    for (const e of this.enemies) if (e.active && e.behavior !== 'thief') e.active = false;
    w.alive = 0;
    w.defeated = w.required;
  }

  // ------------------------------------------------------------ door
  updateDoor(dt) {
    const d = this.stage.door, p = this.player;
    if (this.doorRise < 1) {
      this.doorRise = Math.min(1, this.doorRise + dt / 2.8);
      FX.shake(0.01);
      if (this.doorRise >= 1) { FX.shake(0.2); Sound.slam(); }
    }
    const dist = Math.hypot(p.cx - d.x, p.z * 2.2);
    if (!this.endWalk) {
      if (this.doorRise >= 1) {
        const target = clamp((900 - dist) / 750, 0, 1);
        this.doorOpen = Math.max(this.doorOpen, approach(this.doorOpen, target, 0.45 * dt));
      }
      p.speedMul = lerp(1, 0.35, this.doorOpen);
      Sound.droneSet(0.06 + this.doorOpen * 0.5);
      if (this.doorRise >= 1 && Math.abs(p.cx - d.x) < 30 && p.z < 26 && p.onGround) {
        this.endWalk = true;
        this.endT = 0;
        p.control = false;
      }
    } else {
      this.endT += dt;
      this.doorOpen = approach(this.doorOpen, 1, dt * 0.4);
      this.whiteout = easeInCubic(clamp((this.endT - 0.6) / 3.4, 0, 1));
      Sound.droneSet(0.6 + 0.4 * this.whiteout);
      if (this.endT >= 4.6) {
        Sound.droneStop(0.04);
        this.whiteout = 1;
        this.chimed = false;
        this.setState(STATE.ENDING);
      }
    }
  }

  // ------------------------------------------------------------ camera
  targetZoom() {
    let i = this.waveIndex;
    if (this.state === STATE.ADVANCE) i = Math.min(WAVES.length - 1, i + 1);
    return WAVES[i].zoom || ZOOM;
  }

  updateCamera(dt, snap) {
    const c = this.cam, p = this.player;
    const tz = this.targetZoom();
    c.zoom = snap ? tz : approach(c.zoom, tz, dt * 0.2);
    const vw = this.viewW;
    const maxX = this.stage.length - vw;
    if (this.locked) {
      c.x = snap ? this.lockX : approach(c.x, this.lockX, 700 * dt);
    } else {
      // scroll forward only, pushed by the player
      const px = p.alive ? p.cx : p.deathX;
      const want = clamp(px - vw * 0.42, 0, maxX);
      if (want > c.x) c.x = snap ? want : approach(c.x, want, 700 * dt);
      if (this.state === STATE.ADVANCE) c.x = Math.min(c.x, WAVES[this.waveIndex + 1].lockX);
    }
    c.x = clamp(c.x, 0, maxX);
    c.y = FLOOR_Y + DEPTH + 45 - VIEW_H / c.zoom;
  }

  // ------------------------------------------------------------ render
  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.viewScale, 0, 0, this.viewScale, this.viewX, this.viewY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();

    if (this.state !== STATE.ENDING) this.renderWorld(ctx);

    // hurt: a black frame snaps in and fades
    if (this.hurtFlash > 0) {
      const t = 18 * this.hurtFlash;
      ctx.fillStyle = '#000';
      ctx.globalAlpha = this.hurtFlash * 0.9;
      ctx.fillRect(0, 0, VIEW_W, t); ctx.fillRect(0, VIEW_H - t, VIEW_W, t);
      ctx.fillRect(0, 0, t, VIEW_H); ctx.fillRect(VIEW_W - t, 0, t, VIEW_H);
      ctx.globalAlpha = 1;
    }

    if (this.whiteout > 0) {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = this.whiteout;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }

    this.drawHUD(ctx);
    if (Input.touchMode) this.drawTouch(ctx);
    this.drawOverlayText(ctx);

    if (this.fadeIn > 0) {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = this.fadeIn;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
    if (this.paused) this.drawPause(ctx);
    if (Input.touchMode) this.drawRotateHint(ctx);
    ctx.restore();

    // Night inverts the world: white silhouettes in a black land.
    // Magic flashes invert it again for an instant.
    let inv = this.night;
    if (this.magicInvert()) inv = 1 - inv;
    if (inv > 0.001) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'difference';
      ctx.globalAlpha = inv;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  renderWorld(ctx) {
    const c = this.cam, z = c.zoom, vw = this.viewW;
    let sx = 0, sy = 0;
    if (FX.trauma > 0) {
      const m = 16 * FX.trauma * FX.trauma;
      sx = rand(-m, m); sy = rand(-m, m);
    }
    ctx.save();
    ctx.scale(z, z);
    ctx.translate(-c.x + sx, -c.y + sy);

    const doorShown = this.stage.door && this.state === STATE.DOOR;
    this.stage.drawBack(ctx, c.x, vw, this.time);
    if (doorShown) this.drawDoor(ctx);
    this.stage.drawFloor(ctx, c.x, vw);

    // shadows first: they belong to the floor
    ctx.fillStyle = '#000';
    const p = this.player;
    if (p.state !== 'dead') drawShadow(ctx, p);
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (!e.active || e.state === 'spawn') continue;
      ctx.globalAlpha = e.alpha;
      drawShadow(ctx, e);
    }
    ctx.globalAlpha = 1;
    Projectiles.drawShadows(ctx);
    Arrows.drawShadows(ctx);
    Items.draw(ctx);

    // actors, back to front
    const list = this.drawList;
    list.length = 0;
    list.push(p);
    for (let i = 0; i < E.length; i++) if (E[i].active) list.push(E[i]);
    list.sort((a, b) => a.z - b.z);
    for (let i = 0; i < list.length; i++) {
      if (list[i] === p) p.draw(ctx); else list[i].draw(ctx, this);
    }

    Projectiles.draw(ctx);
    Arrows.draw(ctx);
    SwordWaves.draw(ctx);
    this.drawMagic(ctx);
    FX.drawFront(ctx);
    if (doorShown) this.drawDoorLight(ctx);
    this.stage.drawFront(ctx, c.x, vw, c.y + VIEW_H / z);
    ctx.restore();

    this.drawIndicators(ctx);
  }

  // Edge chevrons for threats (and the door) outside the view.
  drawIndicators(ctx) {
    if (this.state === STATE.START || this.state === STATE.SELECT) return;
    const c = this.cam, z = c.zoom, vw = this.viewW;
    ctx.fillStyle = '#000';
    const chevron = (wx, wy, big) => {
      let dir = 0;
      if (wx < c.x) dir = -1; else if (wx > c.x + vw) dir = 1;
      if (!dir) return;
      const y = clamp((wy - c.y) * z, 150, VIEW_H - 60);
      const x = dir < 0 ? 14 : VIEW_W - 14;
      const s = big ? 12 : 7;
      ctx.beginPath();
      ctx.moveTo(x + dir * s * 0.6, y);
      ctx.lineTo(x - dir * s * 0.6, y - s);
      ctx.lineTo(x - dir * s * 0.6, y + s);
      ctx.closePath();
      ctx.fill();
    };
    for (const e of this.enemies) {
      if (!e.active || e.state === 'shadow' || e.behavior === 'thief' || e.dying) continue;
      chevron(e.cx, e.screenY - e.h / 2, !!e.c.big);
    }
    if (this.state === STATE.DOOR && this.doorRise > 0.3) chevron(this.stage.door.x, FLOOR_Y - 60, true);

    // GO ->
    const go = this.state === STATE.ADVANCE || (this.state === STATE.DOOR && !this.endWalk && this.stage.door.x > c.x + vw * 0.8);
    if (go && Math.floor(this.time * 2.5) % 2 === 0) {
      ctx.globalAlpha = this.state === STATE.DOOR ? 0.5 : 1;
      this.text('GO', VIEW_W - 120, 200, 30, { weight: 300, spacing: 8 });
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(VIEW_W - 36, 190);
      ctx.lineTo(VIEW_W - 54, 176);
      ctx.lineTo(VIEW_W - 54, 204);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  archPath(ctx, cx, bottom, w, h) {
    const l = cx - w / 2, top = bottom - h;
    ctx.beginPath();
    ctx.moveTo(l, bottom);
    ctx.lineTo(l, top + w / 2);
    ctx.arc(cx, top + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(l + w, bottom);
    ctx.closePath();
  }

  // The monolith rises out of the horizon at the end of the road.
  drawDoor(ctx) {
    const d = this.stage.door, gy = FLOOR_Y;
    const rise = easeOutCubic(this.doorRise);
    if (rise <= 0) return;
    const sx = d.x - d.slabW / 2, top = gy - d.slabH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx - 60, -1200, d.slabW + 120, gy + 1200);
    ctx.clip();
    ctx.translate(0, d.slabH * (1 - rise));
    ctx.lineJoin = 'miter';
    box(ctx, sx + 110, top - 52, d.slabW - 220, 24);
    box(ctx, sx + 40, top - 30, d.slabW - 80, 32);
    box(ctx, sx, top, d.slabW, d.slabH);
    // stone courses
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = top + 36; y < gy - 10; y += 36) { ctx.moveTo(sx + 12, y); ctx.lineTo(sx + d.slabW - 12, y); }
    ctx.stroke();
    const o = this.doorOpen;
    const dw = d.doorW, dh = d.doorH;
    const gap = dw * easeInOutSine(o);
    // the door: two outlined leaves parting on a white gap
    ctx.save();
    this.archPath(ctx, d.x, gy, dw + 22, dh + 14);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.lineWidth = OUTLINE;
    ctx.stroke();
    this.archPath(ctx, d.x, gy, dw, dh);
    ctx.clip();
    ctx.fillStyle = PAPER;
    ctx.fillRect(d.x - dw / 2 - 2, gy - dh - 2, dw + 4, dh + 4);
    const leaf = (dw - gap) / 2;
    if (leaf > 0.5) {
      box(ctx, d.x - dw / 2, gy - dh - 2, leaf, dh + 4);
      box(ctx, d.x + gap / 2, gy - dh - 2, leaf, dh + 4);
      // studs on the leaves
      ctx.fillStyle = INK;
      for (let yy = gy - dh * 0.75; yy < gy - 10; yy += dh / 4) {
        if (leaf > 12) {
          ctx.fillRect(d.x - gap / 2 - 9, yy, 3, 3);
          ctx.fillRect(d.x + gap / 2 + 6, yy, 3, 3);
        }
      }
    }
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = OUTLINE;
    this.archPath(ctx, d.x, gy, dw, dh);
    ctx.stroke();
    ctx.restore();
  }

  // The light spills over everything black: monolith, floor, figure.
  drawDoorLight(ctx) {
    const o = this.doorOpen;
    if (o <= 0.001) return;
    const d = this.stage.door;
    const cx = d.x, cy = FLOOR_Y - d.doorH * 0.45;
    const intensity = clamp(o + this.whiteout, 0, 2);
    ctx.save();
    ctx.fillStyle = '#fff';
    const n = 18;
    const len = 300 + intensity * 1800;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.time * 0.05 + Math.sin(i * 7.3) * 0.2;
      const w = 0.035 + (i % 3) * 0.02;
      ctx.globalAlpha = clamp(0.25 * o + 0.1 * Math.sin(this.time * 2 + i), 0, 1);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - w) * len, cy + Math.sin(a - w) * len);
      ctx.lineTo(cx + Math.cos(a + w) * len, cy + Math.sin(a + w) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const r = 80 + intensity * 800;
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,' + (0.9 * Math.min(1, o * 1.2)).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  // ------------------------------------------------------------ UI
  text(str, x, y, size, o) {
    const ctx = this.ctx;
    o = o || {};
    ctx.font = (o.italic ? 'italic ' : '') + (o.weight || 400) + ' ' + size + 'px ' + FONT;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = o.color || '#000';
    const sp = o.spacing || 0;
    const hasLS = 'letterSpacing' in ctx;
    if (hasLS) ctx.letterSpacing = sp + 'px';
    ctx.fillText(str, x + (hasLS && o.align === 'center' ? sp / 2 : 0), y);
    if (hasLS) ctx.letterSpacing = '0px';
  }

  drawHUD(ctx) {
    const a = this.hudAlpha;
    if (a <= 0.01 || this.state === STATE.START || this.state === STATE.SELECT) return;
    const p = this.player;
    ctx.globalAlpha = a;
    const x = 40, y = 46;
    this.text('WAVE ' + (this.waveIndex + 1), x, y, 18, { weight: 700, spacing: 4 });
    this.text(p.cls.name, x + 150, y, 12, { weight: 400, spacing: 4 });

    // HP
    this.text('HP', x, y + 30, 12, { weight: 700, spacing: 2 });
    const blocks = 10, bw = 14, bh = 10, gap = 3, bx0 = x + 58;
    const fill = p.hp / p.maxHp * blocks;
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let i = 0; i < blocks; i++) {
      const bx = bx0 + i * (bw + gap), by = y + 20;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      const f = clamp(fill - i, 0, 1);
      if (f > 0) ctx.fillRect(bx, by, bw * f, bh);
    }

    // magic pots
    this.text('MAGIC', x, y + 54, 12, { weight: 700, spacing: 2 });
    for (let i = 0; i < PLAYER_CFG.maxPots; i++) {
      const px = bx0 + 5 + i * 17, py = y + 53;
      ctx.beginPath();
      ctx.arc(px, py - 4, 5, 0, TAU);
      ctx.rect(px - 1.5, py - 13, 3, 5);
      if (i < p.pots) ctx.fill();
      else { ctx.beginPath(); ctx.arc(px, py - 4, 4.5, 0, TAU); ctx.stroke(); }
    }

    // lives
    this.text('LIVES', x, y + 78, 12, { weight: 700, spacing: 2 });
    for (let i = 0; i < p.lives; i++) {
      const lx = bx0 + 3 + i * 17, ly = y + 77;
      ctx.beginPath();
      ctx.arc(lx + 3, ly - 10, 3.2, 0, TAU);
      ctx.fill();
      ctx.fillRect(lx, ly - 7, 6, 7);
    }

    let remaining;
    if (this.waves.def) remaining = this.waves.remaining;
    else if (this.state === STATE.WAVE_INTRO) { remaining = 0; for (const ph of WAVES[this.waveIndex].phases) for (const [, n] of ph) remaining += n; }
    else remaining = 0;
    this.text('ENEMIES: ' + remaining, x, y + 102, 12, { weight: 700, spacing: 2 });
    ctx.globalAlpha = 1;
  }

  drawOverlayText(ctx) {
    const s = this.state, t = this.stateT;
    const cx = VIEW_W / 2;
    if (s === STATE.SELECT) { this.drawSelect(ctx); return; }
    if (s === STATE.START) {
      const a = clamp(this.time * 1.2, 0, 1);
      ctx.globalAlpha = a;
      this.text('THE ENDLESS MARCH', cx, 140, 60, { weight: 300, spacing: 16, align: 'center' });
      this.text('JOURNEY TO THE END', cx, 182, 18, { weight: 400, spacing: 12, align: 'center' });
      ctx.globalAlpha = a * (0.45 + 0.35 * Math.sin(this.time * 2.5));
      this.text(Input.touchMode ? 'tap to begin' : 'press any key', cx, 226, 15, { spacing: 4, align: 'center' });
      ctx.globalAlpha = a * 0.5;
      this.text('v' + GAME_VERSION, 16, 24, 11, { spacing: 2 });
      if (window.SEEK_TEST_BUILD) {
        ctx.globalAlpha = a * 0.6;
        this.text('TEST BUILD   ·   N  skip wave   ·   H  heal + fill magic', cx, 30, 11, { spacing: 2, align: 'center' });
      }
      ctx.globalAlpha = a * 0.8;
      this.text('ARROWS / WASD  move      ←← / SHIFT  run (rogue: dash)      SPACE  jump      X / click  attack      F / right-click  back attack      V  magic      P  pause',
        cx, VIEW_H - 10, 11, { spacing: 1, align: 'center' });
      ctx.globalAlpha = 1;
    } else if (s === STATE.WAVE_INTRO) {
      const a = t < 0.25 ? t / 0.25 : t > 1.1 ? Math.max(0, 1 - (t - 1.1) / 0.3) : 1;
      ctx.globalAlpha = a;
      this.text('WAVE ' + (this.waveIndex + 1), cx, 190, 44, { weight: 300, spacing: 18, align: 'center' });
      ctx.globalAlpha = 1;
    } else if (s === STATE.WAVE_COMPLETE && !WAVES[this.waveIndex].final) {
      const a = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 1.3) / 0.5);
      ctx.globalAlpha = clamp(a, 0, 1);
      this.text('CLEARED', cx, 190, 20, { weight: 400, spacing: 12, align: 'center' });
      ctx.globalAlpha = 1;
    } else if (s === STATE.REST) {
      const a = t < 1 ? t : t > 9.5 ? Math.max(0, 1 - (t - 9.5) / 1.2) : 1;
      ctx.globalAlpha = clamp(a, 0, 1) * 0.9;
      this.text('REST', cx, 190, 26, { weight: 300, spacing: 16, align: 'center' });
      ctx.globalAlpha = clamp(a, 0, 1) * 0.6;
      this.text('thieves come in the night. take back what they carry.', cx, 222, 12, { spacing: 2, align: 'center' });
      ctx.globalAlpha = 1;
    } else if (s === STATE.PLAYER_DEAD && t > 1.6) {
      const a = clamp((t - 1.6) / 0.8, 0, 1);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = a * 0.75;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = a;
      this.text('FALLEN', cx, 300, 40, { weight: 300, spacing: 20, align: 'center' });
      this.text('WAVE ' + (this.waveIndex + 1) + ' OF ' + WAVES.length, cx, 340, 13, { weight: 700, spacing: 4, align: 'center' });
      if (t > 2.4) {
        ctx.globalAlpha = a * (0.45 + 0.35 * Math.sin(this.time * 2.5));
        this.text('press any key to begin again', cx, 400, 13, { spacing: 3, align: 'center' });
      }
      ctx.globalAlpha = 1;
    } else if (s === STATE.ENDING) {
      if (t > 1.5) {
        ctx.globalAlpha = clamp((t - 1.5) / 2.0, 0, 1);
        this.text('THE ENDLESS MARCH', cx, 330, 54, { weight: 300, spacing: 14, align: 'center' });
      }
      if (t > 4.2) {
        ctx.globalAlpha = clamp((t - 4.2) / 2.0, 0, 1) * 0.8;
        this.text('What did you seek?', cx, 400, 18, { spacing: 3, align: 'center' });
      }
      if (t > 8) {
        ctx.globalAlpha = clamp((t - 8) / 2, 0, 1) * 0.25;
        this.text('press any key', cx, VIEW_H - 40, 11, { spacing: 3, align: 'center' });
      }
      ctx.globalAlpha = 1;
    }
  }

  // Choose your path: three outlined figures, one lit.
  drawSelect(ctx) {
    const cx = VIEW_W / 2, t = this.time;
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    this.text('CHOOSE YOUR PATH', cx, 104, 28, { weight: 300, spacing: 14, align: 'center' });
    const P = this.selPose || (this.selPose = { x: 0, y: 0, facing: 1, legA: 0.2, legB: -0.22, lean: 0, sx: 1, sy: 1, cloak: 0.25, time: 0 });
    CLASS_ORDER.forEach((key, i) => {
      const C = CLASSES[key];
      const on = i === this.selIndex;
      const x = cx + (i - 1) * 340, y = 430;
      P.time = t; P.weapon = C.weapon; P.draw = 0; P.fire = false; P.sword2 = undefined;
      P.lean = 0; P.legA = 0.2; P.legB = -0.22;
      if (key === 'warrior') P.sword = C.rest + (on ? Math.sin(t * 2) * 0.15 : 0);
      else if (key === 'archer') {
        const d = on ? clamp(Math.sin(t * 2.2) * 1.3, 0, 1) : 0;
        P.sword = on ? -0.05 : C.rest; P.draw = d; P.fire = d > 0.5 && Math.sin(t * 1.1) > 0;
      } else {
        P.sword = C.rest + (on ? Math.sin(t * 3) * 0.35 : 0);
        P.sword2 = C.rest2 - (on ? Math.sin(t * 3) * 0.35 : 0);
      }
      // ground mark
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(x, y, 34, 5, 0, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y + (on ? Math.sin(t * 3) * 1.5 : 0));
      ctx.scale(1.9, 1.9);
      drawFigure(ctx, P, true);
      ctx.restore();
      this.text(C.name, x, y + 56, on ? 22 : 18, { weight: on ? 700 : 400, spacing: 8, align: 'center' });
      if (!on) {
        // the paths not taken fade into the white
        ctx.fillStyle = PAPER;
        ctx.globalAlpha = 0.68;
        ctx.fillRect(x - 170, 150, 340, 500);
        ctx.globalAlpha = 1;
      }
      if (on) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 150, 170, 300, 470);
        C.lines.forEach((l, k) => this.text(l, x, y + 90 + k * 22, 13, { spacing: 1, align: 'center' }));
        this.text('HP ' + C.stats.maxHp, x, y + 90 + C.lines.length * 22 + 8, 11, { weight: 700, spacing: 3, align: 'center' });
      }
    });
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 2.5);
    this.text(Input.touchMode ? 'tap a path to choose it - tap it again to begin the march' : '← →  choose        X / SPACE / ENTER  begin the march', cx, VIEW_H - 22, 13, { spacing: 3, align: 'center' });
    ctx.globalAlpha = 1;
  }

  // Menu taps on touch screens.
  onTap(x, y) {
    if (this.state !== STATE.SELECT || this.stateT < 0.3) return;
    const col = x < VIEW_W / 2 - 170 ? 0 : x > VIEW_W / 2 + 170 ? 2 : 1;
    if (col === this.selIndex) Input.pressed.confirm = true;
    else { this.selIndex = col; Sound.pickup(); }
  }

  // On-screen stick and buttons, drawn in the game's outline style.
  drawTouch(ctx) {
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    if (Input.buttonsLive) {
      const s = Input.stick, R = TouchLayout.stickR;
      const ox = s.id !== null ? s.ox : 170, oy = s.id !== null ? s.oy : 560;
      ctx.globalAlpha = s.id !== null ? 0.8 : 0.35;
      ctx.fillStyle = PAPER;
      ctx.beginPath(); ctx.arc(ox, oy, R, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(s.id !== null ? s.x : ox, s.id !== null ? s.y : oy, 30, 0, TAU);
      ctx.fillStyle = s.id !== null ? INK : PAPER;
      ctx.fill(); ctx.stroke();
      for (const b of TouchLayout.buttons) {
        const down = Input.keyDown[b.action];
        ctx.globalAlpha = down ? 0.9 : 0.5;
        ctx.fillStyle = down ? INK : PAPER;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.stroke();
        let label = b.label;
        if (b.action === 'run' && this.player.cls.dash) label = 'DASH';
        ctx.globalAlpha = down ? 1 : 0.75;
        this.text(label, b.x, b.y + 4, b.r > 50 ? 13 : 10, { weight: 700, spacing: 1, align: 'center', color: down ? PAPER : INK });
      }
    }
    ctx.restore();
  }

  // Portrait phones: ask for landscape (drawn above everything else).
  drawRotateHint(ctx) {
    if (window.innerHeight > window.innerWidth) {
      ctx.fillStyle = PAPER;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(0, 250, VIEW_W, 200);
      ctx.globalAlpha = 1;
      this.text('TURN YOUR DEVICE SIDEWAYS', VIEW_W / 2, 350, 34, { weight: 300, spacing: 10, align: 'center' });
      this.text('the march is played in landscape', VIEW_W / 2, 390, 16, { spacing: 3, align: 'center' });
    }
  }

  drawPause(ctx) {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.88;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    const cx = VIEW_W / 2;
    this.text('PAUSED', cx, 210, 34, { weight: 300, spacing: 16, align: 'center' });
    this.text('v' + GAME_VERSION, 16, 24, 11, { spacing: 2 });
    const lines = [
      'MOVE   ARROWS / WASD   (up and down walk into and out of the screen)',
      'RUN   double-tap ← or →,  or hold SHIFT / C      ROGUE: SHIFT / C dashes (untouchable), attack out of it: twin strike',
      'JUMP   SPACE / Z / K',
      'ATTACK   X / J / LEFT CLICK   (repeat for a three-hit combo)',
      'RUNNING ATTACK   attack while running      JUMP ATTACK   attack in the air',
      'GRAB & THROW   attack point-blank: knee, knee, then throw',
      'BACK ATTACK   F / RIGHT CLICK   or JUMP + ATTACK together - hits both sides',
      'MAGIC   V / Q   spends every pot you carry - more pots, bigger spell',
      'LANES   you only hit what shares your lane - except the WARRIOR\'s sword wave (third slash)',
      'ARCHER   every third shot is a fire arrow      ROGUE   every strike cuts twice',
      'MUTE   M',
    ];
    lines.forEach((l, i) => this.text(l, cx, 262 + i * 26, 12, { spacing: 2, align: 'center' }));
    this.text('P / ESC to resume', cx, 262 + lines.length * 26 + 30, 12, { spacing: 3, align: 'center', weight: 700 });
  }
}

window.addEventListener('load', () => {
  window.SEEK = new Game(document.getElementById('game'));
});
