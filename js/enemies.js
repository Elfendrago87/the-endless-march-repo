'use strict';
// Enemy archetypes on the belt-scroller floor. Each has a readable
// windup -> active -> recovery cycle. Enemies take turns: only a few may hold
// an attack "token" at once; the rest circle at a distance, waiting.

const DOWN_TIME = 0.7, GETUP_TIME = 0.35, CORPSE_TIME = 0.8;

class Enemy {
  constructor() {
    this.active = false;
    this.atkBox = Rect();
    this.aim = { x: 0, z: 0, b: 0 };
  }

  reset(type, x, z, opts) {
    const c = ENEMY_TYPES[type];
    opts = opts || {};
    this.type = type; this.c = c; this.behavior = c.behavior;
    this.w = c.w; this.h = c.h;
    this.x = x - c.w / 2; this.z = clamp(z, 0, DEPTH);
    this.y = c.behavior === 'flyer' ? -c.h - c.hover : -c.h;
    this.vx = opts.vx || 0; this.vy = opts.vy || 0; this.vz = 0;
    if (opts.vy) this.y -= 1;
    this.onGround = this.behavior !== 'flyer'; this.hitWall = 0;
    this.hp = this.maxHp = c.hp;
    this.facing = opts.facing || 1;
    this.t = 0;
    this.spawnDur = opts.spawnDur || SPAWN_TIME;
    this.enterDir = opts.enter || 0;
    this.state = this.enterDir ? 'enter' : 'spawn';
    this.flashT = 0; this.staggerT = 0; this.poiseCd = 0;
    this.lastHitId = -1; this.lastThrowId = -1;
    this.atkActive = false; this.atkHit = false; this.atkDef = null;
    this.atkDmg = 0; this.atkKb = 0; this.atkKbUp = 0; this.atkKnock = false; this.atkDepth = DEPTH_TOL;
    this.cd = rand(0.4, 1.0); this.turnT = 0;
    this.alpha = this.enterDir ? 1 : 0; this.shieldUp = c.behavior === 'shield';
    this.anim = rand(0, 10); this.bob = rand(0, TAU);
    this.move = null; this.windDur = 0; this.recDur = 0;
    this.stalkDur = rand(1.0, 1.6); this.trailT = 0;
    this.hasToken = false; this.dying = false;
    this.ringOff = rand(0, 70); this.zOff = rand(-60, 60); this.rerollT = rand(1.5, 3);
    this.thrownBy = null; this.fleeing = false;
    this.burnT = 0; this.burnTick = 0; this.lastArrowId = -1; this.lastWaveId = -1;
    this.jumpCd = rand(0.5, 1.5); this.hpShowT = 0; this.plat = null;
    this.active = true;
    return this;
  }

  get cx() { return this.x + this.w / 2; }
  get bottom() { return this.y + this.h; }
  get screenY() { return FLOOR_Y + this.z + this.y + this.h; }

  setState(s) {
    this.state = s;
    this.t = 0;
    this.atkActive = false;
    this.atkHit = false;
  }

  releaseToken() { this.hasToken = false; }

  beginAttack(dmg, kb, kbUp, box, knockdown, depth) {
    this.atkActive = true;
    this.atkHit = false;
    this.atkDmg = dmg; this.atkKb = kb; this.atkKbUp = kbUp;
    this.atkDef = box; this.atkKnock = !!knockdown; this.atkDepth = depth || DEPTH_TOL;
  }

  // States in which the sword passes through (already on the floor, etc.)
  get untouchable() {
    const s = this.state;
    return this.dying || s === 'spawn' || s === 'launched' || s === 'down' || s === 'getup' ||
      s === 'dead' || s === 'grabbed' || s === 'thrown';
  }

  // Walking in, enemies may be off-screen; once in the fight they stay on it.
  physics(dt, g, gravity) {
    // flyers only touch platforms when they come down to rest
    const noPlat = this.behavior === 'flyer' && this.state !== 'recover';
    if (this.state === 'enter') moveActor(this, dt, g.enemyMinX, g.enemyMaxX, gravity, noPlat);
    else moveActor(this, dt, g.fightMinX, g.fightMaxX, gravity, noPlat);
  }

  // Ground fighters jump up after a player standing on a platform.
  climb(p, adx, dz) {
    if (this.c.big || this.behavior === 'shield' || !this.onGround || this.jumpCd > 0) return;
    const above = -(p.y + p.h) - -(this.y + this.h);
    if (above > 25 && above < 130 && adx < 120 && Math.abs(dz) < 30) {
      this.vy = -Math.sqrt(2 * GRAVITY * (above + 30));
      this.jumpCd = 1.6;
      this.onGround = false;
    }
  }
  friction(dt, amt) {
    this.vx = approach(this.vx, 0, (amt || 1800) * dt);
    this.vz = approach(this.vz, 0, (amt || 1800) * dt);
  }
  faceToward(dx) { if (dx !== 0) this.facing = dx > 0 ? 1 : -1; }

  // Walk toward a floor point.
  steer(tx, tz, speedMul, dt) {
    const c = this.c;
    const dx = tx - this.cx, dz = tz - this.z;
    const wx = Math.abs(dx) > 6 ? sign(dx) * c.speed * speedMul * Math.min(1, Math.abs(dx) / 40) : 0;
    const wz = Math.abs(dz) > 3 ? sign(dz) * c.depthSpeed * speedMul * Math.min(1, Math.abs(dz) / 20) : 0;
    const acc = (c.accel || 1000) * dt;
    this.vx = approach(this.vx, wx, acc);
    this.vz = approach(this.vz, wz, acc);
  }

  // While waiting for a turn, hold a loose ring around the player.
  circle(p, dt) {
    const side = this.cx < p.cx ? -1 : 1;
    this.steer(p.cx + side * (150 + this.ringOff), clamp(p.z + this.zOff, 0, DEPTH), 0.6, dt);
    this.faceToward(p.cx - this.cx);
  }

  wantToken(g) {
    if (!this.hasToken && this.cd <= 0 && g.requestToken(this)) this.hasToken = true;
    return this.hasToken;
  }

  defaultState() {
    switch (this.behavior) {
      case 'flyer': return 'rise';
      case 'assassin': return 'stalk';
      case 'thief': return 'run';
      default: return 'approach';
    }
  }

