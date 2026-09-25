'use strict';
// Pooled enemy projectiles: spinning black axes that travel along the floor
// plane. Step out of their lane (change depth) to dodge; a swing cuts them down.
// Also the pooled pickups (magic pots and food) that thieves drop.

const Projectiles = {
  pool: new Pool(() => ({ active: false, x: 0, z: 0, y: 0, vx: 0, vz: 0, r: 7, dmg: 10, kb: 220, life: 0, spin: 0, axe: true }), 64),

  clear() { this.pool.clear(); },

  // y = elevation (negative is up) of the projectile's centre
  fire(x, z, y, vx, vz, dmg, kb, r, axe) {
    const p = this.pool.obtain();
    if (!p) return;
    p.active = true; p.x = x; p.z = z; p.y = y; p.vx = vx; p.vz = vz;
    p.dmg = dmg; p.kb = kb; p.r = r || 7; p.life = 3.5; p.spin = 0; p.axe = !!axe;
  },

  kill(p) {
    p.active = false;
    FX.burst(p.x, FLOOR_Y + p.z + p.y, 6, 180, { grav: 0 });
  },

  update(dt, g) {
    const items = this.pool.items, pl = g.player;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.spin += dt * 18 * sign(p.vx || 1);
      if (p.life <= 0 || p.z < -10 || p.z > DEPTH + 10 || p.x < g.cam.x - 120 || p.x > g.cam.x + g.viewW + 120) {
        p.active = false;
        continue;
      }
      // parry: a swinging sword cuts projectiles out of the air
      if (pl.hitActive && Math.abs(p.z - pl.z) <= pl.atk.depth + 6 && circleRect(p.x, p.y, p.r + 4, pl.hitBox)) {
        this.kill(p);
        FX.ring(p.x, FLOOR_Y + p.z + p.y, 4, 34, 0.2, false, 3);
        Sound.parry();
        g.hitstop(0.03);
        continue;
      }
      if (pl.alive && Math.abs(p.z - pl.z) <= 14 && circleRect(p.x, p.y, p.r, pl)) {
        if (pl.hurt(p.dmg, p.x - p.vx, p.kb, -220, false)) this.kill(p);
      }
    }
  },

  drawShadows(ctx) {
    const items = this.pool.items;
    ctx.fillStyle = INK;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      ctx.beginPath();
      ctx.ellipse(p.x, FLOOR_Y + p.z, p.r, 2, 0, 0, TAU);
      ctx.fill();
    }
  },

  draw(ctx) {
    const items = this.pool.items;
    ctx.lineJoin = 'round';
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      ctx.save();
      ctx.translate(p.x, FLOOR_Y + p.z + p.y);
      ctx.rotate(p.spin);
      // a hand axe: haft + crescent head
      limb(ctx, -p.r * 1.3, 0, p.r * 1.3, 0, 3);
      ctx.beginPath();
      ctx.moveTo(p.r * 0.6, -p.r * 1.1);
      ctx.quadraticCurveTo(p.r * 2.2, 0, p.r * 0.6, p.r * 1.1);
      ctx.lineTo(p.r * 0.9, 0);
      ctx.closePath();
      finish(ctx);
      ctx.restore();
    }
  },
};

const POWER_KINDS = { heal: 1, barrier: 1, power: 1, rage: 1 };

