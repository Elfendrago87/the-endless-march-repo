#!/usr/bin/env bash
# Builds dist/SEEK.exe: a native Windows launcher with the whole game embedded.
# Needs Node (to bundle the game) and Go 1.24+ (cross-compiles; no Windows needed).
set -euo pipefail
cd "$(dirname "$0")/.."

node tools/build.js
cp dist/seek.html desktop/seek.html

cd desktop
go run ./icongen winres/icon.png
command -v go-winres >/dev/null 2>&1 || go install github.com/tc-hib/go-winres@v0.3.3
"$(go env GOPATH)/bin/go-winres" make --arch amd64
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-H windowsgui -s -w" -o ../dist/SEEK.exe .
echo "wrote dist/SEEK.exe ($(du -h ../dist/SEEK.exe | cut -f1))"
