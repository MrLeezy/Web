const state = {
  isSubmitting: false,
  currentFileName: "",
  result: null,
  automationStatus: null,
};
const PLUGIN_ID = "leads-splitter";

function apiUrl(pathname) {
  if (/^https?:/i.test(window.location.origin)) {
    return new URL(pathname, window.location.origin).toString();
  }

  return `http://127.0.0.1:3100${pathname}`;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatFileName(value) {
  if (!value) {
    return "-";
  }

  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function triggerFileDownload(url, filename) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "";
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function buildDownloadUrl(filename) {
  return apiUrl(`/api/plugins/leads-splitter/download/${encodeURIComponent(filename)}`);
}

function buildHealthUrl() {
  return apiUrl("/api/plugins/leads-splitter/health");
}

function buildAutomationStatusUrl() {
  return apiUrl("/api/plugins/leads-splitter/automation/status");
}

function buildAutomationRunUrl() {
  return apiUrl("/api/plugins/leads-splitter/automation/run");
}

async function readResponsePayload(response) {
  const rawText = await response.text();
  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return { error: rawText };
  }
}

function elements() {
  return {
    pluginTitle: document.getElementById("pluginTitle"),
    pluginSummary: document.getElementById("pluginSummary"),
    pluginCategoryBadge: document.getElementById("pluginCategoryBadge"),
    pluginTypeBadge: document.getElementById("pluginTypeBadge"),
    fileInput: document.getElementById("fileInput"),
    dropzone: document.getElementById("dropzone"),
    dropzoneTitle: document.getElementById("dropzoneTitle"),
    dropzoneHint: document.getElementById("dropzoneHint"),
    browseButton: document.getElementById("browseButton"),
    autoDownloadButton: document.getElementById("autoDownloadButton"),
    actionMeta: document.getElementById("actionMeta"),
    automationMeta: document.getElementById("automationMeta"),
    logSummaryGrid: document.getElementById("logSummaryGrid"),
    automationLogList: document.getElementById("automationLogList"),
    statusCard: document.getElementById("statusCard"),
    resultsSection: document.getElementById("resultsSection"),
    statsGrid: document.getElementById("statsGrid"),
    outputGrid: document.getElementById("outputGrid"),
    distributionTitle: document.getElementById("distributionTitle"),
    distributionGrid: document.getElementById("distributionGrid"),
  };
}

function setStatus(message, type = "") {
  const { statusCard } = elements();
  if (!statusCard) {
    return;
  }

  if (!message) {
    statusCard.textContent = "";
    statusCard.className = "status-card is-hidden";
    return;
  }

  statusCard.textContent = message;
  statusCard.className = `status-card ${type}`.trim();
}

function formatPeriod(startAt, endAt) {
  return `${formatDateTime(startAt)} - ${formatDateTime(endAt)}`;
}

function renderAutomationLogs() {
  const { logSummaryGrid, automationLogList } = elements();
  if (!logSummaryGrid || !automationLogList) {
    return;
  }

  const status = state.automationStatus || {};
  const history = Array.isArray(status.history) ? [...status.history] : [];
  if (!history.length && status.lastSuccessfulStartAt && status.lastSuccessfulEndAt) {
    history.push({
      runAt: status.lastDownloadedAt || status.lastSuccessfulEndAt,
      period: {
        startAt: status.lastSuccessfulStartAt,
        endAt: status.lastSuccessfulEndAt,
      },
      download: {
        fileName: status.lastDownloadedFileName || "",
      },
      result: status.lastResult || null,
    });
  }
  const latestPeriod =
    status.lastSuccessfulStartAt && status.lastSuccessfulEndAt
      ? formatPeriod(status.lastSuccessfulStartAt, status.lastSuccessfulEndAt)
      : "暂无成功记录";
  const latestResult = status.lastResult || null;

  logSummaryGrid.innerHTML = [
    {
      label: "上次抓取周期",
      value: latestPeriod,
    },
    {
      label: "上次下载文件",
      value: status.lastDownloadedFileName ? formatFileName(status.lastDownloadedFileName) : "暂无记录",
    },
    {
      label: "上次拆表结果",
      value: latestResult
        ? `总计 ${formatCount(latestResult.total)} 条，表一 ${formatCount(latestResult.table1_count)} 条，表二 ${formatCount(latestResult.table2_count)} 条`
        : "暂无结果",
    },
  ]
    .map(
      (entry) => `
        <div class="log-summary-card">
          <div class="log-summary-label">${entry.label}</div>
          <div class="log-summary-value">${entry.value}</div>
        </div>
      `,
    )
    .join("");

  if (!history.length) {
    automationLogList.innerHTML = '<div class="empty-log">还没有自动抓取日志。首次执行“自动下载并拆表”后，这里会显示抓取周期、源文件和拆表结果。</div>';
    return;
  }

  automationLogList.innerHTML = history
    .map((entry, index) => {
      const entryResult = entry.result || {};
      return `
        <article class="log-item-card">
          <div class="log-item-head">
            <div class="log-item-title">${index === 0 ? "最近一次执行" : `历史记录 ${index + 1}`}</div>
            <div class="log-item-time">${formatDateTime(entry.runAt)}</div>
          </div>
          <div class="log-item-meta">
            <div class="log-kv">
              <span class="log-kv-label">抓取周期</span>
              <span class="log-kv-value">${formatPeriod(entry.period?.startAt, entry.period?.endAt)}</span>
            </div>
            <div class="log-kv">
              <span class="log-kv-label">源文件</span>
              <span class="log-kv-value">${entry.download?.fileName ? formatFileName(entry.download.fileName) : "暂无记录"}</span>
            </div>
            <div class="log-kv">
              <span class="log-kv-label">拆表结果</span>
              <span class="log-kv-value">总计 ${formatCount(entryResult.total)} 条，表一 ${formatCount(entryResult.table1_count)} 条，表二 ${formatCount(entryResult.table2_count)} 条</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderResults() {
  const { resultsSection, statsGrid, outputGrid, distributionTitle, distributionGrid } = elements();
  if (!resultsSection || !statsGrid || !outputGrid || !distributionGrid) {
    return;
  }

  if (!state.result) {
    resultsSection.classList.add("is-hidden");
    statsGrid.innerHTML = "";
    outputGrid.innerHTML = "";
    distributionGrid.innerHTML = "";
    return;
  }

  resultsSection.classList.remove("is-hidden");
  if (distributionTitle) {
    distributionTitle.textContent = (state.result.distribution_label || "来源分布").replace("Source Distribution", "来源分布");
  }

  statsGrid.innerHTML = "";
  outputGrid.innerHTML = "";
  distributionGrid.innerHTML = "";

  [
    { label: "源文件总行数", value: state.result.total },
    { label: "表一行数", value: state.result.table1_count },
    { label: "表二行数", value: state.result.table2_count },
  ].forEach((entry) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="stat-value">${formatCount(entry.value)}</div>
      <div class="stat-label">${entry.label}</div>
    `;
    statsGrid.appendChild(card);
  });

  (state.result.outputs || []).forEach((output) => {
    const card = document.createElement("section");
    card.className = "output-card";

    const label = document.createElement("div");
    label.className = "output-label";
    label.textContent = output.key === "table1" ? "表一" : output.key === "table2" ? "表二" : output.label;

    const name = document.createElement("div");
    name.className = "output-name";
    name.textContent = formatFileName(output.filename);

    const description = document.createElement("div");
    description.className = "output-description";
    description.textContent =
      output.key === "table1"
        ? "排除指定广告来源后的输出文件。"
        : output.key === "table2"
          ? "仅保留 wechat-dsp 的输出文件。"
          : output.description;

    const meta = document.createElement("div");
    meta.className = "output-meta";
    meta.textContent = `${formatCount(output.count)} rows`;

    const button = document.createElement("button");
    button.className = "download-button";
    button.type = "button";
    button.textContent = "下载 CSV";
    button.addEventListener("click", () => {
      triggerFileDownload(buildDownloadUrl(output.filename), output.filename);
    });

    card.append(label, name, description, meta, button);
    outputGrid.appendChild(card);
  });

  Object.entries(state.result.source_distribution || {})
    .sort((left, right) => right[1] - left[1])
    .forEach(([source, count]) => {
      const item = document.createElement("div");
      item.className = "distribution-item";

      const name = document.createElement("span");
      name.className = "distribution-name";
      name.textContent = source || "(空值)";

      const value = document.createElement("span");
      value.className = "distribution-value";
      value.textContent = formatCount(count);

      item.append(name, value);
      distributionGrid.appendChild(item);
    });
}

function renderView() {
  const { dropzone, dropzoneTitle, dropzoneHint, browseButton, autoDownloadButton, actionMeta, automationMeta } = elements();

  if (dropzone) {
    dropzone.disabled = state.isSubmitting;
  }
  if (dropzoneTitle) {
    dropzoneTitle.textContent = state.currentFileName || "选择或拖入 CSV / XLSX 文件";
  }
  if (dropzoneHint) {
    dropzoneHint.textContent = state.isSubmitting
      ? "正在处理并拆分文件..."
      : "系统会把源文件拆分成两个 CSV 输出文件。";
  }
  if (browseButton) {
    browseButton.disabled = state.isSubmitting;
    browseButton.textContent = state.isSubmitting ? "处理中..." : "选择文件";
  }
  if (autoDownloadButton) {
    autoDownloadButton.disabled = state.isSubmitting;
    autoDownloadButton.textContent = state.isSubmitting ? "执行中..." : "自动下载并拆表";
  }
  if (actionMeta) {
    actionMeta.textContent = state.currentFileName
      ? `当前文件：${state.currentFileName}`
      : "建议使用最新导出的 leads 源文件。";
  }
  if (automationMeta) {
    automationMeta.textContent = formatAutomationMeta();
  }

  renderAutomationLogs();
  renderResults();
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatAutomationMeta() {
  if (!state.automationStatus) {
    return "自动模式会优先使用“上次成功结束时间 -> 最近一个 11:00 截止点”来计算抓取周期。";
  }

  const { lastSuccessfulStartAt, lastSuccessfulEndAt, lastDownloadedFileName, nextSuggestedEndAt } = state.automationStatus;
  const lastPeriodText =
    lastSuccessfulStartAt && lastSuccessfulEndAt
      ? formatPeriod(lastSuccessfulStartAt, lastSuccessfulEndAt)
      : "暂未执行";
  const nextEndText = nextSuggestedEndAt ? formatDateTime(nextSuggestedEndAt) : "-";
  const fileText = lastDownloadedFileName ? ` 上次下载文件：${formatFileName(lastDownloadedFileName)}。` : "";
  return `最近一次成功抓取周期：${lastPeriodText}；下一个建议截止时间：${nextEndText}。${fileText}`;
}

async function submitFile(file) {
  if (!file) {
    return;
  }

  if (!/\.(csv|xlsx)$/i.test(file.name)) {
    state.result = null;
    setStatus("当前插件仅支持 CSV 或 XLSX 文件。", "is-error");
    renderView();
    return;
  }

  state.isSubmitting = true;
  state.currentFileName = file.name;
  state.result = null;
  setStatus(`正在处理 ${file.name} ...`, "is-processing");
  renderView();

  try {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await fetch(apiUrl("/api/plugins/leads-splitter/process"), {
      method: "POST",
      body: formData,
    });

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("当前页面已经更新，但本地 127.0.0.1:3100 服务仍是旧版本，请重启服务后重试。");
      }

      throw new Error(payload.error || `拆表失败（${response.status}）`);
    }

    state.result = payload.result || null;
    setStatus("拆表完成，下面可以直接下载两个 CSV 输出文件。", "is-success");
  } catch (error) {
    state.result = null;
    const message =
      error instanceof TypeError
        ? "无法连接本地 FY27 服务，请确认当前项目已经运行在 127.0.0.1:3100。"
        : error.message || "拆表失败。";
    setStatus(message, "is-error");
  } finally {
    state.isSubmitting = false;
    renderView();
  }
}

