#!/usr/bin/env bash

set -euo pipefail

uid="$(id -u)"
domain="gui/$uid"
agents_dir="$HOME/Library/LaunchAgents"
site_label="com.jiahaoqian.go-learning.site"
workbench_label="com.jiahaoqian.go-learning.workbench"

launchctl bootout "$domain/$site_label" 2>/dev/null || true
launchctl bootout "$domain/$workbench_label" 2>/dev/null || true
rm -f "$agents_dir/$site_label.plist" "$agents_dir/$workbench_label.plist"

echo "Go Learning services stopped and removed from launchd."