const Items = {
  pool: new Pool(() => ({ active: false, isItem: true, kind: 'pot', x: 0, z: 0, y: 0, vx: 0, vy: 0, t: 0, ground: 0 }), 24),

  clear() { this.pool.clear(); },

  // `elev` drops it from a height (a power block's top); `exact` keeps its lane.
  drop(kind, x, z, elev, exact) {
    const it = this.pool.obtain();
    if (!it) return;
    it.active = true; it.kind = kind; it.x = x;
    it.z = exact ? z : clamp(z + rand(-12, 12), 4, DEPTH - 4);
    it.y = -(elev || 0) - 20; it.t = 0; it.ground = 0;
    if (exact) { it.vx = (Math.random() < 0.5 ? -1 : 1) * rand(50, 70); it.vy = -420; }
    else { it.vx = rand(-90, 90); it.vy = -260; }
  },

  update(dt, g) {
    const pl = g.player;
    for (const it of this.pool.items) {
      if (!it.active) continue;
      it.t += dt;
      // fall onto the floor or a ledge (and ride a moving ledge)
      it.ground = groundUnder(it.x - 6, it.x + 6, it.z, -it.y);
      if (it.y < -it.ground - 0.5 || it.vy < 0) {
        it.vy += GRAVITY * 0.7 * dt;
        it.y += it.vy * dt;
        it.x += it.vx * dt;
        if (it.y >= -it.ground) { it.y = -it.ground; it.vy = it.vy > 200 ? -it.vy * 0.3 : 0; it.vx *= 0.5; }
      } else it.y = -it.ground;
      const life = POWER_KINDS[it.kind] ? 20 : 14;
      if (it.t > life) { it.active = false; continue; }
      if (pl.alive && it.t > 0.3 && Math.abs(it.x - pl.cx) < 22 && Math.abs(it.z - pl.z) < 14 && Math.abs(pl.bottom - it.y) < 26) {
        it.active = false;
        g.pickUp(it.kind, it.x, it.z, -it.y);
      }
    }
  },

  // Shadows first, bodies in the depth-sorted draw list.
  drawShadows(ctx) {
    ctx.fillStyle = INK;
    for (const it of this.pool.items) {
      if (!it.active) continue;
      ctx.beginPath();
      ctx.ellipse(it.x, FLOOR_Y + it.z - it.ground, 8, 2, 0, 0, TAU);
      ctx.fill();
    }
  },

  draw(ctx, it) {
    const life = POWER_KINDS[it.kind] ? 20 : 14;
    if (it.t > life - 3 && Math.floor(it.t * 10) % 2 === 0) return; // about to vanish
    ctx.lineJoin = 'round';
    const x = it.x;
    const y = FLOOR_Y + it.z + it.y - Math.abs(Math.sin(it.t * 4)) * 2;
    if (POWER_KINDS[it.kind]) { this.drawPower(ctx, it, x, y); return; }
    if (it.kind === 'pot') {
      // a small flask: one outline for neck and bowl, a cork on top
      ctx.beginPath();
      ctx.moveTo(x - 2.5, y - 13);
      ctx.lineTo(x - 2.5, y - 18);
      ctx.lineTo(x + 2.5, y - 18);
      ctx.lineTo(x + 2.5, y - 13);
      ctx.arc(x, y - 7, 7, -Math.PI / 2 + 0.37, Math.PI * 1.5 - 0.37);
      ctx.closePath();
      finish(ctx);
      box(ctx, x - 4, y - 21, 8, 3);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 6); ctx.lineTo(x + 5, y - 6);
      ctx.stroke();
    } else {
      // a loaf of bread with scored top
      ctx.beginPath();
      ctx.ellipse(x, y - 6, 11, 7, 0, Math.PI, 0);
      ctx.lineTo(x + 11, y - 1);
      ctx.lineTo(x - 11, y - 1);
      ctx.closePath();
      finish(ctx);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 11); ctx.lineTo(x - 2, y - 6);
      ctx.moveTo(x + 2, y - 11); ctx.lineTo(x + 4, y - 6);
      ctx.stroke();
    }
  },

  // Powerups: outlined shapes that bob and glint.
  drawPower(ctx, it, x, y) {
    const cy = y - 13 - Math.sin(it.t * 3) * 2;
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    // a glint that turns around it
    const ga = it.t * 3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = ga + k * Math.PI / 2;
      ctx.moveTo(x + Math.cos(a) * 15, cy + Math.sin(a) * 15);
      ctx.lineTo(x + Math.cos(a) * 19, cy + Math.sin(a) * 19);
    }
    ctx.stroke();
    if (it.kind === 'heal') {
      // a heart
      ctx.beginPath();
      ctx.moveTo(x, cy + 9);
      ctx.bezierCurveTo(x - 14, cy - 1, x - 9, cy - 13, x, cy - 5);
      ctx.bezierCurveTo(x + 9, cy - 13, x + 14, cy - 1, x, cy + 9);
      ctx.closePath();
      finish(ctx);
      ctx.fillStyle = INK;
      ctx.fillRect(x - 1.5, cy - 4, 3, 8); ctx.fillRect(x - 4, cy - 1.5, 8, 3);
    } else if (it.kind === 'barrier') {
      // a hexagonal force-field bubble
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 + Math.PI / 6;
        const px = x + Math.cos(a) * 11, py = cy + Math.sin(a) * 11;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      finish(ctx);
      ctx.fillStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, cy, 6, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - 2, cy - 2, 2, 0, TAU);
      ctx.fill();
    } else if (it.kind === 'rage') {
      // a spiked burst
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI / 8 + it.t;
        const r = k % 2 ? 6 : 12;
        const px = x + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      finish(ctx);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(x, cy, 2.5, 0, TAU); ctx.fill();
    } else {
      // the class capsule: a pill with the class's sign on it
      ctx.beginPath();
      ctx.moveTo(x - 7, cy - 7); ctx.lineTo(x + 7, cy - 7);
      ctx.arc(x + 7, cy, 7, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x - 7, cy + 7);
      ctx.arc(x - 7, cy, 7, Math.PI / 2, Math.PI * 1.5);
      ctx.closePath();
      finish(ctx);
      ctx.fillStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const k = typeof SEEK !== 'undefined' && SEEK.player ? SEEK.player.cls.key : 'warrior';
      if (k === 'archer') {
        // three falling arrows
        for (let i = -1; i <= 1; i++) { ctx.moveTo(x + i * 5, cy - 4); ctx.lineTo(x + i * 5, cy + 4); ctx.moveTo(x + i * 5 - 2, cy + 1.5); ctx.lineTo(x + i * 5, cy + 4); ctx.lineTo(x + i * 5 + 2, cy + 1.5); }
      } else if (k === 'rogue') {
        // a wing
        ctx.moveTo(x - 8, cy + 3); ctx.quadraticCurveTo(x - 2, cy - 7, x + 9, cy - 4);
        ctx.moveTo(x - 5, cy + 3); ctx.lineTo(x + 7, cy - 1); ctx.moveTo(x - 2, cy + 3); ctx.lineTo(x + 5, cy + 2);
      } else {
        // three stacked lanes with a slash across
        for (let i = -1; i <= 1; i++) { ctx.moveTo(x - 9, cy + i * 4); ctx.lineTo(x + 9, cy + i * 4); }
        ctx.moveTo(x - 5, cy + 6); ctx.lineTo(x + 5, cy - 6);
      }
      ctx.stroke();
    }
  },
};

