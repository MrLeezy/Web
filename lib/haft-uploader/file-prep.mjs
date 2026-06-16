import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

async function ensureDirectoryExists(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function getFileStats(filePath) {
  const stats = await fs.stat(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    size: stats.size,
    birthtimeMs: stats.birthtimeMs,
    mtimeMs: stats.mtimeMs,
  };
}

async function listFilesWithStats(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const filePath = path.join(directoryPath, entry.name);
    const stats = await fs.stat(filePath);
    files.push({
      name: entry.name,
      path: filePath,
      size: stats.size,
      birthtimeMs: stats.birthtimeMs,
      mtimeMs: stats.mtimeMs,
    });
  }

  return files;
}

async function waitForStableSize(filePath, stableWindowMs) {
  const firstStat = await fs.stat(filePath);
  await new Promise((resolve) => setTimeout(resolve, stableWindowMs));
  const secondStat = await fs.stat(filePath);
  return firstStat.size === secondStat.size;
}

async function fetchToFile(url, destinationDir) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`下载失败：${url}，状态 ${response.status} ${response.statusText}`);
  }

  if (response.url.includes("/tenant/login.html")) {
    throw new Error("AUTH_REQUIRED");
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  const destinationPath = resolveDownloadDestinationPath(destinationDir, resolveDownloadFileName(url, response.headers));
  await fs.rm(destinationPath, { force: true });
  await fs.writeFile(destinationPath, bytes);
  return destinationPath;
}

async function downloadWithBrowser(url, destinationDir, downloadPortalAuth) {
  if (!downloadPortalAuth?.username || !downloadPortalAuth?.password) {
    throw new Error("accounts.local.json 缺少下载门户账号或密码");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    let download = await tryTriggerDownload(page, url);

    if (!download && (await isDownloadPortalLoginPage(page, downloadPortalAuth.loginUrl))) {
      await loginDownloadPortal(page, downloadPortalAuth);
      download = await tryTriggerDownload(page, url);
    }

    if (!download) {
      throw new Error(`无法从 ${url} 下载文件`);
    }

    const suggestedName = download.suggestedFilename() || extractFileNameFromUrl(url);
    const destinationPath = resolveDownloadDestinationPath(destinationDir, suggestedName);
    await fs.rm(destinationPath, { force: true });
    await download.saveAs(destinationPath);
    return destinationPath;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function tryTriggerDownload(page, url) {
  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 }).catch(() => null);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined);
  return downloadPromise;
}

async function isDownloadPortalLoginPage(page, expectedLoginUrl) {
  if (expectedLoginUrl && page.url().startsWith(expectedLoginUrl)) {
    return true;
  }

  const emailField = page.locator('input[ng-model="login.email"]');
  return emailField.isVisible().catch(() => false);
}

async function loginDownloadPortal(page, downloadPortalAuth) {
  const emailField = page.locator('input[ng-model="login.email"]');
  const passwordField = page.locator('input[ng-model="login.pwd"]');
  const submitButton = page.locator('input[ng-click="login.submit()"]');

  await emailField.waitFor({ state: "visible", timeout: 15_000 });
  await emailField.fill(downloadPortalAuth.username);
  await page.waitForTimeout(500);
  await passwordField.fill(downloadPortalAuth.password);
  await page.waitForTimeout(500);
  await submitButton.click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1000);
}

function sortByCreationTimeDesc(files) {
  return [...files].sort((left, right) => right.birthtimeMs - left.birthtimeMs);
}

export async function prepareFilesForTask(task, store, appConfig) {
  const source = task.fileSource;

  if (source.type === "directory") {
    return pickLatestEligibleFiles({
      task,
      directoryPath: source.directoryPath,
      requiredCount: source.requiredCount,
      stableWindowMs: source.stableWindowMs ?? 4000,
      store,
    });
  }

  await ensureDirectoryExists(source.downloadDir);
  const downloadedFiles = [];

  for (const rawUrl of source.urls) {
    const url = resolveTaskDownloadUrl(rawUrl, source);
    let downloadedPath;

    try {
      downloadedPath = await fetchToFile(url, source.downloadDir);
    } catch (error) {
      if (error.message !== "AUTH_REQUIRED") {
        throw error;
      }

      downloadedPath = await downloadWithBrowser(url, source.downloadDir, appConfig?.downloadPortalAuth);
    }

    downloadedFiles.push({
      ...(await getFileStats(downloadedPath)),
      tableName: extractTableNameFromUrl(url),
      sourceUrl: url,
    });
  }

  const prepared = await pickEligibleDownloadedFiles({
    task,
    files: downloadedFiles,
    requiredCount: source.requiredCount,
    stableWindowMs: source.stableWindowMs ?? 4000,
    store,
  });

  const digitalFile = prepared.stableFiles.find((file) => file.tableName === "digital");
  if (digitalFile && (await isDatasetEmpty(digitalFile.path))) {
    return {
      ...prepared,
      skipUpload: true,
      skipUploadReason: "digital 下载结果为空，本次任务已跳过上传流程。",
    };
  }

  return prepared;
}

