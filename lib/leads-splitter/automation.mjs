import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const DEFAULT_SOURCE = "s";
const DEFAULT_EXPORT_BASE_URL = "https://www.dellemc-solution.com/admin/intent_form/getIntentData";
const DEFAULT_STABLE_WINDOW_MS = 4000;
const DEFAULT_LOGIN_SETTLE_MS = 1200;
const DEFAULT_STEP_DELAY_MS = 600;

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function parseDateInput(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = String(value).trim().replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cloneDate(date) {
  return new Date(date.getTime());
}

function resolveCycleEndAt(now, anchorHour) {
  const current = cloneDate(now);
  const anchoredToday = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    anchorHour,
    0,
    0,
    0,
  );

  if (current >= anchoredToday) {
    return anchoredToday;
  }

  anchoredToday.setDate(anchoredToday.getDate() - 1);
  return anchoredToday;
}

function buildIntentDownloadUrl({ startAt, endAt, source = DEFAULT_SOURCE, exportBaseUrl = DEFAULT_EXPORT_BASE_URL }) {
  const target = new URL(exportBaseUrl);
  target.searchParams.set("export", "true");
  target.searchParams.set("source", source);
  target.searchParams.set("d", `${formatDateTime(startAt)} 到 ${formatDateTime(endAt)}`);
  target.searchParams.set("utmSource", "");
  target.searchParams.set("withOutT", "false");
  return target.toString();
}

async function ensureDirectoryExists(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function waitForStableSize(filePath, stableWindowMs) {
  const first = await fs.stat(filePath);
  await new Promise((resolve) => setTimeout(resolve, stableWindowMs));
  const second = await fs.stat(filePath);
  return first.size === second.size;
}

function sanitizeFileName(fileName) {
  return String(fileName || "intent-data-download").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
}

async function readState(statePath) {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeState(statePath, state) {
  await ensureDirectoryExists(path.dirname(statePath));
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function pause(page, ms = DEFAULT_STEP_DELAY_MS) {
  await page.waitForTimeout(ms);
}

async function isLoginPage(page) {
  const emailField = page.locator('input[ng-model="login.email"]');
  return emailField.isVisible().catch(() => false);
}

async function waitForLoginFormReady(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const emailField = page.locator('input[ng-model="login.email"]');
  const passwordField = page.locator('input[ng-model="login.pwd"]');
  const submitButton = page.locator('input[ng-click="login.submit()"]');

  await emailField.waitFor({ state: "visible", timeout: 20000 });
  await passwordField.waitFor({ state: "visible", timeout: 20000 });
  await submitButton.waitFor({ state: "visible", timeout: 20000 });

  await page.waitForFunction(
    () => {
      const email = document.querySelector('input[ng-model="login.email"]');
      const password = document.querySelector('input[ng-model="login.pwd"]');
      const button = document.querySelector('input[ng-click="login.submit()"]');
      return Boolean(email && password && button && !email.disabled && !password.disabled && !button.disabled);
    },
    null,
    { timeout: 20000 },
  );
}

async function submitPortalLogin(page, auth) {
  const emailField = page.locator('input[ng-model="login.email"]');
  const passwordField = page.locator('input[ng-model="login.pwd"]');
  const submitButton = page.locator('input[ng-click="login.submit()"]');

  await waitForLoginFormReady(page);
  await pause(page);
  await emailField.fill(String(auth.username));
  await pause(page);
  await passwordField.fill(String(auth.password));
  await pause(page);

  const loginResponsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/content/account/login") &&
        response.request().method() === "POST",
      { timeout: 20000 },
    )
    .catch(() => null);

  await submitButton.click();
  await loginResponsePromise;
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(DEFAULT_LOGIN_SETTLE_MS);
}

function buildLoginUrlWithJump(loginUrl, jumpUrl) {
  const target = new URL(loginUrl);
  target.searchParams.set("jumpUrl", jumpUrl);
  return target.toString();
}

function resolveFileNameFromHeaders(headers) {
  const contentDisposition = headers["content-disposition"] || "";
  const encodedMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return sanitizeFileName(decodeURIComponent(encodedMatch[1]));
  }

  const plainMatch = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return sanitizeFileName(plainMatch[1]);
  }

  return null;
}

async function exportIntentDataWithSession(context, url, destinationDir) {
  const cookieHeader = (await context.cookies())
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const response = await context.request.get(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    throw new Error(`导出请求失败，状态 ${response.status()}`);
  }

  const headers = response.headers();
  const contentType = String(headers["content-type"] || "").toLowerCase();
  const fileName =
    resolveFileNameFromHeaders(headers) ||
    sanitizeFileName(`leads_form_by_${new Date().toISOString().slice(0, 10)}.csv`);

  if (!contentType.includes("csv") && !contentType.includes("excel") && !headers["content-disposition"]) {
    const preview = (await response.text()).slice(0, 120);
    throw new Error(`导出接口未返回文件内容：${preview}`);
  }

  const destinationPath = path.join(destinationDir, fileName);
  await fs.rm(destinationPath, { force: true });
  await fs.writeFile(destinationPath, Buffer.from(await response.body()));
  return destinationPath;
}

