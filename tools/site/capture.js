// Screenshots and recorded demos for the website.
//   docs/img/shots/*.png     moments from the current version (docs/play/<CURRENT>)
//   docs/media/demo-<v>.webm a recorded demo of every version, played by a bot
//   docs/media/demo-<v>.jpg  its poster frame
// Needs Playwright + Chromium (PLAYWRIGHT / CHROMIUM env vars override paths).
//   node tools/site/capture.js [shots|demos] [version, to record one demo]
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const shotsDir = path.join(root, 'docs', 'img', 'shots');
const mediaDir = path.join(root, 'docs', 'media');
fs.mkdirSync(shotsDir, { recursive: true });
fs.mkdirSync(mediaDir, { recursive: true });
const launchOpts = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
const playUrl = (v, q) => 'file://' + path.join(root, 'docs', 'play', v, 'index.html') + (q ? '?' + q : '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CURRENT = '0.7.0';

// A bot that plays any version. Injected into the page; drives Input directly.
function installBot() {
  if (window.__bot) return;
  window.__bot = true;
  let dodge = 0, dodgeDir = 1;
  setInterval(() => {
    const g = window.SEEK, p = g && g.player;
    if (!p || typeof Input === 'undefined') return;
    const K = Input.keyDown;
    K.left = K.right = false; K.up = K.down = false; K.jump = false;
    if (g.state === 'PLAYER_DEAD' || g.state === 'START' || g.state === 'ENDING') { Input.anyPressed = true; return; }
    if (g.state === 'ADVANCE') { K.right = true; return; }
    if (g.state === 'DOOR') { K.right = p.cx < g.stage.door.x - 10; K.up = true; return; }
    const belt = p.z !== undefined;
    let best = null, bd = 1e9;
    for (const e of g.enemies) {
      if (!e.active || e.state === 'spawn' || e.dying || e.state === 'dead') continue;
      const d = Math.abs(e.cx - p.cx) + (belt ? Math.abs(e.z - p.z) * 2 : Math.abs(e.y - p.y) * 0.5);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) { if (!belt) K.right = Math.random() < 0.3; return; }
    const dx = best.cx - p.cx;
    if (!belt) {
      // 0.1.0: the side-view platformer
      if (Math.abs(dx) > 70) (dx > 0 ? K.right = true : K.left = true);
      else if ((dx > 0) !== (p.facing > 0)) (dx > 0 ? K.right = true : K.left = true);
      if (best.y < p.y - 60 && Math.abs(dx) < 140 && p.onGround) Input.pressed.jump = true;
      if (best.state === 'windup' && Math.abs(dx) < 150 && Math.random() < 0.3) Input.pressed.dash = true;
      if (Math.abs(dx) < 110 && Math.random() < 0.5) Input.pressed.attack = true;
      return;
    }
    const dz = best.z - p.z;
    const cls = p.cls ? p.cls.key : 'warrior';
    if (p.rage >= 100 && !(p.rageT > 0)) Input.pressed.rage = true;
    if (dodge > 0) { dodge -= 0.05; dodgeDir > 0 ? K.down = true : K.up = true; return; }
    for (const e of g.enemies) {
      if (e.active && e.state === 'windup' && Math.abs(e.z - p.z) < 20 && Math.abs(e.cx - p.cx) < 240 && Math.random() < 0.25) {
        dodge = 0.3; dodgeDir = p.z < 95 ? 1 : -1; return;
      }
    }
    if (cls === 'archer' && Math.abs(dx) > 140 && Math.abs(dx) < 430 && Math.abs(dz) < 12) {
      if ((dx > 0) !== (p.facing > 0)) (dx > 0 ? K.right = true : K.left = true);
      else if (Math.random() < 0.6) Input.pressed.attack = true;
      return;
    }
    if (cls === 'rogue' && Math.abs(dx) < 150 && Math.abs(dz) < 12 && Math.random() < 0.06) {
      Input.pressed.run = true; (dx > 0 ? K.right = true : K.left = true); Input.pressed.attack = true; return;
    }
    const tx = best.cx + (dx > 0 ? -1 : 1) * (cls === 'archer' ? 220 : 60);
    if (Math.abs(tx - p.cx) > 12) (tx > p.cx ? K.right = true : K.left = true);
    else if ((dx > 0) !== (p.facing > 0)) (dx > 0 ? K.right = true : K.left = true);
    if (Math.abs(dz) > 5) (dz > 0 ? K.down = true : K.up = true);
    if (Math.abs(dx) < 105 && Math.abs(dz) < 12) {
      // the warrior finishes its combos (sword wave); others mix it up
      if (cls === 'warrior' || Math.random() < 0.5) Input.pressed.attack = true;
    }
  }, 50);
}

async function startGame(page, classes) {
  await sleep(900);
  await page.keyboard.press('Enter');
  if (classes) { await sleep(500); await page.keyboard.press('Enter'); }
  await page.evaluate(installBot);
}

async function waitFor(page, fn, arg, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 30000)) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(40);
  }
  return false;
}

