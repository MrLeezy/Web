const PLUGIN_ID = "comsumer-data";

const state = {
  bootstrap: null,
  configEditor: null,
  currentPeriod: null,
  workbook: null,
  importHistory: [],
  result: null,
  search: {
    unique: "",
    utm: "",
  },
  unmatchedSelection: [],
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

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const normalized = bytes / 1024 ** index;
  return `${normalized.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function unmatchedKey(payload = {}) {
  return [payload.utmSource || "", payload.utmCampaign || "", payload.utmTerm || ""].join("||");
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

function currentPeriodPayload() {
  const { fiscalYearSelect, quarterSelect, weekSelect } = elements();
  return {
    fiscalYear: fiscalYearSelect.value,
    quarter: quarterSelect.value,
    week: weekSelect.value,
  };
}

function buildDownloadUrl(kind) {
  const url = new URL(apiUrl(`/api/plugins/${PLUGIN_ID}/download`));
  url.searchParams.set("kind", kind);

  if (kind === "period-workbook" && state.currentPeriod) {
    url.searchParams.set("fiscalYear", state.currentPeriod.fiscalYear);
    url.searchParams.set("quarter", state.currentPeriod.quarter);
    url.searchParams.set("week", state.currentPeriod.week);
  }

  return url.toString();
}

function elements() {
  return {
    pluginTitle: document.getElementById("pluginTitle"),
    pluginSummary: document.getElementById("pluginSummary"),
    pluginCategoryBadge: document.getElementById("pluginCategoryBadge"),
    pluginTypeBadge: document.getElementById("pluginTypeBadge"),
    metricChannels: document.getElementById("metricChannels"),
    metricUtms: document.getElementById("metricUtms"),
    metricPeriods: document.getElementById("metricPeriods"),
    metricMasters: document.getElementById("metricMasters"),
    fiscalYearSelect: document.getElementById("fiscalYearSelect"),
    quarterSelect: document.getElementById("quarterSelect"),
    weekSelect: document.getElementById("weekSelect"),
    openPeriodBtn: document.getElementById("openPeriodBtn"),
    rebuildBtn: document.getElementById("rebuildBtn"),
    periodHint: document.getElementById("periodHint"),
    periodStatusCard: document.getElementById("periodStatusCard"),
    currentPeriodValue: document.getElementById("currentPeriodValue"),
    currentPeriodNote: document.getElementById("currentPeriodNote"),
    downloadPeriodBtn: document.getElementById("downloadPeriodBtn"),
    configSummaryList: document.getElementById("configSummaryList"),
    supportedTags: document.getElementById("supportedTags"),
    downloadConfigBtn: document.getElementById("downloadConfigBtn"),
    fileInput: document.getElementById("fileInput"),
    uploadBtn: document.getElementById("uploadBtn"),
    uploadStatusCard: document.getElementById("uploadStatusCard"),
    importHistoryList: document.getElementById("importHistoryList"),
    masterFileList: document.getElementById("masterFileList"),
    refreshConfigEditorBtn: document.getElementById("refreshConfigEditorBtn"),
    configEditorHint: document.getElementById("configEditorHint"),
    configStatusCard: document.getElementById("configStatusCard"),
    uniqueChannelForm: document.getElementById("uniqueChannelForm"),
    uniqueChannelInput: document.getElementById("uniqueChannelInput"),
    uniqueSourceInput: document.getElementById("uniqueSourceInput"),
    uniqueTermInput: document.getElementById("uniqueTermInput"),
    uniqueIdInput: document.getElementById("uniqueIdInput"),
    uniqueSearchInput: document.getElementById("uniqueSearchInput"),
    uniqueChannelTable: document.getElementById("uniqueChannelTable"),
    utmForm: document.getElementById("utmForm"),
    utmSourceInput: document.getElementById("utmSourceInput"),
    utmCampaignInput: document.getElementById("utmCampaignInput"),
    utmTermInput: document.getElementById("utmTermInput"),
    utmUniqueIdSelect: document.getElementById("utmUniqueIdSelect"),
    utmSearchInput: document.getElementById("utmSearchInput"),
    utmTable: document.getElementById("utmTable"),
    latestUnmatchedMeta: document.getElementById("latestUnmatchedMeta"),
    selectAllUnmatchedBtn: document.getElementById("selectAllUnmatchedBtn"),
    clearUnmatchedSelectionBtn: document.getElementById("clearUnmatchedSelectionBtn"),
    bulkUtmUniqueIdSelect: document.getElementById("bulkUtmUniqueIdSelect"),
    bulkMapUnmatchedBtn: document.getElementById("bulkMapUnmatchedBtn"),
    bulkSelectionNote: document.getElementById("bulkSelectionNote"),
    latestUnmatchedList: document.getElementById("latestUnmatchedList"),
    workbookSection: document.getElementById("workbookSection"),
    workbookMeta: document.getElementById("workbookMeta"),
    sourceSheetList: document.getElementById("sourceSheetList"),
    generatedSheetList: document.getElementById("generatedSheetList"),
    resultSection: document.getElementById("resultSection"),
    resultGrid: document.getElementById("resultGrid"),
    unmatchedGrid: document.getElementById("unmatchedGrid"),
    downloadGrid: document.getElementById("downloadGrid"),
  };
}

function setCardStatus(target, message, type = "") {
  if (!target) {
    return;
  }

  if (!message) {
    target.textContent = "";
    target.className = "status-card is-hidden";
    return;
  }

  target.textContent = message;
  target.className = `status-card ${type}`.trim();
}

function renderWeekOptions() {
  const { weekSelect } = elements();
  weekSelect.innerHTML = "";

  for (let index = 1; index <= 13; index += 1) {
    const option = document.createElement("option");
    option.value = `W${index}`;
    option.textContent = `Week ${index}`;
    weekSelect.appendChild(option);
  }
}

function renderBootstrap() {
  const {
    metricChannels,
    metricUtms,
    metricPeriods,
    metricMasters,
    fiscalYearSelect,
    configSummaryList,
    supportedTags,
    masterFileList,
  } = elements();

  const bootstrap = state.bootstrap;
  if (!bootstrap) {
    return;
  }

  metricChannels.textContent = formatCount(bootstrap.config?.uniqueChannels);
  metricUtms.textContent = formatCount(bootstrap.config?.utmMappings);
  metricPeriods.textContent = formatCount(bootstrap.periods?.length);
  metricMasters.textContent = formatCount(bootstrap.masterFiles?.filter((item) => item.exists).length);

  fiscalYearSelect.innerHTML = "";
  (bootstrap.fiscalYears || []).forEach((item) => {
    const option = document.createElement("option");
    option.value = item.fiscalYear;
    option.textContent = `${item.fiscalYear} (${item.start} ~ ${item.end})`;
    fiscalYearSelect.appendChild(option);
  });

  if (state.currentPeriod) {
    fiscalYearSelect.value = state.currentPeriod.fiscalYear;
    elements().quarterSelect.value = state.currentPeriod.quarter;
    elements().weekSelect.value = state.currentPeriod.week;
  } else if (bootstrap.currentPeriod) {
    fiscalYearSelect.value = bootstrap.currentPeriod.fiscalYear;
    elements().quarterSelect.value = bootstrap.currentPeriod.quarter;
    elements().weekSelect.value = bootstrap.currentPeriod.week;
  } else {
    const latest = bootstrap.periods?.[0];
    if (latest) {
      fiscalYearSelect.value = latest.fiscalYear;
      elements().quarterSelect.value = latest.quarter;
      elements().weekSelect.value = `W${latest.weekNumber}`;
    } else if (bootstrap.fiscalYears?.length) {
      fiscalYearSelect.value = bootstrap.fiscalYears[0].fiscalYear;
    }
  }

  if (!fiscalYearSelect.value && bootstrap.fiscalYears?.length) {
    fiscalYearSelect.value = bootstrap.fiscalYears[0].fiscalYear;
  }

  configSummaryList.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">配置表路径</span>
      <strong class="summary-value">${escapeHtml(bootstrap.config?.path || "未找到")}</strong>
    </div>
    <div class="summary-item">
      <span class="summary-label">唯一渠道行数</span>
      <strong class="summary-value">${formatCount(bootstrap.config?.uniqueChannels)}</strong>
    </div>
    <div class="summary-item">
      <span class="summary-label">UTM 映射行数</span>
      <strong class="summary-value">${formatCount(bootstrap.config?.utmMappings)}</strong>
    </div>
    <div class="summary-item">
      <span class="summary-label">Dictionary 行数</span>
      <strong class="summary-value">${formatCount(bootstrap.config?.dictionaryRows)}</strong>
    </div>
  `;

  supportedTags.innerHTML = (bootstrap.importTargets || [])
    .map((item) => `<span class="supported-tag">${escapeHtml(item)}</span>`)
    .join("");

  masterFileList.innerHTML = (bootstrap.masterFiles || [])
    .map((file) => {
      const kind =
        file.label === "UserRawdata_merged"
          ? "user-merged"
          : file.label === "DemandRawdata"
            ? "demand-master"
            : "product-master";

      return `
        <article class="master-file-item">
          <div>
            <div class="master-file-name">${escapeHtml(file.label)}</div>
            <div class="master-file-meta">
              ${file.exists ? `${escapeHtml(file.sheetName || "")} · ${formatCount(file.rows)} 行 · ${formatBytes(file.size)}` : "文件不存在"}
            </div>
          </div>
          <button class="text-button" data-download-kind="${kind}" ${file.exists ? "" : "disabled"} type="button">下载</button>
        </article>
      `;
    })
    .join("");

  masterFileList.querySelectorAll("[data-download-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      window.open(buildDownloadUrl(button.dataset.downloadKind), "_blank", "noopener,noreferrer");
    });
  });
}

