'use strict';
// Monochrome visual effects: particles, sword slashes, rings, dash ghosts,
// screen shake and hit-stop. Everything is pooled.

const FX = {
  particles: new Pool(() => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, white: false, grav: 0, drag: 0, streak: false }), 600),
  slashes: new Pool(() => ({ active: false, owner: null, facing: 1, a0: 0, a1: 0, t: 0, dur: 0.1, thick: 20, r: 100 }), 16),
  rings: new Pool(() => ({ active: false, x: 0, y: 0, r0: 0, r1: 0, t: 0, dur: 0.3, white: false, width: 3, fill: false }), 40),
  ghosts: new Pool(() => ({ active: false, t: 0, dur: 0.2, pose: { x: 0, y: 0, facing: 1, sword: 0, legA: 0, legB: 0, lean: 0, sx: 1, sy: 1, cloak: 0, time: 0 } }), 24),
  trauma: 0,

  clear() {
    this.particles.clear(); this.slashes.clear(); this.rings.clear(); this.ghosts.clear();
    this.trauma = 0;
  },

  shake(amount) { this.trauma = Math.min(0.8, this.trauma + amount); },

  particle(x, y, vx, vy, life, size, white, grav, drag, streak) {
    const p = this.particles.obtain();
    if (!p) return;
    p.active = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = p.max = life; p.size = size; p.white = !!white;
    p.grav = grav || 0; p.drag = drag || 0; p.streak = !!streak;
  },

  // Radial burst. dir (-1/1/0) biases the spray horizontally.
  burst(x, y, n, speed, opts) {
    const o = opts || {};
    for (let i = 0; i < n; i++) {
      let a = Math.random() * TAU;
      if (o.dir) a = (o.dir > 0 ? 0 : Math.PI) + rand(-o.spread || -0.9, o.spread || 0.9);
      if (o.up) a = -Math.PI / 2 + rand(-o.up, o.up);
      const s = speed * rand(0.35, 1);
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.6) * (o.life || 1),
        rand(2, 5) * (o.size || 1), o.white, o.grav === undefined ? 900 : o.grav, o.drag || 2, o.streak);
    }
  },

  dust(x, y, n, dir) {
    for (let i = 0; i < n; i++) {
      const vx = (dir ? dir * rand(40, 220) : rand(-200, 200));
      this.particle(x + rand(-8, 8), y - rand(0, 4), vx, -rand(20, 140), rand(0.2, 0.45), rand(2, 4), false, 300, 4);
    }
  },

  ring(x, y, r0, r1, dur, white, width, fill) {
    const r = this.rings.obtain();
    if (!r) return;
    r.active = true; r.x = x; r.y = y; r.r0 = r0; r.r1 = r1; r.t = 0; r.dur = dur;
    r.white = !!white; r.width = width || 3; r.fill = !!fill;
  },

  slash(owner, atk) {
    const s = this.slashes.obtain();
    if (!s) return;
    s.active = true; s.owner = owner; s.facing = owner.facing;
    s.a0 = atk.sweep[0]; s.a1 = atk.sweep[1];
    s.t = 0; s.dur = atk.active; s.thick = atk.thickness;
    s.r = PLAYER_CFG.bladeLength + 22;
  },

  ghost(pose) {
    const g = this.ghosts.obtain();
    if (!g) return;
    g.active = true; g.t = 0; g.dur = 0.22;
    Object.assign(g.pose, pose);
  },

  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const ps = this.particles.items;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.grav * dt;
      const d = 1 / (1 + p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    const ss = this.slashes.items;
    for (let i = 0; i < ss.length; i++) {
      const s = ss[i];
      if (!s.active) continue;
      s.t += dt;
      if (s.t > s.dur + 0.14) s.active = false;
    }
    const rs = this.rings.items;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (!r.active) continue;
      r.t += dt;
      if (r.t >= r.dur) r.active = false;
    }
    const gs = this.ghosts.items;
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      if (!g.active) continue;
      g.t += dt;
      if (g.t >= g.dur) g.active = false;
    }
  },

  drawBack(ctx) {
    const gs = this.ghosts.items;
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      if (!g.active) continue;
      ctx.globalAlpha = 0.28 * (1 - g.t / g.dur);
      drawFigure(ctx, g.pose, false);
    }
    ctx.globalAlpha = 1;
  },

  drawFront(ctx) {
    // sword slashes: a crescent swept behind the blade, thickest at its leading edge
    const ss = this.slashes.items;
    for (let i = 0; i < ss.length; i++) {
      const s = ss[i];
      if (!s.active) continue;
      const o = s.owner;
      const prog = Math.min(1, s.t / s.dur);
      const fade = s.t > s.dur ? 1 - (s.t - s.dur) / 0.14 : 1;
      const aEnd = lerp(s.a0, s.a1, easeOutCubic(prog));
      const aStart = lerp(s.a0, aEnd, s.t > s.dur ? (s.t - s.dur) / 0.14 : 0);
      ctx.save();
      ctx.translate(o.x + o.w / 2 + s.facing * 3, o.y + o.h - 34);
      ctx.scale(s.facing, 1);
      ctx.globalAlpha = 0.9 * fade;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      const N = 18;
      for (let k = 0; k <= N; k++) {
        const a = lerp(aStart, aEnd, k / N);
        ctx.lineTo(Math.cos(a) * s.r, Math.sin(a) * s.r);
      }
      for (let k = N; k >= 0; k--) {
        const f = k / N;
        const a = lerp(aStart, aEnd, f);
        const r = s.r - s.thick * Math.pow(f, 1.6) - 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      if (s.thick >= 36) {
        // heavy swing gets an outer echo line
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        const a0 = lerp(aStart, aEnd, 0.25);
        ctx.arc(0, 0, s.r + 12, Math.min(a0, aEnd), Math.max(a0, aEnd));
        ctx.stroke();
      }
      ctx.restore();
    }

    const ps = this.particles.items;
    ctx.fillStyle = '#000';
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? '#000' : '#fff';
      ctx.strokeStyle = ctx.fillStyle;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (!p.active || p.white !== (pass === 1)) continue;
        const k = p.life / p.max;
        const sz = p.size * (0.4 + 0.6 * k);
        if (p.streak) {
          ctx.lineWidth = sz * 0.7;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
        } else {
          ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
        }
      }
    }

    const rs = this.rings.items;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (!r.active) continue;
      const k = r.t / r.dur;
      const rad = lerp(r.r0, r.r1, easeOutCubic(k));
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(0.1, rad), 0, TAU);
      if (r.fill) {
        ctx.fillStyle = r.white ? '#fff' : '#000';
        ctx.fill();
      } else {
        ctx.lineWidth = r.width * (1 - k * 0.6);
        ctx.strokeStyle = r.white ? '#fff' : '#000';
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },
};
