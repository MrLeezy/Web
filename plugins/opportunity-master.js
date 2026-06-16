const PLUGIN_ID = "opportunity-master";

const state = {
  bootstrap: null,
  isUploading: false,
  isBuilding: false,
};

function apiUrl(pathname) {
  if (/^https?:/i.test(window.location.origin)) {
    return new URL(pathname, window.location.origin).toString();
  }
  return `http://127.0.0.1:3100${pathname}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCount(value) {
  return new Intl.NumberFormat("zh-CN").format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) {
    return "暂无";
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
  }).format(date);
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

async function requestJson(pathname, options = {}) {
  const response = await fetch(apiUrl(pathname), options);
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload;
}

function elements() {
  return {
    fileInput: document.getElementById("fileInput"),
    uploadBtn: document.getElementById("uploadBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    buildBtn: document.getElementById("buildBtn"),
    statusCard: document.getElementById("statusCard"),
    actionMeta: document.getElementById("actionMeta"),
    metricFiles: document.getElementById("metricFiles"),
    metricReady: document.getElementById("metricReady"),
    metricUnknown: document.getElementById("metricUnknown"),
    metricOutput: document.getElementById("metricOutput"),
    assetSummary: document.getElementById("assetSummary"),
    supportedTags: document.getElementById("supportedTags"),
    workspaceList: document.getElementById("workspaceList"),
    resultSection: document.getElementById("resultSection"),
    resultGrid: document.getElementById("resultGrid"),
    downloadRow: document.getElementById("downloadRow"),
  };
}

function setStatus(message, type = "") {
  const { statusCard } = elements();
  if (!message) {
    statusCard.textContent = "";
    statusCard.className = "status-card is-hidden";
    return;
  }

  statusCard.textContent = message;
  statusCard.className = `status-card ${type}`.trim();
}

function buildDownloadUrl(filename) {
  const url = new URL(apiUrl(`/api/plugins/${PLUGIN_ID}/download`));
  url.searchParams.set("file", filename);
  return url.toString();
}

function renderBootstrap() {
  const { metricFiles, metricReady, metricUnknown, metricOutput, assetSummary, supportedTags, workspaceList, resultSection, resultGrid, downloadRow, buildBtn } = elements();
  const bootstrap = state.bootstrap;
  if (!bootstrap) {
    return;
  }

  const workspace = bootstrap.workspace || { files: [], summary: {} };
  const files = Array.isArray(workspace.files) ? workspace.files : [];
  metricFiles.textContent = formatCount(workspace.summary?.totalFiles);
  metricReady.textContent = formatCount(workspace.summary?.readyFiles);
  metricUnknown.textContent = formatCount(workspace.summary?.unknownFiles);
  metricOutput.textContent = bootstrap.buildResult?.outputFilename || "暂无";
  buildBtn.disabled = state.isBuilding || state.isUploading || !workspace.summary?.readyFiles;

  assetSummary.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">映射表</span>
      <strong class="summary-value">${bootstrap.assets?.mappingTableExists ? "已就绪" : "缺失"}</strong>
    </div>
    <div class="summary-item">
      <span class="summary-label">渠道映射表</span>
      <strong class="summary-value">${bootstrap.assets?.channelMappingExists ? "已就绪" : "缺失"}</strong>
    </div>
    <div class="summary-item">
      <span class="summary-label">工作区更新时间</span>
      <strong class="summary-value">${escapeHtml(formatDateTime(workspace.updatedAt))}</strong>
    </div>
    <div class="summary-item">
      <span class="summary-label">最近构建时间</span>
      <strong class="summary-value">${escapeHtml(formatDateTime(bootstrap.buildResult?.builtAt))}</strong>
    </div>
  `;

  supportedTags.innerHTML = (bootstrap.supportedSources || [])
    .map((item) => `<span class="supported-tag">${escapeHtml(item)}</span>`)
    .join("");

  if (!files.length) {
    workspaceList.innerHTML = '<div class="empty-state">当前还没有上传文件。先把 website / Chat / 400 / order 的原始 Excel 拖进来。</div>';
  } else {
    workspaceList.innerHTML = files
      .map(
        (item) => `
          <article class="workspace-item">
            <div class="workspace-top">
              <div>
                <div class="workspace-name">${escapeHtml(item.filename)}</div>
                <div class="workspace-meta">
                  状态：<span class="workspace-pill is-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
                  来源：<span class="workspace-pill">${escapeHtml(item.detectedSource)}</span>
                </div>
              </div>
              <button class="text-button" type="button" data-remove-id="${escapeHtml(item.id)}">移除</button>
            </div>
            <div class="workspace-desc">
              <div>识别依据：${escapeHtml(item.detectedBy || "暂无")}</div>
              <div>上传时间：${escapeHtml(formatDateTime(item.uploadedAt))}</div>
            </div>
          </article>
        `
      )
      .join("");

    workspaceList.querySelectorAll("[data-remove-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        await removeFile(button.dataset.removeId);
      });
    });
  }

  if (!bootstrap.buildResult) {
    resultSection.classList.add("is-hidden");
    resultGrid.innerHTML = "";
    downloadRow.innerHTML = "";
    return;
  }

  const result = bootstrap.buildResult;
  resultSection.classList.remove("is-hidden");
  resultGrid.innerHTML = [
    { label: "终极表行数", value: formatCount(result.totalRows) },
    { label: "输出文件", value: escapeHtml(result.outputFilename || "暂无") },
    { label: "去重行数", value: formatCount(result.filteredCounts?.leads_id_deduped_rows) },
    { label: "未命中渠道", value: formatCount(result.channelCounts?.unmatched) },
  ]
    .map(
      (item) => `
        <div class="result-card">
          <div class="result-value">${item.value}</div>
          <div class="result-label">${item.label}</div>
        </div>
      `
    )
    .join("");

  downloadRow.innerHTML = `
    <button class="action-button" id="downloadBtn" type="button">下载终极表</button>
    <span class="action-meta">输出时间：${escapeHtml(formatDateTime(result.builtAt))}</span>
  `;
  document.getElementById("downloadBtn")?.addEventListener("click", () => {
    window.open(buildDownloadUrl(result.outputFilename), "_blank", "noopener,noreferrer");
  });
}

