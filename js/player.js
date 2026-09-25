'use strict';
// The player: an outlined figure carrying an enormous outlined sword.

const SWORD_REST = -2.35; // blade resting up-and-back over the shoulder

// Draws the humanoid + sword from a pose. Local space faces right, origin at the feet.
function drawFigure(ctx, P, showEye) {
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.scale(P.facing * P.sx, P.sy);
  ctx.rotate(P.lean);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // legs
  const hipY = -18;
  limb(ctx, 0, hipY, Math.sin(P.legB) * 18, hipY + Math.cos(P.legB) * 18, 6);
  limb(ctx, 0, hipY, Math.sin(P.legA) * 18, hipY + Math.cos(P.legA) * 18, 6);

  // cloak tail streaming behind
  const c = P.cloak;
  const wig = Math.sin(P.time * 13) * 3 * (0.3 + c);
  ctx.beginPath();
  ctx.moveTo(1, -39);
  ctx.lineTo(-3, -24);
  ctx.lineTo(-14 - 16 * c, -22 + 4 * c + wig);
  ctx.lineTo(-8 - 6 * c, -32 + wig * 0.4);
  ctx.closePath();
  finish(ctx);

  // torso + head
  limb(ctx, 0, hipY, 2, -35, 12);
  ctx.beginPath();
  ctx.arc(4, -45, 8, 0, TAU);
  finish(ctx);
  if (showEye) eye(ctx, 7, -47, 4, 2);

  // arms + sword
  const a = P.sword;
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

  ctx.restore();
}

class Player {
  constructor(game) {
    this.g = game;
    this.hitBox = Rect();
    this.pose = { x: 0, y: 0, facing: 1, sword: SWORD_REST, legA: 0, legB: 0, lean: 0, sx: 1, sy: 1, cloak: 0, time: 0 };
    this.reset(200, DEPTH / 2);
  }

  reset(x, z) {
    const c = PLAYER_CFG;
    this.w = c.w; this.h = c.h;
    this.x = x - c.w / 2; this.y = -c.h; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.facing = 1;
    this.hp = c.maxHp;
    this.lives = c.lives;
    this.pots = c.startPots;
    this.alive = true;
    this.state = 'normal';
    this.t = 0;
    this.onGround = true; this.hitWall = 0;
    this.jumpBuf = 0; this.atkBuf = 0; this.backBuf = 0; this.magicBuf = 0;
    this.invuln = 0;
    this.running = false; this.runDir = 0;
    this.airAttacks = 0;
    this.combo = 0; this.comboT = 0;
    this.atk = null; this.atkPhase = ''; this.atkT = 0; this.atkFrom = SWORD_REST;
    this.attackId = 0; this.hitActive = false;
    this.grabbed = null; this.knees = 0; this.kneeT = 0;
    this.hitCount = 0; this.hitCountT = 0;
    this.lying = false; this.downT = 0;
    this.runPhase = 0; this.squash = 0; this.ghostT = 0;
    this.deathT = 0; this.reported = false;
    this.control = true; this.speedMul = 1;
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
    return this.invuln > 0 || s === 'down' || s === 'getup' || s === 'magic' || s === 'throw' || s === 'dead';
  }

  // Returns true when damage was applied.
  hurt(dmg, fromX, kb, kbUp, knockdown) {
    if (!this.alive || this.invulnerable || this.g.god) return false;
    this.releaseGrab();
    this.hp = Math.max(0, this.hp - dmg);
    const dir = this.cx >= fromX ? 1 : -1;
    this.atk = null;
    this.hitActive = false;
    this.combo = 0;
    this.running = false;
    this.hitCount++;
    this.hitCountT = 1.2;
    FX.shake(0.2 + dmg / 90);
    FX.burst(this.cx, this.screenY - 25, 14, 380, { dir: dir, spread: 1.2 });
    FX.ring(this.cx, this.screenY - 25, 6, 46, 0.25, false, 4);
    Sound.hurt();
    this.g.onPlayerHurt(dmg);
    if (this.hp <= 0) { this.die(dir); return true; }
    if (knockdown || this.hitCount >= 3) {
      this.knockDown(dir, kb || 300);
    } else {
      this.state = 'hurt';
      this.t = 0;
      this.vx = dir * (kb || 300) * 0.6;
      this.vz = 0;
      if (!this.onGround) this.vy = kbUp === undefined ? -250 : kbUp * 0.6;
      this.invuln = PLAYER_CFG.hurtInvuln;
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
    this.hp = PLAYER_CFG.maxHp;
    this.place(this.deathX, this.deathZ);
    this.state = 'getup';
    this.t = 0;
    this.invuln = 2.2;
    this.hitCount = 0;
  }

  update(dt) {
    const c = PLAYER_CFG, I = Input, g = this.g;
    this.t += dt;
    this.time += dt;
    this.jumpBuf -= dt; this.atkBuf -= dt; this.backBuf -= dt; this.magicBuf -= dt;
    this.invuln -= dt; this.comboT -= dt; this.hitCountT -= dt;
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
      }
    }

