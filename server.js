const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const { URL, pathToFileURL } = require("url");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3100);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PRIVATE_DIR = path.join(ROOT, "private");
const SCRIPTS_DIR = path.join(ROOT, "scripts");
const TASKS_PATH = path.join(DATA_DIR, "tasks.json");
const TEMPLATES_PATH = path.join(DATA_DIR, "templates.json");
const QUICK_LINKS_PATH = path.join(DATA_DIR, "quick-links.json");
const WORK_DESK_PATH = path.join(DATA_DIR, "work-desk.json");
const PLUGIN_CARDS_PATH = path.join(DATA_DIR, "plugin-cards.json");
const PLUGIN_UPLOAD_DIR = path.join(DATA_DIR, "plugin-uploads");
const PLUGIN_OUTPUT_DIR = path.join(DATA_DIR, "plugin-outputs");
const LEADS_SPLITTER_OUTPUT_DIR = path.join(PLUGIN_OUTPUT_DIR, "leads-splitter");
const HAFT_UPLOADER_PRIVATE_DIR = path.join(PRIVATE_DIR, "haft-uploader");
const HAFT_UPLOADER_DATA_DIR = path.join(DATA_DIR, "haft-uploader");
const HAFT_UPLOADER_DOWNLOAD_DIR = path.join(HAFT_UPLOADER_DATA_DIR, "downloads");
const HAFT_UPLOADER_ACCOUNTS_PATH = path.join(HAFT_UPLOADER_PRIVATE_DIR, "accounts.local.json");
const HAFT_UPLOADER_ACCOUNTS_EXAMPLE_PATH = path.join(HAFT_UPLOADER_PRIVATE_DIR, "accounts.example.json");
const HAFT_UPLOADER_TASKS_PATH = path.join(HAFT_UPLOADER_PRIVATE_DIR, "tasks.json");
const HAFT_UPLOADER_TASKS_EXAMPLE_PATH = path.join(HAFT_UPLOADER_PRIVATE_DIR, "tasks.example.json");
const HAFT_UPLOADER_DB_PATH = path.join(HAFT_UPLOADER_DATA_DIR, "executions.db");
const WECHAT_XCX_QACODE_OUTPUT_DIR = path.join(DATA_DIR, "wechat-xcx-qacode", "outputs");
const COMSUMER_DATA_DIR = path.join(DATA_DIR, "comsumer-data");
const COMSUMER_DATA_UPLOADS_DIR = path.join(COMSUMER_DATA_DIR, "uploads");
const COMSUMER_DATA_OUTPUTS_DIR = path.join(COMSUMER_DATA_DIR, "outputs");
const COMSUMER_DATA_WORKSPACES_DIR = path.join(COMSUMER_DATA_DIR, "workspaces");
const COMSUMER_DATA_PRIVATE_DIR = path.join(PRIVATE_DIR, "comsumer-data");
const GEO_DETECTION_DATA_DIR = path.join(DATA_DIR, "geo-detection");
const GEO_DETECTION_PROJECTS_PATH = path.join(GEO_DETECTION_DATA_DIR, "projects.json");
const GEO_DETECTION_BRANDS_PATH = path.join(GEO_DETECTION_DATA_DIR, "brands.json");
const GEO_DETECTION_REPORTS_PATH = path.join(GEO_DETECTION_DATA_DIR, "reports.json");
const LEGACY_HAFT_ROOT = path.resolve(ROOT, "..", "Haft 通用工具");
const LEGACY_HAFT_CONFIG_DIR = path.join(LEGACY_HAFT_ROOT, "config");
const LEGACY_HAFT_DATA_DIR = path.join(LEGACY_HAFT_ROOT, "data");
const LEGACY_HAFT_DOWNLOAD_DIR = path.join(LEGACY_HAFT_ROOT, "download");

const DEFAULT_WORK_DESK = [
  {
    title: "Mac",
    items: [
      { lead: "⌘⇧4", note: "区域截图" },
      { lead: "⌘⇧5", note: "打开截图面板" },
      { lead: "⌘⇧.", note: "显示隐藏文件" },
      { lead: "⌘Space", note: "聚焦搜索" },
      { lead: "⌘Tab", note: "切换应用" },
      { lead: "⌘`", note: "切换窗口" },
      { lead: "⌘W", note: "关闭窗口" },
      { lead: "⌘Q", note: "退出应用" },
      { lead: "⌘N", note: "新建窗口" },
      { lead: "⌘,", note: "打开设置" },
      { lead: "⌘C", note: "复制" },
      { lead: "⌘V", note: "粘贴" },
      { lead: "⌘Z", note: "撤销" },
      { lead: "⌘⇧Z", note: "重做" },
      { lead: "⌥⌘Esc", note: "强制退出" }
    ]
  },
  {
    title: "Excel",
    items: [
      { lead: "⌘⇧L", note: "开启或关闭筛选" },
      { lead: "⌘1", note: "设置单元格格式" },
      { lead: "⌘;", note: "插入当天日期" },
      { lead: "⌘D", note: "向下填充" },
      { lead: "⌘R", note: "向右填充" },
      { lead: "⌘T", note: "创建表格" },
      { lead: "⌃G", note: "定位到单元格" },
      { lead: "⌘F", note: "查找" },
      { lead: "⌘H", note: "替换" },
      { lead: "⌘ShiftK", note: "插入超链接" },
      { lead: "SUMIFS", note: "按条件求和" },
      { lead: "XLOOKUP", note: "精确查找" },
      { lead: "IFERROR", note: "出错时返回备用值" },
      { lead: "COUNTIF", note: "按条件计数" },
      { lead: "TEXTJOIN", note: "合并文本" }
    ]
  },
  {
    title: "Terminal",
    items: [
      { lead: "Ctrl A", note: "跳到行首" },
      { lead: "Ctrl E", note: "跳到行尾" },
      { lead: "Ctrl R", note: "搜索历史命令" },
      { lead: "Ctrl C", note: "中断当前命令" },
      { lead: "Ctrl U", note: "删除光标前内容" },
      { lead: "Ctrl K", note: "删除光标后内容" },
      { lead: "Ctrl L", note: "清屏" },
      { lead: "Ctrl D", note: "退出终端" },
      { lead: "pwd", note: "查看当前目录" },
      { lead: "ls -la", note: "显示完整文件列表" },
      { lead: "cd ..", note: "返回上一级" },
      { lead: "mkdir", note: "新建文件夹" },
      { lead: "rm -i", note: "删除前确认" },
      { lead: "rg text", note: "全文搜索文本" },
      { lead: "open .", note: "打开当前目录" }
    ]
  },
  {
    title: "开发工具",
    items: [
      { lead: "⌘P", note: "快速打开文件" },
      { lead: "⌘⇧P", note: "命令面板" },
      { lead: "⌥⇧F", note: "格式化文档" },
      { lead: "⌘B", note: "显示或隐藏侧边栏" },
      { lead: "⌃`", note: "显示或隐藏终端" },
      { lead: "F2", note: "重命名符号" },
      { lead: "⌘/", note: "添加或取消注释" },
      { lead: "⌥↑↓", note: "上下移动当前行" },
      { lead: "⌘D", note: "选中下一个相同项" },
      { lead: "⌘⇧O", note: "跳转到符号" },
      { lead: "⌘⇧F", note: "全局搜索" },
      { lead: "git status", note: "查看变更状态" },
      { lead: "git diff", note: "查看修改差异" },
      { lead: "code .", note: "打开当前项目" },
      { lead: "npm run dev", note: "启动本地服务" }
    ]
  }
];

