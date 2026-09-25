'use strict';
// The player: an outlined figure of one of three classes - the Warrior with an
// enormous sword, the Archer with a bow, the Rogue with twin daggers.

const SWORD_REST = -2.35; // warrior: blade resting up-and-back over the shoulder

// ---------------------------------------------------------------- figure drawing
// Local space faces right, origin at the feet. P carries the pose:
//   legs, lean, squash, cloak, weapon ('sword' | 'bow' | 'daggers'),
//   sword (main weapon angle), sword2 (second dagger), draw (bowstring 0..1), fire.
function drawFigure(ctx, P, showEye) {
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.scale(P.facing * P.sx, P.sy);
  ctx.rotate(P.lean);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const weapon = P.weapon || 'sword';

  // legs
  const hipY = -18;
  limb(ctx, 0, hipY, Math.sin(P.legB) * 18, hipY + Math.cos(P.legB) * 18, 6);
  limb(ctx, 0, hipY, Math.sin(P.legA) * 18, hipY + Math.cos(P.legA) * 18, 6);

  const c = P.cloak;
  const wig = Math.sin(P.time * 13) * 3 * (0.3 + c);
  if (weapon === 'sword') {
    // cloak tail streaming behind
    ctx.beginPath();
    ctx.moveTo(1, -39);
    ctx.lineTo(-3, -24);
    ctx.lineTo(-14 - 16 * c, -22 + 4 * c + wig);
    ctx.lineTo(-8 - 6 * c, -32 + wig * 0.4);
    ctx.closePath();
    finish(ctx);
  } else if (weapon === 'bow') {
    // quiver slung across the back, fletchings showing
    ctx.save();
    ctx.translate(-6, -30);
    ctx.rotate(-0.4);
    box(ctx, -3.5, -14, 7, 18);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -14); ctx.lineTo(-3, -20);
    ctx.moveTo(1, -14); ctx.lineTo(1, -21);
    ctx.moveTo(3, -14); ctx.lineTo(4, -19);
    ctx.stroke();
    ctx.restore();
  }

  // outlined wings while flying (Rogue's power)
  if (P.wings) {
    const f = Math.sin(P.wings * 22);
    for (const [len, sway] of [[30, 0], [24, 0.35]]) {
      ctx.beginPath();
      ctx.moveTo(-2, -34);
      ctx.lineTo(-len, -44 - f * 12 + sway * 10);
      ctx.lineTo(-len * 0.7, -36 - f * 6);
      ctx.lineTo(-len * 0.9, -30 - f * 4 + sway * 6);
      ctx.lineTo(-4, -28);
      ctx.closePath();
      finish(ctx);
    }
  }

  // torso
  limb(ctx, 0, hipY, 2, -35, weapon === 'daggers' ? 10 : 12);

  // head (+ hood / headband)
  if (weapon === 'bow') {
    ctx.beginPath();
    ctx.moveTo(-1, -55); ctx.lineTo(-11, -38 + wig * 0.3); ctx.lineTo(3, -38);
    ctx.closePath();
    finish(ctx);
  }
  ctx.beginPath();
  ctx.arc(4, -45, 8, 0, TAU);
  finish(ctx);
  if (weapon === 'bow') {
    // hood brim over the brow
    ctx.lineWidth = OUTLINE;
    ctx.beginPath();
    ctx.arc(4, -45, 8, -2.6, -0.35);
    ctx.lineTo(13, -46);
    ctx.stroke();
  } else if (weapon === 'daggers') {
    // headband with two tails
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-3, -48); ctx.lineTo(11, -48);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3, -48);
    ctx.quadraticCurveTo(-10, -48 + wig, -17 - 8 * c, -44 + wig * 1.5);
    ctx.moveTo(-3, -47);
    ctx.quadraticCurveTo(-9, -44 - wig, -14 - 7 * c, -39 - wig);
    ctx.stroke();
  }
  if (showEye) eye(ctx, 7, -47, 4, 2);

  if (weapon === 'bow') drawBow(ctx, P);
  else if (weapon === 'daggers') drawDaggers(ctx, P);
  else drawSword(ctx, P.sword);

  ctx.restore();
}

function drawSword(ctx, a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  const nx = -dy, ny = dx;
  const shx = 3, shy = -34;
  const hx = shx + dx * 15, hy = shy + dy * 15;
  limb(ctx, shx, shy, hx, hy, 3);
  limb(ctx, shx - 2, shy + 1, hx - dx * 5, hy - dy * 5, 3);
  const L = PLAYER_CFG.bladeLength;
  const bx = hx + dx * 8, by = hy + dy * 8;
  const w0 = 6.5;
  ctx.beginPath();
  ctx.moveTo(bx + nx * w0, by + ny * w0);
  ctx.lineTo(bx + dx * L * 0.8 + nx * w0 * 0.95, by + dy * L * 0.8 + ny * w0 * 0.95);
  ctx.lineTo(bx + dx * L, by + dy * L);
  ctx.lineTo(bx + dx * L * 0.8 - nx * w0 * 0.6, by + dy * L * 0.8 - ny * w0 * 0.6);
  ctx.lineTo(bx - nx * w0, by - ny * w0);
  ctx.closePath();
  finish(ctx);
  // fuller: the groove down the middle of the blade
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(bx + dx * 4, by + dy * 4);
  ctx.lineTo(bx + dx * L * 0.72, by + dy * L * 0.72);
  ctx.stroke();
  // guard, grip, pommel
  limb(ctx, hx + dx * 7 + nx * 12, hy + dy * 7 + ny * 12, hx + dx * 7 - nx * 12, hy + dy * 7 - ny * 12, 6);
  limb(ctx, hx - dx * 7, hy - dy * 7, hx + dx * 5, hy + dy * 5, 5);
  ctx.beginPath();
  ctx.arc(hx - dx * 9, hy - dy * 9, 3.5, 0, TAU);
  finish(ctx);
}

