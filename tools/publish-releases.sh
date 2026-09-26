#!/usr/bin/env bash
# Publishes every version in tools/releases.txt as a GitHub release: creates
# the tag at the listed commit, uses that version's CHANGELOG.md section as the
# notes, and attaches its Windows build from docs/downloads/<version>/ (if it
# had one). Existing releases are brought in line: their notes are refreshed
# and any attachment that is not that Windows build is removed.
# Run by .github/workflows/releases.yml.
set -euo pipefail
cd "$(dirname "$0")/.."

while read -r tag sha; do
  [[ -z "$tag" || "$tag" == \#* ]] && continue
  v="${tag#v}"
  title=$(grep -m1 "^## $v " CHANGELOG.md | sed -E 's/^## [0-9.]+ \([0-9-]+\): //')
  notes=$(mktemp)
  awk -v v="$v" '$0 ~ "^## " v " " {f=1; next} /^## / {f=0} f' CHANGELOG.md | sed '/^---$/d' > "$notes"
  files=(docs/downloads/"$v"/*)
  [[ -e "${files[0]}" ]] || files=()
  if (( ${#files[@]} )); then
    printf '\n**Download:** unzip the Windows build and run the `.exe`. Nothing to install.\n' >> "$notes"
  else
    printf '\nThis version has no Windows build.\n' >> "$notes"
  fi

  if gh release view "$tag" >/dev/null 2>&1; then
    if [[ "$(gh api "repos/{owner}/{repo}/releases/tags/$tag" --jq .immutable)" == "true" ]]; then
      # GitHub locks an immutable release's files; leave it alone
      echo "::warning::$tag is an immutable release; its files can't be changed, skipped"
      rm -f "$notes"
      continue
    fi
    gh release edit "$tag" --title "$v: $title" --notes-file "$notes" >/dev/null
    keep=" "
    for f in "${files[@]}"; do keep+="$(basename "$f") "; done
    for asset in $(gh release view "$tag" --json assets --jq '.assets[].name'); do
      if [[ "$keep" != *" $asset "* ]]; then
        gh release delete-asset "$tag" "$asset" --yes
        echo "$tag: removed $asset"
      fi
    done
    echo "$tag: updated"
  else
    gh release create "$tag" --target "$sha" --title "$v: $title" --notes-file "$notes" "${files[@]}"
    echo "$tag: released"
  fi
  rm -f "$notes"
done < tools/releases.txt