async function pickLatestEligibleFiles({ task, directoryPath, requiredCount, stableWindowMs, store }) {
  await ensureDirectoryExists(directoryPath);

  const files = sortByCreationTimeDesc(await listFilesWithStats(directoryPath));
  const stableFiles = [];

  for (const file of files) {
    if (stableFiles.length >= requiredCount) break;
    if (await waitForStableSize(file.path, stableWindowMs)) {
      stableFiles.push(file);
    }
  }

  const deduplicated = stableFiles.filter(
    (file) => store.findPreviouslyUploaded(task.id, [file]).length === 0,
  );

  return {
    selectedFiles: deduplicated.slice(0, requiredCount),
    skippedFiles: stableFiles.filter((file) => !deduplicated.includes(file)),
  };
}

async function pickEligibleDownloadedFiles({ task, files, requiredCount, stableWindowMs, store }) {
  const stableFiles = [];

  for (const file of files) {
    if (await waitForStableSize(file.path, stableWindowMs)) {
      stableFiles.push(file);
    }
  }

  const deduplicated = stableFiles.filter(
    (file) => store.findPreviouslyUploaded(task.id, [file]).length === 0,
  );

  return {
    selectedFiles: deduplicated.slice(0, requiredCount),
    skippedFiles: stableFiles.filter((file) => !deduplicated.includes(file)),
    stableFiles,
  };
}

function resolveTaskDownloadUrl(rawUrl, source) {
  const parsed = new URL(rawUrl);
  const startValue = parsed.searchParams.get("start");
  const configuredStartDate = resolveConfiguredStartDate();

  if (parsed.searchParams.has("start") && (!startValue || !startValue.trim()) && configuredStartDate) {
    parsed.searchParams.set("start", configuredStartDate);
  }

  return parsed.toString();

  function resolveConfiguredStartDate() {
    if (source.downloadDateMode === "custom" && isDateInputValid(source.customStartDate)) {
      return source.customStartDate;
    }

    return formatRelativeDate(-1);
  }
}

function formatRelativeDate(dayOffset) {
  const target = new Date();
  target.setDate(target.getDate() + dayOffset);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateInputValid(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

function resolveDownloadDestinationPath(destinationDir, fileName) {
  return path.join(destinationDir, sanitizeFileName(fileName));
}

function sanitizeFileName(fileName) {
  return String(fileName || "downloaded-file").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
}

function resolveDownloadFileName(url, headers) {
  const contentDisposition = headers.get("content-disposition");
  const encodedMatch = contentDisposition?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }

  const plainMatch = contentDisposition?.match(/filename\s*=\s*"?([^\";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return extractFileNameFromUrl(url);
}

function extractFileNameFromUrl(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts.at(-1) ?? "downloaded-file";
}

function extractTableNameFromUrl(url) {
  const parsed = new URL(url);
  return String(parsed.searchParams.get("table") || "")
    .trim()
    .toLowerCase();
}

async function isDatasetEmpty(filePath) {
  const stats = await fs.stat(filePath);
  if (stats.size === 0) {
    return true;
  }

  const extension = path.extname(filePath).toLowerCase();
  if ([".csv", ".txt", ".tsv"].includes(extension)) {
    return isDelimitedTextEmpty(await fs.readFile(filePath, "utf8"));
  }

  if ([".xlsx", ".xls", ".xlsm"].includes(extension)) {
    return isWorkbookEmpty(await fs.readFile(filePath));
  }

  const buffer = await fs.readFile(filePath);
  const workbookEmpty = tryCheckWorkbookBuffer(buffer);
  if (workbookEmpty !== null) {
    return workbookEmpty;
  }

  if (looksLikeText(buffer)) {
    return isDelimitedTextEmpty(buffer.toString("utf8"));
  }

  return false;
}

function isDelimitedTextEmpty(rawText) {
  const rows = String(rawText)
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return true;
  }

  return rows.length <= 1;
}

function isWorkbookEmpty(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return workbook.SheetNames.every((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });

    const meaningfulRows = rows.filter((row) =>
      Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== ""),
    );

    return meaningfulRows.length <= 1;
  });
}

function tryCheckWorkbookBuffer(buffer) {
  try {
    return isWorkbookEmpty(buffer);
  } catch {
    return null;
  }
}

function looksLikeText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  return !sample.includes(0);
}
