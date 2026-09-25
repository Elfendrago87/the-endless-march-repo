# The Endless March: Journey to the End

A minimalist black-and-white belt-scroller in the spirit of Golden Axe, without the mounts.

An outlined figure with an enormous sword walks a long white road and fights ten waves along the way. Everything with a body (the hero, the enemies, their weapons, the ruins and fortresses on the horizon) is drawn as a white shape with a black outline. After Wave 10, a monolith rises at the end of the road and its door opens onto blinding white light. What it means is up to the player.

## Play

### Windows

Download `dist/The-Endless-March-Windows.zip`, unzip it, and double-click **The Endless March.exe**. There's nothing to install. The unzipped folder looks like this:

```
The Endless March/
  The Endless March.exe     the launcher
  game/                     the game's files (index.html, js/, icon.png)
  README.txt                how to play
```

The launcher serves the `game/` folder on 127.0.0.1 and opens it in its own window: Microsoft Edge (built into Windows 10 and 11) in app mode, or Chrome if Edge is missing, or your default browser as a last resort. Closing the window closes the program, and F11 toggles fullscreen. Keep `game/` next to the exe. The exe also carries a built-in single-file copy of the game, so it still runs if it gets separated from the folder.

The executable isn't code-signed, so Windows SmartScreen may warn about it the first time. Choose **More info → Run anyway**.

The launcher's source is in `desktop/`, a small Go program. To rebuild the bundle and the zip (needs Go 1.24+ and Node; it builds from Linux, macOS or Windows):

```sh
./tools/build-exe.sh
```

### In a browser

Open `index.html` in a modern browser. There is no build step and nothing to install.

`dist/the-endless-march.html` is the whole game in one self-contained HTML file. `dist/the-endless-march-test.html` is the same file with the debug keys switched on: `N` clears the current wave and `H` heals you and fills your magic. Rebuild both after changing the code:

```sh
node tools/build.js          # dist/the-endless-march.html
node tools/build.js --test   # dist/the-endless-march-test.html
```

If your browser blocks local files, serve the folder instead:

```sh
npx http-server .     # or: python3 -m http.server
```

## Controls

| Action | Keyboard | Mouse / Gamepad |
|---|---|---|
| Move (up/down walks into and out of the screen) | arrows / WASD | stick / d-pad |
| Run | double-tap ← or →, or hold Shift / C | double-tap, or hold RB |
| Jump | Space / Z / K | A |
| Attack (repeat for a three-hit combo) | X / J | left click / X |
| Back attack (hits both sides) | F / U, or Jump + Attack together | right click / B |
| Magic | V / Q / L | Y |
| Pause | P / Esc | Start |
| Mute | M | |

## How it plays

- **The road.** The screen locks when a wave begins. Enemies walk in from both edges or rise out of the ground. When the wave is cleared, **GO →** appears and you walk on to the next one.
- **Depth.** Attacks only land when you and your target share a lane. Line up to hit, and step up or down out of a lane to dodge thrown axes, lunges and dashes.
- **Sword combo.** Hit 1 does 15 damage, hit 2 does 18, hit 3 does 28. The third hit knocks enemies to the floor.
- **Running attack.** Attack while running for a knockdown lunge that carries your momentum.
- **Jump attack.** A slash in the air that knocks enemies down.
- **Back attack.** A full spin that clears both sides. Use it when you're surrounded.
- **Grab and throw.** Attack an enemy that is right in front of you to grab it. Keep attacking to knee it twice and then throw it over your shoulder. A thrown body knocks down anyone it hits.
- **Knockdowns.** Heavy hits, or three hits in a row, put you on the floor. You're invulnerable while you're down and while you get back up.
- **Magic pots.** Small thieves carrying sacks wander through some waves. Hit them to knock loose pots and bread. Magic spends every pot you carry at once. More pots make a bigger eruption of black spikes, which hits every enemy on screen.
- **Rest.** After waves 3 and 6, night falls and the world inverts. Thieves come for your sack, so hit them for pots. You recover some health at dawn.
- **Lives.** You have 3 lives and 100 HP each. Falling spends a life and you stand back up where you fell, knocking back anyone nearby. When the last life is gone, the run starts over at Wave 1.
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
js/data.js          ALL tuning: player feel, attacks, grab/magic, enemies, stage, the 10 waves
js/audio.js         procedural WebAudio sounds + the door drone
js/input.js         keyboard / mouse / gamepad mapped to actions (double-tap run)
js/world.js         Stage (parallax horizon, floor, foreground) + belt-scroller movement
js/fx.js            pooled particles, slashes, rings, screen shake
js/player.js        movement, run, combo, grab/knee/throw, magic, knockdown, lives, drawing
js/enemies.js       Enemy class: per-archetype AI on the floor plane + outlined figures
js/projectiles.js   pooled thrown axes (parryable) and item pickups
js/waves.js         data-driven WaveManager (required / spawned / alive / defeated)
js/game.js          game states, camera locks, spawning, hits, magic, rest, door, HUD, ending
```

Coordinates: every actor has `x`, a depth `z` (0 is the horizon and `DEPTH` is the front edge), and an elevation. A hit needs the boxes to overlap in x and elevation, and the two actors to be within the attack's depth tolerance.

Game states: `START → WAVE_INTRO → WAVE → WAVE_COMPLETE → (REST) → ADVANCE → … → FINAL_WAVE → DOOR → ENDING`. Running out of lives leads to `PLAYER_DEAD` and a restart at Wave 1.

Waves are defined only as data. Each wave sets a camera `lockX` on the road and a list of phases. Each phase is a list of `[enemyType, count]` pairs. A wave also sets `maxAlive`, a spawn `interval`, `advanceAt`, `tokens` (how many enemies may attack at once), optional `thieves`, and an optional `rest`. A wave is complete when `spawned === required && alive === 0`.

### Debug URL flags

- `?wave=N` starts at wave N. Running out of lives then restarts at wave N.
- `?god` makes you invulnerable.
- `?debug` lets you press `N` to clear the current wave and `H` to heal and fill your pots.
