# The Endless March: Journey to the End

A minimalist black-and-white belt-scroller in the spirit of Golden Axe, without the mounts.

An outlined figure with an enormous sword walks a long white road and fights ten waves along the way. Everything with a body (the hero, the enemies, their weapons, the ruins and fortresses on the horizon) is drawn as a white shape with a black outline. After Wave 10, a monolith rises at the end of the road and its door opens onto blinding white light. What it means is up to the player.

**Website:** the `docs/` folder is a GitHub Pages site with the full guide, art notes, the planned story mode, the changelog, the Windows download of every version, and a recorded demo of each. See [Publishing the site](#publishing-the-site).

## Play

The current version is **0.8.0**. The game is made for Windows. See [CHANGELOG.md](CHANGELOG.md) for every version. Every version is also published on the repository's **Releases** page with its builds attached (by `.github/workflows/releases.yml`, from the list in `tools/releases.txt`).

Play with the keyboard, the mouse or a gamepad.

### Windows

Download **The-Endless-March.exe** (in `dist/`, or from the Releases page) and double-click it. That one file is the whole game: there's nothing to unzip or install.

The executable serves the game (built into it) on 127.0.0.1 and opens it in its own window: Microsoft Edge (built into Windows 10 and 11) in app mode, or Chrome if Edge is missing, or your default browser as a last resort. Closing the window closes the program, and F11 toggles fullscreen.

The executable isn't code-signed, so Windows SmartScreen may warn about it the first time. Choose **More info → Run anyway**.

The launcher's source is in `desktop/`, a small Go program. To rebuild `dist/The-Endless-March.exe` (needs Go 1.24+ and Node; it builds from Linux, macOS or Windows):

```sh
./tools/build-exe.sh
```

### Developing

The game itself is plain JavaScript drawn on a canvas (`index.html` and `js/`), with no build step. While working on it, open `index.html` in Chromium or Edge (or serve the folder with `python3 -m http.server`) and use the debug URL flags below; `./tools/build-exe.sh` packages it into the Windows launcher.

## Classes

After the title screen you choose one of three paths. If you die, the run restarts with the same class.

**The lane rule:** you only hit what shares your lane. Every sword slash, arrow and dagger cut keeps to the lane you stand in, so step up or down to line up. The one exception is the Warrior's **sword wave**: the third slash of the combo sends a crescent of force rolling forward across the whole road, hitting anything on the ground it passes, in every lane. (Magic also strikes the whole screen.)

| | Warrior | Archer | Rogue |
|---|---|---|---|
| HP | 100 | 90 | 85 |
| Weapon | the enormous sword | a bow | twin daggers |
| Combo | three slashes; the last knocks down and releases a **sword wave** that crosses every lane | two arrows, then a **fire arrow** that pierces, knocks down and sets enemies burning | two **twin strikes** (two cuts per press), then a cross cut that knocks down |
| Running attack | shoulder-first lunge | skid and loose a heavy piercing shot down your lane | **dash twin strike**: lunge through the enemy line, cutting twice, untouchable while it lasts |
| In the air | downward slash | an arrow angled down at the floor | dagger dive |
| Back attack | full sword spin | bow sweep | blade spin |
| Special | the sword wave | the bow tilts up at an enemy in the air, if it is in your lane | Shift/C is an **evasive dash** in any direction (up and down too) with brief invulnerability; attack out of it for the dash twin strike |

Arrows fly down the lane you stand in, stick in the ground where they land, and glance off a raised shield. A burning enemy takes 4 damage every half second for about two seconds. All three classes can grab and throw, back attack, and cast magic.

## Controls

| Action | Keyboard | Mouse / Gamepad |
|---|---|---|
| Move (up/down walks into and out of the screen) | arrows / WASD | stick / d-pad |
| Run | double-tap ← or →, or hold Shift / C (Warrior, Archer) | double-tap, or hold RB |
| Dash (Rogue only; you can't be hit while dashing) | Shift / C, in any direction | RB |
| Jump | Space / Z / K | A |
| Attack (repeat for a three-hit combo) | X / J | left click / X |
| Back attack (hits both sides) | F / U, or Jump + Attack together | right click / B |
| Magic | V / Q / L | Y |
| Rage (when the meter is full) | R / E / I | LB / LT |
| Fly (Rogue, with the flight power) | hold Jump in the air | hold A |
| Pause | P / Esc | Start |
| Mute | M | |

## How it plays

- **The road.** The screen locks when a wave begins. Enemies walk in from both edges or rise out of the ground. When the wave is cleared, **GO →** appears and you walk on to the next one.
- **Lanes.** Attacks only land when you and your target share a lane; only the Warrior's sword wave crosses lanes. Line up to hit, and step up or down out of a lane to dodge thrown axes, lunges and dashes.
- **Combos.** Every class has a three-part combo whose last hit knocks enemies to the floor. The Warrior's sword does 15, 18, then 28 damage.
- **Running attack.** Attack while running for a knockdown lunge that carries your momentum.
- **Jump attack.** A slash in the air that knocks enemies down.
- **Back attack.** A full spin that clears both sides. Use it when you're surrounded.
- **Grab and throw.** Attack an enemy that is right in front of you to grab it. Keep attacking to knee it twice and then throw it over your shoulder. A thrown body knocks down anyone it hits.
- **Knockdowns.** Heavy hits, or three hits in a row, put you on the floor. You're invulnerable while you're down and while you get back up.
- **Magic pots.** Small thieves carrying sacks wander through some waves. Hit them to knock loose pots and bread. Magic spends every pot you carry at once. More pots make a bigger eruption of black spikes, which hits every enemy on screen.
- **Rest.** After waves 3 and 6, night falls and the world inverts. Thieves come for your sack, so hit them for pots. You recover some health at dawn.
- **Lives.** You have 3 lives and 100 HP each. Falling spends a life and you stand back up where you fell, knocking back anyone nearby. When the last life is gone, the run starts over at Wave 1.
- **Ledges.** Raised platforms stand along the road, some of them moving. Jump up through one from below and land on top; a moving ledge carries you with it. Enemies climb up after you (flyers stay in the air). Arrows stick in ledges.
- **Power blocks.** Floating blocks marked with a star. Jump into one from below, strike it with a sword or dagger, or shoot it, and it pops out what it holds. There are 13 along the road, and they refill every run. Enemies sometimes drop powerups too (the big ones always do).
- **Powerups.** A **heart** heals 40 HP. The **force field** (hexagon) absorbs the next 3 hits within 16 seconds. The **rage burst** (spiked star) fills the rage meter. The **capsule** gives your class its own power: the Warrior's strikes hit **every lane** for 12 seconds; the Archer's shots bring an **arrow shower** down across every lane for 12 seconds; the Rogue gets 6 seconds of **flight** (hold Jump in the air) to use within 25 seconds.
- **Rage.** The rage meter fills as you land hits, make kills and take damage. When it is full, press R to rage for 8 seconds: 1.5× damage, faster movement, a third less damage taken, and nothing staggers or knocks you down.
- **Health bars.** An enemy's health shows above it for a moment after you hit it; the Brute and the Elite get a bar at the bottom of the screen. A hit counter at the top right counts your chain until you're hurt or stop hitting for two seconds.
- **Parry.** A sword swing that's active when it touches a thrown axe cuts the axe out of the air.

## Enemies

| Enemy | HP | What it does |
|---|---|---|
| Seeker | 30 | Walks up and claws. The basic source of pressure. |
| Chaser | 20 | Circles you, lines up, crouches, then lunges down its lane. |
| Brute | 100 | Slow and can't be staggered. The dashed floor box shows where its slam will land. Knocks you down. |
| Ranged | 25 | Keeps its distance, lines up its lane (shown as a dotted floor line), then throws an axe. |
| Flyer | 30 | Hovers overhead, marks its landing spot on the floor, then dives. Stuck on the ground for a moment afterwards. |
| Splitter | 40 | Splits into two fast Splitlings when it dies. |
| Shielder | 60 | Blocks every frontal hit and turns slowly. Walk around it, attack from above, or punish its bash. |
| Assassin | 35 | Fades almost to nothing, drifts behind you, then reappears and strikes. Its faint trail gives it away. |
| Elite | 170 | Throws an axe volley fanned across the floor, makes a dashing slash, and slams on both sides. Attacks faster below half health. |
| Thief | – | Harmless. Carries pots and bread. |

Enemies take turns: only a few can wind up an attack at the same time, and the rest circle, waiting for an opening. Every dangerous attack has a telegraph: the enemy shakes and a ring collapses onto it. Then comes the attack, then a recovery you can punish.

## Code layout

```
index.html          canvas + script tags
js/util.js          math, AABB helpers, object Pool, the outline drawing kit
js/data.js          ALL tuning: player feel, the three classes and their attacks, grab/magic, enemies, stage, the 10 waves
js/audio.js         procedural WebAudio sounds + the door drone
js/input.js         keyboard / mouse / gamepad mapped to actions (double-tap run)
js/world.js         Stage (parallax horizon, floor, foreground), ledges and power blocks, belt-scroller movement
js/fx.js            pooled particles, slashes, rings, screen shake
js/player.js        classes, movement, run/dash, combos, arrows, grab/knee/throw, magic, knockdown, lives, drawing
js/enemies.js       Enemy class: per-archetype behaviour on the floor plane + outlined figures
js/projectiles.js   pooled enemy axes (parryable), the Archer's arrows (fire, pierce, burn) and item and powerup pickups
js/waves.js         data-driven WaveManager (required / spawned / alive / defeated)
js/game.js          game states, camera locks, spawning, hits, blocks, rage, magic, rest, door, HUD, ending
```

Coordinates: every actor has `x`, a depth `z` (0 is the horizon and `DEPTH` is the front edge), and an elevation. A hit needs the boxes to overlap in x and elevation, and the two actors to be within the attack's depth tolerance.

Game states: `START → WAVE_INTRO → WAVE → WAVE_COMPLETE → (REST) → ADVANCE → … → FINAL_WAVE → DOOR → ENDING`. Running out of lives leads to `PLAYER_DEAD` and a restart at Wave 1.

Waves are defined only as data. Each wave sets a camera `lockX` on the road and a list of phases. Each phase is a list of `[enemyType, count]` pairs. A wave also sets `maxAlive`, a spawn `interval`, `advanceAt`, `tokens` (how many enemies may attack at once), optional `thieves`, and an optional `rest`. A wave is complete when `spawned === required && alive === 0`.

### Debug URL flags

For development, when opening `index.html` directly:


- `?wave=N` starts at wave N. Running out of lives then restarts at wave N.
- `?god` makes you invulnerable.
- `?class=warrior|archer|rogue` pre-selects a class on the selection screen.
- `?debug` lets you press `N` to clear the current wave and `H` to heal and fill your pots.

## Publishing the site

The website lives in `docs/`. To publish it with GitHub Pages: in the repository's **Settings → Pages**, set *Source* to *Deploy from a branch*, then choose the branch and the `/docs` folder. (GitHub Pages for a private repository needs a paid GitHub plan; otherwise make the repository public.)

`tools/build-site.sh` rebuilds everything under `docs/` that comes from the game itself: the Windows download of every version, the recorded demos, and the screenshots and figure drawings used on the pages.
