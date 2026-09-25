# SEEK

A minimalist black-and-white 2D wave-combat platformer.

A black figure with an enormous black sword fights through ten waves in an almost empty white world. After Wave 10, a door opens onto blinding white light. What it means is up to the player.

## Play

Open `index.html` in a modern browser. There is no build step and nothing to install.

If your browser blocks local files, serve the folder instead:

```sh
npx http-server .     # or: python3 -m http.server
```

## Controls

| Action | Keyboard | Mouse / Gamepad |
|---|---|---|
| Move | ← → / A D | stick / d-pad |
| Jump (hold to jump higher) | Space / W / ↑ / Z | A |
| Attack (three-hit combo; works in the air too) | X / J | left click / X |
| Dash (brief invulnerability) | Shift / C / L | right click / B / RB |
| Drop through a platform | ↓ + Jump | |
| Pause | P / Esc | Start |
| Mute | M | |

## How it plays

- **Sword combo.** Hit 1 does 15 damage, hit 2 does 18, hit 3 does 28. The third swing is slower, reaches further, and hits much harder. Every swing has a windup, an active window and a recovery. You can only cancel the recovery, and only into a dash.
- **Air attack.** It hits beside and below you, at most twice per jump. It bounces you up once per jump when it hits something underneath.
- **Parry.** A swing that is active when it touches an enemy projectile destroys it.
- **Health.** You have 100 HP and regain 20 between waves. There are no checkpoints: if you die, the run starts again at Wave 1.

## Enemies

| Enemy | HP | What it does |
|---|---|---|
| Seeker | 30 | Walks up and claws. The basic source of pressure. |
| Chaser | 20 | Fast. Crouches, then lunges past you. |
| Brute | 100 | Slow and can't be staggered. Raises its fists (the dashed box shows where they land), then slams. Hit it while it recovers. |
| Ranged | 25 | Keeps its distance, shows a dotted aim line, then fires. Backs away when you get close. |
| Flyer | 30 | Hovers above you, then dives along a dashed line. Stuck on the ground for a moment after it lands. |
| Splitter | 40 | Splits into two fast Splitlings when it dies. |
| Shielder | 60 | Blocks every frontal hit and turns slowly. Get behind it, attack from above, or punish its shield bash. |
| Assassin | 35 | Fades almost to nothing, drifts behind you, then reappears and strikes. Its faint trail gives it away. |
| Elite | 150 | Takes reduced damage and resists knockback. Uses a dash slash, a two-sided slam and a three-shot volley. Attacks faster below half health. |

Every dangerous attack has a telegraph: the enemy shakes and a ring collapses onto it. Then comes the attack, then a recovery you can punish.

## Code layout

```
index.html          canvas + script tags
js/util.js          math, AABB helpers, object Pool
js/data.js          ALL tuning: player feel, attacks, enemy stats, arenas, the 10 waves
js/audio.js         procedural WebAudio sounds + the door drone
js/input.js         keyboard / mouse / gamepad mapped to actions
js/world.js         Arena + shared platformer collision (solids, one-way platforms)
js/fx.js            pooled particles, slashes, rings, dash ghosts, screen shake
js/player.js        movement, dash, combo state machine, hitboxes, drawing
js/enemies.js       Enemy class: per-archetype AI state machines + silhouettes
js/projectiles.js   pooled projectiles (parryable)
js/waves.js         data-driven WaveManager (required / spawned / alive / defeated)
js/game.js          game states, spawning, hit resolution, camera, HUD, door, ending
```

Game states: `START → WAVE_INTRO → WAVE / FINAL_WAVE → WAVE_COMPLETE → … → DOOR → ENDING`. If you die, the game goes to `PLAYER_DEAD` and then restarts at Wave 1.

Waves are defined only as data in `js/data.js`. Each wave is a list of phases, and each phase is a list of `[enemyType, count]` pairs, plus `maxAlive`, a spawn `interval` and `advanceAt`. A wave is complete when `spawned === required && alive === 0`. Splitter halves are added to both counts when they appear.

### Debug URL flags

- `?wave=N` starts at wave N. Dying then restarts at wave N.
- `?god` makes you invulnerable.
- `?debug` lets you press `N` to clear the current wave and `H` to heal.