// A recurve bow held out along the aim angle, string pulled back by P.draw.
function drawBow(ctx, P) {
  const a = P.sword, draw = P.draw || 0;
  const dx = Math.cos(a), dy = Math.sin(a);
  const shx = 3, shy = -34;
  const hx = shx + dx * 17, hy = shy + dy * 17;
  const R = 22, span = 1.15;
  const cx = hx - dx * 8, cy = hy - dy * 8;
  const t1x = cx + Math.cos(a - span) * R, t1y = cy + Math.sin(a - span) * R;
  const t2x = cx + Math.cos(a + span) * R, t2y = cy + Math.sin(a + span) * R;
  const chord = R * Math.cos(span);
  const mx = cx + dx * (chord - draw * 17), my = cy + dy * (chord - draw * 17);
  // string (behind the bow limbs)
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(t1x, t1y); ctx.lineTo(mx, my); ctx.lineTo(t2x, t2y);
  ctx.stroke();
  // arms: bow hand forward, string hand at the nock
  limb(ctx, shx, shy, hx, hy, 3);
  limb(ctx, shx - 2, shy + 1, mx, my, 3);
  // the bow: an outlined curved limb
  ctx.beginPath();
  ctx.arc(cx, cy, R, a - span, a + span);
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = inkFlash ? INK : PAPER;
  ctx.stroke();
  ctx.strokeStyle = INK;
  box(ctx, hx - 2.5 - dx * 1, hy - 2.5 - dy * 1, 5, 5); // grip
  // nocked arrow while drawing
  if (draw > 0.05) {
    const tipx = mx + dx * 34, tipy = my + dy * 34;
    drawArrowShape(ctx, mx, my, tipx, tipy, P.fire, P.time);
  }
}

// Shaft + head + fletching; a fire arrow burns at the tip.
function drawArrowShape(ctx, x0, y0, x1, y1, fire, time) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * 5, y1 - uy * 5);
  ctx.moveTo(x0 + ux * 4, y0 + uy * 4); ctx.lineTo(x0 - ux * 1 + nx * 4, y0 - uy * 1 + ny * 4);
  ctx.moveTo(x0 + ux * 4, y0 + uy * 4); ctx.lineTo(x0 - ux * 1 - nx * 4, y0 - uy * 1 - ny * 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * 7 + nx * 3.5, y1 - uy * 7 + ny * 3.5);
  ctx.lineTo(x1 - ux * 7 - nx * 3.5, y1 - uy * 7 - ny * 3.5);
  ctx.closePath();
  finish(ctx);
  if (fire) drawFlames(ctx, x1 - ux * 4, y1 - uy * 4 + 2, time || 0, 7, 3);
}

// Two short blades, one per hand (P.sword, P.sword2).
function drawDaggers(ctx, P) {
  const one = (sx, sy, a, len) => {
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const hx = sx + dx * 13, hy = sy + dy * 13;
    limb(ctx, sx, sy, hx, hy, 3);
    const bx = hx + dx * 4, by = hy + dy * 4;
    ctx.beginPath();
    ctx.moveTo(bx + nx * 3, by + ny * 3);
    ctx.lineTo(bx + dx * len, by + dy * len);
    ctx.lineTo(bx - nx * 3, by - ny * 3);
    ctx.closePath();
    finish(ctx);
    limb(ctx, hx + dx * 3 + nx * 6, hy + dy * 3 + ny * 6, hx + dx * 3 - nx * 6, hy + dy * 3 - ny * 6, 3);
  };
  one(1, -33, P.sword2 === undefined ? 1.45 : P.sword2, 24);
  one(3, -34, P.sword, 26);
}

// Outlined flame tongues flickering upward from (x, y).
function drawFlames(ctx, x, y, time, size, count) {
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * size * 0.8;
    const h = size * (1.6 + 0.6 * Math.sin(time * 23 + i * 2.1));
    const sway = Math.sin(time * 17 + i * 3.3) * size * 0.35;
    const bx = x + off, w = size * 0.55;
    ctx.beginPath();
    ctx.moveTo(bx - w, y);
    ctx.quadraticCurveTo(bx - w, y - h * 0.5, bx + sway, y - h);
    ctx.quadraticCurveTo(bx + w, y - h * 0.5, bx + w, y);
    ctx.quadraticCurveTo(bx, y + w * 0.6, bx - w, y);
    ctx.closePath();
    finish(ctx);
  }
}

function drawFigureBodyOnly(ctx, P) {
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.scale(P.facing * P.sx, P.sy);
  ctx.rotate(P.lean);
  limb(ctx, 0, -18, Math.sin(P.legB) * 18, -18 + Math.cos(P.legB) * 18, 6);
  limb(ctx, 0, -18, Math.sin(P.legA) * 18, -18 + Math.cos(P.legA) * 18, 6);
  limb(ctx, 0, -18, 2, -35, 12);
  ctx.beginPath(); ctx.arc(6, -43, 8, 0, TAU); finish(ctx);
  limb(ctx, 3, -34, 16, -20, 3);
  ctx.restore();
}

// ---------------------------------------------------------------- the player
class Player {
  constructor(game) {
    this.g = game;
    this.hitBox = Rect();
    this.pose = { x: 0, y: 0, facing: 1, sword: SWORD_REST, sword2: 1.45, draw: 0, fire: false, weapon: 'sword',
      legA: 0, legB: 0, lean: 0, sx: 1, sy: 1, cloak: 0, time: 0 };
    this.setClass('warrior');
    this.reset(200, DEPTH / 2);
  }

  setClass(key) {
    this.cls = CLASSES[key] || CLASSES.warrior;
    this.stats = Object.assign({}, PLAYER_CFG, this.cls.stats);
    this.maxHp = this.stats.maxHp;
  }

