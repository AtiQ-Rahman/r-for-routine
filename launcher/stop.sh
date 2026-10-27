#!/usr/bin/env bash
# Stops the background Routine server started by start.sh.
DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
PID_FILE="$DIR/data/server.pid"
if [ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "Routine server stopped."
else
  echo "Routine server was not running."
fi
