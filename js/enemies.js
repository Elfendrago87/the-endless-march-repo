'use strict';
// Enemy archetypes. Each has a readable windup -> active -> recovery cycle.
// All share one pooled class; behaviour is chosen by the type's `ai` key.

class Enemy {
  constructor() {
    this.active = false;
    this.atkBox = Rect();
    this.aim = { x: 0, y: 0 };
  }

  reset(type, x, bottom, opts) {
    const c = ENEMY_TYPES[type];
    this.type = type; this.c = c; this.ai = c.ai;
    this.w = c.w; this.h = c.h;
    this.x = x - c.w / 2; this.y = bottom - c.h;
    this.vx = (opts && opts.vx) || 0;
    this.vy = (opts && opts.vy) || 0;
    this.onGround = false; this.onPlatform = false; this.hitWall = 0; this.dropping = false;
    this.hp = this.maxHp = c.hp;
    this.facing = Math.random() < 0.5 ? 1 : -1;
    this.state = 'spawn'; this.t = 0;
    this.spawnDur = (opts && opts.spawnDur) || SPAWN_TIME;
    this.flashT = 0; this.staggerT = 0; this.poiseCd = 0;
    this.lastHitId = -1;
    this.atkActive = false; this.atkHit = false; this.atkDef = null;
    this.atkDmg = 0; this.atkKb = 0; this.atkKbUp = 0;
    this.cd = rand(0.4, 1.0); this.jumpCd = 0; this.dropT = 0; this.turnT = 0;
    this.alpha = 0; this.shieldUp = c.ai === 'shield';
    this.anim = rand(0, 10); this.bob = rand(0, TAU);
    this.move = null; this.windDur = 0; this.recDur = 0;
    this.stalkDur = rand(1.0, 1.6); this.trailT = 0;
    this.active = true;
    return this;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }

  setState(s) {
    this.state = s;
    this.t = 0;
    this.atkActive = false;
    this.atkHit = false;
  }

  beginAttack(dmg, kb, kbUp, box) {
    this.atkActive = true;
    this.atkHit = false;
    this.atkDmg = dmg; this.atkKb = kb; this.atkKbUp = kbUp;
    this.atkDef = box;
  }

  physics(dt, g, gravity) {
    if (gravity) this.vy = Math.min(this.vy + GRAVITY * dt, 1100);
    moveBody(this, dt, g.arena);
  }

  faceToward(dx) { if (dx !== 0) this.facing = dx > 0 ? 1 : -1; }

  // Simple platform navigation for ground units.
  navigate(dx, dy, adx) {
    const c = this.c;
    if (!this.onGround || !c.jump || this.jumpCd > 0) return;
    if (this.hitWall !== 0 && this.hitWall === sign(this.vx || this.facing)) {
      this.vy = -c.jump; this.jumpCd = 0.8; this.onGround = false;
    } else if (dy < -90 && adx < 170) {
      this.vy = -c.jump; this.jumpCd = 1.4; this.onGround = false;
    } else if (dy > 60 && this.onPlatform && adx < 240) {
      this.dropT = 0.3;
    }
  }

  friction(dt, amt) { this.vx = approach(this.vx, 0, (amt || 1800) * dt); }

  defaultState() {
    switch (this.ai) {
      case 'flyer': return 'rise';
      case 'assassin': return 'stalk';
      default: return 'approach';
    }
  }

  isFloating() {
    return this.ai === 'flyer' && this.state !== 'recover';
  }

