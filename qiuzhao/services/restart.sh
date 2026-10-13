#!/usr/bin/env bash

set -euo pipefail

uid="$(id -u)"
domain="gui/$uid"

launchctl kickstart -k "$domain/com.jiahaoqian.go-learning.site"
launchctl kickstart -k "$domain/com.jiahaoqian.go-learning.workbench"

echo "Go Learning services restarted."
