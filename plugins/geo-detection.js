/**
 * GEO长尾词监控插件 - 前端逻辑
 */

const PLUGIN_ID = "geo-detection";

const state = {
  projects: [],
  brands: [],
  reports: [],
  isDetecting: false,
  progress: {
    platform: "",
    status: "",
    total: 0,
    done: 0,
  },
};

function apiUrl(pathname) {
  if (/^https?:/i.test(window.location.origin)) {
    return new URL(pathname, window.location.origin).toString();
  }
  return `http://127.0.0.1:3100${pathname}`;
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
    // 项目相关
    projectTags: document.getElementById("projectTags"),
    projectInput: document.getElementById("projectInput"),
    addProjectBtn: document.getElementById("addProjectBtn"),
    brandProject: document.getElementById("brandProject"),
    // 品牌词相关
    brandInput: document.getElementById("brandInput"),
    addBrandBtn: document.getElementById("addBrandBtn"),
    brandList: document.getElementById("brandList"),
    // 检测相关
    keywordInput: document.getElementById("keywordInput"),
    browserMode: document.getElementById("browserMode"),
    startDetectBtn: document.getElementById("startDetectBtn"),
    batchDetectBtn: document.getElementById("batchDetectBtn"),
    batchOptions: document.getElementById("batchOptions"),
    repeatCount: document.getElementById("repeatCount"),
    statusCard: document.getElementById("statusCard"),
    // 进度相关
    progressSection: document.getElementById("progressSection"),
    progressPlatform: document.getElementById("progressPlatform"),
    progressStatus: document.getElementById("progressStatus"),
    progressBar: document.getElementById("progressBar"),
    progressLog: document.getElementById("progressLog"),
    // 报告相关
    reportTableBody: document.getElementById("reportTableBody"),
    reportEmpty: document.getElementById("reportEmpty"),
    reportFilterKeyword: document.getElementById("reportFilterKeyword"),
    reportFilterProject: document.getElementById("reportFilterProject"),
    reportFilterPlatform: document.getElementById("reportFilterPlatform"),
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

function renderBrands() {
  const { brandList } = elements();
  if (!brandList) return;

  if (state.brands.length === 0) {
    brandList.innerHTML = '<div class="brand-empty">暂无品牌词，请添加</div>';
    return;
  }

  brandList.innerHTML = state.brands
    .map(
      (brand) => `
      <div class="brand-item" data-id="${brand.id}">
        <span class="brand-item-text">${escapeHtml(brand.name)} <span class="brand-item-project">[${brand.projectName || "未分组"}]</span></span>
        <button class="brand-item-delete" data-id="${brand.id}" type="button">删除</button>
      </div>
    `
    )
    .join("");

  // 绑定删除按钮
  brandList.querySelectorAll(".brand-item-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteBrand(btn.dataset.id));
  });
}

function renderProjects() {
  const { projectTags, brandProject, reportFilterProject } = elements();

  // 渲染项目标签
  if (projectTags) {
    const projectCheckboxes = state.projects
      .map(
        (p) => `
        <label class="checkbox-label">
          <input type="checkbox" name="project" value="${p.id}" />
          <span>${escapeHtml(p.name)}</span>
        </label>
      `
      )
      .join("");

    projectTags.innerHTML = `
      <label class="checkbox-label">
        <input type="checkbox" name="project" value="all" checked />
        <span>全部</span>
      </label>
      ${projectCheckboxes}
    `;

    // 绑定全选逻辑
    const allCheckbox = projectTags.querySelector('input[value="all"]');
    const otherCheckboxes = projectTags.querySelectorAll('input:not([value="all"])');

    if (allCheckbox) {
      allCheckbox.addEventListener("change", (e) => {
        otherCheckboxes.forEach((cb) => {
          cb.checked = false;
        });
      });
    }

    otherCheckboxes.forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked && allCheckbox) {
          allCheckbox.checked = false;
        }
      });
    });
  }

  // 渲染品牌词项目选择下拉
  if (brandProject) {
    brandProject.innerHTML = `
      <option value="">选择项目</option>
      ${state.projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
    `;
  }

  // 渲染报告项目筛选下拉
  if (reportFilterProject) {
    const currentValue = reportFilterProject.value;
    reportFilterProject.innerHTML = `
      <option value="">全部项目</option>
      ${state.projects.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join("")}
    `;
    reportFilterProject.value = currentValue;
  }
}

