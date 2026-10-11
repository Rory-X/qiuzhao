#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""国央企校招 MCP 客户端（campus-jobs-radar）。

端点：https://mcp.xjradar.com/mcp  （Streamable HTTP，JSON-RPC 2.0）
鉴权：请求头 X-API-Key: <key>
      免费 key 需在 https://xjradar.com 微信扫码获取（10 次/天，永久有效）

本模块只依赖标准库，实现 MCP 的 initialize → tools/list → tools/call 三步。

凭证读取顺序：
  1. 环境变量 XJRADAR_API_KEY
  2. 文件 ~/.config/xjradar/api-key（mode 600，单行）
绝不把 key 写进代码或仓库。

用法：
  python3 sources/xjradar_mcp.py --check                 # 连通性 + 工具清单
  python3 sources/xjradar_mcp.py --stats                 # 数据总览
  python3 sources/xjradar_mcp.py --deadlines 14          # 未来 14 天截止
  python3 sources/xjradar_mcp.py --search --city 深圳 --major 计算机
  python3 sources/xjradar_mcp.py --new 3                 # 近 3 天动态
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ENDPOINT = os.environ.get("XJRADAR_MCP_URL", "https://mcp.xjradar.com/mcp")
KEY_FILE = Path.home() / ".config" / "xjradar" / "api-key"
PROTOCOL = "2025-06-18"
UA = "qiuzhao-live/xjradar-mcp"


class MCPError(RuntimeError):
    pass


def load_key() -> str | None:
    k = os.environ.get("XJRADAR_API_KEY", "").strip()
    if k:
        return k
    if KEY_FILE.exists():
        # 文件权限必须收紧，否则拒绝读取（避免 key 泄露）
        mode = KEY_FILE.stat().st_mode & 0o777
        if mode & 0o077:
            raise MCPError(
                f"{KEY_FILE} 权限过宽（{oct(mode)}），请先执行 chmod 600 {KEY_FILE}")
        v = KEY_FILE.read_text(encoding="utf-8").strip()
        if v:
            return v
    return None


