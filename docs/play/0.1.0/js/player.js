'use strict';
// The player: a black silhouette with an enormous black sword.

const SWORD_REST = -2.35; // blade resting up-and-back over the shoulder

// Draws the humanoid + sword from a pose. Local space faces right, origin at the feet.
function drawFigure(ctx, P, eye) {
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.scale(P.facing * P.sx, P.sy);
  ctx.rotate(P.lean);
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // legs
  const hipY = -18;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(Math.sin(P.legA) * 18, hipY + Math.cos(P.legA) * 18);
  ctx.moveTo(0, hipY);
  ctx.lineTo(Math.sin(P.legB) * 18, hipY + Math.cos(P.legB) * 18);
  ctx.stroke();

  // cloak tail streaming behind
  const c = P.cloak;
  const wig = Math.sin(P.time * 13) * 3 * (0.3 + c);
  ctx.beginPath();
  ctx.moveTo(1, -39);
  ctx.lineTo(-3, -24);
  ctx.lineTo(-14 - 16 * c, -22 + 4 * c + wig);
  ctx.lineTo(-8 - 6 * c, -32 + wig * 0.4);
  ctx.closePath();
  ctx.fill();

  // torso + head
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(2, -35);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(4, -45, 8, 0, TAU);
  ctx.fill();
  if (eye) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(7, -47, 4, 2);
    ctx.fillStyle = '#000';
  }

  // arms + sword
  const a = P.sword;
  const dx = Math.cos(a), dy = Math.sin(a);
  const nx = -dy, ny = dx;
  const shx = 3, shy = -34;
  const hx = shx + dx * 15, hy = shy + dy * 15;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(shx, shy);
  ctx.lineTo(hx, hy);
  ctx.moveTo(shx - 2, shy + 1);
  ctx.lineTo(hx - dx * 5, hy - dy * 5);
  ctx.stroke();

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
  ctx.fill();
  // guard, grip, pommel
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(hx + dx * 7 + nx * 12, hy + dy * 7 + ny * 12);
  ctx.lineTo(hx + dx * 7 - nx * 12, hy + dy * 7 - ny * 12);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hx - dx * 7, hy - dy * 7);
  ctx.lineTo(hx + dx * 7, hy + dy * 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx - dx * 9, hy - dy * 9, 3.5, 0, TAU);
  ctx.fill();

  ctx.restore();
}

class Player {
  constructor(game) {
    this.g = game;
    this.hitBox = Rect();
    this.pose = { x: 0, y: 0, facing: 1, sword: SWORD_REST, legA: 0, legB: 0, lean: 0, sx: 1, sy: 1, cloak: 0, time: 0 };
    this.reset(640, 620);
  }

  reset(x, bottom) {
    const c = PLAYER_CFG;
    this.w = c.w; this.h = c.h;
    this.x = x - c.w / 2; this.y = bottom - c.h;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.hp = c.maxHp;
    this.alive = true;
    this.state = 'normal';
    this.t = 0;
    this.onGround = false; this.onPlatform = false; this.hitWall = 0; this.dropping = false;
    this.coyote = 0; this.jumpBuf = 0; this.atkBuf = 0; this.dashBuf = 0;
    this.dashCd = 0; this.dashDir = 1; this.invuln = 0;
    this.airDash = true; this.airAttacks = 0; this.pogoUsed = false;
    this.combo = 0; this.comboT = 0;
    this.atk = null; this.atkPhase = ''; this.atkT = 0; this.atkFrom = SWORD_REST;
    this.attackId = 0; this.hitActive = false;
    this.runPhase = 0; this.squash = 0; this.dropT = 0; this.ghostT = 0;
    this.deathT = 0; this.control = true; this.speedMul = 1;
    this.time = 0;
  }

  place(x, bottom) {
    this.x = x - this.w / 2; this.y = bottom - this.h;
    this.vx = 0; this.vy = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }
  get dashing() { return this.state === 'dash'; }

  // Returns true when damage was applied.
  hurt(dmg, fromX, kb, kbUp) {
    if (!this.alive || this.invuln > 0 || this.state === 'dash' || this.g.god) return false;
    const c = PLAYER_CFG;
    this.hp = Math.max(0, this.hp - dmg);
    const dir = this.cx >= fromX ? 1 : -1;
    this.vx = dir * (kb || 300);
    this.vy = kbUp === undefined ? -340 : kbUp;
    this.state = 'hurt';
    this.t = 0;
    this.atk = null;
    this.hitActive = false;
    this.combo = 0;
    this.invuln = c.hurtInvuln;
    FX.shake(0.22 + dmg / 90);
    FX.burst(this.cx, this.cy, 14, 380, { dir: dir, spread: 1.2 });
    FX.ring(this.cx, this.cy, 6, 46, 0.25, false, 4);
    Sound.hurt();
    this.g.onPlayerHurt(dmg);
    if (this.hp <= 0) this.die();
    return true;
  }

