#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const DATA_DIR = path.join(ROOT, "data");
const STATE_PATH = path.join(DATA_DIR, "state.json");
const DOCS_DIR = path.resolve(ROOT, "..");
const LIVE_ROOT = path.resolve(process.env.QIUZHAO_LIVE_DIR || path.join(DOCS_DIR, "qiuzhao-live"));
const JOBS_PATH = path.join(LIVE_ROOT, "data", "jobs.json");
const JOB_LOGOS_DIR = path.join(LIVE_ROOT, "data", "logos");
const RADAR_SYNC_PATH = path.join(DATA_DIR, "radar-sync.json");
let radarLogoCache = { mtimeMs: -1, logos: new Map() };
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8765);

const DOCS = {
  playbook: {
    id: "playbook",
    title: "秋招实战手册",
    file: "autumn-recruitment-playbook.md",
    blurb: "节奏、简历、投递、笔试、AI / Vibe 面试、三类岗位",
  },
  qa: {
    id: "qa",
    title: "面试答案库",
    file: "interview-qa-bank.md",
    blurb: "上下文压缩、生产 ReAct、失败 / 取消 / 评测",
  },
  agent: {
    id: "agent",
    title: "Coding Agent 基座",
    file: "coding-agent-base.md",
    blurb: "手搓基座的工程与面试清单",
  },
  readme: {
    id: "readme",
    title: "作战材料索引",
    file: "README.md",
    blurb: "权威副本与下一步",
  },
};

const CHECKLISTS = {
  resume: {
    title: "简历检查",
    source: "手册 3.5",
    items: [
      "一页内，首屏能看到目标方向和最强证据",
      "每个项目至少有一个“我做的决定”",
      "每个数字都能在面试中说明来源",
      "每个技术词都能回答“为什么用、怎么验证、替代方案是什么”",
      "GitHub 仓库有 README、运行方式、截图或录屏、已知限制",
      "简历中的项目本人能从 0 到 1 复现核心链路",
      "没有把 AI 生成量、Token 消耗量当成能力本身",
      "PDF 在电脑和手机上都能正常打开，文件名清楚",
    ],
  },
  apply20: {
    title: "投递前 20 分钟",
    source: "手册 4.3",
    items: [
      "5 分钟：标出 JD 的硬条件、核心职责、加分项",
      "5 分钟：在经历资产库中找到 2～3 条证据",
      "5 分钟：选择工程版 / AI 版 / 产品数据版",
      "3 分钟：检查地点、毕业时间、投递次数、截止时间",
      "2 分钟：记录岗位编号、日期和下一步",
      "人工确认仍在招、确为 2027 届、链接未过期",
    ],
  },
  ai: {
    title: "AI 面试当天",
    source: "手册 6.3",
    items: [
      "提前测试摄像头、麦克风、浏览器权限和网络",
      "使用安静、光线稳定、背景简单的环境",
      "准备纸笔，但不要把答案写成逐字稿",
      "语速适中，先给结论再展开",
      "不要用未经证实的“眼神算法”“固定评分秘诀”",
      "遇到重复追问，换一种更具体的证据回答",
      "录制前确认补录次数和时长",
      "看清隐私说明、数据用途、保存期限和删除/申诉渠道",
      "结束后记录原题、时间、回答和可以改进的地方",
    ],
  },
  vibe: {
    title: "Vibe 20 分钟协议",
    source: "手册 7.2",
    items: [
      "0～2 分钟：复述目标，确认输入、输出、限制和验收标准",
      "2～5 分钟：列出文件/模块和最小方案，说明一个替代方案",
      "5～13 分钟：用 AI 生成或修改最小可运行链路，自己持续检查",
      "13～17 分钟：运行样例、异常用例和边界用例，修一个真实问题",
      "17～20 分钟：演示结果，说明取舍、已知限制和下一步",
      "对 AI 的指令短而可检验：先计划，后代码，再给变更摘要和风险",
    ],
  },
  privacy: {
    title: "AI 面试合规",
    source: "手册 11",
    items: [
      "确认是否允许录屏 / 本地笔记",
      "不把公司内部代码或未公开数据贴进第三方模型",
      "不使用实时“代答”工具",
      "保存官方隐私政策链接和申诉入口",
    ],
  },
};