async function loadAutomationStatus() {
  try {
    const response = await fetch(buildAutomationStatusUrl(), { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await readResponsePayload(response);
    state.automationStatus = payload.status || null;
    renderView();
  } catch {
    // Keep manual upload available even if automation status fails to load.
  }
}

async function runAutomation() {
  state.isSubmitting = true;
  state.currentFileName = "自动抓取周期";
  state.result = null;
  setStatus("正在自动登录门户、下载最新数据并执行拆表...", "is-processing");
  renderView();

  try {
    const response = await fetch(buildAutomationRunUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(payload.error || `Automation failed. (${response.status})`);
    }

    state.result = payload.result || null;
    state.automationStatus = payload.state || state.automationStatus;

    const period = payload.period
      ? `${formatDateTime(payload.period.startAt)} - ${formatDateTime(payload.period.endAt)}`
      : "最近周期";
    const fileName = payload.download?.fileName ? ` 下载文件：${formatFileName(payload.download.fileName)}。` : "";

    setStatus(`自动下载并拆表完成，抓取周期：${period}。${fileName}`, "is-success");
  } catch (error) {
    state.result = null;
    setStatus(error.message || "自动下载并拆表失败。", "is-error");
  } finally {
    state.isSubmitting = false;
    renderView();
  }
}

async function verifyPluginApi() {
  try {
    const response = await fetch(buildHealthUrl(), { cache: "no-store" });
    if (response.ok) {
      return true;
    }

    if (response.status === 404) {
      setStatus(
        "当前页面已经更新，但本地 127.0.0.1:3100 服务仍是旧版本，请重启服务后再使用。",
        "is-error",
      );
      return false;
    }

    setStatus(`插件接口检查失败，状态码：${response.status}。`, "is-error");
    return false;
  } catch {
    setStatus(
      "无法连接本地 FY27 服务，请确认当前项目已经运行在 127.0.0.1:3100。",
      "is-error",
    );
    return false;
  }
}

async function loadPluginMeta() {
  try {
    const response = await fetch(apiUrl("/api/plugin-cards"), { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await readResponsePayload(response);
    const plugins = Array.isArray(payload.plugins) ? payload.plugins : [];
    const plugin = plugins.find((entry) => entry.id === PLUGIN_ID);
    if (!plugin) {
      return;
    }

    const { pluginTitle, pluginSummary, pluginCategoryBadge, pluginTypeBadge } = elements();
    if (pluginTitle && plugin.title) {
      pluginTitle.textContent = plugin.title;
      document.title = plugin.title;
    }
    if (pluginSummary && plugin.summary) {
      pluginSummary.textContent = plugin.summary;
    }
    if (pluginCategoryBadge && plugin.category) {
      pluginCategoryBadge.textContent = plugin.category;
    }
    if (pluginTypeBadge) {
      pluginTypeBadge.textContent = plugin.enabled ? "内部插件" : "插件已停用";
    }
  } catch {
    // Keep the page usable even if plugin metadata fails to load.
  }
}

function initUploader() {
  const { fileInput, dropzone, browseButton, autoDownloadButton } = elements();
  if (!fileInput || !dropzone || !browseButton || !autoDownloadButton) {
    return;
  }

  browseButton.addEventListener("click", () => fileInput.click());
  autoDownloadButton.addEventListener("click", () => {
    void runAutomation();
  });
  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const [file] = fileInput.files || [];
    if (file) {
      void submitFile(file);
    }
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!state.isSubmitting) {
      dropzone.classList.add("is-dragover");
    }
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-dragover");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    if (state.isSubmitting) {
      return;
    }
    const [file] = event.dataTransfer?.files || [];
    if (file) {
      void submitFile(file);
    }
  });
}

function init() {
  initUploader();
  renderView();
  void loadPluginMeta();
  void loadAutomationStatus();
  void verifyPluginApi();
}

init();
