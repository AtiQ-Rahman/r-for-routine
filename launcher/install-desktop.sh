#!/usr/bin/env bash
# Adds a "Routine" icon to the app menu and the Desktop (Linux).
set -e
DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
chmod +x "$DIR/launcher/start.sh" "$DIR/launcher/stop.sh"

APPS="$HOME/.local/share/applications"
DESK="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
mkdir -p "$APPS" "$DESK"

ENTRY="[Desktop Entry]
Type=Application
Version=1.0
Name=Routine
GenericName=Study routine
Comment=Daily study routine tracker
Exec=\"$DIR/launcher/start.sh\"
Icon=$DIR/static/icon-256.png
Terminal=false
Categories=Education;
StartupNotify=true"

printf '%s\n' "$ENTRY" >"$APPS/routine.desktop"
printf '%s\n' "$ENTRY" >"$DESK/Routine.desktop"
chmod +x "$APPS/routine.desktop" "$DESK/Routine.desktop"
# GNOME: mark the desktop file as trusted so it launches on double-click
gio set "$DESK/Routine.desktop" metadata::trusted true 2>/dev/null || true
update-desktop-database "$APPS" 2>/dev/null || true

echo "Installed: $DESK/Routine.desktop and the app menu entry."
