#!/usr/bin/env bash
# Desktop launcher: starts the Routine server in the background (only if it isn't
# already running) and opens the app in its own window. No terminal is shown.
DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
PORT="${ROUTINE_PORT:-8765}"
URL="http://127.0.0.1:$PORT/"

up() { python3 -c "import urllib.request; urllib.request.urlopen('${URL}api/health', timeout=1)" 2>/dev/null; }

if ! up; then
  mkdir -p "$DIR/data"
  nohup setsid python3 "$DIR/server.py" --port "$PORT" >>"$DIR/data/server.log" 2>&1 &
  echo $! >"$DIR/data/server.pid"
  for _ in $(seq 1 40); do up && break; sleep 0.15; done
fi

# An app window (no tabs or address bar) when a Chromium-based browser exists, else the default browser.
for b in google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge; do
  if command -v "$b" >/dev/null 2>&1; then
    exec "$b" --app="$URL" >/dev/null 2>&1
  fi
done
exec xdg-open "$URL" >/dev/null 2>&1