  reset(x, z) {
    const c = this.stats;
    this.w = c.w; this.h = c.h;
    this.x = x - c.w / 2; this.y = -c.h; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.facing = 1;
    this.hp = this.maxHp;
    this.lives = c.lives;
    this.pots = c.startPots;
    this.alive = true;
    this.state = 'normal';
    this.t = 0;
    this.onGround = true; this.hitWall = 0;
    this.jumpBuf = 0; this.atkBuf = 0; this.backBuf = 0; this.magicBuf = 0; this.dashBuf = 0;
    this.invuln = 0;
    this.running = false; this.runDir = 0;
    this.airAttacks = 0;
    this.combo = 0; this.comboT = 0;
    this.atk = null; this.atkPhase = ''; this.atkT = 0; this.atkFrom = this.cls.rest;
    this.attackId = 0; this.hitActive = false; this.hitIdx = 0; this.hitEnd = 0;
    this.grabbed = null; this.knees = 0; this.kneeT = 0;
    this.hitCount = 0; this.hitCountT = 0;
    this.lying = false; this.downT = 0;
    this.dashCd = 0; this.airDash = true; this.dashVX = 0; this.dashVZ = 0; this.strikeT = 0;
    this.runPhase = 0; this.squash = 0; this.ghostT = 0;
    this.deathT = 0; this.reported = false;
    this.control = true; this.speedMul = 1;
    this.rage = 0; this.rageT = 0;
    this.barrier = 0; this.barrierT = 0;
    this.power = null; this.powerT = 0; this.fuel = 0; this.flying = false;
    this.plat = null;
    this.time = 0;
  }

  place(x, z) {
    this.x = x - this.w / 2; this.z = z; this.y = -this.h;
    this.vx = 0; this.vy = 0; this.vz = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get bottom() { return this.y + this.h; }
  get screenY() { return FLOOR_Y + this.z + this.y + this.h; }
  get invulnerable() {
    const s = this.state;
    return this.invuln > 0 || s === 'down' || s === 'getup' || s === 'magic' || s === 'throw' || s === 'dead' || s === 'dash';
  }

  // Returns true when damage was applied.
  hurt(dmg, fromX, kb, kbUp, knockdown) {
    if (!this.alive || this.invulnerable || this.g.god) return false;
    const dir = this.cx >= fromX ? 1 : -1;
    if (this.barrier > 0) {
      // the force field takes the blow instead
      this.barrier--;
      if (this.barrier <= 0) this.barrierT = 0;
      this.invuln = 0.45;
      FX.ring(this.cx, this.screenY - 25, 20, 60, 0.3, false, 4);
      FX.burst(this.cx, this.screenY - 25, 10, 300, { dir: -dir, streak: true, grav: 0 });
      FX.shake(0.08);
      Sound.block();
      return true;
    }
    const raging = this.rageT > 0;
    if (raging) dmg *= RAGE_CFG.damageTaken;
    this.addRage(dmg * RAGE_CFG.perDamage);
    this.hp = Math.max(0, this.hp - dmg);
    FX.shake(0.2 + dmg / 90);
    FX.burst(this.cx, this.screenY - 25, 14, 380, { dir: dir, spread: 1.2 });
    FX.ring(this.cx, this.screenY - 25, 6, 46, 0.25, false, 4);
    Sound.hurt();
    this.g.onPlayerHurt(dmg);
    if (raging && this.hp > 0) {
      // raging: the hit lands, but nothing stops you
      this.invuln = 0.3;
      return true;
    }
    this.releaseGrab();
    this.atk = null;
    this.hitActive = false;
    this.combo = 0;
    this.running = false;
    this.hitCount++;
    this.hitCountT = 1.2;
    if (this.hp <= 0) { this.die(dir); return true; }
    if (knockdown || this.hitCount >= 3) {
      this.knockDown(dir, kb || 300);
    } else {
      this.state = 'hurt';
      this.t = 0;
      this.vx = dir * (kb || 300) * 0.6;
      this.vz = 0;
      if (!this.onGround) this.vy = kbUp === undefined ? -250 : kbUp * 0.6;
      this.invuln = this.stats.hurtInvuln;
    }
    return true;
  }

  knockDown(dir, kb) {
    this.state = 'down';
    this.t = 0;
    this.hitCount = 0;
    this.lying = false;
    this.downT = 0;
    this.vx = dir * kb * 0.7;
    this.vy = -420;
    this.vz = 0;
    this.onGround = false;
  }

  releaseGrab() {
    if (this.grabbed) {
      const e = this.grabbed;
      this.grabbed = null;
      if (e.active && e.state === 'grabbed') { e.staggerT = 0.3; e.setState('stagger'); }
    }
  }

  die(dir) {
    this.alive = false;
    this.state = 'dead';
    this.deathT = 0;
    this.reported = false;
    this.deathFacing = this.facing;
    this.deathX = this.cx;
    this.deathZ = this.z;
    this.vx = dir * 220;
    this.vy = -320;
    this.vz = 0;
    this.hitActive = false;
    Sound.death();
  }

  // Spend a life: stand back up where you fell, clearing space around you.
  revive() {
    this.alive = true;
    this.hp = this.maxHp;
    this.place(this.deathX, this.deathZ);
    this.state = 'getup';
    this.t = 0;
    this.invuln = 2.2;
    this.hitCount = 0;
  }

  update(dt) {
    const c = this.stats, I = Input, g = this.g;
    this.t += dt;
    this.time += dt;
    this.jumpBuf -= dt; this.atkBuf -= dt; this.backBuf -= dt; this.magicBuf -= dt; this.dashBuf -= dt;
    this.invuln -= dt; this.comboT -= dt; this.hitCountT -= dt; this.dashCd -= dt; this.strikeT -= dt;
    if (this.hitCountT <= 0) this.hitCount = 0;
    this.squash = approach(this.squash, 0, dt * 5);
    const minX = g.cam.x + 6, maxX = g.cam.x + g.viewW - 6;

    if (this.state === 'dead') {
      this.deathT += dt;
      if (this.onGround) this.vx = approach(this.vx, 0, 1600 * dt);
      moveActor(this, dt, minX, maxX, true);
      if (!this.onGround || this.deathT < 0.05) { this.deathX = this.cx; this.deathZ = this.z; }
      if (this.deathT > 0.5 && this.deathT < 1.5 && Math.random() < 0.7) {
        FX.particle(this.deathX + rand(-12, 12), FLOOR_Y + this.deathZ - rand(0, 48), rand(-20, 20), -rand(40, 140), rand(0.6, 1.2), rand(2, 4), false, -60, 1);
      }
      if (this.deathT >= 1.9 && !this.reported) { this.reported = true; g.onPlayerFallen(); }
      return;
    }

    const mx = this.control ? I.axisX() : 0;
    const mz = this.control ? I.axisZ() : 0;
    if (this.control) {
      if (I.pressed.jump) this.jumpBuf = 0.1;
      if (g.combatAllowed) {
        if (I.pressed.attack) this.atkBuf = 0.2;
        if (I.pressed.back) this.backBuf = 0.15;
        if (I.pressed.magic) this.magicBuf = 0.15;
        if (I.pressed.run && this.cls.dash) this.dashBuf = 0.12;
        if (I.pressed.rage) this.startRage();
      }
    }
    this.updateBuffs(dt);

    switch (this.state) {
      case 'normal': this.updateNormal(dt, mx, mz); break;
      case 'attack': this.updateAttack(dt); break;
      case 'dash': this.updateDash(dt); break;
      case 'grab': this.updateGrab(dt, mx); break;
      case 'throw':
        this.vx = approach(this.vx, 0, 2000 * dt);
        if (this.t >= 0.36) this.state = 'normal';
        break;
      case 'hurt':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.t >= c.hurtStun && this.onGround) this.state = 'normal';
        break;
      case 'down':
        if (this.lying) {
          this.vx = approach(this.vx, 0, 1400 * dt);
          this.downT += dt;
          if (this.downT >= c.downTime) { this.state = 'getup'; this.t = 0; }
        }
        break;
      case 'getup':
        this.vx = 0; this.vz = 0;
        if (this.t >= c.getupTime) { this.state = 'normal'; this.invuln = Math.max(this.invuln, c.getupInvuln); }
        break;
      case 'magic':
        this.vx = 0; this.vz = 0;
        if (this.t >= MAGIC_CFG.castTime) this.state = 'normal';
        break;
    }

    // air attacks hang for a moment
    if (this.state === 'attack' && this.atk.air && this.atkPhase !== 'recovery' && this.vy > -100) this.vy -= GRAVITY * 0.5 * dt;

    // Rogue flight: hold jump in the air while the power lasts
    this.flying = false;
    if (this.power === 'flight' && this.fuel > 0 && !this.onGround && Input.isDown('jump') && this.control &&
        (this.state === 'normal' || this.state === 'attack')) {
      const F = POWER_CFG.flight;
      const elev = -(this.y + this.h);
      this.vy = approach(this.vy, elev < F.maxHeight ? -F.rise : 0, 3000 * dt) - GRAVITY * dt;
      this.fuel = Math.max(0, this.fuel - dt);
      this.flying = true;
      this.airAttacks = 0;
      if (Math.random() < 0.3) FX.particle(this.cx - this.facing * 10, this.screenY - 30, -this.facing * 40, rand(20, 60), 0.3, 2.5, false, 0, 2);
    }

    const wasGround = this.onGround;
    const fallSpeed = this.vy;
    moveActor(this, dt, minX, maxX, this.state !== 'dash');
    if (this.onGround) {
      this.airAttacks = 0;
      this.airDash = true;
      if (!wasGround) {
        this.squash = clamp(fallSpeed / 1100, 0.2, 1);
        FX.dust(this.cx, this.screenY, 6);
        if (this.state === 'down' && !this.lying) {
          this.lying = true;
          this.downT = 0;
          FX.dust(this.cx, this.screenY, 10);
          FX.shake(0.1);
          Sound.land();
        } else if (fallSpeed > 500) Sound.land();
        if (this.state === 'attack' && this.atk.air) { this.state = 'normal'; this.atk = null; this.hitActive = false; }
      }
    }

    this.runPhase += Math.hypot(this.vx, this.vz) * dt * 0.042;
    if (this.running && this.onGround && Math.random() < 0.3) FX.dust(this.cx - this.facing * 8, this.screenY, 1, -this.facing);

    if (this.hitActive) placeBox(this.hitBox, this.cx, this.bottom, this.atk.box, this.facing);
  }

