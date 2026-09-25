#!/usr/bin/env bash
# Rebuilds the parts of the website (docs/) that come from the game itself:
#   docs/play/<version>/        a playable copy of every tagged version
#   docs/downloads/<version>/   that version's downloads
#   docs/img/figures/           the game's drawings (tools/site/render-figures.js)
#   docs/img/shots/, docs/media/  screenshots and recorded demos (tools/site/capture.js)
# The last two need Playwright + Chromium: set PLAYWRIGHT / CHROMIUM if they are
# not on the default paths. Pass --no-media to skip them.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSIONS="v0.1.0 v0.2.0 v0.2.1 v0.3.0 v0.4.0 v0.5.0 v0.6.0"
rm -rf docs/play docs/downloads
mkdir -p docs/play docs/downloads

for v in $VERSIONS; do
  n="${v#v}"
  play="docs/play/$n"
  dl="docs/downloads/$n"
  mkdir -p "$play" "$dl"
  # the game's own files at that tag
  files="index.html js"
  for extra in manifest.webmanifest sw.js icons; do
    git cat-file -e "$v:$extra" 2>/dev/null && files="$files $extra"
  done
  git archive "$v" $files | tar -x -C "$play"
  # name used by that version
  if [[ "$n" < "0.4.0" ]]; then name="seek-$n"; else name="the-endless-march-$n"; fi
  (cd "$play" && zip -q -r "../../downloads/$n/$name-web.zip" .)
  # packaged builds that version shipped
  get() { git cat-file -e "$v:$1" 2>/dev/null && git show "$v:$1" > "$dl/$2" || true; }
  case "$n" in
    0.2.1) get dist/seek.html "$name.html" ;;
    0.3.0) get dist/seek.html "$name.html"; get dist/SEEK.exe "SEEK-$n.exe" ;;
    *)
      get dist/the-endless-march.html "$name.html"
      get dist/The-Endless-March-Windows.zip "The-Endless-March-$n-Windows.zip"
      get dist/The-Endless-March-Android.apk "The-Endless-March-$n-Android.apk"
      ;;
  esac
  find "$dl" -type f -empty -delete
  echo "$v: $(ls "$dl" | tr '\n' ' ')"
done

if [[ "${1:-}" != "--no-media" ]]; then
  node tools/site/render-figures.js
  node tools/site/capture.js
fi
python3 tools/site/changelog.py
