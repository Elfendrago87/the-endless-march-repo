#!/usr/bin/env bash
# Publishes every version in tools/releases.txt as a GitHub release: creates
# the tag at the listed commit, uses that version's CHANGELOG.md section as the
# notes, and attaches its Windows build from docs/downloads/<version>/ (if it
# had one). Existing releases are brought in line: their notes are refreshed,
# any attachment that is not that Windows build is removed, and a missing one
# is attached. Immutable releases are left as they are.
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
    if [[ "${files[0]}" == *.exe ]]; then
      printf '\n**Download:** run the `.exe`. It is the whole game: nothing to unzip or install.\n' >> "$notes"
    else
      printf '\n**Download:** unzip the Windows build and run the `.exe`. Nothing to install.\n' >> "$notes"
    fi
  else
    printf '\nThis version has no Windows build.\n' >> "$notes"
  fi

  # a release whose tag no longer matches the listed commit is recreated
  if gh release view "$tag" >/dev/null 2>&1; then
    at=$(gh api "repos/{owner}/{repo}/git/ref/tags/$tag" --jq .object.sha)
    immutable=$(gh api "repos/{owner}/{repo}/releases/tags/$tag" --jq .immutable)
    if [[ "$at" != "$sha" && "$immutable" != "true" ]]; then
      gh release delete "$tag" --yes --cleanup-tag
      echo "$tag: moved from ${at:0:7} to ${sha:0:7}, recreating"
    fi
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
    have=" $(gh release view "$tag" --json assets --jq '.assets[].name' | tr '\n' ' ') "
    for f in "${files[@]}"; do
      if [[ "$have" != *" $(basename "$f") "* ]]; then
        gh release upload "$tag" "$f"
        echo "$tag: attached $(basename "$f")"
      fi
    done
    echo "$tag: updated"
  else
    gh release create "$tag" --target "$sha" --title "$v: $title" --notes-file "$notes" "${files[@]}"
    echo "$tag: released"
  fi
  rm -f "$notes"
done < tools/releases.txt
