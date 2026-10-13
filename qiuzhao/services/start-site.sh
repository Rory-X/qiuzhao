#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site_dir="$project_root/site"
vitepress_cli="$site_dir/node_modules/vitepress/bin/vitepress.js"
node_bin="${NODE_BIN:-$(command -v node || true)}"
port="${PORT:-5174}"

if [[ -z "$node_bin" || ! -x "$node_bin" ]]; then
  echo "Node.js executable is unavailable: ${node_bin:-not found}" >&2
  exit 1
fi

if [[ ! -f "$vitepress_cli" ]]; then
  echo "VitePress is not installed. Run: npm --prefix '$site_dir' install" >&2
  exit 1
fi

cd "$site_dir"
exec "$node_bin" "$vitepress_cli" dev . \
  --host 127.0.0.1 \
  --port "$port" \
  --strictPort