function renderWorkbook() {
  const {
    workbookSection,
    workbookMeta,
    currentPeriodValue,
    currentPeriodNote,
    sourceSheetList,
    generatedSheetList,
    downloadPeriodBtn,
    rebuildBtn,
  } = elements();

  const workbook = state.workbook;
  if (!workbook?.exists) {
    workbookSection.classList.add("is-hidden");
    currentPeriodValue.textContent = state.currentPeriod
      ? `${state.currentPeriod.fiscalYear} ${state.currentPeriod.quarter} ${state.currentPeriod.week}`
      : "未选择";
    currentPeriodNote.textContent =
      workbook?.note || "当前周期还没有插件工作区；导入或重建时会在插件目录生成工作区，不会在 data/comsumer 下自动新建周文件。";
    downloadPeriodBtn.disabled = true;
    rebuildBtn.disabled = !state.currentPeriod;
    return;
  }

  currentPeriodValue.textContent = workbook.fileName;
  currentPeriodNote.textContent = `${
    workbook.scope === "legacy-period-file" ? "历史周期工作簿" : "插件工作区"
  } · ${formatCount(workbook.sourceSheets?.length)} 个源 Sheet，${formatCount(workbook.generatedSheets?.length)} 个汇总 Sheet。`;
  workbookMeta.textContent = `${escapeHtml(workbook.filePath)} · ${formatBytes(workbook.size)} · ${escapeHtml(workbook.updatedAt || "")}`;
  downloadPeriodBtn.disabled = false;
  rebuildBtn.disabled = false;
  workbookSection.classList.remove("is-hidden");

  sourceSheetList.innerHTML = (workbook.sourceSheets || [])
    .map(
      (sheet) => `
        <article class="sheet-item">
          <strong>${escapeHtml(sheet.sheetName)}</strong>
          <span>${sheet.present ? `${formatCount(sheet.rows)} 行` : "缺失"}</span>
        </article>
      `
    )
    .join("");

  generatedSheetList.innerHTML = (workbook.generatedSheets || [])
    .map(
      (sheet) => `
        <article class="sheet-item">
          <strong>${escapeHtml(sheet.sheetName)}</strong>
          <span>${sheet.present ? `${formatCount(sheet.rows)} 行` : "缺失"}</span>
        </article>
      `
    )
    .join("");
}

