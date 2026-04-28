import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

async function ensureDirectoryExists(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
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

async function fetchToFile(url, destinationPath) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`下载失败：${url}，状态 ${response.status} ${response.statusText}`);
  }

  if (response.url.includes("/tenant/login.html")) {
    throw new Error("AUTH_REQUIRED");
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  await fs.writeFile(destinationPath, bytes);
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
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const destinationPath = path.join(destinationDir, `${timestamp}-${suggestedName}`);
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

  for (const url of source.urls) {
    const fileName = extractFileNameFromUrl(url);
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const destinationPath = path.join(source.downloadDir, `${timestamp}-${fileName}`);

    try {
      await fetchToFile(url, destinationPath);
    } catch (error) {
      if (error.message !== "AUTH_REQUIRED") {
        throw error;
      }

      await downloadWithBrowser(url, source.downloadDir, appConfig?.downloadPortalAuth);
    }
  }

  return pickLatestEligibleFiles({
    task,
    directoryPath: source.downloadDir,
    requiredCount: source.requiredCount,
    stableWindowMs: source.stableWindowMs ?? 4000,
    store,
  });
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

function extractFileNameFromUrl(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts.at(-1) ?? "downloaded-file";
}
