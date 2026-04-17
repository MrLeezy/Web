const PLUGIN_ID = "haft-uploader";
const API_BASE = `${window.location.origin}/api/plugins/${PLUGIN_ID}`;

const state = {
  accounts: [],
  tasks: [],
  scheduler: { running: false, jobCount: 0 },
  logs: [],
  runningTaskIds: new Set(),
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
};

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
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
    elements.pluginCategoryBadge.textContent = plugin.category || "Automation";
    elements.pluginTypeBadge.textContent = plugin.enabled ? "Internal Plugin" : "Plugin Disabled";
    document.title = plugin.title;
  } catch {}
}

function renderStatus() {
  const enabledCount = state.tasks.filter((task) => task.enabled).length;
  const protectedCount = state.accounts.filter((account) => account.allowManualRun === false).length;

  setHeroStatus(
    `Scheduler ${state.scheduler.running ? "is running" : "is stopped"}, ${enabledCount} enabled tasks, ${state.accounts.length} accounts, ${protectedCount} protected accounts.`,
  );

  elements.schedulerToggleButton.textContent = state.scheduler.running ? "Stop Scheduler" : "Start Scheduler";
  elements.schedulerStateValue.textContent = state.scheduler.running ? "Running" : "Stopped";
  elements.enabledTaskValue.textContent = String(enabledCount);
  elements.accountCountValue.textContent = String(state.accounts.length);
  elements.protectedCountValue.textContent = String(protectedCount);
  elements.taskSectionMeta.textContent = `${state.tasks.length} task(s) configured, ${enabledCount} enabled.`;
  elements.logSectionMeta.textContent = `Showing the latest ${state.logs.length} execution log(s).`;
}