function renderConfigEditor() {
  const {
    configEditorHint,
    uniqueChannelTable,
    utmTable,
    utmUniqueIdSelect,
    latestUnmatchedMeta,
    bulkUtmUniqueIdSelect,
    bulkSelectionNote,
    latestUnmatchedList,
  } = elements();

  const configEditor = state.configEditor;
  if (!configEditor) {
    uniqueChannelTable.innerHTML = '<p class="empty-hint">配置中心加载中…</p>';
    utmTable.innerHTML = '<p class="empty-hint">配置中心加载中…</p>';
    latestUnmatchedList.innerHTML = '<p class="empty-hint">暂时还没有未匹配 UTM 数据。</p>';
    return;
  }

  configEditorHint.textContent = `当前在线维护 ${formatCount(configEditor.uniqueChannels?.length)} 条唯一渠道、${formatCount(configEditor.utmMappings?.length)} 条 UTM 映射。`;
  const currentSelectedUniqueId = utmUniqueIdSelect.value;
  const currentBulkSelectedUniqueId = bulkUtmUniqueIdSelect.value;

  const uniqueKeyword = state.search.unique.trim().toLowerCase();
  const filteredUniqueChannels = (configEditor.uniqueChannels || []).filter((entry) =>
    !uniqueKeyword ||
    [entry.uniqueId, entry.channel, entry.source, entry.term].some((value) => String(value || "").toLowerCase().includes(uniqueKeyword))
  );

  utmUniqueIdSelect.innerHTML = [
    '<option value="">请选择唯一标识符</option>',
    ...(configEditor.uniqueChannels || []).map(
      (entry) => `<option value="${escapeHtml(entry.uniqueId)}">${escapeHtml(`${entry.uniqueId} · ${entry.channel} / ${entry.source}`)}</option>`
    ),
  ].join("");
  if (currentSelectedUniqueId) {
    utmUniqueIdSelect.value = currentSelectedUniqueId;
  }
  bulkUtmUniqueIdSelect.innerHTML = utmUniqueIdSelect.innerHTML;
  if (currentBulkSelectedUniqueId) {
    bulkUtmUniqueIdSelect.value = currentBulkSelectedUniqueId;
  }

  uniqueChannelTable.innerHTML = filteredUniqueChannels.length
    ? `
      <table class="data-table">
        <thead>
          <tr>
            <th>唯一标识符</th>
            <th>Channel</th>
            <th>Source</th>
            <th>Term</th>
          </tr>
        </thead>
        <tbody>
          ${filteredUniqueChannels
            .slice(0, 60)
            .map(
              (entry) => `
                <tr data-unique-id="${escapeHtml(entry.uniqueId)}">
                  <td><button class="row-link" data-fill-unique="${escapeHtml(entry.uniqueId)}" type="button">${escapeHtml(entry.uniqueId)}</button></td>
                  <td>${escapeHtml(entry.channel)}</td>
                  <td>${escapeHtml(entry.source)}</td>
                  <td>${escapeHtml(entry.term)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `
    : '<p class="empty-hint">没有找到符合条件的唯一渠道。</p>';

  uniqueChannelTable.querySelectorAll("[data-fill-unique]").forEach((button) => {
    button.addEventListener("click", () => {
      fillUniqueChannelForm(button.dataset.fillUnique);
    });
  });

  const utmKeyword = state.search.utm.trim().toLowerCase();
  const filteredUtmMappings = (configEditor.utmMappings || []).filter((entry) =>
    !utmKeyword ||
    [entry.utmSource, entry.utmCampaign, entry.utmTerm, entry.uniqueId].some((value) => String(value || "").toLowerCase().includes(utmKeyword))
  );

  utmTable.innerHTML = filteredUtmMappings.length
    ? `
      <table class="data-table">
        <thead>
          <tr>
            <th>utm_source</th>
            <th>utm_campaign</th>
            <th>utm_term</th>
            <th>唯一标识符</th>
          </tr>
        </thead>
        <tbody>
          ${filteredUtmMappings
            .slice(0, 80)
            .map(
              (entry) => `
                <tr>
                  <td><button class="row-link" data-fill-utm='${escapeHtml(JSON.stringify({
                    utmSource: entry.utmSource,
                    utmCampaign: entry.utmCampaign,
                    utmTerm: entry.utmTerm,
                    uniqueId: entry.uniqueId,
                  }))}' type="button">${escapeHtml(entry.utmSource || "空")}</button></td>
                  <td>${escapeHtml(entry.utmCampaign || "空")}</td>
                  <td>${escapeHtml(entry.utmTerm || "空")}</td>
                  <td>${escapeHtml(entry.uniqueId)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `
    : '<p class="empty-hint">没有找到符合条件的 UTM 映射。</p>';

  utmTable.querySelectorAll("[data-fill-utm]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        fillUtmForm(JSON.parse(button.dataset.fillUtm || "{}"));
      } catch {
        // ignore bad payload
      }
    });
  });

  const unmatchedItems = configEditor.latestUnmatched?.items || [];
  const visibleUnmatchedItems = unmatchedItems.slice(0, 30);
  const visibleKeys = new Set(visibleUnmatchedItems.map((item) => unmatchedKey(item)));
  state.unmatchedSelection = state.unmatchedSelection.filter((key) => visibleKeys.has(key) || unmatchedItems.some((item) => unmatchedKey(item) === key));
  const selectedSet = new Set(state.unmatchedSelection);
  if (configEditor.latestUnmatched?.periodLabel) {
    const resolvedItems = Number(configEditor.latestUnmatched.resolvedItems || 0);
    const totalItems = Number(configEditor.latestUnmatched.totalItems || unmatchedItems.length);
    latestUnmatchedMeta.textContent =
      resolvedItems > 0
        ? `最近一次未匹配来源：${configEditor.latestUnmatched.periodLabel}。最新配置已自动消化 ${formatCount(resolvedItems)} 条组合，当前还剩 ${formatCount(unmatchedItems.length)} 条待补。`
        : `最近一次未匹配来源：${configEditor.latestUnmatched.periodLabel}。当前还有 ${formatCount(totalItems)} 条待补，点击任意一条可直接带入 UTM 表单。`;
  } else {
    latestUnmatchedMeta.textContent = "最近还没有未匹配的 UTM 数据。";
  }
  bulkSelectionNote.textContent = state.unmatchedSelection.length
    ? `已选择 ${formatCount(state.unmatchedSelection.length)} 条未匹配 UTM，保存后会一起映射到同一个唯一渠道。`
    : "暂未选择未匹配 UTM。";
  latestUnmatchedList.innerHTML = visibleUnmatchedItems.length
    ? visibleUnmatchedItems
        .map(
          (item) => `
            <article class="unmatched-utm-item ${selectedSet.has(unmatchedKey(item)) ? "is-selected" : ""}">
              <div class="unmatched-utm-top">
                <button
                  class="unmatched-utm-select ${selectedSet.has(unmatchedKey(item)) ? "is-selected" : ""}"
                  type="button"
                  aria-pressed="${selectedSet.has(unmatchedKey(item)) ? "true" : "false"}"
                  data-toggle-unmatched='${escapeHtml(JSON.stringify({
                    utmSource: item.utmSource,
                    utmCampaign: item.utmCampaign,
                    utmTerm: item.utmTerm,
                  }))}'
                >
                  ${selectedSet.has(unmatchedKey(item)) ? "已选择" : "选择此项"}
                </button>
                <em>${formatCount(item.count)} 条</em>
              </div>
              <button
                class="unmatched-utm-fill"
                type="button"
                data-fill-unmatched='${escapeHtml(JSON.stringify({
                  utmSource: item.utmSource,
                  utmCampaign: item.utmCampaign,
                  utmTerm: item.utmTerm,
                }))}'
              >
                带入单条表单
              </button>
              <strong>${escapeHtml(item.utmSource || "空 source")}</strong>
              <span>${escapeHtml(item.utmCampaign || "空 campaign")}</span>
              <span>${escapeHtml(item.utmTerm || "空 term")}</span>
            </article>
          `
        )
        .join("")
    : '<p class="empty-hint">最近没有新的未匹配 UTM，可以直接维护现有配置。</p>';

  latestUnmatchedList.querySelectorAll("[data-toggle-unmatched]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        const payload = JSON.parse(button.dataset.toggleUnmatched || "{}");
        toggleUnmatchedSelection(payload);
      } catch {
        // ignore bad payload
      }
    });
  });

  latestUnmatchedList.querySelectorAll("[data-fill-unmatched]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        fillUtmForm(JSON.parse(button.dataset.fillUnmatched || "{}"));
      } catch {
        // ignore bad payload
      }
    });
  });
}