const WEEKEND = {
  title: "漏斗复盘",
  items: [
    "哪个环节转化最低？",
    "是能力不足，还是材料没有证明能力？",
    "哪个简历版本带来更多有效反馈？",
    "下周只改一个最可能提高转化的变量是什么？",
  ],
};

const RHYTHM = {
  1: {
    title: "更新岗位池",
    items: [
      "看官方校招页和 1 个聚合源",
      "新增 15～25 个经过初步核验的岗位",
      "标记 A/B/C 和截止日期",
      "删除重复、过期和不符合毕业时间的条目",
    ],
  },
  2: {
    title: "投递和简历迭代",
    items: [
      "完成 5～8 个高匹配投递",
      "每份投递记录使用的简历版本",
      "对没有反馈的岗位，检查方向、城市或硬条件",
    ],
  },
  3: {
    title: "笔试和手撕",
    items: [
      "一次完整计时套题",
      "两道手撕题，强制口述复杂度和边界",
      "把错误归类并重写一题",
    ],
  },
  4: {
    title: "项目深挖",
    items: [
      "录 2 分钟自我介绍",
      "随机抽一个项目回答“为什么这样设计”",
      "写出 5 个可能追问和自己的证据",
    ],
  },
  5: {
    title: "AI / Vibe 训练",
    items: [
      "一次 20～30 分钟 AI 面试",
      "一次 20 分钟 Vibe 实操",
      "复盘语速、结构、失败路径和测试覆盖",
    ],
  },
  6: WEEKEND,
  0: WEEKEND,
};

function emptyChecks(spec) {
  const out = {};
  for (const [key, pack] of Object.entries(spec)) {
    out[key] = pack.items.map(() => false);
  }
  return out;
}

function defaultState() {
  return {
    version: 2,
    applications: [],
    tasks: [],
    interviewSessions: [],
    checklists: emptyChecks(CHECKLISTS),
    rhythm: {},
    reviews: [],
    note: "",
    onboarding: { skipped: false, visited: [] },
    updatedAt: null,
  };
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState() {
  ensureDataDir();
  if (!fs.existsSync(STATE_PATH)) return defaultState();
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const base = defaultState();
    return {
      ...base,
      ...raw,
      checklists: { ...base.checklists, ...(raw.checklists || {}) },
      rhythm: raw.rhythm || {},
      reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
      applications: enrichApplicationsWithLogos(Array.isArray(raw.applications) ? raw.applications : []),
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      interviewSessions: Array.isArray(raw.interviewSessions) ? raw.interviewSessions : [],
      onboarding: {
        ...base.onboarding,
        ...(raw.onboarding || {}),
        visited: Array.isArray(raw.onboarding?.visited) ? raw.onboarding.visited : [],
      },
      version: 2,
    };
  } catch (err) {
    console.error("state load failed, using default:", err.message);
    return defaultState();
  }
}

function saveState(state) {
  ensureDataDir();
  const next = { ...state, updatedAt: new Date().toISOString() };
  const tmp = STATE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, STATE_PATH);
  return next;
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  const type = typeof body === "string" || Buffer.isBuffer(body)
    ? (headers["Content-Type"] || "text/plain; charset=utf-8")
    : "application/json; charset=utf-8";
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", ...headers });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
  }[ext] || "application/octet-stream";
}

function safeJoin(root, rel) {
  const resolved = path.resolve(root, rel);
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

function headingsOf(markdown) {
  const out = [];
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,3})\s+(.+)$/.exec(lines[i]);
    if (!m) continue;
    out.push({
      depth: m[1].length,
      text: m[2].replace(/[#\[\]`]/g, "").trim(),
      line: i + 1,
    });
  }
  return out;
}

function searchDocs(q) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const hits = [];
  for (const doc of Object.values(DOCS)) {
    const file = path.join(DOCS_DIR, doc.file);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(query)) {
        hits.push({
          doc: doc.id,
          title: doc.title,
          line: i + 1,
          text: line.trim().slice(0, 220),
        });
      }
    });
  }
  return hits.slice(0, 80);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function radarJobKey(job) {
  return [job.company || "", job.cohort || "", job.batch || ""].join("::");
}

function normalizeCompanyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^offerstar·/i, "")
    .replace(/[（(].*?[)）]/g, "")
    .replace(/(股份有限公司|有限责任公司|有限公司|集团|科技|公司)$/g, "")
    .replace(/[^0-9a-z\u4e00-\u9fff]/g, "");
}

