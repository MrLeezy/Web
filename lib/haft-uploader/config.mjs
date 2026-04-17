import fs from "node:fs/promises";
import cron from "node-cron";
import { ACCOUNTS_FILE, TASKS_FILE, TASKS_EXAMPLE_FILE, PRIVATE_DIR, DOWNLOAD_DIR } from "./paths.mjs";

export async function loadAppConfig() {
  const tasksPath = await fileExists(TASKS_FILE) ? TASKS_FILE : TASKS_EXAMPLE_FILE;
  const accountsExists = await fileExists(ACCOUNTS_FILE);

  if (!accountsExists) {
    throw new Error(
      "Missing private/haft-uploader/accounts.local.json. Copy accounts.example.json and fill in the real passwords.",
    );
  }

  const [accountsRaw, tasksRaw] = await Promise.all([
    fs.readFile(ACCOUNTS_FILE, "utf8"),
    fs.readFile(tasksPath, "utf8"),
  ]);

  const accountsConfig = JSON.parse(accountsRaw);
  const tasksConfig = JSON.parse(tasksRaw);

  return {
    loginUrl: accountsConfig.loginUrl,
    accounts: accountsConfig.accounts,
    downloadPortalAuth: accountsConfig.downloadPortalAuth,
    tasks: tasksConfig.tasks,
  };
}

export async function saveTasks(tasks) {
  await fs.mkdir(PRIVATE_DIR, { recursive: true });
  await fs.writeFile(TASKS_FILE, JSON.stringify({ tasks }, null, 2));
}

export function getPublicAccounts(accounts) {
  return (accounts ?? []).map((account) => ({
    key: account.key,
    label: account.label,
    username: account.username,
    targetPath: account.targetPath,
    allowManualRun: account.allowManualRun !== false,
  }));
}

export function normalizeTaskInput(input, existingTaskId) {
  const fileSourceType = input?.fileSource?.type === "download" ? "download" : "directory";
  const name = String(input?.name ?? "").trim();
  const id =
    String(input?.id ?? existingTaskId ?? generateTaskId(name)).trim() || generateTaskId(name);
  const urls = Array.isArray(input?.fileSource?.urls)
    ? input.fileSource.urls
    : String(input?.fileSource?.urlsText ?? "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    id,
    name,
    enabled: Boolean(input?.enabled),
    schedule: String(input?.schedule ?? "").trim(),
    accountKey: String(input?.accountKey ?? "").trim(),
    fileSource: {
      type: fileSourceType,
      requiredCount: toPositiveInteger(input?.fileSource?.requiredCount, 1),
      stableWindowMs: toPositiveInteger(input?.fileSource?.stableWindowMs, 4000),
      directoryPath:
        fileSourceType === "directory"
          ? String(input?.fileSource?.directoryPath ?? "").trim()
          : undefined,
      downloadDir:
        fileSourceType === "download"
          ? String(input?.fileSource?.downloadDir ?? "").trim() || DOWNLOAD_DIR
          : undefined,
      urls: fileSourceType === "download" ? urls : undefined,
    },
    browser: {
      headless: Boolean(input?.browser?.headless),
      slowMoMs: toPositiveInteger(input?.browser?.slowMoMs, 200),
    },
    upload: {
      postUploadDelayMs: toPositiveInteger(input?.upload?.postUploadDelayMs, 3000),
    },
  };
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function validateConfiguration(appConfig) {
  const issues = [];
  const accountKeys = new Set();
  const taskIds = new Set();

  if (!appConfig.loginUrl) {
    issues.push("Missing loginUrl in private/haft-uploader/accounts.local.json");
  }

  for (const account of appConfig.accounts ?? []) {
    if (!account.key) issues.push("Account is missing key");
    if (!account.username) issues.push(`Account ${account.key ?? "unknown"} is missing username`);
    if (!account.password) issues.push(`Account ${account.key ?? "unknown"} is missing password`);
    if (!Array.isArray(account.targetPath) || account.targetPath.length === 0) {
      issues.push(`Account ${account.key ?? "unknown"} is missing targetPath`);
    }
    if (accountKeys.has(account.key)) {
      issues.push(`Duplicate account key: ${account.key}`);
    }
    accountKeys.add(account.key);
  }

  for (const task of appConfig.tasks ?? []) {
    if (!task.id) issues.push("Task is missing id");
    if (task.id && taskIds.has(task.id)) {
      issues.push(`Duplicate task id: ${task.id}`);
    }
    taskIds.add(task.id);
    if (!task.name) issues.push(`Task ${task.id ?? "unknown"} is missing name`);
    if (!task.schedule) issues.push(`Task ${task.id ?? "unknown"} is missing schedule`);
    if (task.schedule && !cron.validate(task.schedule)) {
      issues.push(`Task ${task.id ?? "unknown"} has invalid cron schedule`);
    }
    if (!task.accountKey) issues.push(`Task ${task.id ?? "unknown"} is missing accountKey`);
    if (!accountKeys.has(task.accountKey)) {
      issues.push(`Task ${task.id ?? "unknown"} references unknown accountKey ${task.accountKey}`);
    }

    const fileSource = task.fileSource ?? {};
    if (!["directory", "download"].includes(fileSource.type)) {
      issues.push(`Task ${task.id ?? "unknown"} has invalid fileSource.type`);
    }
    if (!Number.isInteger(fileSource.requiredCount) || fileSource.requiredCount <= 0) {
      issues.push(`Task ${task.id ?? "unknown"} has invalid fileSource.requiredCount`);
    }
    if (fileSource.type === "directory" && !fileSource.directoryPath) {
      issues.push(`Task ${task.id ?? "unknown"} is missing fileSource.directoryPath`);
    }
    if (fileSource.type === "download" && !fileSource.downloadDir) {
      issues.push(`Task ${task.id ?? "unknown"} is missing fileSource.downloadDir`);
    }
    if (fileSource.type === "download" && !Array.isArray(fileSource.urls)) {
      issues.push(`Task ${task.id ?? "unknown"} is missing fileSource.urls`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function generateTaskId(name) {
  const base = slugify(name) || "task";
  return `${base}-${Date.now()}`;
}