function renderImportHistory() {
  const { importHistoryList } = elements();
  if (!state.importHistory.length) {
    importHistoryList.innerHTML = '<p class="empty-hint">还没有导入任何文件。</p>';
    return;
  }

  importHistoryList.innerHTML = state.importHistory
    .map(
      (entry) => `
        <article class="history-item">
          <div class="history-title">${escapeHtml(entry.fileName)}</div>
          <div class="history-meta">${escapeHtml(entry.imported.map((item) => `${item.fromSheet} → ${item.targetSheet} (${item.rows} 行)`).join("；"))}</div>
        </article>
      `
    )
    .join("");
}

function renderResult() {
  const { resultSection, resultGrid, unmatchedGrid, downloadGrid } = elements();
  if (!state.result) {
    resultSection.classList.add("is-hidden");
    return;
  }

  const result = state.result;
  resultSection.classList.remove("is-hidden");
  resultGrid.innerHTML = `
    <article class="result-card">
      <span class="result-label">UserRawdata</span>
      <strong class="result-value">${formatCount(result.generated?.userRows)}</strong>
    </article>
    <article class="result-card">
      <span class="result-label">DemandRawdata</span>
      <strong class="result-value">${formatCount(result.generated?.demandRows)}</strong>
    </article>
    <article class="result-card">
      <span class="result-label">ProductRawdata</span>
      <strong class="result-value">${formatCount(result.generated?.productRows)}</strong>
    </article>
    <article class="result-card">
      <span class="result-label">报告文件</span>
      <strong class="result-value">1</strong>
    </article>
  `;

  const userUnmatched = result.unmatched?.user || [];
  const productUnmatched = result.unmatched?.product || [];

  unmatchedGrid.innerHTML = `
    <article class="unmatched-card">
      <h3>未匹配的 User 来源</h3>
      ${
        userUnmatched.length
          ? `<ul class="plain-list">${userUnmatched.map((item) => `<li>${escapeHtml(item.sheetName)}：${formatCount(item.count)} 条</li>`).join("")}</ul>`
          : '<p class="empty-hint">当前未发现未匹配的 User 汇总来源。</p>'
      }
    </article>
    <article class="unmatched-card">
      <h3>未匹配的产品名称</h3>
      ${
        productUnmatched.length
          ? `<ul class="plain-list">${productUnmatched.slice(0, 20).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
          : '<p class="empty-hint">产品名称映射正常。</p>'
      }
    </article>
  `;

  downloadGrid.innerHTML = `
    <button class="action-button" data-download-kind="period-workbook" type="button">下载当前插件工作区</button>
    <button class="action-button is-secondary" data-download-kind="user-merged" type="button">下载 UserRawdata_merged</button>
    <button class="action-button is-secondary" data-download-kind="demand-master" type="button">下载 DemandRawdata</button>
    <button class="action-button is-secondary" data-download-kind="product-master" type="button">下载 ProductRawdata</button>
  `;

  downloadGrid.querySelectorAll("[data-download-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      window.open(buildDownloadUrl(button.dataset.downloadKind), "_blank", "noopener,noreferrer");
    });
  });
}

function renderAll() {
  renderBootstrap();
  renderConfigEditor();
  renderWorkbook();
  renderImportHistory();
  renderResult();
}

async function loadPluginMeta() {
  try {
    const payload = await requestJson("/api/plugin-cards", { cache: "no-store" });
    const plugins = Array.isArray(payload.plugins) ? payload.plugins : [];
    const plugin = plugins.find((entry) => entry.id === PLUGIN_ID);
    if (!plugin) {
      return;
    }

    const { pluginTitle, pluginSummary, pluginCategoryBadge, pluginTypeBadge } = elements();
    pluginTitle.textContent = plugin.title;
    pluginSummary.textContent = plugin.summary;
    pluginCategoryBadge.textContent = plugin.category || "Data Ops";
    pluginTypeBadge.textContent = plugin.enabled ? "插件已启用" : "插件已禁用";
    document.title = plugin.title;
  } catch {
    // Keep page usable.
  }
}

async function loadBootstrap() {
  state.bootstrap = await requestJson(`/api/plugins/${PLUGIN_ID}/bootstrap`);
  renderAll();
}

async function loadConfigEditor() {
  state.configEditor = await requestJson(`/api/plugins/${PLUGIN_ID}/config/editor`, { cache: "no-store" });
  renderAll();
}

function toggleUnmatchedSelection(payload = {}, forceChecked) {
  const key = unmatchedKey(payload);
  const next = new Set(state.unmatchedSelection);
  const shouldSelect = typeof forceChecked === "boolean" ? forceChecked : !next.has(key);

  if (shouldSelect) {
    next.add(key);
  } else {
    next.delete(key);
  }

  state.unmatchedSelection = Array.from(next);
  renderConfigEditor();
}

function selectAllVisibleUnmatched() {
  const visibleItems = (state.configEditor?.latestUnmatched?.items || []).slice(0, 30);
  state.unmatchedSelection = Array.from(new Set([...state.unmatchedSelection, ...visibleItems.map((item) => unmatchedKey(item))]));
  renderConfigEditor();
}

function clearUnmatchedSelection() {
  state.unmatchedSelection = [];
  renderConfigEditor();
}

function fillUniqueChannelForm(uniqueId) {
  const { uniqueChannelInput, uniqueSourceInput, uniqueTermInput, uniqueIdInput } = elements();
  const target = (state.configEditor?.uniqueChannels || []).find((entry) => entry.uniqueId === uniqueId);
  if (!target) {
    return;
  }

  uniqueChannelInput.value = target.channel || "";
  uniqueSourceInput.value = target.source || "";
  uniqueTermInput.value = target.term || "";
  uniqueIdInput.value = target.uniqueId || "";
}

function fillUtmForm(payload = {}) {
  const { utmSourceInput, utmCampaignInput, utmTermInput, utmUniqueIdSelect } = elements();
  utmSourceInput.value = payload.utmSource || "";
  utmCampaignInput.value = payload.utmCampaign || "";
  utmTermInput.value = payload.utmTerm || "";
  if (payload.uniqueId) {
    utmUniqueIdSelect.value = payload.uniqueId;
  }
}

async function openPeriod() {
  const { openPeriodBtn, periodHint, periodStatusCard } = elements();
  const payload = currentPeriodPayload();
  state.currentPeriod = { ...payload };

  openPeriodBtn.disabled = true;
  openPeriodBtn.textContent = "加载中...";
  periodHint.textContent = "正在检查当前周期状态…";

  try {
    const response = await requestJson(`/api/plugins/${PLUGIN_ID}/period/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    state.workbook = response.workbook;
    state.result = null;
    setCardStatus(
      periodStatusCard,
      response.workbook?.exists
        ? response.workbook.scope === "legacy-period-file"
          ? "已加载历史周期工作簿；后续导入会转入插件工作区，不会改写 data/comsumer 下的新周文件。"
          : "已加载当前插件工作区，可继续导入和重建。"
        : "已加载当前周期；暂时没有插件工作区，后续导入或重建时会在插件目录生成。",
      response.workbook?.exists ? "is-processing" : "is-success"
    );
    periodHint.textContent = `${response.period.fiscalYear} ${response.period.quarter} ${response.period.week} · ${response.period.month}`;
    renderAll();
  } catch (error) {
    setCardStatus(periodStatusCard, error.message, "is-error");
    periodHint.textContent = error.message;
  } finally {
    openPeriodBtn.disabled = false;
    openPeriodBtn.textContent = "加载当前周期";
  }
}