  die() {
    this.alive = false;
    this.state = 'dead';
    this.deathT = 0;
    this.deathX = this.cx;
    this.deathY = this.bottom;
    this.deathFacing = this.facing;
    this.hitActive = false;
    Sound.death();
    this.g.onPlayerDeath();
  }

  update(dt) {
    const c = PLAYER_CFG, I = Input, g = this.g;
    this.t += dt;
    this.time += dt;
    this.coyote -= dt; this.jumpBuf -= dt; this.atkBuf -= dt; this.dashBuf -= dt;
    this.dashCd -= dt; this.invuln -= dt; this.comboT -= dt; this.dropT -= dt;
    this.squash = approach(this.squash, 0, dt * 5);

    if (this.state === 'dead') {
      this.deathT += dt;
      this.vx = approach(this.vx, 0, 1600 * dt);
      this.vy = Math.min(this.vy + c.gravity * dt, c.maxFall);
      moveBody(this, dt, g.arena);
      if (this.deathT > 0.5 && this.deathT < 1.5 && Math.random() < 0.7) {
        FX.particle(this.deathX + rand(-12, 12), this.deathY - rand(0, 48), rand(-20, 20), -rand(40, 140), rand(0.6, 1.2), rand(2, 4), false, -60, 1);
      }
      return;
    }

    const mx = this.control ? I.axisX() : 0;
    if (this.control) {
      if (I.pressed.jump) this.jumpBuf = c.jumpBuffer;
      if (g.combatAllowed) {
        if (I.pressed.attack) this.atkBuf = 0.2;
        if (I.pressed.dash) this.dashBuf = 0.12;
      }
    }
    if (this.onGround) this.coyote = c.coyote;

    switch (this.state) {
      case 'normal': this.updateNormal(dt, mx); break;
      case 'attack': this.updateAttack(dt, mx); break;
      case 'dash': this.updateDash(dt); break;
      case 'hurt':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.t >= c.hurtStun) this.state = 'normal';
        break;
    }

    if (this.state !== 'dash') {
      if (I.released.jump && this.vy < 0 && this.state !== 'hurt') this.vy *= c.jumpCut;
      let gm = this.vy > 0 ? c.fallMul : 1;
      if (this.state === 'attack' && this.atk.air && this.atkPhase !== 'recovery' && this.vy > -100) gm *= 0.5;
      this.vy = Math.min(this.vy + c.gravity * gm * dt, c.maxFall);
    }

    this.dropping = this.dropT > 0;
    const wasGround = this.onGround;
    const fallSpeed = this.vy;
    moveBody(this, dt, g.arena);
    if (this.onGround) {
      this.airDash = true;
      this.airAttacks = 0;
      this.pogoUsed = false;
      if (!wasGround) {
        this.squash = clamp(fallSpeed / 1100, 0.2, 1);
        FX.dust(this.cx, this.bottom, 6);
        if (fallSpeed > 500) Sound.land();
      }
    }

    this.runPhase += Math.abs(this.vx) * dt * 0.042;

