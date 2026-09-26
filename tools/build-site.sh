#!/usr/bin/env bash
# Rebuilds the parts of the website (docs/) that come from the game itself:
#   docs/img/figures/             the game's drawings (tools/site/render-figures.js)
#   docs/img/shots/, docs/media/  screenshots and the recorded demo (tools/site/capture.js)
#   docs/changelog.html           from CHANGELOG.md (tools/site/changelog.py)
# Screenshots and the demo are recorded from the game's files, copied into
# build/site-play/ (not published). They need Playwright + Chromium: set
# PLAYWRIGHT / CHROMIUM if they are not on the default paths. Pass --no-media to
# skip them.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf build/site-play
mkdir -p build/site-play/current
cp -r index.html js build/site-play/current/

if [[ "${1:-}" != "--no-media" ]]; then
  node tools/site/render-figures.js
  node tools/site/capture.js
fi
python3 tools/site/changelog.py