async function rebuildPeriod() {
  const { rebuildBtn, periodStatusCard } = elements();
  if (!state.currentPeriod) {
    setCardStatus(periodStatusCard, "请先加载一个周期。", "is-error");
    return;
  }

  rebuildBtn.disabled = true;
  rebuildBtn.textContent = "重建中...";
  setCardStatus(periodStatusCard, "正在重建 UserRawdata / DemandRawdata / ProductRawdata，并同步主底表…", "is-processing");

  try {
    const payload = await requestJson(`/api/plugins/${PLUGIN_ID}/rebuild`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.currentPeriod),
    });
    state.result = payload;
    state.workbook = payload.workbook;
    setCardStatus(periodStatusCard, "重建完成，主底表已同步。", "is-success");
    await Promise.all([loadBootstrap(), loadConfigEditor()]);
    renderAll();
  } catch (error) {
    setCardStatus(periodStatusCard, error.message, "is-error");
  } finally {
    rebuildBtn.disabled = false;
    rebuildBtn.textContent = "重建并同步主底表";
  }
}

async function importFiles(files) {
  const { uploadBtn, uploadStatusCard } = elements();
  if (!state.currentPeriod) {
    setCardStatus(uploadStatusCard, "请先加载当前周期，再导入 Excel 或 CSV。", "is-error");
    return;
  }

  if (!files?.length) {
    return;
  }

  uploadBtn.disabled = true;
  setCardStatus(uploadStatusCard, `正在导入 ${files.length} 个文件…`, "is-processing");

  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fiscalYear", state.currentPeriod.fiscalYear);
      formData.append("quarter", state.currentPeriod.quarter);
      formData.append("week", state.currentPeriod.week);

      const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/import`), {
        method: "POST",
        body: formData,
      });
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        throw new Error(payload.error || `导入 ${file.name} 失败`);
      }

      state.importHistory.unshift({
        fileName: file.name,
        imported: payload.imported || [],
      });
      state.workbook = payload.workbook;
    }

    setCardStatus(uploadStatusCard, "文件已导入到当前插件工作区。", "is-success");
    renderAll();
  } catch (error) {
    setCardStatus(uploadStatusCard, error.message, "is-error");
  } finally {
    uploadBtn.disabled = false;
  }
}

async function saveUniqueChannel(event) {
  event.preventDefault();
  const {
    configStatusCard,
    uniqueChannelInput,
    uniqueSourceInput,
    uniqueTermInput,
    uniqueIdInput,
  } = elements();

  setCardStatus(configStatusCard, "正在保存唯一渠道…", "is-processing");

  try {
    const payload = await requestJson(`/api/plugins/${PLUGIN_ID}/config/unique-channel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: uniqueChannelInput.value,
        source: uniqueSourceInput.value,
        term: uniqueTermInput.value,
        uniqueId: uniqueIdInput.value,
      }),
    });

    state.configEditor = payload.editor;
    setCardStatus(configStatusCard, `唯一渠道已保存：${payload.saved.uniqueId}。如需回写主底表，请再点一次“重建并同步主底表”。`, "is-success");
    await loadBootstrap();
    renderAll();
  } catch (error) {
    setCardStatus(configStatusCard, error.message, "is-error");
  }
}