// The Archer's arrows. They fly down the lane they were loosed in (a fan
// spreads across lanes), drop when fired from the air, stick in the ground
// where they land, and are turned aside by a raised shield. Fire arrows pierce
// every enemy in their path and set them burning.
const Arrows = {
  pool: new Pool(() => ({ active: false, x: 0, z: 0, y: 0, vx: 0, vy: 0, vz: 0, spec: null, atk: {}, id: 0, life: 0, stuck: 0, t: 0 }), 48),
  serial: 0,

  clear() { this.pool.clear(); },

  fire(x, z, y, vx, vy, vz, spec) {
    const a = this.pool.obtain();
    if (!a) return;
    a.active = true; a.x = x; a.z = z; a.y = y; a.vx = vx; a.vy = vy; a.vz = vz;
    a.spec = spec; a.id = ++this.serial; a.life = 1.6; a.stuck = 0; a.t = 0;
    const k = a.atk;
    k.dmg = spec.dmg; k.kb = spec.kb; k.kbUp = spec.kbUp; k.stagger = spec.stagger;
    k.knockdown = !!spec.knockdown; k.heavy = !!spec.heavy; k.magic = false;
  },

  update(dt, g) {
    const items = this.pool.items;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (!a.active) continue;
      a.t += dt;
      if (a.stuck > 0) {
        a.stuck -= dt;
        if (a.stuck <= 0) a.active = false;
        continue;
      }
      a.life -= dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.z = clamp(a.z + a.vz * dt, 0, DEPTH);
      if (a.spec.fire && Math.random() < 0.6) {
        FX.particle(a.x - sign(a.vx) * 10, FLOOR_Y + a.z + a.y, -a.vx * 0.05, -rand(30, 90), rand(0.2, 0.4), rand(2, 3.5), false, -80, 2);
      }
      const gr = a.vy > 0 ? groundUnder(a.x - 1, a.x + 1, a.z, -a.y + 14) : 0;
      if (a.y >= -gr - 2) {
        // into the ground (or a ledge): it stays there a moment
        a.y = -gr - 2;
        a.stuck = 0.9;
        FX.dust(a.x, FLOOR_Y + a.z - gr, 3);
        continue;
      }
      if (a.life <= 0 || a.y < -600 || a.x < g.cam.x - 60 || a.x > g.cam.x + g.viewW + 60) { a.active = false; continue; }
      const dir = sign(a.vx) || 1;
      const tipX = a.x + dir * 10;
      if (g.strikeBlock(tipX - 2, tipX + 2, a.z, a.y, a.y)) { a.active = false; continue; }
      for (const e of g.enemies) {
        if (!e.active || e.untouchable || e.lastArrowId === a.id) continue;
        if (Math.abs(e.z - a.z) > LANE) continue;
        if (tipX < e.x - 4 || tipX > e.x + e.w + 4 || a.y < e.y - 8 || a.y > e.y + e.h + 4) continue;
        e.lastArrowId = a.id;
        const r = e.hit(a.atk, a.x - dir * 60, 0, g);
        const sx = tipX, sy = FLOOR_Y + e.z + a.y;
        if (r === 'blocked') {
          // glances off the shield
          FX.burst(sx, sy, 6, 240, { dir: -dir, streak: true, grav: 400 });
          Sound.block();
          a.active = false;
          break;
        }
        if (r === 'hit') {
          FX.ring(sx, sy, 3, a.spec.fire ? 44 : 26, 0.18, false, 3);
          FX.burst(sx, sy, a.spec.fire ? 10 : 5, 320, { dir: dir, streak: true, grav: 500 });
          Sound.hit(!!a.spec.heavy);
          g.hitstop(a.spec.heavy ? 0.05 : 0.025);
          if (a.spec.fire && e.behavior !== 'thief') { e.burnT = 2.1; e.burnTick = 0.35; }
          if (!a.spec.pierce) { a.active = false; break; }
        }
      }
    }
  },

  drawShadows(ctx) {
    ctx.fillStyle = INK;
    for (const a of this.pool.items) {
      if (!a.active || a.stuck > 0) continue;
      ctx.fillRect(a.x - 8, FLOOR_Y + a.z - 1, 16, 1.5);
    }
  },

  draw(ctx) {
    for (const a of this.pool.items) {
      if (!a.active) continue;
      const y = FLOOR_Y + a.z + a.y;
      let ux = a.vx, uy = a.vy;
      if (a.stuck > 0) { ux = (a.spec.angle ? Math.cos(a.spec.angle) : 1) * (sign(a.vx) || 1); uy = 0.6; }
      const len = Math.hypot(ux, uy) || 1;
      ux /= len; uy /= len;
      if (a.stuck > 0 && a.stuck < 0.3 && Math.floor(a.t * 12) % 2 === 0) continue;
      drawArrowShape(ctx, a.x - ux * 30, y - uy * 30, a.x + ux * 4, y + uy * 4, a.spec.fire && a.stuck <= 0, a.t);
    }
  },
};