  updateNormal(dt, mx, mz) {
    const c = this.stats, I = Input;
    // running: double-tap a direction, or hold run (the Rogue's run key dashes instead)
    const holdRun = (!this.cls.dash && I.isDown('run')) || I.touchRun;
    if (I.doubleTap && I.doubleTap === mx) this.running = true;
    if (holdRun && mx !== 0) this.running = true;
    if (mx === 0 || (this.running && mx !== this.runDir && this.runDir !== 0)) this.running = holdRun && mx !== 0;
    this.runDir = this.running ? mx : 0;

    const sm = this.speedMul * (this.rageT > 0 ? RAGE_CFG.speedMul : 1);
    if (this.onGround) {
      const sx = this.running ? c.runSpeed : c.walkSpeed;
      const sz = c.depthSpeed * (this.running ? 0.5 : 1);
      this.vx = approach(this.vx, mx * sx * sm, c.accel * dt);
      this.vz = approach(this.vz, mz * sz * sm, c.accel * dt);
      if (mx) this.facing = mx;
    } else if (this.flying) {
      // in flight you steer freely
      this.vx = approach(this.vx, mx * c.walkSpeed * 1.3 * sm, 1600 * dt);
      this.vz = approach(this.vz, mz * c.depthSpeed * sm, 1200 * dt);
      if (mx) this.facing = mx;
    } else {
      // jumps are committed, with a little steering
      this.vx = approach(this.vx, mx ? mx * Math.max(c.walkSpeed, Math.abs(this.vx)) : this.vx, 700 * dt);
      this.vz = approach(this.vz, mz * c.depthSpeed * 0.6, 500 * dt);
    }

    if (this.dashBuf > 0 && this.dashCd <= 0 && (this.onGround || this.airDash)) {
      this.dashBuf = 0;
      this.startDash(mx, mz);
      return;
    }
    if (this.onGround && (this.backBuf > 0 || (this.jumpBuf > 0 && this.atkBuf > 0))) {
      this.backBuf = 0; this.jumpBuf = 0; this.atkBuf = 0;
      this.beginAttack(this.cls.attacks.back);
      return;
    }
    if (this.onGround && this.magicBuf > 0) {
      this.magicBuf = 0;
      if (this.pots > 0) { this.startMagic(); return; }
    }
    if (this.jumpBuf > 0 && this.onGround) {
      this.vy = -c.jumpVel;
      if (this.running) this.vx = this.facing * c.runSpeed * c.runJumpBoost;
      this.onGround = false;
      this.jumpBuf = 0;
      this.squash = -0.8;
      FX.dust(this.cx, this.screenY, 5);
      Sound.jump();
    }
    if (this.atkBuf > 0) this.startAttack(mx);
  }

