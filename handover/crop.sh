#!/bin/sh
# crop.sh IN OUT X Y W H   (CSS px; image is 2x) — PyMuPDF crop, top-left origin
/private/tmp/claude-502/-Users-paulrutter-swizee/5036fcb7-40c2-4796-8ed1-2a594ebb9d26/scratchpad/venv/bin/python - "$@" <<'PY'
import sys, pymupdf
i,o,x,y,w,h=sys.argv[1],sys.argv[2],*map(int,sys.argv[3:7])
src=pymupdf.Pixmap(f'shots/{i}.png'); r=pymupdf.IRect(x*2,y*2,(x+w)*2,(y+h)*2)
out=pymupdf.Pixmap(src, r) if False else pymupdf.Pixmap(src.colorspace, r, src.alpha)
out.copy(src, r); out.save(f'shots/{o}.png'); print(o, out.width, out.height)
PY
