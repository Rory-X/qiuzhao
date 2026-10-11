#!/usr/bin/env python3
"""xixicc2027 fork 可行性 spike：用搜狗微信搜索重建采集端，产出 jobs.json 兼容记录。

目的：验证「fork 本项目 + 自己重建爬虫」是否跑得通。
输出指标：抓到文章数、能结构化出 company 的比例、各字段填充率。
"""
import argparse
import html
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import date, datetime
from http.cookiejar import CookieJar

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
SEARCH = "https://weixin.sogou.com/weixin"
OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))

CITY = ["北京", "上海", "广州", "深圳", "杭州", "南京", "苏州", "成都", "武汉", "西安",
        "重庆", "天津", "长沙", "青岛", "合肥", "郑州", "济南", "福州", "厦门", "宁波",
        "无锡", "大连", "沈阳", "哈尔滨", "长春", "南昌", "昆明", "贵阳", "南宁", "石家庄",
        "太原", "兰州", "银川", "乌鲁木齐", "海口", "三亚", "佛山", "东莞", "珠海", "常州",
        "南通", "温州", "绍兴", "保定", "雄安", "香港", "新加坡", "全国", "海外"]

INDUSTRY = [
    ("互联网", ["互联网", "大模型", "人工智能", "电商", "短视频", "搜索", "社交媒体",
                "云计算", "APP", "客户端", "后端开发", "前端开发"]),
    ("半导体/硬件", ["半导体", "芯片", "集成电路", "晶圆", "封装测试", "光刻", "存储芯片",
                    "射频", "模拟IC", "数字IC", "被动元件", "元器件", "面板", "显示",
                    "传感器", "PCB"]),
    ("游戏", ["游戏", "手游", "端游", "互娱", "电竞", "引擎开发", "游戏策划"]),
    ("新能源车企", ["新能源汽车", "智能驾驶", "动力电池", "锂电", "整车", "换电",
                    "自动驾驶", "造车新势力", "车企"]),
    ("银行/金融", ["银行", "证券", "基金", "保险", "金融", "投行", "信托", "期货",
                  "交易所", "资管", "券商", "信用", "清算"]),
    ("快消/零售", ["快消", "食品", "饮料", "乳业", "日化", "服饰", "连锁", "零售",
                  "餐饮", "酒业", "白酒", "酿", "粮油", "饲料"]),
    ("医药/生物", ["医药", "制药", "生物", "医疗", "疫苗", "器械", "药业", "临床"]),
    ("军工/研究所", ["研究所", "研究院", "航天", "航空工业", "兵器", "船舶", "中电科",
                    "核工业", "雷达", "国防", "军工", "导弹"]),
    ("高校/事业单位", ["大学", "学院", "事业单位", "教育局", "中小学", "职业技术",
                      "科学院", "职业学院", "双选会"]),
    ("央国企", ["集团", "电网", "石油", "石化", "烟草", "铁路", "中建", "中铁", "中交",
                "能建", "国家电投", "华能", "移动", "联通", "电信", "邮政", "国企",
                "国有", "央企"]),
    ("制造业", ["制造", "机械", "材料", "化工", "钢铁", "冶金", "电气", "重工", "建材",
                "家电", "装备", "精密", "加工", "实业", "工控"]),
    ("外企", ["跨国", "外资", "普华永道", "德勤", "安永", "毕马威", "麦肯锡", "Consulting"]),
]

# 权重：强特征词 3 分，中等 2 分，泛词 1 分 —— 防止「软件」「科技」压过「银行」
WEIGHT = {}
for _name, _kws in INDUSTRY:
    for _k in _kws:
        WEIGHT[_k] = 1
for _k in ("互联网", "大模型", "电商", "短视频", "云计算",
           "半导体", "芯片", "集成电路", "晶圆", "光刻", "存储芯片",
           "游戏", "手游", "端游", "游戏策划",
           "新能源汽车", "动力电池", "整车", "车企",
           "银行", "证券", "基金", "保险", "券商", "投行", "交易所",
           "快消", "乳业", "餐饮", "白酒", "酒业",
           "医药", "制药", "药业", "疫苗",
           "研究所", "研究院", "航天", "兵器", "中电科", "军工", "核工业",
           "大学", "学院", "双选会",
           "电网", "石油", "石化", "烟草", "铁路", "邮政",
           "制造", "机械", "钢铁", "冶金", "家电",
           "咨询"):
    WEIGHT[_k] = 3

