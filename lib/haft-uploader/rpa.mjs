import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { SCREENSHOT_DIR, TRACE_DIR } from "./paths.mjs";
const STEP_DELAY_MS = 1000;
const TYPE_DELAY_MS = 90;
const UPLOAD_POLL_MS = 1000;
const UPLOAD_TIMEOUT_MS = 120_000;
const REQUIRED_STABLE_POLLS = 3;

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatTodayToken(date = new Date()) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

async function createTraceLogger(taskId) {
  await fs.mkdir(TRACE_DIR, { recursive: true });
  const tracePath = path.join(TRACE_DIR, `${taskId}-${Date.now()}.log`);

  async function write(event, payload = {}) {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...payload,
    });
    await fs.appendFile(tracePath, `${line}\n`, "utf8");
  }

  return {
    tracePath,
    write,
  };
}

async function startKeepAlive(page) {
  const intervalId = setInterval(() => {
    page.mouse.wheel(0, 200).catch(() => undefined);
  }, 10_000);

  return async () => {
    clearInterval(intervalId);
  };
}

async function pauseBetweenSteps(page, ms = STEP_DELAY_MS) {
  await page.waitForTimeout(ms);
}

async function typeLikeHuman(locator, value) {
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  await locator.click();
  await locator.fill("");
  await locator.pressSequentially(value, { delay: TYPE_DELAY_MS });
}

async function waitForLoginPageReady(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForFunction(() => document.readyState === "complete", null, {
    timeout: 15_000,
  });

  const userInput = page.locator("#userIDInput");
  const passwordInput = page.locator("#passwordInput");
  const loginButton = page.locator("#loginButon");

  await userInput.waitFor({ state: "visible", timeout: 15_000 });
  await passwordInput.waitFor({ state: "visible", timeout: 15_000 });
  await loginButton.waitFor({ state: "visible", timeout: 15_000 });

  await page.waitForFunction(
    () => {
      const user = document.querySelector("#userIDInput");
      const password = document.querySelector("#passwordInput");
      const button = document.querySelector("#loginButon");

      return Boolean(
        user &&
          password &&
          button &&
          !user.disabled &&
          !password.disabled &&
          !button.disabled,
      );
    },
    null,
    { timeout: 15_000 },
  );
}

async function clickFolder(page, folderName) {
  const escaped = escapeForRegex(folderName);
  const folderRow = page.getByRole("option", {
    name: new RegExp(`^${escaped}[,\\s]`, "i"),
  });

  await folderRow.first().waitFor({ state: "visible", timeout: 15_000 });
  await folderRow.first().dblclick();
  await pauseBetweenSteps(page);
}

async function waitForFileVisible(page, fileName) {
  const escaped = escapeForRegex(fileName);
  const row = page.getByRole("option", {
    name: new RegExp(escaped, "i"),
  });

  await row.first().waitFor({ state: "visible", timeout: 60_000 });
}

async function captureRowSnapshot(page, fileNames) {
  return page.evaluate((names) => {
    const targetNames = new Set(names);
    const rows = Array.from(document.querySelectorAll('[role="option"]'));
    const snapshot = {};

    for (const row of rows) {
      const name =
        row.querySelector(".name-text span")?.textContent?.trim() ??
        row.textContent?.trim() ??
        "";

      if (!targetNames.has(name)) {
        continue;
      }

      const dateText = row.querySelector(".date-data")?.textContent?.trim() ?? "";
      const sizeText = row.querySelector(".size-data")?.textContent?.trim() ?? "";
      const ariaLabel = row.getAttribute("aria-label") ?? "";
      const signature = [name, row.id ?? "", dateText, sizeText, ariaLabel].join("||");

      snapshot[name] ??= [];
      snapshot[name].push(signature);
    }

    return snapshot;
  }, fileNames);
}

async function captureUploadState(page, fileNames, beforeSnapshot, todayToken) {
  return page.evaluate(
    ({ names, before, today }) => {
      const rows = Array.from(document.querySelectorAll('[role="option"]'));
      const result = {};

      for (const name of names) {
        const matchedRows = rows
          .filter((candidate) => {
            const rowText = candidate.textContent ?? "";
            const dateText =
              candidate.querySelector(".date-data")?.textContent?.trim() ??
              candidate.getAttribute("aria-label") ??
              "";
            const sizeText = candidate.querySelector(".size-data")?.textContent?.trim() ?? "";
            const ariaLabel = candidate.getAttribute("aria-label") ?? "";
            const signature = [name, candidate.id ?? "", dateText, sizeText, ariaLabel].join("||");
            const existedBefore = (before[name] ?? []).includes(signature);

            return rowText.includes(name) && dateText.includes(today) && !existedBefore;
          })
          .map((row) => {
            const dateText =
              row.querySelector(".date-data")?.textContent?.trim() ??
              row.getAttribute("aria-label") ??
              "";
            const sizeText = row.querySelector(".size-data")?.textContent?.trim() ?? "";
            const progressBar = row.querySelector('[role="progressbar"]');

            return {
              rowId: row.id ?? "",
              dateText,
              sizeText,
              progressHidden: progressBar?.getAttribute("aria-hidden") ?? "missing",
              progressNow: progressBar?.getAttribute("aria-valuenow") ?? "missing",
              ariaBusy: row.getAttribute("aria-busy") ?? "",
              ariaSelected: row.getAttribute("aria-selected") ?? "",
            };
          });

        result[name] = {
          total: matchedRows.length,
          uploading: matchedRows.filter((row) => row.progressHidden === "false").length,
          finished: matchedRows.filter((row) => row.progressHidden === "true").length,
          rows: matchedRows,
        };
      }

      return result;
    },
    { names: fileNames, before: beforeSnapshot, today: todayToken },
  );
}

