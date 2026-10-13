#!/usr/bin/env bash

set -euo pipefail

uid="$(id -u)"
domain="gui/$uid"
site_label="com.jiahaoqian.go-learning.site"
workbench_label="com.jiahaoqian.go-learning.workbench"

show_service() {
  local label="$1"

  echo "[$label]"
  launchctl print "$domain/$label" | awk '
    /^[[:space:]]*state =/ ||
    /^[[:space:]]*pid =/ ||
    /^[[:space:]]*last exit code =/ { sub(/^[[:space:]]*/, ""); print }
  '
}

show_service "$site_label"
show_service "$workbench_label"

curl --fail --silent --show-error --output /dev/null http://127.0.0.1:5174/
echo "VitePress:  healthy (http://127.0.0.1:5174)"

curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8888/lab
echo "JupyterLab: healthy (http://127.0.0.1:8888/lab)"

kernels="$(curl --fail --silent http://127.0.0.1:8888/api/kernelspecs)"
if [[ "$kernels" != *'"gonb"'* ]]; then
  echo "GoNB kernel is missing." >&2
  exit 1
fi
echo "GoNB:       registered"
