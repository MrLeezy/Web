const PLUGIN_ID = "haft-uploader";
const API_BASE = `${window.location.origin}/api/plugins/${PLUGIN_ID}`;
const LOG_GROUP_PREVIEW_COUNT = 5;

const state = {
  accounts: [],
  tasks: [],
  scheduler: { running: false, jobCount: 0 },
  logs: [],
  runningTaskIds: new Set(),
  openLogGroups: new Set(["failed"]),
  expandedLogGroups: new Set(),
};

const elements = {
  pluginTypeBadge: document.querySelector("#pluginTypeBadge"),
  pluginCategoryBadge: document.querySelector("#pluginCategoryBadge"),
  pluginTitle: document.querySelector("#pluginTitle"),
  pluginSummary: document.querySelector("#pluginSummary"),
  heroStatus: document.querySelector("#heroStatus"),
  schedulerStateValue: document.querySelector("#schedulerStateValue"),
  enabledTaskValue: document.querySelector("#enabledTaskValue"),
  accountCountValue: document.querySelector("#accountCountValue"),
  protectedCountValue: document.querySelector("#protectedCountValue"),
  taskList: document.querySelector("#taskList"),
  logList: document.querySelector("#logList"),
  taskSectionMeta: document.querySelector("#taskSectionMeta"),
  logSectionMeta: document.querySelector("#logSectionMeta"),
  accountKey: document.querySelector("#accountKey"),
  form: document.querySelector("#taskForm"),
  formTitle: document.querySelector("#formTitle"),
  formMessage: document.querySelector("#formMessage"),
  existingTaskId: document.querySelector("#existingTaskId"),
  refreshButton: document.querySelector("#refreshButton"),
  createTaskButton: document.querySelector("#createTaskButton"),
  schedulerToggleButton: document.querySelector("#schedulerToggleButton"),
  clearLogsButton: document.querySelector("#clearLogsButton"),
  resetFormButton: document.querySelector("#resetFormButton"),
  closeModalButton: document.querySelector("#closeModalButton"),
  taskModal: document.querySelector("#taskModal"),
  scheduleMode: document.querySelector("#scheduleMode"),
  fileSourceType: document.querySelector("#fileSourceType"),
  weekdayField: document.querySelector("#weekdayField"),
  directoryPathField: document.querySelector("#directoryPathField"),
  downloadDirField: document.querySelector("#downloadDirField"),
  urlsField: document.querySelector("#urlsField"),
  downloadDateModeField: document.querySelector("#downloadDateModeField"),
  customStartDateField: document.querySelector("#customStartDateField"),
  downloadDateMode: document.querySelector("#downloadDateMode"),
  customStartYear: document.querySelector("#customStartYear"),
  customStartMonth: document.querySelector("#customStartMonth"),
  customStartDay: document.querySelector("#customStartDay"),
};

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "请求失败");
  }

  return payload;
}

function setHeroStatus(message, isError = false) {
  elements.heroStatus.textContent = message;
  elements.heroStatus.classList.toggle("is-error", isError);
}

function setMessage(message, isError = false) {
  elements.formMessage.textContent = message;
  elements.formMessage.classList.toggle("is-error", isError);
}

