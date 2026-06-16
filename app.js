const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const FISCAL_MONTH_PATTERN = [4, 4, 5];

const boardConfig = {
  fiscalYear: 2027,
  fiscalYearLabel: "FY27",
  fiscalStart: new Date("2026-01-31T00:00:00"),
  fiscalEnd: new Date("2027-01-29T00:00:00"),
  focusDate: new Date(),
};

const defaultWorkReferenceGroups = [
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
      { lead: "⌥⌘Esc", note: "强制退出" },
    ],
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
      { lead: "TEXTJOIN", note: "合并文本" },
    ],
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
      { lead: "open .", note: "打开当前目录" },
    ],
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
      { lead: "npm run dev", note: "启动本地服务" },
    ],
  },
];

const defaultQuickLinkGroups = [
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

const taskStore = [];
let activeTaskInfoId = "";
let isQuickTaskSubmitting = false;
const runningLinkedHaftTaskIds = new Set();
const homeTaskHaftLinks = [
  {
    homeTitle: "大企数据上传",
    haftTaskName: "大企数据工作日上传",
  },
  {
    homeTitle: "会议数据上传",
    haftTaskName: "网络会议数据上传",
  },
];
let quickTaskModalState = {
  open: false,
  mode: "create",
  editId: "",
};
let autoRefreshTimer = null;
let lastRefreshAt = null;

const AUTO_REFRESH_MS = 5 * 60 * 1000;

let currentTaskView = "focus";
let currentDeskTab = "links";
let activeQuickLinkInfoKey = "";
let workReferenceGroups = defaultWorkReferenceGroups.map((group) => ({
  ...group,
  items: group.items.map((item) => ({ ...item })),
}));
let quickLinkGroups = defaultQuickLinkGroups.map((group) => ({
  ...group,
  items: group.items.map((item) => ({ remark: "", ...item })),
}));
const defaultPluginCards = [
  {
    id: "leads-splitter",
    icon: "LS",
    title: "Leads Splitter",
    category: "Data Ops",
    status: "Ready",
    pageUrl: "/plugins/leads-splitter.html",
    summary:
      "Upload the standard leads export, split it into two delivery-ready CSV files, and keep everything in the same FY27 board style.",
  },
];
let pluginCards = defaultPluginCards.map((plugin) => ({ ...plugin }));

function getDisclosureArrow(isExpanded) {
  return isExpanded ? "▴" : "▾";
}

function parseLocalDateTimeString(value) {
  if (!value) {
    return null;
  }

  const normalized = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getTaskAlert(task) {
  if (task.completed) {
    return null;
  }

  const status = deriveTaskStatus(task);
  if (status === "overdue") {
    return { type: "overdue", label: "已逾期" };
  }

  if (!task.dueAt) {
    return null;
  }

  const diffMs = new Date(task.dueAt) - new Date();

  if (diffMs <= 0) {
    return { type: "overdue", label: "已逾期" };
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const reminderMinutes = Number(task.reminderMinutes || 15);
  if (diffMinutes <= reminderMinutes) {
    return { type: "soon", label: `${diffMinutes} 分钟后到期` };
  }

  return null;
}

function deriveTaskStatus(task) {
  if (task.completed) {
    return "done";
  }

  if (!task.dueAt) {
    return "later";
  }

  const due = new Date(task.dueAt);
  const now = new Date();

  if (due.getTime() <= now.getTime()) {
    return "overdue";
  }

  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const nowDay = new Date(now);
  nowDay.setHours(0, 0, 0, 0);

  if (dueDay.getTime() === nowDay.getTime()) {
    return "today";
  }

  return "later";
}

function dayDiffFromFocus(dueAt) {
  const due = atMidday(new Date(dueAt));
  const focus = atMidday(new Date());
  return Math.round((due - focus) / MS_PER_DAY);
}

function relativeDayLabel(dueAt) {
  const diff = dayDiffFromFocus(dueAt);
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === 2) return "后天";
  if (diff === -1) return "昨天";
  if (diff === -2) return "前天";

  const month = String(new Date(dueAt).getMonth() + 1);
  const day = String(new Date(dueAt).getDate());
  return `${month}月${day}日`;
}

function buildTaskMeta(task) {
  const parts = [];

  if (task.completed) {
    parts.push(task.completedAt ? "已完成确认" : "已完成");
  } else if (task.status === "overdue" && task.dueAt) {
    parts.push(`${relativeDayLabel(task.dueAt)} ${formatClockTime.format(new Date(task.dueAt))} 已延期`);
  } else if (task.dueAt) {
    parts.push(`${relativeDayLabel(task.dueAt)} ${formatClockTime.format(new Date(task.dueAt))} 前处理`);
  } else if (task.status === "overdue") {
    parts.push("已延期待处理");
  } else if (task.status === "later") {
    parts.push("暂未到最终时间");
  } else {
    parts.push("今天优先处理");
  }

  if (task.recurring && !task.completed) {
    parts.push("周期性任务");
  }

  return parts.join(" | ");
}

function buildTaskTags(task) {
  const tags = [];
  if (task.completed) {
    tags.push("Done");
  } else if (task.status === "today") {
    tags.push("Today");
  } else if (task.status === "overdue") {
    tags.push("Overdue");
  }

  if (task.recurring && !task.completed) {
    tags.push("Recurring");
  }

  return tags;
}

function hasText(value) {
  return Boolean(String(value || "").trim());
}

async function openPluginPage(url) {
  const absoluteUrl = new URL(url, window.location.origin).toString();

  try {
    await openUrlInSystemBrowser(absoluteUrl);
  } catch {
    const popup = window.open(absoluteUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.href = absoluteUrl;
    }
  }
}

function formatInfoText(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => linkifyText(segment))
    .join("<br>");
}

async function openUrlInSystemBrowser(url) {
  try {
    const response = await fetch("/api/open-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error("open link failed");
    }
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function normalizeTask(task) {
  const status = deriveTaskStatus(task);
  return {
    ...task,
    status,
    meta: buildTaskMeta(task),
    tags: buildTaskTags(task),
  };
}

async function loadTasks() {
  const response = await fetch("/api/tasks", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("任务加载失败");
  }

  const payload = await response.json();
  taskStore.splice(0, taskStore.length, ...(payload.tasks || []).map(normalizeTask));
  lastRefreshAt = new Date();
}

async function loadQuickLinks() {
  const response = await fetch("/api/quick-links", { cache: "no-store" });
  if (!response.ok) {
    quickLinkGroups = defaultQuickLinkGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({ remark: "", ...item })),
    }));
    return;
  }

  const payload = await response.json();
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  quickLinkGroups = groups.map((group) => ({
    title: String(group.title || "").trim(),
    items: Array.isArray(group.items)
      ? group.items.map((item) => ({
          label: String(item.label || "").trim(),
          url: String(item.url || "").trim(),
          note: String(item.note || "").trim(),
          remark: String(item.remark || "").trim(),
        }))
      : [],
  }));
}

