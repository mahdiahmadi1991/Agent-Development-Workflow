#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
META_DIR="$SCRIPT_DIR/.vsc_launcher"
CONFIG_FILE="$META_DIR/config.env"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Launcher config not found: $CONFIG_FILE"
  exit 2
fi
source "$CONFIG_FILE"
WORKSPACE_REL="$(printf '%s' "${WORKSPACE_REL_B64:-}" | base64 -d 2>/dev/null || true)"

if [[ "$LAUNCH_MODE" == "workspace" ]]; then
  launch_target="$SCRIPT_DIR/$WORKSPACE_REL"
else
  launch_target="$SCRIPT_DIR"
fi

if [[ ! -e "$launch_target" ]]; then
  echo "Launch target not found: $launch_target"
  exit 3
fi

if [[ -d "$launch_target" ]]; then
  codex_home="$launch_target/.codex"
else
  codex_home="$(dirname "$launch_target")/.codex"
fi

mkdir -p "$codex_home"
export CODEX_HOME="$codex_home"

if [[ "${ENABLE_LOGGING:-0}" == "1" ]]; then
  logs_dir="$META_DIR/logs"
  mkdir -p "$logs_dir"
  log_file="$logs_dir/launcher-$(date +%Y%m%d).log"
  printf "%s %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "LaunchTarget=$launch_target" >> "$log_file"
  printf "%s %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "CODEX_HOME=$codex_home" >> "$log_file"
fi

if ! command -v code >/dev/null 2>&1; then
  echo "VS Code command 'code' not found in PATH."
  exit 127
fi

if command -v setsid >/dev/null 2>&1; then
  setsid -f code --new-window "$launch_target" >/dev/null 2>&1
elif command -v nohup >/dev/null 2>&1; then
  nohup code --new-window "$launch_target" >/dev/null 2>&1 &
else
  code --new-window "$launch_target" >/dev/null 2>&1 &
fi

sleep 1