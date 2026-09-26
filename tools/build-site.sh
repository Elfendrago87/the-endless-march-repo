#!/usr/bin/env bash
# Rebuilds the parts of the website (docs/) that come from the game itself:
#   docs/downloads/<version>/   that version's Windows download
#   docs/img/figures/           the game's drawings (tools/site/render-figures.js)
#   docs/img/shots/, docs/media/  screenshots and recorded demos (tools/site/capture.js)
# Screenshots and demos are recorded from each version's game files, unpacked
# into build/site-play/ (not published). They need Playwright + Chromium: set
# PLAYWRIGHT / CHROMIUM if they are not on the default paths. Pass --no-media to
# skip them.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSIONS="v0.1.0 v0.2.0 v0.2.1 v0.3.0 v0.4.0 v0.5.0 v0.6.0 v0.7.0 v0.8.0"
rm -rf docs/downloads build/site-play
mkdir -p docs/downloads build/site-play

for v in $VERSIONS; do
  n="${v#v}"
  play="build/site-play/$n"
  dl="docs/downloads/$n"
  mkdir -p "$play" "$dl"
  # the game's own files at that tag, for recording
  git archive "$v" index.html js | tar -x -C "$play"
  # the Windows build that version shipped (0.3.0 onwards)
  get() { git cat-file -e "$v:$1" 2>/dev/null && git show "$v:$1" > "$dl/$2" || true; }
  case "$n" in
    0.3.0) get dist/SEEK.exe "SEEK-$n.exe" ;;
    *) get dist/The-Endless-March-Windows.zip "The-Endless-March-$n-Windows.zip" ;;
  esac
  find "$dl" -type f -empty -delete
  rmdir "$dl" 2>/dev/null || true
  echo "$v: $(ls "$dl" 2>/dev/null | tr '\n' ' ')"
done

if [[ "${1:-}" != "--no-media" ]]; then
  node tools/site/render-figures.js
  node tools/site/capture.js
fi
python3 tools/site/changelog.py