const DEFAULT_QUICK_LINKS = [
  {
    title: "协作平台",
    items: [
      { label: "飞书", url: "https://www.feishu.cn/", note: "消息、文档与视频会议" },
      { label: "企业邮箱", url: "https://outlook.office.com/", note: "邮件与日程安排" },
      { label: "日历", url: "https://calendar.google.com/", note: "统一查看会议与提醒" },
      { label: "Jira", url: "https://www.atlassian.com/software/jira", note: "需求与任务流转" },
      { label: "Slack", url: "https://slack.com/", note: "跨团队即时沟通" },
      { label: "Zoom", url: "https://zoom.us/", note: "远程会议与录屏" },
      { label: "Teams", url: "https://www.microsoft.com/microsoft-teams/", note: "会议、聊天与协作" },
    ],
  },
  {
    title: "知识与设计",
    items: [
      { label: "Notion", url: "https://www.notion.so/", note: "知识库与项目沉淀" },
      { label: "Confluence", url: "https://www.atlassian.com/software/confluence", note: "流程文档与规范" },
      { label: "Figma", url: "https://www.figma.com/", note: "设计稿与评审协作" },
      { label: "Canva", url: "https://www.canva.com/", note: "轻量海报与素材处理" },
      { label: "Miro", url: "https://miro.com/", note: "在线白板与流程梳理" },
      { label: "Whimsical", url: "https://whimsical.com/", note: "流程图与线框草图" },
      { label: "Airtable", url: "https://www.airtable.com/", note: "轻量结构化资料库" },
    ],
  },
  {
    title: "开发与数据",
    items: [
      { label: "GitHub", url: "https://github.com/", note: "代码仓库与 PR 协作" },
      { label: "GitLab", url: "https://gitlab.com/", note: "内部仓库与 CI 管理" },
      { label: "Looker Studio", url: "https://lookerstudio.google.com/", note: "业务数据看板" },
      { label: "Google Drive", url: "https://drive.google.com/", note: "共享文件与资料归档" },
      { label: "Postman", url: "https://www.postman.com/", note: "接口调试与集合管理" },
      { label: "Vercel", url: "https://vercel.com/", note: "前端部署与预览环境" },
      { label: "Tableau", url: "https://www.tableau.com/", note: "分析报表与仪表盘" },
    ],
  },
];