    if (this.hitActive) placeBox(this.hitBox, this.cx, this.bottom, this.atk.box, this.facing);
  }

  updateNormal(dt, mx) {
    const c = PLAYER_CFG, I = Input;
    const speed = c.runSpeed * this.speedMul;
    const accel = this.onGround ? (mx ? c.groundAccel : c.groundDecel) : (mx ? c.airAccel : c.airDecel);
    this.vx = approach(this.vx, mx * speed, accel * dt);
    if (mx) this.facing = mx;

    if (this.jumpBuf > 0 && this.onGround && this.onPlatform && I.isDown('down')) {
      this.dropT = 0.22; this.jumpBuf = 0; this.onGround = false; this.coyote = 0;
    } else if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
      this.vy = -c.jumpVel;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.squash = -0.8;
      FX.dust(this.cx, this.bottom, 5);
      Sound.jump();
    }

    if (this.dashBuf > 0 && this.dashCd <= 0 && (this.onGround || this.airDash)) this.startDash(mx);
    else if (this.atkBuf > 0) this.startAttack(mx);
  }

  startDash(mx) {
    const c = PLAYER_CFG;
    const dir = mx || this.facing;
    this.facing = dir;
    this.dashDir = dir;
    this.state = 'dash';
    this.t = 0;
    this.dashBuf = 0;
    this.dashCd = c.dashCooldown;
    this.invuln = Math.max(this.invuln, c.dashInvuln);
    this.vx = dir * c.dashSpeed;
    this.vy = 0;
    if (!this.onGround) this.airDash = false;
    this.atk = null;
    this.hitActive = false;
    this.combo = 0;
    this.ghostT = 0;
    FX.dust(this.cx, this.bottom, 5, -dir);
    FX.ring(this.cx, this.cy, 4, 30, 0.2, false, 2);
    Sound.dash();
  }

  updateDash(dt) {
    const c = PLAYER_CFG;
    this.vx = this.dashDir * c.dashSpeed;
    this.vy = 0;
    this.ghostT -= dt;
    if (this.ghostT <= 0) {
      this.ghostT = 0.028;
      this.computePose();
      FX.ghost(this.pose);
    }
    if (this.t >= c.dashTime) {
      this.state = 'normal';
      this.vx = this.dashDir * c.runSpeed;
    }
  }

  startAttack(mx) {
    const c = PLAYER_CFG;
    this.atkBuf = 0;
    if (mx) this.facing = mx;
    if (!this.onGround) {
      if (this.airAttacks >= c.maxAirAttacks) return;
      this.airAttacks++;
      this.beginAttack(PLAYER_ATTACKS.air);
      return;
    }
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
    if (a.heavy) Sound.windup();
  }

  updateAttack(dt, mx) {
    const a = this.atk, c = PLAYER_CFG;
    this.atkT += dt;
    if (a.air) {
      this.vx = approach(this.vx, mx * c.runSpeed * 0.8, c.airAccel * 0.6 * dt);
    } else {
      this.vx = approach(this.vx, 0, (this.onGround ? 2600 : 900) * dt);
    }

    if (this.atkPhase === 'startup' && this.atkT >= a.startup) {
      this.atkPhase = 'active';
      this.atkT -= a.startup;
      this.attackId++;
      this.hitActive = true;
      if (!a.air && this.onGround) this.vx = this.facing * a.lunge;
      FX.slash(this, a);
      Sound.swing(a.heavy);
      if (a.heavy) FX.shake(0.06);
    }
    if (this.atkPhase === 'active' && this.atkT >= a.active) {
      this.atkPhase = 'recovery';
      this.atkT -= a.active;
      this.hitActive = false;
    }
    if (this.atkPhase === 'recovery') {
      // chain into the next swing
      if (this.atkBuf > 0 && this.atkT >= a.chainAfter) {
        if (!a.air && a.next && this.onGround) {
          this.atkBuf = 0;
          if (mx) this.facing = mx;
          this.combo = a.comboIndex;
          this.beginAttack(PLAYER_ATTACKS[a.next]);
          return;
        }
        if (a.air && !this.onGround && this.airAttacks < c.maxAirAttacks) {
          this.startAttack(mx);
          return;
        }
      }
      // evasive cancel out of recovery (never out of startup/active)
      if (this.dashBuf > 0 && this.dashCd <= 0 && this.atkT >= a.dashCancel && (this.onGround || this.airDash)) {
        this.startDash(mx);
        return;
      }
      if (this.atkT >= a.recovery) {
        this.state = 'normal';
        this.atk = null;
        if (a.next) { this.combo = a.comboIndex; this.comboT = c.comboWindow; } else this.combo = 0;
      }
    }
  }

  // Blade angle (local, facing right) for the current state.
  swordAngle() {
    if (this.state === 'attack' && this.atk) {
      const a = this.atk;
      if (this.atkPhase === 'startup') {
        const windBack = a.heavy ? a.sweep[0] - 0.25 : a.sweep[0];
        return lerp(this.atkFrom, windBack, easeOutCubic(clamp(this.atkT / a.startup, 0, 1)));
      }
      if (this.atkPhase === 'active') return lerp(a.sweep[0], a.sweep[1], easeOutCubic(clamp(this.atkT / a.active, 0, 1)));
      const k = clamp((this.atkT / a.recovery - 0.45) / 0.55, 0, 1);
      return lerp(a.sweep[1], SWORD_REST, easeInOutSine(k));
    }
    if (this.state === 'dash') return 2.85;
    if (this.state === 'hurt') return -1.2;
    if (!this.onGround) return this.vy < 0 ? -2.0 : -2.55;
    const run = Math.min(1, Math.abs(this.vx) / PLAYER_CFG.runSpeed);
    return SWORD_REST + run * 0.25 + Math.sin(this.runPhase * 2) * 0.05 * run + Math.sin(this.time * 2) * 0.03;
  }

  computePose() {
    const P = this.pose;
    P.x = this.cx; P.y = this.bottom; P.facing = this.facing; P.time = this.time;
    P.sword = this.swordAngle();
    const run = Math.min(1, Math.abs(this.vx) / PLAYER_CFG.runSpeed);
    if (this.state === 'dash') {
      P.legA = 0.9; P.legB = -0.7; P.lean = 0.35;
    } else if (!this.onGround) {
      P.legA = this.vy < 0 ? 0.7 : 0.3; P.legB = this.vy < 0 ? -0.15 : -0.5; P.lean = 0.05;
    } else if (this.state === 'attack') {
      P.legA = 0.6; P.legB = -0.5;
      P.lean = this.atkPhase === 'startup' ? (this.atk.heavy ? -0.15 : -0.05) : 0.2;
    } else if (run > 0.08) {
      const s = Math.sin(this.runPhase);
      P.legA = s * 0.8; P.legB = -s * 0.8; P.lean = 0.14 * run;
    } else {
      P.legA = 0.2; P.legB = -0.22; P.lean = 0;
    }
    if (this.state === 'hurt') P.lean = -0.3;
    const sq = this.squash;
    P.sx = 1 + sq * 0.2;
    P.sy = 1 - sq * 0.2;
    P.cloak = Math.min(1, Math.abs(this.vx) / 420 + (this.onGround ? 0 : 0.35));
  }

  draw(ctx) {
    if (this.state === 'dead') { this.drawDeath(ctx); return; }
    this.computePose();
    // flicker while in post-hit invulnerability (not while dashing)
    if (this.invuln > 0 && this.state !== 'dash' && Math.floor(this.time * 18) % 2 === 0) ctx.globalAlpha = 0.35;
    drawFigure(ctx, this.pose, true);
    ctx.globalAlpha = 1;
  }

  drawDeath(ctx) {
    const t = this.deathT;
    const P = this.pose;
    const fall = easeOutCubic(clamp(t / 0.5, 0, 1));
    // the sword is left planted in the ground
    const swordLean = 1.45;
    ctx.save();
    ctx.translate(this.deathX + this.deathFacing * 26, this.deathY + 16);
    ctx.scale(this.deathFacing, 1);
    ctx.rotate(-Math.PI / 2 + (Math.PI / 2 - swordLean) + (1 - fall) * 0.8);
    ctx.fillStyle = '#000';
    const L = PLAYER_CFG.bladeLength;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(L * 0.2, -6.5); ctx.lineTo(L, -6.5); ctx.lineTo(L, 6.5); ctx.lineTo(L * 0.2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(L - 2, -12, 5, 24);
    ctx.fillRect(L, -2, 14, 4);
    ctx.restore();

    const alpha = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.9);
    if (alpha <= 0) return;
    P.x = this.deathX; P.y = this.deathY; P.facing = this.deathFacing; P.time = this.time;
    P.sword = lerp(-1.2, 1.3, fall);
    P.legA = lerp(0.2, 1.4, fall); P.legB = lerp(-0.2, 0.2, fall);
    P.lean = lerp(0, 0.5, fall);
    P.sx = 1; P.sy = lerp(1, 0.72, fall);
    P.cloak = 0;
    ctx.globalAlpha = alpha;
    // draw kneeling body without the sword (it is planted separately)
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.deathX - 200, this.deathY - 200, 400, 200);
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
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, -18); ctx.lineTo(Math.sin(P.legA) * 18, -18 + Math.cos(P.legA) * 18);
  ctx.moveTo(0, -18); ctx.lineTo(Math.sin(P.legB) * 18, -18 + Math.cos(P.legB) * 18);
  ctx.stroke();
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(2, -35); ctx.stroke();
  ctx.beginPath(); ctx.arc(6, -43, 8, 0, TAU); ctx.fill();
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(3, -34); ctx.lineTo(16, -20); ctx.stroke();
  ctx.restore();
}
