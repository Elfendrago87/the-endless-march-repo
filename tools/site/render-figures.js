// Renders the game's own drawings (classes, enemies, pickups, scenery) to PNGs
// for the website, using the current game code. Needs Playwright + Chromium.
//   node tools/site/render-figures.js
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const out = path.join(root, 'docs', 'img', 'figures');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(500);
  const shots = await page.evaluate(() => {
    const result = {};
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    const snap = (name, w, h, scale, draw) => {
      cv.width = w * scale; cv.height = h * scale;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      draw(ctx);
      result[name] = cv.toDataURL('image/png');
    };
    // classes
    const pose = (weapon, sword, extra) => Object.assign({ x: 0, y: 0, facing: 1, legA: 0.25, legB: -0.25, lean: 0, sx: 1, sy: 1, cloak: 0.3, time: 0.7, weapon, sword, draw: 0, fire: false }, extra || {});
    snap('class-warrior', 120, 160, 4, (c) => { c.translate(78, 150); drawFigure(c, pose('sword', -2.2), true); });
    snap('class-archer', 120, 90, 4, (c) => { c.translate(44, 80); drawFigure(c, pose('bow', -0.05, { draw: 0.9, fire: true }), true); });
    snap('class-rogue', 110, 90, 4, (c) => { c.translate(44, 80); drawFigure(c, pose('daggers', -0.6, { sword2: 0.9, lean: 0.1 }), true); });
    // enemies, posed in their windups
    const types = ['seeker', 'chaser', 'brute', 'ranged', 'flyer', 'splitter', 'shielder', 'assassin', 'elite', 'thief'];
    const fn = { seeker: drawSeeker, chaser: drawChaser, brute: drawBrute, ranged: drawRanged, flyer: drawFlyer, splitter: (c, e, f, t) => drawSplitter(c, e, f, t, 1), shielder: drawShielder, assassin: drawAssassin, elite: drawElite, thief: drawThief };
    for (const t of types) {
      const e = new Enemy().reset(t, 0, 0, {});
      e.state = t === 'thief' ? 'run' : 'windup'; e.t = 0.25; e.anim = 0.4; e.vx = 60; e.vz = 0; e.onGround = true; e.shieldUp = true;
      if (t === 'elite') { e.state = 'approach'; }
      const big = t === 'brute' || t === 'elite';
      const h = big ? 180 : t === 'flyer' ? 70 : 100;
      snap('enemy-' + t, big ? 170 : 110, h, 3, (c) => { c.translate(big ? 85 : 55, h - 8); fn[t](c, e, false, t === 'thief' ? 0 : (t === 'elite' ? 0.25 : 0.5)); });
    }
    // pickups: place one pool item where Items.draw will put it, draw, put it back
    const item = (kind) => (c) => {
      const it = Items.pool.items[0];
      Object.assign(it, { active: true, kind, x: 20, z: 34 - FLOOR_Y, y: 0, vx: 0, vy: 0, t: 1 });
      Items.draw(c);
      it.active = false;
    };
    snap('item-pot', 40, 40, 3, item('pot'));
    snap('item-bread', 40, 40, 3, item('food'));
    // arrows and flames
    snap('arrow', 80, 30, 4, (c) => drawArrowShape(c, 6, 16, 70, 16, false));
    snap('arrow-fire', 80, 34, 4, (c) => drawArrowShape(c, 6, 22, 70, 22, true, 0.3));
    snap('flames', 50, 40, 4, (c) => drawFlames(c, 25, 36, 0.8, 8, 3));
    return result;
  });
  for (const [name, url] of Object.entries(shots)) {
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('wrote', Object.keys(shots).length, 'figures to docs/img/figures');
  await browser.close();
})();