  // ------------------------------------------------ the Rogue's evasive dash
  startDash(mx, mz) {
    const d = this.cls.dash;
    let dx = mx, dz = mz;
    if (!dx && !dz) dx = this.facing;
    const len = Math.hypot(dx, dz) || 1;
    this.dashVX = dx / len * d.speed;
    this.dashVZ = dz / len * d.speed * 0.7;
    if (dx) this.facing = dx > 0 ? 1 : -1;
    this.state = 'dash';
    this.t = 0;
    this.dashCd = d.cooldown;
    this.invuln = Math.max(this.invuln, d.invuln);
    if (!this.onGround) this.airDash = false;
    this.vy = 0;
    this.running = false;
    this.atk = null;
    this.hitActive = false;
    this.ghostT = 0;
    FX.dust(this.cx, this.screenY, 5, -this.facing);
    FX.ring(this.cx, this.screenY - 25, 4, 30, 0.2, false, 2);
    Sound.dash();
  }

  updateDash(dt) {
    const d = this.cls.dash;
    this.vx = this.dashVX;
    this.vz = this.dashVZ;
    this.vy = 0;
    this.ghostT -= dt;
    if (this.ghostT <= 0) {
      this.ghostT = 0.028;
      this.computePose();
      FX.ghost(this.pose);
    }
    if (this.atkBuf > 0) {
      // attack out of the dash: the dash twin strike
      this.atkBuf = 0;
      this.beginAttack(this.cls.attacks.dash);
      return;
    }
    if (this.t >= d.time) {
      this.state = 'normal';
      this.vx *= 0.35;
      this.vz *= 0.35;
      this.strikeT = d.strikeWindow;
    }
  }

  startAttack(mx) {
    const c = this.stats;
    this.atkBuf = 0;
    const A = this.cls.attacks;
    if (!this.onGround) {
      if (this.airAttacks >= c.maxAirAttacks) return;
      this.airAttacks++;
      this.beginAttack(A.air);
      return;
    }
    if (this.running || this.strikeT > 0) { this.strikeT = 0; this.beginAttack(A.dash); return; }
    if (mx) this.facing = mx;
    const target = this.g.findGrabTarget(this);
    if (target) { this.startGrab(target); return; }
    if (this.comboT <= 0) this.combo = 0;
    const key = this.combo === 2 ? 'a3' : this.combo === 1 ? 'a2' : 'a1';
    this.beginAttack(A[key]);
  }

  beginAttack(a) {
    this.atkFrom = this.swordAngle();
    this.state = 'attack';
    this.atk = a;
    this.atkPhase = 'startup';
    this.atkT = 0;
    this.t = 0;
    this.hitActive = false;
    this.hitIdx = 0;
    this.comboT = 0;
    this.running = false;
    if (a.heavy && a.name !== 'dash') Sound.windup();
    if (a.shot) { this.takeAim(a.shot); Sound.bowDraw(); }
  }

  // One strike inside an attack: a fresh hit that can land on everyone again.
  beginHit(a, sweep, dur) {
    this.attackId++;
    this.hitActive = true;
    FX.slash(this, a, sweep, dur);
    Sound.swing(a.heavy || a.bothSides);
  }

  updateAttack(dt) {
    const a = this.atk, c = this.stats;
    this.atkT += dt;
    if (!a.air) {
      this.vx = approach(this.vx, 0, (a.name === 'dash' ? 900 : 2600) * dt);
      this.vz = approach(this.vz, 0, 2000 * dt);
    }

    if (this.atkPhase === 'startup' && this.atkT >= a.startup) {
      this.atkPhase = 'active';
      this.atkT -= a.startup;
      if (!a.air && this.onGround && a.lunge) this.vx = this.facing * a.lunge;
      if (a.iframes) this.invuln = Math.max(this.invuln, a.active + 0.06);
      if (a.wave) SwordWaves.fire(this.cx + this.facing * 40, this.facing, this.rageT > 0 ? Object.assign({}, a.wave, { dmg: a.wave.dmg * RAGE_CFG.dmgMul }) : a.wave);
      if (a.shot) {
        this.fireShot(a.shot);
      } else if (!a.hits) {
        this.beginHit(a);
        if (a.cross && a.sweep2) FX.slash(this, a, a.sweep2);
      }
      if (a.heavy) FX.shake(0.06);
    }
    if (this.atkPhase === 'active') {
      if (a.hits) {
        // twin strikes: each window is its own hit
        while (this.hitIdx < a.hits.length && this.atkT >= a.hits[this.hitIdx].at) {
          const h = a.hits[this.hitIdx];
          this.beginHit(a, this.hitIdx % 2 === 0 ? a.sweep : (a.sweep2 || a.sweep), h.dur);
          this.hitEnd = h.at + h.dur;
          this.hitIdx++;
        }
        if (this.hitActive && this.atkT >= this.hitEnd) this.hitActive = false;
      }
      if (this.atkT >= a.active) {
        this.atkPhase = 'recovery';
        this.atkT -= a.active;
        this.hitActive = false;
      }
    }
    if (this.atkPhase === 'recovery') {
      if (this.atkBuf > 0 && this.atkT >= a.chainAfter && a.next && this.onGround) {
        this.atkBuf = 0;
        const mx = this.control ? Input.axisX() : 0;
        if (mx) this.facing = mx;
        this.combo = a.comboIndex;
        const target = this.g.findGrabTarget(this);
        if (target) { this.startGrab(target); return; }
        this.beginAttack(this.cls.attacks[a.next]);
        return;
      }
      if (this.atkT >= a.recovery) {
        this.state = 'normal';
        this.atk = null;
        if (a.next) { this.combo = a.comboIndex; this.comboT = c.comboWindow; } else this.combo = 0;
      }
    }
  }

