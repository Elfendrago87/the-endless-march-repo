'use strict';
// Data-driven wave manager. Reads WAVES (data.js) and asks the game to spawn.
// Completion rule: spawned === required AND alive === 0.

class WaveManager {
  constructor(game) {
    this.g = game;
    this.queue = [];
    this.index = 0;
    this.def = null;
    this.required = 0; this.spawned = 0; this.alive = 0; this.defeated = 0;
  }

  start(index) {
    this.index = index;
    this.def = WAVES[index];
    this.required = 0;
    for (const phase of this.def.phases) for (const [, n] of phase) this.required += n;
    this.spawned = 0;
    this.alive = 0;
    this.defeated = 0;
    this.phase = -1;
    this.queue.length = 0;
    this.nextPhase();
  }

  // Interleave a phase's groups round-robin so types arrive mixed.
  nextPhase() {
    this.phase++;
    const groups = this.def.phases[this.phase].map(([type, n]) => ({ type, n }));
    let left = true;
    while (left) {
      left = false;
      for (const gr of groups) {
        if (gr.n > 0) { this.queue.push(gr.type); gr.n--; left = true; }
      }
    }
    this.timer = this.phase === 0 ? 0.4 : (this.def.phaseDelay || 1.0);
  }

  update(dt) {
    if (!this.def) return;
    if (this.queue.length === 0) {
      if (this.phase < this.def.phases.length - 1 && this.alive <= (this.def.advanceAt || 0)) this.nextPhase();
      return;
    }
    this.timer -= dt;
    if (this.timer > 0 || this.alive >= this.def.maxAlive) return;
    const type = this.queue[0];
    if (this.g.spawnWaveEnemy(type)) {
      this.queue.shift();
      this.spawned++;
      this.alive++;
      this.timer = this.def.interval;
    }
  }

  // Enemies created mid-wave (splitter halves) join the accounting.
  addExtra(n) { this.required += n; this.spawned += n; this.alive += n; }
  onDefeated() { this.alive--; this.defeated++; }

  get remaining() { return this.required - this.defeated; }
  get complete() { return !!this.def && this.spawned === this.required && this.alive === 0; }
}