const DEFAULT_PLUGIN_CARDS = [
  {
    id: "leads-splitter",
    icon: "LS",
    title: "Leads Splitter",
    category: "Data Ops",
    summary: "Upload the standard leads export and split it into two delivery-ready CSV files.",
    pageUrl: "/plugins/leads-splitter.html",
    enabled: true,
  },
  {
    id: "haft-uploader",
    icon: "HU",
    title: "Haft 自动上传",
    category: "自动化",
    summary: "统一管理 Haft 上传任务、调度器状态和执行日志，支持手动测试与定时执行。",
    pageUrl: "/plugins/haft-uploader.html",
    enabled: true,
  },
  {
    id: "wechat-xcx-qacode",
    icon: "码",
    title: "小程序二维码生成器",
    category: "Automation",
    summary: "批量生成小程序二维码。上传文件后自动打开微信公众平台，等待扫码登录后逐条生成并保存二维码图片。",
    pageUrl: "/plugins/wechat-xcx-qacode.html",
    enabled: true,
  },
  {
    id: "comsumer-data",
    icon: "数",
    title: "Consumer 数据生成器",
    category: "Data Ops",
    summary: "根据季度和周度生成数据报告，支持多数据源合并、数据清洗、周报和Demand数据生成。",
    pageUrl: "/plugins/comsumer-data.html",
    enabled: true,
  },
  {
    id: "geo-detection",
    icon: "GEO",
    title: "GEO长尾词监控",
    category: "Automation",
    summary: "监控品牌词在各智能Chat平台（豆包、Deepseek、千问、元宝）的曝光情况，自动检测AI回复内容和参考资料中的品牌词命中。",
    pageUrl: "/plugins/geo-detection.html",
    enabled: true,
  },
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function isoStamp() {
  return new Date().toISOString();
}

async function readJsonArray(filePath) {
  const raw = await fsp.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeJsonArray(filePath, items) {
  await fsp.writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

async function readTasks() {
  return readJsonArray(TASKS_PATH);
}

async function writeTasks(tasks) {
  return writeJsonArray(TASKS_PATH, tasks);
}

async function readTemplates() {
  return readJsonArray(TEMPLATES_PATH);
}

async function writeTemplates(templates) {
  return writeJsonArray(TEMPLATES_PATH, templates);
}

async function readQuickLinks() {
  return readJsonArray(QUICK_LINKS_PATH);
}

async function writeQuickLinks(groups) {
  return writeJsonArray(QUICK_LINKS_PATH, groups);
}

async function readWorkDesk() {
  return readJsonArray(WORK_DESK_PATH);
}

async function writeWorkDesk(groups) {
  return writeJsonArray(WORK_DESK_PATH, groups);
}

async function readPluginCards() {
  return readJsonArray(PLUGIN_CARDS_PATH);
}

async function writePluginCards(plugins) {
  return writeJsonArray(PLUGIN_CARDS_PATH, plugins);
}

async function fileExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath) {
  await fsp.mkdir(targetPath, { recursive: true });
}

async function maybeCopyFile(sourcePath, targetPath) {
  if (!(await fileExists(sourcePath)) || (await fileExists(targetPath))) {
    return false;
  }

  await ensureDir(path.dirname(targetPath));
  await fsp.copyFile(sourcePath, targetPath);
  return true;
}

function normalizeHaftTaskForCurrentProject(task) {
  const current = { ...task };
  const source = { ...(current.fileSource || {}) };

  if (source.type === "download") {
    const normalizedDownloadDir = String(source.downloadDir || "").trim();
    source.downloadDir =
      normalizedDownloadDir && normalizedDownloadDir !== LEGACY_HAFT_DOWNLOAD_DIR
        ? normalizedDownloadDir
        : HAFT_UPLOADER_DOWNLOAD_DIR;
  }

  current.fileSource = source;
  return current;
}

async function migrateLegacyHaftUploaderFiles() {
  await ensureDir(HAFT_UPLOADER_PRIVATE_DIR);
  await ensureDir(HAFT_UPLOADER_DATA_DIR);
  await ensureDir(HAFT_UPLOADER_DOWNLOAD_DIR);

  await maybeCopyFile(path.join(LEGACY_HAFT_CONFIG_DIR, "accounts.example.json"), HAFT_UPLOADER_ACCOUNTS_EXAMPLE_PATH);
  await maybeCopyFile(path.join(LEGACY_HAFT_CONFIG_DIR, "tasks.example.json"), HAFT_UPLOADER_TASKS_EXAMPLE_PATH);
  await maybeCopyFile(path.join(LEGACY_HAFT_CONFIG_DIR, "accounts.local.json"), HAFT_UPLOADER_ACCOUNTS_PATH);
  await maybeCopyFile(path.join(LEGACY_HAFT_DATA_DIR, "executions.db"), HAFT_UPLOADER_DB_PATH);

  if (!(await fileExists(HAFT_UPLOADER_TASKS_PATH))) {
    if (await fileExists(path.join(LEGACY_HAFT_CONFIG_DIR, "tasks.json"))) {
      const legacyRaw = await fsp.readFile(path.join(LEGACY_HAFT_CONFIG_DIR, "tasks.json"), "utf8");
      const legacyTasks = JSON.parse(legacyRaw);
      const migrated = {
        tasks: Array.isArray(legacyTasks?.tasks)
          ? legacyTasks.tasks.map(normalizeHaftTaskForCurrentProject)
          : [],
      };
      await fsp.writeFile(HAFT_UPLOADER_TASKS_PATH, `${JSON.stringify(migrated, null, 2)}\n`, "utf8");
    } else if (await fileExists(HAFT_UPLOADER_TASKS_EXAMPLE_PATH)) {
      await maybeCopyFile(HAFT_UPLOADER_TASKS_EXAMPLE_PATH, HAFT_UPLOADER_TASKS_PATH);
    }
  }
}

async function ensurePluginCardsRegistered() {
  const current = await readPluginCards();
  const existingIds = new Set(current.map((plugin) => plugin.id));
  const next = [...current];

  DEFAULT_PLUGIN_CARDS.forEach((plugin) => {
    if (!existingIds.has(plugin.id)) {
      next.push(plugin);
    }
  });

  if (next.length !== current.length) {
    await writePluginCards(next);
  }
}

async function ensureDataFiles() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(PRIVATE_DIR, { recursive: true });
  await fsp.mkdir(PLUGIN_UPLOAD_DIR, { recursive: true });
  await fsp.mkdir(LEADS_SPLITTER_OUTPUT_DIR, { recursive: true });
  await fsp.mkdir(WECHAT_XCX_QACODE_OUTPUT_DIR, { recursive: true });
  await fsp.mkdir(COMSUMER_DATA_DIR, { recursive: true });
  await fsp.mkdir(COMSUMER_DATA_UPLOADS_DIR, { recursive: true });
  await fsp.mkdir(COMSUMER_DATA_OUTPUTS_DIR, { recursive: true });
  await fsp.mkdir(COMSUMER_DATA_WORKSPACES_DIR, { recursive: true });
  await fsp.mkdir(COMSUMER_DATA_PRIVATE_DIR, { recursive: true });
  await fsp.mkdir(GEO_DETECTION_DATA_DIR, { recursive: true });

  try {
    await fsp.access(TASKS_PATH);
  } catch {
    await writeTasks([]);
  }

  try {
    await fsp.access(TEMPLATES_PATH);
  } catch {
    await writeTemplates([]);
  }

  try {
    await fsp.access(QUICK_LINKS_PATH);
  } catch {
    await writeQuickLinks(DEFAULT_QUICK_LINKS);
  }

  try {
    await fsp.access(WORK_DESK_PATH);
  } catch {
    await writeWorkDesk(DEFAULT_WORK_DESK);
  }

  try {
    await fsp.access(PLUGIN_CARDS_PATH);
  } catch {
    await writePluginCards(DEFAULT_PLUGIN_CARDS);
  }

  // 初始化 GEO 检测数据文件
  try {
    await fsp.access(GEO_DETECTION_PROJECTS_PATH);
  } catch {
    await writeJsonArray(GEO_DETECTION_PROJECTS_PATH, []);
  }

  try {
    await fsp.access(GEO_DETECTION_BRANDS_PATH);
  } catch {
    await writeJsonArray(GEO_DETECTION_BRANDS_PATH, []);
  }

  try {
    await fsp.access(GEO_DETECTION_REPORTS_PATH);
  } catch {
    await writeJsonArray(GEO_DETECTION_REPORTS_PATH, []);
  }

  await migrateLegacyHaftUploaderFiles();
  await ensurePluginCardsRegistered();
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function combineDateAndTime(dateKey, time) {
  return `${dateKey}T${time}:00`;
}

function statusFromDueAt(dueAt, now) {
  const due = new Date(dueAt);
  if (due.getTime() <= now.getTime()) {
    return "overdue";
  }

  const dueDay = startOfDay(due);
  const nowDay = startOfDay(now);
  if (dueDay.getTime() === nowDay.getTime()) {
    return "today";
  }

  return "later";
}

function deriveTaskStatus(task, now = new Date()) {
  if (task.completed) {
    return "done";
  }

  if (!task.dueAt) {
    return "later";
  }

  return statusFromDueAt(task.dueAt, now);
}

function sanitizeTask(input, current = {}) {
  const title = String(input.title ?? current.title ?? "").trim();
  const recurring = Boolean(input.recurring ?? current.recurring ?? false);
  const completed = Boolean(input.completed ?? current.completed ?? false);
  const note = String(input.note ?? current.note ?? "").trim();
  const dueAtRaw = input.dueAt ?? current.dueAt ?? "";
  const reminderMinutes = Number(input.reminderMinutes ?? current.reminderMinutes ?? 15);
  const dueAt = dueAtRaw ? String(dueAtRaw).trim() : "";

  if (!title) {
    throw new Error("任务标题不能为空");
  }

  if (dueAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dueAt)) {
    throw new Error("截止时间格式不合法");
  }

  return {
    ...current,
    title,
    recurring,
    completed,
    note,
    dueAt,
    reminderMinutes: Number.isFinite(reminderMinutes) ? reminderMinutes : 15,
    source: current.source || "manual",
    updatedAt: isoStamp(),
    completedAt: completed ? isoStamp() : "",
  };
}

function sanitizeTemplate(input, current = {}) {
  const title = String(input.title ?? current.title ?? "").trim();
  const time = String(input.time ?? current.time ?? "").trim();
  const reminderMinutes = Number(input.reminderMinutes ?? current.reminderMinutes ?? 15);
  const note = String(input.note ?? current.note ?? "").trim();
  const active = Boolean(input.active ?? current.active ?? true);
  const allWorkday =
    input.allWorkday === true || input.weekdays === "all_workday"
      ? true
      : input.allWorkday === false
        ? false
        : current.allWorkday === true;

  // 处理 weekdays：支持 "all_workday" 字符串或数组
  let weekdays;
  if (allWorkday) {
    weekdays = "all_workday";
  } else if (Array.isArray(input.weekdays)) {
    weekdays = input.weekdays.map((value) => Number(value)).filter((value) => value >= 0 && value <= 6);
  } else if (Array.isArray(current.weekdays)) {
    weekdays = current.weekdays.map((value) => Number(value)).filter((value) => value >= 0 && value <= 6);
  } else {
    weekdays = [];
  }

  if (!title) {
    throw new Error("周期任务标题不能为空");
  }

  // 全工作日模式不需要检查 weekdays 长度
  if (weekdays !== "all_workday" && !weekdays.length) {
    throw new Error("请至少选择一个执行星期");
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("执行时间格式不合法");
  }

  return {
    ...current,
    title,
    weekdays,
    time,
    reminderMinutes: Number.isFinite(reminderMinutes) ? reminderMinutes : 15,
    note,
    active,
    allWorkday,
    defaultStatus: undefined,
    updatedAt: isoStamp(),
  };
}

function sanitizeQuickLinks(input) {
  if (!Array.isArray(input)) {
    throw new Error("Quick Access 配置格式不合法");
  }

  return input
    .map((group) => {
      const title = String(group?.title ?? "").trim();
      const items = Array.isArray(group?.items) ? group.items : [];

      if (!title) {
        throw new Error("分类标题不能为空");
      }

      const normalizedItems = items
        .map((item) => {
          const label = String(item?.label ?? "").trim();
          const url = String(item?.url ?? "").trim();
          const note = String(item?.note ?? "").trim();
          const remark = String(item?.remark ?? "").trim();

          if (!label && !url && !note && !remark) {
            return null;
          }

          if (!label) {
            throw new Error(`分类「${title}」中存在缺少标题的链接`);
          }

          if (!url) {
            throw new Error(`分类「${title}」中链接「${label}」缺少地址`);
          }

          if (!/^https?:\/\//i.test(url)) {
            throw new Error(`分类「${title}」中链接「${label}」地址格式不合法`);
          }

          return { label, url, note, remark };
        })
        .filter(Boolean);

      return {
        title,
        items: normalizedItems,
      };
    })
    .filter((group) => group.title);
}

function sanitizeWorkDesk(input) {
  if (!Array.isArray(input)) {
    throw new Error("Work Desk 配置格式不合法");
  }

  return input
    .map((group) => {
      const title = String(group?.title ?? "").trim();
      const items = Array.isArray(group?.items) ? group.items : [];

      if (!title) {
        throw new Error("分类标题不能为空");
      }

      const normalizedItems = items
        .map((item) => {
          const lead = String(item?.lead ?? "").trim();
          const note = String(item?.note ?? "").trim();

          if (!lead && !note) {
            return null;
          }

          if (!lead) {
            throw new Error(`分类「${title}」中存在缺少主项的内容`);
          }

          return { lead, note };
        })
        .filter(Boolean);

      return {
        title,
        items: normalizedItems,
      };
    })
    .filter((group) => group.title);
}

function sanitizePluginCards(input) {
  if (!Array.isArray(input)) {
    throw new Error("Plugins 配置格式不合法");
  }

  const seenIds = new Set();

  return input
    .map((plugin, index) => {
      const rawId = String(plugin?.id ?? "").trim();
      const id = rawId || `plugin-${index + 1}`;
      const icon = String(plugin?.icon ?? "").trim();
      const title = String(plugin?.title ?? "").trim();
      const category = String(plugin?.category ?? "").trim();
      const summary = String(plugin?.summary ?? "").trim();
      const pageUrl = String(plugin?.pageUrl ?? "").trim();
      const enabled = Boolean(plugin?.enabled);

      if (!title) {
        throw new Error("插件标题不能为空");
      }

      if (!summary) {
        throw new Error(`插件「${title}」描述不能为空`);
      }

      if (!pageUrl) {
        throw new Error(`插件「${title}」链接不能为空`);
      }

      if (!/^https?:\/\//i.test(pageUrl) && !pageUrl.startsWith("/")) {
        throw new Error(`插件「${title}」链接格式不合法`);
      }

      if (seenIds.has(id)) {
        throw new Error(`插件 ID 重复：${id}`);
      }
      seenIds.add(id);

      return {
        id,
        icon: icon || title.slice(0, 2).toUpperCase(),
        title,
        category: category || "Plugin",
        summary,
        pageUrl,
        enabled,
      };
    })
    .filter((plugin) => plugin.title);
}

function sanitizeFilename(filename) {
  return path.basename(String(filename || "upload.csv")).replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let offset = 0;

  while (offset <= buffer.length) {
    const index = buffer.indexOf(separator, offset);
    if (index === -1) {
      parts.push(buffer.subarray(offset));
      break;
    }

    parts.push(buffer.subarray(offset, index));
    offset = index + separator.length;
  }

  return parts;
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipartForm(req, rawBody) {
  const contentType = String(req.headers["content-type"] || "");
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

  if (!boundaryMatch) {
    throw new Error("上传请求格式不合法");
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(rawBody, boundaryBuffer).slice(1, -1);
  const form = { fields: {}, files: {} };

  parts.forEach((part) => {
    let segment = part;
    if (segment.subarray(0, 2).toString("binary") === "\r\n") {
      segment = segment.subarray(2);
    }
    if (segment.subarray(-2).toString("binary") === "\r\n") {
      segment = segment.subarray(0, segment.length - 2);
    }

    const headerSeparator = Buffer.from("\r\n\r\n");
    const headerEnd = segment.indexOf(headerSeparator);
    if (headerEnd === -1) {
      return;
    }

    const headerText = segment.subarray(0, headerEnd).toString("utf8");
    const content = segment.subarray(headerEnd + headerSeparator.length);
    const nameMatch = headerText.match(/name="([^"]+)"/i);
    if (!nameMatch) {
      return;
    }

    const fieldName = nameMatch[1];
    const fileMatch = headerText.match(/filename="([^"]*)"/i);
    const typeMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);

    if (fileMatch) {
      form.files[fieldName] = {
        filename: fileMatch[1],
        contentType: typeMatch ? typeMatch[1].trim() : "application/octet-stream",
        buffer: content,
      };
      return;
    }

    form.fields[fieldName] = content.toString("utf8");
  });

  return form;
}