  // The Archer looses arrows straight down the lane she stands in.
  // Decided as the bow is drawn. Arrows keep to your lane; the bow only tilts
  // up when the nearest enemy in front, in your lane, is in the air.
  takeAim(s) {
    this.aimAng = s.angle || 0;
    if (s.angle) return;
    let best = 1e9, target = null;
    for (const e of this.g.enemies) {
      if (!e.active || e.untouchable || e.state === 'shadow') continue;
      const dx = (e.cx - this.cx) * this.facing;
      if (dx < 30 || dx > 520 || Math.abs(e.z - this.z) > LANE) continue;
      if (dx < best) { best = dx; target = e; }
    }
    if (!target) return;
    const rise = (target.y + target.h * 0.5) - (this.bottom - 28);
    if (rise < -20) this.aimAng = clamp(Math.atan2(rise, best), -0.95, 0);
  }

  fireShot(s) {
    const ang = this.aimAng || 0;
    const x = this.cx + this.facing * 22;
    const y = this.bottom - 28 + Math.sin(ang) * 10;
    const vx = this.facing * Math.cos(ang) * s.speed;
    const vy = Math.sin(ang) * s.speed;
    const spread = s.spread || [0];
    const spec = this.rageT > 0 ? Object.assign({}, s, { dmg: s.dmg * RAGE_CFG.dmgMul, knockdown: true }) : s;
    for (const dz of spread) Arrows.fire(x, this.z, y, vx, vy, dz * 2.2, spec);
    if (this.power === 'shower') this.arrowShower(!!s.fire);
    Sound.bow(!!s.fire);
    if (s.fire) FX.ring(x, FLOOR_Y + this.z + y, 4, 30, 0.2, false, 2);
  }

  // ------------------------------------------------ powerups and rage
  // The Archer's power: every shot also rains arrows over every lane ahead.
  arrowShower(fire) {
    const S = POWER_CFG.shower;
    const mul = this.rageT > 0 ? RAGE_CFG.dmgMul : 1;
    const spec = { speed: 0, dmg: S.dmg * mul, kb: 150, kbUp: -150, stagger: 0.3, knockdown: false, fire: fire, pierce: false, angle: 1.38 };
    for (let i = 0; i < S.arrows; i++) {
      const z = clamp((i + 0.5) * DEPTH / S.arrows + rand(-8, 8), 2, DEPTH - 2);
      const x = this.cx + this.facing * (80 + rand(0, 280));
      Arrows.fire(x - this.facing * 60, z, -(260 + rand(0, 90)), this.facing * 110, 640 + rand(0, 80), 0, spec);
    }
  }

  // Picking up a powerup.
  grantPower(kind) {
    if (kind === 'heal') {
      this.hp = Math.min(this.maxHp, this.hp + POWER_CFG.heal);
    } else if (kind === 'barrier') {
      this.barrier = POWER_CFG.barrier.hits;
      this.barrierT = POWER_CFG.barrier.time;
    } else if (kind === 'rage') {
      this.rage = RAGE_CFG.max;
    } else if (kind === 'power') {
      const k = { warrior: 'multi', archer: 'shower', rogue: 'flight' }[this.cls.key];
      this.power = k;
      if (k === 'flight') { this.fuel = POWER_CFG.flight.fuel; this.powerT = POWER_CFG.flight.expire; }
      else this.powerT = POWER_CFG[k].time;
    }
  }

  addRage(n) {
    if (this.rageT > 0 || !this.alive) return;
    this.rage = Math.min(RAGE_CFG.max, this.rage + n);
  }

  startRage() {
    if (this.rage < RAGE_CFG.max || this.rageT > 0 || !this.alive) return;
    this.rage = 0;
    this.rageT = RAGE_CFG.time;
    FX.ring(this.cx, this.screenY - 25, 10, 140, 0.5, false, 6);
    FX.burst(this.cx, this.screenY - 25, 24, 520, { streak: true, grav: 0 });
    FX.shake(0.3);
    Sound.rage();
    this.g.hitstop(0.08);
  }

  updateBuffs(dt) {
    if (this.rageT > 0) this.rageT -= dt;
    if (this.barrierT > 0) { this.barrierT -= dt; if (this.barrierT <= 0) this.barrier = 0; }
    if (this.power) {
      this.powerT -= dt;
      if (this.powerT <= 0 || (this.power === 'flight' && this.fuel <= 0 && this.onGround)) { this.power = null; this.fuel = 0; }
    }
  }

  // ------------------------------------------------ grab / knee / throw
  startGrab(e) {
    this.state = 'grab';
    this.t = 0;
    this.grabbed = e;
    this.knees = 0;
    this.kneeT = 0.15;
    this.vx = 0; this.vz = 0;
    this.running = false;
    e.grabbedBy(this);
    Sound.grab();
  }

  updateGrab(dt, mx) {
    const e = this.grabbed, G = GRAB_CFG;
    if (!e || !e.active || e.state !== 'grabbed') { this.grabbed = null; this.state = 'normal'; return; }
    this.vx = 0; this.vz = 0;
    e.x = this.cx + this.facing * 20 - e.w / 2;
    e.z = this.z;
    e.y = this.bottom - e.h;
    e.facing = -this.facing;
    this.kneeT -= dt;
    if (this.atkBuf > 0 && this.kneeT <= 0 && this.knees < G.knees) {
      this.atkBuf = 0;
      this.knees++;
      this.kneeT = 0.24;
      this.g.kneeHit(e, this);
      if (!e.active || e.state !== 'grabbed') { this.grabbed = null; this.state = 'normal'; }
      return;
    }
    if ((this.atkBuf > 0 && this.knees >= G.knees && this.kneeT <= 0) || mx === -this.facing || this.t >= G.holdTime) {
      this.atkBuf = 0;
      this.grabbed = null;
      e.throwBy(this, -this.facing);
      this.state = 'throw';
      this.t = 0;
      Sound.swing(true);
      FX.shake(0.1);
    }
  }

