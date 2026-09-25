'use strict';
// The scrolling stage (horizon scenery, floor, foreground) and the shared
// belt-scroller movement routine.

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BG_PARALLAX = 0.5;
const FG_PARALLAX = 1.25;

class Stage {
  constructor() {
    this.length = STAGE.length;
    this.door = STAGE.door;
    this.back = [];   // distant silhouettes on the horizon
    this.front = [];  // foreground rocks / grass on the bottom band
    this.marks = [];  // sparse floor marks
    const segs = STAGE.segments;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const end = i + 1 < segs.length ? segs[i + 1].x : this.length;
      const rnd = seededRandom(1000 + i * 77);
      this.buildBack(seg.scenery, seg.x, end, rnd);
      if (seg.scenery !== 'void') this.buildFront(seg.x, end, rnd);
      const density = seg.scenery === 'void' ? 0.15 : 1;
      for (let x = seg.x; x < end; x += 70) {
        if (rnd() > 0.55 * density) continue;
        this.marks.push({ x: x + rnd() * 60, z: 10 + rnd() * (DEPTH - 20), w: 5 + rnd() * 12 });
      }
    }
  }

  buildBack(kind, x0, x1, rnd) {
    // Shapes live in parallax space: visible while the camera is in [x0, x1].
    const p0 = x0 * BG_PARALLAX, p1 = x1 * BG_PARALLAX;
    let x = p0 + rnd() * 80;
    while (x < p1) {
      if (kind === 'plain') {
        if (rnd() < 0.55) this.back.push({ t: 'hill', x, w: 120 + rnd() * 220, h: 14 + rnd() * 30 });
        else this.back.push({ t: 'tree', x, h: 40 + rnd() * 50, s: rnd() });
        x += 90 + rnd() * 200;
      } else if (kind === 'ruins') {
        const r = rnd();
        if (r < 0.5) this.back.push({ t: 'column', x, w: 14 + rnd() * 14, h: 40 + rnd() * 80, s: rnd() });
        else if (r < 0.75) this.back.push({ t: 'arch', x, w: 60 + rnd() * 40, h: 50 + rnd() * 30 });
        else this.back.push({ t: 'block', x, w: 20 + rnd() * 40, h: 8 + rnd() * 16 });
        x += 70 + rnd() * 160;
      } else if (kind === 'fortress') {
        const r = rnd();
        if (r < 0.55) this.back.push({ t: 'wall', x, w: 140 + rnd() * 200, h: 40 + rnd() * 35 });
        else if (r < 0.8) this.back.push({ t: 'tower', x, w: 30 + rnd() * 16, h: 60 + rnd() * 30 });
        else this.back.push({ t: 'spears', x, w: 50 + rnd() * 60, h: 40 + rnd() * 30 });
        x += 60 + rnd() * 150;
      } else {
        // the void: nearly nothing, one thin distant spire now and then
        if (rnd() < 0.3) this.back.push({ t: 'spire', x, h: 30 + rnd() * 60 });
        x += 500 + rnd() * 600;
      }
    }
  }

  buildFront(x0, x1, rnd) {
    const p0 = x0 * FG_PARALLAX, p1 = x1 * FG_PARALLAX + 900;
    let x = p0 + rnd() * 200;
    while (x < p1) {
      this.front.push({ t: rnd() < 0.6 ? 'tuft' : 'rock', x, w: 16 + rnd() * 40, h: 6 + rnd() * 18 });
      x += 160 + rnd() * 400;
    }
  }

  drawBack(ctx, camX, viewW, time) {
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    const off = camX * (1 - BG_PARALLAX);
    const lo = camX * BG_PARALLAX - 400, hi = camX * BG_PARALLAX + viewW + 400;
    for (const s of this.back) {
      if (s.x < lo || s.x > hi) continue;
      const x = s.x + off, b = FLOOR_Y;
      switch (s.t) {
        case 'hill':
          ctx.beginPath();
          ctx.ellipse(x, b, s.w / 2, s.h, 0, Math.PI, 0);
          ctx.fill();
          break;
        case 'tree': {
          ctx.lineCap = 'round';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x, b); ctx.lineTo(x + 2, b - s.h);
          ctx.moveTo(x + 1, b - s.h * 0.55); ctx.lineTo(x - 12 - s.s * 8, b - s.h * 0.8);
          ctx.moveTo(x + 2, b - s.h * 0.75); ctx.lineTo(x + 14 + s.s * 6, b - s.h - 6);
          ctx.stroke();
          break;
        }
        case 'column': {
          const top = b - s.h;
          ctx.beginPath();
          ctx.moveTo(x, b); ctx.lineTo(x, top + 6);
          ctx.lineTo(x + s.w * 0.4, top - 4 * s.s); ctx.lineTo(x + s.w * 0.7, top + 8);
          ctx.lineTo(x + s.w, top + 2); ctx.lineTo(x + s.w, b);
          ctx.closePath();
          ctx.fill();
          ctx.fillRect(x - 4, b - 6, s.w + 8, 6);
          break;
        }
        case 'arch':
          ctx.fillRect(x, b - s.h, 14, s.h);
          ctx.fillRect(x + s.w - 14, b - s.h, 14, s.h);
          ctx.beginPath();
          ctx.arc(x + s.w / 2, b - s.h, s.w / 2, Math.PI, 0);
          ctx.lineTo(x + s.w - 14, b - s.h);
          ctx.arc(x + s.w / 2, b - s.h, s.w / 2 - 14, 0, Math.PI, true);
          ctx.closePath();
          ctx.fill();
          break;
        case 'block':
          ctx.fillRect(x, b - s.h, s.w, s.h);
          break;
        case 'wall':
          ctx.fillRect(x, b - s.h, s.w, s.h);
          for (let cx = x; cx < x + s.w - 8; cx += 16) ctx.fillRect(cx, b - s.h - 8, 9, 8);
          break;
        case 'tower':
          ctx.fillRect(x, b - s.h, s.w, s.h);
          ctx.beginPath();
          ctx.moveTo(x - 6, b - s.h); ctx.lineTo(x + s.w / 2, b - s.h - 30); ctx.lineTo(x + s.w + 6, b - s.h);
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + s.w / 2, b - s.h - 30); ctx.lineTo(x + s.w / 2, b - s.h - 50);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + s.w / 2, b - s.h - 50);
          ctx.lineTo(x + s.w / 2 + 12 + Math.sin(time * 3 + s.x) * 2, b - s.h - 46);
          ctx.lineTo(x + s.w / 2, b - s.h - 42);
          ctx.fill();
          break;
        case 'spears':
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let k = 0; k < s.w; k += 9) {
            const lean = Math.sin(k * 1.7 + s.x) * 3;
            ctx.moveTo(x + k, b); ctx.lineTo(x + k + lean, b - s.h);
          }
          ctx.stroke();
          break;
        case 'spire':
          ctx.beginPath();
          ctx.moveTo(x - 3, b); ctx.lineTo(x, b - s.h); ctx.lineTo(x + 3, b);
          ctx.fill();
          break;
      }
    }
    // horizon
    ctx.fillRect(camX - 50, FLOOR_Y - 1, viewW + 100, 2);
  }

  drawFloor(ctx, camX, viewW) {
    ctx.fillStyle = '#000';
    for (const m of this.marks) {
      if (m.x < camX - 40 || m.x > camX + viewW + 40) continue;
      const k = m.z / DEPTH; // marks get a little heavier toward the front
      ctx.fillRect(m.x, FLOOR_Y + m.z, m.w * (0.7 + k * 0.6), 1 + k);
    }
  }

  drawFront(ctx, camX, viewW, bottomY) {
    const top = FLOOR_Y + DEPTH + 26;
    ctx.fillStyle = '#000';
    ctx.fillRect(camX - 50, top, viewW + 100, bottomY - top + 50);
    const off = camX * (1 - FG_PARALLAX);
    const lo = camX * FG_PARALLAX - 200, hi = camX * FG_PARALLAX + viewW + 200;
    for (const f of this.front) {
      if (f.x < lo || f.x > hi) continue;
      const x = f.x + off;
      ctx.beginPath();
      if (f.t === 'tuft') {
        ctx.moveTo(x, top);
        ctx.lineTo(x + f.w * 0.2, top - f.h);
        ctx.lineTo(x + f.w * 0.35, top - f.h * 0.3);
        ctx.lineTo(x + f.w * 0.55, top - f.h * 1.2);
        ctx.lineTo(x + f.w * 0.7, top - f.h * 0.4);
        ctx.lineTo(x + f.w * 0.85, top - f.h * 0.8);
        ctx.lineTo(x + f.w, top);
      } else {
        ctx.ellipse(x + f.w / 2, top, f.w / 2, f.h, 0, Math.PI, 0);
      }
      ctx.fill();
    }
  }
}

