#!/usr/bin/env bash
# 一键刷新：拉取数据 → 归一化 → 渲染页面 → 起服务
#   ./refresh.sh          # 刷新并起服务（默认 8901）
#   ./refresh.sh 9000     # 指定端口
#   ./refresh.sh --no-serve
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8901
SERVE=1
if [ "${1:-}" = "--no-serve" ]; then SERVE=0
elif [ -n "${1:-}" ]; then PORT="$1"; fi

cd "$ROOT"
echo "▸ 1/2 拉取并归一化数据…"
rm -f data/raw/campus_radar.db        # 强制重下上游最新库
python3 pipeline/build.py

echo
echo "▸ 2/2 渲染页面…"
python3 pipeline/render.py
cp data/jobs.json dist/jobs.json

if [ "$SERVE" -eq 1 ]; then
  echo
  echo "→ http://127.0.0.1:${PORT}/"
  exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory dist
else
  echo
  echo "页面已生成：$ROOT/dist/index.html（未起服务）"
fi