// ---------------------------------------------------------------- screenshots
async function shots(browser) {
  const shot = async (name, page) => { await page.screenshot({ path: path.join(shotsDir, name + '.png') }); console.log('  shot', name); };
  const open = async (q, opts) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, opts || {}));
    const page = await ctx.newPage();
    await page.goto(playUrl(CURRENT, q));
    return { ctx, page };
  };
  let s;

  s = await open('god');
  await sleep(1200); await shot('title', s.page);
  await s.page.keyboard.press('Enter'); await sleep(900); await shot('select', s.page);
  await s.ctx.close();

  s = await open('god&class=warrior&wave=3');
  await startGame(s.page, true);
  if (await waitFor(s.page, () => SwordWaves.pool.items.some((w) => w.active && w.dist > 90 && w.dist < 200), null, 60000)) await shot('warrior-wave', s.page);
  await s.ctx.close();

  s = await open('god&class=archer&wave=2');
  await startGame(s.page, true);
  if (await waitFor(s.page, () => Arrows.pool.items.some((a) => a.active && a.spec.fire && a.stuck <= 0 && a.t > 0.12), null, 60000)) await shot('archer-fire', s.page);
  await s.ctx.close();

  s = await open('god&class=rogue&wave=2');
  await startGame(s.page, true);
  if (await waitFor(s.page, () => SEEK.player.state === 'attack' && SEEK.player.atk.name === 'dash' && SEEK.player.atkPhase === 'active', null, 60000)) await shot('rogue-dash', s.page);
  if (await waitFor(s.page, () => SEEK.player.state === 'grab', null, 40000)) { await sleep(150); await shot('grab', s.page); }
  await s.ctx.close();

  // ledges, a power block and the arrow shower
  s = await open('god&class=archer&wave=1');
  await startGame(s.page, true);
  await waitFor(s.page, () => SEEK.state === 'WAVE', null, 10000);
  await s.page.evaluate(() => { SEEK.player.grantPower('power'); });
  await sleep(3000);
  // keep shooting until a shower is in the air
  if (await waitFor(s.page, () => { Input.pressed.attack = true; return Arrows.pool.items.filter((a) => a.active && a.stuck <= 0 && a.vy > 300).length >= 5; }, null, 30000)) { await sleep(60); await shot('powers', s.page); }
  await s.ctx.close();

  s = await open('god&class=warrior&wave=4');
  await startGame(s.page, true);
  await waitFor(s.page, () => SEEK.enemies.filter((e) => e.active && !e.dying && e.state !== 'spawn').length >= 3, null, 30000);
  await s.page.evaluate(() => { SEEK.player.pots = 6; Input.pressed.magic = true; });
  if (await waitFor(s.page, () => SEEK.magic && SEEK.magic.t > MAGIC_CFG.strikeAt + 0.2, null, 5000)) await shot('magic', s.page);
  await s.ctx.close();

  for (const [name, wave, wait] of [['ruins', 5, 6000], ['fortress', 9, 7000], ['final', 10, 8000]]) {
    s = await open('god&class=' + (name === 'ruins' ? 'rogue' : name === 'final' ? 'archer' : 'warrior') + '&wave=' + wave);
    await startGame(s.page, true);
    await sleep(wait);
    await shot(name, s.page);
    await s.ctx.close();
  }

  s = await open('god&debug&class=archer&wave=3');
  await startGame(s.page, true);
  await waitFor(s.page, () => SEEK.state === 'WAVE', null, 10000);
  await s.page.keyboard.press('KeyN');
  if (await waitFor(s.page, () => SEEK.state === 'REST' && SEEK.stateT > 4, null, 20000)) await shot('night', s.page);
  await s.ctx.close();

  s = await open('god&debug&class=warrior&wave=10');
  await startGame(s.page, true);
  await waitFor(s.page, () => SEEK.state === 'FINAL_WAVE', null, 10000);
  await s.page.keyboard.press('KeyN');
  if (await waitFor(s.page, () => SEEK.state === 'DOOR' && SEEK.doorOpen > 0.45, null, 90000)) await shot('door', s.page);
  if (await waitFor(s.page, () => SEEK.state === 'ENDING' && SEEK.stateT > 6.5, null, 60000)) await shot('ending', s.page);
  await s.ctx.close();

  // phone, landscape, touch controls showing
  s = await open('god&class=rogue', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(900);
  await s.page.touchscreen.tap(420, 200); await sleep(400);
  await s.page.touchscreen.tap(640, 200); await sleep(250); await s.page.touchscreen.tap(640, 200);
  await s.page.evaluate(installBot);
  await sleep(6000);
  await shot('mobile', s.page);
  await s.ctx.close();
}