async function saveUtmMapping(event) {
  event.preventDefault();
  const { configStatusCard, utmSourceInput, utmCampaignInput, utmTermInput, utmUniqueIdSelect } = elements();

  setCardStatus(configStatusCard, "正在保存 UTM 映射…", "is-processing");

  try {
    const payload = await requestJson(`/api/plugins/${PLUGIN_ID}/config/utm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        utmSource: utmSourceInput.value,
        utmCampaign: utmCampaignInput.value,
        utmTerm: utmTermInput.value,
        uniqueId: utmUniqueIdSelect.value,
      }),
    });

    state.configEditor = payload.editor;
    setCardStatus(configStatusCard, `UTM 映射已保存到：${payload.saved.uniqueId}。如需回写主底表，请再点一次“重建并同步主底表”。`, "is-success");
    await loadBootstrap();
    renderAll();
  } catch (error) {
    setCardStatus(configStatusCard, error.message, "is-error");
  }
}

async function saveBulkUtmMappings() {
  const { configStatusCard, bulkUtmUniqueIdSelect } = elements();
  const selectedItems = (state.configEditor?.latestUnmatched?.items || []).filter((item) =>
    state.unmatchedSelection.includes(unmatchedKey(item))
  );

  if (!selectedItems.length) {
    setCardStatus(configStatusCard, "请先选择至少一条未匹配 UTM。", "is-error");
    return;
  }

  setCardStatus(configStatusCard, `正在批量保存 ${selectedItems.length} 条 UTM 映射…`, "is-processing");

  try {
    const payload = await requestJson(`/api/plugins/${PLUGIN_ID}/config/utm/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uniqueId: bulkUtmUniqueIdSelect.value,
        items: selectedItems,
      }),
    });

    state.unmatchedSelection = [];
    state.configEditor = payload.editor;
    setCardStatus(configStatusCard, `已批量保存 ${payload.savedCount} 条 UTM 映射。如需回写主底表，请再点一次“重建并同步主底表”。`, "is-success");
    await loadBootstrap();
    renderAll();
  } catch (error) {
    setCardStatus(configStatusCard, error.message, "is-error");
  }
}