async function refreshBootstrap() {
  const payload = await requestJson(`/api/plugins/${PLUGIN_ID}/bootstrap`);
  state.bootstrap = payload;
  renderBootstrap();
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || state.isUploading) {
    return;
  }

  state.isUploading = true;
  try {
    for (const file of files) {
      setStatus(`正在上传并识别：${file.name}`, "is-loading");
      const form = new FormData();
      form.append("file", file);
      await requestJson(`/api/plugins/${PLUGIN_ID}/import`, {
        method: "POST",
        body: form,
      });
    }
    setStatus(`已完成 ${files.length} 个文件的上传与识别。`, "is-success");
    await refreshBootstrap();
  } catch (error) {
    setStatus(error.message || "上传失败", "is-error");
  } finally {
    state.isUploading = false;
    elements().fileInput.value = "";
  }
}

async function removeFile(fileId) {
  try {
    setStatus("正在移除文件...", "is-loading");
    await requestJson(`/api/plugins/${PLUGIN_ID}/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileId }),
    });
    setStatus("文件已从当前工作区移除。", "is-success");
    await refreshBootstrap();
  } catch (error) {
    setStatus(error.message || "移除失败", "is-error");
  }
}

async function buildMasterWorkbook() {
  if (state.isBuilding) {
    return;
  }

  state.isBuilding = true;
  elements().buildBtn.disabled = true;
  try {
    setStatus("正在生成终极表，请稍候...", "is-loading");
    await requestJson(`/api/plugins/${PLUGIN_ID}/build`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ runLabel: "workspace" }),
    });
    setStatus("终极表生成成功。", "is-success");
    await refreshBootstrap();
  } catch (error) {
    setStatus(error.message || "生成失败", "is-error");
  } finally {
    state.isBuilding = false;
    renderBootstrap();
  }
}

function bindEvents() {
  const { fileInput, uploadBtn, refreshBtn, buildBtn } = elements();

  uploadBtn.addEventListener("click", () => fileInput.click());
  uploadBtn.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadBtn.classList.add("is-dragover");
  });
  uploadBtn.addEventListener("dragleave", () => {
    uploadBtn.classList.remove("is-dragover");
  });
  uploadBtn.addEventListener("drop", async (event) => {
    event.preventDefault();
    uploadBtn.classList.remove("is-dragover");
    await uploadFiles(event.dataTransfer?.files);
  });

  fileInput.addEventListener("change", async () => {
    await uploadFiles(fileInput.files);
  });

  refreshBtn.addEventListener("click", async () => {
    setStatus("正在刷新工作区...", "is-loading");
    try {
      await refreshBootstrap();
      setStatus("工作区已刷新。", "is-success");
    } catch (error) {
      setStatus(error.message || "刷新失败", "is-error");
    }
  });

  buildBtn.addEventListener("click", async () => {
    await buildMasterWorkbook();
  });
}

async function bootstrap() {
  bindEvents();
  setStatus("正在读取插件状态...", "is-loading");
  try {
    await refreshBootstrap();
    setStatus("", "");
  } catch (error) {
    setStatus(error.message || "初始化失败", "is-error");
  }
}

bootstrap();