    switch (this.state) {
      case 'normal': this.updateNormal(dt, mx, mz); break;
      case 'attack': this.updateAttack(dt); break;
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

    // air slashes hang for a moment
    if (this.state === 'attack' && this.atk.air && this.atkPhase !== 'recovery' && this.vy > -100) this.vy -= GRAVITY * 0.5 * dt;

    const wasGround = this.onGround;
    const fallSpeed = this.vy;
    moveActor(this, dt, minX, maxX, true);
    if (this.onGround) {
      this.airAttacks = 0;
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
    const c = PLAYER_CFG, I = Input;
    // running: double-tap a direction, or hold run
    if (I.doubleTap && I.doubleTap === mx) this.running = true;
    if (I.isDown('run') && mx !== 0) this.running = true;
    if (mx === 0 || (this.running && mx !== this.runDir && this.runDir !== 0)) this.running = I.isDown('run') && mx !== 0;
    this.runDir = this.running ? mx : 0;

    if (this.onGround) {
      const sx = this.running ? c.runSpeed : c.walkSpeed;
      const sz = c.depthSpeed * (this.running ? 0.5 : 1);
      this.vx = approach(this.vx, mx * sx * this.speedMul, c.accel * dt);
      this.vz = approach(this.vz, mz * sz * this.speedMul, c.accel * dt);
      if (mx) this.facing = mx;
    } else {
      // jumps are committed, with a little steering
      this.vx = approach(this.vx, mx ? mx * Math.max(c.walkSpeed, Math.abs(this.vx)) : this.vx, 700 * dt);
      this.vz = approach(this.vz, mz * c.depthSpeed * 0.6, 500 * dt);
    }

    if (this.onGround && (this.backBuf > 0 || (this.jumpBuf > 0 && this.atkBuf > 0))) {
      this.backBuf = 0; this.jumpBuf = 0; this.atkBuf = 0;
      this.beginAttack(PLAYER_ATTACKS.back);
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

  startAttack(mx) {
    const c = PLAYER_CFG;
    this.atkBuf = 0;
    if (!this.onGround) {
      if (this.airAttacks >= c.maxAirAttacks) return;
      this.airAttacks++;
      this.beginAttack(PLAYER_ATTACKS.air);
      return;
    }
    if (this.running) { this.beginAttack(PLAYER_ATTACKS.dash); return; }
    if (mx) this.facing = mx;
    const target = this.g.findGrabTarget(this);
    if (target) { this.startGrab(target); return; }
    if (this.comboT <= 0) this.combo = 0;
    const key = this.combo === 2 ? 'a3' : this.combo === 1 ? 'a2' : 'a1';
    this.beginAttack(PLAYER_ATTACKS[key]);
  }

  beginAttack(a) {
    this.atkFrom = this.swordAngle();
    this.state = 'attack';
    this.atk = a;
    this.atkPhase = 'startup';
    this.atkT = 0;
    this.t = 0;
    this.hitActive = false;
    this.comboT = 0;
    this.running = false;
    if (a.heavy && a.name !== 'dash') Sound.windup();
  }

  updateAttack(dt) {
    const a = this.atk, c = PLAYER_CFG;
    this.atkT += dt;
    if (!a.air) {
      this.vx = approach(this.vx, 0, (a.name === 'dash' ? 900 : 2600) * dt);
      this.vz = approach(this.vz, 0, 2000 * dt);
    }

    if (this.atkPhase === 'startup' && this.atkT >= a.startup) {
      this.atkPhase = 'active';
      this.atkT -= a.startup;
      this.attackId++;
      this.hitActive = true;
      if (!a.air && this.onGround && a.lunge) this.vx = this.facing * a.lunge;
      FX.slash(this, a);
      Sound.swing(a.heavy || a.bothSides);
      if (a.heavy) FX.shake(0.06);
    }
    if (this.atkPhase === 'active' && this.atkT >= a.active) {
      this.atkPhase = 'recovery';
      this.atkT -= a.active;
      this.hitActive = false;
    }
    if (this.atkPhase === 'recovery') {
      if (this.atkBuf > 0 && this.atkT >= a.chainAfter && a.next && this.onGround) {
        this.atkBuf = 0;
        const mx = this.control ? Input.axisX() : 0;
        if (mx) this.facing = mx;
        this.combo = a.comboIndex;
        const target = this.g.findGrabTarget(this);
        if (target) { this.startGrab(target); return; }
        this.beginAttack(PLAYER_ATTACKS[a.next]);
        return;
      }
      if (this.atkT >= a.recovery) {
        this.state = 'normal';
        this.atk = null;
        if (a.next) { this.combo = a.comboIndex; this.comboT = c.comboWindow; } else this.combo = 0;
      }
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
    e.y = -e.h;
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
  // Blade angle (local, facing right) for the current state.
  swordAngle() {
    if (this.state === 'attack' && this.atk) {
      const a = this.atk;
      if (this.atkPhase === 'startup') {
        const windBack = a.heavy && a.name !== 'dash' ? a.sweep[0] - 0.25 : a.sweep[0];
        return lerp(this.atkFrom, windBack, easeOutCubic(clamp(this.atkT / a.startup, 0, 1)));
      }
      if (this.atkPhase === 'active') return lerp(a.sweep[0], a.sweep[1], easeOutCubic(clamp(this.atkT / a.active, 0, 1)));
      const k = clamp((this.atkT / a.recovery - 0.45) / 0.55, 0, 1);
      const end = a.bothSides ? a.sweep[1] - TAU : a.sweep[1];
      return lerp(end, SWORD_REST, easeInOutSine(k));
    }
    if (this.state === 'grab') return this.kneeT > 0.12 ? -0.4 : -1.2;
    if (this.state === 'throw') return lerp(-0.3, -3.0, easeOutCubic(clamp(this.t / 0.25, 0, 1)));
    if (this.state === 'magic') return -Math.PI / 2 + Math.sin(this.t * 40) * 0.03 * (this.t < MAGIC_CFG.strikeAt ? 1 : 0);
    if (this.state === 'hurt') return -1.2;
    if (this.state === 'down' || this.state === 'getup') return 0.6;
    if (!this.onGround) return this.vy < 0 ? -2.0 : -2.55;
    if (this.running) return 2.8;
    const run = Math.min(1, Math.hypot(this.vx, this.vz) / PLAYER_CFG.walkSpeed);
    return SWORD_REST + run * 0.2 + Math.sin(this.runPhase * 2) * 0.05 * run + Math.sin(this.time * 2) * 0.03;
  }

  computePose() {
    const P = this.pose;
    P.x = this.cx; P.y = this.screenY; P.facing = this.facing; P.time = this.time;
    P.sword = this.swordAngle();
    const speed = Math.hypot(this.vx, this.vz);
    const run = Math.min(1, speed / PLAYER_CFG.walkSpeed);
    const s = Math.sin(this.runPhase);
    if (!this.onGround && this.state !== 'down') {
      P.legA = this.vy < 0 ? 0.7 : 0.3; P.legB = this.vy < 0 ? -0.15 : -0.5; P.lean = 0.05;
    } else if (this.state === 'attack') {
      P.legA = 0.6; P.legB = -0.5;
      P.lean = this.atkPhase === 'startup' ? (this.atk.heavy ? -0.15 : -0.05) : (this.atk.name === 'dash' ? 0.35 : 0.2);
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
    if (this.state === 'getup') { const k = clamp(this.t / PLAYER_CFG.getupTime, 0, 1); P.lean = lerp(-1.45, 0, easeOutCubic(k)); P.legA = lerp(1.2, 0.2, k); P.legB = -0.2; }
    const sq = this.squash;
    P.sx = 1 + sq * 0.2;
    P.sy = 1 - sq * 0.2;
    P.cloak = Math.min(1, Math.abs(this.vx) / 360 + (this.onGround ? 0 : 0.35));
  }

  draw(ctx) {
    if (this.state === 'dead') { this.drawDeath(ctx); return; }
    this.computePose();
    const blink = this.invuln > 0 || this.state === 'getup';
    if (blink && this.state !== 'magic' && Math.floor(this.time * 18) % 2 === 0) ctx.globalAlpha = 0.35;
    drawFigure(ctx, this.pose, true);
    ctx.globalAlpha = 1;
  }

  drawDeath(ctx) {
    const t = this.deathT;
    const P = this.pose;
    const Y = FLOOR_Y + this.deathZ;
    const fall = easeOutCubic(clamp(t / 0.5, 0, 1));
    // the sword is left planted in the ground
    ctx.save();
    ctx.translate(this.deathX + this.deathFacing * 26, Y + 12);
    ctx.scale(this.deathFacing, 1);
    ctx.rotate(-1.45 + (1 - fall) * 0.8);
    const L = PLAYER_CFG.bladeLength;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(L * 0.2, -6.5); ctx.lineTo(L, -6.5); ctx.lineTo(L, 6.5); ctx.lineTo(L * 0.2, 6);
    ctx.closePath();
    finish(ctx);
    limb(ctx, L + 12, 0, L, 0, 5);
    box(ctx, L - 2, -12, 5, 24);
    ctx.restore();

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