function initEvents() {
  const {
    openPeriodBtn,
    rebuildBtn,
    refreshConfigEditorBtn,
    uniqueChannelForm,
    uniqueSearchInput,
    utmForm,
    utmSearchInput,
    selectAllUnmatchedBtn,
    clearUnmatchedSelectionBtn,
    bulkMapUnmatchedBtn,
    uploadBtn,
    fileInput,
    downloadConfigBtn,
    downloadPeriodBtn,
  } = elements();

  openPeriodBtn.addEventListener("click", () => {
    void openPeriod();
  });

  rebuildBtn.addEventListener("click", () => {
    void rebuildPeriod();
  });

  refreshConfigEditorBtn.addEventListener("click", () => {
    void loadConfigEditor();
  });

  uniqueChannelForm.addEventListener("submit", (event) => {
    void saveUniqueChannel(event);
  });

  uniqueSearchInput.addEventListener("input", () => {
    state.search.unique = uniqueSearchInput.value || "";
    renderConfigEditor();
  });

  utmForm.addEventListener("submit", (event) => {
    void saveUtmMapping(event);
  });

  utmSearchInput.addEventListener("input", () => {
    state.search.utm = utmSearchInput.value || "";
    renderConfigEditor();
  });

  selectAllUnmatchedBtn.addEventListener("click", () => {
    selectAllVisibleUnmatched();
  });

  clearUnmatchedSelectionBtn.addEventListener("click", () => {
    clearUnmatchedSelection();
  });

  bulkMapUnmatchedBtn.addEventListener("click", () => {
    void saveBulkUtmMappings();
  });

  uploadBtn.addEventListener("click", () => fileInput.click());
  uploadBtn.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadBtn.classList.add("is-dragover");
  });
  uploadBtn.addEventListener("dragleave", () => {
    uploadBtn.classList.remove("is-dragover");
  });
  uploadBtn.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadBtn.classList.remove("is-dragover");
    void importFiles(Array.from(event.dataTransfer?.files || []));
  });
  fileInput.addEventListener("change", () => {
    void importFiles(Array.from(fileInput.files || []));
    fileInput.value = "";
  });

  downloadConfigBtn.addEventListener("click", () => {
    window.open(buildDownloadUrl("config"), "_blank", "noopener,noreferrer");
  });
  downloadPeriodBtn.addEventListener("click", () => {
    window.open(buildDownloadUrl("period-workbook"), "_blank", "noopener,noreferrer");
  });
}

async function init() {
  renderWeekOptions();
  initEvents();
  await Promise.all([loadPluginMeta(), loadBootstrap(), loadConfigEditor()]);
}

void init();