function renderReports() {
  const { reportTableBody, reportEmpty, reportFilterKeyword, reportFilterProject, reportFilterPlatform } = elements();
  if (!reportTableBody) return;

  const keywordFilter = (reportFilterKeyword?.value || "").trim().toLowerCase();
  const projectFilter = reportFilterProject?.value || "";
  const platformFilter = reportFilterPlatform?.value || "";

  const filtered = state.reports.filter((report) => {
    if (keywordFilter && !report.keyword.toLowerCase().includes(keywordFilter)) {
      return false;
    }
    if (projectFilter && report.projectName !== projectFilter) {
      return false;
    }
    if (platformFilter && report.platform !== platformFilter) {
      return false;
    }
    return true;
  });

  // 按时间倒序排列（最新的在最上面）
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (filtered.length === 0) {
    reportTableBody.innerHTML = "";
    if (reportEmpty) reportEmpty.classList.remove("is-hidden");
    return;
  }

  if (reportEmpty) reportEmpty.classList.add("is-hidden");

  const platformNames = {
    doubao: "豆包",
    deepseek: "Deepseek",
    qianwen: "千问",
    yuanbao: "元宝",
  };

  reportTableBody.innerHTML = filtered
    .map(
      (report) => `
      <tr data-id="${report.id}">
        <td>${escapeHtml(report.date)}</td>
        <td>${escapeHtml(report.projectName || "-")}</td>
        <td>${escapeHtml(report.keyword)}</td>
        <td>${platformNames[report.platform] || report.platform}</td>
        <td class="${report.contentMatched ? "match-yes" : "match-no"}">
          ${report.contentMatched ? "是" : "否"}
        </td>
        <td>${escapeHtml(report.contentMatchedBrands || "-")}</td>
        <td class="${report.hasReference ? "match-yes" : "match-no"}">
          ${report.hasReference ? "是" : "否"}
        </td>
        <td>${report.recommendationScore !== null ? "批量" : "单次"}</td>
        <td>${report.recommendationScore !== null ? report.recommendationScore : ""}</td>
        <td>
          <button class="report-delete-btn" data-id="${report.id}" type="button">删除</button>
        </td>
      </tr>
    `
    )
    .join("");

  // 绑定删除按钮
  reportTableBody.querySelectorAll(".report-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteReport(btn.dataset.id));
  });
}

function renderView() {
  const { startDetectBtn } = elements();

  const disabled = state.isDetecting;
  const hasBrands = state.brands.length > 0;

  if (startDetectBtn) {
    startDetectBtn.disabled = disabled || !hasBrands;
    startDetectBtn.textContent = state.isDetecting ? "检测中..." : "开始检测";
  }

  renderProjects();
  renderBrands();
  renderReports();
}

function addLogEntry(message, type = "") {
  const { progressLog } = elements();
  if (!progressLog) return;

  const entry = document.createElement("div");
  entry.className = `progress-log-entry ${type}`.trim();
  entry.textContent = `[${new Date().toLocaleTimeString("zh-CN")}] ${message}`;
  progressLog.appendChild(entry);

  // 只滚动日志区域到底部，不影响整个页面
  progressLog.scrollTop = progressLog.scrollHeight;
}

function updateProgress(platform, status, percent) {
  const { progressPlatform, progressStatus, progressBar } = elements();

  const platformNames = {
    doubao: "豆包",
    deepseek: "Deepseek",
    qianwen: "千问",
    yuanbao: "元宝",
  };

  if (progressPlatform) {
    progressPlatform.textContent = platformNames[platform] || platform || "-";
  }
  if (progressStatus) {
    progressStatus.textContent = status || "准备中...";
  }
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }
}

async function addBrand() {
  const { brandInput, brandProject } = elements();
  if (!brandInput) return;

  const name = brandInput.value.trim();
  if (!name) return;

  const projectId = brandProject?.value || "";
  const projectName = projectId ? (state.projects.find((p) => p.id === projectId)?.name || "") : "";

  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/brands`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectId, projectName }),
    });

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(payload.error || "添加失败");
    }

    state.brands = payload.brands || [];
    brandInput.value = "";
    renderView();
  } catch (error) {
    setStatus(error.message, "is-error");
  }
}

async function addProject() {
  const { projectInput } = elements();
  if (!projectInput) return;

  const name = projectInput.value.trim();
  if (!name) return;

  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/projects`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(payload.error || "添加失败");
    }

    state.projects = payload.projects || [];
    projectInput.value = "";
    renderView();
  } catch (error) {
    setStatus(error.message, "is-error");
  }
}

