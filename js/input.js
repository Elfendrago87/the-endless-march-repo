'use strict';
// Keyboard / mouse / gamepad input mapped to abstract actions.
// `pressed` and `released` are edge flags consumed once per fixed update step.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
  KeyX: 'attack', KeyJ: 'attack',
  KeyF: 'back', KeyU: 'back',
  ShiftLeft: 'run', ShiftRight: 'run', KeyC: 'run',
  KeyV: 'magic', KeyQ: 'magic', KeyL: 'magic',
  KeyR: 'rage', KeyE: 'rage', KeyI: 'rage',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm',
};

const PAD_BUTTONS = { 0: 'jump', 2: 'attack', 1: 'back', 3: 'magic', 4: 'rage', 6: 'rage', 5: 'run', 7: 'run', 9: 'pause', 12: 'up', 13: 'down' };

const Input = {
  keyDown: {}, padDown: {}, pressed: {}, released: {},
  anyPressed: false, // any key/button this step (menus)
  padAxis: 0, padAxisZ: 0,
  lastTap: { left: -1, right: -1 }, doubleTap: 0, // set to -1/1 on a double tap

  init(target) {
    this._held = {}; // physical keys, so two bindings for one action behave
    window.addEventListener('keydown', (e) => {
      this._held[e.code] = true;
      Sound.init();
      const a = KEYMAP[e.code];
      if (a) e.preventDefault();
      if (e.repeat) return;
      if (a) {
        if (!this.keyDown[a]) { this.pressed[a] = true; this.tap(a); }
        this.keyDown[a] = true;
      }
      if (a !== 'pause') this.anyPressed = true;
      if (this.onRawKey) this.onRawKey(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this._held[e.code] = false;
      const a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      // Only release when no other key bound to the same action is held.
      let still = false;
      for (const code in this._held) if (this._held[code] && KEYMAP[code] === a) still = true;
      if (!still) {
        if (this.keyDown[a]) this.released[a] = true;
        this.keyDown[a] = false;
      }
    });

    target.addEventListener('mousedown', (e) => {
      Sound.init();
      e.preventDefault();
      const a = e.button === 2 ? 'back' : 'attack';
      this.pressed[a] = true;
      this.anyPressed = true;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('blur', () => {
      this.keyDown = {};
      this._held = {};
    });
  },

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    let pad = null;
    if (pads) for (let i = 0; i < pads.length; i++) if (pads[i]) { pad = pads[i]; break; }
    if (!pad) { this.padAxis = 0; this.padAxisZ = 0; this.padDown = {}; return; }
    let ax = pad.axes[0] || 0;
    if (Math.abs(ax) < 0.3) ax = 0;
    if (pad.buttons[14] && pad.buttons[14].pressed) ax = -1;
    if (pad.buttons[15] && pad.buttons[15].pressed) ax = 1;
    const prevAx = this.padAxis;
    this.padAxis = sign(ax);
    if (this.padAxis !== 0 && this.padAxis !== prevAx) this.tap(this.padAxis > 0 ? 'right' : 'left');
    const az = pad.axes[1] || 0;
    this.padAxisZ = Math.abs(az) < 0.35 ? 0 : sign(az);
    const now = {};
    for (const idx in PAD_BUTTONS) {
      const b = pad.buttons[idx];
      if (b && b.pressed) now[PAD_BUTTONS[idx]] = true;
    }
    for (const a in now) if (!this.padDown[a]) {
      this.pressed[a] = true;
      if (a !== 'pause') this.anyPressed = true;
      Sound.init();
    }
    for (const a in this.padDown) if (!now[a]) this.released[a] = true;
    this.padDown = now;
  },

  isDown(a) { return !!(this.keyDown[a] || this.padDown[a]); },

  // Double-tapping a direction starts a run.
  tap(a) {
    if (a !== 'left' && a !== 'right') return;
    const now = performance.now() / 1000;
    if (now - this.lastTap[a] < PLAYER_CFG.doubleTap) this.doubleTap = a === 'right' ? 1 : -1;
    this.lastTap[a] = now;
  },

  axisZ() {
    const k = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    if (k !== 0) return k;
    return this.padAxisZ;
  },

  axisX() {
    const k = (this.keyDown.right ? 1 : 0) - (this.keyDown.left ? 1 : 0);
    if (k !== 0) return k;
    return this.padAxis;
  },

  endStep() {
    for (const k in this.pressed) this.pressed[k] = false;
    for (const k in this.released) this.released[k] = false;
    this.anyPressed = false;
    this.doubleTap = 0;
  },
};
