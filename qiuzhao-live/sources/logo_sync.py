#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Synchronize verified company logos into the qiuzhao-live data cache.

Trust order: reviewed Simple Icons slugs, reviewed official domains, then the
optional Logo.dev name endpoint. Unknown companies intentionally remain blank
instead of accepting a possibly incorrect fuzzy-search image.
"""

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

SIMPLE_ICON_CDN = "https://cdn.simpleicons.org/{slug}"
LOGO_DEV_NAME = "https://img.logo.dev/name/{name}?token={token}&size=128&format=png&fallback=404"
USER_AGENT = "qiuzhao-live-logo-sync/1.0"

SIMPLE_ICON_ALIASES: dict[str, str] = {
    "阿里巴巴": "alibabadotcom", "阿里云": "alibabacloud", "支付宝": "alipay",
    "百度": "baidu", "哔哩哔哩": "bilibili", "b站": "bilibili",
    "字节跳动": "bytedance", "fila": "fila", "荣耀": "honor", "华为": "huawei",
    "快手": "kuaishou", "联想": "lenovo", "美团": "meituan", "minimax": "minimax",
    "网易云音乐": "neteasecloudmusic", "oppo": "oppo", "腾讯qq": "qq", "qq": "qq",
    "微博": "sinaweibo", "新浪微博": "sinaweibo", "shopee": "shopee",
    "淘宝": "taobao", "淘天": "taobao", "tripcom": "tripdotcom", "携程": "tripdotcom",
    "vivo": "vivo", "微信": "wechat", "小米": "xiaomi", "小红书": "xiaohongshu",
    "知乎": "zhihu", "deepseek": "deepseek", "深度求索": "deepseek",
    "kimi": "kimi", "月之暗面": "kimi",
}

OFFICIAL_DOMAINS: dict[str, str] = {
    "360": "360.cn", "贝壳": "ke.com", "比亚迪": "byd.com", "滴滴": "didiglobal.com",
    "格力": "gree.com", "哈啰": "hellobike.com", "海尔": "haier.com",
    "海信": "hisense.com", "虎牙": "www.huya.com", "今日头条": "toutiao.com",
    "京东": "jd.com", "科大讯飞": "iflytek.com", "理想汽车": "lixiang.com",
    "美的": "midea.com", "宁德时代": "catl.com", "拼多多": "pinduoduo.com",
    "蔚来": "nio.com", "携程": "ctrip.com", "小鹏": "xiaopeng.com",
    "星火教育": "www.xinghuo100.com", "转转": "zhuanzhuan.com", "网易": "163.com",
    "网易云音乐": "music.163.com", "金山办公": "wps.cn", "wps": "wps.cn",
    "tcl": "tcl.com",
}

GENERIC_HOSTS = {
    "mp.weixin.qq.com", "weixin.qq.com", "app.mokahr.com", "mokahr.com",
    "zhaopin.com", "www.zhaopin.com", "jobs.51job.com", "51job.com",
    "liepin.com", "www.liepin.com", "bosszhipin.com", "www.zhipin.com",
    "zhiye.com", "www.zhiye.com", "sasac.gov.cn", "www.sasac.gov.cn",
}


def normalize_company(value: str) -> str:
    value = (value or "").lower().replace("offerstar·", "")
    value = re.sub(r"[（(].*?[)）]", "", value)
    value = re.sub(r"(股份有限公司|有限责任公司|有限公司|集团|科技|公司)$", "", value)
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]", "", value)


def match_mapping(company: str, mapping: dict[str, str]) -> str | None:
    normalized = normalize_company(company)
    for alias in sorted(mapping, key=len, reverse=True):
        key = normalize_company(alias)
        if normalized == key or (len(key) >= 2 and key in normalized):
            return mapping[alias]
    return None


def safe_name(value: str) -> str:
    cleaned = re.sub(r"[^0-9a-z.-]+", "-", value.lower()).strip("-.")
    return cleaned[:80] or hashlib.sha1(value.encode("utf-8")).hexdigest()[:16]


def request(url: str, timeout: int = 12) -> tuple[bytes, str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "image/*,text/html;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read(1_500_000), response.headers.get_content_type(), response.geturl()


def detect_extension(body: bytes, content_type: str) -> str | None:
    head = body[:300].lstrip().lower()
    if b"<svg" in head or content_type == "image/svg+xml": return ".svg"
    if body.startswith(b"\x89PNG\r\n\x1a\n") or content_type == "image/png": return ".png"
    if body.startswith(b"\xff\xd8\xff") or content_type in {"image/jpeg", "image/jpg"}: return ".jpg"
    if body.startswith((b"\x00\x00\x01\x00", b"\x00\x00\x02\x00")) or content_type in {"image/x-icon", "image/vnd.microsoft.icon"}: return ".ico"
    if body.startswith(b"RIFF") and body[8:12] == b"WEBP": return ".webp"
    guessed = mimetypes.guess_extension(content_type or "")
    return guessed if guessed in {".svg", ".png", ".jpg", ".jpeg", ".ico", ".webp"} else None


class IconLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.urls: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() != "link": return
        values = {str(key).lower(): value for key, value in attrs}
        rel, href = str(values.get("rel") or "").lower(), values.get("href")
        if href and "icon" in rel: self.urls.append(str(href))


def write_logo(directory: Path, stem: str, body: bytes, content_type: str) -> str | None:
    ext = detect_extension(body, content_type)
    if not ext or len(body) < 64: return None
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / f"{safe_name(stem)}{ext}"
    tmp = destination.with_suffix(destination.suffix + ".tmp")
    tmp.write_bytes(body)
    tmp.replace(destination)
    return f"logos/{destination.name}"


def cached(directory: Path, stem: str) -> str | None:
    item = next(directory.glob(f"{safe_name(stem)}.*"), None) if directory.exists() else None
    return f"logos/{item.name}" if item else None


def fetch_simple_icon(slug: str, directory: Path) -> tuple[str | None, str | None]:
    stem = f"si-{slug}"
    path = cached(directory, stem)
    if path: return path, f"simple-icons:{slug}"
    try:
        body, content_type, _ = request(SIMPLE_ICON_CDN.format(slug=urllib.parse.quote(slug, safe="")))
        path = write_logo(directory, stem, body, content_type)
        return path, f"simple-icons:{slug}" if path else None
    except Exception:
        return None, None


def fetch_official_favicon(domain: str, directory: Path) -> tuple[str | None, str | None]:
    stem = f"domain-{domain}"
    path = cached(directory, stem)
    if path: return path, f"official-domain:{domain}"
    candidates = [f"https://{domain}/favicon.ico"]
    try:
        html, content_type, final_url = request(f"https://{domain}/", timeout=10)
        if content_type == "text/html":
            parser = IconLinkParser()
            parser.feed(html.decode("utf-8", errors="ignore"))
            candidates = [urllib.parse.urljoin(final_url, item) for item in parser.urls] + candidates
    except Exception:
        pass
    for url in candidates[:6]:
        try:
            body, content_type, _ = request(url)
            path = write_logo(directory, stem, body, content_type)
            if path: return path, f"official-domain:{domain}"
        except Exception:
            continue
    return None, None


def fetch_logo_dev(company: str, token: str, directory: Path) -> tuple[str | None, str | None]:
    stem = f"logo-dev-{hashlib.sha1(normalize_company(company).encode()).hexdigest()[:16]}"
    path = cached(directory, stem)
    if path: return path, "logo.dev:name"
    url = LOGO_DEV_NAME.format(name=urllib.parse.quote(company, safe=""), token=urllib.parse.quote(token, safe=""))
    try:
        body, content_type, _ = request(url)
        path = write_logo(directory, stem, body, content_type)
        return path, "logo.dev:name" if path else None
    except Exception:
        return None, None


def task_for(company: str, apply_url: str | None, logo_dev_token: str | None):
    slug = match_mapping(company, SIMPLE_ICON_ALIASES)
    if slug: return "simple-icons", slug
    domain = match_mapping(company, OFFICIAL_DOMAINS)
    if not domain and apply_url:
        host = urllib.parse.urlparse(apply_url).netloc.lower().split(":", 1)[0]
        root = host.removeprefix("www.")
        if host and host not in GENERIC_HOSTS and root not in GENERIC_HOSTS and not root.endswith(".zhiye.com"):
            domain = root
    if domain: return "official-domain", domain
    if logo_dev_token: return "logo.dev", company
    return None


def sync_logos(jobs: list[dict], root: Path) -> tuple[list[dict], dict]:
    directory = root / "data" / "logos"
    manifest_path = root / "data" / "logo_manifest.json"
    try:
        previous = json.loads(manifest_path.read_text(encoding="utf-8")).get("companies", {})
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        previous = {}
    token = os.environ.get("LOGO_DEV_PUBLISHABLE_KEY", "").strip() or None
    max_remote = max(1, int(os.environ.get("LOGO_SYNC_LIMIT", "120")))
    companies = {normalize_company(job.get("company", "")): job.get("company", "") for job in jobs}
    resolved, pending = {}, {}
    for key, company in companies.items():
        old = previous.get(key) if isinstance(previous, dict) else None
        if isinstance(old, dict) and old.get("path") and (root / "data" / old["path"]).is_file():
            resolved[key] = old
            continue
        apply_url = next((job.get("apply_url") for job in jobs if normalize_company(job.get("company", "")) == key and job.get("apply_url")), None)
        task = task_for(company, apply_url, token)
        if task and len(pending) < max_remote: pending[key] = task

    def run(item):
        key, (kind, value) = item
        if kind == "simple-icons": path, source = fetch_simple_icon(value, directory)
        elif kind == "official-domain": path, source = fetch_official_favicon(value, directory)
        else: path, source = fetch_logo_dev(companies[key], token or "", directory)
        return key, path, source

    with ThreadPoolExecutor(max_workers=min(10, max(1, len(pending)))) as pool:
        for future in as_completed([pool.submit(run, item) for item in pending.items()]):
            key, path, source = future.result()
            if path:
                resolved[key] = {"company": companies[key], "path": path, "source": source, "updated_at": datetime.now(timezone.utc).isoformat()}

    for job in jobs:
        entry = resolved.get(normalize_company(job.get("company", "")))
        job["logo_path"] = entry.get("path") if entry else None
        job["logo_source"] = entry.get("source") if entry else None
    manifest_path.write_text(json.dumps({"version": 1, "updated_at": datetime.now(timezone.utc).isoformat(), "companies": resolved}, ensure_ascii=False, indent=2), encoding="utf-8")
    return jobs, {
        "resolved": len(resolved), "checked": len(pending),
        "simple_icons": sum(str(item.get("source", "")).startswith("simple-icons:") for item in resolved.values()),
        "official_domains": sum(str(item.get("source", "")).startswith("official-domain:") for item in resolved.values()),
        "logo_dev": sum(str(item.get("source", "")).startswith("logo.dev:") for item in resolved.values()),
    }
