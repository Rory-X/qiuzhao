"use strict";

const NAV = [
  { href: "#/today", label: "今日", sec: "作战" },
  { href: "#/funnel", label: "漏斗" },
  { href: "#/apps", label: "投递" },
  { href: "#/cards", label: "资产卡" },
  { href: "#/lists", label: "清单" },
  { href: "#/doc/playbook", label: "实战手册", sec: "材料" },
  { href: "#/doc/qa", label: "面试题库" },
  { href: "#/doc/agent", label: "Agent 基座" },
];

const STATUSES = [
  { id: "watch", label: "意向" },
  { id: "applied", label: "已投" },
  { id: "assess", label: "测评" },
  { id: "oa", label: "笔试" },
  { id: "ai", label: "AI面" },
  { id: "tech", label: "技术面" },
  { id: "hr", label: "HR" },
  { id: "offer", label: "Offer" },
  { id: "reject", label: "挂" },
];

const TIERS = ["A", "B", "C"];
const TRACKS = ["AI全栈", "AI应用", "Agent", "其他"];
const RESUMES = ["工程版", "AI版", "产品数据版"];
const SOURCES = ["官网", "校招公众号", "xixicc2027", "社区", "内推", "其他"];
const VERIFIES = [
  { id: "pending", label: "待核验" },
  { id: "verified", label: "已核验" },
  { id: "offline", label: "已下线" },
];

const CARD_TYPES = {
  experience: {
    label: "经历资产卡",
    source: "手册 10.1",
    fields: ["经历名称", "时间 / 角色", "业务或用户问题", "我负责的边界", "我做过的关键动作", "我做过的一个决定", "遇到的失败或限制", "结果证据", "可迁移到的岗位信号", "面试官可能追问", "目前缺失的证据"],
  },
  jd: {
    label: "投递前 JD 卡",
    source: "手册 10.2",
    fields: ["岗位 / 公司 / 编号", "官方链接", "毕业时间和硬条件", "前三个核心职责", "三个关键词", "我能证明的经历", "我不能证明的要求", "使用哪个简历版本", "预计会被问的项目", "投递日期和下一步"],
  },
  debrief: {
    label: "面试五分钟复盘",
    source: "手册 10.3",
    fields: ["面试轮次", "面试官真正关心的三个点", "我讲得最清楚的一点", "我被追问后暴露的短板", "一个没有答好的问题", "下次要补的事实/代码/基础", "是否继续投同方向岗位"],
  },
};

const PINNED = [
  { title: "基座按最小交付开工", text: "FakeLLM 单测 loop → 6 工具 + workspace jail → 唯一串 edit → SQLite 续跑 → 10 个修测试任务。", href: "#/doc/agent" },
  { title: "补过程证据，不补第三个 Demo", text: "评测曲线、一次取消/UNKNOWN 演练、一篇「为什么不做多 Agent」的 ADR。", href: "#/doc/qa" },
  { title: "投递仍走官网 JD", text: "用 xixicc2027 / 官网核验，A/B/C 分层，人工投。不要上 BOSS 无人值守海投。", href: "#/apps" },
  { title: "还缺两张卡才能精投", text: "真实目标 JD、经历资产卡。没有这两张，题库后半段补不了。", href: "#/cards" },
];

const COLORS = {
  watch: "#9d9080",
  applied: "#c9a227",
  assess: "#4d7c8a",
  oa: "#4d7c8a",
  ai: "#6b8f71",
  tech: "#6b8f71",
  hr: "#c45c26",
  offer: "#3d8b6e",
  reject: "#8a4a42",
};

let meta = { docs: [], checklists: {}, rhythm: {} };
let state = { applications: [], cards: [], checklists: {}, rhythm: {}, reviews: {}, note: "" };
let route = { page: "today" };
let saveChain = Promise.resolve();
let viewMode = "table";

function $(sel, el) { return (el || document).querySelector(sel); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
  });
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function statusLabel(id) {
  const hit = STATUSES.find(function (s) { return s.id === id; });
  return hit ? hit.label : id;
}
function verifyLabel(id) {
  const hit = VERIFIES.find(function (s) { return s.id === id; });
  return hit ? hit.label : id;
}
function shanghaiNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
}
function ymd(d) {
  const x = d || shanghaiNow();
  return [x.getFullYear(), String(x.getMonth() + 1).padStart(2, "0"), String(x.getDate()).padStart(2, "0")].join("-");
}
function isoWeekKey(d) {
  const date = new Date((d || shanghaiNow()).getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const week = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return date.getFullYear() + "-W" + String(week).padStart(2, "0");
}
function weekdayName(d) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][(d || shanghaiNow()).getDay()];
}