async function readBody(req) {
  const rawBody = await readRawBody(req);
  if (!rawBody.length) {
    return {};
  }

  return JSON.parse(rawBody.toString("utf8"));
}

async function openUrlInDefaultBrowser(targetUrl) {
  const parsed = new URL(String(targetUrl || "").trim());

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("仅支持打开 http 或 https 链接");
  }

  let command = "xdg-open";
  let args = [parsed.toString()];

  if (process.platform === "darwin") {
    command = "open";
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", parsed.toString()];
  }

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

async function runJsonScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [scriptPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "插件处理失败"));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("插件返回结果解析失败"));
      }
    });
  });
}

let haftUploaderRuntimePromise = null;
let haftUploaderConfigModulePromise = null;

async function loadHaftUploaderConfigModule() {
  if (!haftUploaderConfigModulePromise) {
    haftUploaderConfigModulePromise = import(pathToFileURL(path.join(ROOT, "lib/haft-uploader/config.mjs")).href).catch(
      (error) => {
        haftUploaderConfigModulePromise = null;
        throw error;
      },
    );
  }

  return haftUploaderConfigModulePromise;
}

async function getHaftUploaderRuntime() {
  if (!haftUploaderRuntimePromise) {
    haftUploaderRuntimePromise = import(pathToFileURL(path.join(ROOT, "lib/haft-uploader/runtime.mjs")).href)
      .then((module) => module.createRuntime())
      .catch((error) => {
        haftUploaderRuntimePromise = null;
        throw error;
      });
  }

  return haftUploaderRuntimePromise;
}

async function ensureGeneratedTasks() {
  const tasks = await readTasks();
  const templates = await readTemplates();
  const now = new Date();
  const existingKeys = new Set(
    tasks
      .filter((task) => task.templateId && task.generatedDate)
      .map((task) => `${task.templateId}:${task.generatedDate}`),
  );

  // 节假日定义（与前端保持一致）
  const holidayDateSet = new Set([
    "2026-02-14", "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
    "2026-04-04", "2026-04-05", "2026-04-06",
    "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
    "2026-06-19", "2026-06-20", "2026-06-21",
    "2026-09-25", "2026-09-26", "2026-09-27",
    "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
  ]);

  // 调休工作日定义
  const makeupWorkdaySet = new Set([
    "2026-02-28",
    "2026-05-09",
    "2026-09-20",
    "2026-10-10",
  ]);

  let changed = false;

  templates
    .filter((template) => template.active)
    .forEach((template) => {
      for (let offset = 0; offset <= 20; offset += 1) {
        const target = new Date(now);
        target.setDate(target.getDate() + offset);
        const weekday = target.getDay();
        const dateKey = toLocalDateKey(target);

        // 检查是否是工作日
        const isWeekend = weekday === 0 || weekday === 6;
        const isHoliday = holidayDateSet.has(dateKey);
        const isMakeupWorkday = makeupWorkdaySet.has(dateKey);

        let shouldGenerate = false;

        // 全工作日模式：自动识别工作日（排除周末和节假日，但调休工作日除外）
        if (template.weekdays === "all_workday") {
          if (isMakeupWorkday) {
            shouldGenerate = true;
          } else if (isHoliday || isWeekend) {
            shouldGenerate = false;
          } else {
            shouldGenerate = true;
          }
        } else if (Array.isArray(template.weekdays)) {
          // 普通模式：检查是否在选中的星期内
          shouldGenerate = template.weekdays.includes(weekday);
        }

        if (!shouldGenerate) {
          continue;
        }

        const dedupeKey = `${template.id}:${dateKey}`;

        if (existingKeys.has(dedupeKey)) {
          continue;
        }

        const dueAt = combineDateAndTime(dateKey, template.time);
        tasks.push({
          id: randomUUID(),
          title: template.title,
          dueAt,
          reminderMinutes: template.reminderMinutes,
          recurring: true,
          note: template.note,
          completed: false,
          source: "template",
          templateId: template.id,
          generatedDate: dateKey,
          createdAt: isoStamp(),
          updatedAt: isoStamp(),
        });
        existingKeys.add(dedupeKey);
        changed = true;
      }
    });

  if (changed) {
    await writeTasks(tasks);
  }

  return tasks;
}