async function loadPluginMeta() {
  try {
    const response = await fetch(`${window.location.origin}/api/plugin-cards`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const plugin = Array.isArray(payload.plugins) ? payload.plugins.find((item) => item.id === PLUGIN_ID) : null;
    if (!plugin) {
      return;
    }

    elements.pluginTitle.textContent = plugin.title;
    elements.pluginSummary.textContent = plugin.summary;
    elements.pluginCategoryBadge.textContent = plugin.category || "自动化";
    elements.pluginTypeBadge.textContent = plugin.enabled ? "内部插件" : "插件已停用";
    document.title = plugin.title;
  } catch {}
}

function renderStatus() {
  const enabledCount = state.tasks.filter((task) => task.enabled).length;
  const protectedCount = state.accounts.filter((account) => account.allowManualRun === false).length;
  const logCounts = countLogsByStatus(state.logs);

  setHeroStatus(
    `调度器${state.scheduler.running ? "运行中" : "已停止"}，已启用 ${enabledCount} 个任务，共 ${state.accounts.length} 个账号，其中 ${protectedCount} 个受保护账号。`,
  );

  elements.schedulerToggleButton.textContent = state.scheduler.running ? "停止调度器" : "启动调度器";
  elements.schedulerStateValue.textContent = state.scheduler.running ? "运行中" : "已停止";
  elements.enabledTaskValue.textContent = String(enabledCount);
  elements.accountCountValue.textContent = String(state.accounts.length);
  elements.protectedCountValue.textContent = String(protectedCount);
  elements.taskSectionMeta.textContent = `已配置 ${state.tasks.length} 个任务，启用 ${enabledCount} 个。`;
  elements.logSectionMeta.textContent = `最近 ${state.logs.length} 条日志：失败 ${logCounts.failed} 条，成功 ${logCounts.success} 条，跳过 ${logCounts.skipped} 条。`;
}

function renderTasks() {
  if (state.tasks.length === 0) {
    elements.taskList.innerHTML =
      '<div class="empty-state"><strong>还没有上传任务</strong><p class="muted">新建第一个 Haft 上传任务后，就可以在这里管理日常或定时执行。</p></div>';
    return;
  }

  const accountMap = new Map(state.accounts.map((account) => [account.key, account]));

  elements.taskList.innerHTML = state.tasks
    .map((task) => {
      const account = accountMap.get(task.accountKey);
      const running = state.runningTaskIds.has(task.id);
      const manualRunBlocked = account?.allowManualRun === false;
      const targetPath = Array.isArray(account?.targetPath) ? account.targetPath.join(" / ") : "-";
      const sourceSummary =
        task.fileSource.type === "directory"
          ? task.fileSource.directoryPath || "-"
          : `${task.fileSource.downloadDir || "-"} · ${task.fileSource.urls?.length || 0} 个下载链接`;
      const downloadDateMarkup =
        task.fileSource.type === "download"
          ? `
            <div class="kv-line">
              <span>下载日期</span>
              <strong>${escapeHtml(formatDownloadDateMode(task.fileSource.downloadDateMode, task.fileSource.customStartDate))}</strong>
            </div>
          `
          : "";

      return `
        <article class="task-item">
          <div class="task-top">
            <div class="task-title-block">
              <strong class="task-title">${escapeHtml(task.name)}</strong>
              <div class="task-subtitle">${escapeHtml(formatSchedule(task.schedule))}</div>
            </div>
            <span class="pill ${task.enabled ? "" : "off"}">${task.enabled ? "已启用" : "已停用"}</span>
          </div>

          <div class="task-kv">
            <div class="kv-line">
              <span>账号</span>
              <strong>${escapeHtml(account ? `${account.label} / ${account.username}` : task.accountKey)}</strong>
            </div>
            <div class="kv-line">
              <span>上传路径</span>
              <strong>${escapeHtml(targetPath)}</strong>
            </div>
            <div class="kv-line">
              <span>文件来源</span>
              <strong>${task.fileSource.type === "directory" ? "本地目录" : "链接下载"}</strong>
            </div>
            <div class="kv-line">
              <span>所需文件数</span>
              <strong>${escapeHtml(String(task.fileSource.requiredCount))}</strong>
            </div>
            ${downloadDateMarkup}
            <div class="kv-line kv-line-full">
              <span>来源详情</span>
              <strong>${escapeHtml(sourceSummary)}</strong>
            </div>
          </div>

          <div class="task-tags">
            <span class="mini-tag">${manualRunBlocked ? "手动执行已锁定" : running ? "运行中" : "可手动执行"}</span>
            <span class="mini-tag">${task.browser?.headless ? "无头浏览器" : "可见浏览器"}</span>
            <span class="mini-tag">${task.fileSource.type === "directory" ? "直接上传" : "先下载再上传"}</span>
            ${task.preprocess?.kind === "leads_splitter_auto" ? '<span class="mini-tag">上传前先自动拆表</span>' : ""}
          </div>

          <div class="task-actions">
            <button data-action="edit" data-task-id="${escapeHtml(task.id)}">编辑</button>
            <button data-action="run" data-task-id="${escapeHtml(task.id)}" ${manualRunBlocked || running ? "disabled" : ""}>
              ${running ? "运行中..." : "立即执行"}
            </button>
            <button data-action="delete" data-task-id="${escapeHtml(task.id)}" class="ghost">删除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLogs() {
  if (state.logs.length === 0) {
    elements.logList.innerHTML =
      '<div class="empty-state"><strong>还没有执行日志</strong><p class="muted">任务运行后，上传结果、文件列表和调试追踪路径会显示在这里。</p></div>';
    return;
  }

  const groupedLogs = [
    { status: "failed", open: true },
    { status: "success", open: false },
    { status: "skipped", open: false },
  ];

  elements.logList.innerHTML = groupedLogs
    .map(({ status, open }) => renderLogGroup(status, open))
    .join("");
}

function renderLogGroup(status, open) {
  const logs = state.logs.filter((log) => log.status === status);
  if (logs.length === 0) {
    return "";
  }

  const isOpen = state.openLogGroups.has(status) || open;
  const isExpanded = state.expandedLogGroups.has(status);
  const visibleLogs = isExpanded ? logs : logs.slice(0, LOG_GROUP_PREVIEW_COUNT);

  return `
    <section class="log-group log-group-${escapeHtml(status)} ${isOpen ? "is-open" : ""}">
      <button class="log-group-summary" type="button" data-action="toggle-group" data-status="${escapeHtml(status)}">
        <div class="log-group-title-wrap">
          <strong class="log-group-title">${escapeHtml(formatStatusLabel(status))}</strong>
          <span class="log-group-count">${escapeHtml(String(logs.length))} 条</span>
        </div>
        <span class="log-group-hint">${isOpen ? "收起" : "展开"}${logs.length > LOG_GROUP_PREVIEW_COUNT && !isExpanded ? ` · 最近 ${LOG_GROUP_PREVIEW_COUNT} 条` : ""}</span>
      </button>
      <div class="log-group-body ${isOpen ? "" : "hidden"}">
        <div class="log-group-list">
          ${visibleLogs.map((log) => renderLogCard(log)).join("")}
        </div>
        ${
          logs.length > LOG_GROUP_PREVIEW_COUNT
            ? `<div class="log-group-actions">
                <button class="log-group-toggle-button" type="button" data-action="toggle-group-size" data-status="${escapeHtml(status)}">
                  ${isExpanded ? "只看最近5条" : `查看全部（${logs.length} 条）`}
                </button>
              </div>`
            : ""
        }
      </div>
    </section>
  `;
}

function renderLogCard(log) {
  const fileCount = log.fileCount ?? log.fileNames.length;
  const detailsMarkup = renderLogDetails(log);

  return `
    <article class="log-item">
      <div class="log-top">
        <div class="task-title-block">
          <strong class="task-title">${escapeHtml(log.taskName)}</strong>
          <div class="task-subtitle">${escapeHtml(formatLogSubline(log))}</div>
        </div>
        <span class="pill ${log.status === "failed" ? "fail" : log.status === "success" ? "" : "off"}">${escapeHtml(formatStatusLabel(log.status))}</span>
      </div>

      <div class="log-meta-chips">
        <span class="mini-tag">账号 ${escapeHtml(log.accountKey)}</span>
        <span class="mini-tag">${escapeHtml(String(fileCount))} 个文件</span>
        <span class="mini-tag">${escapeHtml(log.finishedAt ? formatDate(log.finishedAt) : formatDate(log.startedAt))}</span>
      </div>

      <div class="log-summary">
        ${escapeHtml(buildExecutionSummary(log))}
      </div>

      ${detailsMarkup}
    </article>
  `;
}

function renderLogDetails(log) {
  const detailItems = [];
  const fileNames = Array.isArray(log.fileNames) ? log.fileNames : [];

  if (fileNames.length > 0) {
    detailItems.push(`
      <div class="kv-line kv-line-full">
        <span>文件名</span>
        <strong>${escapeHtml(fileNames.join("、"))}</strong>
      </div>
    `);
  }

  if (extractTracePath(log.message)) {
    detailItems.push(`
      <div class="kv-line kv-line-full">
        <span>调试追踪路径</span>
        <strong>${escapeHtml(extractTracePath(log.message))}</strong>
      </div>
    `);
  }

  if (log.screenshotPath) {
    detailItems.push(`
      <div class="kv-line kv-line-full">
        <span>截图</span>
        <strong>${escapeHtml(log.screenshotPath)}</strong>
      </div>
    `);
  }

  if (detailItems.length === 0) {
    return "";
  }

  return `
    <details class="log-item-details">
      <summary>查看详情</summary>
      <div class="task-kv task-kv-compact">
        ${detailItems.join("")}
      </div>
    </details>
  `;
}

function formatLogSubline(log) {
  const started = formatDate(log.startedAt);
  const finished = log.finishedAt ? formatDate(log.finishedAt) : "未结束";
  return `${started} -> ${finished}`;
}

function countLogsByStatus(logs) {
  return logs.reduce(
    (counts, log) => {
      if (log.status === "failed" || log.status === "success" || log.status === "skipped") {
        counts[log.status] += 1;
      }
      return counts;
    },
    { failed: 0, success: 0, skipped: 0 },
  );
}

function renderAccounts() {
  elements.accountKey.innerHTML = state.accounts
    .map(
      (account) =>
        `<option value="${escapeHtml(account.key)}">${escapeHtml(account.label)} / ${escapeHtml(account.username)}</option>`,
    )
    .join("");
}

function toggleSourceFields() {
  const isDownload = elements.fileSourceType.value === "download";
  elements.directoryPathField.classList.toggle("hidden", isDownload);
  elements.downloadDirField.classList.toggle("hidden", !isDownload);
  elements.urlsField.classList.toggle("hidden", !isDownload);
  elements.downloadDateModeField.classList.toggle("hidden", !isDownload);
  toggleDownloadDateFields();
}

function toggleScheduleFields() {
  const isWeekly = elements.scheduleMode.value === "weekly";
  elements.weekdayField.classList.toggle("hidden", !isWeekly);
}

function toggleDownloadDateFields() {
  const showCustomDate =
    elements.fileSourceType.value === "download" && elements.downloadDateMode.value === "custom";
  elements.customStartDateField.classList.toggle("hidden", !showCustomDate);
}

function populateCustomDateOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];

  for (let year = currentYear - 10; year <= currentYear + 5; year += 1) {
    years.push(year);
  }

  elements.customStartYear.innerHTML = years
    .map((year) => `<option value="${year}">${year} 年</option>`)
    .join("");

  elements.customStartMonth.innerHTML = Array.from({ length: 12 }, (_, index) => index + 1)
    .map((month) => `<option value="${String(month).padStart(2, "0")}">${month} 月</option>`)
    .join("");
}

function syncCustomStartDayOptions(preferredDay = null) {
  const year = Number.parseInt(elements.customStartYear.value, 10);
  const month = Number.parseInt(elements.customStartMonth.value, 10);
  const totalDays = Number.isInteger(year) && Number.isInteger(month) ? new Date(year, month, 0).getDate() : 31;
  const nextDay = clampDayValue(preferredDay ?? elements.customStartDay.value, totalDays);

  elements.customStartDay.innerHTML = Array.from({ length: totalDays }, (_, index) => index + 1)
    .map((day) => {
      const value = String(day).padStart(2, "0");
      return `<option value="${value}">${day} 日</option>`;
    })
    .join("");

  elements.customStartDay.value = nextDay;
}

function clampDayValue(dayValue, totalDays) {
  const numericDay = Number.parseInt(dayValue, 10);
  if (!Number.isInteger(numericDay) || numericDay <= 0) {
    return "01";
  }

  return String(Math.min(numericDay, totalDays)).padStart(2, "0");
}

function getYesterdayDateInput() {
  const target = new Date();
  target.setDate(target.getDate() - 1);
  return formatDateInput(target);
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setCustomStartDateParts(dateValue = getYesterdayDateInput()) {
  const matched = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const fallback = getYesterdayDateInput().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [, year, month, day] = matched || fallback;

  elements.customStartYear.value = year;
  elements.customStartMonth.value = month;
  syncCustomStartDayOptions(day);
}

function buildCustomStartDate() {
  const year = elements.customStartYear.value;
  const month = elements.customStartMonth.value;
  const day = elements.customStartDay.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function resetForm() {
  elements.form.reset();
  elements.existingTaskId.value = "";
  elements.formTitle.textContent = "新建任务";
  document.querySelector("#enabled").checked = true;
  elements.scheduleMode.value = "daily";
  document.querySelector("#uploadTime").value = "09:00";
  document.querySelector("#requiredCount").value = 1;
  document.querySelector("#stableWindowMs").value = 4000;
  document.querySelector("#slowMoMs").value = 200;
  document.querySelector("#postUploadDelayMs").value = 3000;
  elements.downloadDateMode.value = "yesterday";
  setCustomStartDateParts();
  setWeekdays(["1", "2", "3", "4", "5"]);
  toggleScheduleFields();
  toggleSourceFields();
  setMessage("");
}

function fillForm(task) {
  elements.existingTaskId.value = task.id;
  elements.formTitle.textContent = `编辑任务 · ${task.name}`;
  document.querySelector("#name").value = task.name;
  document.querySelector("#accountKey").value = task.accountKey;
  document.querySelector("#enabled").checked = task.enabled;
  applyScheduleToForm(task.schedule);
  document.querySelector("#fileSourceType").value = task.fileSource.type;
  document.querySelector("#directoryPath").value = task.fileSource.directoryPath ?? "";
  document.querySelector("#downloadDir").value = task.fileSource.downloadDir ?? "";
  document.querySelector("#urlsText").value = Array.isArray(task.fileSource.urls) ? task.fileSource.urls.join("\n") : "";
  elements.downloadDateMode.value = task.fileSource.downloadDateMode === "custom" ? "custom" : "yesterday";
  setCustomStartDateParts(task.fileSource.customStartDate ?? getYesterdayDateInput());
  document.querySelector("#requiredCount").value = task.fileSource.requiredCount;
  document.querySelector("#stableWindowMs").value = task.fileSource.stableWindowMs ?? 4000;
  document.querySelector("#headless").checked = task.browser?.headless ?? false;
  document.querySelector("#slowMoMs").value = task.browser?.slowMoMs ?? 200;
  document.querySelector("#postUploadDelayMs").value = task.upload?.postUploadDelayMs ?? 3000;
  toggleScheduleFields();
  toggleSourceFields();
  setMessage("");
  openModal();
}

async function loadBootstrap() {
  const payload = await request("/bootstrap");
  state.accounts = payload.accounts ?? [];
  state.tasks = payload.tasks ?? [];
  state.scheduler = payload.scheduler ?? { running: false, jobCount: 0 };
  state.logs = payload.logs ?? [];
  renderAccounts();
  renderStatus();
  renderTasks();
  renderLogs();
}

async function refreshLogs() {
  const payload = await request("/logs?limit=30");
  state.logs = payload.logs ?? [];
  renderStatus();
  renderLogs();
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    if (elements.fileSourceType.value === "download" && elements.downloadDateMode.value === "custom" && !buildCustomStartDate()) {
      throw new Error("请选择指定下载日期。");
    }

    const body = {
      existingTaskId: elements.existingTaskId.value || undefined,
      name: document.querySelector("#name").value,
      schedule: buildScheduleFromForm(),
      accountKey: document.querySelector("#accountKey").value,
      enabled: document.querySelector("#enabled").checked,
      fileSource: {
        type: document.querySelector("#fileSourceType").value,
        directoryPath: document.querySelector("#directoryPath").value,
        downloadDir: document.querySelector("#downloadDir").value,
        urlsText: document.querySelector("#urlsText").value,
        downloadDateMode: elements.downloadDateMode.value,
        customStartDate: buildCustomStartDate(),
        requiredCount: document.querySelector("#requiredCount").value,
        stableWindowMs: document.querySelector("#stableWindowMs").value,
      },
      browser: {
        headless: document.querySelector("#headless").checked,
        slowMoMs: document.querySelector("#slowMoMs").value,
      },
      upload: {
        postUploadDelayMs: document.querySelector("#postUploadDelayMs").value,
      },
    };

    const payload = await request("/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    });
    state.tasks = payload.tasks ?? [];
    renderStatus();
    renderTasks();
    closeModal();
    resetForm();
    setMessage("任务已保存。");
  } catch (error) {
    setMessage(error.message, true);
  }
});

elements.taskList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-task-id]");
  if (!button) {
    return;
  }

  const taskId = button.dataset.taskId;
  const action = button.dataset.action;
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  if (action === "edit") {
    fillForm(task);
    return;
  }

  if (action === "delete") {
    if (!window.confirm(`确认删除任务“${task.name}”？`)) {
      return;
    }

    try {
      const payload = await request(`/tasks/${encodeURIComponent(taskId)}`, {
        method: "DELETE",
      });
      state.tasks = payload.tasks ?? [];
      renderStatus();
      renderTasks();
      setMessage("任务已删除。");
    } catch (error) {
      setMessage(error.message, true);
    }
    return;
  }

  if (action === "run") {
    if (state.runningTaskIds.has(taskId)) {
      return;
    }

    state.runningTaskIds.add(taskId);
    renderTasks();
    setMessage(`任务“${task.name}”正在运行...`);

    try {
      const payload = await request(`/tasks/${encodeURIComponent(taskId)}/run`, {
        method: "POST",
      });
      await refreshLogs();
      setMessage(
        `任务“${task.name}”已完成，状态：${formatStatusLabel(payload.result?.status ?? "success")}。${
          payload.linkedHomeTask?.updated ? " 首页今日任务已同步完成。" : ""
        }`,
      );
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      state.runningTaskIds.delete(taskId);
      renderTasks();
    }
  }
});

elements.logList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action][data-status]");
  if (!button) {
    return;
  }

  const { action, status } = button.dataset;
  if (!status) {
    return;
  }

  if (action === "toggle-group") {
    if (state.openLogGroups.has(status)) {
      state.openLogGroups.delete(status);
    } else {
      state.openLogGroups.add(status);
    }
    renderLogs();
    return;
  }

  if (action === "toggle-group-size") {
    if (state.expandedLogGroups.has(status)) {
      state.expandedLogGroups.delete(status);
    } else {
      state.expandedLogGroups.add(status);
      state.openLogGroups.add(status);
    }
    renderLogs();
  }
});

elements.refreshButton.addEventListener("click", async () => {
  try {
    await loadBootstrap();
    setMessage("数据已刷新。");
  } catch (error) {
    setMessage(error.message, true);
    setHeroStatus(error.message, true);
  }
});

elements.createTaskButton.addEventListener("click", () => {
  resetForm();
  openModal();
});

elements.clearLogsButton.addEventListener("click", async () => {
  if (!window.confirm("确认清空当前执行日志？")) {
    return;
  }

  try {
    await request("/logs/clear", { method: "POST" });
    state.logs = [];
    renderStatus();
    renderLogs();
    setMessage("日志已清空。");
  } catch (error) {
    setMessage(error.message, true);
  }
});

elements.schedulerToggleButton.addEventListener("click", async () => {
  const endpoint = state.scheduler.running ? "/scheduler/stop" : "/scheduler/start";

  try {
    const payload = await request(endpoint, { method: "POST" });
    state.scheduler = payload.scheduler ?? state.scheduler;
    renderStatus();
    setMessage(state.scheduler.running ? "调度器已启动。" : "调度器已停止。");
  } catch (error) {
    setMessage(error.message, true);
  }
});

elements.resetFormButton.addEventListener("click", () => resetForm());
elements.closeModalButton.addEventListener("click", () => closeModal());
elements.taskModal.addEventListener("click", (event) => {
  if (event.target.dataset.closeModal === "true") {
    closeModal();
  }
});
elements.scheduleMode.addEventListener("change", toggleScheduleFields);
elements.fileSourceType.addEventListener("change", toggleSourceFields);
elements.downloadDateMode.addEventListener("change", toggleDownloadDateFields);
elements.customStartYear.addEventListener("change", () => syncCustomStartDayOptions());
elements.customStartMonth.addEventListener("change", () => syncCustomStartDayOptions());

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  return new Date(value).toLocaleString("zh-CN");
}

function formatStatusLabel(status) {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  if (status === "skipped") return "已跳过";
  return status;
}

function buildExecutionSummary(log) {
  const startedText = formatDate(log.startedAt);
  const finishedText = log.finishedAt ? formatDate(log.finishedAt) : "未结束";
  const cleanedMessage = cleanLogMessage(log.message);
  const fileCount = log.fileCount ?? log.fileNames.length;

  if (log.status === "success") {
    return `开始于 ${startedText}，结束于 ${finishedText}，处理 ${fileCount} 个文件。${cleanedMessage ? ` ${cleanedMessage}` : ""}`;
  }

  if (log.status === "failed") {
    return `开始于 ${startedText}，失败于 ${finishedText}。${cleanedMessage || "没有返回详细原因。"}`;
  }

  if (log.status === "skipped") {
    return `跳过于 ${startedText}。${cleanedMessage || "未满足执行条件。"}`;
  }

  return cleanedMessage || "没有更多详情。";
}

function cleanLogMessage(message) {
  return String(message ?? "")
    .replace(/\s*\|\s*(Trace|调试追踪)：?\s*.+$/i, "")
    .trim();
}

function extractTracePath(message) {
  const matched = String(message ?? "").match(/(?:Trace|调试追踪)：?\s*(.+)$/i);
  return matched ? matched[1].trim() : "";
}

function buildScheduleFromForm() {
  const timeValue = document.querySelector("#uploadTime").value;
  const mode = elements.scheduleMode.value;
  const selectedWeekdays =
    mode === "daily"
      ? ["0", "1", "2", "3", "4", "5", "6"]
      : mode === "workday"
        ? ["1", "2", "3", "4", "5"]
        : getSelectedWeekdays();

  if (!timeValue) {
    throw new Error("请选择上传时间。");
  }

  if (mode === "weekly" && selectedWeekdays.length === 0) {
    throw new Error("请至少选择一个上传星期。");
  }

  const [hour, minute] = timeValue.split(":").map((value) => Number.parseInt(value, 10));
  const dayOfWeek = selectedWeekdays.length === 7 ? "*" : selectedWeekdays.join(",");
  return `${minute} ${hour} * * ${dayOfWeek}`;
}

function applyScheduleToForm(schedule) {
  const parsed = parseCronSchedule(schedule);
  document.querySelector("#uploadTime").value = parsed.time;
  setWeekdays(parsed.weekdays);
  elements.scheduleMode.value = parsed.mode;
  toggleScheduleFields();
}

function parseCronSchedule(schedule) {
  const parts = String(schedule ?? "").trim().split(/\s+/);
  if (parts.length !== 5) {
    return { time: "09:00", weekdays: ["1", "2", "3", "4", "5"], mode: "weekly" };
  }

  const [minute, hour, , , dayOfWeek] = parts;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const weekdays =
    dayOfWeek === "*"
      ? ["0", "1", "2", "3", "4", "5", "6"]
      : dayOfWeek
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

  return {
    time,
    weekdays,
    mode: inferScheduleMode(dayOfWeek, weekdays),
  };
}

function inferScheduleMode(dayOfWeek, weekdays) {
  if (dayOfWeek === "*") {
    return "daily";
  }

  if (weekdays.join(",") === ["1", "2", "3", "4", "5"].join(",")) {
    return "workday";
  }

  return "weekly";
}

function setWeekdays(values) {
  const selected = new Set(values);
  document.querySelectorAll('input[name="weekday"]').forEach((checkbox) => {
    checkbox.checked = selected.has(checkbox.value);
  });
}

function getSelectedWeekdays() {
  return Array.from(document.querySelectorAll('input[name="weekday"]:checked'))
    .map((input) => input.value)
    .sort((left, right) => Number(left) - Number(right));
}

function formatSchedule(schedule) {
  const { time, weekdays, mode } = parseCronSchedule(schedule);
  const labels = {
    "0": "周日",
    "1": "周一",
    "2": "周二",
    "3": "周三",
    "4": "周四",
    "5": "周五",
    "6": "周六",
  };

  if (mode === "daily" || weekdays.length === 7) {
    return `每天 ${time}`;
  }

  if (mode === "workday") {
    return `工作日 ${time}`;
  }

  return `${weekdays.map((value) => labels[value] ?? value).join("、")} ${time}`;
}

function formatDownloadDateMode(mode, customStartDate) {
  if (mode === "custom" && customStartDate) {
    return `指定日期 ${customStartDate}`;
  }

  return "昨天";
}

function openModal() {
  elements.taskModal.classList.remove("hidden");
}

function closeModal() {
  elements.taskModal.classList.add("hidden");
}

async function bootstrap() {
  populateCustomDateOptions();
  resetForm();
  await loadPluginMeta();

  try {
    await loadBootstrap();
  } catch (error) {
    setHeroStatus(error.message, true);
    elements.taskList.innerHTML = `<div class="empty-state"><strong>插件尚未就绪</strong><p class="muted">${escapeHtml(error.message)}</p></div>`;
    elements.logList.innerHTML = "";
    elements.createTaskButton.disabled = true;
    elements.schedulerToggleButton.disabled = true;
  }
}

bootstrap();
