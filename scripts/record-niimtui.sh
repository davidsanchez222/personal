#!/usr/bin/env bash
# Re-records public/casts/niimtui.cast by driving niimtui through tmux.
# Needs asciinema, tmux and niimtui on PATH. Uses an empty config dir so no
# real printers or saved designs end up in the recording.
set -euo pipefail

out=${1:-public/casts/niimtui.cast}
xdg=$(mktemp -d)
trap 'tmux -L rec kill-server 2>/dev/null || true; rm -rf "$xdg"' EXIT

t() { tmux -L rec "$@"; }
w() { perl -e "select(undef, undef, undef, $1)"; }
k() { for key in "$@"; do t send-keys -t demo "$key"; w 0.06; done; }
type_() {
  local s=$1
  for ((i = 0; i < ${#s}; i++)); do t send-keys -t demo -l "${s:i:1}"; w 0.07; done
}

t kill-server 2>/dev/null || true
t new-session -d -s demo -x 140 -y 30 \
  "XDG_CONFIG_HOME=$xdg asciinema rec --overwrite -q --idle-time-limit 1.5 -c 'niimtui tui --width-mm 50 --height-mm 30' $out"
w 2.5

# Title text, moved to the right half of the label and enlarged.
k t; w 0.8; k i; w 0.5; type_ "dsanch.com"; w 0.4; k Enter; w 0.8
for _ in $(seq 30); do k Right; done; w 0.3
for _ in $(seq 5); do k Down; done; w 0.4; k +; w 0.4; k +; w 0.8

# QR code pointed at the site, nudged left and enlarged.
k q; w 0.8; k i; w 0.6; k C-u; type_ "https://dsanch.com"; w 0.4; k Enter; w 0.8
for _ in $(seq 22); do k Left; done; k Up Up; w 0.4
k +; w 0.4; k +; w 0.8

# A couple of view toggles: grid, then invert on and off.
k g; w 1.2; k I; w 1.5; k I; w 0.6; k g
w 1.5

k C-c; w 1.5

# Drop the teardown frames so playback ends on the finished label.
python3 - "$out" <<'PY'
import json, sys
path = sys.argv[1]
header, *events = open(path).read().splitlines()
end = next(i for i, e in enumerate(events) if "\x1b[?1049l" in json.loads(e)[2])
open(path, "w").write("\n".join([header, *events[:end]]) + "\n")
PY
