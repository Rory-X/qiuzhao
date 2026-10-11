#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地 mock 的 MCP 端点，用于在没有真实 key / 网络时验证客户端实现。

模拟 xjradar 三件事：
  1. 校验 X-API-Key（缺失返回 401 + 提示语）
  2. initialize / notifications/initialized / tools/list / tools/call
  3. 响应体用 SSE（data: {...}）格式，覆盖客户端的 SSE 解析分支

用法：python3 tests/mock_xjradar.py [port]
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

TOOLS = [
    {"name": "search_jobs", "description": "按条件搜索国央企校招岗位/招聘项目。",
     "inputSchema": {"type": "object", "properties": {
         "city": {}, "major": {}, "graduate_year": {}, "keywords": {},
         "kind": {}, "org_nature": {}, "employment_type": {},
         "only_open": {}, "limit": {}, "offset": {}}}},
    {"name": "list_deadlines", "description": "列出未来 N 天内截止的招聘项目/岗位。",
     "inputSchema": {"type": "object", "properties": {
         "days_within": {}, "include_events": {}, "org_nature": {}}}},
    {"name": "get_job_detail", "description": "按 id 取单条岗位全字段。",
     "inputSchema": {"type": "object", "properties": {"job_id": {}}}},
    {"name": "get_stats", "description": "数据总览。",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "whats_new", "description": "最近 N 天新收录 + 未来 N 天即将截止。",
     "inputSchema": {"type": "object", "properties": {"days": {}, "limit": {}}}},
]

CALLS = {
    "get_stats": {"total": 4145, "open": 1500, "sources": 24,
                  "by_nature": {"央国企": 1200, "地方国企": 300},
                  "new_today": 12, "new_7d": 88, "data_as_of": "2026-09-22"},
    "list_deadlines": {"count": 2, "items": [
        {"id": "a1", "org": "华润集团", "title": "2027届管培生",
         "deadline": "2026-09-30", "days_left": 8, "apply_url": "https://example.com/a1"},
        {"id": "a2", "org": "中国邮政", "title": "金融科技岗",
         "deadline": "2026-10-05", "days_left": 13, "apply_url": "https://example.com/a2"}]},
    "search_jobs": {"count": 2, "items": [
        {"id": "b1", "org": "中国移动广东公司", "title": "数据分析",
         "city": "深圳", "major": "计算机相关", "open": True},
        {"id": "b2", "org": "南方电网", "title": "软件开发",
         "city": "广州", "major": "软件工程", "open": True}]},
    "whats_new": {"new": [{"id": "c1", "org": "国聘", "title": "综合岗"}],
                  "closing_soon": []},
}


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n).decode("utf-8", "replace")
        key = self.headers.get("X-API-Key", "")
        if not key:
            return self._send(401, json.dumps(
                {"error": "缺少或无效的 API key。请在请求头加 X-API-Key"
                          "（免费获取：https://xjradar.com ）"}))
        if key == "BAD":
            return self._send(401, json.dumps({"error": "invalid api key"}))
        try:
            req = json.loads(raw)
        except Exception:
            return self._send(400, json.dumps({"error": "bad json"}))

        method = req.get("method")
        if "id" not in req:                      # 通知：不回体
            self.send_response(202)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        rid = req["id"]
        headers = {"Mcp-Session-Id": "mock-session-1"} if method == "initialize" else {}

        if method == "initialize":
            result = {"protocolVersion": "2025-06-18",
                      "serverInfo": {"name": "campus-jobs-radar", "version": "1.1.0-mock"},
                      "capabilities": {"tools": {}}}
        elif method == "tools/list":
            result = {"tools": TOOLS}
        elif method == "tools/call":
            name = (req.get("params") or {}).get("name")
            args = (req.get("params") or {}).get("arguments") or {}
            if name == "get_job_detail":
                if not args.get("job_id"):
                    result = {"isError": True,
                              "content": [{"type": "text",
                                           "text": "1 validation error: job_id required"}]}
                else:
                    result = {"content": [{"type": "text",
                                           "text": json.dumps({"id": args["job_id"],
                                                               "org": "华润集团"}, ensure_ascii=False)}]}
            elif name in CALLS:
                result = {"content": [{"type": "text",
                                       "text": json.dumps(CALLS[name], ensure_ascii=False)}]}
            else:
                result = {"isError": True,
                          "content": [{"type": "text", "text": f"unknown tool {name}"}]}
        else:
            return self._send(200, "data: " + json.dumps(
                {"jsonrpc": "2.0", "id": rid,
                 "error": {"code": -32601, "message": "method not found"}}) + "\n\n")

        body = "data: " + json.dumps(
            {"jsonrpc": "2.0", "id": rid, "result": result}, ensure_ascii=False) + "\n\n"
        self._send(200, body, ctype="text/event-stream", extra=headers)

    def _send(self, code, body, ctype="application/json", extra=None):
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8977
    print(f"mock MCP 端点在 http://127.0.0.1:{port}/mcp")
    HTTPServer(("127.0.0.1", port), H).serve_forever()