// ---------------------------------------------------------------- demos
const DEMOS = [
  { v: '0.1.0', q: 'god&wave=3', classes: false },
  { v: '0.2.0', q: 'god&wave=1', classes: false },
  { v: '0.2.1', q: 'god&wave=5', classes: false },
  { v: '0.3.0', q: 'god&wave=8', classes: false },
  { v: '0.4.0', q: 'god&wave=6', classes: false },
  { v: '0.5.0', q: 'god&class=archer&wave=4', classes: true },
  { v: '0.6.0', q: 'god&class=warrior&wave=7', classes: true },
  { v: '0.6.0-mobile', play: '0.6.0', q: 'god&class=rogue&wave=2', classes: true, mobile: true },
  // with the arrow shower from a power block, then rage
  { v: '0.7.0', q: 'god&class=archer&wave=4', classes: true, setup: () => { SEEK.player.grantPower('power'); setTimeout(() => { SEEK.player.rage = 100; }, 9000); } },
];

async function demo(browser, d) {
  const tmp = path.join(mediaDir, '.rec-' + d.v);
  fs.rmSync(tmp, { recursive: true, force: true });
  const size = d.mobile ? { width: 844, height: 390 } : { width: 960, height: 540 };
  const ctx = await browser.newContext(Object.assign({ viewport: size, recordVideo: { dir: tmp, size } },
    d.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}));
  const page = await ctx.newPage();
  await page.goto(playUrl(d.play || d.v, d.q));
  if (d.mobile) {
    await sleep(900);
    await page.touchscreen.tap(420, 200); await sleep(700);
    await page.touchscreen.tap(640, 200); await sleep(300); await page.touchscreen.tap(640, 200);
    await page.evaluate(installBot);
  } else await startGame(page, d.classes);
  if (d.setup) {
    await waitFor(page, () => SEEK.state === 'WAVE', null, 10000);
    await page.evaluate(d.setup);
  }
  await sleep(14000);
  await page.screenshot({ path: path.join(mediaDir, 'demo-' + d.v + '.jpg'), type: 'jpeg', quality: 80 });
  await sleep(14000);
  const video = page.video();
  await ctx.close();
  fs.renameSync(await video.path(), path.join(mediaDir, 'demo-' + d.v + '.webm'));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('  demo', d.v);
}

(async () => {
  const what = process.argv[2] || 'all';
  const browser = await chromium.launch(launchOpts);
  if (what === 'all' || what === 'shots') await shots(browser);
  if (what === 'all' || what === 'demos') {
    // three at a time
    const list = process.argv[3] ? DEMOS.filter((d) => d.v === process.argv[3]) : DEMOS;
    for (let i = 0; i < list.length; i += 3) await Promise.all(list.slice(i, i + 3).map((d) => demo(browser, d)));
  }
  await browser.close();
})();
