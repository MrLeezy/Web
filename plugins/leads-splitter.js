const state = {
  isSubmitting: false,
  currentFileName: "",
  result: null,
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
    actionMeta: document.getElementById("actionMeta"),
    statusCard: document.getElementById("statusCard"),
    resultsSection: document.getElementById("resultsSection"),
    statsGrid: document.getElementById("statsGrid"),
    outputGrid: document.getElementById("outputGrid"),
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

function renderResults() {
  const { resultsSection, statsGrid, outputGrid, distributionGrid } = elements();
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

  statsGrid.innerHTML = "";
  outputGrid.innerHTML = "";
  distributionGrid.innerHTML = "";

  [
    { label: "Source Rows", value: state.result.total },
    { label: "Table 1 Rows", value: state.result.table1_count },
    { label: "Table 2 Rows", value: state.result.table2_count },
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
    label.textContent = output.label;

    const name = document.createElement("div");
    name.className = "output-name";
    name.textContent = output.filename;

    const description = document.createElement("div");
    description.className = "output-description";
    description.textContent = output.description;

    const meta = document.createElement("div");
    meta.className = "output-meta";
    meta.textContent = `${formatCount(output.count)} rows`;

    const button = document.createElement("button");
    button.className = "download-button";
    button.type = "button";
    button.textContent = "Download CSV";
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
      name.textContent = source || "(empty)";

      const value = document.createElement("span");
      value.className = "distribution-value";
      value.textContent = formatCount(count);

      item.append(name, value);
      distributionGrid.appendChild(item);
    });
}

function renderView() {
  const { dropzone, dropzoneTitle, dropzoneHint, browseButton, actionMeta } = elements();

  if (dropzone) {
    dropzone.disabled = state.isSubmitting;
  }
  if (dropzoneTitle) {
    dropzoneTitle.textContent = state.currentFileName || "Choose or drop a CSV file";
  }
  if (dropzoneHint) {
    dropzoneHint.textContent = state.isSubmitting
      ? "Splitting your file into two output tables..."
      : "The file will be split into two CSV outputs.";
  }
  if (browseButton) {
    browseButton.disabled = state.isSubmitting;
    browseButton.textContent = state.isSubmitting ? "Processing..." : "Select CSV";
  }
  if (actionMeta) {
    actionMeta.textContent = state.currentFileName
      ? `Current file: ${state.currentFileName}`
      : "Recommended input: the standard leads export file.";
  }

  renderResults();
}

async function submitFile(file) {
  if (!file) {
    return;
  }

  if (!/\.csv$/i.test(file.name)) {
    state.result = null;
    setStatus("Only CSV files are supported for this plugin.", "is-error");
    renderView();
    return;
  }

  state.isSubmitting = true;
  state.currentFileName = file.name;
  state.result = null;
  setStatus(`Processing ${file.name}...`, "is-processing");
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
        throw new Error(
          "The plugin page has loaded, but the local FY27 service is still running an older version. Please restart the service on 127.0.0.1:3100 and try again.",
        );
      }

      throw new Error(payload.error || `Plugin processing failed. (${response.status})`);
    }

    state.result = payload.result || null;
    setStatus("Split complete. The two CSV outputs are ready to download below.", "is-success");
  } catch (error) {
    state.result = null;
    const message =
      error instanceof TypeError
        ? "Cannot reach the local FY27 service. Please make sure this project's server is running on 127.0.0.1:3100."
        : error.message || "Plugin processing failed.";
    setStatus(message, "is-error");
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
        "This plugin page is newer than the local FY27 service currently running on 127.0.0.1:3100. Please restart the local service before uploading files.",
        "is-error",
      );
      return false;
    }

    setStatus(`Plugin API check failed with status ${response.status}.`, "is-error");
    return false;
  } catch {
    setStatus(
      "Cannot reach the local FY27 service on 127.0.0.1:3100. Please make sure this project's server is running.",
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
      pluginTypeBadge.textContent = plugin.enabled ? "Plugin Enabled" : "Plugin Disabled";
    }
  } catch {
    // Keep the page usable even if plugin metadata fails to load.
  }
}

function initUploader() {
  const { fileInput, dropzone, browseButton } = elements();
  if (!fileInput || !dropzone || !browseButton) {
    return;
  }

  browseButton.addEventListener("click", () => fileInput.click());
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
  void verifyPluginApi();
}

init();
