const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { spawn } = require("child_process");
const XLSX = require("xlsx");

function createOpportunityMasterService(options = {}) {
  const root = options.root || path.join(__dirname, "..", "..");
  const pluginId = "opportunity-master";
  const dataDir = options.dataDir || path.join(root, "data", pluginId);
  const uploadsDir = path.join(dataDir, "uploads");
  const workspacesDir = path.join(dataDir, "workspaces");
  const outputsDir = path.join(dataDir, "outputs");
  const runtimeDir = path.join(dataDir, "runtime");
  const workspacePath = path.join(workspacesDir, "current-workspace.json");
  const lastBuildPath = path.join(runtimeDir, "last-build.json");
  const mappingTablePath = options.mappingTablePath || path.join(dataDir, "映射表.xlsx");
  const channelMappingPath = options.channelMappingPath || path.join(dataDir, "渠道映射.xlsx");
  const scriptPath = options.scriptPath || path.join(root, "scripts", "opportunity_master.py");

  async function ensureDirs() {
    await Promise.all([
      fsp.mkdir(uploadsDir, { recursive: true }),
      fsp.mkdir(workspacesDir, { recursive: true }),
      fsp.mkdir(outputsDir, { recursive: true }),
      fsp.mkdir(runtimeDir, { recursive: true }),
    ]);
  }

  async function fileExists(targetPath) {
    try {
      await fsp.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async function readJson(targetPath, fallback) {
    try {
      const raw = await fsp.readFile(targetPath, "utf8");
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  async function writeJson(targetPath, value) {
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  function sanitizeFilename(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeSheetName(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  function normalizeCell(value) {
    return String(value || "").replace(/\s+/g, "").trim();
  }

  function readWorkbookPreview(filePath) {
    return XLSX.readFile(filePath, {
      cellDates: true,
      dense: false,
      codepage: 65001,
    });
  }

  function getSheetPreviewRows(workbook, sheetName, rowLimit = 3) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return [];
    }

    return XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
      range: 0,
    }).slice(0, rowLimit);
  }

  function detectChatLayoutFromRows(rows) {
    return (
      normalizeCell(rows[0]?.[0]) === "MKTID" ||
      normalizeCell(rows[1]?.[1]) === "MKTID"
    );
  }

  function detectPhone400LayoutFromRows(rows) {
    return (
      normalizeCell(rows[0]?.[0]) === "媒体来源" ||
      normalizeCell(rows[1]?.[0]) === "媒体来源"
    );
  }

  function detectOrderHeadersFromRows(rows) {
    const headerRow = rows[0] || [];
    const normalized = new Set(headerRow.map((cell) => normalizeCell(cell)));
    return normalized.has("订单编号") && normalized.has("utm参数");
  }

  function detectCombinedChatPhoneHeadersFromRows(rows) {
    const headerRow = rows[0] || [];
    const normalized = new Set(headerRow.map((cell) => normalizeCell(cell)));
    return (
      normalized.has("数据来源") &&
      normalized.has("CallDate") &&
      normalized.has("CallWk") &&
      normalized.has("CallQuarter") &&
      normalized.has("CallType") &&
      normalized.has("RemarkType") &&
      normalized.has("DellSalesforceAccountID") &&
      normalized.has("广告来源(utm_source)")
    );
  }

  function detectSfdcSignalHeadersFromRows(rows) {
    const headerRow = rows[0] || [];
    const normalized = new Set(headerRow.map((cell) => normalizeCell(cell).toLowerCase()));
    return (
      normalized.has("mobile") &&
      normalized.has("email") &&
      normalized.has("call_type")
    );
  }

  function detectSourceForWorkbook(filePath, originalFilename = "") {
    const workbook = readWorkbookPreview(filePath);
    const sheetNames = workbook.SheetNames || [];
    const normalizedSheetNames = new Map(sheetNames.map((sheetName) => [normalizeSheetName(sheetName), sheetName]));
    const filename = String(originalFilename || path.basename(filePath)).toLowerCase();

    if (normalizedSheetNames.has(normalizeSheetName("FY27Q2数据明细-唯一"))) {
      return { detectedSource: "website_q2", detectedBy: "sheet: FY27Q2数据明细-唯一", sheetNames };
    }

    if (normalizedSheetNames.has(normalizeSheetName("FY27Q1数据明细-唯一"))) {
      return { detectedSource: "website_q1", detectedBy: "sheet: FY27Q1数据明细-唯一", sheetNames };
    }

    if (normalizedSheetNames.has(normalizeSheetName("FY26Q4数据明细-周报用唯一"))) {
      return { detectedSource: "website_fy26q4_weekly", detectedBy: "sheet: FY26Q4数据明细-周报用唯一", sheetNames };
    }

    if (
      normalizedSheetNames.has(normalizeSheetName("数据明细")) &&
      normalizedSheetNames.has(normalizeSheetName("腾讯数据"))
    ) {
      return { detectedSource: "website_fy26q3_combined", detectedBy: "sheets: 数据明细 + 腾讯数据", sheetNames };
    }

    if (normalizedSheetNames.has(normalizeSheetName("Sino外呼数据明细"))) {
      return { detectedSource: "website_fy26q2_sino", detectedBy: "sheet: Sino外呼数据明细", sheetNames };
    }

    if (normalizedSheetNames.has(normalizeSheetName("orders"))) {
      return { detectedSource: "order", detectedBy: "sheet: orders", sheetNames };
    }

    const sheet1 = normalizedSheetNames.get("sheet1") || sheetNames[0];
    const previewRows = getSheetPreviewRows(workbook, sheet1, 3);

    if (detectSfdcSignalHeadersFromRows(previewRows)) {
      return { detectedSource: "sfdc_signal_mapping", detectedBy: "sheet1 sfdc signal headers", sheetNames };
    }

    if (detectCombinedChatPhoneHeadersFromRows(previewRows)) {
      return { detectedSource: "chat_phone_combined", detectedBy: "sheet1 combined headers", sheetNames };
    }

    if (filename.includes("订单")) {
      const rows = getSheetPreviewRows(workbook, sheetNames[0], 2);
      if (detectOrderHeadersFromRows(rows)) {
        return { detectedSource: "order", detectedBy: "filename + headers", sheetNames };
      }
    }

    if (detectPhone400LayoutFromRows(previewRows) || (filename.includes("400") && filename.includes("客服"))) {
      return { detectedSource: "phone_400", detectedBy: "sheet1 layout", sheetNames };
    }

    if (detectChatLayoutFromRows(previewRows) || (filename.includes("客服数据明细") && !filename.includes("400"))) {
      return { detectedSource: "chat", detectedBy: "sheet1 layout", sheetNames };
    }

    return { detectedSource: "unknown", detectedBy: "未识别到支持的 sheet / headers", sheetNames };
  }

  function summarizeWorkspace(workspace) {
    const files = Array.isArray(workspace.files) ? workspace.files : [];
    const summary = {
      totalFiles: files.length,
      readyFiles: 0,
      unknownFiles: 0,
      missingFiles: 0,
      sourceBreakdown: {},
    };

    for (const entry of files) {
      if (entry.status === "ready") {
        summary.readyFiles += 1;
      } else if (entry.status === "missing") {
        summary.missingFiles += 1;
      } else {
        summary.unknownFiles += 1;
      }

      const key = entry.detectedSource || "unknown";
      summary.sourceBreakdown[key] = (summary.sourceBreakdown[key] || 0) + 1;
    }

    return summary;
  }

  async function loadWorkspace() {
    await ensureDirs();
    const workspace = await readJson(workspacePath, {
      pluginId,
      files: [],
      updatedAt: null,
    });
    const files = Array.isArray(workspace.files) ? workspace.files : [];
    let mutated = false;

    for (const file of files) {
      if (!(await fileExists(file.storedPath))) {
        if (file.status !== "missing") {
          file.status = "missing";
          mutated = true;
        }
      }
    }

    if (mutated) {
      workspace.updatedAt = new Date().toISOString();
      await writeJson(workspacePath, workspace);
    }

    return workspace;
  }

  async function saveWorkspace(workspace) {
    workspace.updatedAt = new Date().toISOString();
    await writeJson(workspacePath, workspace);
    return workspace;
  }

  async function getBootstrapData() {
    const [workspace, lastBuild] = await Promise.all([
      loadWorkspace(),
      readJson(lastBuildPath, null),
    ]);

    return {
      plugin: pluginId,
      assets: {
        mappingTableExists: await fileExists(mappingTablePath),
        channelMappingExists: await fileExists(channelMappingPath),
        mappingTablePath,
        channelMappingPath,
      },
      workspace: {
        ...workspace,
        summary: summarizeWorkspace(workspace),
      },
      buildResult: lastBuild,
      supportedSources: [
        "website_q2",
        "website_q1",
        "website_fy26q4_weekly",
        "website_fy26q3_combined",
        "website_fy26q2_sino",
        "chat",
        "chat_phone_combined",
        "phone_400",
        "order",
        "sfdc_signal_mapping",
      ],
    };
  }

  async function importUploadedFile(tempPath, originalFilename) {
    await ensureDirs();
    const workspace = await loadWorkspace();
    const safeFilename = sanitizeFilename(originalFilename || path.basename(tempPath) || `upload-${Date.now()}.xlsx`);
    const id = `file-${Date.now()}-${randomUUID()}`;
    const storedFilename = `${id}-${safeFilename}`;
    const storedPath = path.join(uploadsDir, storedFilename);

    await fsp.copyFile(tempPath, storedPath);
    const stat = await fsp.stat(storedPath);
    const detection = detectSourceForWorkbook(storedPath, safeFilename);
    const status = detection.detectedSource === "unknown" ? "unknown" : "ready";

    workspace.files.push({
      id,
      filename: safeFilename,
      storedFilename,
      storedPath,
      size: stat.size,
      uploadedAt: stat.mtime.toISOString(),
      detectedSource: detection.detectedSource,
      detectedBy: detection.detectedBy,
      status,
      sheetNames: detection.sheetNames,
    });

    await saveWorkspace(workspace);
    return {
      importedFile: workspace.files[workspace.files.length - 1],
      workspace: {
        ...workspace,
        summary: summarizeWorkspace(workspace),
      },
    };
  }

  async function removeWorkspaceFile(fileId) {
    const workspace = await loadWorkspace();
    const index = workspace.files.findIndex((item) => item.id === fileId);
    if (index < 0) {
      throw new Error("未找到要删除的文件");
    }

    const [removed] = workspace.files.splice(index, 1);
    if (removed?.storedPath) {
      await fsp.unlink(removed.storedPath).catch(() => {});
    }

    await saveWorkspace(workspace);
    return {
      removed,
      workspace: {
        ...workspace,
        summary: summarizeWorkspace(workspace),
      },
    };
  }

  function buildPythonArgs(workspace, runLabel = "") {
    const args = [
      scriptPath,
      "--mapping-table",
      mappingTablePath,
      "--channel-mapping",
      channelMappingPath,
      "--output-dir",
      outputsDir,
    ];

    if (runLabel) {
      args.push("--run-label", runLabel);
    }

    const flagMap = {
      website_q2: "--website-q2-file",
      website_q1: "--website-q1-file",
      website_fy26q4_weekly: "--website-fy26q4-weekly-file",
      website_fy26q3_combined: "--website-fy26q3-combined-file",
      website_fy26q2_sino: "--website-fy26q2-sino-file",
      chat: "--chat-file",
      chat_phone_combined: "--chat-phone-combined-file",
      phone_400: "--phone-400-file",
      order: "--order-file",
      sfdc_signal_mapping: "--sfdc-signal-file",
    };

    for (const file of workspace.files) {
      if (file.status !== "ready" || !flagMap[file.detectedSource]) {
        continue;
      }
      args.push(flagMap[file.detectedSource], file.storedPath);
    }

    return args;
  }

  async function buildWorkspace(runLabel = "") {
    await ensureDirs();
    if (!(await fileExists(mappingTablePath))) {
      throw new Error("映射表不存在，无法生成终极表");
    }
    if (!(await fileExists(channelMappingPath))) {
      throw new Error("渠道映射表不存在，无法生成终极表");
    }

    const workspace = await loadWorkspace();
    const readyFiles = workspace.files.filter((item) => item.status === "ready");
    const buildInputFiles = readyFiles.filter((item) => item.detectedSource !== "sfdc_signal_mapping");
    if (!buildInputFiles.length) {
      throw new Error("当前工作区没有可用于构建的已识别文件");
    }

    const args = buildPythonArgs(workspace, runLabel);
    const result = await new Promise((resolve, reject) => {
      const child = spawn("python3", args, {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });

      child.once("error", reject);
      child.once("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || "终极表生成失败"));
          return;
        }

        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("终极表结果解析失败"));
        }
      });
    });

    const buildResult = {
      ...result,
      builtAt: new Date().toISOString(),
    };
    await writeJson(lastBuildPath, buildResult);

    return {
      workspace: {
        ...workspace,
        summary: summarizeWorkspace(workspace),
      },
      buildResult,
    };
  }

  function resolveDownloadTarget(filename) {
    const normalized = path.basename(String(filename || "").trim());
    if (!normalized) {
      throw new Error("缺少下载文件名");
    }

    const targetPath = path.join(outputsDir, normalized);
    if (!fs.existsSync(targetPath)) {
      const nestedMatch = findOutputFileByName(normalized);
      if (!nestedMatch) {
        throw new Error("文件不存在");
      }
      return nestedMatch;
    }
    return targetPath;
  }

  function findOutputFileByName(filename) {
    const firstLevel = fs.existsSync(outputsDir) ? fs.readdirSync(outputsDir, { withFileTypes: true }) : [];
    for (const entry of firstLevel) {
      if (entry.isFile() && entry.name === filename) {
        return path.join(outputsDir, entry.name);
      }
      if (!entry.isDirectory()) {
        continue;
      }
      const nestedDir = path.join(outputsDir, entry.name);
      const nestedEntries = fs.readdirSync(nestedDir, { withFileTypes: true });
      for (const nested of nestedEntries) {
        if (nested.isFile() && nested.name === filename) {
          return path.join(nestedDir, nested.name);
        }
      }
    }
    return "";
  }

  return {
    createOpportunityMasterService,
    ensureDirs,
    getBootstrapData,
    importUploadedFile,
    removeWorkspaceFile,
    buildWorkspace,
    resolveDownloadTarget,
    detectSourceForWorkbook,
    paths: {
      dataDir,
      uploadsDir,
      workspacesDir,
      outputsDir,
      runtimeDir,
      mappingTablePath,
      channelMappingPath,
      scriptPath,
    },
  };
}

module.exports = createOpportunityMasterService();
module.exports.createOpportunityMasterService = createOpportunityMasterService;
