#!/data/data/com.termux/files/usr/bin/env sh
# Runs every check that does not need a browser.
#   sh tests/run.sh
set -e
cd "$(dirname "$0")/.."

echo "== syntax"
node --check script.js
node --check tests/heart-layout.test.js
node --check tests/dom-audit.js
node --check tests/smoke.test.js

echo
node tests/heart-layout.test.js
node tests/dom-audit.js
node tests/smoke.test.js

if command -v python3 >/dev/null 2>&1; then
  if python3 -c "import PIL" >/dev/null 2>&1; then
    echo "== visual preview"
    out="${TMPDIR:-${PREFIX:-/tmp}/tmp}"
    mkdir -p "$out"
    python3 tests/render_preview.py tests/layout.json "$out/ayesha-heart.png"
    python3 tests/make_share_card.py
  else
    echo "== (Pillow missing — skipping the PNG preview)"
  fi
fi

echo "All checks green."