  update(dt, g) {
    const p = g.player;
    this.t += dt; this.anim += dt;
    // safety net: never let a broken position soft-lock a wave
    if (!isFinite(this.x) || !isFinite(this.z) || !isFinite(this.y)) {
      this.x = g.cam.x + g.viewW / 2; this.z = DEPTH / 2; this.y = -this.h;
      this.vx = 0; this.vz = 0; this.vy = 0;
    }
    if (this.flashT > 0) this.flashT -= dt;
    this.cd -= dt; this.poiseCd -= dt; this.jumpCd -= dt; this.hpShowT -= dt;
    this.rerollT -= dt;
    if (this.rerollT <= 0) { this.rerollT = rand(1.5, 3); this.zOff = rand(-60, 60); this.ringOff = rand(0, 70); }

    switch (this.state) {
      case 'spawn':
        this.alpha = Math.min(1, this.t / this.spawnDur);
        this.physics(dt, g, this.behavior !== 'flyer');
        if (this.t >= this.spawnDur) {
          this.alpha = 1;
          this.setState(this.behavior === 'flyer' ? 'hover' : this.behavior === 'assassin' ? 'stalk' : this.behavior === 'thief' ? 'run' : 'idle');
        }
        return;
      case 'enter': {
        // walk in from beyond the screen edge
        this.facing = this.enterDir;
        this.vx = this.enterDir * this.c.speed;
        this.vz = 0;
        this.physics(dt, g, true);
        const inside = this.x > g.cam.x + 20 && this.x + this.w < g.cam.x + g.viewW - 20;
        if (inside || this.t > 4) this.setState(this.behavior === 'thief' ? 'run' : this.behavior === 'assassin' ? 'stalk' : 'idle');
        return;
      }
      case 'grabbed':
        return; // the player holds us in place
      case 'thrown':
        this.anim += dt * 10;
        this.physics(dt, g, true);
        if (this.onGround && this.t > 0.08) g.onThrownLanded(this);
        return;
      case 'launched':
        this.physics(dt, g, true);
        if (this.onGround && this.t > 0.05) {
          FX.dust(this.cx, this.screenY, 8);
          this.vx *= 0.3;
          this.setState(this.dying ? 'dead' : 'down');
        }
        return;
      case 'down':
        this.friction(dt, 1400);
        this.physics(dt, g, true);
        if (this.t >= DOWN_TIME) this.setState('getup');
        return;
      case 'getup':
        this.physics(dt, g, true);
        if (this.t >= GETUP_TIME) this.setState(this.defaultState());
        return;
      case 'dead':
        this.friction(dt, 1400);
        this.physics(dt, g, true);
        if (this.t >= CORPSE_TIME) {
          this.active = false;
          FX.burst(this.cx, this.screenY - this.h * 0.3, this.c.big ? 24 : 12, 160, { grav: -60, life: 1.4 });
        }
        return;
    }

    if (this.behavior === 'thief') { this.actThief(dt, g); return; }

    // Once the player falls or the fighting ends, enemies stand still.
    if (!p.alive || !g.combatAllowed) {
      this.atkActive = false;
      this.releaseToken();
      this.alpha = approach(this.alpha, 1, dt * 2);
      this.friction(dt, 1200);
      this.physics(dt, g, this.behavior !== 'flyer' || this.state === 'recover');
      return;
    }

    if (this.state === 'stagger') {
      this.atkActive = false;
      this.staggerT -= dt;
      this.friction(dt, 1400);
      const floating = this.behavior === 'flyer' && !this.onGround;
      if (floating) this.vy = approach(this.vy, 0, 1400 * dt);
      this.physics(dt, g, !floating);
      if (this.staggerT <= 0) this.setState(this.defaultState());
      return;
    }

    switch (this.behavior) {
      case 'melee': this.actMelee(dt, g); break;
      case 'lunge': this.actLunge(dt, g); break;
      case 'heavy': this.actMelee(dt, g); break;
      case 'ranged': this.actRanged(dt, g); break;
      case 'flyer': this.actFlyer(dt, g); break;
      case 'shield': this.actShield(dt, g); break;
      case 'assassin': this.actAssassin(dt, g); break;
      case 'elite': this.actElite(dt, g); break;
    }

    if (this.atkActive) {
      placeBox(this.atkBox, this.cx, this.bottom, this.atkDef, this.facing);
      if (!this.atkHit && p.alive && hitsActor(this.atkBox, this.atkDepth, this.z, p)) {
        if (p.hurt(this.atkDmg, this.cx, this.atkKb, this.atkKbUp, this.atkKnock)) this.atkHit = true;
      }
    }
  }

  // ---------------------------------------------------------------- SEEKER / SPLITTER / BRUTE
  actMelee(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dz = p.z - this.z;
    switch (this.state) {
      case 'idle':
        this.friction(dt);
        if (this.t > 0.25) this.setState('approach');
        break;
      case 'approach':
        this.climb(p, adx, dz);
        if (this.wantToken(g)) {
          const side = this.cx < p.cx ? -1 : 1;
          this.steer(p.cx + side * c.range * 0.7, p.z, 1, dt);
          this.faceToward(dx);
          if (adx <= c.range && Math.abs(dz) <= 8) {
            this.setState('windup');
            if (c.big) Sound.windup();
          }
        } else this.circle(p, dt);
        break;
      case 'windup':
        this.friction(dt, 2400);
        if (this.t >= c.windup) {
          this.setState('attack');
          this.vx = this.facing * (c.step || 0);
          this.beginAttack(c.dmg, c.kb, c.knockdown ? -440 : -200, c.box, c.knockdown, c.depth);
          if (c.big) {
            const fx = this.cx + this.facing * 70;
            FX.shake(0.4);
            FX.dust(fx, FLOOR_Y + this.z, 16);
            FX.ring(fx, FLOOR_Y + this.z, 10, 110, 0.35, false, 5);
            Sound.slam();
          }
        }
        break;
      case 'attack':
        this.friction(dt, 1400);
        if (this.t >= c.active) this.setState('recover');
        break;
      case 'recover':
        this.friction(dt);
        if (this.t >= c.recovery) {
          this.cd = c.cooldown * rand(0.8, 1.3);
          this.releaseToken();
          this.setState('approach');
        }
        break;
    }
    this.physics(dt, g, true);
  }