async function loadWorkDesk() {
  const response = await fetch("/api/work-desk", { cache: "no-store" });
  if (!response.ok) {
    workReferenceGroups = defaultWorkReferenceGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item })),
    }));
    return;
  }

  const payload = await response.json();
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  workReferenceGroups = groups.map((group) => ({
    title: String(group.title || "").trim(),
    items: Array.isArray(group.items)
      ? group.items.map((item) => ({
          lead: String(item.lead || "").trim(),
          note: String(item.note || "").trim(),
        }))
      : [],
  }));
}

async function loadPluginCards() {
  const response = await fetch("/api/plugin-cards", { cache: "no-store" });
  if (!response.ok) {
    pluginCards = defaultPluginCards.map((plugin) => ({ ...plugin }));
    return;
  }

  const payload = await response.json();
  const plugins = Array.isArray(payload.plugins) ? payload.plugins : [];
  pluginCards = plugins.map((plugin) => ({
    id: String(plugin.id || "").trim(),
    icon: String(plugin.icon || "").trim(),
    title: String(plugin.title || "").trim(),
    category: String(plugin.category || "").trim(),
    summary: String(plugin.summary || "").trim(),
    pageUrl: String(plugin.pageUrl || "").trim(),
    enabled: Boolean(plugin.enabled),
    status: plugin.enabled ? "Ready" : "Off",
  }));
}

function linkifyText(text) {
  const safe = String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  return safe.replace(/https?:\/\/[^\s<]+/g, (url) => {
    return `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`;
  });
}

function quickTaskElements() {
  return {
    backdrop: document.getElementById("taskModalBackdrop"),
    openButton: document.getElementById("quickCreateButton"),
    closeButton: document.getElementById("taskModalClose"),
    cancelButton: document.getElementById("quickTaskCancel"),
    form: document.getElementById("quickTaskForm"),
    title: document.getElementById("quickTaskTitle"),
    dueAt: document.getElementById("quickTaskDueAt"),
    reminder: document.getElementById("quickTaskReminder"),
    note: document.getElementById("quickTaskNote"),
    submit: document.getElementById("quickTaskSubmit"),
    feedback: document.getElementById("quickTaskFeedback"),
  };
}

function resetQuickTaskForm() {
  const elements = quickTaskElements();
  if (!elements.form) {
    return;
  }

  elements.form.reset();
  if (elements.reminder) {
    elements.reminder.value = "15";
  }
  if (elements.feedback) {
    elements.feedback.textContent = "";
    elements.feedback.classList.remove("is-error", "is-success");
  }
  quickTaskModalState = {
    open: false,
    mode: "create",
    editId: "",
  };
  const modalTitle = document.getElementById("taskModalTitle");
  if (modalTitle) {
    modalTitle.textContent = "新增单次任务";
  }
  if (elements.submit) {
    elements.submit.textContent = "保存任务";
    elements.submit.disabled = false;
  }
}

function setQuickTaskFeedback(message, type = "") {
  const { feedback } = quickTaskElements();
  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.classList.remove("is-error", "is-success");
  if (type) {
    feedback.classList.add(type);
  }
}

function toggleQuickTaskModal(open) {
  const elements = quickTaskElements();
  if (!elements.backdrop) {
    return;
  }

  elements.backdrop.classList.toggle("is-hidden", !open);
  quickTaskModalState.open = open;

  if (open) {
    window.requestAnimationFrame(() => {
      elements.title?.focus();
    });
    return;
  }

  resetQuickTaskForm();
  if (!isQuickTaskSubmitting) {
    elements.openButton?.focus();
  }
}

function fillQuickTaskForm(task) {
  const elements = quickTaskElements();
  const modalTitle = document.getElementById("taskModalTitle");

  if (modalTitle) {
    modalTitle.textContent = "编辑当前任务";
  }
  if (elements.title) {
    elements.title.value = task.title || "";
  }
  if (elements.dueAt) {
    elements.dueAt.value = task.dueAt || "";
  }
  if (elements.reminder) {
    elements.reminder.value = String(task.reminderMinutes ?? 15);
  }
  if (elements.note) {
    elements.note.value = task.note || "";
  }
  if (elements.submit) {
    elements.submit.textContent = "保存修改";
  }
}

function openQuickCreateModal() {
  resetQuickTaskForm();
  quickTaskModalState = {
    open: true,
    mode: "create",
    editId: "",
  };
  toggleQuickTaskModal(true);
}

function openQuickEditModal(taskId) {
  const task = taskStore.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  resetQuickTaskForm();
  quickTaskModalState = {
    open: true,
    mode: "edit",
    editId: taskId,
  };
  fillQuickTaskForm(task);
  toggleQuickTaskModal(true);
}

function isTaskUiBusy() {
  return isQuickTaskSubmitting || quickTaskModalState.open || runningLinkedHaftTaskIds.size > 0;
}

function getHomeTaskHaftLink(task) {
  if (task.source !== "template") {
    return null;
  }

  return homeTaskHaftLinks.find((link) => link.homeTitle === task.title) ?? null;
}