async function handleTasksApi(req, res, url) {
  if (url.pathname === "/api/tasks" && req.method === "GET") {
    const tasks = await ensureGeneratedTasks();
    return sendJson(res, 200, { tasks: tasks.map((task) => ({ ...task, status: deriveTaskStatus(task) })) });
  }

  if (url.pathname === "/api/tasks" && req.method === "POST") {
    const body = await readBody(req);
    const tasks = await readTasks();
    const task = {
      id: randomUUID(),
      createdAt: isoStamp(),
      ...sanitizeTask(body),
    };
    tasks.push(task);
    await writeTasks(tasks);
    return sendJson(res, 201, { task: { ...task, status: deriveTaskStatus(task) } });
  }

  const match = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (!match) {
    return false;
  }

  const tasks = await readTasks();
  const index = tasks.findIndex((task) => task.id === match[1]);
  if (index === -1) {
    sendJson(res, 404, { error: "任务不存在" });
    return true;
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    const body = await readBody(req);
    tasks[index] = sanitizeTask(body, tasks[index]);
    await writeTasks(tasks);
    sendJson(res, 200, { task: { ...tasks[index], status: deriveTaskStatus(tasks[index]) } });
    return true;
  }

  if (req.method === "DELETE") {
    tasks.splice(index, 1);
    await writeTasks(tasks);
    sendJson(res, 200, { ok: true });
    return true;
  }

  sendText(res, 405, "Method Not Allowed");
  return true;
}

async function handleTemplatesApi(req, res, url) {
  if (url.pathname === "/api/templates" && req.method === "GET") {
    const templates = await readTemplates();
    return sendJson(res, 200, {
      templates: templates.map(({ defaultStatus, ...template }) => template),
    });
  }

  if (url.pathname === "/api/templates" && req.method === "POST") {
    const body = await readBody(req);
    const templates = await readTemplates();
    const template = {
      id: randomUUID(),
      createdAt: isoStamp(),
      ...sanitizeTemplate(body),
    };
    templates.push(template);
    await writeTemplates(templates);
    await ensureGeneratedTasks();
    const { defaultStatus, ...cleanTemplate } = template;
    return sendJson(res, 201, { template: cleanTemplate });
  }

  const match = url.pathname.match(/^\/api\/templates\/([^/]+)$/);
  if (!match) {
    return false;
  }

  const templates = await readTemplates();
  const index = templates.findIndex((template) => template.id === match[1]);
  if (index === -1) {
    sendJson(res, 404, { error: "周期规则不存在" });
    return true;
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    const body = await readBody(req);
    const templateId = templates[index].id;
    templates[index] = sanitizeTemplate(body, templates[index]);
    await writeTemplates(templates);
    const tasks = await readTasks();
    await writeTasks(tasks.filter((task) => task.templateId !== templateId || task.completed));
    await ensureGeneratedTasks();
    const { defaultStatus, ...cleanTemplate } = templates[index];
    sendJson(res, 200, { template: cleanTemplate });
    return true;
  }

  if (req.method === "DELETE") {
    const templateId = templates[index].id;
    templates.splice(index, 1);
    await writeTemplates(templates);
    const tasks = await readTasks();
    await writeTasks(tasks.filter((task) => task.templateId !== templateId || task.completed));
    sendJson(res, 200, { ok: true });
    return true;
  }

  sendText(res, 405, "Method Not Allowed");
  return true;
}

async function handleQuickLinksApi(req, res, url) {
  if (url.pathname === "/api/quick-links" && req.method === "GET") {
    const groups = await readQuickLinks();
    return sendJson(res, 200, { groups });
  }

  if (url.pathname === "/api/quick-links" && (req.method === "PUT" || req.method === "PATCH")) {
    const body = await readBody(req);
    const groups = sanitizeQuickLinks(body.groups);
    await writeQuickLinks(groups);
    return sendJson(res, 200, { groups });
  }

  return false;
}

async function handleWorkDeskApi(req, res, url) {
  if (url.pathname === "/api/work-desk" && req.method === "GET") {
    const groups = await readWorkDesk();
    return sendJson(res, 200, { groups });
  }

  if (url.pathname === "/api/work-desk" && (req.method === "PUT" || req.method === "PATCH")) {
    const body = await readBody(req);
    const groups = sanitizeWorkDesk(body.groups);
    await writeWorkDesk(groups);
    return sendJson(res, 200, { groups });
  }

  return false;
}

async function handlePluginCardsApi(req, res, url) {
  if (url.pathname === "/api/plugin-cards" && req.method === "GET") {
    const plugins = await readPluginCards();
    return sendJson(res, 200, { plugins });
  }

  if (url.pathname === "/api/plugin-cards" && (req.method === "PUT" || req.method === "PATCH")) {
    const body = await readBody(req);
    const plugins = sanitizePluginCards(body.plugins);
    await writePluginCards(plugins);
    return sendJson(res, 200, { plugins });
  }

  return false;
}

async function handleHaftUploaderApi(req, res, url) {
  if (url.pathname === "/api/plugins/haft-uploader/health" && req.method === "GET") {
    try {
      const runtime = await getHaftUploaderRuntime();
      return sendJson(res, 200, {
        ok: true,
        plugin: "haft-uploader",
        version: "2026-04-17",
        scheduler: runtime.getSchedulerStatus(),
      });
    } catch (error) {
      return sendJson(res, 503, {
        ok: false,
        plugin: "haft-uploader",
        error: error.message || "Haft 上传器暂不可用",
      });
    }
  }

  if (url.pathname === "/api/plugins/haft-uploader/bootstrap" && req.method === "GET") {
    const runtime = await getHaftUploaderRuntime();
    return sendJson(res, 200, await runtime.getBootstrap());
  }

  if (url.pathname === "/api/plugins/haft-uploader/logs" && req.method === "GET") {
    const runtime = await getHaftUploaderRuntime();
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    return sendJson(res, 200, {
      logs: runtime.store.listExecutionLogs(Number.isInteger(limit) ? limit : 50),
    });
  }

  if (url.pathname === "/api/plugins/haft-uploader/logs/clear" && req.method === "POST") {
    const runtime = await getHaftUploaderRuntime();
    runtime.clearExecutionLogs();
    return sendJson(res, 200, { logs: [] });
  }

  if (url.pathname === "/api/plugins/haft-uploader/tasks" && req.method === "POST") {
    try {
      const runtime = await getHaftUploaderRuntime();
      const { normalizeTaskInput } = await loadHaftUploaderConfigModule();
      const body = await readBody(req);
      const tasks = await runtime.listTasks();
      const incoming = normalizeTaskInput(body, body?.existingTaskId);
      const index = tasks.findIndex((task) => task.id === body?.existingTaskId);
      const duplicateIndex = tasks.findIndex(
        (task) => task.id === incoming.id && task.id !== body?.existingTaskId,
      );

      if (duplicateIndex >= 0) {
        return sendJson(res, 400, { error: `任务标识已存在：${incoming.id}` });
      }

      const nextTasks =
        index >= 0
          ? tasks.map((task, taskIndex) => (taskIndex === index ? incoming : task))
          : [...tasks, incoming];

      return sendJson(res, 200, { tasks: await runtime.replaceTasks(nextTasks) });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "任务保存失败" });
    }
  }

  const taskMatch = url.pathname.match(/^\/api\/plugins\/haft-uploader\/tasks\/([^/]+)$/);
  if (taskMatch) {
    try {
      const runtime = await getHaftUploaderRuntime();
      const taskId = decodeURIComponent(taskMatch[1]);

      if (req.method === "DELETE") {
        const nextTasks = (await runtime.listTasks()).filter((task) => task.id !== taskId);
        return sendJson(res, 200, { tasks: await runtime.replaceTasks(nextTasks) });
      }
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "任务请求失败" });
    }
  }

  const runMatch = url.pathname.match(/^\/api\/plugins\/haft-uploader\/tasks\/([^/]+)\/run$/);
  if (runMatch && req.method === "POST") {
    try {
      const runtime = await getHaftUploaderRuntime();
      const result = await runtime.runTaskByIdManually(decodeURIComponent(runMatch[1]));
      return sendJson(res, 200, { result });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "任务运行失败" });
    }
  }

  if (url.pathname === "/api/plugins/haft-uploader/scheduler/start" && req.method === "POST") {
    const runtime = await getHaftUploaderRuntime();
    const count = await runtime.startScheduler();
    return sendJson(res, 200, {
      scheduler: runtime.getSchedulerStatus(),
      enabledTaskCount: count,
    });
  }

  if (url.pathname === "/api/plugins/haft-uploader/scheduler/stop" && req.method === "POST") {
    const runtime = await getHaftUploaderRuntime();
    await runtime.stopScheduler();
    return sendJson(res, 200, {
      scheduler: runtime.getSchedulerStatus(),
    });
  }

  return false;
}

