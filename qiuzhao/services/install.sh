#!/usr/bin/env bash

set -euo pipefail

services_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$services_dir/.." && pwd)"
uid="$(id -u)"
domain="gui/$uid"
agents_dir="$HOME/Library/LaunchAgents"
log_dir="$HOME/Library/Logs/go-learning"
site_label="com.jiahaoqian.go-learning.site"
workbench_label="com.jiahaoqian.go-learning.workbench"
node_bin="$(command -v node || true)"
go_bin="$(command -v go || true)"
python_bin="$(command -v python3 || true)"

if [[ -z "$node_bin" ]]; then
  echo "Node.js is required to run the documentation site." >&2
  exit 1
fi

if [[ -z "$go_bin" || -z "$python_bin" ]]; then
  echo "Go and Python 3 are required to run the GoNB workbench." >&2
  exit 1
fi

runtime_path="$(dirname "$node_bin"):$(dirname "$go_bin"):$(dirname "$python_bin"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$agents_dir" "$log_dir"

npm --prefix "$project_root/site" install --no-audit --no-fund
npm --prefix "$project_root/site" run build

render_plist() {
  local template="$1"
  local destination="$2"

  sed \
    -e "s|__PROJECT_ROOT__|$project_root|g" \
    -e "s|__HOME__|$HOME|g" \
    -e "s|__LOG_DIR__|$log_dir|g" \
    -e "s|__NODE_BIN__|$node_bin|g" \
    -e "s|__RUNTIME_PATH__|$runtime_path|g" \
    "$template" >"$destination"
  plutil -lint "$destination"
}

site_plist="$agents_dir/$site_label.plist"
workbench_plist="$agents_dir/$workbench_label.plist"

launchctl bootout "$domain/$site_label" 2>/dev/null || true
launchctl bootout "$domain/$workbench_label" 2>/dev/null || true

render_plist "$services_dir/$site_label.plist.template" "$site_plist"
render_plist "$services_dir/$workbench_label.plist.template" "$workbench_plist"

launchctl enable "$domain/$site_label"
launchctl enable "$domain/$workbench_label"
launchctl bootstrap "$domain" "$site_plist"
launchctl bootstrap "$domain" "$workbench_plist"
launchctl kickstart -k "$domain/$site_label"
launchctl kickstart -k "$domain/$workbench_label"

echo "Go Learning services installed and started."
echo "Documentation: http://127.0.0.1:5174"
echo "Workbench:     http://127.0.0.1:8888/lab"
echo "Logs:          $log_dir"
