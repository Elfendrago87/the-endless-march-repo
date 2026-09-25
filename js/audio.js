'use strict';
// Procedural WebAudio sound. No asset files. Everything is short, dry and low.

const Sound = {
  ctx: null, out: null, noise: null, drone: null,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      comp.connect(ctx.destination);
      this.out = ctx.createGain();
      this.out.gain.value = 0.5;
      this.out.connect(comp);
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.ctx = ctx;
    } catch (e) {
      this.ctx = null;
    }
  },

  _env(g, t, attack, decay, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  },

  tone(f0, f1, dur, type, vol) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this._env(g, t, 0.005, dur, vol);
    o.connect(g);
    g.connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  hiss(dur, vol, freq, q, type, freqEnd) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.Q.value = q || 1;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    this._env(g, t, 0.01, dur, vol);
    src.connect(f);
    f.connect(g);
    g.connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  },

  swing(heavy) { heavy ? this.hiss(0.24, 0.4, 1100, 0.9, 'bandpass', 260) : this.hiss(0.13, 0.26, 1800, 0.9, 'bandpass', 700); },
  hit(heavy) {
    this.tone(heavy ? 95 : 150, 38, heavy ? 0.28 : 0.14, 'sine', heavy ? 0.9 : 0.55);
    this.hiss(heavy ? 0.14 : 0.07, heavy ? 0.5 : 0.35, 2600, 0.7, 'highpass');
  },
  block() { this.tone(1900, 1300, 0.12, 'square', 0.07); this.tone(2600, 2000, 0.1, 'triangle', 0.1); },
  parry() { this.tone(1400, 2200, 0.1, 'triangle', 0.15); },
  hurt() { this.tone(230, 70, 0.3, 'sawtooth', 0.16); this.hiss(0.18, 0.35, 700, 1, 'lowpass'); },
  dash() { this.hiss(0.18, 0.22, 500, 0.6, 'bandpass', 2600); },
  jump() { this.tone(240, 380, 0.08, 'sine', 0.07); },
  land() { this.hiss(0.06, 0.12, 400, 1, 'lowpass'); },
  enemyDie(big) {
    this.tone(big ? 110 : 280, big ? 28 : 60, big ? 0.55 : 0.25, 'triangle', 0.3);
    this.hiss(big ? 0.4 : 0.22, 0.3, 1200, 0.5, 'bandpass', 180);
  },
  shoot() { this.tone(620, 280, 0.12, 'square', 0.05); },
  windup() { this.tone(90, 150, 0.35, 'sawtooth', 0.05); },
  whisper() { this.hiss(0.3, 0.12, 3200, 3, 'bandpass', 5200); },
  slam() { this.tone(72, 28, 0.45, 'sine', 0.9); this.hiss(0.35, 0.45, 320, 0.7, 'lowpass'); },
  spawn() { this.hiss(0.45, 0.06, 900, 2, 'bandpass', 180); },
  waveStart(final) {
    this.tone(final ? 55 : 110, final ? 55 : 110, 1.0, 'sine', 0.22);
    this.tone(final ? 82 : 165, final ? 82 : 165, 1.0, 'sine', 0.1);
  },
  waveClear() { this.tone(220, 220, 0.6, 'sine', 0.14); this.tone(330, 330, 0.9, 'sine', 0.1); },
  death() { this.tone(200, 36, 1.4, 'sawtooth', 0.18); this.hiss(1.0, 0.2, 400, 0.6, 'lowpass', 80); },
  rumble() { this.hiss(0.5, 0.25, 120, 0.8, 'lowpass'); },
  bowDraw() { this.hiss(0.12, 0.05, 2400, 4, 'bandpass', 1200); },
  bow(fire) {
    this.tone(180, 90, 0.12, 'triangle', 0.18);
    this.hiss(0.1, 0.22, 3000, 1.2, 'highpass');
    if (fire) this.hiss(0.5, 0.25, 700, 0.6, 'lowpass', 2400);
  },
  wave() { this.hiss(0.45, 0.35, 400, 0.8, 'bandpass', 1800); this.tone(140, 60, 0.35, 'sine', 0.25); },
  burn() { this.hiss(0.18, 0.1, 900, 0.7, 'bandpass', 400); },
  grab() { this.hiss(0.08, 0.3, 300, 1, 'lowpass'); this.tone(120, 80, 0.1, 'sine', 0.3); },
  pickup() { this.tone(880, 1320, 0.09, 'triangle', 0.09); this.tone(1320, 1760, 0.12, 'triangle', 0.06); },
  magic(level) {
    this.tone(60, 60 + level * 40, 0.75, 'sawtooth', 0.12);
    this.hiss(0.75, 0.15, 400, 2, 'bandpass', 3000 + level * 800);
  },
  chime() { this.tone(523, 523, 2.5, 'sine', 0.08); this.tone(784, 784, 3, 'sine', 0.04); },

  // Continuous drone for the door sequence; level 0..1.
  droneStart() {
    const ctx = this.ctx;
    if (!ctx || this.drone) return;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 200;
    f.connect(g);
    g.connect(this.out);
    const oscs = [];
    const freqs = [55, 110.3, 164.8, 220.7];
    for (let i = 0; i < freqs.length; i++) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = freqs[i];
      o.connect(f);
      o.start();
      oscs.push(o);
    }
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0.15;
    n.connect(ng);
    ng.connect(f);
    n.start();
    this.drone = { g, f, oscs, n };
  },
  droneSet(level) {
    if (!this.drone) return;
    const t = this.ctx.currentTime;
    this.drone.g.gain.setTargetAtTime(0.0001 + level * 0.55, t, 0.15);
    this.drone.f.frequency.setTargetAtTime(160 + level * level * 7000, t, 0.2);
  },
  droneStop(fade) {
    if (!this.drone) return;
    const d = this.drone;
    this.drone = null;
    const t = this.ctx.currentTime;
    d.g.gain.cancelScheduledValues(t);
    d.g.gain.setValueAtTime(Math.max(0.0001, d.g.gain.value), t);
    d.g.gain.exponentialRampToValueAtTime(0.0001, t + (fade || 0.05));
    const stopAt = t + (fade || 0.05) + 0.1;
    for (const o of d.oscs) o.stop(stopAt);
    d.n.stop(stopAt);
  },
};
