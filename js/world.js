'use strict';
// Arena geometry and the shared platformer collision routine.

class Arena {
  constructor(key) {
    const d = ARENAS[key];
    this.key = key;
    this.def = d;
    this.width = d.width;
    this.groundY = d.groundY;
    this.solids = d.solids;
    this.platforms = d.platforms;
    this.spawns = d.spawns;
    this.start = d.start;
    this.door = d.door || null;
    this.final = !!d.final;
    this.zoom = d.zoom || 1;
  }

  draw(ctx) {
    ctx.fillStyle = '#000';
    for (const s of this.solids) ctx.fillRect(s.x, s.y, s.w, s.h + 400);
    for (const p of this.platforms) {
      ctx.fillRect(p.x, p.y, p.w, 14);
      // thin supports hanging beneath - reads as architecture, not floating bars
      ctx.fillRect(p.x + 10, p.y + 14, 4, 10);
      ctx.fillRect(p.x + p.w - 14, p.y + 14, 4, 10);
    }
  }
}

// Moves an axis-aligned body (x, y, w, h, vx, vy) through the arena.
// Sets onGround / onPlatform / hitWall. `body.dropping` ignores one-way platforms.
function moveBody(b, dt, arena) {
  const solids = arena.solids;
  b.hitWall = 0;

  b.x += b.vx * dt;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!rectsOverlap(b, s)) continue;
    const pushRight = b.vx < 0 || (b.vx === 0 && b.x + b.w / 2 > s.x + s.w / 2);
    if (pushRight) { b.x = s.x + s.w; b.hitWall = -1; } else { b.x = s.x - b.w; b.hitWall = 1; }
    b.vx = 0;
  }

  const prevBottom = b.y + b.h;
  b.y += b.vy * dt;
  b.onGround = false;
  b.onPlatform = false;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!rectsOverlap(b, s)) continue;
    if (b.vy >= 0) { b.y = s.y - b.h; b.onGround = true; } else { b.y = s.y + s.h; }
    b.vy = 0;
  }
  if (!b.dropping && b.vy >= 0) {
    const plats = arena.platforms;
    for (let i = 0; i < plats.length; i++) {
      const p = plats[i];
      if (prevBottom <= p.y + 0.5 && b.y + b.h >= p.y && b.x + b.w > p.x && b.x < p.x + p.w) {
        b.y = p.y - b.h;
        b.vy = 0;
        b.onGround = true;
        b.onPlatform = true;
      }
    }
  }
}