  // ---------------------------------------------------------------- CHASER
  actLunge(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dz = p.z - this.z;
    switch (this.state) {
      case 'idle':
        if (this.t > 0.15) this.setState('approach');
        break;
      case 'approach':
        this.climb(p, adx, dz);
        if (this.wantToken(g)) {
          const side = this.cx < p.cx ? -1 : 1;
          this.steer(p.cx + side * 160, p.z, 1, dt);
          this.faceToward(dx);
          if (adx < c.lungeRange && adx > 50 && Math.abs(dz) <= 8) this.setState('windup');
        } else this.circle(p, dt);
        break;
      case 'windup':
        this.friction(dt, 3000);
        if (this.t >= c.windup) {
          this.setState('attack');
          this.vx = this.facing * c.lungeSpeed;
          this.vy = -200;
          this.beginAttack(c.dmg, c.kb, -260, c.box, false, 18);
          FX.dust(this.cx, FLOOR_Y + this.z, 4, -this.facing);
        }
        break;
      case 'attack':
        this.vx = this.facing * c.lungeSpeed;
        this.vz = 0;
        if (this.t >= c.lungeTime || this.hitWall) this.setState('recover');
        break;
      case 'recover':
        this.friction(dt, this.onGround ? 1600 : 400);
        if (this.t >= c.recovery) {
          this.cd = c.cooldown * rand(0.8, 1.4);
          this.releaseToken();
          this.setState('approach');
        }
        break;
    }
    this.physics(dt, g, true);
  }

  // ---------------------------------------------------------------- RANGED (axe thrower)
  actRanged(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dz = p.z - this.z;
    const dir = dx >= 0 ? 1 : -1;
    switch (this.state) {
      case 'idle':
      case 'approach': {
        this.facing = dir;
        // hold range along the lane; line up in depth only when ready to throw
        let tx = this.cx;
        if (adx < c.keepMin) tx = p.cx - dir * c.keepMin * 1.1;
        else if (adx > c.keepMax) tx = p.cx - dir * c.keepMax * 0.9;
        const ready = this.wantToken(g);
        const tz = ready ? p.z : clamp(p.z + this.zOff * 1.4, 0, DEPTH);
        this.steer(tx, tz, adx < c.keepMin ? 1.2 : 1, dt);
        if (ready && Math.abs(dz) <= 10 && adx < 620) this.setState('windup');
        break;
      }
      case 'windup':
        this.facing = dir;
        this.friction(dt, 2000);
        if (this.t >= c.windup) {
          Projectiles.fire(this.cx + this.facing * 16, this.z, this.bottom - 27, this.facing * c.projSpeed, 0, c.dmg, c.kb, 7, true);
          this.vx = -this.facing * 90;
          Sound.shoot();
          this.setState('recover');
        }
        break;
      case 'recover':
        this.friction(dt, 800);
        if (this.t >= c.recovery) {
          this.cd = c.cooldown * rand(0.85, 1.25);
          this.releaseToken();
          this.setState('approach');
        }
        break;
    }
    this.physics(dt, g, true);
  }

  // ---------------------------------------------------------------- FLYER
  actFlyer(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, dz = p.z - this.z;
    const hoverY = -this.h - c.hover;
    switch (this.state) {
      case 'hover': {
        const side = this.cx < p.cx ? -1 : 1;
        const ready = this.wantToken(g);
        const tx = p.cx + (ready ? 0 : side * (120 + this.ringOff)) + Math.sin(this.anim * 1.1 + this.bob) * 50;
        this.steer(tx, ready ? p.z : clamp(p.z + this.zOff, 0, DEPTH), 1, dt);
        this.vy = approach(this.vy, clamp((hoverY + Math.sin(this.anim * 2.3) * 10 - this.y) * 3, -150, 150), 600 * dt);
        this.faceToward(dx);
        this.physics(dt, g, false);
        if (ready && Math.abs(dx) < 70 && Math.abs(dz) < 14 && this.t > 0.6) this.setState('windup');
        break;
      }
      case 'windup':
        this.friction(dt, 1200);
        this.vy = approach(this.vy, -40, 800 * dt);
        this.physics(dt, g, false);
        this.aim.x = p.cx; this.aim.z = p.z; this.aim.b = p.bottom;
        if (this.t >= c.windup) {
          const ax = this.aim.x - this.cx, az = this.aim.z - this.z, ay = this.aim.b - this.bottom;
          const len = Math.hypot(ax, az, ay) || 1;
          this.setState('dive');
          this.vx = ax / len * c.diveSpeed;
          this.vz = az / len * c.diveSpeed;
          this.vy = ay / len * c.diveSpeed;
          this.faceToward(this.vx);
          this.beginAttack(c.dmg, c.kb, -300, c.box, true, c.depth);
        }
        break;
      case 'dive':
        this.physics(dt, g, false);
        if (this.onGround || this.t >= c.diveTime) {
          if (this.onGround) { FX.dust(this.cx, FLOOR_Y + this.z, 10); FX.shake(0.08); }
          this.setState('recover');
          this.vx = 0; this.vz = 0;
        }
        break;
      case 'recover':
        this.friction(dt, 1200);
        this.physics(dt, g, true);
        if (this.t >= c.recovery) { this.releaseToken(); this.setState('rise'); }
        break;
      case 'rise':
        this.friction(dt, 800);
        this.vy = approach(this.vy, -240, 1400 * dt);
        this.physics(dt, g, false);
        if (this.y <= hoverY + 10 || this.t > 1.6) {
          this.cd = c.cooldown * rand(0.8, 1.4);
          this.setState('hover');
        }
        break;
      default:
        this.setState('hover');
    }
  }