function getTaskBusinessDate(task) {
  const dueDate = String(task.dueAt || "").split("T")[0];
  return task.generatedDate || dueDate || "";
}

async function runLinkedHaftUploadFromHome(taskId) {
  if (runningLinkedHaftTaskIds.has(taskId)) {
    return;
  }

  const homeTask = taskStore.find((task) => task.id === taskId);
  const link = homeTask ? getHomeTaskHaftLink(homeTask) : null;
  if (!homeTask || !link) {
    return;
  }

  const businessDate = getTaskBusinessDate(homeTask);
  const note = document.getElementById("interactionNote");
  runningLinkedHaftTaskIds.add(taskId);
  if (note) {
    note.dataset.locked = "true";
    note.textContent = `正在执行 Haft ${link.haftTaskName}，任务日期 ${businessDate || "未指定"}，完成后会自动更新首页任务状态。`;
  }
  renderTaskBoard();

  try {
    const bootstrapResponse = await fetch("/api/plugins/haft-uploader/bootstrap", { cache: "no-store" });
    if (!bootstrapResponse.ok) {
      throw new Error("Haft 上传任务加载失败");
    }

    const bootstrap = await bootstrapResponse.json();
    const haftTask = (bootstrap.tasks || []).find((task) => task.name === link.haftTaskName);
    if (!haftTask?.id) {
      throw new Error(`未找到 Haft 任务：${link.haftTaskName}`);
    }

    const runResponse = await fetch(`/api/plugins/haft-uploader/tasks/${encodeURIComponent(haftTask.id)}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        downloadDate: businessDate,
        homeTaskDate: businessDate,
      }),
    });
    const payload = await runResponse.json().catch(() => ({}));
    if (!runResponse.ok) {
      throw new Error(payload.error || "Haft 任务执行失败");
    }

    await refreshTaskBoardData();
    if (note) {
      note.dataset.locked = "true";
      note.textContent = payload.linkedHomeTask?.updated
        ? `Haft ${link.haftTaskName} 已完成，首页任务已同步完成。`
        : `Haft ${link.haftTaskName} 已完成，首页任务状态已刷新。`;
    }
  } catch (error) {
    if (note) {
      note.dataset.locked = "true";
      note.textContent = error.message || "Haft 任务执行失败，请到 Haft 自动上传页面查看日志。";
    }
  } finally {
    runningLinkedHaftTaskIds.delete(taskId);
    renderTaskBoard();
    if (note) {
      window.clearTimeout(runLinkedHaftUploadFromHome.resetTimer);
      runLinkedHaftUploadFromHome.resetTimer = window.setTimeout(() => {
        delete note.dataset.locked;
        renderHeader();
      }, 3200);
    }
  }
}

async function refreshTaskBoardData() {
  boardConfig.focusDate = new Date();
  await Promise.all([loadTasks(), loadQuickLinks(), loadWorkDesk(), loadPluginCards()]);
  renderHeader();
  renderCalendar();
  renderTaskBoard();
  renderDeskPanel();
}

async function maybeRefreshTasks() {
  if (isTaskUiBusy()) {
    return;
  }

  try {
    await refreshTaskBoardData();
  } catch (error) {
    // Keep the wallpaper quiet when background refresh fails.
  }
}

async function submitQuickTask(event) {
  event.preventDefault();
  if (isQuickTaskSubmitting) {
    return;
  }

  const elements = quickTaskElements();
  const title = String(elements.title?.value || "").trim();
  const dueAt = String(elements.dueAt?.value || "").trim();
  const reminderMinutes = Number(elements.reminder?.value || 15);
  const note = String(elements.note?.value || "").trim();

  if (!title) {
    setQuickTaskFeedback("请先填写任务标题。", "is-error");
    elements.title?.focus();
    return;
  }

  if (dueAt) {
    const parsedDueAt = parseLocalDateTimeString(dueAt);
    if (!parsedDueAt) {
      setQuickTaskFeedback("截止时间格式不合法。", "is-error");
      elements.dueAt?.focus();
      return;
    }
  }

  isQuickTaskSubmitting = true;
  if (elements.submit) {
    elements.submit.disabled = true;
    elements.submit.textContent = "保存中...";
  }
  setQuickTaskFeedback("正在保存任务...");

  try {
    const isEditMode = quickTaskModalState.mode === "edit" && quickTaskModalState.editId;
    const response = await fetch(
      isEditMode ? `/api/tasks/${quickTaskModalState.editId}` : "/api/tasks",
      {
        method: isEditMode ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        dueAt,
        reminderMinutes: Number.isFinite(reminderMinutes) ? reminderMinutes : 15,
        note,
      }),
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "任务保存失败");
    }

    await refreshTaskBoardData();
    setQuickTaskFeedback(isEditMode ? "任务已更新。" : "任务已创建。", "is-success");
    window.setTimeout(() => {
      isQuickTaskSubmitting = false;
      if (elements.submit) {
        elements.submit.disabled = false;
        elements.submit.textContent = "保存任务";
      }
      toggleQuickTaskModal(false);
    }, 260);
    return;
  } catch (error) {
    setQuickTaskFeedback(error.message || "任务保存失败。", "is-error");
  }

  isQuickTaskSubmitting = false;
  if (elements.submit) {
    elements.submit.disabled = false;
    elements.submit.textContent = "保存任务";
  }
}

const calendarMarkers = {
  "2026-02-12": ["holiday"],
  "2026-02-18": ["meeting"],
  "2026-02-27": ["deadline"],
  "2026-03-06": ["meeting"],
  "2026-03-16": ["deadline"],
  "2026-03-27": ["holiday"],
  "2026-04-10": ["meeting", "deadline"],
  "2026-04-11": ["meeting"],
  "2026-04-12": ["deadline"],
  "2026-05-08": ["meeting"],
  "2026-05-25": ["deadline"],
  "2026-06-15": ["meeting"],
  "2026-06-22": ["deadline"],
  "2026-07-10": ["holiday"],
  "2026-07-24": ["deadline"],
  "2026-08-14": ["meeting"],
  "2026-08-28": ["deadline"],
  "2026-09-07": ["holiday"],
  "2026-09-18": ["meeting"],
  "2026-09-30": ["deadline"],
  "2026-10-16": ["meeting"],
  "2026-10-30": ["deadline"],
  "2026-11-06": ["meeting"],
  "2026-11-26": ["holiday"],
  "2026-12-11": ["meeting"],
  "2026-12-18": ["deadline"],
  "2027-01-08": ["meeting"],
  "2027-01-22": ["deadline"],
  "2027-01-29": ["deadline"],
};

const quarterTheme = ["q1", "q2", "q3", "q4"];

const formatMonthDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const formatLongDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

const formatRangeDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatMonthName = new Intl.DateTimeFormat("en-US", {
  month: "long",
});

const formatActionTime = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formatClockTime = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formatRefreshTime = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function buildDateRange(start, end) {
  const dates = [];
  let cursor = atMidday(new Date(`${start}T00:00:00`));
  const finish = atMidday(new Date(`${end}T00:00:00`));

  while (cursor <= finish) {
    dates.push(toIsoDate(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates;
}

const holidayDateSet = new Set([
  ...buildDateRange("2026-02-14", "2026-02-23"),
  ...buildDateRange("2026-04-04", "2026-04-06"),
  ...buildDateRange("2026-05-01", "2026-05-05"),
  ...buildDateRange("2026-06-19", "2026-06-21"),
  ...buildDateRange("2026-09-25", "2026-09-27"),
  ...buildDateRange("2026-10-01", "2026-10-07"),
]);

const makeupWorkdaySet = new Set([
  "2026-02-28",
  "2026-05-09",
  "2026-09-20",
  "2026-10-10",
]);

function atMidday(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = atMidday(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoDate(date) {
  return atMidday(date).toISOString().slice(0, 10);
}

function sameDate(left, right) {
  return toIsoDate(left) === toIsoDate(right);
}

function fiscalWeek(date) {
  const diff = Math.floor((atMidday(date) - atMidday(boardConfig.fiscalStart)) / MS_PER_DAY);
  return Math.floor(diff / 7) + 1;
}

function monthSequence() {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(2026, 1 + index, 1);
    return {
      date,
      year: date.getFullYear(),
      month: date.getMonth(),
      label: formatMonthName.format(date),
      quarter: Math.floor(index / 3) + 1,
      fiscalMonth: index + 1,
    };
  });
}

function buildFiscalPeriods() {
  const firstLabelMonth = (boardConfig.fiscalStart.getMonth() + 1) % 12;
  let periodStart = atMidday(boardConfig.fiscalStart);

  return Array.from({ length: 12 }, (_, index) => {
    const weeks = FISCAL_MONTH_PATTERN[index % 3];
    const periodEnd = addDays(periodStart, weeks * 7 - 1);
    const labelMonth = (firstLabelMonth + index) % 12;
    const label = formatMonthName.format(new Date(2026, labelMonth, 1));
    const quarter = Math.floor(index / 3) + 1;

    const weekRows = Array.from({ length: weeks }, (_, weekOffset) => {
      const weekStart = addDays(periodStart, weekOffset * 7);
      const fiscalWeekNumber = fiscalWeek(weekStart);
      const quarterWeekNumber = ((fiscalWeekNumber - 1) % 13) + 1;

      return {
        quarterWeekNumber,
        fiscalWeekNumber,
        weekStart,
        days: Array.from({ length: 7 }, (_, dayOffset) => addDays(weekStart, dayOffset)),
      };
    });

    const period = {
      label,
      quarter,
      fiscalMonth: index + 1,
      start: periodStart,
      end: periodEnd,
      weeks,
      weekRows,
    };

    periodStart = addDays(periodStart, weeks * 7);
    return period;
  });
}

function renderHeader() {
  const focusDate = boardConfig.focusDate;
  const currentWeek = fiscalWeek(focusDate);
  const fiscalMonths = monthSequence();
  const currentMonthIndex = fiscalMonths.findIndex(
    (month) => month.year === focusDate.getFullYear() && month.month === focusDate.getMonth(),
  );
  const quarter = Math.floor(currentMonthIndex / 3) + 1;

  document.getElementById("dateRange").textContent =
    `${formatRangeDate.format(boardConfig.fiscalStart)} - ${formatRangeDate.format(boardConfig.fiscalEnd)}`;
  document.getElementById("quarterPill").textContent = `${boardConfig.fiscalYearLabel} Q${quarter}`;
  document.getElementById("weekPill").textContent = `Week ${currentWeek}`;
  document.getElementById("todayPill").textContent = formatMonthDay.format(focusDate);
  document.getElementById("todayLabel").textContent = formatLongDate.format(focusDate);
  document.getElementById("todayQuarterLabel").textContent =
    `${boardConfig.fiscalYearLabel} Q${quarter} | Week ${currentWeek} | 本地任务板`;

  const todayTasks = taskStore.filter((task) => task.status === "today");
  const overdueTasks = taskStore.filter((task) => task.status === "overdue");
  const laterTasks = taskStore.filter((task) => task.status === "later");
  const doneTasks = taskStore.filter((task) => task.completed);
  const overdueAlerts = taskStore.filter((task) => getTaskAlert(task)?.type === "overdue").length;
  const soonAlerts = taskStore.filter((task) => getTaskAlert(task)?.type === "soon").length;

  document.getElementById("statusLine").textContent =
    `逾期提醒 ${overdueAlerts} 项 | 15 分钟内到期 ${soonAlerts} 项 | 已完成 ${doneTasks.length} 项`;

  const note = document.getElementById("interactionNote");
  if (note && !note.dataset.locked) {
    note.textContent =
      currentTaskView === "focus"
        ? `当前是聚焦待办视图，逾期 ${overdueAlerts} 项，另有 ${soonAlerts} 项会在 15 分钟内到期。`
        : `当前是全部任务视图，包含已完成 ${doneTasks.length} 项；逾期和临期任务会有醒目提醒。`;
  }

  const refreshNote = document.getElementById("refreshNote");
  if (refreshNote) {
    refreshNote.textContent = lastRefreshAt
      ? `上次刷新：${formatRefreshTime.format(lastRefreshAt)}`
      : "上次刷新：未同步";
  }
}

function renderCompactList(id, items) {
  const host = document.getElementById(id);
  host.innerHTML = "";

  items.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    host.appendChild(item);
  });
}

function renderReferenceGrid(id, groups) {
  const host = document.getElementById(id);
  host.innerHTML = "";
  host.classList.remove("is-links");

  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "reference-group";

    const title = document.createElement("div");
    title.className = "reference-title";
    title.textContent = group.title;

    const list = document.createElement("ul");
    list.className = "reference-list";

    group.items.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "reference-item";
      item.innerHTML = `<span class="reference-lead">${entry.lead}</span><span class="reference-note">${entry.note}</span>`;
      list.appendChild(item);
    });

    section.append(title, list);
    host.appendChild(section);
  });
}

function renderCommonLinksGrid(id, groups) {
  const host = document.getElementById(id);
  host.innerHTML = "";
  host.classList.add("is-links");

  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "reference-group";

    const title = document.createElement("div");
    title.className = "reference-title";
    title.textContent = group.title;

    const list = document.createElement("div");
    list.className = "quick-link-list";

    group.items.forEach((entry, entryIndex) => {
      const itemKey = `${group.title}:${entryIndex}`;
      const hasInfo = hasText(entry.remark);
      const isInfoExpanded = activeQuickLinkInfoKey === itemKey;

      const card = document.createElement("div");
      card.className = "quick-link-card";

      const row = document.createElement("div");
      row.className = "quick-link-row";
      row.setAttribute("role", "link");
      row.setAttribute("tabindex", "0");
      row.setAttribute("aria-label", `${entry.label} ${hasText(entry.note) ? entry.note : ""}`.trim());

      const openQuickLink = () => {
        void openUrlInSystemBrowser(entry.url);
      };

      row.addEventListener("click", (event) => {
        if (event.target.closest("a, button")) {
          return;
        }
        openQuickLink();
      });

      row.addEventListener("keydown", (event) => {
        if (event.target.closest("a, button")) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openQuickLink();
        }
      });

      const main = document.createElement("div");
      main.className = "quick-link-main";

      if (hasInfo) {
        const infoButton = document.createElement("button");
        infoButton.className = "quick-link-info-button";
        infoButton.type = "button";
        infoButton.textContent = getDisclosureArrow(isInfoExpanded);
        infoButton.setAttribute("aria-label", `${entry.label} 说明`);
        infoButton.setAttribute("aria-expanded", isInfoExpanded ? "true" : "false");
        infoButton.addEventListener("click", (event) => {
          event.stopPropagation();
          activeQuickLinkInfoKey = activeQuickLinkInfoKey === itemKey ? "" : itemKey;
          renderDeskPanel();
        });
        main.appendChild(infoButton);
      }

      const anchor = document.createElement("a");
      anchor.className = "quick-link-anchor";
      anchor.href = entry.url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.textContent = entry.label;
      anchor.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openQuickLink();
      });

      const description = document.createElement("span");
      description.className = "quick-link-description";
      description.textContent = entry.note;

      const url = document.createElement("span");
      url.className = "quick-link-url";
      url.textContent = new URL(entry.url).hostname.replace(/^www\./, "");

      main.appendChild(anchor);
      if (hasText(entry.note)) {
        main.appendChild(description);
      }
      row.append(main, url);
      card.appendChild(row);

      if (hasInfo && isInfoExpanded) {
        const infoPanel = document.createElement("div");
        infoPanel.className = "quick-link-info-panel";

        if (hasText(entry.remark)) {
          const remarkBlock = document.createElement("div");
          remarkBlock.className = "quick-link-info-block";

          const remarkLabel = document.createElement("div");
          remarkLabel.className = "quick-link-info-label";
          remarkLabel.textContent = "说明";

          const remarkContent = document.createElement("div");
          remarkContent.className = "quick-link-info-content";
          remarkContent.innerHTML = formatInfoText(entry.remark);

          remarkBlock.append(remarkLabel, remarkContent);
          infoPanel.appendChild(remarkBlock);
        }

        card.appendChild(infoPanel);
      }

      list.appendChild(card);
    });

    section.append(title, list);
    host.appendChild(section);
  });
}

function renderPluginHub(id) {
  const host = document.getElementById(id);
  host.innerHTML = "";
  host.classList.remove("is-links");
  host.classList.add("is-plugins");
  const launcher = document.createElement("section");
  launcher.className = "plugin-launcher";

  const grid = document.createElement("div");
  grid.className = "plugin-launcher-grid";

  const activePlugins = pluginCards.filter((plugin) => plugin.enabled);

  if (!activePlugins.length) {
    const empty = document.createElement("div");
    empty.className = "plugin-launcher-empty";
    empty.textContent = "No plugin is enabled right now.";
    host.appendChild(empty);
    return;
  }

  activePlugins.forEach((plugin) => {
    const card = document.createElement("button");
    card.className = "plugin-launcher-card";
    card.type = "button";
    card.title = `Open ${plugin.title}`;
    card.addEventListener("click", () => {
      void openPluginPage(plugin.pageUrl);
    });

    const icon = document.createElement("div");
    icon.className = "plugin-launcher-icon";
    icon.textContent = plugin.icon;

    const meta = document.createElement("div");
    meta.className = "plugin-launcher-meta";

    const eyebrow = document.createElement("div");
    eyebrow.className = "plugin-launcher-eyebrow";
    eyebrow.textContent = plugin.category;

    const title = document.createElement("div");
    title.className = "plugin-launcher-title";
    title.textContent = plugin.title;

    const summary = document.createElement("div");
    summary.className = "plugin-launcher-summary";
    summary.textContent = plugin.summary;

    const footer = document.createElement("div");
    footer.className = "plugin-launcher-footer";

    const status = document.createElement("span");
    status.className = "plugin-launcher-status";
    status.textContent = plugin.enabled ? "Enabled" : "Disabled";

    footer.append(status);
    meta.append(eyebrow, title, summary, footer);
    card.append(icon, meta);
    grid.appendChild(card);
  });

  launcher.append(grid);
  host.appendChild(launcher);
}

function syncDeskTabs() {
  let activeButtonId = "";

  document.querySelectorAll("[data-desk-tab]").forEach((button) => {
    const isActive = button.dataset.deskTab === currentDeskTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");

    if (isActive) {
      activeButtonId = button.id;
    }
  });

  const panel = document.getElementById("referenceGrid");
  if (panel && activeButtonId) {
    panel.setAttribute("aria-labelledby", activeButtonId);
  }
}

function renderDeskPanel() {
  const panel = document.getElementById("referenceGrid");
  if (panel) {
    panel.classList.remove("is-links", "is-plugins");
  }

  if (currentDeskTab === "links") {
    renderCommonLinksGrid("referenceGrid", quickLinkGroups);
  } else if (currentDeskTab === "plugins") {
    renderPluginHub("referenceGrid");
  } else {
    renderReferenceGrid("referenceGrid", workReferenceGroups);
  }

  syncDeskTabs();
}

function sortTasksByDueDate(tasks) {
  return [...tasks].sort((left, right) => {
    if (!left.dueAt && !right.dueAt) return 0;
    if (!left.dueAt) return 1;
    if (!right.dueAt) return -1;
    return new Date(left.dueAt) - new Date(right.dueAt);
  });
}

function sortTodayBucket(tasks) {
  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "overdue" ? -1 : 1;
    }

    const leftTime = left.dueAt ? new Date(left.dueAt) : null;
    const rightTime = right.dueAt ? new Date(right.dueAt) : null;
    if (!leftTime && !rightTime) return 0;
    if (!leftTime) return 1;
    if (!rightTime) return -1;

    if (left.status === "overdue") {
      return rightTime - leftTime;
    }

    return leftTime - rightTime;
  });
}

function collapseRecurringTasks(tasks) {
  const buckets = new Map();

  tasks.forEach((task) => {
    if (!task.recurring || !task.templateId) {
      buckets.set(`manual:${task.id}`, task);
      return;
    }

    const current = buckets.get(task.templateId);
    if (!current) {
      buckets.set(task.templateId, task);
      return;
    }

    const currentTime = current.dueAt ? new Date(current.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const nextTime = task.dueAt ? new Date(task.dueAt).getTime() : Number.POSITIVE_INFINITY;

    if (nextTime < currentTime) {
      buckets.set(task.templateId, task);
    }
  });

  return Array.from(buckets.values());
}

function groupedTasks() {
  const activeTasks = collapseRecurringTasks(taskStore.filter((task) => !task.completed));
  const todayTasks = activeTasks.filter((task) => task.status === "today");
  const overdueTasks = activeTasks.filter((task) => task.status === "overdue");
  const laterTasks = activeTasks.filter((task) => task.status === "later");
  const doneTasks = taskStore.filter((task) => task.completed);

  return {
    today: sortTodayBucket(overdueTasks.concat(todayTasks)),
    later: sortTasksByDueDate(laterTasks),
    done: [...doneTasks].sort((left, right) => {
      return new Date(right.completedAt || right.updatedAt || 0) - new Date(left.completedAt || left.updatedAt || 0);
    }),
  };
}

async function toggleTaskStatus(taskId) {
  const task = taskStore.find((entry) => entry.id === taskId);

  if (!task) {
    return;
  }

  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...task,
      completed: !task.completed,
    }),
  });

  if (!response.ok) {
    return;
  }

  await refreshTaskBoardData();
}

function toggleTaskInfo(taskId) {
  activeTaskInfoId = activeTaskInfoId === taskId ? "" : taskId;
  renderTaskBoard();
}

function taskGroupConfig(view) {
  const base = [
    { key: "today", title: "今天要完成", empty: "今天的关键任务还没有放进来。" },
    { key: "later", title: "暂不着急", empty: "当前没有后续任务。" },
  ];

  if (view === "all") {
    base.push({ key: "done", title: "已完成", empty: "还没有完成记录。" });
  }

  return base;
}

function renderTaskBoard() {
  const host = document.getElementById("taskBoard");

  if (!host) {
    return;
  }

  const tasksByGroup = groupedTasks();
  host.innerHTML = "";

  taskGroupConfig(currentTaskView).forEach((group) => {
    const section = document.createElement("section");
    section.className = "task-group";

    const header = document.createElement("div");
    header.className = "task-group-header";
    header.innerHTML = `
      <span class="task-group-title">${group.title}</span>
      <span class="task-group-count">${tasksByGroup[group.key].length}</span>
    `;

    const list = document.createElement("ul");
    list.className = "task-list";

    if (!tasksByGroup[group.key].length) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "task-item";
      emptyItem.innerHTML = `<div class="task-main"><div class="task-meta">${group.empty}</div></div>`;
      list.appendChild(emptyItem);
    } else {
      tasksByGroup[group.key].forEach((task) => {
        const item = document.createElement("li");
        item.className = "task-item";
        const alert = getTaskAlert(task);
        if (task.completed) {
          item.classList.add("is-done");
        }
        if (alert) {
          item.classList.add(`has-alert-${alert.type}`);
        }

        const checkbox = document.createElement("input");
        checkbox.className = "task-check";
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", `${task.title} 完成状态`);
        if (getHomeTaskHaftLink(task) && !task.completed) {
          checkbox.disabled = true;
          checkbox.title = "请通过右侧执行按钮完成 Haft 上传后自动完成任务";
        } else {
          checkbox.addEventListener("change", () => {
            toggleTaskStatus(task.id);
          });
        }

        const main = document.createElement("div");
        main.className = "task-main";

        const titleRow = document.createElement("div");
        titleRow.className = "task-title-row";

        const title = document.createElement("div");
        title.className = "task-title";
        title.textContent = task.title;
        const hasTaskInfo = hasText(task.note);
        const isTaskInfoExpanded = activeTaskInfoId === task.id;

        const editButton = document.createElement("button");
        editButton.className = "task-edit-button";
        editButton.type = "button";
        editButton.textContent = "!";
        editButton.setAttribute("aria-label", `${task.title} 编辑任务`);
        editButton.addEventListener("click", (event) => {
          event.stopPropagation();
          openQuickEditModal(task.id);
        });

        titleRow.append(title);
        titleRow.appendChild(editButton);
        if (hasTaskInfo) {
          const infoButton = document.createElement("button");
          infoButton.className = "task-info-button";
          infoButton.type = "button";
          infoButton.textContent = getDisclosureArrow(isTaskInfoExpanded);
          infoButton.setAttribute("aria-label", `${task.title} 任务说明`);
          infoButton.setAttribute("aria-expanded", isTaskInfoExpanded ? "true" : "false");
          infoButton.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleTaskInfo(task.id);
          });
          titleRow.appendChild(infoButton);
        }

        const meta = document.createElement("div");
        meta.className = "task-meta";
        meta.textContent = task.meta;

        const tags = document.createElement("div");
        tags.className = "task-tags";
        task.tags.forEach((tag) => {
          const pill = document.createElement("span");
          const normalizedTag = tag.toLowerCase().replace(/[^a-z]+/g, "-");
          pill.className = `task-tag ${normalizedTag}`;
          pill.textContent = tag;
          tags.appendChild(pill);
        });

        const action = document.createElement("div");
        action.className = "task-action";
        if (task.completed) {
          action.classList.add("is-done");
        } else if (alert?.type === "overdue") {
          action.classList.add("is-muted");
        }

        const shouldRenderHaftRunButton = getHomeTaskHaftLink(task) && !task.completed && task.status !== "later";
        if (shouldRenderHaftRunButton) {
          const isRunning = runningLinkedHaftTaskIds.has(task.id);
          const runButton = document.createElement("button");
          runButton.className = "task-run-button";
          runButton.type = "button";
          runButton.disabled = isRunning;
          runButton.textContent = isRunning ? "执行中..." : "执行上传";
          runButton.setAttribute("aria-label", `${task.title} 执行 Haft 上传`);
          runButton.addEventListener("click", (event) => {
            event.stopPropagation();
            runLinkedHaftUploadFromHome(task.id);
          });
          action.appendChild(runButton);
        } else {
          action.textContent = task.completed ? "已完成" : "待完成";
        }

        main.append(titleRow, meta);

        if (hasTaskInfo && isTaskInfoExpanded) {
          const infoPanel = document.createElement("div");
          infoPanel.className = "task-info-panel";
          infoPanel.innerHTML = linkifyText(task.note);
          main.append(infoPanel);
        }

        if (alert) {
          const alertBadge = document.createElement("div");
          alertBadge.className = `task-alert-badge is-${alert.type}`;
          alertBadge.textContent = alert.label;
          main.append(alertBadge, tags);
        } else {
          main.append(tags);
        }
        item.append(checkbox, main, action);
        list.appendChild(item);
      });
    }

    section.append(header, list);
    host.appendChild(section);
  });
}

function buildDateCell(date, currentWeek) {
  const cell = document.createElement("div");
  const isoDate = toIsoDate(date);
  const day = date.getDay();
  cell.className = "date-cell";

  const isHoliday = holidayDateSet.has(isoDate);
  const isMakeupWorkday = makeupWorkdaySet.has(isoDate);
  const isWeekend = day === 0 || day === 6;

  if (isHoliday || (isWeekend && !isMakeupWorkday)) {
    cell.classList.add("is-weekend");
  }

  if (isHoliday) {
    cell.classList.add("is-holiday");
  }

  if (isMakeupWorkday) {
    cell.classList.add("is-makeup-workday");
  }

  if (fiscalWeek(date) === currentWeek) {
    cell.classList.add("is-current-week");
  }

  if (sameDate(date, boardConfig.focusDate)) {
    cell.classList.add("is-today");
  }

  const number = document.createElement("span");
  number.className = "day-number";
  number.textContent = date.getDate();

  const markerRow = document.createElement("span");
  markerRow.className = "marker-row";

  (calendarMarkers[isoDate] || []).forEach((markerType) => {
    const marker = document.createElement("i");
    marker.className = `marker marker-${markerType}`;
    markerRow.appendChild(marker);
  });

  cell.append(number, markerRow);
  return cell;
}

function renderCalendar() {
  const host = document.getElementById("calendarGrid");
  const fiscalMonths = buildFiscalPeriods();
  const currentWeek = fiscalWeek(boardConfig.focusDate);
  const currentQuarter = Math.floor(
    fiscalMonths.findIndex(
      (month) =>
        atMidday(boardConfig.focusDate) >= atMidday(month.start) &&
        atMidday(boardConfig.focusDate) <= atMidday(month.end),
    ) / 3,
  ) + 1;

  host.innerHTML = "";

  const leadingAxis = document.createElement("div");
  leadingAxis.className = "calendar-quarter-axis";

  const leadingAxisTop = document.createElement("div");
  leadingAxisTop.className = "calendar-quarter-axis-top";
  leadingAxis.appendChild(leadingAxisTop);

  fiscalMonths
    .filter((month) => month.quarter === 1)
    .forEach((month, monthIndex) => {
      const axisSegment = document.createElement("div");
      axisSegment.className = `quarter-axis-segment weeks-${month.weeks}`;

      const axisSpacer = document.createElement("div");
      axisSpacer.className = "quarter-axis-spacer";
      if (monthIndex === 0) {
        axisSpacer.textContent = "Q";
      }
      axisSegment.appendChild(axisSpacer);

      month.weekRows.forEach((weekRow) => {
        const axisNumber = document.createElement("span");
        axisNumber.className = "quarter-axis-number";
        if (weekRow.fiscalWeekNumber === currentWeek) {
          axisNumber.classList.add("is-current-week");
        }
        axisNumber.textContent = weekRow.quarterWeekNumber;
        axisSegment.appendChild(axisNumber);
      });

      leadingAxis.appendChild(axisSegment);
    });

  host.appendChild(leadingAxis);

  for (let quarter = 1; quarter <= 4; quarter += 1) {
    const column = document.createElement("section");
    column.className = `quarter-column ${quarterTheme[quarter - 1]}`;
    if (quarter === currentQuarter) {
      column.classList.add("current-quarter");
    }

    const header = document.createElement("div");
    header.className = "quarter-header";
    header.innerHTML = `
      <span class="quarter-label">${boardConfig.fiscalYearLabel}Q${quarter}</span>
      <span class="quarter-caption">Quarter ${quarter}</span>
    `;
    column.appendChild(header);

    const monthStack = document.createElement("div");
    monthStack.className = "quarter-months";

    fiscalMonths
      .filter((month) => month.quarter === quarter)
      .forEach((month) => {
        const monthCard = document.createElement("article");
        monthCard.className = `month-card weeks-${month.weeks}`;

        if (
          atMidday(boardConfig.focusDate) >= atMidday(month.start) &&
          atMidday(boardConfig.focusDate) <= atMidday(month.end)
        ) {
          monthCard.classList.add("current-month");
        }

        const head = document.createElement("div");
        head.className = "month-head";
        head.innerHTML = `
          <span class="month-index">Month ${month.fiscalMonth}</span>
          <span class="month-name">${month.label}</span>
        `;

        const weekdayRow = document.createElement("div");
        weekdayRow.className = "weekday-row";
        WEEKDAY_LABELS.forEach((label) => {
          const cell = document.createElement("span");
          cell.className = "weekday";
          if (label === "Sat" || label === "Sun") {
            cell.classList.add("is-weekend");
          }
          cell.textContent = label;
          weekdayRow.appendChild(cell);
        });

        const weekRows = document.createElement("div");
        weekRows.className = "period-rows";

        month.weekRows.forEach((weekRow) => {
          const row = document.createElement("div");
          row.className = "period-row";
          if (weekRow.fiscalWeekNumber === currentWeek) {
            row.classList.add("is-current-week");
          }
          weekRow.days.forEach((date) => {
            row.appendChild(buildDateCell(date, currentWeek));
          });
          weekRows.appendChild(row);
        });

        monthCard.append(head, weekdayRow, weekRows);
        monthStack.appendChild(monthCard);
      });

    column.appendChild(monthStack);

    host.appendChild(column);
  }
}

function initInteractionDemo() {
  const toolbar = document.getElementById("taskToolbar");
  const note = document.getElementById("interactionNote");

  if (!toolbar || !note) {
    return;
  }

  toolbar.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedView = button.dataset.view;

      if (!selectedView || selectedView === currentTaskView) {
        return;
      }

      currentTaskView = selectedView;
      const actionTime = formatActionTime.format(new Date());

      toolbar.querySelectorAll("[data-view]").forEach((item) => {
        item.classList.toggle("is-active", item.dataset.view === currentTaskView);
      });

      note.dataset.locked = "true";
      note.textContent =
        currentTaskView === "focus"
          ? `已切到聚焦待办 ${actionTime}，右侧只看今天、延期和后续任务。`
          : `已切到全部任务 ${actionTime}，现在会同时显示已完成任务。`;

      renderHeader();
      renderTaskBoard();

      window.clearTimeout(initInteractionDemo.resetTimer);
      initInteractionDemo.resetTimer = window.setTimeout(() => {
        delete note.dataset.locked;
        renderHeader();
      }, 2200);
    });
  });
}

function initDeskTabs() {
  const tabs = document.getElementById("deskTabs");

  if (!tabs) {
    return;
  }

  tabs.querySelectorAll("[data-desk-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedTab = button.dataset.deskTab;

      if (!selectedTab || selectedTab === currentDeskTab) {
        return;
      }

      currentDeskTab = selectedTab;
      renderDeskPanel();
    });
  });
}

function initQuickTaskModal() {
  const elements = quickTaskElements();
  if (!elements.backdrop || !elements.openButton || !elements.form) {
    return;
  }

  elements.openButton.addEventListener("click", () => openQuickCreateModal());
  elements.closeButton?.addEventListener("click", () => toggleQuickTaskModal(false));
  elements.cancelButton?.addEventListener("click", () => toggleQuickTaskModal(false));
  elements.form.addEventListener("submit", submitQuickTask);

  elements.backdrop.addEventListener("click", (event) => {
    if (event.target === elements.backdrop && !isQuickTaskSubmitting) {
      toggleQuickTaskModal(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.backdrop.classList.contains("is-hidden") && !isQuickTaskSubmitting) {
      toggleQuickTaskModal(false);
    }
  });
}

function initAutoRefresh() {
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer);
  }

  autoRefreshTimer = window.setInterval(() => {
    maybeRefreshTasks();
  }, AUTO_REFRESH_MS);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      maybeRefreshTasks();
    }
  });
}

async function init() {
  try {
    await refreshTaskBoardData();
  } catch (error) {
    const note = document.getElementById("interactionNote");
    if (note) {
      note.textContent = "任务数据加载失败，请先启动本地服务。";
    }
  }

  renderCalendar();
  initDeskTabs();
  renderDeskPanel();
  initInteractionDemo();
  initQuickTaskModal();
  initAutoRefresh();
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".task-main")) {
      if (activeTaskInfoId) {
        activeTaskInfoId = "";
        renderTaskBoard();
      }
    }

    if (!event.target.closest(".quick-link-card")) {
      if (activeQuickLinkInfoKey) {
        activeQuickLinkInfoKey = "";
        if (currentDeskTab === "links") {
          renderDeskPanel();
        }
      }
    }
  });
}

init();