function parseHash() {
  const raw = (location.hash || "#/today").replace(/^#\/?/, "");
  const bits = raw.split("?");
  const parts = bits[0].split("/").filter(Boolean);
  const q = new URLSearchParams(bits[1] || "");
  if (parts[0] === "doc") return { page: "doc", id: parts[1] || "playbook", q: q.get("q") || "", h: q.get("h") || "" };
  if (parts[0] === "search") return { page: "search", q: q.get("q") || "" };
  return { page: parts[0] || "today", q: q.get("q") || "" };
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function persist(mutator) {
  saveChain = saveChain.then(async function () {
    mutator(state);
    state = await api("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    render();
  }).catch(function (err) {
    console.error(err);
    alert("保存失败：" + err.message);
  });
  return saveChain;
}

function counts() {
  const apps = state.applications || [];
  const by = {};
  STATUSES.forEach(function (s) { by[s.id] = 0; });
  apps.forEach(function (a) { by[a.status] = (by[a.status] || 0) + 1; });
  return {
    apps: apps,
    by: by,
    applied: apps.filter(function (a) { return a.status !== "watch"; }).length,
    live: apps.filter(function (a) { return ["watch", "reject", "offer"].indexOf(a.status) === -1; }).length,
    interviews: apps.filter(function (a) { return ["ai", "tech", "hr"].indexOf(a.status) !== -1; }).length,
    offer: by.offer || 0,
    reject: by.reject || 0,
  };
}

function rate(num, den) {
  if (!den) return "—";
  return Math.round((num / den) * 100) + "%";
}

function renderNav() {
  $("#nav").innerHTML = NAV.map(function (item) {
    const sec = item.sec ? '<div class="sec">' + esc(item.sec) + "</div>" : "";
    const active = location.hash.indexOf(item.href) === 0 || (item.href === "#/today" && (!location.hash || location.hash === "#/today"));
    return sec + '<a href="' + item.href + '" class="' + (active ? "active" : "") + '">' + esc(item.label) + "</a>";
  }).join("");
}

function setTitle(kicker, title) {
  $("#kicker").textContent = kicker;
  $("#page-title").textContent = title;
  document.title = "钱嘉豪秋招工作台";
}

function render() {
  route = parseHash();
  renderNav();
  const view = $("#view");
  const pages = {
    today: renderToday,
    funnel: renderFunnel,
    apps: renderApps,
    cards: renderCards,
    lists: renderLists,
    doc: renderDoc,
    search: renderSearch,
  };
  (pages[route.page] || renderToday)(view);
}

function renderToday(view) {
  const now = shanghaiNow();
  const week = isoWeekKey(now);
  const day = now.getDay();
  const pack = (meta.rhythm && meta.rhythm[day]) || { title: "今日", items: [] };
  const saved = state.rhythm[week] && state.rhythm[week][String(day)];
  const checks = saved || pack.items.map(function () { return false; });
  const c = counts();
  const today = ymd(now);
  const due = (state.applications || []).filter(function (a) {
    return a.nextDate && a.nextDate <= today && ["offer", "reject"].indexOf(a.status) === -1;
  });
  setTitle(weekdayName(now) + " · " + today, pack.title);
  view.innerHTML = [
    '<div class="grid-4">',
    [["有效投递", c.applied], ["进行中", c.live], ["约面中", c.interviews], ["Offer", c.offer]].map(function (x) {
      return '<div class="stat"><span>' + x[0] + "</span><b>" + x[1] + "</b></div>";
    }).join(""),
    "</div>",
    '<div class="grid-2" style="margin-top:18px">',
    '<section class="card"><h2>', esc(pack.title), " · ", week, '</h2><div class="checks" id="today-rhythm"></div></section>',
    '<div class="stack">',
    '<section class="card"><h2>到期跟进</h2>',
    due.length
      ? due.map(function (a) {
        return '<a class="hit" href="#/apps"><b>' + esc(a.company) + " · " + esc(a.role) + "</b><em>" + esc(a.nextDate) + " · " + esc(a.nextAction || statusLabel(a.status)) + "</em></a>";
      }).join("")
      : '<p class="muted small">没有到期动作。在投递里写下「下一步」和日期。</p>',
    "</section>",
    '<section class="card"><h2>下一步（材料）</h2>',
    PINNED.map(function (p) {
      return '<a class="hit" href="' + p.href + '"><b>' + esc(p.title) + "</b><em>" + esc(p.text) + "</em></a>";
    }).join(""),
    "</section></div></div>",
    '<section class="card" style="margin-top:18px"><h2>今日便笺</h2>',
    '<textarea id="daily-note" placeholder="今天投了谁、哪题挂了、明天先做什么">', esc(state.note || ""), "</textarea></section>",
  ].join("");
  const box = $("#today-rhythm");
  box.innerHTML = pack.items.map(function (item, i) {
    return "<label><input type=\"checkbox\" data-i=\"" + i + "\" " + (checks[i] ? "checked" : "") + " /><span>" + esc(item) + "</span></label>";
  }).join("");
  box.addEventListener("change", function (e) {
    if (!e.target.dataset.i) return;
    const i = Number(e.target.dataset.i);
    persist(function (s) {
      s.rhythm[week] = s.rhythm[week] || {};
      const cur = ((s.rhythm[week][String(day)]) || pack.items.map(function () { return false; })).slice();
      cur[i] = e.target.checked;
      s.rhythm[week][String(day)] = cur;
    });
  });
  $("#daily-note").addEventListener("change", function (e) {
    persist(function (s) { s.note = e.target.value; });
  });
}

function renderFunnel(view) {
  const c = counts();
  const week = isoWeekKey();
  const review = state.reviews[week] || ["", "", "", ""];
  const questions = ((meta.rhythm && meta.rhythm[6]) || { items: [] }).items;
  const apps = c.apps;
  const byTier = { A: 0, B: 0, C: 0 };
  const byResume = {};
  RESUMES.forEach(function (r) { byResume[r] = 0; });
  apps.forEach(function (a) {
    if (byTier[a.tier] != null) byTier[a.tier] += 1;
    if (a.resume) byResume[a.resume] = (byResume[a.resume] || 0) + 1;
  });
  const invited = (c.by.assess || 0) + (c.by.oa || 0) + (c.by.ai || 0) + (c.by.tech || 0) + (c.by.hr || 0) + (c.by.offer || 0);
  const interviewed = (c.by.ai || 0) + (c.by.tech || 0) + (c.by.hr || 0) + (c.by.offer || 0);
  setTitle("每周只改一个变量", "投递漏斗");
  const total = Math.max(apps.length, 1);
  view.innerHTML = [
    '<div class="funnel-bar">',
    STATUSES.map(function (s) {
      const w = ((c.by[s.id] || 0) / total) * 100;
      return '<i title="' + s.label + '" style="width:' + w + "%;background:" + (COLORS[s.id] || "#999") + '"></i>';
    }).join(""),
    "</div>",
    '<div class="grid-4" style="margin-top:14px">',
    [
      ["测评/笔试邀请率", rate(invited, c.applied)],
      ["约面率", rate(interviewed, c.applied)],
      ["Offer / 已投", rate(c.offer, c.applied)],
      ["挂 / 已投", rate(c.reject, c.applied)],
    ].map(function (x) { return '<div class="stat"><span>' + x[0] + "</span><b>" + x[1] + "</b></div>"; }).join(""),
    "</div>",
    '<div class="grid-2" style="margin-top:18px">',
    '<section class="card"><h2>状态分布</h2><table class="data"><thead><tr><th>环节</th><th>数量</th></tr></thead><tbody>',
    STATUSES.map(function (s) { return "<tr><td>" + s.label + "</td><td>" + (c.by[s.id] || 0) + "</td></tr>"; }).join(""),
    "</tbody></table></section>",
    '<section class="card"><h2>分层 / 简历版本</h2><table class="data"><thead><tr><th>维度</th><th>数量</th></tr></thead><tbody>',
    TIERS.map(function (t) { return "<tr><td>" + t + " 层</td><td>" + byTier[t] + "</td></tr>"; }).join(""),
    RESUMES.map(function (r) { return "<tr><td>" + r + "</td><td>" + (byResume[r] || 0) + "</td></tr>"; }).join(""),
    "</tbody></table></section></div>",
    '<section class="card" style="margin-top:18px"><h2>周末复盘 · ', week, "</h2>",
    '<div class="stack" id="review-box">',
    questions.map(function (q, i) {
      return "<label class=\"muted small\">" + esc(q) + '<textarea data-i="' + i + '">' + esc(review[i] || "") + "</textarea></label>";
    }).join(""),
    "</div></section>",
  ].join("");
  $("#review-box").addEventListener("change", function (e) {
    if (e.target.dataset.i == null) return;
    const i = Number(e.target.dataset.i);
    persist(function (s) {
      const cur = (s.reviews[week] || ["", "", "", ""]).slice();
      cur[i] = e.target.value;
      s.reviews[week] = cur;
    });
  });
}

function emptyApp() {
  return {
    id: uid(),
    company: "",
    role: "",
    jobId: "",
    source: "官网",
    url: "",
    verify: "pending",
    tier: "B",
    resume: "AI版",
    track: "Agent",
    appliedAt: "",
    status: "watch",
    nextAction: "",
    nextDate: "",
    reason: "",
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function filteredApps() {
  const q = ($("#app-q") && $("#app-q").value || "").trim().toLowerCase();
  const st = $("#app-status") ? $("#app-status").value : "";
  const tier = $("#app-tier") ? $("#app-tier").value : "";
  return (state.applications || []).filter(function (a) {
    if (st && a.status !== st) return false;
    if (tier && a.tier !== tier) return false;
    if (!q) return true;
    return [a.company, a.role, a.jobId, a.notes, a.nextAction].join(" ").toLowerCase().indexOf(q) !== -1;
  });
}

function renderApps(view) {
  setTitle("人工确认，状态可追踪", "投递看板");
  const apps = state.applications || [];
  view.innerHTML = [
    '<div class="toolbar">',
    '<input id="app-q" type="search" placeholder="筛公司 / 岗位 / 编号" />',
    '<select id="app-status"><option value="">全部状态</option>', STATUSES.map(function (s) { return '<option value="' + s.id + '">' + s.label + "</option>"; }).join(""), "</select>",
    '<select id="app-tier"><option value="">全部层级</option><option>A</option><option>B</option><option>C</option></select>',
    '<button class="primary" id="btn-new">新岗位</button>',
    '<button id="btn-view">', viewMode === "table" ? "看板" : "表格", "</button>",
    '<a class="btn" href="/api/export">导出 JSON</a>',
    "</div>",
    '<div id="app-body"></div>',
  ].join("");
  function paint() {
    const rows = filteredApps();
    const body = $("#app-body");
    if (!rows.length) {
      body.innerHTML = '<div class="empty">还没有岗位。先从官网或 xixicc2027 核验一条，再点「新岗位」。不要海投。</div>';
      return;
    }
    if (viewMode === "board") {
      const groups = [
        ["watch", "applied", "assess"],
        ["oa", "ai", "tech"],
        ["hr", "offer", "reject"],
      ];
      body.innerHTML = '<div class="kanban">' + groups.map(function (g) {
        const items = rows.filter(function (a) { return g.indexOf(a.status) !== -1; });
        return '<div class="col"><h3>' + g.map(statusLabel).join(" / ") + " · " + items.length + "</h3>" + items.map(function (a) {
          return '<div class="ticket" data-id="' + a.id + '"><b>' + esc(a.company) + '</b><span class="muted small">' + esc(a.role) + '</span><div class="row" style="margin-top:6px"><span class="pill ' + a.tier + '">' + a.tier + '</span><span class="pill">' + esc(statusLabel(a.status)) + "</span></div></div>";
        }).join("") + "</div>";
      }).join("") + "</div>";
    } else {
      body.innerHTML = [
        '<table class="data"><thead><tr>',
        "<th>公司 / 岗位</th><th>层</th><th>方向</th><th>状态</th><th>简历</th><th>投递日</th><th>下一步</th><th>核验</th>",
        "</tr></thead><tbody>",
        rows.map(function (a) {
          return '<tr data-id="' + a.id + '"><td><b>' + esc(a.company || "未命名") + "</b><div class=\"muted small\">" + esc(a.role) + (a.jobId ? " · " + esc(a.jobId) : "") + "</div></td><td><span class=\"pill " + a.tier + "\">" + a.tier + "</span></td><td>" + esc(a.track) + "</td><td>" + esc(statusLabel(a.status)) + "</td><td>" + esc(a.resume) + "</td><td>" + esc(a.appliedAt) + "</td><td>" + esc(a.nextAction) + (a.nextDate ? "<div class=\"muted small\">" + esc(a.nextDate) + "</div>" : "") + "</td><td>" + esc(verifyLabel(a.verify)) + "</td></tr>";
        }).join(""),
        "</tbody></table>",
      ].join("");
    }
    body.onclick = function (e) {
      const node = e.target.closest("[data-id]");
      if (node) openApp(node.getAttribute("data-id"));
    };
  }
  paint();
  ["app-q", "app-status", "app-tier"].forEach(function (id) {
    $("#" + id).addEventListener("input", paint);
    $("#" + id).addEventListener("change", paint);
  });
  $("#btn-new").onclick = function () { openApp(null); };
  $("#btn-view").onclick = function () {
    viewMode = viewMode === "table" ? "board" : "table";
    renderApps(view);
  };
}

function field(label, name, value, type) {
  const t = type || "text";
  return "<label>" + esc(label) + '<input name="' + name + '" type="' + t + '" value="' + esc(value || "") + '" /></label>';
}
function selectField(label, name, value, options) {
  return "<label>" + esc(label) + "<select name=\"" + name + "\">" + options.map(function (o) {
    const id = typeof o === "string" ? o : o.id;
    const lab = typeof o === "string" ? o : o.label;
    return "<option value=\"" + id + "\"" + (value === id ? " selected" : "") + ">" + esc(lab) + "</option>";
  }).join("") + "</select></label>";
}

function openApp(id) {
  const existing = id && (state.applications || []).find(function (a) { return a.id === id; });
  const app = existing ? Object.assign({}, existing) : emptyApp();
  const modal = $("#modal");
  modal.hidden = false;
  modal.innerHTML = [
    '<form class="sheet" id="app-form">',
    "<h2>", existing ? "编辑岗位" : "新岗位", "</h2>",
    '<div class="form-grid">',
    field("公司", "company", app.company),
    field("岗位", "role", app.role),
    field("岗位编号", "jobId", app.jobId),
    selectField("来源", "source", app.source, SOURCES),
    '<label class="wide">官方链接<input name="url" type="url" value="' + esc(app.url || "") + '" /></label>',
    selectField("核验", "verify", app.verify, VERIFIES),
    selectField("层级", "tier", app.tier, TIERS),
    selectField("方向", "track", app.track, TRACKS),
    selectField("简历版本", "resume", app.resume, RESUMES),
    selectField("状态", "status", app.status, STATUSES),
    field("投递日期", "appliedAt", app.appliedAt, "date"),
    field("下一步日期", "nextDate", app.nextDate, "date"),
    '<label class="wide">下一步<input name="nextAction" value="' + esc(app.nextAction || "") + '" /></label>',
    '<label class="wide">结果原因<input name="reason" value="' + esc(app.reason || "") + '" /></label>',
    '<label class="wide">备注<textarea name="notes">' + esc(app.notes || "") + "</textarea></label>",
    "</div>",
    '<div class="row" style="margin-top:14px">',
    '<button class="primary" type="submit">保存</button>',
    '<button type="button" id="app-cancel">取消</button>',
    existing ? '<button type="button" id="app-del" class="ghost">删除</button>' : "",
    app.url ? '<a class="btn" target="_blank" rel="noreferrer" href="' + esc(app.url) + '">打开 JD</a>' : "",
    "</div></form>",
  ].join("");
  function close() { modal.hidden = true; modal.innerHTML = ""; }
  $("#app-cancel").onclick = close;
  modal.onclick = function (e) { if (e.target === modal) close(); };
  if ($("#app-del")) {
    $("#app-del").onclick = function () {
      if (!confirm("删除这条岗位？")) return;
      persist(function (s) {
        s.applications = s.applications.filter(function (a) { return a.id !== app.id; });
      });
      close();
    };
  }
  $("#app-form").onsubmit = function (e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const next = Object.assign({}, app);
    fd.forEach(function (v, k) { next[k] = String(v); });
    next.updatedAt = new Date().toISOString();
    persist(function (s) {
      const i = s.applications.findIndex(function (a) { return a.id === next.id; });
      if (i === -1) s.applications.unshift(next);
      else s.applications[i] = next;
    });
    close();
  };
}

function emptyCard(type) {
  const spec = CARD_TYPES[type];
  const fields = {};
  spec.fields.forEach(function (f) { fields[f] = ""; });
  return { id: uid(), type: type, title: spec.label, fields: fields, createdAt: new Date().toISOString() };
}

function renderCards(view) {
  setTitle("没有证据的经历，面试里站不住", "资产卡");
  const cards = state.cards || [];
  view.innerHTML = [
    '<div class="toolbar">',
    '<button class="primary" data-new="experience">经历资产卡</button>',
    '<button data-new="jd">JD 卡</button>',
    '<button data-new="debrief">面试复盘</button>',
    "</div>",
    cards.length ? '<div class="stack" id="card-list"></div>' : '<div class="empty">先补经历资产卡和目标 JD 卡，再谈精投。题库后半段也依赖这两张。</div>',
  ].join("");
  view.querySelector(".toolbar").onclick = function (e) {
    const t = e.target.getAttribute("data-new");
    if (t) openCard(null, t);
  };
  if (!cards.length) return;
  $("#card-list").innerHTML = cards.map(function (c) {
    const spec = CARD_TYPES[c.type] || { label: c.type };
    const preview = Object.keys(c.fields || {}).map(function (k) { return c.fields[k]; }).filter(Boolean)[0] || "未填写";
    return '<article class="card" data-id="' + c.id + '" style="cursor:pointer"><h3>' + esc(c.title || spec.label) + ' <span class="pill">' + esc(spec.label) + "</span></h3><p class=\"muted small\">" + esc(preview) + "</p></article>";
  }).join("");
  $("#card-list").onclick = function (e) {
    const node = e.target.closest("[data-id]");
    if (node) openCard(node.getAttribute("data-id"));
  };
}

function openCard(id, type) {
  const existing = id && (state.cards || []).find(function (c) { return c.id === id; });
  const card = existing ? JSON.parse(JSON.stringify(existing)) : emptyCard(type);
  const spec = CARD_TYPES[card.type];
  const modal = $("#modal");
  modal.hidden = false;
  modal.innerHTML = [
    '<form class="sheet" id="card-form"><h2>', esc(spec.label), " · ", spec.source, "</h2>",
    '<label>标题<input name="title" value="' + esc(card.title || spec.label) + '" /></label>',
    spec.fields.map(function (f) {
      return "<label class=\"muted small\" style=\"display:flex;flex-direction:column;gap:5px;margin-top:8px\">" + esc(f) + '<textarea name="f:' + esc(f) + '">' + esc((card.fields || {})[f] || "") + "</textarea></label>";
    }).join(""),
    '<div class="row" style="margin-top:14px"><button class="primary" type="submit">保存</button><button type="button" id="card-cancel">取消</button>',
    existing ? '<button type="button" id="card-del" class="ghost">删除</button>' : "",
    "</div></form>",
  ].join("");
  function close() { modal.hidden = true; modal.innerHTML = ""; }
  $("#card-cancel").onclick = close;
  modal.onclick = function (e) { if (e.target === modal) close(); };
  if ($("#card-del")) {
    $("#card-del").onclick = function () {
      if (!confirm("删除这张卡？")) return;
      persist(function (s) { s.cards = s.cards.filter(function (c) { return c.id !== card.id; }); });
      close();
    };
  }
  $("#card-form").onsubmit = function (e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    card.title = String(fd.get("title") || spec.label);
    spec.fields.forEach(function (f) { card.fields[f] = String(fd.get("f:" + f) || ""); });
    persist(function (s) {
      const i = s.cards.findIndex(function (c) { return c.id === card.id; });
      if (i === -1) s.cards.unshift(card);
      else s.cards[i] = card;
    });
    close();
  };
}

function renderLists(view) {
  setTitle("上场前过一遍", "检查清单");
  const packs = meta.checklists || {};
  view.innerHTML = '<div class="grid-2" id="list-grid"></div>';
  const grid = $("#list-grid");
  grid.innerHTML = Object.keys(packs).map(function (key) {
    const pack = packs[key];
    const checks = (state.checklists[key] || []).slice();
    while (checks.length < pack.items.length) checks.push(false);
    const done = checks.filter(Boolean).length;
    return [
      '<section class="card" data-key="', key, '">',
      "<h2>", esc(pack.title), ' <span class="pill">', esc(pack.source), "</span></h2>",
      '<div class="muted small">', done, " / ", pack.items.length, "</div>",
      '<div class="progress"><i style="width:', pack.items.length ? (done / pack.items.length) * 100 : 0, '%"></i></div>',
      '<div class="checks">',
      pack.items.map(function (item, i) {
        return "<label><input type=\"checkbox\" data-i=\"" + i + "\" " + (checks[i] ? "checked" : "") + " /><span>" + esc(item) + "</span></label>";
      }).join(""),
      "</div></section>",
    ].join("");
  }).join("");
  grid.addEventListener("change", function (e) {
    const sec = e.target.closest("[data-key]");
    if (!sec || e.target.dataset.i == null) return;
    const key = sec.getAttribute("data-key");
    const i = Number(e.target.dataset.i);
    persist(function (s) {
      const pack = meta.checklists[key];
      const cur = (s.checklists[key] || pack.items.map(function () { return false; })).slice();
      cur[i] = e.target.checked;
      s.checklists[key] = cur;
    });
  });
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "") || "h";
}

async function renderDoc(view) {
  const id = route.id || "playbook";
  setTitle("材料", "加载中…");
  view.innerHTML = '<p class="muted">正在读取手册…</p>';
  try {
    const doc = await api("/api/docs/" + id);
    setTitle(doc.blurb || "材料", doc.title);
    const toc = (doc.headings || []).map(function (h) {
      const slug = slugify(h.text);
      return '<a class="d' + h.depth + '" href="#/doc/' + id + "?h=" + encodeURIComponent(slug) + '">' + esc(h.text) + "</a>";
    }).join("");
    view.innerHTML = '<div class="doc-layout"><aside class="toc card">' + toc + '</aside><article class="paper" id="md"></article></div>';
    const raw = window.marked ? window.marked.parse(doc.markdown) : "<pre>" + esc(doc.markdown) + "</pre>";
    const html = window.DOMPurify ? window.DOMPurify.sanitize(raw) : raw;
    const md = $("#md");
    md.innerHTML = html;
    Array.prototype.forEach.call(md.querySelectorAll("h1,h2,h3"), function (node) {
      node.id = "h-" + slugify(node.textContent);
    });
    md.addEventListener("click", function (e) {
      const a = e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.charAt(0) !== "#") return;
      e.preventDefault();
      const slug = slugify(href.replace(/^#/, "").replace(/^h-/, ""));
      location.hash = "#/doc/" + id + "?h=" + encodeURIComponent(slug);
    });
    if (route.h) {
      const el = document.getElementById("h-" + route.h) || document.getElementById(route.h);
      if (el) el.scrollIntoView({ block: "start" });
    }
  } catch (err) {
    view.innerHTML = '<div class="empty">手册读取失败：' + esc(err.message) + "</div>";
  }
}

async function renderSearch(view) {
  const q = route.q || "";
  setTitle("全库检索", q ? "结果：" + q : "检索");
  view.innerHTML = '<p class="muted">正在检索…</p>';
  if (!q) {
    view.innerHTML = '<div class="empty">输入关键词，例如「取消语义」「简历版本」「评测」。</div>';
    return;
  }
  const data = await api("/api/search?q=" + encodeURIComponent(q));
  if (!data.hits.length) {
    view.innerHTML = '<div class="empty">没有命中。</div>';
    return;
  }
  view.innerHTML = data.hits.map(function (h) {
    const m = /^(#{1,3})\s+(.+)$/.exec(h.text);
    const jump = m ? "?h=" + encodeURIComponent(slugify(m[2])) : "";
    return '<a class="hit" href="#/doc/' + h.doc + jump + '"><b>' + esc(h.title) + " · L" + h.line + "</b><em>" + esc(h.text) + "</em></a>";
  }).join("");
}

async function boot() {
  renderNav();
  try {
    meta = await api("/api/meta");
    state = await api("/api/state");
  } catch (err) {
    $("#view").innerHTML = '<div class="empty">后端未就绪：' + esc(err.message) + "</div>";
    return;
  }
  $("#search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const q = $("#search-input").value.trim();
    location.hash = q ? "#/search?q=" + encodeURIComponent(q) : "#/search";
  });
  window.addEventListener("hashchange", render);
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      $("#search-input").focus();
    }
  });
  render();
}

boot();
