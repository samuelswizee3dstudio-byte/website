#!/bin/sh
# render1.sh NAME [height] — patch saved snapshot (hide extension overlays) and render to shots/NAME.png
S=/private/tmp/claude-502/-Users-paulrutter-swizee/5036fcb7-40c2-4796-8ed1-2a594ebb9d26/scratchpad/snap
f="$S/$1.html"; [ -f "$f" ] || { echo "missing $f"; exit 1; }
grep -q 'id="__hide_ext"' "$f" || python3 - "$f" <<'PY'
import sys; p=sys.argv[1]; h=open(p,encoding='utf-8').read()
h=h.replace('</head>','<style id="__hide_ext">[id^="claude-"]{display:none!important}</style></head>',1)
open(p,'w',encoding='utf-8').write(h)
PY
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1440,${2:-820} --force-device-scale-factor=2 --virtual-time-budget=10000 \
  --screenshot="$(pwd)/shots/$1.png" "file://$f" >/dev/null 2>&1
echo "$1: $(sips -g pixelWidth -g pixelHeight "shots/$1.png" | tail -2 | awk '{print $2}' | tr '\n' 'x')"
