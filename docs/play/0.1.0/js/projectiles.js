'use strict';
// Pooled enemy projectiles. Black orbs. The sword can cut them out of the air.

const Projectiles = {
  pool: new Pool(() => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: 7, dmg: 10, kb: 220, life: 0 }), 64),

  clear() { this.pool.clear(); },

  fire(x, y, vx, vy, dmg, kb, r) {
    const p = this.pool.obtain();
    if (!p) return;
    p.active = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.dmg = dmg; p.kb = kb; p.r = r || 7; p.life = 4;
  },

  kill(p, white) {
    p.active = false;
    FX.burst(p.x, p.y, 6, 180, { grav: 0, white: white });
  },

  update(dt, g) {
    const items = this.pool.items, pl = g.player, solids = g.arena.solids;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 || p.x < -50 || p.x > g.arena.width + 50 || p.y > 900 || p.y < -600) { p.active = false; continue; }
      let blocked = false;
      for (let k = 0; k < solids.length; k++) {
        const s = solids[k];
        if (p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h) { blocked = true; break; }
      }
      if (blocked) { this.kill(p, false); continue; }
      // parry: a swinging sword destroys projectiles
      if (pl.hitActive && circleRect(p.x, p.y, p.r + 4, pl.hitBox)) {
        this.kill(p, false);
        FX.ring(p.x, p.y, 4, 34, 0.2, false, 3);
        Sound.parry();
        g.hitstop(0.03);
        continue;
      }
      if (pl.alive && circleRect(p.x, p.y, p.r, pl)) {
        if (pl.hurt(p.dmg, p.x - p.vx, p.kb, -220)) this.kill(p, false);
      }
    }
  },

  draw(ctx) {
    const items = this.pool.items;
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
      // short tapered tail
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const tx = -p.vx / sp, ty = -p.vy / sp;
      ctx.beginPath();
      ctx.moveTo(p.x + ty * p.r * 0.7, p.y - tx * p.r * 0.7);
      ctx.lineTo(p.x + tx * p.r * 3.2, p.y + ty * p.r * 3.2);
      ctx.lineTo(p.x - ty * p.r * 0.7, p.y + tx * p.r * 0.7);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#000';
    }
  },
};
