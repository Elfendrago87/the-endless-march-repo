#!/usr/bin/env bash
# Publishes every version in tools/releases.txt as a GitHub release: creates
# the tag at the listed commit, uses that version's CHANGELOG.md section as the
# notes, and attaches its builds from docs/downloads/<version>/. Versions that
# already have a release are skipped. Run by .github/workflows/releases.yml.
set -euo pipefail
cd "$(dirname "$0")/.."

while read -r tag sha; do
  [[ -z "$tag" || "$tag" == \#* ]] && continue
  v="${tag#v}"
  if gh release view "$tag" >/dev/null 2>&1; then
    echo "$tag: already released"
    continue
  fi
  title=$(grep -m1 "^## $v " CHANGELOG.md | sed -E 's/^## [0-9.]+ \([0-9-]+\): //')
  notes=$(mktemp)
  awk -v v="$v" '$0 ~ "^## " v " " {f=1; next} /^## / {f=0} f' CHANGELOG.md | sed '/^---$/d' > "$notes"
  printf '\n**Downloads:** the `-web.zip` is the game as plain files (open `index.html`); the `.html` is the whole game in one file.' >> "$notes"
  [[ -f "docs/downloads/$v/The-Endless-March-$v-Windows.zip" || -f "docs/downloads/$v/SEEK-$v.exe" ]] && \
    printf ' The Windows build needs no install: unzip it and run the `.exe`.' >> "$notes"
  [[ -f "docs/downloads/$v/The-Endless-March-$v-Android.apk" ]] && \
    printf ' The `.apk` installs on Android 7.0 and later.' >> "$notes"
  echo >> "$notes"
  gh release create "$tag" --target "$sha" --title "$v: $title" --notes-file "$notes" docs/downloads/"$v"/*
  rm -f "$notes"
  echo "$tag: released"
done < tools/releases.txt