async function handleWechatXcxQacodeApi(req, res, url) {
  const {
    PLUGIN_ID,
    parseRecordsFromFile,
    generateTemplate,
    createGenerator,
  } = require("./lib/wechat-xcx-qacode/generator.js");

  // Health check
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/health` && req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      plugin: PLUGIN_ID,
      version: "2026-04-17",
    });
  }

  // Download template
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/template` && req.method === "GET") {
    const templateContent = generateTemplate();
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("小程序二维码模板.csv")}`,
      "Cache-Control": "no-store",
    });
    res.end(templateContent);
    return true;
  }

  // Parse uploaded file
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/parse` && req.method === "POST") {
    const rawBody = await readRawBody(req);
    const form = parseMultipartForm(req, rawBody);
    const file = form.files.file;

    if (!file || !file.buffer?.length) {
      return sendJson(res, 400, { error: "请先选择要上传的文件" });
    }

    const filename = sanitizeFilename(file.filename || `upload_${Date.now()}.csv`);
    const ext = path.extname(filename).toLowerCase();
    if (![".csv", ".txt", ".xlsx"].includes(ext)) {
      return sendJson(res, 400, { error: "仅支持 CSV、TXT、XLSX 格式的文件" });
    }

    const tempPath = path.join(PLUGIN_UPLOAD_DIR, `${Date.now()}-${randomUUID()}-${filename}`);
    await fsp.writeFile(tempPath, file.buffer);

    try {
      const records = await parseRecordsFromFile(tempPath, filename);
      return sendJson(res, 200, { records, count: records.length });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "文件解析失败" });
    } finally {
      await fsp.unlink(tempPath).catch(() => {});
    }
  }

  // Generate QR codes (streaming response)
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/generate` && req.method === "POST") {
    const body = await readBody(req);
    const records = Array.isArray(body?.records) ? body.records : [];

    if (records.length === 0) {
      return sendJson(res, 400, { error: "没有要处理的记录" });
    }

    // Validate records
    for (const record of records) {
      if (!record.title || !record.path) {
        return sendJson(res, 400, { error: "每条记录必须包含 title 和 path 字段" });
      }
    }

    // Create output directory with today's date
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const outputDir = path.join(WECHAT_XCX_QACODE_OUTPUT_DIR, dateKey);
    await ensureDir(outputDir);

    // Store outputDir in global state for login confirm
    global.__wechatXcxQacodeOutputDir = outputDir;

    // Set up streaming response
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Transfer-Encoding": "chunked",
    });

    const sendEvent = (event) => {
      res.write(JSON.stringify(event) + "\n");
    };

    const generator = createGenerator({
      outputDir,
      onLog: (message, level = "") => {
        sendEvent({ type: "log", message, level });
      },
      onProgress: (data) => {
        sendEvent({ type: "progress", ...data });
      },
      onFailure: (data) => {
        sendEvent({ type: "failure", ...data });
      },
      onOutputDir: (dir) => {
        sendEvent({ type: "output_dir", path: dir });
      },
    });

    try {
      sendEvent({ type: "log", message: `开始处理 ${records.length} 条记录` });
      sendEvent({ type: "output_dir", path: outputDir });
      sendEvent({ type: "waiting_login" });

      const result = await generator.generateAll(records);

      sendEvent({
        type: "complete",
        success: result.success,
        failed: result.failed,
        failures: result.failures,
      });
    } catch (error) {
      sendEvent({ type: "error", message: error.message || "生成过程出错" });
    } finally {
      await generator.close().catch(() => {});
      res.end();
    }

    return true;
  }

  // Confirm login
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/confirm-login` && req.method === "POST") {
    const outputDir = global.__wechatXcxQacodeOutputDir;
    if (!outputDir) {
      return sendJson(res, 400, { error: "没有正在进行的任务" });
    }

    const confirmFile = path.join(outputDir, ".login_confirm");
    await fsp.writeFile(confirmFile, "confirmed");
    return sendJson(res, 200, { ok: true });
  }

  return false;
}

async function handleComsumerDataApi(req, res, url) {
  const PLUGIN_ID = "comsumer-data";
  const service = require("./lib/comsumer-data/workbook-service.js");

  if (url.pathname === `/api/plugins/${PLUGIN_ID}/health` && req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      plugin: PLUGIN_ID,
      version: "2026-04-20",
    });
  }

  if (url.pathname === `/api/plugins/${PLUGIN_ID}/bootstrap` && req.method === "GET") {
    try {
      return sendJson(res, 200, service.getBootstrapData());
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "初始化数据加载失败" });
    }
  }

  if (url.pathname === `/api/plugins/${PLUGIN_ID}/config/editor` && req.method === "GET") {
    try {
      return sendJson(res, 200, service.getConfigEditorData());
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "配置数据加载失败" });
    }
  }

  if (url.pathname === `/api/plugins/${PLUGIN_ID}/config/unique-channel` && req.method === "POST") {
    try {
      const body = await readBody(req);
      return sendJson(res, 200, {
        ok: true,
        ...service.upsertUniqueChannelEntry(body || {}),
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "唯一渠道保存失败" });
    }
  }

  if (url.pathname === `/api/plugins/${PLUGIN_ID}/config/utm` && req.method === "POST") {
    try {
      const body = await readBody(req);
      return sendJson(res, 200, {
        ok: true,
        ...service.upsertUtmEntry(body || {}),
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "UTM 映射保存失败" });
    }
  }

  if (url.pathname === `/api/plugins/${PLUGIN_ID}/config/utm/bulk` && req.method === "POST") {
    try {
      const body = await readBody(req);
      const payload = service.upsertUtmEntries(body?.items || [], body?.uniqueId || "");
      return sendJson(res, 200, {
        ok: true,
        savedCount: payload.savedEntries.length,
        editor: payload.editor,
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "批量 UTM 映射保存失败" });
    }
  }

  if (url.pathname === `/api/plugins/${PLUGIN_ID}/period/open` && req.method === "POST") {
    try {
      const body = await readBody(req);
      const period = service.buildPeriodInfo(body || {});
      const workbook = service.inspectPeriodWorkbook(period);

      return sendJson(res, 200, {
        period: {
          fiscalYear: period.fiscalYear,
          quarter: period.quarter,
          week: period.weekLabel,
          month: period.monthLabel,
        },
        workbook,
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "周期工作簿打开失败" });
    }
  }

  if (url.pathname === `/api/plugins/${PLUGIN_ID}/import` && req.method === "POST") {
    const rawBody = await readRawBody(req);
    const form = parseMultipartForm(req, rawBody);
    const file = form.files.file;

    if (!file || !file.buffer?.length) {
      return sendJson(res, 400, { error: "请先选择要导入的 Excel 或 CSV 文件" });
    }

    const filename = sanitizeFilename(file.filename || `consumer_${Date.now()}.xlsx`);
    if (!/\.(xlsx?|csv)$/i.test(filename)) {
      return sendJson(res, 400, { error: "仅支持 XLSX、XLS、CSV 格式的文件" });
    }

    const tempPath = path.join(COMSUMER_DATA_UPLOADS_DIR, `${Date.now()}-${randomUUID()}-${filename}`);
    await fsp.writeFile(tempPath, file.buffer);

    try {
      const payload = await service.importWorkbookIntoPeriod(
        {
          fiscalYear: form.fields.fiscalYear,
          quarter: form.fields.quarter,
          week: form.fields.week,
        },
        tempPath,
        filename
      );
      return sendJson(res, 200, {
        ok: true,
        imported: payload.imported,
        workbook: payload.workbook,
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "导入失败" });
    } finally {
      await fsp.unlink(tempPath).catch(() => {});
    }
  }

  if (url.pathname === `/api/plugins/${PLUGIN_ID}/rebuild` && req.method === "POST") {
    try {
      const body = await readBody(req);
      const payload = await service.rebuildPeriod(body || {});
      return sendJson(res, 200, {
        ok: true,
        ...payload,
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "汇总重建失败" });
    }
  }

  if (url.pathname === `/api/plugins/${PLUGIN_ID}/download` && req.method === "GET") {
    try {
      const filePath = service.resolveDownloadTarget(url.searchParams.get("kind"), {
        fiscalYear: url.searchParams.get("fiscalYear"),
        quarter: url.searchParams.get("quarter"),
        week: url.searchParams.get("week"),
      });

      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) {
        throw new Error("invalid file");
      }

      const filename = path.basename(filePath);
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      });
      fs.createReadStream(filePath).pipe(res);
      return true;
    } catch (error) {
      return sendJson(res, 404, { error: error.message || "文件不存在" });
    }
  }

  return false;
}

