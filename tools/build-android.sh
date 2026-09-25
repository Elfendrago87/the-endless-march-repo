#!/usr/bin/env bash
# Builds dist/The-Endless-March-Android.apk: a WebView app with the game's
# files bundled as assets. No Gradle needed - just the Android build tools,
# the android.jar of one platform, and a JDK (javac + keytool).
#
#   ANDROID_BUILD_TOOLS=/path/to/build-tools/35.0.1 \
#   ANDROID_JAR=/path/to/platforms/android-35/android.jar \
#   ./tools/build-android.sh
#
# Signing: uses $ANDROID_KEYSTORE (default ~/.android/endless-march.jks),
# creating a local key there on first run. Keep that file: Android only accepts
# an update signed with the same key.
set -euo pipefail
cd "$(dirname "$0")/.."

BT="${ANDROID_BUILD_TOOLS:?set ANDROID_BUILD_TOOLS to a build-tools directory}"
JAR="${ANDROID_JAR:?set ANDROID_JAR to a platform android.jar}"
KS="${ANDROID_KEYSTORE:-$HOME/.android/endless-march.jks}"
VERSION_NAME="0.7.0"
VERSION_CODE=7

OUT=build/android
rm -rf "$OUT"
mkdir -p "$OUT/res" "$OUT/assets/www/js" "$OUT/assets/www/icons" "$OUT/gen" "$OUT/classes" "$OUT/dex"

# resources: strings + launcher icons at every density
cp -r mobile/android/res/* "$OUT/res/"
(cd desktop && for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  mkdir -p "../$OUT/res/mipmap-${d%%:*}"
  go run ./icongen "../$OUT/res/mipmap-${d%%:*}/ic_launcher.png" "${d##*:}"
done)

# the game itself
cp index.html manifest.webmanifest "$OUT/assets/www/"
cp js/*.js "$OUT/assets/www/js/"
cp icons/*.png "$OUT/assets/www/icons/"

"$BT/aapt2" compile --dir "$OUT/res" -o "$OUT/res.zip"
"$BT/aapt2" link -I "$JAR" --manifest mobile/android/AndroidManifest.xml \
  --min-sdk-version 24 --target-sdk-version 35 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$OUT/assets" --java "$OUT/gen" -o "$OUT/unsigned.apk" "$OUT/res.zip"

javac -source 11 -target 11 -Xlint:-options -encoding UTF-8 -classpath "$JAR" -d "$OUT/classes" \
  $(find mobile/android/src "$OUT/gen" -name '*.java')
"$BT/d8" --lib "$JAR" --min-api 24 --release --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
(cd "$OUT/dex" && zip -q -j ../unsigned.apk classes.dex)

"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -storepass endlessmarch -keypass endlessmarch \
    -alias endlessmarch -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=The Endless March" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:endlessmarch --key-pass pass:endlessmarch \
  --ks-key-alias endlessmarch --v4-signing-enabled false --out dist/The-Endless-March-Android.apk "$OUT/aligned.apk"
"$BT/apksigner" verify dist/The-Endless-March-Android.apk
echo "wrote dist/The-Endless-March-Android.apk ($(du -h dist/The-Endless-March-Android.apk | cut -f1))"