  // ---------------------------------------------------------------- SHIELDER
  actShield(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dz = p.z - this.z;
    // turning is deliberately slow: that is the opening
    if (this.state === 'approach' || this.state === 'idle') {
      const want = dx >= 0 ? 1 : -1;
      if (want !== this.facing) {
        this.turnT += dt;
        if (this.turnT >= c.turnDelay) { this.facing = want; this.turnT = 0; }
      } else this.turnT = 0;
    }
    switch (this.state) {
      case 'idle':
        if (this.t > 0.3) this.setState('approach');
        break;
      case 'approach': {
        this.shieldUp = true;
        const facingPlayer = sign(dx) === this.facing;
        if (this.wantToken(g)) {
          const side = this.cx < p.cx ? -1 : 1;
          if (facingPlayer) this.steer(p.cx + side * c.range * 0.75, p.z, 1, dt);
          else this.friction(dt, c.accel);
          if (facingPlayer && adx <= c.range && Math.abs(dz) <= 8) this.setState('windup');
        } else {
          const side = this.cx < p.cx ? -1 : 1;
          this.steer(p.cx + side * (150 + this.ringOff), clamp(p.z + this.zOff, 0, DEPTH), 0.6, dt);
        }
        break;
      }
      case 'windup':
        this.friction(dt, 2000);
        if (this.t >= c.windup) {
          this.setState('attack');
          this.vx = this.facing * c.bashSpeed;
          this.beginAttack(c.dmg, c.kb, -250, c.box, false, 18);
        }
        break;
      case 'attack':
        this.friction(dt, 1200);
        if (this.t >= c.active) { this.setState('recover'); this.shieldUp = false; }
        break;
      case 'recover':
        this.friction(dt);
        this.shieldUp = false;
        if (this.t >= c.recovery) {
          this.shieldUp = true;
          this.cd = c.cooldown * rand(0.8, 1.3);
          this.releaseToken();
          this.setState('approach');
        }
        break;
    }
    this.physics(dt, g, true);
  }

