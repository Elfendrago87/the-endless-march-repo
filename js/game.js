'use strict';
// Game state machine, main loop, camera, rendering, HUD and the final door.

const STATE = {
  START: 'START',
  WAVE_INTRO: 'WAVE_INTRO',     // "NEXT_WAVE": banner, player can move
  WAVE: 'WAVE',
  FINAL_WAVE: 'FINAL_WAVE',
  WAVE_COMPLETE: 'WAVE_COMPLETE',
  DOOR: 'DOOR',
  ENDING: 'ENDING',
  PLAYER_DEAD: 'PLAYER_DEAD',
};

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const STEP = 1 / 60;

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.player = new Player(this);
    this.enemyPool = new Pool(() => new Enemy(), 48);
    this.enemies = this.enemyPool.items;
    this.waves = new WaveManager(this);
    this.spawnUsed = new Map();
    this.cam = { x: 0, y: 0, zoom: 1, look: 0 };

    const q = new URLSearchParams(location.search);
    this.debug = q.has('debug');
    this.god = q.has('god');
    this.startWave = clamp((parseInt(q.get('wave'), 10) || 1) - 1, 0, WAVES.length - 1);

    this.time = 0;
    this.paused = false;
    this.hitstopT = 0;
    this.slowT = 0; this.slowScale = 1;
    this.fade = null;
    this.fadeIn = 1;
    this.hurtFlash = 0;
    this.hudAlpha = 1;
    this.waveIndex = 0;
    this.doorRise = 0; this.doorOpen = 0; this.whiteout = 0; this.endWalk = false; this.endT = 0;
    this.chimed = false;

    this.toTitle();

    Input.init(canvas);
    Input.onRawKey = (code) => {
      if (this.debug && code === 'KeyN') this.debugClearWave();
      if (this.debug && code === 'KeyH') this.player.hp = PLAYER_CFG.maxHp;
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

  setState(s) { this.state = s; this.stateT = 0; }

  get combatAllowed() {
    const s = this.state;
    return s === STATE.WAVE || s === STATE.FINAL_WAVE || s === STATE.WAVE_INTRO || s === STATE.WAVE_COMPLETE;
  }

  pausable() { return this.combatAllowed || this.state === STATE.DOOR; }

  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  slowmo(scale, t) { this.slowScale = scale; this.slowT = t; }

  // ------------------------------------------------------------ flow
  toTitle() {
    Sound.droneStop(0.1);
    this.loadArena('hall');
    this.player.reset(this.arena.start.x, this.arena.start.y);
    this.player.control = false;
    this.enemyPool.clear();
    Projectiles.clear();
    FX.clear();
    this.waves.def = null;
    this.whiteout = 0;
    this.fadeIn = 1;
    this.hudAlpha = 0;
    this.setState(STATE.START);
    this.updateCamera(0, true);
  }

  startRun() {
    Sound.droneStop(0.1);
    this.enemyPool.clear();
    Projectiles.clear();
    FX.clear();
    const i = this.startWave;
    this.loadArena(WAVES[i].arena);
    this.player.reset(this.arena.start.x, this.arena.start.y);
    this.doorRise = 0; this.doorOpen = 0; this.whiteout = 0; this.endWalk = false; this.endT = 0;
    this.hudAlpha = 1;
    this.fadeIn = 1;
    this.slowT = 0;
    this.updateCamera(0, true);
    this.beginWaveIntro(i);
  }

  loadArena(key) {
    this.arena = new Arena(key);
    this.spawnUsed.clear();
    Projectiles.clear();
  }

  beginWaveIntro(i) {
    this.waveIndex = i;
    this.waves.def = null;
    this.setState(STATE.WAVE_INTRO);
    Sound.waveStart(!!WAVES[i].final);
  }

  onWaveCleared() {
    const final = !!WAVES[this.waveIndex].final;
    this.setState(STATE.WAVE_COMPLETE);
    this.slowmo(0.3, 0.7);
    Sound.waveClear();
    for (const p of Projectiles.pool.items) if (p.active) Projectiles.kill(p, false);
    if (!final) this.player.hp = Math.min(PLAYER_CFG.maxHp, this.player.hp + PLAYER_CFG.healBetweenWaves);
  }

  advanceWave() {
    const next = this.waveIndex + 1;
    if (WAVES[next].arena !== this.arena.key) {
      this.startFade(1.2, () => {
        this.loadArena(WAVES[next].arena);
        this.player.place(this.arena.start.x, this.arena.start.y);
        this.player.facing = 1;
        this.updateCamera(0, true);
        this.beginWaveIntro(next);
      });
    } else {
      this.beginWaveIntro(next);
    }
  }

  startFade(dur, onMid) { this.fade = { t: 0, dur, onMid, fired: false }; }

  startDoor() {
    this.setState(STATE.DOOR);
    this.doorRise = 0; this.doorOpen = 0; this.endWalk = false; this.endT = 0; this.whiteout = 0;
    this.player.speedMul = 1;
    Sound.droneStart();
    Sound.rumble();
  }

  // ------------------------------------------------------------ step
  step(dt) {
    if (Input.pressed.pause && this.pausable()) this.paused = !this.paused;
    if (this.paused) {
      if (Input.pressed.confirm) this.paused = false;
      return;
    }
    this.time += dt;
    this.fadeIn = Math.max(0, this.fadeIn - dt * 1.6);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    const hudTarget = (this.state === STATE.START || this.state === STATE.DOOR || this.state === STATE.ENDING) ? 0 : 1;
    this.hudAlpha = approach(this.hudAlpha, hudTarget, dt * 1.5);

    if (this.fade) {
      const f = this.fade;
      f.t += dt;
      if (!f.fired && f.t >= f.dur / 2) { f.fired = true; f.onMid(); }
      if (f.t >= f.dur) this.fade = null;
      this.updateCamera(dt, false);
      return;
    }

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
        if (Input.anyPressed) this.startRun();
        break;

      case STATE.WAVE_INTRO:
        this.updateWorld(sdt);
        if (this.stateT >= 1.4) {
          this.waves.start(this.waveIndex);
          this.setState(WAVES[this.waveIndex].final ? STATE.FINAL_WAVE : STATE.WAVE);
        }
        break;

      case STATE.WAVE:
      case STATE.FINAL_WAVE:
        this.updateWorld(sdt);
        if (this.state === STATE.PLAYER_DEAD) break;
        this.waves.update(sdt);
        if (this.waves.complete) this.onWaveCleared();
        break;

      case STATE.WAVE_COMPLETE:
        this.updateWorld(sdt);
        if (this.state === STATE.PLAYER_DEAD) break;
        if (WAVES[this.waveIndex].final) {
          if (this.stateT >= 2.2) this.startDoor();
        } else if (this.stateT >= 1.9) this.advanceWave();
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
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) if (E[i].active) E[i].update(dt, this);
    this.separateEnemies();
    this.resolvePlayerHits();
    Projectiles.update(dt, this);
    FX.update(dt);
  }

  separateEnemies() {
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) {
      const a = E[i];
      if (!a.active || a.ai === 'flyer' || a.state === 'shadow' || a.state === 'attack') continue;
      for (let j = i + 1; j < E.length; j++) {
        const b = E[j];
        if (!b.active || b.ai === 'flyer' || b.state === 'shadow' || b.state === 'attack') continue;
        if (Math.abs(a.bottom - b.bottom) > 24) continue;
        const ov = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        if (ov <= 0) continue;
        const push = Math.min(ov, 6) * 0.5;
        if (a.cx < b.cx) { a.x -= push; b.x += push; } else { a.x += push; b.x -= push; }
        const minX = 40, maxX = this.arena.width - 40;
        a.x = clamp(a.x, minX, maxX - a.w);
        b.x = clamp(b.x, minX, maxX - b.w);
      }
    }
  }

  resolvePlayerHits() {
    const p = this.player;
    if (!p.hitActive) return;
    const a = p.atk, hb = p.hitBox;
    let hits = 0, blocked = false, below = false;
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (!e.active || e.lastHitId === p.attackId) continue;
      if (!rectsOverlap(hb, e)) continue;
      e.lastHitId = p.attackId;
      const ix = (Math.max(hb.x, e.x) + Math.min(hb.x + hb.w, e.x + e.w)) / 2;
      const iy = (Math.max(hb.y, e.y) + Math.min(hb.y + hb.h, e.y + e.h)) / 2;
      const r = e.hit(a, p.cx, p.bottom, this);
      if (r === 'blocked') {
        blocked = true;
        FX.ring(ix, iy, 4, 40, 0.2, false, 3);
        FX.burst(ix, iy, 8, 360, { dir: -p.facing, spread: 1.0, streak: true, grav: 300 });
      } else if (r === 'hit') {
        hits++;
        if (e.cy > p.bottom - 6) below = true;
        FX.ring(ix, iy, 2, a.heavy ? 22 : 13, 0.08, false, 0, true);
        FX.ring(ix, iy, 6, a.heavy ? 74 : 42, a.heavy ? 0.26 : 0.18, false, a.heavy ? 5 : 3);
        FX.burst(ix, iy, a.heavy ? 16 : 9, a.heavy ? 640 : 440, { dir: p.facing, spread: 0.8, streak: true, grav: 600 });
      }
    }
    if (hits > 0) {
      this.hitstop(a.hitstop);
      FX.shake(a.shake);
      Sound.hit(!!a.heavy);
      if (a.air && below && !p.pogoUsed) { p.vy = -PLAYER_CFG.pogoVel; p.pogoUsed = true; }
    } else if (blocked) {
      this.hitstop(0.05);
      FX.shake(0.06);
      Sound.block();
      p.vx = -p.facing * 280;
    }
  }

  // ------------------------------------------------------------ spawning
  spawnWaveEnemy(type) {
    const air = ENEMY_TYPES[type].ai === 'flyer';
    const px = this.player.cx;
    let best = null, bestScore = -Infinity;
    for (const s of this.arena.spawns) {
      if (!!s.air !== air) continue;
      const d = Math.abs(s.x - px);
      let score = d >= 340 ? 1000 + Math.random() * 700 : d;
      const used = this.spawnUsed.get(s);
      if (used !== undefined && this.time - used < 1.5) score -= 900;
      if (score > bestScore) { best = s; bestScore = score; }
    }
    const e = this.enemyPool.obtain();
    if (!best || !e) return false;
    this.spawnUsed.set(best, this.time);
    e.reset(type, best.x + rand(-8, 8), best.y);
    e.facing = px >= best.x ? 1 : -1;
    Sound.spawn();
    return true;
  }

  onEnemyKilled(e) {
    const big = !!e.c.big;
    FX.burst(e.cx, e.cy, big ? 40 : 22, big ? 560 : 400, { streak: true, grav: 700 });
    FX.burst(e.cx, e.cy, big ? 14 : 8, 160, { grav: -40, life: 1.6 });
    FX.ring(e.cx, e.cy, 8, big ? 130 : 72, 0.4, false, big ? 6 : 4);
    FX.shake(big ? 0.3 : 0.1);
    Sound.enemyDie(big);
    this.waves.onDefeated();
    const split = e.c.split;
    if (split) {
      for (let i = 0; i < split.count; i++) {
        const child = this.enemyPool.obtain();
        if (!child) break;
        const d = i % 2 === 0 ? -1 : 1;
        child.reset(split.type, e.cx + d * 12, e.bottom, { vx: d * 240, vy: -420, spawnDur: 0.3 });
        child.facing = d;
        this.waves.addExtra(1);
      }
    }
    if (this.waves.def && this.waves.spawned === this.waves.required && this.waves.alive === 0) {
      this.slowmo(0.25, 0.6);
      FX.ring(e.cx, e.cy, 10, 400, 0.8, false, 2);
    }
  }

  onPlayerHurt() { this.hurtFlash = 1; this.hitstop(0.06); }

  onPlayerDeath() {
    this.setState(STATE.PLAYER_DEAD);
    this.slowmo(0.35, 0.9);
    FX.shake(0.5);
    FX.ring(this.player.cx, this.player.cy, 10, 220, 0.9, false, 3);
  }

  debugClearWave() {
    if (!this.waves.def || !(this.state === STATE.WAVE || this.state === STATE.FINAL_WAVE)) return;
    const w = this.waves;
    w.queue.length = 0;
    w.phase = w.def.phases.length - 1;
    w.spawned = w.required;
    for (const e of this.enemies) if (e.active) { e.active = false; w.onDefeated(); }
    w.alive = 0;
    w.defeated = w.required;
  }

  // ------------------------------------------------------------ door
  updateDoor(dt) {
    const d = this.arena.door, p = this.player, gy = this.arena.groundY;
    if (this.doorRise < 1) {
      this.doorRise = Math.min(1, this.doorRise + dt / 2.8);
      FX.shake(0.012);
      if (Math.random() < 0.6) FX.dust(d.x + rand(-d.slabW / 2, d.slabW / 2), gy, 1);
      if (this.doorRise >= 1) { FX.shake(0.25); Sound.slam(); FX.dust(d.x, gy, 30); }
    }
    const dist = Math.abs(p.cx - d.x);
    if (!this.endWalk) {
      if (this.doorRise >= 1) {
        const target = clamp((1100 - dist) / 900, 0, 1);
        this.doorOpen = Math.max(this.doorOpen, approach(this.doorOpen, target, 0.45 * dt));
      }
      p.speedMul = lerp(1, 0.35, this.doorOpen);
      Sound.droneSet(0.06 + this.doorOpen * 0.5);
      if (this.doorRise >= 1 && dist < 36 && p.onGround) {
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
  updateCamera(dt, snap) {
    const a = this.arena, p = this.player, c = this.cam;
    const tz = a.zoom;
    c.zoom = snap ? tz : approach(c.zoom, tz, dt * 0.25);
    const vw = VIEW_W / c.zoom, vh = VIEW_H / c.zoom;
    const px = p.alive ? p.cx : p.deathX;
    c.look = snap ? p.facing * 60 : approach(c.look, p.facing * 60, dt * 160);
    let center = px + c.look;
    if (this.state === STATE.DOOR && a.door) {
      center = px + clamp((a.door.x - px) * 0.5, -vw * 0.3, vw * 0.3) * this.doorRise;
    }
    let tx = center - vw / 2;
    tx = a.width <= vw ? (a.width - vw) / 2 : clamp(tx, 0, a.width - vw);
    const k = this.state === STATE.DOOR ? 2.5 : 7;
    c.x = snap ? tx : lerp(c.x, tx, 1 - Math.exp(-dt * k));
    c.y = VIEW_H - vh;
  }

  // ------------------------------------------------------------ render
  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    this.drawOverlayText(ctx);

    let fa = this.fadeIn;
    if (this.fade) {
      const k = this.fade.t / this.fade.dur;
      fa = Math.max(fa, 1 - Math.abs(k * 2 - 1));
    }
    if (fa > 0) {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = fa;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
    if (this.paused) this.drawPause(ctx);
    ctx.restore();
  }

  renderWorld(ctx) {
    const c = this.cam, z = c.zoom;
    let sx = 0, sy = 0;
    if (FX.trauma > 0) {
      const m = 16 * FX.trauma * FX.trauma;
      sx = rand(-m, m); sy = rand(-m, m);
    }
    ctx.save();
    ctx.scale(z, z);
    ctx.translate(-c.x + sx, -c.y + sy);

    if (this.arena.door && (this.state === STATE.DOOR)) this.drawDoor(ctx);
    this.arena.draw(ctx);
    FX.drawBack(ctx);
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) if (E[i].active) E[i].draw(ctx, this);
    this.player.draw(ctx);
    Projectiles.draw(ctx);
    FX.drawFront(ctx);
    if (this.arena.door && this.state === STATE.DOOR) this.drawDoorLight(ctx);
    ctx.restore();

    this.drawIndicators(ctx);
  }

  // Edge chevrons for threats (and the door) outside the view.
  drawIndicators(ctx) {
    if (this.state === STATE.START) return;
    const c = this.cam, z = c.zoom, vw = VIEW_W / z;
    ctx.fillStyle = '#000';
    const chevron = (wx, wy, big) => {
      let dir = 0;
      if (wx < c.x) dir = -1; else if (wx > c.x + vw) dir = 1;
      if (!dir) return;
      const y = clamp((wy - c.y) * z, 70, VIEW_H - 40);
      const x = dir < 0 ? 14 : VIEW_W - 14;
      const s = big ? 12 : 7;
      ctx.beginPath();
      ctx.moveTo(x + dir * s * 0.6, y);
      ctx.lineTo(x - dir * s * 0.6, y - s);
      ctx.lineTo(x - dir * s * 0.6, y + s);
      ctx.closePath();
      ctx.fill();
    };
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (!e.active || e.state === 'shadow') continue;
      chevron(e.cx, e.cy, !!e.c.big);
    }
    if (this.state === STATE.DOOR && this.arena.door && this.doorRise > 0.3) {
      chevron(this.arena.door.x, this.arena.groundY - 120, true);
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

  drawDoor(ctx) {
    const d = this.arena.door, gy = this.arena.groundY;
    const rise = easeOutCubic(this.doorRise);
    if (rise <= 0) return;
    const sx = d.x - d.slabW / 2, top = gy - d.slabH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx - 60, -1200, d.slabW + 120, gy + 1200);
    ctx.clip();
    ctx.translate(0, d.slabH * (1 - rise));
    // the monolith
    ctx.fillStyle = '#000';
    ctx.fillRect(sx, top, d.slabW, d.slabH);
    ctx.fillRect(sx + 40, top - 34, d.slabW - 80, 36);
    ctx.fillRect(sx + 110, top - 60, d.slabW - 220, 28);
    // the door
    const o = this.doorOpen;
    const dw = d.doorW, dh = d.doorH;
    if (o > 0) {
      ctx.save();
      this.archPath(ctx, d.x, gy, dw, dh);
      ctx.clip();
      const gap = dw * easeInOutSine(o);
      ctx.fillStyle = '#fff';
      ctx.fillRect(d.x - gap / 2, gy - dh - 2, gap, dh + 4);
      ctx.restore();
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    this.archPath(ctx, d.x, gy, dw, dh);
    ctx.stroke();
    this.archPath(ctx, d.x, gy, dw + 22, dh + 14);
    ctx.stroke();
    const gap = dw * easeInOutSine(o);
    ctx.beginPath();
    ctx.moveTo(d.x - gap / 2, gy - dh + (gap < 4 ? 0 : 6));
    ctx.lineTo(d.x - gap / 2, gy);
    ctx.moveTo(d.x + gap / 2, gy - dh + (gap < 4 ? 0 : 6));
    ctx.lineTo(d.x + gap / 2, gy);
    ctx.stroke();
    ctx.restore();
  }

  // The light spills over everything black: slab, ground, player.
  drawDoorLight(ctx) {
    const o = this.doorOpen;
    if (o <= 0.001) return;
    const d = this.arena.door, gy = this.arena.groundY;
    const cx = d.x, cy = gy - d.doorH * 0.45;
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
    const r = 80 + intensity * 900;
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
    if (a <= 0.01 || this.state === STATE.START) return;
    ctx.globalAlpha = a;
    const x = 64, y = 46;
    this.text('WAVE ' + (this.waveIndex + 1), x, y, 18, { weight: 700, spacing: 4 });
    this.text('HP', x, y + 30, 12, { weight: 700, spacing: 2 });
    const blocks = 10, bw = 14, bh = 10, gap = 3;
    const fill = this.player.hp / PLAYER_CFG.maxHp * blocks;
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let i = 0; i < blocks; i++) {
      const bx = x + 30 + i * (bw + gap), by = y + 20;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      const f = clamp(fill - i, 0, 1);
      if (f > 0) ctx.fillRect(bx, by, bw * f, bh);
    }
    let remaining;
    if (this.waves.def) remaining = this.waves.remaining;
    else { remaining = 0; for (const ph of WAVES[this.waveIndex].phases) for (const [, n] of ph) remaining += n; }
    this.text('ENEMIES: ' + remaining, x, y + 56, 12, { weight: 700, spacing: 2 });
    ctx.globalAlpha = 1;
  }

  drawOverlayText(ctx) {
    const s = this.state, t = this.stateT;
    const cx = VIEW_W / 2;
    if (s === STATE.START) {
      const a = clamp(this.time * 1.2, 0, 1);
      ctx.globalAlpha = a;
      this.text('SEEK', cx, 250, 132, { weight: 300, spacing: 44, align: 'center' });
      ctx.globalAlpha = a * (0.45 + 0.35 * Math.sin(this.time * 2.5));
      this.text('press any key', cx, 316, 15, { spacing: 4, align: 'center' });
      ctx.globalAlpha = a * 0.7;
      this.text('← →  move      SPACE  jump      X / J / click  attack      SHIFT / C / right-click  dash      ↓ + SPACE  drop      P  pause', cx, VIEW_H - 24, 11, { spacing: 1, align: 'center', color: '#fff' });
      ctx.globalAlpha = 1;
    } else if (s === STATE.WAVE_INTRO) {
      const a = t < 0.25 ? t / 0.25 : t > 1.1 ? Math.max(0, 1 - (t - 1.1) / 0.3) : 1;
      ctx.globalAlpha = a;
      this.text('WAVE ' + (this.waveIndex + 1), cx, 210, 44, { weight: 300, spacing: 18, align: 'center' });
      ctx.globalAlpha = 1;
    } else if (s === STATE.WAVE_COMPLETE && !WAVES[this.waveIndex].final) {
      const a = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 1.3) / 0.5);
      ctx.globalAlpha = clamp(a, 0, 1);
      this.text('CLEARED', cx, 210, 20, { weight: 400, spacing: 12, align: 'center' });
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
        this.text('SEEK', cx, 340, 96, { weight: 300, spacing: 36, align: 'center' });
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

  drawPause(ctx) {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    const cx = VIEW_W / 2;
    this.text('PAUSED', cx, 270, 34, { weight: 300, spacing: 16, align: 'center' });
    const lines = [
      'MOVE   ← → / A D',
      'JUMP   SPACE / W / ↑ / Z',
      'ATTACK   X / J / LEFT CLICK   (press repeatedly for a three-hit combo)',
      'DASH   SHIFT / C / RIGHT CLICK   (brief invulnerability)',
      'DROP THROUGH PLATFORM   ↓ + JUMP',
      'MUTE   M',
    ];
    lines.forEach((l, i) => this.text(l, cx, 330 + i * 26, 12, { spacing: 2, align: 'center' }));
    this.text('P / ESC to resume', cx, 510, 12, { spacing: 3, align: 'center', weight: 700 });
  }
}

window.addEventListener('load', () => {
  window.SEEK = new Game(document.getElementById('game'));
});
