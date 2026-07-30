#!/bin/bash
#
# Regenerate the downloadable contact card at assets/vcard/rodrigo-cordova-rosado.vcf
#
# The vCard embeds a base64 JPEG, so it is generated rather than hand-edited.
# Run this after changing the photo or any contact detail:
#
#   bin/make-vcard.sh
#
# Only data already published on the site goes in: name, title, org, email, and
# public profile URLs. No phone number or postal address -- those are not in the
# repo and must not be invented.
#
# vCard 3.0 (not 4.0) because iOS and Android both import 3.0 reliably.
# Lines are folded at 75 octets and terminated CRLF, per RFC 2426.

set -euo pipefail

cd "$(dirname "$0")/.."

SRC_PHOTO="assets/img/prof_pic.jpg"
OUT_VCF="assets/vcard/rodrigo-cordova-rosado.vcf"
PHOTO_PX=400

FULL_NAME="Rodrigo Córdova Rosado"
FAMILY_NAME="Córdova Rosado"
GIVEN_NAME="Rodrigo"
TITLE="Postdoctoral Fellow"
ORG="Center for Astrophysics | Harvard & Smithsonian"
EMAIL="rodrigo.cordova_rosado@cfa.harvard.edu"
SITE_URL="https://rodelcr.github.io/"
ORCID_URL="https://orcid.org/0000-0002-7967-7676"

[ -f "$SRC_PHOTO" ] || { echo "missing $SRC_PHOTO" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Square crop matching the contact page's `object-position: center 8%`:
# with a 2:3 portrait, cover leaves (H - W) of vertical slack and 8% of that
# is the top offset, which keeps the top of the head in frame.
W=$(sips -g pixelWidth  "$SRC_PHOTO" | awk '/pixelWidth/{print $2}')
H=$(sips -g pixelHeight "$SRC_PHOTO" | awk '/pixelHeight/{print $2}')
OFFSET_Y=$(( (H - W) * 8 / 100 ))
[ "$OFFSET_Y" -lt 0 ] && OFFSET_Y=0

# Two passes on purpose: sips applies its operations in a fixed internal order,
# not the order given on the command line, so a single invocation resizes BEFORE
# it crops and you get a 266px image cropped from an already-shrunken original.
sips "$SRC_PHOTO" \
  -c "$W" "$W" --cropOffset "$OFFSET_Y" 0 \
  --out "$tmp/square.jpg" >/dev/null

sips "$tmp/square.jpg" \
  -Z "$PHOTO_PX" \
  -s format jpeg -s formatOptions 70 \
  --out "$tmp/photo.jpg" >/dev/null

echo "photo: $(sips -g pixelWidth -g pixelHeight "$tmp/photo.jpg" \
  | awk '/pixelWidth/{w=$2} /pixelHeight/{h=$2} END{print w"x"h}'), \
$(wc -c < "$tmp/photo.jpg" | tr -d ' ') bytes"

# Fold to 75 octets per RFC 2426. The first line carries the property name, so
# it gets 75 - len(prefix) payload characters; each continuation line is a
# single space plus 74 characters.
PREFIX='PHOTO;ENCODING=b;TYPE=JPEG:'
FIRST=$(( 75 - ${#PREFIX} ))
b64=$(base64 -i "$tmp/photo.jpg" | tr -d '\n')
{
  printf '%s%s\n' "$PREFIX" "${b64:0:$FIRST}"
  # The trailing newline matters: without it fold's last chunk has no line
  # terminator and END:VCARD gets appended straight onto the base64, corrupting
  # both the photo and the vCard terminator.
  printf '%s\n' "${b64:$FIRST}" | fold -w 74 | sed 's/^/ /'
} > "$tmp/photo.vcf.part"

mkdir -p "$(dirname "$OUT_VCF")"
{
  echo "BEGIN:VCARD"
  echo "VERSION:3.0"
  echo "N:${FAMILY_NAME};${GIVEN_NAME};;;"
  echo "FN:${FULL_NAME}"
  echo "TITLE:${TITLE}"
  # ORG is structured and semicolon-delimited, so the literal "|" is fine but a
  # semicolon would split the field. There is none here.
  echo "ORG:${ORG}"
  # No type=pref: there is only one address, and the extra param pushed this
  # line past the 75-octet fold limit.
  echo "EMAIL;type=INTERNET;type=WORK:${EMAIL}"
  echo "URL:${SITE_URL}"
  echo "URL:${ORCID_URL}"
  cat "$tmp/photo.vcf.part"
  echo "END:VCARD"
} | sed 's/$/\r/' > "$OUT_VCF"

echo "wrote $OUT_VCF ($(wc -c < "$OUT_VCF" | tr -d ' ') bytes)"
