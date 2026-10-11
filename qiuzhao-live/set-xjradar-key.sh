#!/usr/bin/env bash
# 录入 xjradar（国央企校招）MCP 的 API key。
#
# 免费 key 需用微信扫码 https://xjradar.com 获取（10 次/天，永久有效）。
#
#   ./set-xjradar-key.sh            # 交互式粘贴 key（不回显）
#   ./set-xjradar-key.sh --check    # 只检查当前 key 状态
set -euo pipefail

KEYDIR="$HOME/.config/xjradar"
KEYFILE="$KEYDIR/api-key"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "${1:-}" = "--check" ]; then
  if [ -f "$KEYFILE" ]; then
    echo "✓ 已配置：$KEYFILE ($(wc -c <"$KEYFILE" | tr -d ' ') 字节, 权限 $(stat -f '%A' "$KEYFILE"))"
    exec python3 "$ROOT/sources/xjradar_mcp.py" --check
  fi
  echo "✗ 未配置。先用微信扫码 https://xjradar.com 获取 key，再运行本脚本"
  exit 1
fi

echo "请粘贴 xjradar API key（输入不回显），回车确认："
read -rs KEY
echo
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
if [ -z "$KEY" ]; then echo "✗ 未输入，退出"; exit 1; fi
case "$KEY" in
  *[!A-Za-z0-9_-]*) echo "✗ 含异常字符，请确认复制是否完整"; exit 1;;
esac

mkdir -p "$KEYDIR"
umask 077
printf '%s' "$KEY" > "$KEYFILE"
chmod 600 "$KEYFILE"
echo "✓ 已写入 $KEYFILE (mode 600)"

# 立即验证连通性（会消耗 1 次额度）
echo
echo "▸ 验证连通性…"
if XJRADAR_API_KEY="$KEY" python3 "$ROOT/sources/xjradar_mcp.py" --check; then
  echo
  echo "✓ 可用。现在可以跑：python3 pipeline/build.py（会自动并入国央企源）"
else
  echo
  echo "⚠ key 已保存，但当前验证失败（额度用尽 / 服务不可达 / key 无效）。"
fi
