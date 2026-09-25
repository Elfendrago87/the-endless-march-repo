'use strict';
// Small math / collision helpers shared by every system.

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function approach(v, target, delta) {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}
function sign(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; }
function rand(a, b) { return a + Math.random() * (b - a); }
function easeOutCubic(t) { t = 1 - t; return 1 - t * t * t; }
function easeInCubic(t) { return t * t * t; }
function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }

function Rect(x, y, w, h) { return { x: x || 0, y: y || 0, w: w || 0, h: h || 0 }; }

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRect(cx, cy, r, b) {
  const nx = clamp(cx, b.x, b.x + b.w);
  const ny = clamp(cy, b.y, b.y + b.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Hitboxes are authored relative to an actor's foot-centre, facing right.
// This writes the world-space rect into `out` (no allocation), mirrored by facing.
function placeBox(out, cx, bottom, box, facing) {
  out.w = box.w;
  out.h = box.h;
  out.x = facing > 0 ? cx + box.x : cx - box.x - box.w;
  out.y = bottom + box.y;
  return out;
}

// Fixed-size object pool. Objects carry an `active` flag and are reused.
class Pool {
  constructor(create, size) {
    this.items = new Array(size);
    for (let i = 0; i < size; i++) this.items[i] = create();
  }
  obtain() {
    const it = this.items;
    for (let i = 0; i < it.length; i++) if (!it[i].active) return it[i];
    return null;
  }
  clear() {
    const it = this.items;
    for (let i = 0; i < it.length; i++) it[i].active = false;
  }
}

// ---------------------------------------------------------------- outline drawing kit
// Everything with a body (figures, enemies, weapons, structures) is drawn as a
// white shape with a black outline. `inkFlash` inverts the fill for the frame
// an actor is hit.
const INK = '#000', PAPER = '#fff', OUTLINE = 2.5;
let inkFlash = false;

// Fill the current path as an outlined shape.
function finish(ctx, flash) {
  ctx.fillStyle = (flash || inkFlash) ? INK : PAPER;
  ctx.fill();
  ctx.lineWidth = OUTLINE;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

// A limb: thin ones are plain sticks, thick ones are outlined tubes.
function limb(ctx, x1, y1, x2, y2, w) {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = INK;
  if (w < 5) {
    ctx.lineWidth = OUTLINE;
    ctx.stroke();
    return;
  }
  ctx.lineWidth = w + OUTLINE;
  ctx.stroke();
  ctx.lineWidth = w - OUTLINE;
  ctx.strokeStyle = inkFlash ? INK : PAPER;
  ctx.stroke();
  ctx.strokeStyle = INK;
}

// Outlined rectangle.
function box(ctx, x, y, w, h, flash) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  finish(ctx, flash);
}

// Eyes and small marks are ink on paper (paper on ink while flashing).
function eye(ctx, x, y, w, h, flash) {
  ctx.fillStyle = (flash || inkFlash) ? PAPER : INK;
  ctx.fillRect(x, y, w, h);
}

// Stroke colour for detail lines drawn inside a body.
function detailInk(flash) { return (flash || inkFlash) ? PAPER : INK; }
