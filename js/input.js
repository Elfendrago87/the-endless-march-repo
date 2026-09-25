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
  // touch: a floating stick on the left half, buttons on the right
  touchMode: false, touchAxisX: 0, touchAxisZ: 0, touchRun: false,
  stick: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
  touchButtons: {}, // touch id -> action
  toView: null,     // set by the game: client px -> view coords
  onTap: null,      // set by the game: menu taps
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

    const opts = { passive: false };
    target.addEventListener('touchstart', (e) => this.touchStart(e), opts);
    target.addEventListener('touchmove', (e) => this.touchMove(e), opts);
    target.addEventListener('touchend', (e) => this.touchEnd(e), opts);
    target.addEventListener('touchcancel', (e) => this.touchEnd(e), opts);
    window.addEventListener('blur', () => {
      this.keyDown = {};
      this._held = {};
    });
  },

  // ---------------------------------------------------------------- touch
  touchStart(e) {
    e.preventDefault();
    Sound.init();
    this.touchMode = true;
    for (const t of e.changedTouches) {
      const v = this.toView ? this.toView(t.clientX, t.clientY) : { x: t.clientX, y: t.clientY };
      this.anyPressed = true;
      if (this.onTap) this.onTap(v.x, v.y);
      const btn = TouchLayout.hit(v.x, v.y);
      if (btn) {
        this.touchButtons[t.identifier] = btn;
        if (!this.keyDown[btn]) { this.pressed[btn] = true; }
        this.keyDown[btn] = true;
      } else if (v.x < VIEW_W * 0.5 && this.stick.id === null) {
        const s = this.stick;
        s.id = t.identifier; s.ox = v.x; s.oy = v.y; s.x = v.x; s.y = v.y;
      }
    }
  },

  touchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== this.stick.id) continue;
      const v = this.toView ? this.toView(t.clientX, t.clientY) : { x: t.clientX, y: t.clientY };
      const s = this.stick, R = TouchLayout.stickR;
      let dx = v.x - s.ox, dy = v.y - s.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      s.x = s.ox + dx; s.y = s.oy + dy;
      const px = this.touchAxisX;
      this.touchAxisX = Math.abs(dx) > R * 0.3 ? sign(dx) : 0;
      this.touchAxisZ = Math.abs(dy) > R * 0.35 ? sign(dy) : 0;
      if (this.touchAxisX !== 0 && this.touchAxisX !== px) this.tap(this.touchAxisX > 0 ? 'right' : 'left');
      // pushing the stick to its rim runs
      this.touchRun = Math.abs(dx) > R * 0.9;
    }
  },

  touchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.stick.id) {
        this.stick.id = null;
        this.touchAxisX = 0; this.touchAxisZ = 0; this.touchRun = false;
      }
      const btn = this.touchButtons[t.identifier];
      if (btn) {
        delete this.touchButtons[t.identifier];
        let still = false;
        for (const id in this.touchButtons) if (this.touchButtons[id] === btn) still = true;
        if (!still) { this.keyDown[btn] = false; this.released[btn] = true; }
      }
    }
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
    return this.touchAxisZ || this.padAxisZ;
  },

  axisX() {
    const k = (this.keyDown.right ? 1 : 0) - (this.keyDown.left ? 1 : 0);
    if (k !== 0) return k;
    return this.touchAxisX || this.padAxis;
  },

  endStep() {
    for (const k in this.pressed) this.pressed[k] = false;
    for (const k in this.released) this.released[k] = false;
    this.anyPressed = false;
    this.doubleTap = 0;
  },
};

// On-screen touch controls, in view coordinates (1280 x 720).
const TouchLayout = {
  stickR: 80,
  buttons: [
    { action: 'attack', label: 'ATTACK', x: 1112, y: 594, r: 64 },
    { action: 'jump', label: 'JUMP', x: 980, y: 648, r: 46 },
    { action: 'back', label: 'BACK', x: 1214, y: 472, r: 40 },
    { action: 'run', label: 'RUN', x: 986, y: 526, r: 40 },
    { action: 'magic', label: 'MAGIC', x: 1108, y: 446, r: 40 },
    { action: 'pause', label: 'II', x: 1236, y: 44, r: 26 },
    { action: 'rage', label: 'RAGE', x: 1214, y: 346, r: 40, only: 'rageReady' }, // shown when the meter is full
  ],
  rageReady: false,
  shown(b) { return !b.only || this[b.only]; },
  hit(x, y) {
    if (!Input.buttonsLive) return null;
    for (const b of this.buttons) if (this.shown(b) && Math.hypot(x - b.x, y - b.y) <= b.r + 10) return b.action;
    return null;
  },
};
