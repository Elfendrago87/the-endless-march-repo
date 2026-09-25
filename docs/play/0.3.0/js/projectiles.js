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
    ctx.fillStyle = '#000';
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      ctx.save();
      ctx.translate(p.x, FLOOR_Y + p.z + p.y);
      ctx.rotate(p.spin);
      // a hand axe: haft + crescent head
      ctx.fillRect(-p.r * 1.3, -1.5, p.r * 2.6, 3);
      ctx.beginPath();
      ctx.moveTo(p.r * 0.6, -p.r * 1.1);
      ctx.quadraticCurveTo(p.r * 2.2, 0, p.r * 0.6, p.r * 1.1);
      ctx.lineTo(p.r * 0.9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },
};

const Items = {
  pool: new Pool(() => ({ active: false, kind: 'pot', x: 0, z: 0, y: 0, vx: 0, vy: 0, t: 0 }), 24),

  clear() { this.pool.clear(); },

  drop(kind, x, z) {
    const it = this.pool.obtain();
    if (!it) return;
    it.active = true; it.kind = kind; it.x = x; it.z = clamp(z + rand(-12, 12), 4, DEPTH - 4);
    it.y = -20; it.vx = rand(-90, 90); it.vy = -260; it.t = 0;
  },

  update(dt, g) {
    const pl = g.player;
    for (const it of this.pool.items) {
      if (!it.active) continue;
      it.t += dt;
      if (it.y < 0 || it.vy < 0) {
        it.vy += GRAVITY * 0.7 * dt;
        it.y += it.vy * dt;
        it.x += it.vx * dt;
        if (it.y >= 0) { it.y = 0; it.vy = it.vy > 200 ? -it.vy * 0.3 : 0; it.vx *= 0.5; }
      }
      if (it.t > 14) { it.active = false; continue; }
      if (pl.alive && pl.onGround && it.t > 0.3 && Math.abs(it.x - pl.cx) < 22 && Math.abs(it.z - pl.z) < 14) {
        it.active = false;
        g.pickUp(it.kind, it.x, it.z);
      }
    }
  },

  draw(ctx) {
    ctx.fillStyle = '#000';
    for (const it of this.pool.items) {
      if (!it.active) continue;
      if (it.t > 11 && Math.floor(it.t * 10) % 2 === 0) continue; // about to vanish
      const x = it.x, fy = FLOOR_Y + it.z;
      ctx.beginPath();
      ctx.ellipse(x, fy, 8, 2, 0, 0, TAU);
      ctx.fill();
      const y = fy + it.y - Math.abs(Math.sin(it.t * 4)) * 2;
      if (it.kind === 'pot') {
        // a small flask
        ctx.beginPath();
        ctx.arc(x, y - 7, 7, 0, TAU);
        ctx.fill();
        ctx.fillRect(x - 2.5, y - 19, 5, 7);
        ctx.fillRect(x - 4, y - 21, 8, 2.5);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 3, y - 9, 2, 3);
        ctx.fillStyle = '#000';
      } else {
        // a loaf of bread
        ctx.beginPath();
        ctx.ellipse(x, y - 6, 11, 7, 0, Math.PI, 0);
        ctx.lineTo(x + 11, y - 1);
        ctx.lineTo(x - 11, y - 1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 11); ctx.lineTo(x - 2, y - 6);
        ctx.moveTo(x + 2, y - 11); ctx.lineTo(x + 4, y - 6);
        ctx.stroke();
      }
    }
  },
};
