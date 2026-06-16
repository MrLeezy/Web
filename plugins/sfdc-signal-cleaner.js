const PLUGIN_ID = "sfdc-signal-cleaner";

const state = {
  isSubmitting: false,
  result: null,
};

function apiUrl(pathname) {
  if (/^https?:/i.test(window.location.origin)) {
    return new URL(pathname, window.location.origin).toString();
  }
  return `http://127.0.0.1:3100${pathname}`;
}

function formatCount(value) {
  return new Intl.NumberFormat("zh-CN").format(Number(value || 0));
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
    fileInput: document.getElementById("fileInput"),
    dropzone: document.getElementById("dropzone"),
    browseButton: document.getElementById("browseButton"),
    actionMeta: document.getElementById("actionMeta"),
    statusCard: document.getElementById("statusCard"),
    resultsSection: document.getElementById("resultsSection"),
    statsGrid: document.getElementById("statsGrid"),
    downloadCard: document.getElementById("downloadCard"),
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
  return apiUrl(`/api/plugins/${PLUGIN_ID}/download/${encodeURIComponent(filename)}`);
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

function renderResults() {
  const { resultsSection, statsGrid, downloadCard } = elements();
  if (!state.result) {
    resultsSection.classList.add("is-hidden");
    statsGrid.innerHTML = "";
    downloadCard.innerHTML = "";
    return;
  }

  const result = state.result;
  resultsSection.classList.remove("is-hidden");

  statsGrid.innerHTML = [
    { label: "源表明细行数", value: formatCount(result.source_total_rows) },
    { label: "输出结果行数", value: formatCount(result.output_rows) },
    { label: "有效手机号", value: formatCount(result.non_empty_mobile_count) },
    { label: "Allocaida ID 已提取", value: formatCount(result.allocaida_non_empty_count) },
  ]
    .map(
      (entry) => `
        <article class="stat-card">
          <div class="stat-value">${entry.value}</div>
          <div class="stat-label">${entry.label}</div>
        </article>
      `,
    )
    .join("");

  downloadCard.innerHTML = `
    <div class="download-name">${result.output_filename}</div>
    <div class="download-note">默认读取 ${result.sheet}，已按当前规则完成全量字段映射。</div>
    <button class="action-button" id="downloadButton" type="button">下载映射结果</button>
  `;

  document.getElementById("downloadButton")?.addEventListener("click", () => {
    triggerFileDownload(buildDownloadUrl(result.output_filename), result.output_filename);
  });
}

async function processFile(file) {
  if (!file || state.isSubmitting) {
    return;
  }

  const { fileInput, dropzone, browseButton, actionMeta } = elements();
  state.isSubmitting = true;
  dropzone.disabled = true;
  browseButton.disabled = true;
  actionMeta.textContent = `正在处理：${file.name}`;
  setStatus("系统正在执行全量映射，请稍候...", "is-loading");

  try {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/process`), {
      method: "POST",
      body: form,
    });
    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(payload.error || "处理失败");
    }

    state.result = payload.result || null;
    renderResults();
    setStatus("映射完成，可以直接下载结果文件。", "is-success");
    actionMeta.textContent = `最近处理文件：${file.name}`;
  } catch (error) {
    state.result = null;
    renderResults();
    setStatus(error.message || "处理失败", "is-error");
    actionMeta.textContent = "请检查上传文件是否为最新 SFDC Signal Excel。";
  } finally {
    state.isSubmitting = false;
    dropzone.disabled = false;
    browseButton.disabled = false;
    fileInput.value = "";
  }
}

function bindEvents() {
  const { fileInput, dropzone, browseButton } = elements();

  browseButton.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-dragover");
  });
  dropzone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    const [file] = Array.from(event.dataTransfer?.files || []);
    await processFile(file);
  });

  fileInput.addEventListener("change", async () => {
    const [file] = Array.from(fileInput.files || []);
    await processFile(file);
  });
}

bindEvents();
renderResults();
