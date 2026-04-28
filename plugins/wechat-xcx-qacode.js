const state = {
  isSubmitting: false,
  currentFileName: "",
  records: [],
  isGenerating: false,
  progress: {
    total: 0,
    done: 0,
    success: 0,
    failed: 0,
    failures: [],
  },
  outputDir: "",
};

const PLUGIN_ID = "wechat-xcx-qacode";

function apiUrl(pathname) {
  if (/^https?:/i.test(window.location.origin)) {
    return new URL(pathname, window.location.origin).toString();
  }
  return `http://127.0.0.1:3100${pathname}`;
}

function formatCount(value) {
  return new Intl.NumberFormat("zh-CN").format(Number(value || 0));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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
    templateButton: document.getElementById("templateButton"),
    actionMeta: document.getElementById("actionMeta"),
    statusCard: document.getElementById("statusCard"),
    previewSection: document.getElementById("previewSection"),
    previewMeta: document.getElementById("previewMeta"),
    previewTableBody: document.getElementById("previewTableBody"),
    startButton: document.getElementById("startButton"),
    progressSection: document.getElementById("progressSection"),
    progressTotal: document.getElementById("progressTotal"),
    progressDone: document.getElementById("progressDone"),
    progressSuccess: document.getElementById("progressSuccess"),
    progressFailed: document.getElementById("progressFailed"),
    progressBar: document.getElementById("progressBar"),
    progressCurrent: document.getElementById("progressCurrent"),
    progressLog: document.getElementById("progressLog"),
    resultsSection: document.getElementById("resultsSection"),
    resultSummary: document.getElementById("resultSummary"),
    resultOutputDir: document.getElementById("resultOutputDir"),
    resultFailures: document.getElementById("resultFailures"),
    failureList: document.getElementById("failureList"),
  };
}

function setStatus(message, type = "") {
  const { statusCard } = elements();
  if (!statusCard) return;

  if (!message) {
    statusCard.textContent = "";
    statusCard.className = "status-card is-hidden";
    return;
  }

  statusCard.textContent = message;
  statusCard.className = `status-card ${type}`.trim();
}