  // ------------------------------------------------ magic
  startMagic() {
    const level = this.pots;
    this.pots = 0;
    this.state = 'magic';
    this.t = 0;
    this.vx = 0; this.vz = 0;
    this.running = false;
    this.g.castMagic(level);
  }

  // ------------------------------------------------ drawing
  // Main weapon angle (local, facing right) for the current state.
  swordAngle() {
    const rest = this.cls.rest;
    const sword = this.cls.weapon === 'sword';
    if (this.state === 'attack' && this.atk) {
      const a = this.atk;
      if (a.shot) {
        const aim = this.aimAng || 0;
        if (this.atkPhase === 'startup') return lerp(this.atkFrom, aim, easeOutCubic(clamp(this.atkT / a.startup, 0, 1)));
        if (this.atkPhase === 'active') return aim;
        return lerp(aim, rest, easeInOutSine(clamp((this.atkT / a.recovery - 0.45) / 0.55, 0, 1)));
      }
      if (this.atkPhase === 'startup') {
        const windBack = a.heavy && a.name !== 'dash' ? a.sweep[0] - 0.25 : a.sweep[0];
        return lerp(this.atkFrom, windBack, easeOutCubic(clamp(this.atkT / a.startup, 0, 1)));
      }
      if (this.atkPhase === 'active') {
        const dur = a.hits ? a.hits[0].dur * 1.5 : a.active;
        return lerp(a.sweep[0], a.sweep[1], easeOutCubic(clamp(this.atkT / dur, 0, 1)));
      }
      const k = clamp((this.atkT / a.recovery - 0.45) / 0.55, 0, 1);
      const end = a.bothSides ? a.sweep[1] - TAU : a.sweep[1];
      return lerp(end, rest, easeInOutSine(k));
    }
    if (this.state === 'dash') return sword ? 2.85 : 2.5;
    if (this.state === 'grab') return this.kneeT > 0.12 ? -0.4 : -1.2;
    if (this.state === 'throw') return lerp(-0.3, -3.0, easeOutCubic(clamp(this.t / 0.25, 0, 1)));
    if (this.state === 'magic') return -Math.PI / 2 + Math.sin(this.t * 40) * 0.03 * (this.t < MAGIC_CFG.strikeAt ? 1 : 0);
    if (this.state === 'hurt') return -1.2;
    if (this.state === 'down' || this.state === 'getup') return 0.6;
    if (!this.onGround) return sword ? (this.vy < 0 ? -2.0 : -2.55) : (this.vy < 0 ? -0.6 : 0.4);
    if (this.running) return sword ? 2.8 : 2.4;
    const run = Math.min(1, Math.hypot(this.vx, this.vz) / this.stats.walkSpeed);
    return rest + run * 0.2 + Math.sin(this.runPhase * 2) * 0.05 * run + Math.sin(this.time * 2) * 0.03;
  }

  // The Rogue's off-hand dagger.
  swordAngle2() {
    const rest2 = this.cls.rest2 || 1.45;
    if (this.state === 'attack' && this.atk && this.atk.sweep2) {
      const a = this.atk;
      if (this.atkPhase === 'startup') return lerp(rest2, a.sweep2[0], clamp(this.atkT / a.startup, 0, 1));
      if (this.atkPhase === 'active') {
        const start = a.hits && a.hits[1] ? a.hits[1].at : 0;
        const dur = a.hits && a.hits[1] ? a.hits[1].dur * 1.5 : a.active;
        return lerp(a.sweep2[0], a.sweep2[1], easeOutCubic(clamp((this.atkT - start) / dur, 0, 1)));
      }
      const k = clamp((this.atkT / a.recovery - 0.45) / 0.55, 0, 1);
      const end = a.bothSides ? a.sweep2[1] - TAU : a.sweep2[1];
      return lerp(end, rest2, easeInOutSine(k));
    }
    if (this.state === 'grab' || this.state === 'throw' || this.state === 'magic' || this.state === 'hurt') return this.swordAngle() + 0.4;
    if (this.state === 'dash' || this.running) return 2.7;
    return rest2 + Math.sin(this.time * 2 + 1) * 0.03;
  }

  bowDraw() {
    if (this.state !== 'attack' || !this.atk || !this.atk.shot) return 0;
    if (this.atkPhase === 'startup') return clamp(this.atkT / this.atk.startup, 0, 1);
    return 0;
  }