  update(dt, g) {
    const p = g.player;
    this.t += dt; this.anim += dt;
    if (this.flashT > 0) this.flashT -= dt;
    this.cd -= dt; this.jumpCd -= dt; this.dropT -= dt; this.poiseCd -= dt;
    this.dropping = this.dropT > 0 || this.ai === 'flyer';

    if (this.state === 'spawn') {
      this.alpha = Math.min(1, this.t / this.spawnDur);
      if (this.ai !== 'flyer') this.physics(dt, g, true);
      else this.vy = 0;
      if (this.t >= this.spawnDur) {
        this.alpha = 1;
        this.setState(this.ai === 'flyer' ? 'hover' : this.ai === 'assassin' ? 'stalk' : 'idle');
      }
      return;
    }

    // Once the player falls or the fighting ends, enemies stand still.
    if (!p.alive || !g.combatAllowed) {
      this.atkActive = false;
      this.alpha = approach(this.alpha, 1, dt * 2);
      this.friction(dt, 1200);
      if (this.isFloating()) { this.vy = approach(this.vy, 0, 800 * dt); this.physics(dt, g, false); } else this.physics(dt, g, true);
      return;
    }

    if (this.state === 'stagger') {
      this.atkActive = false;
      this.staggerT -= dt;
      this.friction(dt, this.onGround ? 1400 : 300);
      if (this.isFloating()) { this.vy = approach(this.vy, 0, 1400 * dt); this.physics(dt, g, false); } else this.physics(dt, g, true);
      if (this.staggerT <= 0) this.setState(this.defaultState());
      return;
    }

    switch (this.ai) {
      case 'melee': this.aiMelee(dt, g); break;
      case 'lunge': this.aiLunge(dt, g); break;
      case 'heavy': this.aiHeavy(dt, g); break;
      case 'ranged': this.aiRanged(dt, g); break;
      case 'flyer': this.aiFlyer(dt, g); break;
      case 'shield': this.aiShield(dt, g); break;
      case 'assassin': this.aiAssassin(dt, g); break;
      case 'elite': this.aiElite(dt, g); break;
    }

    if (this.atkActive) {
      placeBox(this.atkBox, this.cx, this.bottom, this.atkDef, this.facing);
      if (!this.atkHit && p.alive && rectsOverlap(this.atkBox, p)) {
        if (p.hurt(this.atkDmg, this.cx, this.atkKb, this.atkKbUp)) this.atkHit = true;
      }
    }
  }

  // ---------------------------------------------------------------- SEEKER / SPLITTER
  aiMelee(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dy = p.bottom - this.bottom;
    switch (this.state) {
      case 'idle':
        this.friction(dt);
        if (this.t > 0.25) this.setState('approach');
        break;
      case 'approach':
        this.faceToward(dx);
        if (adx > c.range * 0.75) this.vx = approach(this.vx, this.facing * c.speed, c.accel * dt);
        else this.friction(dt, c.accel);
        this.navigate(dx, dy, adx);
        if (adx <= c.range && Math.abs(dy) < 70 && this.cd <= 0 && this.onGround) this.setState('windup');
        break;
      case 'windup':
        this.friction(dt, 2400);
        if (this.t >= c.windup) {
          this.setState('attack');
          this.vx = this.facing * c.step;
          this.beginAttack(c.dmg, c.kb, -220, c.box);
        }
        break;
      case 'attack':
        this.friction(dt, 1400);
        if (this.t >= c.active) this.setState('recover');
        break;
      case 'recover':
        this.friction(dt);
        if (this.t >= c.recovery) { this.cd = c.cooldown * rand(0.8, 1.3); this.setState('approach'); }
        break;
    }
    this.physics(dt, g, true);
  }

  // ---------------------------------------------------------------- CHASER
  aiLunge(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dy = p.bottom - this.bottom;
    switch (this.state) {
      case 'idle':
        if (this.t > 0.15) this.setState('approach');
        break;
      case 'approach':
        this.faceToward(dx);
        this.vx = approach(this.vx, this.facing * c.speed, c.accel * dt);
        this.navigate(dx, dy, adx);
        if (adx < c.lungeRange && adx > 30 && Math.abs(dy) < 80 && this.cd <= 0 && this.onGround) this.setState('windup');
        break;
      case 'windup':
        this.friction(dt, 3000);
        if (this.t >= c.windup) {
          this.setState('attack');
          this.vx = this.facing * c.lungeSpeed;
          this.vy = -200;
          this.beginAttack(c.dmg, c.kb, -260, c.box);
          FX.dust(this.cx, this.bottom, 4, -this.facing);
        }
        break;
      case 'attack':
        this.vx = this.facing * c.lungeSpeed;
        if (this.t >= c.lungeTime || this.hitWall) this.setState('recover');
        break;
      case 'recover':
        this.friction(dt, this.onGround ? 1600 : 400);
        if (this.t >= c.recovery) { this.cd = c.cooldown * rand(0.8, 1.4); this.setState('approach'); }
        break;
    }
    this.physics(dt, g, true);
  }