async function handlePluginsApi(req, res, url) {
  if (url.pathname.startsWith("/api/plugins/haft-uploader/")) {
    return handleHaftUploaderApi(req, res, url);
  }

  if (url.pathname.startsWith("/api/plugins/wechat-xcx-qacode/")) {
    return handleWechatXcxQacodeApi(req, res, url);
  }

  if (url.pathname.startsWith("/api/plugins/comsumer-data/")) {
    return handleComsumerDataApi(req, res, url);
  }

  if (url.pathname.startsWith("/api/plugins/geo-detection/")) {
    return handleGeoDetectionApi(req, res, url);
  }

  if (url.pathname === "/api/plugins/leads-splitter/health" && req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      plugin: "leads-splitter",
      version: "2026-04-16",
    });
  }

  if (url.pathname === "/api/plugins/leads-splitter/process" && req.method === "POST") {
    const rawBody = await readRawBody(req);
    const form = parseMultipartForm(req, rawBody);
    const file = form.files.file;

    if (!file || !file.buffer?.length) {
      return sendJson(res, 400, { error: "请先选择要上传的 CSV 文件" });
    }

    const filename = sanitizeFilename(file.filename || `leads_form_${Date.now()}.csv`);
    if (!/\.csv$/i.test(filename)) {
      return sendJson(res, 400, { error: "当前插件仅支持 CSV 文件" });
    }

    const tempPath = path.join(PLUGIN_UPLOAD_DIR, `${Date.now()}-${randomUUID()}-${filename}`);
    await fsp.writeFile(tempPath, file.buffer);

    try {
      const result = await runJsonScript(path.join(SCRIPTS_DIR, "leads_splitter.py"), [
        "--input",
        tempPath,
        "--output-dir",
        LEADS_SPLITTER_OUTPUT_DIR,
      ]);
      return sendJson(res, 200, { result });
    } finally {
      await fsp.unlink(tempPath).catch(() => {});
    }
  }

  const downloadMatch = url.pathname.match(/^\/api\/plugins\/leads-splitter\/download\/([^/]+)$/);
  if (downloadMatch && req.method === "GET") {
    const filename = path.basename(decodeURIComponent(downloadMatch[1]));
    const filePath = path.join(LEADS_SPLITTER_OUTPUT_DIR, filename);

    try {
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) {
        throw new Error("invalid file");
      }

      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      });
      fs.createReadStream(filePath).pipe(res);
      return true;
    } catch {
      return sendJson(res, 404, { error: "文件不存在或已被移除" });
    }
  }

  return false;
}