// The Warrior's sword wave: a standing crescent of force released by the
// third slash of the combo. It rolls forward along the floor and, unlike every
// other attack, it crosses lanes - it strikes anything on the ground it passes.
const SwordWaves = {
  pool: new Pool(() => ({ active: false, x: 0, dir: 1, dist: 0, t: 0, spec: null, id: 0, atk: {} }), 6),
  serial: 0,

  clear() { this.pool.clear(); },

  fire(x, dir, spec) {
    const w = this.pool.obtain();
    if (!w) return;
    w.active = true; w.x = x; w.dir = dir; w.dist = 0; w.t = 0; w.spec = spec; w.id = ++this.serial;
    const k = w.atk;
    k.dmg = spec.dmg; k.kb = spec.kb; k.kbUp = spec.kbUp; k.stagger = spec.stagger;
    k.knockdown = false; k.heavy = false; k.magic = false;
    Sound.wave();
  },

  update(dt, g) {
    for (const w of this.pool.items) {
      if (!w.active) continue;
      w.t += dt;
      const step = w.spec.speed * dt;
      w.x += w.dir * step;
      w.dist += step;
      if (w.dist >= w.spec.range || w.x < g.cam.x - 60 || w.x > g.cam.x + g.viewW + 60) { w.active = false; continue; }
      if (Math.random() < 0.5) FX.dust(w.x, FLOOR_Y + rand(10, DEPTH - 10), 1, w.dir);
      for (const e of g.enemies) {
        if (!e.active || e.untouchable || e.lastWaveId === w.id) continue;
        if (e.bottom < -90) continue; // it hugs the ground: high flyers pass over it
        if (e.x + e.w < w.x - 16 || e.x > w.x + 16) continue;
        e.lastWaveId = w.id;
        const r = e.hit(w.atk, w.x - w.dir * 60, 0, g);
        if (r === 'hit') {
          FX.ring(e.cx, e.screenY - e.h / 2, 4, 36, 0.2, false, 3);
          Sound.hit(false);
        } else if (r === 'blocked') {
          FX.burst(e.cx, e.screenY - e.h / 2, 6, 260, { dir: -w.dir, streak: true });
          Sound.block();
        }
      }
    }
  },

  draw(ctx) {
    for (const w of this.pool.items) {
      if (!w.active) continue;
      const k = w.dist / w.spec.range;
      ctx.globalAlpha = 1 - k * k;
      ctx.lineJoin = 'round';
      const d = w.dir, x = w.x, top = FLOOR_Y - 4, bot = FLOOR_Y + DEPTH + 6;
      // the wave front, laid across the whole floor
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.quadraticCurveTo(x + d * 34, (top + bot) / 2, x, bot);
      ctx.quadraticCurveTo(x + d * 14, (top + bot) / 2, x, top);
      ctx.closePath();
      finish(ctx);
      // standing crescents rising out of it, one per stretch of floor
      for (let i = 0; i < 4; i++) {
        const fy = top + (bot - top) * (0.15 + i * 0.24);
        const h = 34 + 10 * Math.sin(w.t * 20 + i);
        const bx = x + d * (8 + 10 * Math.sin((i / 3) * Math.PI));
        ctx.beginPath();
        ctx.moveTo(bx, fy);
        ctx.quadraticCurveTo(bx + d * 16, fy - h * 0.5, bx - d * 2, fy - h);
        ctx.quadraticCurveTo(bx + d * 6, fy - h * 0.5, bx, fy);
        ctx.closePath();
        finish(ctx);
      }
      // speed lines trailing behind
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ly = top + (bot - top) * (i + 0.5) / 5;
        ctx.moveTo(x - d * 10, ly);
        ctx.lineTo(x - d * (40 + 20 * ((i * 7) % 3)), ly);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },
};