  // ---------------------------------------------------------------- BRUTE
  aiHeavy(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dy = p.bottom - this.bottom;
    switch (this.state) {
      case 'idle':
        if (this.t > 0.4) this.setState('approach');
        break;
      case 'approach':
        this.faceToward(dx);
        if (adx > c.range * 0.7) this.vx = approach(this.vx, this.facing * c.speed, c.accel * dt);
        else this.friction(dt, c.accel);
        if (adx <= c.range && Math.abs(dy) < 100 && this.cd <= 0 && this.onGround) {
          this.setState('windup');
          Sound.windup();
        }
        break;
      case 'windup':
        this.friction(dt, 2000);
        if (this.t >= c.windup) {
          this.setState('attack');
          this.beginAttack(c.dmg, c.kb, -440, c.box);
          const fx = this.cx + this.facing * 70;
          FX.shake(0.4);
          FX.dust(fx, this.bottom, 16);
          FX.ring(fx, this.bottom, 10, 110, 0.35, false, 5);
          Sound.slam();
        }
        break;
      case 'attack':
        if (this.t >= c.active) this.setState('recover');
        break;
      case 'recover':
        this.friction(dt);
        if (this.t >= c.recovery) { this.cd = c.cooldown * rand(0.8, 1.2); this.setState('approach'); }
        break;
    }
    this.physics(dt, g, true);
  }

