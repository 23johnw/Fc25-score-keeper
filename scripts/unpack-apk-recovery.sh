#!/usr/bin/env bash
# Extract web assets and readable sources from an FC 25 Score Tracker APK.
# Usage: ./scripts/unpack-apk-recovery.sh "path/to/app-release.apk"

set -euo pipefail

APK="${1:-}"
if [[ -z "$APK" || ! -f "$APK" ]]; then
  echo "Usage: $0 path/to/app-release.apk"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="$ROOT/tools"
OUT="$ROOT/apk-recovered"
APK_NAME="$(basename "$APK" .apk)"
TARGET="$OUT/$APK_NAME"

mkdir -p "$TOOLS" "$TARGET"

if [[ ! -x "$TOOLS/bin/jadx" ]]; then
  echo "Downloading jadx..."
  curl -sL "https://github.com/skylot/jadx/releases/download/v1.5.1/jadx-1.5.1.zip" -o "$TOOLS/jadx.zip"
  unzip -q -o "$TOOLS/jadx.zip" -d "$TOOLS"
fi

if [[ ! -f "$TOOLS/apktool.jar" ]]; then
  echo "Downloading apktool..."
  curl -sL "https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar" -o "$TOOLS/apktool.jar"
  curl -sL "https://raw.githubusercontent.com/iBotPeaches/Apktool/master/scripts/linux/apktool" -o "$TOOLS/apktool"
  chmod +x "$TOOLS/apktool"
fi

echo "==> Raw APK contents (zip)"
unzip -l "$APK" > "$TARGET/00-apk-file-list.txt"

echo "==> Web assets (PWA/TWA apps store HTML/JS here)"
mkdir -p "$TARGET/01-zip-assets"
unzip -q -o "$APK" "assets/*" -d "$TARGET/01-zip-assets" 2>/dev/null || true

echo "==> apktool decode (AndroidManifest, resources)"
"$TOOLS/apktool" d -f -o "$TARGET/02-apktool" "$APK" 2>&1 | tee "$TARGET/02-apktool-log.txt"

echo "==> jadx decompile (Java/Kotlin wrapper code)"
"$TOOLS/bin/jadx" -d "$TARGET/03-jadx" "$APK" 2>&1 | tee "$TARGET/03-jadx-log.txt"

echo
echo "Done. Output: $TARGET"
echo "For this PWA, compare 01-zip-assets/assets/ with the repo root (index.html, src/, styles.css)."
echo "Your GitHub repo already has the full source: https://github.com/23johnw/fc25-score-keeper"
