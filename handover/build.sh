#!/bin/sh
# Renders guide.html to ../HANDOVER.pdf with headless Chrome.
cd "$(dirname "$0")"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --no-pdf-header-footer --virtual-time-budget=10000 \
  --print-to-pdf="$(pwd)/../HANDOVER.pdf" "file://$(pwd)/guide.html" 2>/dev/null
ls -la ../HANDOVER.pdf
