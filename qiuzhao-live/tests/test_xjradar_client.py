#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""xjradar MCP 客户端自测（对本地 mock 端点，不需要真实 key / 外网）。

    python3 tests/test_xjradar_client.py

覆盖：SSE 解析、initialize 握手、tools/list、tools/call、缺 key、错误 key、
工具 isError、未知工具、key 文件权限保护。
"""
import json
import os
import subprocess
import sys
import threading
import time
from http.server import HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "sources"))

import xjradar_mcp as X                      # noqa: E402
from mock_xjradar import H                   # noqa: E402

PORT = 8978
URL = f"http://127.0.0.1:{PORT}/mcp"
results: list[tuple[bool, str]] = []


def check(ok: bool, label: str, detail: str = ""):
    results.append((ok, label))
    print(f"  {'✓' if ok else '✗'} {label}" + (f"  [{detail}]" if detail and not ok else ""))


def main():
    srv = HTTPServer(("127.0.0.1", PORT), H)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    time.sleep(0.3)
    print(f"mock 端点已启动：{URL}\n")

    try:
        cli = X.XjradarMCP("k1", endpoint=URL)
        info = cli.initialize()
        check(info.get("protocolVersion") == "2025-06-18", "initialize 握手")
        check(cli._session_id == "mock-session-1", "Mcp-Session-Id 被记录",
              str(cli._session_id))

        tools = cli.tools()
        check(len(tools) == 5, f"tools/list 返回 5 个工具", f"实际 {len(tools)}")
        check({t_["name"] for t_ in tools} ==
              {"search_jobs", "list_deadlines", "get_job_detail", "get_stats", "whats_new"},
              "工具名集合正确")

        # SSE 响应体解析
        out = cli.call("get_stats")
        check('"total": 4145' in out, "get_stats 经 SSE 解析成功")
        check(isinstance(json.loads(out), dict), "返回体是合法 JSON")

        # isError 识别
        try:
            cli.call("get_job_detail", {})
            check(False, "isError 应被识别")
        except X.MCPError as e:
            check("validation error" in str(e), "isError 被识别并抛出")

        try:
            cli.call("no_such_tool", {})
            check(False, "未知工具应报错")
        except X.MCPError as e:
            check("unknown tool" in str(e), "未知工具被识别")

        # 401 路径
        bad = X.XjradarMCP("BAD", endpoint=URL)
        try:
            bad.initialize()
            check(False, "坏 key 应 401")
        except X.MCPError as e:
            check("401" in str(e) or "invalid" in str(e).lower(), "坏 key 返回 401")

        # 无 key：load_key 返回 None（隔离环境变量与真实 key 文件）
        old_key_file = X.KEY_FILE
        X.KEY_FILE = Path("/tmp/__no_such_xjradar_key__")
        os.environ.pop("XJRADAR_API_KEY", None)
        check(X.load_key() is None, "无 key 时 load_key 返回 None")
        X.KEY_FILE = old_key_file

        # key 文件权限保护
        tmpk = Path("/tmp/xjtest_key_perm")
        tmpk.write_text("secret123")
        old = X.KEY_FILE
        X.KEY_FILE = tmpk
        os.chmod(tmpk, 0o644)
        try:
            X.load_key()
            check(False, "644 权限应被拒绝")
        except X.MCPError:
            check(True, "644 权限被拒绝（防泄露）")
        os.chmod(tmpk, 0o600)
        check(X.load_key() == "secret123", "600 权限可正常读取")
        X.KEY_FILE = old
        tmpk.unlink(missing_ok=True)

    finally:
        srv.shutdown()

    passed = sum(1 for ok, _ in results if ok)
    total = len(results)
    print(f"\n{passed}/{total} 项通过")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