async function deleteBrand(id) {
  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/brands/${id}`), {
      method: "DELETE",
    });

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(payload.error || "删除失败");
    }

    state.brands = payload.brands || [];
    renderView();
  } catch (error) {
    setStatus(error.message, "is-error");
  }
}

async function deleteReport(id) {
  if (!confirm("确定要删除这条报告吗？")) return;

  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/reports/${id}`), {
      method: "DELETE",
    });

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(payload.error || "删除失败");
    }

    state.reports = payload.reports || [];
    renderReports();
  } catch (error) {
    setStatus(error.message, "is-error");
  }
}

async function deleteAllReports() {
  if (!confirm("确定要删除所有报告吗？此操作不可恢复！")) return;

  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/reports`), {
      method: "DELETE",
    });

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(payload.error || "删除失败");
    }

    state.reports = [];
    renderReports();
    setStatus("已删除所有报告", "is-success");
  } catch (error) {
    setStatus(error.message, "is-error");
  }
}

function exportReports() {
  if (state.reports.length === 0) {
    setStatus("暂无报告可导出", "is-error");
    return;
  }

  const platformNames = {
    doubao: "豆包",
    deepseek: "Deepseek",
    qianwen: "千问",
    yuanbao: "元宝",
  };

  // 按时间倒序排列
  const sortedReports = [...state.reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const headers = ["日期", "长尾词", "平台", "内容匹配", "匹配品牌词", "打开资料"];
  const rows = sortedReports.map((report) => [
    report.date,
    report.keyword,
    platformNames[report.platform] || report.platform,
    report.contentMatched ? "是" : "否",
    report.contentMatchedBrands || "-",
    report.hasReference ? "YES" : "NO",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `geo-detection-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function startDetection(repeatCount = 1) {
  const { keywordInput, browserMode, progressSection, progressLog } = elements();

  const keywordText = (keywordInput?.value || "").trim();
  if (!keywordText) {
    setStatus("请输入长尾词", "is-error");
    return;
  }

  // 解析多个长尾词（按换行分割）
  const keywords = keywordText
    .split("\n")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keywords.length === 0) {
    setStatus("请输入有效的长尾词", "is-error");
    return;
  }

  // 获取选中的平台
  const checkboxes = document.querySelectorAll('input[name="platform"]:checked');
  const platforms = Array.from(checkboxes).map((cb) => cb.value);

  if (platforms.length === 0) {
    setStatus("请至少选择一个平台", "is-error");
    return;
  }

  // 获取选中的项目
  const projectCheckboxes = document.querySelectorAll('input[name="project"]:checked');
  const selectedProjectIds = Array.from(projectCheckboxes).map((cb) => cb.value);

  // 过滤品牌词：如果选择了特定项目，只使用选中项目的品牌词
  let filteredBrands = state.brands;
  const isAllProjects = selectedProjectIds.includes("all");

  if (!isAllProjects && selectedProjectIds.length > 0) {
    filteredBrands = state.brands.filter((b) => selectedProjectIds.includes(b.projectId));
  }

  if (filteredBrands.length === 0) {
    setStatus("请先添加品牌词或选择项目", "is-error");
    return;
  }

  // 获取浏览器模式
  const useBrowserMode = browserMode?.checked ?? true;

  state.isDetecting = true;
  if (progressSection) progressSection.classList.remove("is-hidden");
  if (progressLog) progressLog.innerHTML = "";

  const modeText = useBrowserMode ? "浏览器模式" : "后台模式";
  const batchText = repeatCount > 1 ? `批量检测（${repeatCount}次）` : "单次检测";
  const projectText = isAllProjects ? "全部项目" : `${selectedProjectIds.length}个项目`;
  setStatus(`正在启动${batchText}（${modeText}）...`, "is-processing");
  addLogEntry(`开始${batchText}，长尾词数量: ${keywords.length}，平台: ${platforms.join(", ")}，项目: ${projectText}，模式: ${modeText}`);
  renderView();

  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/detect`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, platforms, brands: filteredBrands, browserMode: useBrowserMode, repeatCount }),
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
        : error.message || "检测失败";
    setStatus(message, "is-error");
    addLogEntry(`错误: ${message}`, "is-error");
  } finally {
    state.isDetecting = false;
    renderView();
  }
}

function handleStreamEvent(event) {
  switch (event.type) {
    case "log":
      addLogEntry(event.message, event.level === "error" ? "is-error" : event.level === "success" ? "is-success" : "");
      break;

    case "progress":
      updateProgress(event.platform, event.status, event.percent || 0);
      break;

    case "report":
      // 更新或添加报告
      const existingIndex = state.reports.findIndex(
        (r) => r.date === event.report.date && r.keyword === event.report.keyword && r.platform === event.report.platform
      );
      if (existingIndex >= 0) {
        state.reports[existingIndex] = event.report;
      } else {
        state.reports.unshift(event.report);
      }
      renderReports();
      break;

    case "complete":
      setStatus(`检测完成！共处理 ${event.total} 个平台`, "is-success");
      addLogEntry("检测完成", "is-success");
      break;

    case "error":
      setStatus(event.message, "is-error");
      addLogEntry(`错误: ${event.message}`, "is-error");
      break;
  }
}

async function loadBootstrap() {
  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/bootstrap`));
    if (!response.ok) return;

    const payload = await readResponsePayload(response);
    state.projects = payload.projects || [];
    state.brands = payload.brands || [];
    state.reports = payload.reports || [];
    renderView();
  } catch {
    // 保持页面可用
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

async function verifyPluginApi() {
  try {
    const response = await fetch(apiUrl(`/api/plugins/${PLUGIN_ID}/health`), { cache: "no-store" });
    if (response.ok) return true;

    if (response.status === 404) {
      setStatus("此插件页面比本地服务版本更新，请重启 127.0.0.1:3100 服务后再使用", "is-error");
      return false;
    }

    setStatus(`插件 API 检查失败 (${response.status})`, "is-error");
    return false;
  } catch {
    setStatus("无法连接本地服务 (127.0.0.1:3100)，请确保服务正在运行", "is-error");
    return false;
  }
}

function init() {
  const { brandInput, addBrandBtn, addProjectBtn, projectInput, startDetectBtn, batchDetectBtn, batchOptions, repeatCount, reportFilterKeyword, reportFilterPlatform } = elements();

  // 项目相关
  if (addProjectBtn) {
    addProjectBtn.addEventListener("click", addProject);
  }

  if (projectInput) {
    projectInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") addProject();
    });
  }

  // 品牌词相关
  if (addBrandBtn) {
    addBrandBtn.addEventListener("click", addBrand);
  }

  if (brandInput) {
    brandInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") addBrand();
    });
  }

  // 检测相关
  if (startDetectBtn) {
    startDetectBtn.addEventListener("click", () => startDetection(1));
  }

  if (batchDetectBtn) {
    batchDetectBtn.addEventListener("click", () => {
      // 切换批量选项显示
      if (batchOptions) {
        batchOptions.classList.toggle("is-hidden");
      }
    });
  }

  // 批量检测确认
  const confirmBatchBtn = document.getElementById("confirmBatchBtn");
  if (confirmBatchBtn) {
    confirmBatchBtn.addEventListener("click", () => {
      const count = parseInt(repeatCount?.value, 10) || 5;
      startDetection(count);
    });
  }

  if (reportFilterKeyword) {
    reportFilterKeyword.addEventListener("input", renderReports);
  }

  if (reportFilterProject) {
    reportFilterProject.addEventListener("change", renderReports);
  }

  if (reportFilterPlatform) {
    reportFilterPlatform.addEventListener("change", renderReports);
  }

  // 绑定导出和全部删除按钮
  const exportBtn = document.getElementById("exportReportsBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportReports);
  }

  const deleteAllBtn = document.getElementById("deleteAllReportsBtn");
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener("click", deleteAllReports);
  }

  renderView();
  void loadPluginMeta();
  void verifyPluginApi();
  void loadBootstrap();

  // 页面刷新/关闭时停止检测任务
  window.addEventListener("beforeunload", () => {
    if (state.isDetecting) {
      // 使用 sendBeacon 确保请求被发送
      navigator.sendBeacon(apiUrl(`/api/plugins/${PLUGIN_ID}/stop`));
    }
  });
}

init();