async function handleGeoDetectionApi(req, res, url) {
  const PLUGIN_ID = "geo-detection";

  // Health check
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/health` && req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      plugin: PLUGIN_ID,
      version: "2026-04-21",
    });
  }

  // 停止检测任务
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/stop` && req.method === "POST") {
    try {
      // 清除模块缓存并调用停止函数
      const indexPath = require.resolve("./lib/geo-detection/index.js");
      delete require.cache[indexPath];
      const { stopDetection } = require("./lib/geo-detection/index.js");

      if (typeof stopDetection === "function") {
        await stopDetection();
      }

      return sendJson(res, 200, { ok: true, message: "检测任务已停止" });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "停止失败" });
    }
  }

  // Bootstrap - 获取初始化数据
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/bootstrap` && req.method === "GET") {
    try {
      const projects = await readJsonArray(GEO_DETECTION_PROJECTS_PATH);
      const brands = await readJsonArray(GEO_DETECTION_BRANDS_PATH);
      const reports = await readJsonArray(GEO_DETECTION_REPORTS_PATH);
      return sendJson(res, 200, { projects, brands, reports });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "初始化数据加载失败" });
    }
  }

  // 添加项目
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/projects` && req.method === "POST") {
    try {
      const body = await readBody(req);
      const name = String(body?.name || "").trim();

      if (!name) {
        return sendJson(res, 400, { error: "项目名称不能为空" });
      }

      const projects = await readJsonArray(GEO_DETECTION_PROJECTS_PATH);

      // 检查是否已存在
      if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        return sendJson(res, 400, { error: "项目已存在" });
      }

      const newProject = {
        id: randomUUID(),
        name,
        createdAt: isoStamp(),
      };

      projects.push(newProject);
      await writeJsonArray(GEO_DETECTION_PROJECTS_PATH, projects);

      return sendJson(res, 200, { projects });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "添加失败" });
    }
  }

  // 删除项目
  const projectDeleteMatch = url.pathname.match(/^\/api\/plugins\/geo-detection\/projects\/([^/]+)$/);
  if (projectDeleteMatch && req.method === "DELETE") {
    try {
      const projectId = projectDeleteMatch[1];
      const projects = await readJsonArray(GEO_DETECTION_PROJECTS_PATH);
      const filtered = projects.filter((p) => p.id !== projectId);

      if (filtered.length === projects.length) {
        return sendJson(res, 404, { error: "项目不存在" });
      }

      await writeJsonArray(GEO_DETECTION_PROJECTS_PATH, filtered);
      return sendJson(res, 200, { projects: filtered });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "删除失败" });
    }
  }

  // 添加品牌词
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/brands` && req.method === "POST") {
    try {
      const body = await readBody(req);
      const name = String(body?.name || "").trim();
      const projectId = String(body?.projectId || "").trim();
      const projectName = String(body?.projectName || "").trim();

      if (!name) {
        return sendJson(res, 400, { error: "品牌词不能为空" });
      }

      const brands = await readJsonArray(GEO_DETECTION_BRANDS_PATH);

      // 检查是否已存在（同一项目下）
      if (brands.some((b) => b.name.toLowerCase() === name.toLowerCase() && b.projectId === projectId)) {
        return sendJson(res, 400, { error: "品牌词已存在" });
      }

      const newBrand = {
        id: randomUUID(),
        name,
        projectId,
        projectName,
        createdAt: isoStamp(),
      };

      brands.push(newBrand);
      await writeJsonArray(GEO_DETECTION_BRANDS_PATH, brands);

      return sendJson(res, 200, { brands });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "添加失败" });
    }
  }

  // 删除品牌词
  const brandDeleteMatch = url.pathname.match(/^\/api\/plugins\/geo-detection\/brands\/([^/]+)$/);
  if (brandDeleteMatch && req.method === "DELETE") {
    try {
      const brandId = brandDeleteMatch[1];
      const brands = await readJsonArray(GEO_DETECTION_BRANDS_PATH);
      const filtered = brands.filter((b) => b.id !== brandId);

      if (filtered.length === brands.length) {
        return sendJson(res, 404, { error: "品牌词不存在" });
      }

      await writeJsonArray(GEO_DETECTION_BRANDS_PATH, filtered);
      return sendJson(res, 200, { brands: filtered });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "删除失败" });
    }
  }

  // 执行检测任务（流式响应）
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/detect` && req.method === "POST") {
    try {
      const body = await readBody(req);

      // 支持单个 keyword 或多个 keywords
      let keywords = [];
      if (Array.isArray(body?.keywords)) {
        keywords = body.keywords.map((k) => String(k).trim()).filter((k) => k);
      } else if (body?.keyword) {
        const singleKeyword = String(body.keyword).trim();
        if (singleKeyword) keywords = [singleKeyword];
      }

      const platforms = Array.isArray(body?.platforms) ? body.platforms : [];
      const browserMode = body?.browserMode !== false; // 默认为 true
      const repeatCount = Math.max(1, Math.min(10, parseInt(body?.repeatCount, 10) || 1)); // 1-10 次

      if (keywords.length === 0) {
        return sendJson(res, 400, { error: "长尾词不能为空" });
      }

      if (platforms.length === 0) {
        return sendJson(res, 400, { error: "请至少选择一个平台" });
      }

      // 使用前端传递的品牌词（已按项目过滤）
      const brands = Array.isArray(body?.brands) ? body.brands : [];
      if (brands.length === 0) {
        return sendJson(res, 400, { error: "请先添加品牌词或选择项目" });
      }

      // 设置流式响应
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Transfer-Encoding": "chunked",
      });

      const sendEvent = (event) => {
        res.write(JSON.stringify(event) + "\n");
      };

      // 清除模块缓存，确保加载最新代码
      const indexPath = require.resolve("./lib/geo-detection/index.js");
      delete require.cache[indexPath];
      const { runDetection } = require("./lib/geo-detection/index.js");

      try {
        await runDetection({
          keywords,
          platforms,
          brands, // 传递完整的品牌词对象（含项目信息）
          browserMode,
          repeatCount,
          onLog: (message, level = "") => {
            sendEvent({ type: "log", message, level });
          },
          onProgress: (data) => {
            sendEvent({ type: "progress", ...data });
          },
          onReport: (report) => {
            sendEvent({ type: "report", report });
            // 保存报告
            saveGeoReport(report);
          },
        });

        sendEvent({ type: "complete", total: platforms.length * keywords.length * repeatCount });
      } catch (error) {
        sendEvent({ type: "error", message: error.message || "检测失败" });
      } finally {
        res.end();
      }

      return true;
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "检测失败" });
    }
  }

  // 获取报告列表
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/reports` && req.method === "GET") {
    try {
      const reports = await readJsonArray(GEO_DETECTION_REPORTS_PATH);
      return sendJson(res, 200, { reports });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "报告加载失败" });
    }
  }

  // 删除所有报告
  if (url.pathname === `/api/plugins/${PLUGIN_ID}/reports` && req.method === "DELETE") {
    try {
      await writeJsonArray(GEO_DETECTION_REPORTS_PATH, []);
      return sendJson(res, 200, { reports: [] });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "删除失败" });
    }
  }

  // 删除单个报告
  const reportDeleteMatch = url.pathname.match(/^\/api\/plugins\/geo-detection\/reports\/([^/]+)$/);
  if (reportDeleteMatch && req.method === "DELETE") {
    try {
      const reportId = reportDeleteMatch[1];
      const reports = await readJsonArray(GEO_DETECTION_REPORTS_PATH);
      const filteredReports = reports.filter((r) => r.id !== reportId);
      await writeJsonArray(GEO_DETECTION_REPORTS_PATH, filteredReports);
      return sendJson(res, 200, { reports: filteredReports });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "删除失败" });
    }
  }

  return false;
}

// 保存 GEO 检测报告
async function saveGeoReport(report) {
  try {
    const reports = await readJsonArray(GEO_DETECTION_REPORTS_PATH);

    // 查找是否已存在相同日期、长尾词、平台的报告
    const existingIndex = reports.findIndex(
      (r) => r.date === report.date && r.keyword === report.keyword && r.platform === report.platform
    );

    if (existingIndex >= 0) {
      // 更新现有报告
      reports[existingIndex] = { ...reports[existingIndex], ...report };
    } else {
      // 添加新报告
      reports.unshift(report);
    }

    await writeJsonArray(GEO_DETECTION_REPORTS_PATH, reports);
  } catch (error) {
    console.error("保存报告失败:", error.message);
  }
}

async function handleOpenLinkApi(req, res, url) {
  if (url.pathname === "/api/open-link" && req.method === "POST") {
    const body = await readBody(req);
    const targetUrl = String(body?.url ?? "").trim();

    if (!targetUrl) {
      return sendJson(res, 400, { error: "链接地址不能为空" });
    }

    await openUrlInDefaultBrowser(targetUrl);
    return sendJson(res, 200, { ok: true });
  }

  return false;
}

async function handleApi(req, res, url) {
  if (url.pathname.startsWith("/api/tasks")) {
    return handleTasksApi(req, res, url);
  }

  if (url.pathname.startsWith("/api/templates")) {
    return handleTemplatesApi(req, res, url);
  }

  if (url.pathname.startsWith("/api/quick-links")) {
    return handleQuickLinksApi(req, res, url);
  }

  if (url.pathname.startsWith("/api/work-desk")) {
    return handleWorkDeskApi(req, res, url);
  }

  if (url.pathname.startsWith("/api/plugin-cards")) {
    return handlePluginCardsApi(req, res, url);
  }

  if (url.pathname.startsWith("/api/plugins/")) {
    return handlePluginsApi(req, res, url);
  }

  if (url.pathname.startsWith("/api/open-link")) {
    return handleOpenLinkApi(req, res, url);
  }

  return false;
}

async function serveStatic(res, url) {
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalizedRequestPath = path.posix.normalize(requestPath);

  if (
    normalizedRequestPath.startsWith("/data/") ||
    normalizedRequestPath.startsWith("/private/") ||
    normalizedRequestPath.startsWith("/scripts/") ||
    normalizedRequestPath === "/data" ||
    normalizedRequestPath === "/private" ||
    normalizedRequestPath === "/scripts"
  ) {
    sendText(res, 403, "Forbidden");
    return;
  }

  const filePath = path.join(ROOT, path.normalize(requestPath));
  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      sendText(res, 403, "Forbidden");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    sendText(res, 404, "Not Found");
  }
}

async function main() {
  await ensureDataFiles();
  await ensureGeneratedTasks();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname.startsWith("/api/")) {
        const handled = await handleApi(req, res, url);
        if (handled !== false) {
          return;
        }
      }

      await serveStatic(res, url);
    } catch (error) {
      sendJson(res, 500, { error: error.message || "服务器异常" });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`FY27 board running at http://${HOST}:${PORT}`);
  });
}

main();