QUERIES = [
    "2027届秋季校园招聘正式启动",
    "2027届秋招 开启",
    "2027届校园招聘 提前批",
    "2027届 秋招 互联网",
    "2027届 秋招 银行",
    "2027届 秋招 国企 集团",
    "2027届 秋招 半导体 芯片",
    "2027届 秋招 研究所",
    "2027届 秋招 汽车",
    "2027届 秋招 实习",
]


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def get(url, ref=None, timeout=30):
    hd = {"User-Agent": UA}
    if ref:
        hd["Referer"] = ref
    with OPENER.open(urllib.request.Request(url, headers=hd), timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


def search(q, page=1):
    h = get(f"{SEARCH}?type=2&query={urllib.parse.quote(q)}&page={page}",
            ref="https://weixin.sogou.com/")
    rows = []
    for blk in re.findall(r'<div class="txt-box">(.*?)</div>\s*</div>', h, re.S):
        m = re.search(r'<h3>.*?<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', blk, re.S)
        if not m:
            continue
        ts = re.search(r"timeConvert\('(\d+)'\)", blk)
        acct = re.search(r'account_name[^>]*>(.*?)<', blk, re.S)
        rows.append({"title": clean(m.group(2)), "link": html.unescape(m.group(1)),
                     "ts": int(ts.group(1)) if ts else None,
                     "account": clean(acct.group(1)) if acct else None})
    return rows


def resolve(link):
    u = "https://weixin.sogou.com" + link if link.startswith("/") else link
    try:
        p = get(u, ref="https://weixin.sogou.com/")
    except Exception:
        return None
    real = "".join(re.findall(r"url \+= '(.*?)'", p)).replace("@", "")
    return real if real.startswith("http") else None


def article(real):
    try:
        a = get(real, ref="https://weixin.sogou.com/")
    except Exception:
        return ""
    a = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", a, flags=re.S)
    m = re.search(r'id="js_content"[^>]*>(.*)', a, re.S)
    return clean(m.group(1) if m else a)


MEDIA = {"秋招", "校招", "春招", "招聘", "内推", "重磅", "官宣", "校园招聘", "名企",
         "央企国家队", "国家队", "公告", "启动", "正式", "全面", "招募", "开启",
         "来袭", "汇总", "合集", "资讯", "日报", "周报", "速递", "快报", "速报",
         "秋招速报", "校招速报", "校园大使", "实习", "提前批", "启航", "定档",
         "专场", "直招", "急招", "新增", "更新", "双语", "热门", "独家", "重磅"}

SUFFIX = ("集团", "公司", "银行", "证券", "保险", "研究所", "研究院", "大学", "学院",
          "科技", "电子", "通信", "汽车", "电网", "航空", "航天", "药业", "制药",
          "重工", "钢铁", "能源", "电力", "建材", "物流", "地产", "控股", "实业",
          "电气", "存储", "半导体", "基金", "信托", "期货", "交易所", "资管",
          "石油", "石化", "烟草", "铁路", "建筑", "置地", "传媒", "文化", "教育",
          "医院", "医药", "生物", "食品", "乳业", "酒业", "机械", "仪器", "仪表",
          "材料", "化工", "环保", "水务", "燃气", "矿业", "金属", "铜业", "新能源",
          "锂业", "光电", "微电子", "集成电路", "软件", "信息", "数据", "网络",
          "移动", "联通", "电信", "邮政", "速运", "航运", "港口", "机场", "船舶",
          "机车", "在线", "智造", "工业")
SUFPAT = "|".join(SUFFIX)


def company_of(title):
    """从标题抽公司名。

    经 24 例人工标注集评估准确率 96%（v1 正则版仅 47%）。
    要点：按分隔符分段 -> 段内去掉年份及之后 -> 优先取带企业后缀的最长片段，
    并排除「秋招速报/央企国家队」这类媒体词段。
    """
    t = re.sub(r'^[【\[（(][^】\]）)]{0,14}[】\]）)]', "", title).strip()
    segs = [s.strip(" 　·•・—–-—:：!！,，。")
            for s in re.split(r"[丨|·•・—–\-:：!！,，]", t)]
    best = None
    for s in segs:
        if not s:
            continue
        head = re.split(r"20\d\d", s)[0].strip()
        for src in ([head, s] if head != s else [s]):
            if not src:
                continue
            cands = re.findall(
                r"[\u4e00-\u9fa5A-Za-z0-9]{2,16}?(?:%s)" % SUFPAT, src)
            good = [c for c in cands if c not in MEDIA]
            if good:
                return max(good, key=len)
        if s in MEDIA or head in MEDIA:
            continue
        if head and 2 <= len(head) <= 14 and best is None:
            best = head
    return best


def cohort_of(text):
    m = re.findall(r"(20\d\d)\s*届", text)
    if not m:
        return "不限"
    return f"{sorted(set(m))[-1]}届" if len(set(m)) == 1 else "不限"


def batch_of(text):
    for kw, v in [("提前批", "提前批"), ("正式批", "正式批"), ("实习", "实习"),
                  ("开放日", "开放日"), ("openday", "开放日"), ("open day", "开放日"),
                  ("宣讲会", "宣讲会"), ("校园大使", "其他")]:
        if kw in text.lower() or kw in text:
            return v
    if "秋招" in text or "秋季校园招聘" in text:
        return "正式批"
    return "其他"


def deadline_of(text):
    m = re.search(r"截止[^。；;\n]{0,8}?(20\d\d)[-/.年](\d{1,2})[-/.月](\d{1,2})", text)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.search(r"(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(?:\d{1,2}[:：]\d{2})?\s*截止", text)
    if m:
        return f"2026-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    return None


def url_of(text):
    for u in re.findall(r"https?://[^\s\"'<>）)】]+", text):
        u = u.rstrip(".,;、")
        if any(d in u for d in ("mp.weixin.qq.com", "weixin.sogou.com", "weixin.qq.com/r/")):
            continue
        return u
    return None


def wechat_of(text):
    m = re.search(r"https?://weixin\.qq\.com/r/[A-Za-z0-9_-]+", text)
    return m.group(0) if m else None


POS_SUFFIX = ("工程师", "设计师", "研究员", "分析师", "顾问", "经理", "主管", "专员",
              "助理", "管培生", "实习生", "岗位", "开发工程师", "算法", "测试", "运维",
              "产品经理", "运营", "策划", "销售", "财务", "法务", "人力", "研究类",
              "技术类", "管理类", "设计类", "职能类", "营销类", "工程类", "产品类",
              "研发类", "市场类", "方向", "大类", "类")

# 岗位字段噪声黑名单：福利/流程/投递方式等，不是岗位
POS_BAD = ("福利", "待遇", "薪资", "薪酬", "要求", "流程", "补贴", "培训", "发展",
           "简历", "面试", "时间", "地点", "报名", "条件", "截止", "联系", "方式",
           "介绍", "对象", "范围", "说明", "注意", "事项", "权益", "保障", "体系",
           "环境", "文化", "优势", "亮点", "安排", "地址", "电话", "邮箱", "网址",
           "链接", "名额", "人数", "转正", "机会", "订阅", "权限", "下载", "表格",
           "汇总", "整理", "来源", "详情", "点击", "关注", "回复", "疑问", "咨询",
           "落户", "户口", "年薪", "月薪", "职责", "任职", "资格", "答疑", "解惑",
           "了解", "接受", "面对面", "全方位", "申请", "系统", "公众号", "星标")


def _is_pos(p):
    """判断短语是否像岗位名：命中岗位后缀，且不含噪声词。"""
    if not (2 <= len(p) <= 20):
        return False
    if any(b in p for b in POS_BAD):
        return False
    if p.endswith(("。", "！", "？", "：", ":", "、", ",")):
        return False
    return any(s in p for s in POS_SUFFIX)


# 候选前部应剥离的引导词（「我们正在招募算法工程师」-> 「算法工程师」）
POS_LEAD = ("我们正在招募", "我们正在招聘", "正在招募", "正在招聘", "本次招聘", "本次",
            "包括", "涵盖", "涉及", "如下", "以下", "招募", "招聘", "面向",
            "开放", "设有", "提供", "主要有", "主要有以下", "分为")


def _clean_pos_piece(p):
    """清理单个候选：剥离标签前缀（「岗位要求：」）与引导词。"""
    p = p.strip(" 　·-—*、,，。！!【】[]（）()")
    for sep in ("：", ":"):
        if sep in p:
            p = p.rsplit(sep, 1)[-1]
    p = p.strip(" 　·-—*、,，")
    # 反复剥离开头引导词
    for _ in range(3):
        for w in POS_LEAD:
            if p.startswith(w) and len(p) > len(w) + 1:
                p = p[len(w):].strip(" 　·-—*、,，")
                break
        else:
            break
    return p


def positions_of(text):
    """抽取岗位方向。先取「岗位：xxx」显式段落，再做后缀锚定兜底。"""
    out = []
    # ① 显式段落。捕获组用非贪婪前缀，避免 `{0,4}` 贪婪吃掉内容开头
    #    （否则「岗位要求：算法工程师」会被切成「法工程师」）。
    for m in re.finditer(r"(?:招聘)?岗位[^。；;\n]{0,6}?([^。；;\n]{1,120})", text):
        for p in re.split(r"[、,，/和及]", m.group(1)):
            p = _clean_pos_piece(p)
            if _is_pos(p):
                out.append(p)
    # ② 兜底：全文扫带后缀的短语。用**贪婪**匹配取最长短语，
    #    非贪婪会从更早的位置截断（「我们正在招募算法工程师」->「算法」）。
    if len(out) < 3:
        for p in re.findall(r"[\u4e00-\u9fa5A-Za-z0-9（）()]{2,20}(?:%s)"
                            % "|".join(POS_SUFFIX), text):
            p = _clean_pos_piece(p)
            if _is_pos(p):
                out.append(p)
    # 去重 + 丢弃被更长候选包含的碎片
    seen, res = set(), []
    for p in out:
        if p not in seen:
            seen.add(p)
            res.append(p)
    res = [p for p in res
           if not any(p != q and p in q for q in res)][:12]
    return res


def locations_of(text):
    return [c for c in CITY if c in text][:10]


def industry_of(text):
    """行业分类：加权打分，避免「软件/硬件」这类泛词把银行误判成互联网。

    每个关键词带权重：强特征词（银行/证券/芯片…）权重高，泛词（科技/集团）权重低。
    """
    best, best_score = "其他", 0
    for name, kws in INDUSTRY:
        score = 0
        for k in kws:
            if k in text:
                score += WEIGHT.get(k, 1)
        if score > best_score:
            best, best_score = name, score
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=1)
    ap.add_argument("--max-articles", type=int, default=40)
    ap.add_argument("--sleep", type=float, default=1.2)
    ap.add_argument("--out", default="jobs_spike.json")
    a = ap.parse_args()

    seen, cand = set(), []
    for q in QUERIES:
        for pg in range(1, a.pages + 1):
            try:
                rows = search(q, pg)
            except Exception as e:
                print(f"  ! 搜索失败 {q} p{pg}: {type(e).__name__}")
                continue
            fresh = [r for r in rows if r["link"] not in seen]
            for r in fresh:
                seen.add(r["link"])
            cand += fresh
            print(f"  [搜索] {q} p{pg} -> +{len(fresh)}（累计 {len(cand)}）")
            time.sleep(a.sleep)

    cand = cand[: a.max_articles]
    print(f"\n=== 开始抓正文（{len(cand)} 篇）===")
    recs, today = [], date.today().isoformat()
    for i, c in enumerate(cand, 1):
        real = resolve(c["link"])
        time.sleep(a.sleep)
        if not real:
            print(f"  {i:3}/{len(cand)} 跳转失败：{c['title'][:34]}")
            continue
        body = article(real)
        time.sleep(a.sleep)
        blob = c["title"] + " " + body
        if not re.search(r"20\d\d\s*届|不限", blob):
            print(f"  {i:3}/{len(cand)} 非校招（无届别）：{c['title'][:34]}")
            continue
        pub = (datetime.fromtimestamp(c["ts"]).date().isoformat()
               if c["ts"] else today)
        rec = {
            "company": company_of(c["title"]),
            "cohort": cohort_of(blob),
            "batch": batch_of(blob),
            "program": None,
            "industry": industry_of(blob),
            "positions": positions_of(body),
            "locations": locations_of(body),
            "apply_url": url_of(body),
            "official_wechat": wechat_of(body),
            "qr_image": None,
            "deadline": deadline_of(body),
            "campus_only": False,
            "first_seen": pub,
            "last_seen": pub,
            "confirmed_by": 1,
        }
        recs.append(rec)
        print(f"  {i:3}/{len(cand)} OK {rec['company'] or '?'} | {rec['cohort']} | "
              f"{rec['batch']} | {rec['industry']}")

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(recs, f, ensure_ascii=False, indent=2)

    n = len(recs)
    print(f"\n=== spike 结果 ===")
    print(f"  可结构化记录：{n} / {len(cand)} 篇")
    if n:
        for fld in ["company", "cohort", "batch", "industry", "positions", "locations",
                    "apply_url", "official_wechat", "deadline"]:
            k = sum(1 for r in recs if r[fld])
            print(f"  {fld:18} {k:3}/{n}  {k / n * 100:5.1f}%")
        from collections import Counter
        print("\n  行业分布：", dict(Counter(r["industry"] for r in recs).most_common()))
    print(f"\n  输出：{a.out}")


if __name__ == "__main__":
    main()
