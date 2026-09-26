#!/usr/bin/env bash
# Publishes the releases listed in tools/releases.txt. For each one: creates
# the tag at the listed commit (or, if the tag has moved, recreates the
# release there), sets the notes from the listed file, and makes the
# attachments exactly the listed files: missing or changed ones are uploaded,
# unlisted ones removed. Releases not in the list are left alone.
# Run by .github/workflows/releases.yml.
set -euo pipefail
cd "$(dirname "$0")/.."

# the website, for reading offline (without the old builds in docs/downloads/)
mkdir -p build/release
rm -f build/release/The-Endless-March-Website.zip
(cd docs && zip -q -r ../build/release/The-Endless-March-Website.zip . -x 'downloads/*')

stage=$(mktemp -d)
while read -r tag sha notes rest; do
  [[ -z "$tag" || "$tag" == \#* ]] && continue
  read -ra specs <<< "$rest"
  rm -rf "${stage:?}"/*
  names=()
  title=
  for spec in "${specs[@]}"; do
    src="${spec%%=*}"; name="${spec#*=}"
    [[ "$spec" == *=* ]] || name=$(basename "$src")
    cp "$src" "$stage/$name"
    names+=("$name")
  done

  if gh release view "$tag" >/dev/null 2>&1; then
    at=$(gh api "repos/{owner}/{repo}/git/ref/tags/$tag" --jq .object.sha)
    immutable=$(gh api "repos/{owner}/{repo}/releases/tags/$tag" --jq .immutable)
    if [[ "$immutable" == "true" ]]; then
      echo "::warning::$tag is an immutable release; its files can't be changed, skipped"
      continue
    fi
    if [[ "$at" != "$sha" ]]; then
      title=$(gh release view "$tag" --json name --jq .name)
      gh release delete "$tag" --yes --cleanup-tag
      echo "$tag: moved from ${at:0:7} to ${sha:0:7}, recreating"
    fi
  fi

  if ! gh release view "$tag" >/dev/null 2>&1; then
    gh release create "$tag" --target "$sha" --title "${title:-$(sed -n '1s/^# //p' "$notes") ${tag#v}}" --notes-file "$notes" "${names[@]/#/$stage/}"
    echo "$tag: released"
    continue
  fi

  gh release edit "$tag" --notes-file "$notes" >/dev/null
  have=$(gh api "repos/{owner}/{repo}/releases/tags/$tag" --jq '.assets[] | "\(.name) \(.digest)"')
  for name in "${names[@]}"; do
    want="sha256:$(sha256sum "$stage/$name" | cut -d' ' -f1)"
    if ! grep -qx "$name $want" <<< "$have"; then
      gh release upload "$tag" "$stage/$name" --clobber
      echo "$tag: uploaded $name"
    fi
  done
  while read -r name _; do
    [[ -z "$name" ]] && continue
    if [[ " ${names[*]} " != *" $name "* ]]; then
      gh release delete-asset "$tag" "$name" --yes
      echo "$tag: removed $name"
    fi
  done <<< "$have"
  echo "$tag: updated"
done < tools/releases.txt
rm -rf "$stage"
