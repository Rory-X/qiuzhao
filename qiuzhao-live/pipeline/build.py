#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""秋招数据归一化管线。

把多个活跃数据源统一成喜茶模板所需的 jobs.json schema。

数据源：
  1. ruyi1/campus-radar 的 data/jobs.db（SQLite，JD/快手/小红书/拼多多/淘天/OfferStar）
     —— 1797 条真实岗位、965 家公司，全部带投递 URL，last_seen 每日刷新
  2. 龙哥27届秋招汇总表（腾讯文档 smartsheet，公开 API 无需凭据）
     —— 187 家，含工作地点 / 截止时间 / 内推码

输出 schema（与原 xixicc2027 一致，模板无需改动）：
  company, cohort, batch, program, industry, positions[], locations[],
  apply_url, official_wechat, qr_image, deadline, campus_only,
  first_seen, last_seen, confirmed_by
"""
from __future__ import annotations

import json
import re
import sqlite3
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "jobs.json"

CAMPUS_RADAR_DB = (
    "https://raw.githubusercontent.com/ruyi1/campus-radar/main/data/jobs.db"
)

# ─────────────────────────────────────────────────────────────
# 行业分类：公司名 → 行业（对齐喜茶模板的 IND_ORDER 取值）
#
# 两级判定，避免模糊词误伤：
#   1) EXACT 精确名（优先，如「中信出版集团」→ 其他，而非因"中信"落入金融）
#   2) 关键词子串匹配
# ─────────────────────────────────────────────────────────────
INDUSTRY_EXACT: dict[str, str] = {
    # 名字含金融系关键词但实为其他行业
    "中信出版集团": "其他", "中信国安": "其他", "中信城开": "其他",
    "中信金属": "其他", "中信重工": "制造业", "中信期货": "银行/金融",
    "上实集团": "央国企", "上海国际集团": "银行/金融",
    "中国外运": "央国企", "中国南山": "央国企", "中国国新": "银行/金融",
    "中粮集团": "快消/零售", "中化": "制造业", "中国化学": "制造业",
    "MetaApp": "互联网", "SHEIN": "快消/零售", "Sea": "互联网",
    "Shopee": "互联网", "BOSS 直聘": "互联网", "BOSS直聘": "互联网",
    "BOE": "半导体/硬件", "万得 Wind": "银行/金融", "Wind": "银行/金融",
    "RoboSense速腾聚创": "半导体/硬件", "TTC": "制造业",
    "FunPlus": "游戏", "FunPlus趣加": "游戏", "tap4fun": "游戏",
    "IEF爱依服": "快消/零售", "kk集团": "快消/零售", "ZURU（玩具外企）": "外企",
    "九牧王": "快消/零售", "九牧集团": "快消/零售", "FILA": "快消/零售",
    "SHEIN": "快消/零售", "七色纺": "快消/零售", "三福": "快消/零售",
    "乐读": "其他", "学而思": "其他", "伽利略": "半导体/硬件",
    "优理奇机器人": "制造业", "佑驾创新": "新能源车企",
    "亨通集团": "制造业", "中海达": "半导体/硬件", "中控信息": "互联网",
    "X-MOTORS": "传统车企", "VARINNO望汭自动化": "制造业",
    "上海贝岭": "半导体/硬件", "上海光通信": "半导体/硬件",
    "中邮科技": "制造业", "九洲集团": "军工/研究所",
    "九同方": "半导体/硬件", "会世资产": "银行/金融", "九坤投资（揽月计划）": "银行/金融",
    "中证信用": "银行/金融", "中国人寿集团": "银行/金融",
    "中国通信服务广东公司": "央国企", "中国东信": "互联网",
    "中起航集团": "央国企", "乐信圣文": "游戏", "乐享元游": "游戏",
    "云南金诺教育集团": "其他", "亚特电器": "制造业",
    "乔锋智能": "制造业", "九江金鹭": "制造业", "伊控动力": "新能源车企",
    "丰疆智能": "制造业", "临界点": "其他", "久尺网络ToDesk": "互联网",
    # 运营商/大型央企归「央国企」（比归入军工/研究所更准确）
    "中国电信": "央国企", "中国移动": "央国企", "中国联通": "央国企",
    "中国电子": "央国企", "中国电科": "央国企", "中国平安": "银行/金融",
    "中国经济": "央国企", "中国建筑": "央国企", "中国中车": "央国企",
    "中国铁建": "央国企", "中国中铁": "央国企", "中国交建": "央国企",
}

INDUSTRY_RULES: list[tuple[str, list[str]]] = [
    # 央国企优先判定：三大运营商 + 大型央企总部（避免被下面的"军工/研究所"
    # 或"制造业"关键词误吞）。注意用具体词而非泛化的"中国"。
    ("央国企", ["中国电信", "中国移动", "中国联通", "中国电子", "中国电科",
                "中国外运", "中国南山", "中国国新", "中国通信服务",
                "中国建筑", "中国中车", "中国铁建", "中国中铁", "中国交建",
                "国家电网", "南方电网", "国家能源", "中国华能", "中国大唐",
                "中国华电", "国家电投", "中国三峡", "中广核", "中核集团",
                "中国石油", "中国石化", "中国海油", "中石油", "中石化",
                "中国邮政", "中国五矿", "中国中化", "通用技术", "国机集团",
                "上实集团", "中起航", "深圳市特区建工", "广州公交", "广州港",
                "成都设计咨询", "陕西旅游", "绿城中国", "安徽省能源",
                "申能集团", "物产中大", "建发集团", "象屿", "国贸股份"]),
    ("游戏", ["游戏", "米哈游", "莉莉丝", "鹰角", "叠纸", "完美世界", "巨人网络",
              "三七互娱", "游卡", "网易游戏", "心动", "TapTap", "沐瞳", "散爆",
              "库洛", "乐狗", "波克", "贪玩", "掌趣", "冰川", "火溶",
              "百奥", "诗悦", "深蓝互动", "青瓷", "盛趣", "游酷", "极致游戏",
              "望尘科技", "姚记", "金山世游", "多益", "光宇", "网龙",
              "吉比特", "雷霆", "游族", "飞鱼科技", "友塔"]),
    ("银行/金融", ["银行", "证券", "基金", "保险", "信托", "期货", "金融",
                  "平安产险", "平安人寿", "平安理财", "平安银行",
                  "招商银行", "招银", "广发银行", "广发期货", "国信证券",
                  "东方财富", "国泰君安", "申万宏源", "申万菱信", "中金公司",
                  "中金财富", "安信基金", "鹏华基金", "南方基金", "易方达",
                  "嘉实基金", "银华基金", "永赢基金", "兴银", "汇添富",
                  "中欧基金", "万家基金", "马上消费", "瀚华", "倍漾量化",
                  "九方智投", "高金富恒", "海西金租", "国任保险", "众安",
                  "太平", "泰康", "阳光保险", "民生银行", "浦发银行",
                  "兴业银行", "华夏银行", "渤海银行", "杭州银行", "宁波银行",
                  "瑞丰银行", "泰隆银行", "哈尔滨银行", "广州农商", "浙江农商",
                  "三湘银行", "上海国际信托", "东证融汇", "第一创业",
                  "长城证券", "国海证券", "德邦证券", "东方财富证券",
                  "中信期货", "中信国安", "中证信用", "中国国新", "中国人寿",
                  "佳期投资", "宁苑资产", "明毅基金", "文璟基金",
                  "银叶投资", "聚宽投资", "爱凡哲投资", "会世资产",
                  "九坤投资", "孚腾资本", "利得基金", "安信基金"]),
    ("新能源车企", ["蔚来", "小鹏", "理想汽车", "比亚迪", "宁德时代", "宁德新能源",
                    "ATL", "岚图", "智界", "极氪", "零跑", "哪吒", "特斯拉",
                    "奇点能源", "启源芯动力", "孚能", "国轩", "亿纬", "蜂巢能源",
                    "欣旺达", "中创新航", "瑞浦兰钧", "楚能新能源", "远景能源",
                    "远景科技", "阳光电源", "固德威", "昱能科技", "弘元绿能",
                    "高能环境", "协鑫", "隆基", "晶科", "天合光能", "晶澳",
                    "阿特斯", "东方日升", "正泰新能", "通威", "大全能源",
                    "爱玛科技", "雅迪", "九号公司", "小牛电动", "绿源",
                    "佑驾创新", "智驾新程", "易控智驾", "卡尔动力", "卡儿酷",
                    "楚能汽车", "正浩", "德兰明海", "海四达", "豪鹏",
                    "鹏辉能源", "英诺赛科", "融捷能源", "时代天源"]),
    ("传统车企", ["一汽", "上汽", "东风", "北汽", "广汽", "长安", "吉利", "长城汽车",
                  "奇瑞", "江淮", "重汽", "福田", "申沃客车", "宇通", "金龙",
                  "法士特", "汉德车桥", "联合电子", "安道拓", "麦格纳", "库卡",
                  "博世", "大陆汽车", "采埃孚", "电装"]),
    ("半导体/硬件", ["半导体", "芯", "微电子", "集成电路", "ICRD", "华虹", "中芯国际",
                    "长电科技", "通富", "华天科技", "甬矽", "芯联", "士兰",
                    "闻泰", "韦尔", "兆易", "紫光", "澜起", "卓胜微", "圣邦",
                    "矽力杰", "纳芯", "思瑞浦", "汇顶", "瑞芯微", "全志",
                    "晶晨", "炬芯", "恒玄", "乐鑫", "翱捷", "移远通信",
                    "华勤技术", "龙旗科技", "闻泰科技", "立讯", "歌尔", "舜宇",
                    "蓝思", "伯恩", "京东方", "TCL华星", "维信诺", "深天马",
                    "深南电路", "生益电子", "景旺", "兴森", "沪电", "胜宏",
                    "存储", "佰维", "江波龙", "德明利", "普冉", "聚辰",
                    "光迅科技", "烽火通信", "中兴通讯", "新华三", "锐捷",
                    "TP-Link", "联洲", "普联", "海能达", "海康", "大华",
                    "宇视科技", "深知", "虹软", "商汤", "旷视", "云从",
                    "寒武纪", "燧原", "壁仞", "沐曦", "摩尔线程", "天数智芯",
                    "地平线", "黑芝麻", "芯驰", "芯擎", "兆芯", "龙芯", "飞腾"]),
    ("互联网", ["腾讯", "阿里", "字节", "百度", "美团", "京东", "拼多多", "快手",
                "小红书", "B站", "哔哩哔哩", "网易", "新浪", "微博", "搜狐",
                "滴滴", "携程", "去哪儿", "飞猪", "哈啰", "满帮", "货拉拉",
                "贝壳", "贝壳找房", "58同城", "汽车之家", "同花顺", "东方财富",
                "得物", "唯品会", "盒马", "淘天", "菜鸟", "蚂蚁", "灵犀",
                "字节跳动", "今日头条", "抖音", "番茄", "TikTok", "Shopee",
                "Garena", "传音", "大疆", "DJI", "影石", "Insta360", "韶音",
                "拓竹", "安克创新", "绿联", "倍思", "智岩", "雷鸟", "小黑盒",
                "微店", "有赞", "多点", "每日优鲜", "朴朴", "叮咚", "闪送",
                "顺丰", "韵达", "圆通", "中通", "申通", "极兔", "德邦",
                "滴滴", "T3出行", "曹操出行", "首汽", "文远", "小马智行",
                "Momenta", "图森", "轻舟", "元戎启行", "毫末", "智加",
                "深信服", "启明星辰", "绿盟", "奇安信", "天融信", "安恒",
                "四叶草", "亚信安全", "长亭科技", "通付盾", "微步在线",
                "用友", "金蝶", "明源云", "汉得信息", "神州信息", "东华软件",
                "软通动力", "中软国际", "润和", "法本", "博彦", "文思",
                "酷动数码", "焦点", "思特奇", "天源迪科", "拓维信息",
                "科大讯飞", "商汤科技", "云从", "格灵深瞳", "第四范式"]),
    ("快消/零售", ["食品", "饮料", "乳业", "啤酒", "白酒", "餐饮", "茶饮",
                  "古茗", "喜茶", "奈雪", "蜜雪", "瑞幸", "星巴克", "麦当劳",
                  "百胜", "肯德基", "伊利", "蒙牛", "光明", "三元", "飞鹤",
                  "农夫山泉", "元气森林", "康师傅", "统一", "旺旺", "娃哈哈",
                  "思念食品", "三全", "双汇", "牧原", "温氏", "圣农",
                  "海大集团", "大北农", "新希望", "通威", "安琪", "厨邦",
                  "海天", "恒顺", "千禾", "中炬", "李锦记", "亨氏",
                  "珀莱雅", "贝泰妮", "水羊", "上海家化", "丸美", "华熙",
                  "青木科技", "若羽臣", "壹网壹创", "丽人丽妆", "碧橙数字",
                  "孩子王", "永辉", "大润发", "华润万家", "物美", "家家悦",
                  "屈臣氏", "名创优品", "泡泡玛特", "TOP TOY", "KK集团",
                  "优衣库", "迪卡侬", "安踏", "李宁", "特步", "361",
                  "森马", "太平鸟", "海澜之家", "罗莱生活", "水星家纺",
                  "全棉时代", "稳健医疗", "恒安", "维达", "洁柔", "中顺"]),
    ("医药/生物", ["医药", "药业", "生物", "制药", "医疗", "健康", "基因",
                  "疫苗", "诊断", "器械", "医院", "同仁堂", "国药", "广药",
                  "白云山", "云南白药", "片仔癀", "华东医药", "恒瑞", "复星医药",
                  "石药", "正大天晴", "百济神州", "信达", "君实", "康方",
                  "甘李", "通化", "海普瑞", "健帆生物", "迈瑞", "联影",
                  "鱼跃", "乐普", "微创", "先健", "启明医疗", "沛嘉",
                  "金域医学", "迪安诊断", "华大", "贝瑞基因", "诺禾",
                  "药明康德", "康龙化成", "泰格医药", "昭衍", "金斯瑞",
                  "新产业生物", "安图生物", "迈克生物", "圣湘", "达安",
                  "华海药业", "海正", "京新", "恩华", "人福", "科伦",
                  "麦科田医疗", "理邦仪器", "开立医疗", "澳华", "有方医疗"]),
    ("军工/研究所", ["航天", "航空", "兵器", "船舶", "核工业", "中船", "中航",
                    "中电科", "电科", "研究所", "研究院", "五院", "八院",
                    "中物院", "中核", "中广核", "国家电网", "南方电网",
                    "中车", "中国中车", "中铁", "中交", "中建", "中冶",
                    "中化", "中国化学", "中国能建", "中国电建", "中电建",
                    "国家能源", "华能", "大唐", "华电", "国电投", "三峡",
                    "格思航天", "长光卫星", "长光辰芯", "微纳星空", "天仪",
                    "银河航天", "星空年代", "深蓝航天", "星际荣耀", "蓝箭",
                    "天兵", "东方空间", "中科宇航", "航天科技", "航天科工"]),
    ("制造业", ["制造", "重工", "机械", "装备", "钢铁", "冶金", "化工",
                "材料", "建材", "水泥", "玻璃", "陶瓷", "造纸", "包装",
                "三一", "徐工", "中联重科", "柳工", "临工", "山推",
                "潍柴", "玉柴", "上柴", "康明斯", "博世", "西门子",
                "施耐德", "ABB", "三菱", "日立", "东芝", "松下",
                "美的", "格力", "海尔", "海信", "TCL", "长虹", "创维",
                "康佳", "九阳", "苏泊尔", "老板电器", "方太", "华帝",
                "公牛集团", "正泰", "德力西", "良信", "汇川技术",
                "英威腾", "信捷", "雷赛", "步科", "埃斯顿", "新时达",
                "拓邦", "和而泰", "麦格米特", "麦米电气", "科华集团",
                "精工钢构", "杭萧钢构", "中国建筑", "中建", "中铁",
                "三花智控", "盾安", "亿利达", "精进电动", "卧龙",
                "科捷智能", "新宝股份", "格兰仕", "奥克斯", "澳柯玛"]),
    ("外企", ["微软", "Google", "Apple", "亚马逊", "Meta", "IBM", "Intel",
              "AMD", "NVIDIA", "高通", "三星", "LG", "索尼", "飞利浦",
              "强生", "宝洁", "联合利华", "欧莱雅", "高露洁", "雀巢",
              "可口可乐", "百事", "达能", "亿滋", "玛氏", "费列罗",
              "阿斯利康", "辉瑞", "诺华", "罗氏", "默沙东", "赛诺菲",
              "GSK", "礼来", "拜耳", "勃林格", "赛拉尼斯", "杜邦",
              "陶氏", "巴斯夫", "空气化工", "林德", "梅特勒托利多",
              "恩智浦", "意法", "英飞凌", "瑞萨", "村田", "TDK",
              "莫仕", "泰科电子", "安波福", "李尔", "佛吉亚", "法雷奥",
              "爱德万", "是德", "Keysight", "NI", "Ansys", "达索",
              "SAP", "Oracle", "Salesforce", "Adobe", "Autodesk",
              "SGS", "SHEIN", "FILA", "迪卡侬", "迪桑特", "优衣库",
              "麦当劳", "星巴克", "嘉士伯", "基恩士", "菲尼克斯",
              "英格索兰", "卡特彼勒", "NSK", "Molex", "OMP", "塞拉尼斯",
              "ZURU", "EX.IO", "Sea", "OBSBOT", "Polymaker", "Manifold"]),
    ("互联网", ["360", "BOSS直聘", "OPPO", "vivo", "VIVO", "CVTE", "视源",
                "小米", "荣耀", "联想", "浪潮", "超聚变", "中兴", "新华三",
                "平头哥", "虎牙", "映客", "斗鱼", "知乎", "豆瓣", "陌陌",
                "Soul", "脉脉", "领英", "钉钉", "飞书", "WPS", "金山办公",
                "恒生电子", "广联达", "用友", "群核科技", "树根互联",
                "美云智数", "卡奥斯", "航旅纵横", "腾竞体育", "阅文",
                "虎鲸文娱", "挚文", "无忧传媒", "米可世界", "点点互动",
                "途虎养车", "转转", "震坤行", "易点云", "杉数科技",
                "首都在线", "网宿科技", "浩鲸科技", "税友集团", "旋极",
                "思特威", "禾赛科技", "睿创微纳", "奥比中光", "极飞科技",
                "云鲸智能", "云迹科技", "普渡机器人", "优必选", "宇树",
                "智元机器人", "银河通用", "自变量机器人", "星尘智能",
                "节卡机器人", "遨博", "越疆", "云深处科技", "擎朗",
                "快仓智能", "海柔创新", "极智嘉", "旷视", "云从科技",
                "格灵深瞳", "第四范式", "明略科技", "星环科技", "达观",
                "竹间智能", "澜舟", "MiniMax", "月之暗面", "智谱", "百川",
                "阶跃星辰", "零一万物", "面壁智能", "出门问问", "云知声",
                "思谋科技", "合合信息", "万兴科技", "力扣", "牛客",
                "高途", "作业帮", "学而思", "新东方", "好未来", "猿辅导",
                "核桃编程", "希望学", "星火教育", "高顿教育", "超星集团"]),
    ("制造业", ["三棵树", "三花", "三环", "先导智能", "先导科技", "凌云光",
                "奥特维", "拉普拉斯", "晶盛机电", "迈为股份", "捷佳伟创",
                "拓荆科技", "中微公司", "北方华创", "盛美", "芯源微",
                "至纯科技", "精测电子", "长川科技", "华峰测控",
                "埃斯顿", "埃夫特", "华中数控", "广州数控", "科德数控",
                "海天精工", "创世纪", "拓斯达", "大族激光", "华工科技",
                "锐科激光", "杰普特", "柏楚电子", "奥普特", "矩子科技",
                "中控技术", "川仪股份", "聚光科技", "先河环保", "盈峰环境",
                "三一重工", "中联重科", "山推股份", "建设机械", "达刚",
                "合力股份", "杭叉集团", "安徽合力", "诺力股份",
                "伊之密", "海天塑机", "震雄", "力劲", "泰瑞机器",
                "阳光电源", "华为", "富士康", "立讯精密", "歌尔股份",
                "蓝思科技", "伯恩光学", "领益智造", "长盈精密", "鹏鼎",
                "东山精密", "信维通信", "电连技术", "瑞声科技",
                "汇川技术", "麦格米特", "英威腾", "蓝海华腾", "正弦电气",
                "特锐德", "正泰电器", "良信股份", "宏发股份", "伊戈尔",
                "许继电气", "平高电气", "国电南瑞", "四方股份", "四方继保",
                "思源电气", "特变电工", "中国西电", "白云电器",
                "天正电气", "德力西", "公牛集团", "欧普照明", "雷士",
                "福耀集团", "福达集团", "爱玛科技", "九号公司", "雅迪",
                "株洲齿轮", "天润工业", "常发集团", "神驰机电",
                "杰瑞集团", "科威尔", "英集动力", "华仪宁创", "华昱",
                "海目星", "联赢激光", "利元亨", "赢合科技", "先惠技术",
                "青禾晶元", "英诺赛科", "瀚天天成", "天科合达",
                "思摩尔", "亿纬锂能", "鹏辉能源", "海四达", "豪鹏科技",
                "欣旺达", "德兰明海", "正浩", "安克", "绿联", "倍思",
                "世邦通信", "亿联网络", "亿道", "优博讯", "优利德",
                "鼎阳科技", "普源精电", "是德科技", "同惠电子",
                "中迅农科", "扬翔股份", "天禾股份", "兄弟科技", "新和成",
                "中荣股份", "裕同科技", "合兴包装", "劲嘉股份",
                "康冠科技", "惠科股份", "洲明科技", "艾比森", "利亚德",
                "立达信", "三雄极光", "木林森", "国星光电", "鸿利智汇",
                "信锐技术", "锐明技术", "道通科技", "元征科技",
                "科捷智能", "轴心自控", "标控科技", "众智科技",
                "钱江摩托", "宗申", "隆鑫", "林海", "宗申动力"]),
    ("军工/研究所", ["中国电子", "中国电科", "中电港", "中电信", "中电环保",
                    "中电福富", "中国联通", "中国移动", "中国电信",
                    "中国外运", "中粮", "中化", "中国国新", "中国南山",
                    "国机", "国投", "中国通号", "通号", "中国信科",
                    "烽火", "电科芯片", "吉芯科技", "振华", "贵州振华",
                    "理工雷科", "北斗星通", "天锐星通", "鸿擎科技",
                    "星逻智能", "易动宇航", "瑞启深空", "宇石空间",
                    "引力波智谱", "国仪量子", "玻色量子", "本源量子",
                    "中科闻歌", "中科光电", "中科腾越", "中讯邮电",
                    "中联西北院", "成都设计咨询", "深城交", "深水咨询",
                    "江苏省电力设计院", "中国能源建设", "安徽省能源",
                    "申能集团", "金开新能", "盐湖股份", "盛屯集团",
                    "北方矿业", "山东东明石化", "中秦兴龙", "物产中大",
                    "建发集团", "象屿", "国贸股份", "厦门中达",
                    "广州公交", "广州港", "深圳市特区建工", "绿城中国",
                    "中海地产", "卓越商企", "新城悦服务", "锦江国际",
                    "陕西旅游", "豫园股份", "横店集团", "上实集团",
                    "上海国际集团", "复星集团", "方正集团", "居然之家",
                    "银泰商业", "茂业", "天虹", "王府井", "大商"]),
]

# 行业归类优先级：越靠前越优先（解决"新能源车企"含"车"与"传统车企"冲突等）
DEFAULT_INDUSTRY = "其他"


def classify_industry(company: str) -> str:
    name = company.replace("offerstar·", "").strip()
    # 1) 精确名优先（消除模糊词误伤）
    if name in INDUSTRY_EXACT:
        return INDUSTRY_EXACT[name]
    # 2) 关键词子串
    for ind, kws in INDUSTRY_RULES:
        for kw in kws:
            if kw in name:
                return ind
    return DEFAULT_INDUSTRY


# ─────────────────────────────────────────────────────────────
# 截止日期规范化
# ─────────────────────────────────────────────────────────────
_DEADLINE_DATE = re.compile(r"(?:(20\d{2})\s*[-/年.])?\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})")
_NOT_A_DATE = ("招完即止", "招满即止", "尽快投递", "长期有效", "不限", "待定",
               "以官网为准", "招满为止", "滚动", "长期", "无截止", "先到先得")


def parse_deadline(text: str, today: date) -> str | None:
    """把「招完即止 / 尽快投递 / 9.30日截止 / 2026-10-15」规范化为 YYYY-MM-DD。

    非具体日期的语义化文本返回 None（模板会归入「截止待定」组）。
    """
    if not text:
        return None
    t = text.strip()
    if any(k in t for k in _NOT_A_DATE):
        return None
    m = _DEADLINE_DATE.search(t)
    if not m:
        return None
    y_raw, mo, d = m.group(1), int(m.group(2)), int(m.group(3))
    # 无年份时按当前年理解（本表是 2027 届秋招，日期均落在 2026 年内）。
    # 不做"已过期就推到下一年"的推断——那会把已截止的提前批误报成未来截止。
    y = int(y_raw) if y_raw else today.year
    try:
        dt = date(y, mo, d)
    except ValueError:
        return None
    # 已过期 → 返回 None，模板归入「截止待定」组，不显示倒计时
    if dt < today:
        return None
    return dt.isoformat()


# ─────────────────────────────────────────────────────────────
# 批次规范化
# ─────────────────────────────────────────────────────────────
def parse_batch(tags: str, title: str, publish: str = "") -> str:
    blob = f"{tags} {title}"
    if "提前批" in blob:
        return "提前批"
    if "实习" in blob:
        return "实习"
    if "正式批" in blob or "秋招" in blob or "校园招聘" in blob:
        return "正式批"
    return "正式批"


def parse_cohort(tags: str, title: str) -> str:
    blob = f"{tags} {title}"
    if "2027" in blob or "27届" in blob:
        return "2027届"
    return "2027届"   # 本管线聚焦 27 届


def split_locations(raw: str) -> list[str]:
    if not raw:
        return []
    parts = re.split(r"[、,，/|；;\s]+", raw)
    out, seen = [], set()
    for p in parts:
        p = p.strip("（()）·-—")
        if not p or p in seen:
            continue
        seen.add(p)
        out.append(p)
    return out[:8]


# ─────────────────────────────────────────────────────────────
# 岗位名清洗
#
# 聚合源（offerstar）的「岗位」字段实际是推文标题，例如
# 「BOSS 直聘 2027 届校园招聘启动啦！」，直接当 tag 展示是噪声。
# 这里：公告式文案不入 positions，改存 announcement 字段；
# 若标题里嵌了岗位清单（括号内 / 顿号分隔）则抽取出来。
# ─────────────────────────────────────────────────────────────
_ANNO = re.compile(
    r"(校园招聘|秋招|春招|正式启动|正式开启|招募启动|招聘启动|全面启动|"
    r"启动！|启动啦|快上车|招聘公告|内推汇总|已启动|开放投递|招聘啦|"
    r"等你来|热AI|秋招提前批|提前批正式|正式批启动|招聘进行中)")
_POS_HINT = re.compile(
    r"(工程师|开发|算法|产品经理|运营|设计|策划|测试|数据分析|销售|"
    r"财务|人力|管培|研究员|架构|市场|法务|供应链|采购|美术|客户端|"
    r"服务端|前端|后端|运维|安全|审计|风控|投资|咨询|编辑|讲师)")


def clean_positions(raw_positions: list[str], company: str) -> tuple[list[str], str | None]:
    """返回 (干净的岗位名列表, 公告标题或 None)。"""
    short = company.replace("offerstar·", "").strip()
    announcement = None
    out: list[str] = []

    for raw in raw_positions or []:
        s = (raw or "").strip()
        if not s:
            continue
        # 长句 / 含公告语 → 视为公告标题
        is_anno = bool(_ANNO.search(s)) or len(s) > 30
        if is_anno:
            if announcement is None:
                announcement = s
            # 从公告标题里抽岗位清单：括号内 或 顿号/斜杠分隔
            frag = s
            m = re.search(r"[（(]([^）)]{6,})[）)]", s)
            if m:
                frag = m.group(1)
            for tok in re.split(r"[、，,／/|·;；]+", frag):
                tok = tok.strip(" 　-—：:！!。.")
                if not tok or len(tok) > 22:
                    continue
                if _ANNO.search(tok) or not _POS_HINT.search(tok):
                    continue
                if short and short in tok:
                    continue
                if tok not in out:
                    out.append(tok)
            continue
        if short and short in s:
            continue
        # 过短且无岗位特征的噪声（如"聚合"）
        if len(s) <= 2 and not _POS_HINT.search(s):
            continue
        if s not in out:
            out.append(s)

    return out[:5], announcement


def clean_program(program: str | None) -> str | None:
    """'聚合' 这类无信息量的 program 直接丢弃。"""
    if not program:
        return None
    p = program.strip()
    if p in ("聚合", "校招", "校园招聘", "-", ""):
        return None
    return p


# ─────────────────────────────────────────────────────────────
# 数据源 1：campus-radar SQLite
# ─────────────────────────────────────────────────────────────
def load_campus_radar() -> list[dict]:
    db = RAW / "campus_radar.db"
    if not db.exists():
        print(f"  下载 campus-radar jobs.db …")
        req = urllib.request.Request(
            CAMPUS_RADAR_DB, headers={"User-Agent": "qiuzhao-pipeline"})
        with urllib.request.urlopen(req, timeout=90) as r:
            db.write_bytes(r.read())
    conn = sqlite3.connect(db)
    rows = conn.execute("""
        SELECT company, title, category, location, url,
               publish_time, tags, first_seen, last_seen
        FROM jobs
    """).fetchall()
    conn.close()

    out = []
    for company, title, category, location, url, publish, tags, first_seen, last_seen in rows:
        cohort = parse_cohort(tags or "", title or "")
        # 用 title 做岗位名：聚合源的 title 常是公告标题，交给清洗器判断
        positions, _ = clean_positions([title] if title else [], company)
        if not positions and category and not _ANNO.search(category):
            positions = [p.strip() for p in re.split(r"[、,，/]+", category) if p.strip()][:5]
        out.append({
            "company": company,
            "cohort": cohort,
            "batch": parse_batch(tags or "", title or "", publish or ""),
            "program": clean_program((tags or "").split("/")[0].strip()),
            "industry": classify_industry(company),
            "positions": positions,
            "locations": split_locations(location or ""),
            "apply_url": url or None,
            "official_wechat": None,
            "qr_image": None,
            "deadline": None,
            "campus_only": True,
            "first_seen": (first_seen or "")[:10] or None,
            "last_seen": (last_seen or "")[:10] or None,
            "_src": "campus-radar",
        })
    print(f"  campus-radar: {len(out)} 条")
    return out


# ─────────────────────────────────────────────────────────────
# 数据源 2：龙哥表
# ─────────────────────────────────────────────────────────────
def load_longge(today: date) -> list[dict]:
    sys.path.insert(0, str(ROOT / "sources"))
    try:
        import longge_fetch as L
    except Exception as e:
        print(f"  龙哥表源不可用（{e}），跳过")
        return []

    try:
        companies = L.fetch_all()
    except Exception as e:
        print(f"  龙哥表抓取失败（{e}），跳过")
        return []

    # 分页取全部原始行以拿到 工作地点 / 截止时间 / 内推码
    raw_rows: dict[str, dict] = {}
    try:
        first = L.fetch(0, 60)
        maxrow = ((first.get("data") or {}).get("maxrow") or 0)
        pages = [(0, 60)]
        start = 60
        while start < maxrow:
            pages.append((start, min(start + 60, maxrow)))
            start += 60

        for lo, hi in pages:
            try:
                d = L.fetch(lo, hi)
            except Exception:
                continue
            text = ((d.get("data") or {}).get("initialAttributedText") or {}).get("text") or []
            for chunk in text:
                enc = chunk.get("smartsheet", "")
                if not enc:
                    continue
                try:
                    blob = L.parse_chunk(enc)
                except Exception:
                    continue
                for item in blob:
                    for piece in (item if isinstance(item, list) else [item]):
                        if isinstance(piece, dict) and piece.get("t") == 3028:
                            rowmap = (piece.get("c", {}).get("k2", {}) or {}).get("k1", {})
                            for rid, wrap in rowmap.items():
                                cells = (wrap or {}).get("k1", {}) if isinstance(wrap, dict) else {}
                                raw_rows.setdefault(rid, {}).update(
                                    {c: L.cell_text(v) for c, v in cells.items()})
        print(f"  龙哥表原始行: {len(raw_rows)} 行（maxrow={maxrow}）")
    except Exception as e:
        print(f"  龙哥表详情列抓取失败（{e}），仅用基础列")

    detail = {}
    for r in raw_rows.values():
        nm = r.get("fq2BBI", "").strip()
        if nm:
            detail[nm] = r

    out = []
    for c in companies:
        name = c["name"]
        r = detail.get(name, {})
        dl_raw = (r.get("fSqe11") or c.get("deadline") or "").strip()
        loc = (r.get("fqpLT6") or "").strip()
        job = (c.get("job") or "").strip()
        raw_pos = [p.strip() for p in re.split(r"[、,，\n·|]+", job) if p.strip()]
        positions, announcement = clean_positions(raw_pos, name)
        out.append({
            "company": name,
            "cohort": "2027届",
            "batch": parse_batch("", job),
            "program": None,
            "industry": classify_industry(name),
            "positions": positions,
            "announcement": announcement,
            "locations": split_locations(loc),
            "apply_url": None,          # 龙哥表内推链接列当前为空
            "official_wechat": None,
            "qr_image": None,
            "deadline": parse_deadline(dl_raw, today),
            "campus_only": True,
            # 龙哥表是一份"长期在招"的汇总清单，不是每日更新的信息流，
            # 没有可靠的首见日期；标成今天会把「今日新收录」灌水成 124 条。
            # 留空更诚实，模板会归入「收录日期未知」组。
            "first_seen": None,
            "last_seen": today.isoformat(),
            "_src": "longge",
        })
    print(f"  龙哥表: {len(out)} 条")
    return out


# ─────────────────────────────────────────────────────────────
# 合并去重
# ─────────────────────────────────────────────────────────────
def display_name(company: str) -> str:
    """`offerstar·腾讯IEG` 是数据源前缀（表示来自聚合平台），不是公司名的一部分。
    展示时剥掉，保留在公司名里会污染筛选与搜索的可读性。"""
    return company.replace("offerstar·", "").strip()


def normalize_key(name: str) -> str:
    n = name.replace("offerstar·", "").strip().lower()
    n = re.sub(r"[（(].*?[)）]", "", n)
    n = re.sub(r"(集团|有限公司|股份有限公司|公司|科技|中国)$", "", n)
    return re.sub(r"[\s·\-—_]", "", n)


def merge(*sources: list[dict]) -> list[dict]:
    """按规范化公司名合并，统计 confirmed_by（多渠道交叉确认）。"""
    buckets: dict[str, list[dict]] = {}
    for src in sources:
        for j in src:
            buckets.setdefault(normalize_key(j["company"]), []).append(j)

    merged = []
    for key, group in buckets.items():
        # 渠道数 = 去重后的来源数 + 组内不同 company 写法数（取较小保守值）
        srcs = {g["_src"] for g in group}
        confirmed = len(srcs)

        # 择优：优先带 URL 的、有岗位名的、有地点的
        def score(g):
            return (
                1 if g.get("apply_url") else 0,
                len(g.get("positions") or []),
                len(g.get("locations") or []),
                1 if g.get("deadline") else 0,
            )
        best = max(group, key=score)

        positions, locations = [], []
        seen_p, seen_l = set(), set()
        announcement = None
        for g in group:
            if announcement is None and g.get("announcement"):
                announcement = g["announcement"]
            for p in g.get("positions") or []:
                if p not in seen_p:
                    seen_p.add(p)
                    positions.append(p)
            for l in g.get("locations") or []:
                if l not in seen_l:
                    seen_l.add(l)
                    locations.append(l)

        deadlines = [g["deadline"] for g in group if g.get("deadline")]
        firsts = [g["first_seen"] for g in group if g.get("first_seen")]
        lasts = [g["last_seen"] for g in group if g.get("last_seen")]
        merged.append({
            "company": display_name(best["company"]),
            "cohort": best.get("cohort") or "2027届",
            "batch": best.get("batch") or "正式批",
            "program": best.get("program"),
            "industry": best.get("industry") or DEFAULT_INDUSTRY,
            "positions": positions[:5],
            "announcement": announcement,
            "locations": locations[:5],
            "apply_url": best.get("apply_url"),
            "official_wechat": None,
            "qr_image": None,
            "deadline": min(deadlines) if deadlines else None,
            "campus_only": True,
            "first_seen": min(firsts) if firsts else None,
            "last_seen": max(lasts) if lasts else None,
            "confirmed_by": confirmed,
        })

    merged.sort(key=lambda j: (j["industry"], j["company"]))
    return merged


# ─────────────────────────────────────────────────────────────
# 数据源 3（可选）：国央企校招 MCP（campus-jobs-radar）
#
# 需要 XJRADAR_API_KEY / ~/.config/xjradar/api-key；免费 key 需微信扫码。
# 无 key 或端点不可达时安静跳过，不影响其它源。
# ─────────────────────────────────────────────────────────────
def _xr_pick(d: dict, *names, default=None):
    """MCP 返回的字段名未公开文档化，按多个候选键宽松取值。"""
    for n in names:
        if n in d and d[n] not in (None, ""):
            return d[n]
    return default


def load_xjradar(today: date) -> list[dict]:
    sys.path.insert(0, str(ROOT / "sources"))
    try:
        import xjradar_mcp as X
    except Exception as e:
        print(f"  xjradar MCP 不可用（{e}），跳过")
        return []

    try:
        key = X.load_key()
    except X.MCPError as e:
        print(f"  xjradar key 读取失败（{e}），跳过")
        return []
    if not key:
        print("  xjradar：未配置 API key，跳过（额度需在 xjradar.com 微信扫码获取）")
        return []

    try:
        cli = X.XjradarMCP(key)
        cli.initialize()
        txt = cli.call("search_jobs", {
            "org_nature": "国央企", "only_open": True,
            "graduate_year": "2027", "limit": 200,
        })
    except Exception as e:
        print(f"  xjradar 调用失败（{str(e)[:120]}），跳过")
        return []

    try:
        payload = json.loads(txt)
    except Exception:
        print("  xjradar 返回非 JSON，跳过")
        return []

    items = payload.get("items") if isinstance(payload, dict) else payload
    if not isinstance(items, list):
        print("  xjradar 返回结构未识别，跳过")
        return []

    out, seen = [], set()
    for it in items:
        if not isinstance(it, dict):
            continue
        org = _xr_pick(it, "org", "company", "org_name", "employer", "unit")
        title = _xr_pick(it, "title", "job", "position", "name", "job_title")
        if not org:
            continue
        # 同一单位多条岗位合并
        key = str(org)
        if key in seen:
            continue
        seen.add(key)
        city = _xr_pick(it, "city", "location", "cities", "workplace", default="")
        major = _xr_pick(it, "major", "majors", "major_requirement", default="")
        dl = _xr_pick(it, "deadline", "close_date", "end_date")
        url = _xr_pick(it, "apply_url", "url", "apply_link", "link")
        nature = _xr_pick(it, "org_nature", "nature", "company_type", default="央国企")
        positions = []
        if title:
            positions = [p.strip() for p in re.split(r"[、,，/|]+", str(title)) if p.strip()][:5]
        if major and len(positions) < 3:
            positions.append(str(major)[:24])
        out.append({
            "company": str(org).strip(),
            "cohort": "2027届",
            "batch": "正式批",
            "program": None,
            "industry": classify_industry(str(org)),
            "positions": positions,
            "locations": split_locations(str(city)),
            "apply_url": str(url).strip() if url else None,
            "official_wechat": None,
            "qr_image": None,
            "deadline": parse_deadline(str(dl or ""), today),
            "campus_only": True,
            "first_seen": (_xr_pick(it, "first_seen", "created", "publish_date") or "")[:10] or None,
            "last_seen": today.isoformat(),
            "_src": "xjradar",
            "_nature": str(nature),
        })
    print(f"  xjradar（国央企）: {len(out)} 条")
    return out


def main():
    today = date.today()
    print(f"归一化管线启动 · {today.isoformat()}")
    RAW.mkdir(parents=True, exist_ok=True)

    cr = load_campus_radar()
    lg = load_longge(today)
    xr = load_xjradar(today)
    jobs = merge(cr, lg, xr)

    # 只同步能够验证归属的 Logo。无法确认时保留空值，交给前端使用
    # 双字简称回退，避免把微信公众号/通用 ATS 的 favicon 当成公司 Logo。
    try:
        sys.path.insert(0, str(ROOT / "sources"))
        import logo_sync
        jobs, logo_stats = logo_sync.sync_logos(jobs, ROOT)
        print(
            "  Logo 同步: "
            f"命中 {logo_stats['resolved']} 家 · "
            f"Simple Icons {logo_stats['simple_icons']} · "
            f"官网 {logo_stats['official_domains']} · "
            f"Logo.dev {logo_stats['logo_dev']}"
        )
    except Exception as e:
        print(f"  Logo 同步失败（{e}），本轮保留简称回退")
        for job in jobs:
            job.setdefault("logo_path", None)
            job.setdefault("logo_source", None)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(jobs, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")

    from collections import Counter
    ind = Counter(j["industry"] for j in jobs)
    print(f"\n合并去重后 {len(jobs)} 条，写入 {OUT}")
    print("行业分布:", "、".join(f"{k}×{v}" for k, v in ind.most_common()))
    n_url = sum(1 for j in jobs if j["apply_url"])
    n_dl = sum(1 for j in jobs if j["deadline"])
    n_multi = sum(1 for j in jobs if j["confirmed_by"] >= 2)
    print(f"带投递链接 {n_url} 条 · 有明确截止日 {n_dl} 条 · 多渠道确认 {n_multi} 条")


if __name__ == "__main__":
    main()