function radarLogos() {
  if (!fs.existsSync(JOBS_PATH)) return new Map();
  const mtimeMs = fs.statSync(JOBS_PATH).mtimeMs;
  if (radarLogoCache.mtimeMs === mtimeMs) return radarLogoCache.logos;
  const logos = new Map();
  for (const job of readJson(JOBS_PATH, [])) {
    if (typeof job.logo_path !== "string" || !job.logo_path.startsWith("logos/")) continue;
    const filename = path.basename(job.logo_path);
    if (!filename) continue;
    logos.set(normalizeCompanyName(job.company), `/api/job-logos/${encodeURIComponent(filename)}`);
  }
  radarLogoCache = { mtimeMs, logos };
  return logos;
}

function enrichApplicationsWithLogos(applications) {
  const logos = radarLogos();
  return applications.map((application) => application.logo
    ? application
    : { ...application, logo: logos.get(normalizeCompanyName(application.company)) });
}

function loadRadarJobs(url) {
  if (!fs.existsSync(JOBS_PATH)) {
    throw new Error("岗位雷达数据不存在，请先运行 qiuzhao-live/refresh.sh --no-serve");
  }
  const jobs = readJson(JOBS_PATH, []);
  if (!Array.isArray(jobs)) throw new Error("岗位雷达数据格式错误");
  const sync = readJson(RADAR_SYNC_PATH, null);
  const newKeys = new Set(Array.isArray(sync?.new_keys) ? sync.new_keys : []);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const industry = (url.searchParams.get("industry") || "").trim();
  const onlyWithUrl = url.searchParams.get("withUrl") === "1";
  const onlyNew = url.searchParams.get("newOnly") === "1";
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 30));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const enriched = jobs.map((job) => {
    const key = radarJobKey(job);
    const applyUrl = /^https?:\/\//i.test(job.apply_url || "") ? job.apply_url : null;
    const logoFile = typeof job.logo_path === "string" && job.logo_path.startsWith("logos/")
      ? path.basename(job.logo_path)
      : null;
    return {
      ...job,
      apply_url: applyUrl,
      logo_url: logoFile ? `/api/job-logos/${encodeURIComponent(logoFile)}` : null,
      key,
      is_new: newKeys.has(key),
    };
  });
  const filtered = enriched.filter((job) => {
    const haystack = [job.company, job.industry, job.announcement, ...(job.positions || []), ...(job.locations || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (!q || haystack.includes(q))
      && (!industry || job.industry === industry)
      && (!onlyWithUrl || /^https?:\/\//i.test(job.apply_url || ""))
      && (!onlyNew || job.is_new);
  });
  filtered.sort((a, b) => Number(b.is_new) - Number(a.is_new)
    || (b.first_seen || "").localeCompare(a.first_seen || "")
    || (b.last_seen || "").localeCompare(a.last_seen || "")
    || String(a.company).localeCompare(String(b.company), "zh-CN"));

  const industryCounts = {};
  for (const job of enriched) industryCounts[job.industry || "其他"] = (industryCounts[job.industry || "其他"] || 0) + 1;
  const offset = (page - 1) * pageSize;
  const lastSeenValues = enriched.map((job) => job.last_seen).filter(Boolean);
  return {
    items: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    industries: Object.entries(industryCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    stats: {
      total: enriched.length,
      withUrl: enriched.filter((job) => /^https?:\/\//i.test(job.apply_url || "")).length,
      withLogo: enriched.filter((job) => Boolean(job.logo_url)).length,
      multiConfirmed: enriched.filter((job) => Number(job.confirmed_by) >= 2).length,
      latestSourceDate: lastSeenValues.length ? lastSeenValues.sort().at(-1) : null,
      fileUpdatedAt: fs.statSync(JOBS_PATH).mtime.toISOString(),
    },
    sync,
    source: {
      root: LIVE_ROOT,
      sources: ["ruyi1/campus-radar", "龙哥27届秋招汇总表"],
    },
  };
}

function serveStatic(req, res, url) {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    send(res, 503, "请先运行 npm run build，再启动钱嘉豪秋招工作台。");
    return;
  }
  const staticRoot = DIST;
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  let file = safeJoin(staticRoot, rel.replace(/^\/+/, ""));
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.extname(rel) ? null : path.join(staticRoot, "index.html");
  }
  if (!file || !fs.existsSync(file)) return send(res, 404, "not found");
  send(res, 200, fs.readFileSync(file), { "Content-Type": mimeFor(file) });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://" + HOST + ":" + PORT);
    const pathname = url.pathname;

    if (pathname === "/api/health") {
      send(res, 200, { ok: true, now: new Date().toISOString() });
      return;
    }

    if (pathname === "/api/meta" && req.method === "GET") {
      send(res, 200, {
        docs: Object.values(DOCS).map(({ file, ...rest }) => rest),
        checklists: CHECKLISTS,
        rhythm: RHYTHM,
        host: HOST,
        port: PORT,
      });
      return;
    }

    if (pathname === "/api/jobs" && req.method === "GET") {
      send(res, 200, loadRadarJobs(url));
      return;
    }

    if (pathname.startsWith("/api/job-logos/") && req.method === "GET") {
      const requested = decodeURIComponent(pathname.slice("/api/job-logos/".length));
      const filename = path.basename(requested);
      const file = safeJoin(JOB_LOGOS_DIR, filename);
      if (!filename || filename !== requested || !file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        send(res, 404, { error: "unknown logo" });
        return;
      }
      send(res, 200, fs.readFileSync(file), {
        "Content-Type": mimeFor(file),
        "Cache-Control": "public, max-age=86400, immutable",
      });
      return;
    }

    if (pathname === "/api/state" && req.method === "GET") {
      send(res, 200, loadState());
      return;
    }

    if (pathname === "/api/state" && req.method === "PUT") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (body.version !== 2) {
        send(res, 409, { error: "客户端版本已更新，请刷新页面后再操作。" });
        return;
      }
      const current = loadState();
      const merged = {
        ...current,
        ...body,
        version: 2,
        applications: Array.isArray(body.applications) ? body.applications : current.applications,
        tasks: Array.isArray(body.tasks) ? body.tasks : current.tasks,
        interviewSessions: Array.isArray(body.interviewSessions) ? body.interviewSessions : current.interviewSessions,
        checklists: body.checklists || current.checklists,
        rhythm: body.rhythm || current.rhythm,
        reviews: Array.isArray(body.reviews) ? body.reviews : current.reviews,
        note: typeof body.note === "string" ? body.note : current.note,
        onboarding: body.onboarding || current.onboarding,
      };
      send(res, 200, saveState(merged));
      return;
    }

    if (pathname === "/api/export" && req.method === "GET") {
      const stamp = new Date().toISOString().slice(0, 10);
      send(res, 200, loadState(), {
        "Content-Disposition": 'attachment; filename="qiuzhao-workbench-' + stamp + '.json"',
      });
      return;
    }

    if (pathname.startsWith("/api/docs/") && req.method === "GET") {
      const id = pathname.slice("/api/docs/".length);
      const doc = DOCS[id];
      if (!doc) {
        send(res, 404, { error: "unknown doc" });
        return;
      }
      const file = path.join(DOCS_DIR, doc.file);
      const markdown = fs.readFileSync(file, "utf8");
      send(res, 200, {
        ...doc,
        markdown,
        headings: headingsOf(markdown),
        mtime: fs.statSync(file).mtime.toISOString(),
      });
      return;
    }

    if (pathname === "/api/search" && req.method === "GET") {
      send(res, 200, { hits: searchDocs(url.searchParams.get("q") || "") });
      return;
    }

    if (pathname === "/api/workspace/open" && req.method === "POST") {
      const command = process.platform === "darwin"
        ? { bin: "open", args: [DOCS_DIR] }
        : process.platform === "win32"
          ? { bin: "explorer.exe", args: [DOCS_DIR] }
          : { bin: "xdg-open", args: [DOCS_DIR] };
      const child = spawn(command.bin, command.args, { detached: true, stdio: "ignore" });
      child.unref();
      send(res, 200, { ok: true, path: DOCS_DIR });
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res, url);
      return;
    }

    send(res, 405, { error: "method not allowed" });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message || "server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log("钱嘉豪秋招工作台 http://" + HOST + ":" + PORT);
  console.log("数据文件   " + STATE_PATH);
});