function renderPreview() {
  const { previewSection, previewMeta, previewTableBody } = elements();
  if (!previewSection || !previewTableBody) return;

  if (!state.records.length) {
    previewSection.classList.add("is-hidden");
    previewTableBody.innerHTML = "";
    return;
  }

  previewSection.classList.remove("is-hidden");
  if (previewMeta) {
    previewMeta.textContent = `共识别 ${formatCount(state.records.length)} 条记录`;
  }

  previewTableBody.innerHTML = "";
  state.records.forEach((record, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(record.title || "")}</td>
      <td>${escapeHtml(record.path || "")}</td>
    `;
    previewTableBody.appendChild(tr);
  });
}

function renderProgress() {
  const {
    progressSection,
    progressTotal,
    progressDone,
    progressSuccess,
    progressFailed,
    progressBar,
    progressCurrent,
  } = elements();

  if (!progressSection) return;

  if (!state.isGenerating && state.progress.total === 0) {
    progressSection.classList.add("is-hidden");
    return;
  }

  progressSection.classList.remove("is-hidden");

  if (progressTotal) progressTotal.textContent = state.progress.total;
  if (progressDone) progressDone.textContent = state.progress.done;
  if (progressSuccess) progressSuccess.textContent = state.progress.success;
  if (progressFailed) progressFailed.textContent = state.progress.failed;

  if (progressBar) {
    const percent = state.progress.total > 0
      ? Math.round((state.progress.done / state.progress.total) * 100)
      : 0;
    progressBar.style.width = `${percent}%`;
  }
}

function addLogEntry(message, type = "") {
  const { progressLog } = elements();
  if (!progressLog) return;

  const entry = document.createElement("div");
  entry.className = `progress-log-entry ${type}`.trim();
  entry.textContent = `[${new Date().toLocaleTimeString("zh-CN")}] ${message}`;
  progressLog.appendChild(entry);
  progressLog.scrollTop = progressLog.scrollHeight;
}

function renderResults() {
  const { resultsSection, resultSummary, resultOutputDir, resultFailures, failureList } = elements();
  if (!resultsSection) return;

  resultsSection.classList.remove("is-hidden");

  if (resultSummary) {
    resultSummary.innerHTML = `
      生成完成！<br>
      总计 <strong>${state.progress.total}</strong> 条，
      成功 <strong>${state.progress.success}</strong> 条，
      失败 <strong>${state.progress.failed}</strong> 条。
    `;
  }

  if (resultOutputDir && state.outputDir) {
    resultOutputDir.textContent = `输出目录: ${state.outputDir}`;
  }

  if (resultFailures && failureList && state.progress.failures.length > 0) {
    resultFailures.classList.remove("is-hidden");
    failureList.innerHTML = "";
    state.progress.failures.forEach((failure) => {
      const li = document.createElement("li");
      li.textContent = `${failure.title}: ${failure.reason}`;
      failureList.appendChild(li);
    });
  } else if (resultFailures) {
    resultFailures.classList.add("is-hidden");
  }
}

function renderView() {
  const { dropzone, dropzoneTitle, dropzoneHint, browseButton, templateButton, actionMeta, startButton } = elements();

  const disabled = state.isSubmitting || state.isGenerating;

  if (dropzone) dropzone.disabled = disabled;
  if (dropzoneTitle) {
    dropzoneTitle.textContent = state.currentFileName || "选择或拖拽文件到此处";
  }
  if (dropzoneHint) {
    dropzoneHint.textContent = state.isSubmitting
      ? "正在解析文件..."
      : "支持 CSV、TXT、XLSX 格式";
  }
  if (browseButton) {
    browseButton.disabled = disabled;
    browseButton.textContent = state.isSubmitting ? "解析中..." : "选择文件";
  }
  if (templateButton) {
    templateButton.disabled = state.isGenerating;
  }
  if (actionMeta) {
    actionMeta.textContent = state.currentFileName
      ? `当前文件: ${state.currentFileName}`
      : "请先上传包含小程序信息的文件";
  }
  if (startButton) {
    startButton.disabled = disabled || state.records.length === 0;
    startButton.textContent = state.isGenerating ? "生成中..." : "开始生成";
  }

  renderPreview();
  renderProgress();
}

async function submitFile(file) {
  if (!file) return;

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "txt", "xlsx"].includes(ext || "")) {
    setStatus("仅支持 CSV、TXT、XLSX 格式的文件", "is-error");
    renderView();
    return;
  }

  state.isSubmitting = true;
  state.currentFileName = file.name;
  state.records = [];
  setStatus(`正在解析 ${file.name}...`, "is-processing");
  renderView();

  try {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/parse`), {
      method: "POST",
      body: formData,
    });

    const payload = await readResponsePayload(response);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("插件页面已加载，但本地服务仍在运行旧版本。请重启 127.0.0.1:3100 服务后重试。");
      }
      throw new Error(payload.error || `解析失败 (${response.status})`);
    }

    state.records = payload.records || [];
    if (state.records.length === 0) {
      setStatus("文件中未找到有效记录，请确保包含 title 和 path 字段", "is-error");
    } else {
      setStatus(`成功解析 ${formatCount(state.records.length)} 条记录`, "is-success");
    }
  } catch (error) {
    state.records = [];
    const message =
      error instanceof TypeError
        ? "无法连接本地服务，请确保 127.0.0.1:3100 服务正在运行"
        : error.message || "文件解析失败";
    setStatus(message, "is-error");
  } finally {
    state.isSubmitting = false;
    renderView();
  }
}

async function downloadTemplate() {
  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/template`));
    if (!response.ok) {
      throw new Error("模板下载失败");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "小程序二维码模板.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    setStatus(error.message || "模板下载失败", "is-error");
  }
}

async function startGeneration() {
  if (state.records.length === 0) return;

  state.isGenerating = true;
  state.progress = {
    total: state.records.length,
    done: 0,
    success: 0,
    failed: 0,
    failures: [],
  };
  state.outputDir = "";

  const { progressLog, progressCurrent, resultsSection } = elements();
  if (progressLog) progressLog.innerHTML = "";
  if (resultsSection) resultsSection.classList.add("is-hidden");

  setStatus("正在启动浏览器...", "is-processing");
  addLogEntry("开始生成任务");
  renderView();

  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/generate`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: state.records }),
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("无法读取响应流");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          handleStreamEvent(event);
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 处理剩余的 buffer
    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer);
        handleStreamEvent(event);
      } catch {
        // 忽略
      }
    }
  } catch (error) {
    const message =
      error instanceof TypeError
        ? "无法连接本地服务，请确保 127.0.0.1:3100 服务正在运行"
        : error.message || "生成失败";
    setStatus(message, "is-error");
    addLogEntry(`错误: ${message}`, "is-error");
  } finally {
    state.isGenerating = false;
    renderView();
  }
}