  // ---------------------------------------------------------------- RANGED
  aiRanged(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx);
    const dir = dx >= 0 ? 1 : -1;
    switch (this.state) {
      case 'idle':
      case 'approach': {
        this.facing = dir;
        let want = 0;
        if (adx < c.keepMin) want = -dir;
        else if (adx > c.keepMax) want = dir;
        if (want !== 0 && this.hitWall === want) want = 0; // cornered: stand and fight
        this.vx = approach(this.vx, want * c.speed * (want === -dir ? 1.2 : 1), c.accel * dt);
        if (this.cd <= 0 && adx < 820 && this.onGround && (adx > c.keepMin * 0.55 || want === 0)) {
          this.setState('windup');
        }
        break;
      }
      case 'windup':
        this.facing = dir;
        this.friction(dt, 2000);
        if (this.t >= c.windup) {
          const hx = this.cx + this.facing * 16, hy = this.bottom - 27;
          let ax = p.cx - hx, ay = p.cy - hy;
          const len = Math.hypot(ax, ay) || 1;
          ax /= len; ay /= len;
          Projectiles.fire(hx, hy, ax * c.projSpeed, ay * c.projSpeed, c.dmg, c.kb, 7);
          this.vx = -this.facing * 90; // recoil
          Sound.shoot();
          this.setState('recover');
        }
        break;
      case 'recover':
        this.friction(dt, 800);
        if (this.t >= c.recovery) { this.cd = c.cooldown * rand(0.85, 1.25); this.setState('approach'); }
        break;
    }
    this.physics(dt, g, true);
  }

  // ---------------------------------------------------------------- FLYER
  aiFlyer(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx;
    const hoverY = Math.max(70, p.y - c.hoverHeight);
    switch (this.state) {
      case 'hover': {
        const tx = p.cx + Math.sin(this.anim * 1.1 + this.bob) * 110;
        const ty = hoverY + Math.sin(this.anim * 2.3) * 12;
        this.vx = approach(this.vx, clamp((tx - this.cx) * 2.4, -c.speed, c.speed), 900 * dt);
        this.vy = approach(this.vy, clamp((ty - this.cy) * 2.4, -c.speed, c.speed), 900 * dt);
        this.faceToward(dx);
        this.physics(dt, g, false);
        if (Math.abs(dx) < 90 && this.cd <= 0 && this.t > 0.8 && this.cy < p.y - 60) this.setState('windup');
        break;
      }
      case 'windup':
        this.friction(dt, 1200);
        this.vy = approach(this.vy, -60, 800 * dt);
        this.physics(dt, g, false);
        this.aim.x = p.cx; this.aim.y = p.cy;
        if (this.t >= c.windup) {
          let ax = this.aim.x - this.cx, ay = this.aim.y - this.cy;
          const len = Math.hypot(ax, ay) || 1;
          this.setState('dive');
          this.vx = ax / len * c.diveSpeed;
          this.vy = ay / len * c.diveSpeed;
          this.faceToward(this.vx);
          this.beginAttack(c.dmg, c.kb, -260, c.box);
        }
        break;
      case 'dive':
        this.physics(dt, g, false);
        if (this.onGround || this.hitWall || this.t >= c.diveTime) {
          if (this.onGround) { FX.dust(this.cx, this.bottom, 10); FX.shake(0.08); }
          this.setState('recover');
          this.vx = 0;
        }
        break;
      case 'recover':
        this.friction(dt, 1200);
        this.physics(dt, g, true);
        if (this.t >= c.recovery) this.setState('rise');
        break;
      case 'rise':
        this.friction(dt, 800);
        this.vy = approach(this.vy, -280, 1400 * dt);
        this.physics(dt, g, false);
        if (this.cy <= hoverY + 10 || this.t > 1.6) {
          this.cd = c.cooldown * rand(0.8, 1.4);
          this.setState('hover');
        }
        break;
    }
    if (this.y < -60) { this.y = -60; if (this.vy < 0) this.vy = 0; }
  }

  // ---------------------------------------------------------------- SHIELDER
  aiShield(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dy = p.bottom - this.bottom;
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
        const facingPlayer = sign(dx) === this.facing;
        if (facingPlayer && adx > c.range * 0.8) this.vx = approach(this.vx, this.facing * c.speed, c.accel * dt);
        else this.friction(dt, c.accel);
        this.shieldUp = true;
        if (facingPlayer && adx <= c.range && Math.abs(dy) < 70 && this.cd <= 0 && this.onGround) this.setState('windup');
        break;
      }
      case 'windup':
        this.friction(dt, 2000);
        if (this.t >= c.windup) {
          this.setState('attack');
          this.vx = this.facing * c.bashSpeed;
          this.beginAttack(c.dmg, c.kb, -250, c.box);
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
          this.setState('approach');
        }
        break;
    }
    this.physics(dt, g, true);
  }

  // ---------------------------------------------------------------- ASSASSIN
  aiAssassin(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx);
    const dir = dx >= 0 ? 1 : -1;
    switch (this.state) {
      case 'stalk': {
        this.alpha = approach(this.alpha, 1, dt * 4);
        this.facing = dir;
        let want = 0;
        if (adx < 200) want = -dir; else if (adx > 320) want = dir;
        this.vx = approach(this.vx, want * c.speed, c.accel * dt);
        this.physics(dt, g, true);
        if (this.t >= this.stalkDur && this.onGround) { this.setState('vanish'); Sound.whisper(); }
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
        const arena = g.arena;
        let tx = p.cx - p.facing * 85;
        if (tx < 70 || tx > arena.width - 70) tx = p.cx + p.facing * 85;
        const ty = p.bottom;
        let ax = tx - this.cx, ay = ty - this.bottom;
        const d = Math.hypot(ax, ay);
        const step = c.shadowSpeed * dt;
        if (d <= step || this.t > 1.5) {
          this.x = tx - this.w / 2;
          this.y = ty - this.h;
          this.vx = 0; this.vy = 0;
          this.facing = p.cx >= this.cx ? 1 : -1;
          this.setState('windup');
          Sound.whisper();
        } else {
          this.x += ax / d * step;
          this.y += ay / d * step;
          this.trailT -= dt;
          if (this.trailT <= 0) {
            this.trailT = 0.05;
            FX.particle(this.cx + rand(-6, 6), this.cy + rand(-14, 14), 0, -20, 0.35, 2.5, false, 0, 1);
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
          this.vx = this.facing * 260;
          this.beginAttack(c.dmg, c.kb, -240, c.box);
        }
        break;
      case 'attack':
        this.alpha = 1;
        this.friction(dt, 1200);
        this.physics(dt, g, true);
        if (this.t >= c.active) {
          this.setState('retreat');
          this.vx = -this.facing * 420;
          this.vy = -440;
        }
        break;
      case 'retreat':
        this.physics(dt, g, true);
        if (this.onGround && this.t > 0.2) this.friction(dt, 1600);
        if (this.t >= 0.6) { this.stalkDur = rand(1.0, 1.8); this.setState('stalk'); }
        break;
      default:
        this.physics(dt, g, true);
    }
  }

  // ---------------------------------------------------------------- ELITE
  aiElite(dt, g) {
    const c = this.c, p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dy = p.bottom - this.bottom;
    const enraged = this.hp < this.maxHp * 0.5;
    const wm = enraged ? 0.8 : 1;
    switch (this.state) {
      case 'idle':
        if (this.t > 0.4) this.setState('approach');
        break;
      case 'approach':
        this.faceToward(dx);
        if (adx > 140) this.vx = approach(this.vx, this.facing * c.speed, c.accel * dt);
        else this.friction(dt, c.accel);
        this.navigate(dx, dy, adx);
        if (this.cd <= 0 && this.onGround) {
          if (adx > 420 || dy < -120) this.move = 'volley';
          else if (adx > 150) this.move = 'dash';
          else this.move = 'slam';
          this.windDur = c.moves[this.move].windup * wm;
          this.setState('windup');
          if (this.move !== 'volley') Sound.windup();
        }
        break;
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
          if (this.t >= m.time || this.hitWall) { this.recDur = m.recovery; this.setState('recover'); }
        } else if (this.t >= m.active) { this.recDur = m.recovery; this.setState('recover'); }
        break;
      }
      case 'recover':
        this.friction(dt, 2000);
        if (this.t >= this.recDur) { this.cd = rand(0.5, 0.9) * wm; this.setState('approach'); }
        break;
    }
    this.physics(dt, g, true);
  }

  execute(g) {
    const m = this.c.moves[this.move], p = g.player;
    if (this.move === 'volley') {
      const hx = this.cx + this.facing * 20, hy = this.bottom - 44;
      const base = Math.atan2(p.cy - hy, p.cx - hx);
      for (let i = -1; i <= 1; i++) {
        const a = base + i * 0.2;
        Projectiles.fire(hx, hy, Math.cos(a) * m.speed, Math.sin(a) * m.speed, m.dmg, m.kb, 8);
      }
      Sound.shoot();
      this.recDur = m.recovery;
      this.setState('recover');
    } else if (this.move === 'dash') {
      this.setState('attack');
      this.vx = this.facing * m.speed;
      this.beginAttack(m.dmg, m.kb, -260, m.box);
      FX.dust(this.cx, this.bottom, 8, -this.facing);
      Sound.dash();
    } else {
      this.setState('attack');
      this.beginAttack(m.dmg, m.kb, -420, m.box);
      FX.shake(0.4);
      FX.dust(this.cx - 80, this.bottom, 10, -1);
      FX.dust(this.cx + 80, this.bottom, 10, 1);
      FX.ring(this.cx, this.bottom, 10, 140, 0.4, false, 5);
      Sound.slam();
    }
  }

  // Called when the sword connects. Returns 'hit', 'blocked' or 'none'.
  hit(atk, fromX, fromBottom, g) {
    if (!this.active || this.state === 'spawn') return 'none';
    const c = this.c;
    const dir = this.cx >= fromX ? 1 : -1; // direction the blow pushes us
    const fromAbove = fromBottom < this.y + 10;
    if (this.ai === 'shield' && this.shieldUp && -dir === this.facing && !fromAbove) {
      this.vx = dir * 160;
      this.flashT = 0;
      return 'blocked';
    }
    this.hp -= atk.dmg * (c.dmgTaken || 1);
    this.flashT = 0.1;
    const res = c.kbResist || 0;
    this.vx = dir * atk.kb * (1 - res);
    if (this.isFloating()) this.vy = atk.kbUp * 0.4 * (1 - res);
    else this.vy = Math.min(this.vy, atk.kbUp * (1 - res));
    if (this.ai === 'assassin') this.alpha = 1;

    let stagger = !c.superArmor;
    if (c.poise) {
      stagger = !!atk.heavy && this.poiseCd <= 0;
      if (stagger) this.poiseCd = c.poise;
    }
    if (stagger) {
      this.staggerT = atk.stagger;
      this.setState('stagger');
    }
    if (this.hp <= 0) this.die(g);
    return 'hit';
  }

  die(g) {
    this.active = false;
    this.atkActive = false;
    g.onEnemyKilled(this);
  }

  // ---------------------------------------------------------------- drawing
  draw(ctx, g) {
    const c = this.c;
    const flash = this.flashT > 0;
    let alpha = this.alpha;
    let sy = 1;
    if (this.state === 'spawn') {
      const k = clamp(this.t / this.spawnDur, 0, 1);
      sy = easeOutCubic(k);
      alpha = k;
      // ink pooling where it will stand
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.9 * (1 - k * 0.6);
      ctx.beginPath();
      ctx.ellipse(this.cx, this.bottom, (this.w * 0.8 + 10) * (0.4 + k * 0.6), 4, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (this.ai === 'flyer') {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.globalAlpha = k;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, lerp(70, 16, k), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (alpha <= 0.01) return;

    // windup telegraph: a ring collapsing onto the enemy
    let tele = 0;
    if (this.state === 'windup') tele = clamp(this.t / (this.windDur || c.windup), 0, 1);
    const shakeX = tele > 0 ? Math.sin(this.anim * 90) * tele * 2.2 : 0;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.cx + shakeX, this.bottom);
    ctx.scale(this.facing, sy);
    ctx.fillStyle = flash ? '#fff' : '#000';
    ctx.strokeStyle = '#000';
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
    }
    ctx.restore();

    if (tele > 0 && alpha > 0.1) {
      ctx.globalAlpha = 0.25 + 0.65 * tele;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2 + tele * 2;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, lerp(c.big ? 110 : 70, c.big ? 44 : 26, easeOutCubic(tele)), 0, TAU);
      ctx.stroke();
      // area preview for heavy ground attacks
      let zone = null;
      if (this.ai === 'heavy') zone = c.box;
      else if (this.ai === 'elite' && this.move === 'slam') zone = c.moves.slam.box;
      if (zone) {
        placeBox(this.atkBox, this.cx, this.bottom, zone, this.facing);
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        ctx.strokeRect(this.atkBox.x, this.atkBox.y, this.atkBox.w, this.atkBox.h);
        ctx.setLineDash([]);
      }
      // flyer dive line
      if (this.ai === 'flyer' && tele > 0.3) {
        ctx.setLineDash([4, 8]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(this.aim.x, this.aim.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }
    // ranged aim line in the last part of its windup
    if (this.ai === 'ranged' && this.state === 'windup') {
      const k = this.t / c.windup;
      if (k > 0.55) {
        const p = g.player;
        ctx.globalAlpha = (k - 0.55) * 1.6;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.moveTo(this.cx + this.facing * 16, this.bottom - 27);
        ctx.lineTo(p.cx, p.cy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
  }
}

// ---------------------------------------------------------------- per-type silhouettes
// Local space: origin at feet, facing right. fillStyle is preset (black or white on flash).

function finish(ctx, flash) {
  ctx.fill();
  if (flash) { ctx.lineWidth = 3; ctx.stroke(); }
}
function limb(ctx, x1, y1, x2, y2, w) {
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function eye(ctx, x, y, w, h, flash) {
  const f = ctx.fillStyle;
  ctx.fillStyle = flash ? '#000' : '#fff';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = f;
}
function walkCycle(e, rate) {
  return Math.abs(e.vx) > 20 ? Math.sin(e.anim * rate) : 0;
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
  ctx.fillRect(-22, -32 + Math.max(0, s) * 3, 15, 32 - Math.max(0, s) * 3);
  ctx.fillRect(6, -32 + Math.max(0, -s) * 3, 15, 32 - Math.max(0, -s) * 3);
  if (flash) { ctx.lineWidth = 3; ctx.strokeRect(-22, -32, 15, 32); ctx.strokeRect(6, -32, 15, 32); }
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
    ctx.strokeStyle = flash ? '#000' : '#fff';
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
  ctx.strokeStyle = flash ? '#000' : '#fff';
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
