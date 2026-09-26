#!/usr/bin/env bash
# Builds the Windows release of The Endless March: Journey to the End:
#
#   dist/The-Endless-March.exe    one executable with the whole game built in
#
# Needs Node (bundles the game into one file) and Go 1.24+ (cross-compiles; no
# Windows needed).
set -euo pipefail
cd "$(dirname "$0")/.."

node tools/build.js

(
  cd desktop
  go run ./icongen winres/icon.png
  command -v go-winres >/dev/null 2>&1 || go install github.com/tc-hib/go-winres@v0.3.3
  "$(go env GOPATH)/bin/go-winres" make --arch amd64
  GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-H windowsgui -s -w" -o launcher.exe .
)

mkdir -p dist
mv desktop/launcher.exe dist/The-Endless-March.exe
echo "wrote dist/The-Endless-March.exe ($(du -h dist/The-Endless-March.exe | cut -f1))"