function renderTasks() {
  if (state.tasks.length === 0) {
    elements.taskList.innerHTML =
      '<div class="empty-state"><strong>No upload task yet</strong><p class="muted">Create the first Haft upload job to manage daily or scheduled runs from this plugin.</p></div>';
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
          : `${task.fileSource.downloadDir || "-"} · ${task.fileSource.urls?.length || 0} URL(s)`;

      return `
        <article class="task-item">
          <div class="task-top">
            <div class="task-title-block">
              <strong class="task-title">${escapeHtml(task.name)}</strong>
              <div class="task-subtitle">${escapeHtml(formatSchedule(task.schedule))}</div>
            </div>
            <span class="pill ${task.enabled ? "" : "off"}">${task.enabled ? "Enabled" : "Disabled"}</span>
          </div>

          <div class="task-kv">
            <div class="kv-line">
              <span>Account</span>
              <strong>${escapeHtml(account ? `${account.label} / ${account.username}` : task.accountKey)}</strong>
            </div>
            <div class="kv-line">
              <span>Upload Path</span>
              <strong>${escapeHtml(targetPath)}</strong>
            </div>
            <div class="kv-line">
              <span>File Source</span>
              <strong>${task.fileSource.type === "directory" ? "Local Directory" : "URL Download"}</strong>
            </div>
            <div class="kv-line">
              <span>Required Files</span>
              <strong>${escapeHtml(String(task.fileSource.requiredCount))}</strong>
            </div>
            <div class="kv-line kv-line-full">
              <span>Source Detail</span>
              <strong>${escapeHtml(sourceSummary)}</strong>
            </div>
          </div>

          <div class="task-tags">
            <span class="mini-tag">${manualRunBlocked ? "Manual Run Locked" : running ? "Running" : "Manual Run Ready"}</span>
            <span class="mini-tag">${task.browser?.headless ? "Headless Browser" : "Visible Browser"}</span>
            <span class="mini-tag">${task.fileSource.type === "directory" ? "Direct Upload" : "Download Then Upload"}</span>
          </div>

          <div class="task-actions">
            <button data-action="edit" data-task-id="${escapeHtml(task.id)}">Edit</button>
            <button data-action="run" data-task-id="${escapeHtml(task.id)}" ${manualRunBlocked || running ? "disabled" : ""}>
              ${running ? "Running..." : "Run Now"}
            </button>
            <button data-action="delete" data-task-id="${escapeHtml(task.id)}" class="ghost">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLogs() {
  if (state.logs.length === 0) {
    elements.logList.innerHTML =
      '<div class="empty-state"><strong>No execution logs yet</strong><p class="muted">After a task runs, the upload result, file list, and debug trace path will appear here.</p></div>';
    return;
  }

  elements.logList.innerHTML = state.logs
    .map(
      (log) => `
        <article class="log-item">
          <div class="log-top">
            <div class="task-title-block">
              <strong class="task-title">${escapeHtml(log.taskName)}</strong>
              <div class="task-subtitle">${escapeHtml(formatStatusLabel(log.status))}</div>
            </div>
            <span class="pill ${log.status === "failed" ? "fail" : log.status === "success" ? "" : "off"}">${escapeHtml(formatStatusLabel(log.status))}</span>
          </div>

          <div class="task-kv">
            <div class="kv-line">
              <span>Started</span>
              <strong>${escapeHtml(formatDate(log.startedAt))}</strong>
            </div>
            <div class="kv-line">
              <span>Finished</span>
              <strong>${escapeHtml(log.finishedAt ? formatDate(log.finishedAt) : "Not finished")}</strong>
            </div>
            <div class="kv-line">
              <span>Account</span>
              <strong>${escapeHtml(log.accountKey)}</strong>
            </div>
            <div class="kv-line">
              <span>Files</span>
              <strong>${escapeHtml(String(log.fileCount ?? log.fileNames.length))}</strong>
            </div>
            <div class="kv-line kv-line-full">
              <span>File Names</span>
              <strong>${escapeHtml((log.fileNames || []).join("、") || "None")}</strong>
            </div>
            <div class="kv-line kv-line-full">
              <span>Execution Note</span>
              <strong>${escapeHtml(buildExecutionSummary(log))}</strong>
            </div>
            ${
              extractTracePath(log.message)
                ? `<div class="kv-line kv-line-full"><span>Trace Path</span><strong>${escapeHtml(extractTracePath(log.message))}</strong></div>`
                : ""
            }
            ${
              log.screenshotPath
                ? `<div class="kv-line kv-line-full"><span>Screenshot</span><strong>${escapeHtml(log.screenshotPath)}</strong></div>`
                : ""
            }
          </div>
        </article>
      `,
    )
    .join("");
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
}

function toggleScheduleFields() {
  const isWeekly = elements.scheduleMode.value === "weekly";
  elements.weekdayField.classList.toggle("hidden", !isWeekly);
}

function resetForm() {
  elements.form.reset();
  elements.existingTaskId.value = "";
  elements.formTitle.textContent = "Create Task";
  document.querySelector("#enabled").checked = true;
  elements.scheduleMode.value = "daily";
  document.querySelector("#uploadTime").value = "09:00";
  document.querySelector("#requiredCount").value = 1;
  document.querySelector("#stableWindowMs").value = 4000;
  document.querySelector("#slowMoMs").value = 200;
  document.querySelector("#postUploadDelayMs").value = 3000;
  setWeekdays(["1", "2", "3", "4", "5"]);
  toggleScheduleFields();
  toggleSourceFields();
  setMessage("");
}

function fillForm(task) {
  elements.existingTaskId.value = task.id;
  elements.formTitle.textContent = `Edit Task · ${task.name}`;
  document.querySelector("#name").value = task.name;
  document.querySelector("#accountKey").value = task.accountKey;
  document.querySelector("#enabled").checked = task.enabled;
  applyScheduleToForm(task.schedule);
  document.querySelector("#fileSourceType").value = task.fileSource.type;
  document.querySelector("#directoryPath").value = task.fileSource.directoryPath ?? "";
  document.querySelector("#downloadDir").value = task.fileSource.downloadDir ?? "";
  document.querySelector("#urlsText").value = Array.isArray(task.fileSource.urls) ? task.fileSource.urls.join("\n") : "";
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
    setMessage("Task saved.");
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
    if (!window.confirm(`Delete task "${task.name}"?`)) {
      return;
    }

    try {
      const payload = await request(`/tasks/${encodeURIComponent(taskId)}`, {
        method: "DELETE",
      });
      state.tasks = payload.tasks ?? [];
      renderStatus();
      renderTasks();
      setMessage("Task deleted.");
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
    setMessage(`Task "${task.name}" is running...`);

    try {
      const payload = await request(`/tasks/${encodeURIComponent(taskId)}/run`, {
        method: "POST",
      });
      await refreshLogs();
      setMessage(`Task "${task.name}" finished with status ${payload.result?.status ?? "success"}.`);
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      state.runningTaskIds.delete(taskId);
      renderTasks();
    }
  }
});

elements.refreshButton.addEventListener("click", async () => {
  try {
    await loadBootstrap();
    setMessage("Data refreshed.");
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
  if (!window.confirm("Clear current execution logs?")) {
    return;
  }

  try {
    await request("/logs/clear", { method: "POST" });
    state.logs = [];
    renderStatus();
    renderLogs();
    setMessage("Logs cleared.");
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
    setMessage(state.scheduler.running ? "Scheduler started." : "Scheduler stopped.");
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
  if (status === "success") return "Success";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  return status;
}

function buildExecutionSummary(log) {
  const startedText = formatDate(log.startedAt);
  const finishedText = log.finishedAt ? formatDate(log.finishedAt) : "not finished";
  const cleanedMessage = cleanLogMessage(log.message);
  const fileCount = log.fileCount ?? log.fileNames.length;

  if (log.status === "success") {
    return `Started at ${startedText}, finished at ${finishedText}, processed ${fileCount} file(s).${cleanedMessage ? ` ${cleanedMessage}` : ""}`;
  }

  if (log.status === "failed") {
    return `Started at ${startedText}, failed at ${finishedText}. ${cleanedMessage || "No detailed reason returned."}`;
  }

  if (log.status === "skipped") {
    return `Skipped at ${startedText}. ${cleanedMessage || "Execution conditions were not met."}`;
  }

  return cleanedMessage || "No additional details.";
}

function cleanLogMessage(message) {
  return String(message ?? "")
    .replace(/\s*\|\s*Trace:\s*.+$/i, "")
    .trim();
}

function extractTracePath(message) {
  const matched = String(message ?? "").match(/Trace:\s*(.+)$/i);
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
    throw new Error("Please choose an upload time.");
  }

  if (mode === "weekly" && selectedWeekdays.length === 0) {
    throw new Error("Please choose at least one weekday.");
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
    "0": "Sun",
    "1": "Mon",
    "2": "Tue",
    "3": "Wed",
    "4": "Thu",
    "5": "Fri",
    "6": "Sat",
  };

  if (mode === "daily" || weekdays.length === 7) {
    return `Every day at ${time}`;
  }

  if (mode === "workday") {
    return `Workdays at ${time}`;
  }

  return `${weekdays.map((value) => labels[value] ?? value).join(", ")} at ${time}`;
}

function openModal() {
  elements.taskModal.classList.remove("hidden");
}

function closeModal() {
  elements.taskModal.classList.add("hidden");
}

async function bootstrap() {
  resetForm();
  await loadPluginMeta();

  try {
    await loadBootstrap();
  } catch (error) {
    setHeroStatus(error.message, true);
    elements.taskList.innerHTML = `<div class="empty-state"><strong>Plugin is not ready</strong><p class="muted">${escapeHtml(error.message)}</p></div>`;
    elements.logList.innerHTML = "";
    elements.createTaskButton.disabled = true;
    elements.schedulerToggleButton.disabled = true;
  }
}

bootstrap();
