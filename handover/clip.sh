#!/bin/sh
# clip.sh NAME [height] — save clipboard snapshot then render
S=/private/tmp/claude-502/-Users-paulrutter-swizee/5036fcb7-40c2-4796-8ed1-2a594ebb9d26/scratchpad/snap; mkdir -p "$S"
LANG=en_US.UTF-8 pbpaste > "$S/$1.html"
sz=$(wc -c < "$S/$1.html"); [ "$sz" -gt 100000 ] || { echo "clipboard too small ($sz)"; exit 1; }
exec ./render1.sh "$1" "$2"