  // ---------------------------------------------------------------- ASSASSIN
  actAssassin(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx);
    const dir = dx >= 0 ? 1 : -1;
    switch (this.state) {
      case 'stalk': {
        this.alpha = approach(this.alpha, 1, dt * 4);
        this.facing = dir;
        const tx = adx < 180 ? p.cx - dir * 230 : adx > 320 ? p.cx - dir * 260 : this.cx;
        this.steer(tx, clamp(p.z + this.zOff, 0, DEPTH), 0.8, dt);
        this.physics(dt, g, true);
        if (this.t >= this.stalkDur && this.wantToken(g)) { this.setState('vanish'); Sound.whisper(); }
        break;
      }
      case 'vanish':
        this.alpha = Math.max(0.08, 1 - this.t / 0.3);
        this.friction(dt, 2000);
        this.physics(dt, g, true);
        if (this.t >= 0.3) this.setState('shadow');
        break;
      case 'shadow': {
        // drift unseen to a point behind the player
        this.alpha = 0.08;
        let tx = p.cx - p.facing * 70;
        if (tx < g.cam.x + 30 || tx > g.cam.x + g.viewW - 30) tx = p.cx + p.facing * 70;
        const tz = p.z;
        const ax = tx - this.cx, az = tz - this.z;
        const d = Math.hypot(ax, az);
        const step = c.shadowSpeed * dt;
        if (d <= step || this.t > 1.5) {
          this.x = tx - this.w / 2;
          this.z = tz;
          this.vx = 0; this.vz = 0;
          this.facing = p.cx >= this.cx ? 1 : -1;
          this.setState('windup');
          Sound.whisper();
        } else {
          this.x += ax / d * step;
          this.z += az / d * step;
          this.trailT -= dt;
          if (this.trailT <= 0) {
            this.trailT = 0.05;
            FX.particle(this.cx + rand(-6, 6), this.screenY - rand(8, 38), 0, -20, 0.35, 2.5, false, 0, 1);
          }
        }
        break;
      }
      case 'windup':
        this.alpha = lerp(0.15, 1, clamp(this.t / c.windup, 0, 1));
        this.friction(dt, 2000);
        this.physics(dt, g, true);
        if (this.t >= c.windup) {
          this.setState('attack');
          this.vx = this.facing * 220;
          this.beginAttack(c.dmg, c.kb, -240, c.box, false, 18);
        }
        break;
      case 'attack':
        this.alpha = 1;
        this.friction(dt, 1200);
        this.physics(dt, g, true);
        if (this.t >= c.active) {
          this.setState('retreat');
          this.releaseToken();
          this.vx = -this.facing * 320;
          this.vy = -380;
        }
        break;
      case 'retreat':
        this.physics(dt, g, true);
        if (this.onGround && this.t > 0.2) this.friction(dt, 1600);
        if (this.t >= 0.6) { this.stalkDur = rand(1.2, 2.0); this.cd = 0.5; this.setState('stalk'); }
        break;
      default:
        this.setState('stalk');
    }
  }

  // ---------------------------------------------------------------- ELITE
  actElite(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dz = p.z - this.z;
    const enraged = this.hp < this.maxHp * 0.5;
    const wm = enraged ? 0.8 : 1;
    switch (this.state) {
      case 'idle':
        if (this.t > 0.4) this.setState('approach');
        break;
      case 'approach': {
        this.faceToward(dx);
        const side = this.cx < p.cx ? -1 : 1;
        if (adx > 300) this.steer(p.cx + side * 260, p.z, 1, dt);
        else this.steer(p.cx + side * 110, p.z, 1, dt);
        if (this.cd <= 0 && this.wantToken(g)) {
          if (adx > 300) this.move = 'volley';
          else if (adx > 130 && Math.abs(dz) <= 10) this.move = 'dash';
          else if (adx <= 130 && Math.abs(dz) <= 40) this.move = 'slam';
          else break;
          this.windDur = c.moves[this.move].windup * wm;
          this.setState('windup');
          if (this.move !== 'volley') Sound.windup();
        }
        break;
      }
      case 'windup':
        if (this.move === 'dash') this.vx = approach(this.vx, -this.facing * 50, 1200 * dt);
        else this.friction(dt, 2000);
        if (this.move === 'volley') this.faceToward(dx);
        if (this.t >= this.windDur) this.execute(g);
        break;
      case 'attack': {
        const m = c.moves[this.move];
        if (this.move === 'dash') {
          this.vx = this.facing * m.speed;
          this.vz = 0;
          if (this.t >= m.time || this.hitWall) { this.recDur = m.recovery; this.setState('recover'); }
        } else if (this.t >= m.active) { this.recDur = m.recovery; this.setState('recover'); }
        break;
      }
      case 'recover':
        this.friction(dt, 2000);
        if (this.t >= this.recDur) {
          this.cd = rand(0.5, 0.9) * wm;
          this.releaseToken();
          this.setState('approach');
        }
        break;
    }
    this.physics(dt, g, true);
  }

  execute(g) {
    const m = this.c.moves[this.move];
    if (this.move === 'volley') {
      // three axes fanned out across the depth of the floor
      for (let i = -1; i <= 1; i++) {
        Projectiles.fire(this.cx + this.facing * 20, this.z, this.bottom - 44, this.facing * m.speed, i * 70, m.dmg, m.kb, 8, true);
      }
      Sound.shoot();
      this.recDur = m.recovery;
      this.setState('recover');
    } else if (this.move === 'dash') {
      this.setState('attack');
      this.vx = this.facing * m.speed;
      this.beginAttack(m.dmg, m.kb, -300, m.box, true, 18);
      FX.dust(this.cx, FLOOR_Y + this.z, 8, -this.facing);
      Sound.dash();
    } else {
      this.setState('attack');
      this.beginAttack(m.dmg, m.kb, -420, m.box, true, m.depth);
      FX.shake(0.4);
      FX.dust(this.cx - 80, FLOOR_Y + this.z, 10, -1);
      FX.dust(this.cx + 80, FLOOR_Y + this.z, 10, 1);
      FX.ring(this.cx, FLOOR_Y + this.z, 10, 140, 0.4, false, 5);
      Sound.slam();
    }
  }

  // ---------------------------------------------------------------- THIEF
  actThief(dt, g) {
    const c = this.c;
    if (this.state === 'stagger') {
      this.staggerT -= dt;
      this.friction(dt, 1400);
      this.physics(dt, g, true);
      if (this.staggerT <= 0) this.setState('run');
      return;
    }
    // scurry across the screen along a wobbling lane, then vanish off the edge
    const dir = this.fleeing ? this.fleeDir : this.facing;
    const speed = c.speed * (this.fleeing ? 1.8 : 1);
    this.vx = approach(this.vx, dir * speed, c.accel * dt);
    this.vz = Math.sin(this.anim * 2 + this.bob) * c.depthSpeed * 0.6;
    this.facing = dir;
    moveActor(this, dt, g.cam.x - 200, g.cam.x + g.viewW + 200, true);
    if (this.x > g.cam.x + g.viewW + 60 || this.x + this.w < g.cam.x - 60) this.active = false;
  }

  // ---------------------------------------------------------------- being hit
  // Returns 'hit', 'blocked' or 'none'.
  hit(atk, fromX, fromBottom, g) {
    if (!this.active || this.untouchable) return 'none';
    const c = this.c;
    const dir = this.cx >= fromX ? 1 : -1; // direction the blow pushes us
    if (this.behavior === 'thief') {
      this.flashT = 0.1;
      this.hp--;
      g.dropItem(this);
      this.vx = dir * 160;
      this.staggerT = 0.35;
      this.setState('stagger');
      if (this.hp <= 0) { this.fleeing = true; this.fleeDir = dir; }
      return 'hit';
    }
    const fromAbove = fromBottom < this.y + 10;
    if (!atk.magic && this.behavior === 'shield' && this.shieldUp && -dir === this.facing && !fromAbove) {
      this.vx = dir * 140;
      this.flashT = 0;
      return 'blocked';
    }
    this.hp -= atk.dmg * (c.dmgTaken || 1);
    this.flashT = 0.1;
    this.hpShowT = 2.5;
    if (this.behavior === 'assassin') this.alpha = 1;
    this.releaseToken();
    if (g.onEnemyHit) g.onEnemyHit(this, atk);
    const res = atk.magic ? 0 : (c.kbResist || 0);
    if (this.hp <= 0) { this.die(dir, atk.kb, g); return 'hit'; }

    let knock = !!atk.knockdown && !c.superArmor && !c.poise;
    if (c.poise && atk.heavy && this.poiseCd <= 0) { knock = !!atk.knockdown; this.poiseCd = c.poise; }
    if (atk.magic) knock = true;
    if (knock) {
      this.launch(dir, atk.kb * (1 - res), atk.kbUp);
    } else {
      this.vx = dir * atk.kb * (1 - res);
      this.vz = 0;
      const stagger = !c.superArmor && (!c.poise || (atk.heavy && this.poiseCd === c.poise));
      if (stagger) {
        this.staggerT = atk.stagger;
        this.setState('stagger');
      }
    }
    return 'hit';
  }

  launch(dir, kb, kbUp) {
    this.releaseToken();
    this.setState('launched');
    this.vx = dir * Math.max(120, kb);
    this.vy = kbUp || -420;
    this.vz = 0;
    this.y -= 1;
    this.onGround = false;
    if (this.behavior === 'assassin') this.alpha = 1;
  }

  die(dir, kb, g) {
    this.dying = true;
    this.hp = 0;
    this.launch(dir, Math.max(220, kb * 0.6), -380);
    g.onEnemyKilled(this);
  }

  grabbedBy(p) {
    this.releaseToken();
    this.setState('grabbed');
    this.vx = 0; this.vz = 0; this.vy = 0;
  }

  throwBy(p, dir) {
    this.setState('thrown');
    this.thrownBy = p;
    this.throwId = ++Enemy.throwSerial;
    this.vx = dir * 360;
    this.vy = -640;
    this.y -= 20;
    this.onGround = false;
  }

  // ---------------------------------------------------------------- drawing
  draw(ctx, g) {
    const c = this.c;
    const flash = this.flashT > 0;
    let alpha = this.alpha;
    let sy = 1;
    const floorY = FLOOR_Y + this.z;
    if (this.state === 'spawn') {
      const k = clamp(this.t / this.spawnDur, 0, 1);
      sy = easeOutCubic(k);
      alpha = k;
      ctx.fillStyle = INK;
      if (this.behavior === 'flyer') {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.globalAlpha = k;
        ctx.beginPath();
        ctx.arc(this.cx, this.screenY - this.h / 2, lerp(70, 16, k), 0, TAU);
        ctx.stroke();
      } else {
        // ink pooling where it will stand
        ctx.globalAlpha = 0.9 * (1 - k * 0.6);
        ctx.beginPath();
        ctx.ellipse(this.cx, floorY, (this.w * 0.8 + 10) * (0.4 + k * 0.6), 4, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (this.state === 'dead' && Math.floor(this.t * 16) % 2 === 0) alpha *= 0.3;
    if (alpha <= 0.01) return;

    let tele = 0;
    if (this.state === 'windup') tele = clamp(this.t / (this.windDur || c.windup), 0, 1);
    const shakeX = tele > 0 ? Math.sin(this.anim * 90) * tele * 2.2 : 0;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.cx + shakeX, this.screenY);
    ctx.scale(this.facing, sy);
    const s = this.state;
    if (s === 'launched' || s === 'down' || s === 'dead') {
      const k = s === 'launched' ? clamp(this.t / 0.3, 0, 1) : 1;
      ctx.rotate(-1.4 * k);
    } else if (s === 'getup') {
      ctx.rotate(-1.4 * (1 - easeOutCubic(this.t / GETUP_TIME)));
    } else if (s === 'thrown') {
      ctx.translate(0, -this.h / 2);
      ctx.rotate(-this.anim * 1.5);
      ctx.translate(0, this.h / 2);
    } else if (s === 'grabbed') {
      ctx.rotate(-0.25);
    }
    inkFlash = flash;
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (this.type) {
      case 'seeker': drawSeeker(ctx, this, flash, tele); break;
      case 'chaser': drawChaser(ctx, this, flash, tele); break;
      case 'brute': drawBrute(ctx, this, flash, tele); break;
      case 'ranged': drawRanged(ctx, this, flash, tele); break;
      case 'flyer': drawFlyer(ctx, this, flash, tele); break;
      case 'splitter': drawSplitter(ctx, this, flash, tele, 1); break;
      case 'splitling': drawSplitter(ctx, this, flash, tele, 0.55); break;
      case 'shielder': drawShielder(ctx, this, flash, tele); break;
      case 'assassin': drawAssassin(ctx, this, flash, tele); break;
      case 'elite': drawElite(ctx, this, flash, tele); break;
      case 'thief': drawThief(ctx, this, flash); break;
    }
    inkFlash = false;
    ctx.restore();

    // health bar for a while after being hit
    if (this.hpShowT > 0 && !this.dying && this.behavior !== 'thief' && alpha > 0.3) {
      const w = this.c.big ? 44 : 30, bx = this.cx - w / 2, by = this.screenY - this.h - (this.c.big ? 30 : 16);
      ctx.globalAlpha = Math.min(1, this.hpShowT * 2) * alpha;
      ctx.fillStyle = PAPER;
      ctx.fillRect(bx, by, w, 5);
      ctx.fillStyle = INK;
      ctx.fillRect(bx, by, w * clamp(this.hp / this.maxHp, 0, 1), 5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx, by, w, 5);
      ctx.globalAlpha = 1;
    }

    // set alight by a fire arrow
    if (this.burnT > 0 && alpha > 0.1) {
      ctx.globalAlpha = Math.min(1, this.burnT * 2) * alpha;
      drawFlames(ctx, this.cx, this.screenY - this.h * 0.35, this.anim + this.bob, 7, 3);
      ctx.globalAlpha = 1;
    }

    if (tele > 0 && alpha > 0.1) {
      ctx.globalAlpha = 0.25 + 0.65 * tele;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2 + tele * 2;
      ctx.beginPath();
      ctx.arc(this.cx, this.screenY - this.h / 2, lerp(c.big ? 110 : 70, c.big ? 44 : 26, easeOutCubic(tele)), 0, TAU);
      ctx.stroke();
      // floor footprint of heavy attacks: where on the floor it will land
      let zone = null, depth = DEPTH_TOL;
      if (this.behavior === 'heavy') { zone = c.box; depth = c.depth; }
      else if (this.behavior === 'elite' && this.move === 'slam') { zone = c.moves.slam.box; depth = c.moves.slam.depth; }
      if (zone) {
        placeBox(this.atkBox, this.cx, 0, zone, this.facing);
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        ctx.strokeRect(this.atkBox.x, floorY - depth, this.atkBox.w, depth * 2);
        ctx.setLineDash([]);
      }
      // flyer: dashed dive line and a target mark on the floor
      if (this.behavior === 'flyer' && tele > 0.3) {
        ctx.setLineDash([4, 8]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.cx, this.screenY - this.h / 2);
        ctx.lineTo(this.aim.x, FLOOR_Y + this.aim.z);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.ellipse(this.aim.x, FLOOR_Y + this.aim.z, 18, 5, 0, 0, TAU);
        ctx.stroke();
      }
      // lane attacks: a dotted line along the floor lane they will travel
      if ((this.behavior === 'lunge' || (this.behavior === 'elite' && this.move === 'dash')) && tele > 0.2) {
        ctx.setLineDash([3, 7]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.cx, floorY);
        ctx.lineTo(this.cx + this.facing * 220, floorY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }
    // ranged: dotted lane line in the last part of the windup
    if (this.behavior === 'ranged' && this.state === 'windup') {
      const k = this.t / c.windup;
      if (k > 0.45) {
        ctx.globalAlpha = (k - 0.45) * 1.6;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.moveTo(this.cx + this.facing * 16, floorY);
        ctx.lineTo(this.cx + this.facing * 420, floorY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
  }
}
Enemy.throwSerial = 0;

// ---------------------------------------------------------------- per-type silhouettes
// Local space: origin at feet, facing right. Drawn as outlines with the kit in util.js.

function walkCycle(e, rate) {
  return Math.hypot(e.vx, e.vz) > 20 ? Math.sin(e.anim * rate) : 0;
}

function drawSeeker(ctx, e, flash, tele) {
  const s = walkCycle(e, 11);
  limb(ctx, 0, -18, 7 * s + 3, 0, 6);
  limb(ctx, 0, -18, -7 * s - 3, 0, 6);
  ctx.beginPath();
  ctx.ellipse(1, -29, 11, 14, 0.25, 0, TAU);
  finish(ctx, flash);
  ctx.beginPath();
  ctx.arc(8, -42, 7, 0, TAU);
  finish(ctx, flash);
  eye(ctx, 9, -44, 4 + tele * 3, 2, flash);
  // clawed arm
  let hx = 13, hy = -18;
  if (e.state === 'windup') { hx = -8; hy = -46; }
  else if (e.state === 'attack') { hx = 44; hy = -26; }
  else if (e.state === 'recover') { hx = 34; hy = -10; }
  limb(ctx, 4, -34, hx, hy, 5);
  ctx.beginPath();
  ctx.moveTo(hx, hy - 5); ctx.lineTo(hx + 12, hy); ctx.lineTo(hx, hy + 5);
  ctx.closePath();
  finish(ctx, flash);
}

function drawChaser(ctx, e, flash, tele) {
  const s = walkCycle(e, 22);
  let sx = 1, sy = 1;
  if (e.state === 'windup') { sy = 1 - 0.28 * tele; sx = 1 + 0.15 * tele; }
  if (e.state === 'attack') { sx = 1.35; sy = 0.8; }
  ctx.save();
  ctx.scale(sx, sy);
  limb(ctx, -8, -8, -8 + 6 * s, 0, 4);
  limb(ctx, 8, -8, 8 - 6 * s, 0, 4);
  ctx.beginPath();
  ctx.moveTo(-17, -6);
  ctx.lineTo(-12, -22);
  ctx.quadraticCurveTo(2, -32, 12, -24);
  ctx.lineTo(20, -12);
  ctx.lineTo(12, -5);
  ctx.closePath();
  finish(ctx, flash);
  // spines
  ctx.beginPath();
  ctx.moveTo(-10, -22); ctx.lineTo(-16, -31); ctx.lineTo(-4, -26);
  ctx.moveTo(-2, -27); ctx.lineTo(-4, -36); ctx.lineTo(5, -28);
  finish(ctx, flash);
  eye(ctx, 11, -21, 5, 2, flash);
  ctx.restore();
}

function drawBrute(ctx, e, flash, tele) {
  const s = walkCycle(e, 6);
  box(ctx, -22, -32 + Math.max(0, s) * 3, 15, 32 - Math.max(0, s) * 3, flash);
  box(ctx, 6, -32 + Math.max(0, -s) * 3, 15, 32 - Math.max(0, -s) * 3, flash);
  ctx.beginPath();
  ctx.moveTo(-28, -30); ctx.lineTo(-24, -74); ctx.lineTo(16, -82); ctx.lineTo(30, -34);
  ctx.closePath();
  finish(ctx, flash);
  ctx.beginPath();
  ctx.arc(10, -82, 10, 0, TAU);
  finish(ctx, flash);
  eye(ctx, 12, -84, 5 + tele * 3, 2, flash);
  // enormous fists
  let fx = 30, fy = -22;
  if (e.state === 'windup') { fx = lerp(30, -2, tele); fy = lerp(-22, -118, easeOutCubic(tele)); }
  else if (e.state === 'attack') { fx = 72; fy = -12; }
  else if (e.state === 'recover') { const k = clamp(e.t / e.c.recovery, 0, 1); fx = lerp(72, 30, k * k); fy = lerp(-12, -22, k); }
  limb(ctx, 10, -66, fx, fy, 14);
  ctx.beginPath();
  ctx.arc(fx, fy, 13, 0, TAU);
  finish(ctx, flash);
}

function drawRanged(ctx, e, flash, tele) {
  const s = walkCycle(e, 9);
  ctx.beginPath();
  ctx.moveTo(-12 - s * 2, 0);
  ctx.lineTo(-7, -32);
  ctx.quadraticCurveTo(-4, -46, 4, -48);
  ctx.lineTo(9, -33);
  ctx.lineTo(13 + s * 2, 0);
  ctx.closePath();
  finish(ctx, flash);
  eye(ctx, 3, -37, 4, 2, flash);
  // casting arm + orb
  const ax = e.state === 'windup' || e.state === 'recover' ? 16 : 10;
  limb(ctx, 3, -30, ax, -27, 4);
  const r = e.state === 'windup' ? lerp(2, 8, tele) : 3;
  ctx.beginPath();
  ctx.arc(ax + 4, -27, r, 0, TAU);
  finish(ctx, flash);
  if (e.state === 'windup') {
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ax + 4, -27, r + 6 + (1 - tele) * 12, 0, TAU);
    ctx.stroke();
  }
}

function drawFlyer(ctx, e, flash, tele) {
  const diving = e.state === 'dive';
  if (diving) ctx.rotate(Math.atan2(e.vy, Math.abs(e.vx)));
  const flap = diving ? -0.2 : Math.sin(e.anim * (e.state === 'windup' ? 26 : 14));
  const cy = -11;
  ctx.beginPath();
  ctx.ellipse(0, cy, 10, 7, 0, 0, TAU);
  finish(ctx, flash);
  const span = diving ? 10 : 24;
  ctx.beginPath();
  ctx.moveTo(-4, cy - 2); ctx.lineTo(-span, cy - 4 - flap * 14); ctx.lineTo(-8, cy + 3);
  ctx.moveTo(2, cy - 2); ctx.lineTo(span * 0.8, cy - 6 - flap * 12); ctx.lineTo(6, cy + 3);
  finish(ctx, flash);
  ctx.beginPath();
  ctx.moveTo(-8, cy + 2); ctx.lineTo(-18, cy + 8); ctx.lineTo(-6, cy + 5);
  finish(ctx, flash);
  // beak
  ctx.beginPath();
  ctx.moveTo(8, cy - 3); ctx.lineTo(17, cy); ctx.lineTo(8, cy + 3);
  finish(ctx, flash);
  eye(ctx, 4, cy - 3, 3 + tele * 2, 2, flash);
}

function drawSplitter(ctx, e, flash, tele, scale) {
  const s = walkCycle(e, 12);
  ctx.save();
  ctx.scale(scale, scale);
  const squish = e.state === 'windup' ? 1 - tele * 0.15 : 1;
  limb(ctx, -8, -8, -8 + 4 * s, 0, 6);
  limb(ctx, 8, -8, 8 - 4 * s, 0, 6);
  ctx.beginPath();
  ctx.ellipse(0, -21 * squish, 18 / squish * (e.state === 'attack' ? 1.15 : 1), 19 * squish, 0, 0, TAU);
  finish(ctx, flash);
  if (scale === 1) {
    // the fault line it will split along
    ctx.strokeStyle = detailInk(flash);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -38); ctx.lineTo(-3, -30); ctx.lineTo(2, -22); ctx.lineTo(-2, -12); ctx.lineTo(1, -4);
    ctx.stroke();
    ctx.strokeStyle = '#000';
  }
  eye(ctx, 8, -28, 5 + tele * 2, 3, flash);
  if (e.state === 'attack') {
    ctx.beginPath();
    ctx.moveTo(16, -28); ctx.lineTo(34, -20); ctx.lineTo(16, -12);
    finish(ctx, flash);
  }
  ctx.restore();
}

function drawShielder(ctx, e, flash, tele) {
  const s = walkCycle(e, 8);
  limb(ctx, -2, -20, -2 + 6 * s, 0, 7);
  limb(ctx, -2, -20, -2 - 6 * s, 0, 7);
  ctx.beginPath();
  ctx.moveTo(-12, -20); ctx.lineTo(-10, -44); ctx.lineTo(8, -46); ctx.lineTo(9, -20);
  ctx.closePath();
  finish(ctx, flash);
  ctx.beginPath();
  ctx.arc(0, -52, 7, 0, TAU);
  finish(ctx, flash);
  eye(ctx, 2, -54, 4, 2, flash);
  // the shield
  ctx.save();
  let sx = 12, rot = 0, sy = 0;
  if (e.state === 'windup') sx = 12 - tele * 6;
  else if (e.state === 'attack') sx = 22;
  else if (!e.shieldUp) { sx = 8; rot = 0.9; sy = 18; }
  ctx.translate(sx, sy);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -60); ctx.lineTo(12, -56); ctx.lineTo(12, -6); ctx.lineTo(0, -2);
  ctx.closePath();
  finish(ctx, flash);
  ctx.strokeStyle = detailInk(flash);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(4, -52); ctx.lineTo(8, -50); ctx.lineTo(8, -12); ctx.lineTo(4, -9);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#000';
  limb(ctx, 4, -40, sx + 2, -32 + sy * 0.5, 5);
}

function drawAssassin(ctx, e, flash, tele) {
  const s = walkCycle(e, 13);
  const air = !e.onGround && e.state !== 'shadow';
  limb(ctx, 0, -20, air ? 8 : 6 * s + 2, air ? -6 : 0, 4);
  limb(ctx, 0, -20, air ? -6 : -6 * s - 2, air ? -4 : 0, 4);
  limb(ctx, 0, -20, 3, -36, 7);
  ctx.beginPath();
  ctx.arc(4, -42, 6, 0, TAU);
  finish(ctx, flash);
  eye(ctx, 6, -43, 5, 1.5, flash);
  // scarf
  const w = Math.sin(e.anim * 9);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1, -37);
  ctx.quadraticCurveTo(-14, -36 + w * 4, -26, -30 + w * 6);
  ctx.moveTo(1, -36);
  ctx.quadraticCurveTo(-10, -30 + w * 3, -20, -24 - w * 4);
  ctx.stroke();
  // thin blade
  let a = 0.9;
  if (e.state === 'windup') a = lerp(0.9, -2.2, tele);
  else if (e.state === 'attack') a = 0.5;
  const hx = 8, hy = -30;
  limb(ctx, 2, -33, hx, hy, 3.5);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + Math.cos(a) * 34, hy + Math.sin(a) * 34);
  ctx.stroke();
}

function drawElite(ctx, e, flash, tele) {
  const s = walkCycle(e, 9);
  const crouch = e.state === 'windup' && e.move === 'dash' ? tele * 8 : 0;
  ctx.translate(0, crouch);
  limb(ctx, -6, -26, -6 + 8 * s, 0, 9);
  limb(ctx, 6, -26, 6 - 8 * s, 0 - crouch, 9);
  // cape
  const w = Math.sin(e.anim * 6) * 3;
  ctx.beginPath();
  ctx.moveTo(-6, -58); ctx.lineTo(-26 + w, -12); ctx.lineTo(-8, -22);
  ctx.closePath();
  finish(ctx, flash);
  // armoured torso
  ctx.beginPath();
  ctx.moveTo(-14, -26); ctx.lineTo(-17, -58); ctx.lineTo(14, -60); ctx.lineTo(12, -26);
  ctx.closePath();
  finish(ctx, flash);
  // horned head
  ctx.beginPath();
  ctx.arc(0, -68, 9, 0, TAU);
  finish(ctx, flash);
  ctx.beginPath();
  ctx.moveTo(-6, -74); ctx.lineTo(-14, -90); ctx.lineTo(-1, -76);
  ctx.moveTo(4, -75); ctx.lineTo(10, -92); ctx.lineTo(9, -72);
  finish(ctx, flash);
  eye(ctx, 2, -70, 4 + tele * 2, 2, flash);
  eye(ctx, 7, -70, 3, 2, flash);
  // its own greatsword
  let a = 1.0;
  if (e.state === 'windup') {
    if (e.move === 'slam') a = lerp(1.0, -1.7, easeOutCubic(tele));
    else if (e.move === 'dash') a = lerp(1.0, 2.7, tele);
    else a = lerp(1.0, -0.3, tele);
  } else if (e.state === 'attack') a = e.move === 'slam' ? 1.45 : 0.1;
  else if (e.state === 'recover') a = e.move === 'slam' ? 1.45 : 0.6;
  const shx = 4, shy = -52;
  const hx = shx + Math.cos(a) * 16, hy = shy + Math.sin(a) * 16;
  limb(ctx, shx, shy, hx, hy, 6);
  const L = 78, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  ctx.beginPath();
  ctx.moveTo(hx + nx * 5, hy + ny * 5);
  ctx.lineTo(hx + dx * L + nx * 3, hy + dy * L + ny * 3);
  ctx.lineTo(hx + dx * (L + 10), hy + dy * (L + 10));
  ctx.lineTo(hx + dx * L - nx * 3, hy + dy * L - ny * 3);
  ctx.lineTo(hx - nx * 5, hy - ny * 5);
  ctx.closePath();
  finish(ctx, flash);
  limb(ctx, hx + nx * 10, hy + ny * 10, hx - nx * 10, hy - ny * 10, 5);
  // volley orbs forming
  if (e.state === 'windup' && e.move === 'volley') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(26, -44 + i * 12, 2 + tele * 5, 0, TAU);
      finish(ctx, flash);
    }
  }
}

function drawThief(ctx, e, flash) {
  const s = walkCycle(e, 20);
  limb(ctx, -2, -10, -2 + 6 * s, 0, 4);
  limb(ctx, -2, -10, -2 - 6 * s, 0, 4);
  // hunched body + pointed hood
  ctx.beginPath();
  ctx.moveTo(-8, -8); ctx.lineTo(-6, -20); ctx.lineTo(4, -30); ctx.lineTo(9, -18); ctx.lineTo(7, -8);
  ctx.closePath();
  finish(ctx, flash);
  eye(ctx, 4, -23, 3, 2, flash);
  // the sack, bouncing on its back
  if (e.hp > 0) {
    const b = Math.abs(s) * 2;
    ctx.beginPath();
    ctx.arc(-12, -22 - b, 9, 0, TAU);
    finish(ctx, flash);
    ctx.strokeStyle = detailInk(flash);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-15, -29 - b); ctx.lineTo(-9, -29 - b);
    ctx.stroke();
    ctx.strokeStyle = '#000';
  }
}