  computePose() {
    const P = this.pose;
    P.x = this.cx; P.y = this.screenY; P.facing = this.facing; P.time = this.time;
    P.weapon = this.cls.weapon;
    P.sword = this.swordAngle();
    P.sword2 = this.cls.weapon === 'daggers' ? this.swordAngle2() : undefined;
    P.draw = this.bowDraw();
    P.fire = !!(this.atk && this.atk.shot && this.atk.shot.fire && P.draw > 0);
    const speed = Math.hypot(this.vx, this.vz);
    const run = Math.min(1, speed / this.stats.walkSpeed);
    const s = Math.sin(this.runPhase);
    if (this.state === 'dash') {
      P.legA = 0.9; P.legB = -0.7; P.lean = 0.35;
    } else if (!this.onGround && this.state !== 'down') {
      P.legA = this.vy < 0 ? 0.7 : 0.3; P.legB = this.vy < 0 ? -0.15 : -0.5; P.lean = 0.05;
    } else if (this.state === 'attack') {
      P.legA = 0.6; P.legB = -0.5;
      if (this.atk.shot) P.lean = this.atkPhase === 'startup' ? -0.08 : -0.02;
      else P.lean = this.atkPhase === 'startup' ? (this.atk.heavy ? -0.15 : -0.05) : (this.atk.name === 'dash' ? 0.35 : 0.2);
    } else if (this.state === 'grab') {
      const kneeing = this.kneeT > 0.1;
      P.legA = kneeing ? 1.6 : 0.3; P.legB = -0.3; P.lean = kneeing ? 0.15 : 0.05;
    } else if (this.state === 'throw' || this.state === 'magic') {
      P.legA = 0.5; P.legB = -0.5; P.lean = this.state === 'throw' ? -0.25 : 0;
    } else if (run > 0.08) {
      const amp = this.running ? 1.0 : 0.8;
      P.legA = s * amp; P.legB = -s * amp; P.lean = (this.running ? 0.3 : 0.12) * run;
    } else {
      P.legA = 0.2; P.legB = -0.22; P.lean = 0;
    }
    if (this.state === 'hurt') P.lean = -0.3;
    if (this.state === 'down') { P.lean = this.lying ? -1.45 : -0.8; P.legA = 0.4; P.legB = 0.1; }
    if (this.state === 'getup') { const k = clamp(this.t / this.stats.getupTime, 0, 1); P.lean = lerp(-1.45, 0, easeOutCubic(k)); P.legA = lerp(1.2, 0.2, k); P.legB = -0.2; }
    const sq = this.squash;
    P.sx = 1 + sq * 0.2;
    P.sy = 1 - sq * 0.2;
    P.cloak = Math.min(1, Math.abs(this.vx) / 360 + (this.onGround ? 0 : 0.35));
  }

  draw(ctx) {
    if (this.state === 'dead') { this.drawDeath(ctx); return; }
    this.computePose();
    const blink = (this.invuln > 0 && this.state !== 'dash' && !(this.atk && this.atk.iframes)) || this.state === 'getup';
    if (blink && this.state !== 'magic' && Math.floor(this.time * 18) % 2 === 0) ctx.globalAlpha = 0.35;
    if (this.rageT > 0) this.drawRageAura(ctx);
    this.pose.wings = this.power === 'flight' && (this.flying || !this.onGround) ? this.time : 0;
    drawFigure(ctx, this.pose, true);
    if (this.barrier > 0) this.drawBarrier(ctx);
    ctx.globalAlpha = 1;
  }

  // Jagged ink spikes around the figure while raging.
  drawRageAura(ctx) {
    const x = this.cx, y = this.screenY - 26, n = 14;
    const k = Math.min(1, this.rageT);
    ctx.save();
    ctx.globalAlpha = 0.85 * k;
    ctx.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * TAU + this.time * 1.5;
      const r = (i % 2 === 0 ? 40 : 28) + Math.sin(this.time * 30 + i * 1.7) * 4;
      ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.lineJoin = 'miter';
    finish(ctx);
    ctx.restore();
  }

  // The force field: an outlined bubble with one ring per hit it can still take.
  drawBarrier(ctx) {
    const x = this.cx, y = this.screenY - 26;
    const fade = this.barrierT < 2 && Math.floor(this.time * 10) % 2 === 0 ? 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (let i = 0; i < this.barrier; i++) {
      const r = 36 + i * 5;
      ctx.setLineDash(i === 0 ? [] : [6, 5]);
      ctx.lineDashOffset = this.time * (i % 2 ? 30 : -30);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.8, r, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // What is left behind where the hero fell.
  drawRelic(ctx, fall, Y) {
    ctx.save();
    ctx.lineJoin = 'round';
    const f = this.deathFacing;
    if (this.cls.weapon === 'bow') {
      // the bow lies on the ground, an arrow beside it
      ctx.translate(this.deathX + f * 24, Y - 3);
      ctx.scale(f, 1);
      ctx.beginPath();
      ctx.arc(0, 12, 20, -Math.PI + 0.5, -0.5);
      ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = PAPER; ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-17.5, 2.4); ctx.lineTo(17.5, 2.4);
      ctx.stroke();
      drawArrowShape(ctx, -30, 6, 6, 4, false);
    } else if (this.cls.weapon === 'daggers') {
      // two daggers driven into the ground
      for (let i = 0; i < 2; i++) {
        ctx.save();
        ctx.translate(this.deathX + f * (18 + i * 14), Y + 6);
        ctx.rotate(-Math.PI / 2 + (i ? 0.25 : -0.2) + (1 - fall) * 0.6);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(20, -3); ctx.lineTo(20, 3);
        ctx.closePath();
        finish(ctx);
        limb(ctx, 20, -6, 20, 6, 3);
        limb(ctx, 20, 0, 30, 0, 3);
        ctx.restore();
      }
    } else {
      // the sword is left planted in the ground
      ctx.translate(this.deathX + f * 26, Y + 12);
      ctx.scale(f, 1);
      ctx.rotate(-1.45 + (1 - fall) * 0.8);
      const L = PLAYER_CFG.bladeLength;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(L * 0.2, -6.5); ctx.lineTo(L, -6.5); ctx.lineTo(L, 6.5); ctx.lineTo(L * 0.2, 6);
      ctx.closePath();
      finish(ctx);
      limb(ctx, L + 12, 0, L, 0, 5);
      box(ctx, L - 2, -12, 5, 24);
    }
    ctx.restore();
  }

  drawDeath(ctx) {
    const t = this.deathT;
    const P = this.pose;
    const Y = FLOOR_Y + this.deathZ;
    const fall = easeOutCubic(clamp(t / 0.5, 0, 1));
    this.drawRelic(ctx, fall, Y);

    const alpha = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.9);
    if (alpha <= 0) return;
    P.x = this.deathX; P.y = Y; P.facing = this.deathFacing; P.time = this.time;
    P.sword = lerp(-1.2, 1.3, fall);
    P.legA = lerp(0.2, 1.4, fall); P.legB = lerp(-0.2, 0.2, fall);
    P.lean = lerp(0, 0.5, fall);
    P.sx = 1; P.sy = lerp(1, 0.72, fall);
    P.cloak = 0;
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.deathX - 200, Y - 200, 400, 200);
    ctx.clip();
    drawFigureBodyOnly(ctx, P);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
