# Changelog

Every version of the game, newest first. Each version is tagged in git (`v0.1.0` … `v0.6.0`), and each one can be downloaded, played in a browser and watched as a recorded demo on the website (`docs/`, see the README).

The game started out under the working title **SEEK** and was renamed **The Endless March: Journey to the End** in 0.4.0.

---

## 0.6.0 (2026-09-25): Lanes, the sword wave, and phones

### Combat
- **The lane rule.** You now only hit what shares your lane. Every player attack uses the same lane width (`LANE` in `js/data.js`); before this, attacks had tolerances between 14 and 26, and the back attacks reached noticeably further than the combos.
- **Sword wave (Warrior).** The third slash of the Warrior's combo releases a crescent of force that rolls forward about 400 units along the whole road. It is the one attack that crosses lanes: it hits anything on the ground it passes, in any lane, for 12 damage and a stagger. High flyers pass over it, and a raised shield still blocks it.
- **Archer.** The lane-snapping aim assist from 0.5.0 is gone: arrows keep to the lane you shoot from. The bow still tilts up at an enemy in the air, but only if it is in your lane. The running attack no longer fans three arrows across the lanes; it is now one heavy piercing shot (16 damage, knockdown).
- Thrown bodies only bowl over enemies in the same lane.

### Phones and tablets
- **Touch controls:** a floating stick on the left half of the screen (push it to the rim to run) and ATTACK, JUMP, BACK, RUN/DASH and MAGIC buttons on the right, with II to pause. The class screen can be tapped. Controls appear the first time the screen is touched.
- A "turn your device sideways" notice in portrait.
- **Android app** (`dist/The-Endless-March-Android.apk`, Android 7.0+): a full-screen landscape WebView app with the game's files inside; plays offline, keeps the screen awake, and the Back button pauses. Built by `tools/build-android.sh` with the Android build-tools directly (no Gradle).
- **iPhone / iPad:** the game is now an installable web app (manifest, offline service worker, home-screen icons), so *Add to Home Screen* in Safari gives a full-screen offline app. `mobile/ios/` adds an Xcode project (XcodeGen) wrapping the game in a WKWebView, to build on a Mac.
- Page is locked against pinch-zoom, scrolling and text selection on touch screens.

### Other
- Version number on the title and pause screens.
- The pause screen explains the lane rule.
- Enemy behaviour code tidied and renamed for clarity.
- The app icon generator can render any size (used for the Android and home-screen icons).
- The website in `docs/`: guide, art style, planned story mode, changelog, downloads and demos for every version.

---

## 0.5.0 (2026-09-25): Three paths

- **Class select screen** ("Choose your path") after the title. The chosen class carries over when a run restarts; `?class=` pre-selects one.
- **Archer** (90 HP). Arrows fly down the lane, stick in the ground and glance off shields. The combo is arrow, arrow, **fire arrow**: it pierces, knocks down and sets enemies burning (4 damage every half second for about two seconds, drawn as outlined flames). An air shot angles down at the floor; the running attack fanned three arrows across the lanes. Hood and quiver.
- **Rogue** (85 HP). Twin daggers: every press is a **twin strike** (two hit windows), and the third press is a knockdown cross cut. Shift/C is the **evasive dash** from 0.1.0, back again, now in any of eight directions with brief invulnerability and one air dash. Attacking out of a dash or a run is the **dash twin strike**, which cuts through the enemy line while you can't be hit. Headband tails.
- Attacks can now have several hit windows and can fire projectiles instead of using a sword hitbox. Each class sets its own HP and speed, and leaves its own weapon behind when it dies.
- Balancing from bot runs: an aim assist made the Archer's arrows settle into the nearest lane in front (removed again in 0.6.0), arrows fly lower so short enemies can be hit, and Archer HP went from 80 to 90.

---

## 0.4.0 (2026-09-25): The Endless March

- **Renamed** from SEEK to **The Endless March: Journey to the End**: title screen, ending, window title, executable name and details.
- **Outline art.** Everything with a body (figures, enemies, weapons, projectiles, pickups, horizon structures, the door monolith, magic spikes, rocks) is now a white shape with a black outline instead of a solid black silhouette. Thick limbs are outlined tubes, thin ones plain sticks, and a hit flashes the body solid black. Shadows and hit sparks stay solid.
- **Windows bundle.** The release is now a folder: the launcher `.exe`, a `game/` folder with the game's files, and a `README.txt`, zipped as `The-Endless-March-Windows.zip`. The launcher serves the `game/` folder and falls back to a built-in copy if the folder is missing.
- New outlined-sword app icon.

---

## 0.3.0 (2026-09-25): A Windows app

- **`SEEK.exe`**: a small native Windows program (written in Go, cross-compiled) with the whole game built in. It serves the game on 127.0.0.1 and opens it in its own Edge or Chrome app window with a private profile, falling back to the default browser, and closes itself when the game window closes. F11 toggles fullscreen.
- Icon, version details and high-DPI support built into the executable.

---

## 0.2.1 (2026-09-25): Single-file builds

- The whole game can be built into one self-contained HTML file (`tools/build.js`), plus a test build with debug keys switched on (N skips a wave, H heals and fills magic).

---

## 0.2.0 (2026-09-25): Onto the road

A rework from a side-view platformer into a belt-scroller in the spirit of Golden Axe, without the mounts.

- **Depth:** you walk into and out of the screen as well as left and right; attacks only land on targets near your depth. Shadows, back-to-front drawing.
- **One long road** instead of separate arenas. The camera locks at each wave; when it is cleared, **GO →** sends you on. Four stretches of scenery: plain, ruins, fortress, and the void for Wave 10.
- **New moves:** run (double-tap or hold Shift), running attack, knockdown jump attack, back attack that hits both sides, grab → knee → throw (thrown bodies knock others down).
- **Magic pots** dropped by thieves; casting spends every pot for an eruption of spikes across the screen.
- **Knockdowns** for you and enemies; **3 lives**, and standing back up after a fall knocks nearby enemies away.
- **Night rests** after waves 3 and 6: the world inverts and thieves come for your pots.
- Enemies take turns attacking (attack tokens) and circle while they wait; they walk in from both screen edges or rise from the ground.
- Removed: platforms and the evasive dash (it returns for the Rogue in 0.5.0).

---

## 0.1.0 (2026-09-25): SEEK

The first playable version: a minimalist black-and-white side-view wave-combat platformer.

- A black figure with an oversized sword: run, jump, an evasive dash with invulnerability, a three-hit combo (15 / 18 / 28), an air attack, hit-stop, knockback and screen shake.
- Nine enemy types with readable windups: Seeker, Chaser, Brute, Ranged, Flyer, Splitter, Shielder, Assassin, Elite.
- Ten waves across four arenas, defined as data.
- After Wave 10 a door rises and fills the screen with white light. The ending leaves its meaning to the player.
- Death restarts the run from Wave 1.