// Moves an actor on the floor plane; handles gravity landing and bounds.
function moveActor(a, dt, minX, maxX, gravity) {
  if (gravity) a.vy = Math.min(a.vy + GRAVITY * dt, 1150);
  a.hitWall = 0;
  a.x += a.vx * dt;
  if (a.x < minX) { a.x = minX; a.hitWall = -1; if (a.vx < 0) a.vx = 0; }
  else if (a.x + a.w > maxX) { a.x = maxX - a.w; a.hitWall = 1; if (a.vx > 0) a.vx = 0; }
  a.z += a.vz * dt;
  if (a.z < 0) { a.z = 0; if (a.vz < 0) a.vz = 0; }
  else if (a.z > DEPTH) { a.z = DEPTH; if (a.vz > 0) a.vz = 0; }
  a.y += a.vy * dt;
  if (a.y + a.h >= 0) {
    a.y = -a.h;
    if (a.vy > 0) a.vy = 0;
    a.onGround = true;
  } else a.onGround = false;
}

// Melee connection test in belt-scroller space.
function hitsActor(box, depthTol, attackerZ, target) {
  return Math.abs(attackerZ - target.z) <= depthTol && rectsOverlap(box, target);
}

function drawShadow(ctx, a) {
  const elev = -(a.y + a.h);
  const k = clamp(1 - elev / 260, 0.3, 1);
  ctx.beginPath();
  ctx.ellipse(a.x + a.w / 2, FLOOR_Y + a.z, (a.w * 0.6 + 6) * k, 3.2 * k, 0, 0, TAU);
  ctx.fill();
}