function isUploadComplete(uploadState, fileNames) {
  return fileNames.every((name) => {
    const status = uploadState[name];
    return Boolean(status) && status.total > 0 && status.uploading === 0 && status.finished > 0;
  });
}

async function waitForUploadCompletion(page, fileNames, beforeSnapshot, trace) {
  const todayToken = formatTodayToken();
  const startedAt = Date.now();
  let stablePolls = 0;
  let lastSignature = "";

  await trace.write("upload_wait_started", {
    fileNames,
    todayToken,
    beforeSnapshot,
  });

  while (Date.now() - startedAt < UPLOAD_TIMEOUT_MS) {
    const uploadState = await captureUploadState(page, fileNames, beforeSnapshot, todayToken);
    const signature = JSON.stringify(uploadState);
    const completed = isUploadComplete(uploadState, fileNames);

    if (signature !== lastSignature) {
      await trace.write("upload_poll", {
        completed,
        stablePolls,
        uploadState,
      });
      lastSignature = signature;
    }

    if (completed) {
      stablePolls += 1;
      if (stablePolls >= REQUIRED_STABLE_POLLS) {
        await trace.write("upload_wait_completed", {
          stablePolls,
          uploadState,
        });
        return;
      }
    } else {
      stablePolls = 0;
    }

    await page.waitForTimeout(UPLOAD_POLL_MS);
  }

  const finalState = await captureUploadState(page, fileNames, beforeSnapshot, todayToken);
  await trace.write("upload_wait_timeout", {
    uploadState: finalState,
  });
  throw new Error(`Upload completion timeout. Trace: ${trace.tracePath}`);
}

export async function runUploadFlow({ loginUrl, account, task, files }) {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  const trace = await createTraceLogger(task.id);

  const browser = await chromium.launch({
    headless: task.browser?.headless ?? false,
    slowMo: task.browser?.slowMoMs ?? 200,
  });

  const context = await browser.newContext({
    acceptDownloads: true,
  });

  const page = await context.newPage();
  let stopKeepAlive = async () => undefined;

  try {
    await trace.write("task_started", {
      loginUrl,
      accountKey: account.key,
      fileNames: files.map((file) => file.name),
    });

    await page.goto(loginUrl, { waitUntil: "networkidle" });
    await waitForLoginPageReady(page);
    await pauseBetweenSteps(page);
    await trace.write("login_page_ready");

    await typeLikeHuman(page.locator("#userIDInput"), account.username);
    await pauseBetweenSteps(page);

    await typeLikeHuman(page.locator("#passwordInput"), account.password);
    await pauseBetweenSteps(page);

    await page.locator("#loginButon").click();
    await pauseBetweenSteps(page);
    await page.waitForLoadState("networkidle");
    await pauseBetweenSteps(page);
    await trace.write("login_submitted");

    for (const folderName of account.targetPath) {
      await clickFolder(page, folderName);
      await trace.write("folder_opened", { folderName });
    }

    const fileNames = files.map((file) => file.name);
    const beforeSnapshot = await captureRowSnapshot(page, fileNames);
    await trace.write("before_snapshot_captured", { beforeSnapshot });

    const uploadInput = page.locator('#allFiles_actions\\:\\:upload');
    await uploadInput.waitFor({ state: "attached", timeout: 15_000 });
    await pauseBetweenSteps(page);
    await uploadInput.setInputFiles(files.map((file) => file.path));
    await trace.write("upload_started");

    stopKeepAlive = await startKeepAlive(page);
    await waitForUploadCompletion(page, fileNames, beforeSnapshot, trace);
    await stopKeepAlive();
    await page.waitForTimeout(task.upload?.postUploadDelayMs ?? 3000);
    await trace.write("post_upload_delay_completed", {
      delayMs: task.upload?.postUploadDelayMs ?? 3000,
    });

    await browser.close();
    await trace.write("task_finished_success");

    return {
      ok: true,
      screenshotPath: null,
      tracePath: trace.tracePath,
    };
  } catch (error) {
    const screenshotPath = path.join(
      SCREENSHOT_DIR,
      `${task.id}-${Date.now()}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    await trace.write("task_failed", {
      errorMessage: error.message,
      screenshotPath,
    }).catch(() => undefined);
    await stopKeepAlive();
    await browser.close().catch(() => undefined);

    return {
      ok: false,
      screenshotPath,
      tracePath: trace.tracePath,
      error,
    };
  }
}