class XjradarMCP:
    """极简 Streamable-HTTP MCP 客户端。"""

    def __init__(self, key: str, endpoint: str = ENDPOINT, timeout: int = 60):
        self.key = key
        self.endpoint = endpoint
        self.timeout = timeout
        self._id = 0
        self._session_id: str | None = None

    def _post(self, method: str, params: dict | None = None,
              *, notification: bool = False) -> dict | None:
        self._id += 1
        payload: dict = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            payload["params"] = params
        if not notification:
            payload["id"] = self._id

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": UA,
            "X-API-Key": self.key,
        }
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id

        req = urllib.request.Request(
            self.endpoint, data=json.dumps(payload).encode("utf-8"),
            headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                sid = resp.headers.get("Mcp-Session-Id") or resp.headers.get("mcp-session-id")
                if sid:
                    self._session_id = sid
                body = resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            raise MCPError(f"HTTP {e.code}: {detail}") from None
        except Exception as e:
            raise MCPError(f"连接失败：{e}") from None

        if not body.strip():
            return None
        return self._parse(body)

    @staticmethod
    def _parse(body: str) -> dict:
        """响应可能是纯 JSON，也可能是 SSE（data: {...}）。"""
        text = body.strip()
        if text.startswith("{"):
            return json.loads(text)
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                chunk = line[5:].strip()
                if chunk and chunk != "[DONE]":
                    try:
                        return json.loads(chunk)
                    except json.JSONDecodeError:
                        continue
        raise MCPError(f"无法解析响应：{body[:200]}")

    def initialize(self) -> dict:
        r = self._post("initialize", {
            "protocolVersion": PROTOCOL,
            "capabilities": {},
            "clientInfo": {"name": "qiuzhao-live", "version": "1.0"},
        })
        if r is None:
            raise MCPError("initialize 无响应")
        if "error" in r:
            raise MCPError(f"initialize 失败：{r['error']}")
        try:
            self._post("notifications/initialized", {}, notification=True)
        except Exception:
            pass   # 部分实现不接受该通知，忽略
        return r.get("result") or {}

    def tools(self) -> list[dict]:
        r = self._post("tools/list", {})
        if r is None or "error" in r:
            raise MCPError(f"tools/list 失败：{(r or {}).get('error')}")
        return (r.get("result") or {}).get("tools") or []

    def call(self, name: str, arguments: dict | None = None) -> str:
        r = self._post("tools/call", {"name": name, "arguments": arguments or {}})
        if r is None:
            raise MCPError("tools/call 无响应")
        if "error" in r:
            raise MCPError(f"{name} 失败：{r['error']}")
        result = r.get("result") or {}
        if result.get("isError"):
            parts = [c.get("text", "") for c in result.get("content") or []]
            raise MCPError(f"{name} 返回错误：{' '.join(parts)[:300]}")
        out = []
        for c in result.get("content") or []:
            if c.get("type") == "text":
                out.append(c.get("text", ""))
        # 有些实现把结构化结果放在 structuredContent
        if not out and result.get("structuredContent") is not None:
            out.append(json.dumps(result["structuredContent"], ensure_ascii=False))
        return "\n".join(out)


def _fmt(text: str) -> str:
    """尽力把 JSON 输出格式化，便于阅读。"""
    try:
        return json.dumps(json.loads(text), ensure_ascii=False, indent=2)
    except Exception:
        return text


def main():
    ap = argparse.ArgumentParser(description="国央企校招 MCP 客户端")
    ap.add_argument("--check", action="store_true", help="连通性检查 + 工具清单")
    ap.add_argument("--stats", action="store_true", help="数据总览 get_stats")
    ap.add_argument("--deadlines", type=int, metavar="N", help="未来 N 天截止")
    ap.add_argument("--new", type=int, metavar="N", help="近 N 天动态 whats_new")
    ap.add_argument("--search", action="store_true", help="搜索岗位 search_jobs")
    ap.add_argument("--city"), ap.add_argument("--major"),
    ap.add_argument("--keywords"), ap.add_argument("--year"),
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--json", action="store_true", help="输出原始 JSON")
    args = ap.parse_args()

    try:
        key = load_key()
    except MCPError as e:
        print(f"✗ {e}", file=sys.stderr)
        return 2
    if not key:
        print("✗ 未找到 API key。\n"
              "  1) 用微信扫码 https://xjradar.com 获取免费 key（10 次/天，永久有效）\n"
              f"  2) mkdir -p {KEY_FILE.parent} && printf '%s' '<你的key>' > {KEY_FILE}\n"
              f"  3) chmod 600 {KEY_FILE}\n"
              "  或设环境变量 XJRADAR_API_KEY", file=sys.stderr)
        return 2

    cli = XjradarMCP(key)
    try:
        info = cli.initialize()
        print(f"✓ 已连接：{info.get('serverInfo', {}).get('name', 'campus-jobs-radar')} "
              f"v{info.get('serverInfo', {}).get('version', '?')} "
              f"(protocol {info.get('protocolVersion', '?')})")

        if args.check:
            for t in cli.tools():
                props = list(((t.get("inputSchema") or {}).get("properties") or {}).keys())
                print(f"  ▸ {t['name']}  参数: {', '.join(props) or '-'}")
                desc = (t.get("description") or "").strip().splitlines()
                if desc:
                    print(f"      {desc[0][:90]}")
            return 0

        if args.stats:
            print(_fmt(cli.call("get_stats")))
        if args.deadlines is not None:
            print(_fmt(cli.call("list_deadlines",
                                {"days_within": args.deadlines,
                                 "org_nature": "国央企"})))
        if args.new is not None:
            print(_fmt(cli.call("whats_new", {"days": args.new,
                                              "limit": args.limit})))
        if args.search:
            a: dict = {"limit": args.limit, "org_nature": "国央企"}
            if args.city: a["city"] = args.city
            if args.major: a["major"] = args.major
            if args.keywords: a["keywords"] = args.keywords
            if args.year: a["graduate_year"] = args.year
            print(_fmt(cli.call("search_jobs", a)))
        if not any([args.check, args.stats, args.deadlines is not None,
                    args.new is not None, args.search]):
            ap.print_help()
        return 0
    except MCPError as e:
        print(f"✗ {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
