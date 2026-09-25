'use strict';
// Keyboard / mouse / gamepad input mapped to abstract actions.
// `pressed` and `released` are edge flags consumed once per fixed update step.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
  KeyX: 'attack', KeyJ: 'attack',
  ShiftLeft: 'dash', ShiftRight: 'dash', KeyC: 'dash', KeyL: 'dash',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm',
};

const PAD_BUTTONS = { 0: 'jump', 2: 'attack', 1: 'dash', 5: 'dash', 7: 'dash', 9: 'pause', 12: 'jump', 13: 'down' };

const Input = {
  keyDown: {}, padDown: {}, pressed: {}, released: {},
  anyPressed: false, // any key/button this step (menus)
  padAxis: 0,

  init(target) {
    this._held = {}; // physical keys, so two bindings for one action behave
    window.addEventListener('keydown', (e) => {
      this._held[e.code] = true;
      Sound.init();
      const a = KEYMAP[e.code];
      if (a) e.preventDefault();
      if (e.repeat) return;
      if (a) {
        if (!this.keyDown[a]) this.pressed[a] = true;
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
      const a = e.button === 2 ? 'dash' : 'attack';
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
    if (!pad) { this.padAxis = 0; this.padDown = {}; return; }
    let ax = pad.axes[0] || 0;
    if (Math.abs(ax) < 0.3) ax = 0;
    if (pad.buttons[14] && pad.buttons[14].pressed) ax = -1;
    if (pad.buttons[15] && pad.buttons[15].pressed) ax = 1;
    this.padAxis = sign(ax);
    const now = {};
    for (const idx in PAD_BUTTONS) {
      const b = pad.buttons[idx];
      if (b && b.pressed) now[PAD_BUTTONS[idx]] = true;
    }
    if ((pad.axes[1] || 0) > 0.6) now.down = true;
    for (const a in now) if (!this.padDown[a]) {
      this.pressed[a] = true;
      if (a !== 'pause') this.anyPressed = true;
      Sound.init();
    }
    for (const a in this.padDown) if (!now[a]) this.released[a] = true;
    this.padDown = now;
  },

  isDown(a) { return !!(this.keyDown[a] || this.padDown[a]); },

  axisX() {
    const k = (this.keyDown.right ? 1 : 0) - (this.keyDown.left ? 1 : 0);
    return k !== 0 ? k : this.padAxis;
  },

  endStep() {
    for (const k in this.pressed) this.pressed[k] = false;
    for (const k in this.released) this.released[k] = false;
    this.anyPressed = false;
  },
};
