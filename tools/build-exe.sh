#!/usr/bin/env bash
# Builds the Windows release of The Endless March: Journey to the End.
#
#   dist/The Endless March/                  <- the bundle
#     The Endless March.exe                   launcher (also embeds a single-file fallback copy)
#     game/index.html, game/js/*.js           the game's assets, loaded by the launcher
#     README.txt
#   dist/The-Endless-March-Windows.zip       <- the bundle, zipped for sharing
#
# Needs Node (bundles the fallback copy) and Go 1.24+ (cross-compiles; no Windows needed).
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="The Endless March"
OUT="dist/$NAME"

node tools/build.js

(
  cd desktop
  go run ./icongen winres/icon.png
  command -v go-winres >/dev/null 2>&1 || go install github.com/tc-hib/go-winres@v0.3.3
  "$(go env GOPATH)/bin/go-winres" make --arch amd64
  GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-H windowsgui -s -w" -o launcher.exe .
)

rm -rf "$OUT"
mkdir -p "$OUT/game/js"
mv desktop/launcher.exe "$OUT/$NAME.exe"
cp index.html "$OUT/game/"
cp js/*.js "$OUT/game/js/"
cp desktop/winres/icon.png "$OUT/game/icon.png"
cat > "$OUT/README.txt" <<'TXT'
THE ENDLESS MARCH: JOURNEY TO THE END

Double-click "The Endless March.exe" to play.

The game opens in its own window (Microsoft Edge in app mode, or Chrome, or
your default browser). Closing that window closes the game. F11 toggles
fullscreen. P or Esc pauses and shows the controls.

Keep the "game" folder next to the .exe: it holds the game itself. (If it is
missing, the .exe falls back to a built-in copy.)

The .exe is not code-signed, so Windows SmartScreen may warn the first time:
choose "More info" -> "Run anyway".

CLASSES
  Warrior - the enormous sword. Heavy three-hit combo.
  Archer  - arrows down your lane; every third shot is a fire arrow that
            pierces and burns.
  Rogue   - twin daggers, every strike cuts twice; an evasive dash.

CONTROLS
  Move ............ Arrows / WASD (up and down walk into and out of the screen)
  Run ............. double-tap left/right, or hold Shift / C
  Dash (Rogue) .... Shift / C - untouchable while dashing; attack out of it
                    for the dash twin strike
  Jump ............ Space / Z / K
  Attack .......... X / J / left click (repeat for a three-hit combo)
  Back attack ..... F / right click, or Jump + Attack together
  Grab & throw .... attack an enemy point-blank
  Magic ........... V / Q (spends every pot you carry)
  Pause ........... P / Esc        Mute ... M

THE LANE RULE
  You only hit what shares your lane. The Warrior's sword wave (third slash)
  is the one attack that crosses lanes.
  Gamepads work too.
TXT

rm -f dist/The-Endless-March-Windows.zip
python3 - "$NAME" <<'PY'
import os, sys, zipfile
name = sys.argv[1]
with zipfile.ZipFile('dist/The-Endless-March-Windows.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(os.path.join('dist', name)):
        for f in sorted(files):
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, 'dist'))
PY
echo "wrote $OUT/ and dist/The-Endless-March-Windows.zip ($(du -h dist/The-Endless-March-Windows.zip | cut -f1))"
