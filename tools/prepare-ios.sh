#!/usr/bin/env bash
# Copies the game into the iOS project (mobile/ios/EndlessMarch/www).
# Then, on a Mac with Xcode and XcodeGen: cd mobile/ios && xcodegen && open EndlessMarch.xcodeproj
set -euo pipefail
cd "$(dirname "$0")/.."
W=mobile/ios/EndlessMarch/www
rm -rf "$W"
mkdir -p "$W/js" "$W/icons"
cp index.html manifest.webmanifest "$W/"
cp js/*.js "$W/js/"
cp icons/*.png "$W/icons/"
echo "copied the game into $W"