function handleStreamEvent(event) {
  const { progressCurrent } = elements();

  switch (event.type) {
    case "log":
      addLogEntry(event.message, event.level === "error" ? "is-error" : event.level === "success" ? "is-success" : "");
      break;

    case "waiting_login":
      showLoginConfirmButton();
      break;

    case "progress":
      state.progress.done = event.done;
      state.progress.success = event.success;
      state.progress.failed = event.failed;
      if (progressCurrent) {
        progressCurrent.textContent = event.current || `处理中 ${event.done}/${event.total}`;
      }
      renderProgress();
      break;

    case "output_dir":
      state.outputDir = event.path;
      break;

    case "failure":
      state.progress.failures.push({
        title: event.title,
        reason: event.reason,
      });
      break;

    case "complete":
      hideLoginConfirmButton();
      // 更新状态
      state.progress.success = event.success;
      state.progress.failed = event.failed;
      if (event.failures) {
        state.progress.failures = event.failures;
      }
      renderProgress();
      setStatus(
        `生成完成！成功 ${event.success} 条，失败 ${event.failed} 条`,
        event.failed > 0 ? "is-processing" : "is-success"
      );
      renderResults();
      break;

    case "error":
      hideLoginConfirmButton();
      setStatus(event.message, "is-error");
      addLogEntry(`错误: ${event.message}`, "is-error");
      break;
  }
}

function showLoginConfirmButton() {
  const { progressSection } = elements();
  if (!progressSection) return;

  // 检查是否已存在确认按钮
  let confirmDiv = document.getElementById("loginConfirmDiv");
  if (confirmDiv) return;

  confirmDiv = document.createElement("div");
  confirmDiv.id = "loginConfirmDiv";
  confirmDiv.className = "login-confirm-box";
  confirmDiv.innerHTML = `
    <p>请在弹出的浏览器中扫码登录微信公众平台</p>
    <p>登录成功后，点击下方按钮继续</p>
    <button id="loginConfirmBtn" class="action-button is-primary" type="button">确认登录成功</button>
  `;

  progressSection.appendChild(confirmDiv);

  document.getElementById("loginConfirmBtn")?.addEventListener("click", confirmLogin);
}

function hideLoginConfirmButton() {
  const confirmDiv = document.getElementById("loginConfirmDiv");
  if (confirmDiv) {
    confirmDiv.remove();
  }
}

async function confirmLogin() {
  const btn = document.getElementById("loginConfirmBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "确认中...";
  }

  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/confirm-login`), {
      method: "POST",
    });

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(payload.error || "确认失败");
    }

    addLogEntry("已确认登录，继续生成...", "success");
    hideLoginConfirmButton();
  } catch (error) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "确认登录成功";
    }
    addLogEntry(`确认失败: ${error.message}`, "is-error");
  }
}

async function verifyPluginApi() {
  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/health`), { cache: "no-store" });
    if (response.ok) return true;

    if (response.status === 404) {
      setStatus(
        "此插件页面比本地服务版本更新，请重启 127.0.0.1:3100 服务后再使用",
        "is-error"
      );
      return false;
    }

    setStatus(`插件 API 检查失败 (${response.status})`, "is-error");
    return false;
  } catch {
    setStatus(
      "无法连接本地服务 (127.0.0.1:3100)，请确保服务正在运行",
      "is-error"
    );
    return false;
  }
}

async function loadPluginMeta() {
  try {
    const response = await fetch(apiUrl("/api/plugin-cards"), { cache: "no-store" });
    if (!response.ok) return;

    const payload = await readResponsePayload(response);
    const plugins = Array.isArray(payload.plugins) ? payload.plugins : [];
    const plugin = plugins.find((entry) => entry.id === PLUGIN_ID);
    if (!plugin) return;

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
      pluginTypeBadge.textContent = plugin.enabled ? "插件已启用" : "插件已禁用";
    }
  } catch {
    // 保持页面可用
  }
}

function initUploader() {
  const { fileInput, dropzone, browseButton, templateButton, startButton } = elements();
  if (!fileInput || !dropzone || !browseButton) return;

  browseButton.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("click", () => fileInput.click());

  if (templateButton) {
    templateButton.addEventListener("click", downloadTemplate);
  }

  if (startButton) {
    startButton.addEventListener("click", startGeneration);
  }

  fileInput.addEventListener("change", () => {
    const [file] = fileInput.files || [];
    if (file) {
      void submitFile(file);
    }
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!state.isSubmitting && !state.isGenerating) {
      dropzone.classList.add("is-dragover");
    }
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-dragover");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    if (state.isSubmitting || state.isGenerating) return;
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
  void verifyPluginApi();
}

init();
