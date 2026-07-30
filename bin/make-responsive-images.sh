#!/bin/bash
#
# Pre-generate the responsive WebP variants that _includes/figure.html expects.
#
#   bin/make-responsive-images.sh [--force]
#
# WHY THIS EXISTS
#
# figure.html emits <source srcset="<name>-<width>.webp"> for each width in
# _config.yml's imagemagick.widths, and the jekyll-imagemagick plugin is
# supposed to produce those files at build time. But GitHub Pages builds this
# site in safe mode (Settings -> Pages is "Deploy from a branch: master"), and
# safe mode runs only whitelisted plugins -- jekyll-imagemagick is not one.
#
# So on the live site every one of those <source> URLs 404s. The browser picks
# a matching source, fails to decode the 404 body, fires figure.html's onerror
# handler, strips the sources, and only then downloads the full-size original.
# That is a wasted round trip followed by a multi-megabyte download, and the
# originals here run to 64 MB.
#
# Committing the variants fixes it without needing the plugin to run. Re-run
# this after adding or replacing anything in assets/img/.
#
# Uses cwebp (brew install webp). macOS sips cannot write WebP.

set -euo pipefail

cd "$(dirname "$0")/.."

SRC_DIR="assets/img"
WIDTHS=(480 800 1400)
QUALITY=82
FORCE="${1:-}"

command -v cwebp >/dev/null || { echo "cwebp not found -- brew install webp" >&2; exit 1; }

shopt -s nullglob nocaseglob

made=0; skipped=0; bytes=0

for src in "$SRC_DIR"/*.jpg "$SRC_DIR"/*.jpeg "$SRC_DIR"/*.png "$SRC_DIR"/*.tiff; do
  [ -f "$src" ] || continue
  base="${src%.*}"

  for w in "${WIDTHS[@]}"; do
    out="${base}-${w}.webp"

    # Skip if already current, unless --force. Regenerating every run would
    # rewrite identical files and churn the git history for no reason.
    if [ "$FORCE" != "--force" ] && [ -f "$out" ] && [ "$out" -nt "$src" ]; then
      skipped=$((skipped + 1))
      continue
    fi

    # -resize W 0 keeps the aspect ratio. cwebp will happily upscale, so cap at
    # the source width: a 480px-wide original must not become a 1400px variant.
    srcw=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')
    target=$w
    [ "$srcw" -lt "$w" ] && target=$srcw

    cwebp -quiet -q "$QUALITY" -resize "$target" 0 "$src" -o "$out"
    sz=$(wc -c < "$out" | tr -d ' ')
    bytes=$((bytes + sz))
    made=$((made + 1))
    printf "  %-46s %7s KB\n" "$(basename "$out")" "$((sz / 1024))"
  done
done

echo
echo "generated $made variant(s), skipped $skipped up-to-date, $((bytes / 1024)) KB total"
