#!/usr/bin/env bash
# 本地预览 xixicc2027 秋招时间轴
#   ./serve.sh          # 默认 8899 端口
#   ./serve.sh 9000     # 指定端口
set -euo pipefail

PORT="${1:-8899}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$ROOT/dist"

if [ ! -f "$DIST/index.html" ]; then
  echo "dist/index.html 不存在，正在重新生成…"
  mkdir -p "$DIST"
  python3 "$ROOT/skill/qiuzhao-feed/scripts/fetch_render.py" \
    --no-open --out "$DIST/index.html" >/dev/null
  cp "$ROOT/jobs.json" "$DIST/"
  cp -r "$ROOT/qr" "$DIST/" 2>/dev/null || true
fi

echo "→ http://127.0.0.1:${PORT}/"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIST"