async function downloadIntentDataFile({ url, destinationDir, auth, browserOptions = {}, stableWindowMs = DEFAULT_STABLE_WINDOW_MS }) {
  if (!auth?.username || !auth?.password) {
    throw new Error("缺少下载门户账号或密码配置");
  }

  await ensureDirectoryExists(destinationDir);

  const browser = await chromium.launch({
    headless: browserOptions.headless ?? true,
    slowMo: browserOptions.slowMoMs ?? 120,
  });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    if (!auth.loginUrl) {
      throw new Error("缺少下载门户登录地址配置");
    }

    await page.goto(buildLoginUrlWithJump(auth.loginUrl, url), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await submitPortalLogin(page, auth);
    await pause(page);

    const destinationPath = await exportIntentDataWithSession(context, url, destinationDir);
    const suggestedFilename = path.basename(destinationPath);

    if (!(await waitForStableSize(destinationPath, stableWindowMs))) {
      throw new Error("下载文件大小未稳定，可能尚未写入完成");
    }

    const stats = await fs.stat(destinationPath);
    return {
      filePath: destinationPath,
      fileName: suggestedFilename,
      fileSize: stats.size,
      url,
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export async function getLeadsSplitterAutomationStatus({
  statePath,
  now = new Date(),
  cycleAnchorHour = 11,
}) {
  const state = await readState(statePath);
  const nextEndAt = resolveCycleEndAt(now, cycleAnchorHour);
  return {
    lastSuccessfulStartAt: state.lastSuccessfulStartAt || null,
    lastSuccessfulEndAt: state.lastSuccessfulEndAt || null,
    lastDownloadedFileName: state.lastDownloadedFileName || null,
    lastDownloadedAt: state.lastDownloadedAt || null,
    lastResult: state.lastResult || null,
    history: Array.isArray(state.history) ? state.history : [],
    nextSuggestedEndAt: nextEndAt.toISOString(),
  };
}

export async function resolveLeadsSplitterCycleWindow({
  statePath,
  startAt,
  endAt,
  now = new Date(),
  cycleAnchorHour = 11,
}) {
  const state = await readState(statePath);
  const resolvedEndAt = parseDateInput(endAt) ?? resolveCycleEndAt(now, cycleAnchorHour);
  const resolvedStartAt =
    parseDateInput(startAt) ??
    parseDateInput(state.lastSuccessfulEndAt) ??
    new Date(resolvedEndAt.getTime() - 24 * 60 * 60 * 1000);

  return {
    state,
    period: {
      startAt: resolvedStartAt.toISOString(),
      endAt: resolvedEndAt.toISOString(),
      source: parseDateInput(startAt)
        ? "request"
        : parseDateInput(state.lastSuccessfulEndAt)
          ? "state"
          : "fallback_previous_day",
    },
  };
}

export async function runLeadsSplitterDownloadCycle({
  statePath,
  destinationDir,
  auth,
  startAt,
  endAt,
  now = new Date(),
  cycleAnchorHour = 11,
  source = DEFAULT_SOURCE,
  exportBaseUrl = DEFAULT_EXPORT_BASE_URL,
  browserOptions,
  stableWindowMs = DEFAULT_STABLE_WINDOW_MS,
}) {
  const { state, period } = await resolveLeadsSplitterCycleWindow({
    statePath,
    startAt,
    endAt,
    now,
    cycleAnchorHour,
  });
  const resolvedStartAt = new Date(period.startAt);
  const resolvedEndAt = new Date(period.endAt);

  if (!(resolvedStartAt < resolvedEndAt)) {
    throw new Error("执行周期不合法：开始时间必须早于结束时间");
  }

  const downloadUrl = buildIntentDownloadUrl({
    startAt: resolvedStartAt,
    endAt: resolvedEndAt,
    source,
    exportBaseUrl,
  });

  const download = await downloadIntentDataFile({
    url: downloadUrl,
    destinationDir,
    auth,
    browserOptions,
    stableWindowMs,
  });

  return {
    state,
    period,
    download,
    async markSuccess(extraState = {}) {
      const historyEntry = {
        runAt: new Date().toISOString(),
        period: {
          startAt: resolvedStartAt.toISOString(),
          endAt: resolvedEndAt.toISOString(),
        },
        download: {
          fileName: download.fileName,
          filePath: download.filePath,
          fileSize: download.fileSize,
          url: download.url,
        },
        result: extraState.lastResult || null,
      };
      const previousHistory = Array.isArray(state.history) ? state.history : [];
      const nextState = {
        lastSuccessfulStartAt: resolvedStartAt.toISOString(),
        lastSuccessfulEndAt: resolvedEndAt.toISOString(),
        lastDownloadedFileName: download.fileName,
        lastDownloadedAt: new Date().toISOString(),
        history: [historyEntry, ...previousHistory].slice(0, 10),
        ...extraState,
      };
      await writeState(statePath, nextState);
      return nextState;
    },
  };
}
