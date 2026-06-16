import fs from "node:fs/promises";
import cron from "node-cron";
import { ACCOUNTS_FILE, TASKS_FILE, TASKS_EXAMPLE_FILE, PRIVATE_DIR, DOWNLOAD_DIR } from "./paths.mjs";

export async function loadAppConfig() {
  const tasksPath = await fileExists(TASKS_FILE) ? TASKS_FILE : TASKS_EXAMPLE_FILE;
  const accountsExists = await fileExists(ACCOUNTS_FILE);

  if (!accountsExists) {
    throw new Error(
      "缺少 private/haft-uploader/accounts.local.json。请复制 accounts.example.json，并填写真实密码。",
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
  const downloadDateMode = input?.fileSource?.downloadDateMode === "custom" ? "custom" : "yesterday";
  const customStartDate = normalizeDateInput(input?.fileSource?.customStartDate);
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
    preprocess:
      input?.preprocess?.kind === "leads_splitter_auto"
        ? {
            kind: "leads_splitter_auto",
            headless: input?.preprocess?.headless !== false,
            slowMoMs: toPositiveInteger(input?.preprocess?.slowMoMs, 120),
          }
        : undefined,
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
      downloadDateMode: fileSourceType === "download" ? downloadDateMode : undefined,
      customStartDate:
        fileSourceType === "download" && downloadDateMode === "custom" ? customStartDate : undefined,
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
    issues.push("private/haft-uploader/accounts.local.json 缺少登录地址");
  }

  for (const account of appConfig.accounts ?? []) {
    if (!account.key) issues.push("账号缺少标识");
    if (!account.username) issues.push(`账号 ${account.key ?? "未知"} 缺少用户名`);
    if (!account.password) issues.push(`账号 ${account.key ?? "未知"} 缺少密码`);
    if (!Array.isArray(account.targetPath) || account.targetPath.length === 0) {
      issues.push(`账号 ${account.key ?? "未知"} 缺少上传目标路径`);
    }
    if (accountKeys.has(account.key)) {
      issues.push(`账号 key 重复：${account.key}`);
    }
    accountKeys.add(account.key);
  }

  for (const task of appConfig.tasks ?? []) {
    if (!task.id) issues.push("任务缺少标识");
    if (task.id && taskIds.has(task.id)) {
      issues.push(`任务标识重复：${task.id}`);
    }
    taskIds.add(task.id);
    if (!task.name) issues.push(`任务 ${task.id ?? "未知"} 缺少名称`);
    if (!task.schedule) issues.push(`任务 ${task.id ?? "未知"} 缺少执行计划`);
    if (task.schedule && !cron.validate(task.schedule)) {
      issues.push(`任务 ${task.id ?? "未知"} 的执行计划格式不合法`);
    }
    if (!task.accountKey) issues.push(`任务 ${task.id ?? "未知"} 缺少账号标识`);
    if (!accountKeys.has(task.accountKey)) {
      issues.push(`任务 ${task.id ?? "未知"} 引用了未知账号标识：${task.accountKey}`);
    }
    if (task.preprocess?.kind && task.preprocess.kind !== "leads_splitter_auto") {
      issues.push(`任务 ${task.id ?? "未知"} 的前置处理类型不合法`);
    }

    const fileSource = task.fileSource ?? {};
    if (!["directory", "download"].includes(fileSource.type)) {
      issues.push(`任务 ${task.id ?? "未知"} 的文件来源类型不合法`);
    }
    if (!Number.isInteger(fileSource.requiredCount) || fileSource.requiredCount <= 0) {
      issues.push(`任务 ${task.id ?? "未知"} 的所需文件数量不合法`);
    }
    if (fileSource.type === "directory" && !fileSource.directoryPath) {
      issues.push(`任务 ${task.id ?? "未知"} 缺少本地目录路径`);
    }
    if (fileSource.type === "download" && !fileSource.downloadDir) {
      issues.push(`任务 ${task.id ?? "未知"} 缺少下载目录`);
    }
    if (fileSource.type === "download" && !Array.isArray(fileSource.urls)) {
      issues.push(`任务 ${task.id ?? "未知"} 缺少下载链接列表`);
    }
    if (fileSource.type === "download" && !["yesterday", "custom", undefined].includes(fileSource.downloadDateMode)) {
      issues.push(`任务 ${task.id ?? "未知"} 的下载日期模式不合法`);
    }
    if (fileSource.type === "download" && fileSource.downloadDateMode === "custom" && !isValidDateInput(fileSource.customStartDate)) {
      issues.push(`任务 ${task.id ?? "未知"} 缺少合法的指定下载日期`);
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

function normalizeDateInput(value) {
  const normalized = String(value ?? "").trim();
  return isValidDateInput(normalized) ? normalized : "";
}

function isValidDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
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
