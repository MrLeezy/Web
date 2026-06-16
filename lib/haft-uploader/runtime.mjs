import { getPublicAccounts, loadAppConfig, saveTasks as persistTasks, validateConfiguration } from "./config.mjs";
import { createScheduler } from "./scheduler.mjs";
import { createExecutionStore } from "./storage.mjs";
import { createTaskRunner } from "./task-runner.mjs";

export async function createRuntime() {
  const store = await createExecutionStore();
  let appConfig = await loadAppConfig();
  let taskRunner = createTaskRunner({ appConfig, store });
  const activeTaskIds = new Set();

  function ensureValid(config) {
    const validation = validateConfiguration(config);
    if (!validation.valid) {
      throw new Error(validation.issues.join(" | "));
    }
  }

  async function reloadConfig() {
    const freshConfig = await loadAppConfig();
    ensureValid(freshConfig);
    appConfig = freshConfig;
    taskRunner = createTaskRunner({ appConfig, store });
    return appConfig;
  }

  async function runTaskById(taskId) {
    await reloadConfig();
    if (activeTaskIds.has(taskId)) {
      throw new Error(`任务正在执行中，请等待当前执行完成后再试。`);
    }

    const task = appConfig.tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error(`未找到任务：${taskId}`);
    }

    activeTaskIds.add(taskId);
    try {
      return await taskRunner(task);
    } finally {
      activeTaskIds.delete(taskId);
    }
  }

  async function runTaskByIdWithOptions(taskId, runOptions = {}) {
    await reloadConfig();
    if (activeTaskIds.has(taskId)) {
      throw new Error(`任务正在执行中，请等待当前执行完成后再试。`);
    }

    const task = appConfig.tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error(`未找到任务：${taskId}`);
    }

    activeTaskIds.add(taskId);
    try {
      return await taskRunner(applyOneTimeRunOptions(task, runOptions));
    } finally {
      activeTaskIds.delete(taskId);
    }
  }

  function getAccountByKey(accountKey) {
    return appConfig.accounts.find((account) => account.key === accountKey);
  }

  const scheduler = createScheduler({
    reloadConfig,
    runTaskById,
  });

  ensureValid(appConfig);

  return {
    store,
    scheduler,
    async getBootstrap() {
      await reloadConfig();
      return {
        loginUrl: appConfig.loginUrl,
        accounts: getPublicAccounts(appConfig.accounts),
        tasks: appConfig.tasks,
        scheduler: scheduler.getStatus(),
        logs: store.listExecutionLogs(30),
      };
    },
    async listTasks() {
      await reloadConfig();
      return appConfig.tasks;
    },
    async replaceTasks(tasks) {
      const nextConfig = {
        ...appConfig,
        tasks,
      };
      ensureValid(nextConfig);
      await persistTasks(tasks);
      await reloadConfig();
      if (scheduler.getStatus().running) {
        await scheduler.start();
      }
      return appConfig.tasks;
    },
    async runTaskById(taskId) {
      return runTaskById(taskId);
    },
    async runTaskByIdManually(taskId, runOptions = {}) {
      await reloadConfig();
      const task = appConfig.tasks.find((item) => item.id === taskId);
      if (!task) {
        throw new Error(`未找到任务：${taskId}`);
      }

      const account = getAccountByKey(task.accountKey);
      if (!account) {
        throw new Error(`未找到账号：${task.accountKey}`);
      }
      if (account.allowManualRun === false) {
        throw new Error(`账号 ${account.label ?? account.key} 已禁止手动测试，避免误上传；联调请使用账号2。`);
      }

      return runTaskByIdWithOptions(taskId, runOptions);
    },
    async startScheduler() {
      return scheduler.start();
    },
    async stopScheduler() {
      return scheduler.stop();
    },
    clearExecutionLogs() {
      store.clearExecutionLogs();
    },
    getSchedulerStatus() {
      return scheduler.getStatus();
    },
  };
}

function applyOneTimeRunOptions(task, runOptions) {
  const downloadDate = normalizeDateInput(runOptions?.downloadDate);
  if (!downloadDate || task.fileSource?.type !== "download") {
    return task;
  }

  return {
    ...task,
    fileSource: {
      ...task.fileSource,
      downloadDateMode: "custom",
      customStartDate: downloadDate,
    },
  };
}

function normalizeDateInput(value) {
  const normalized = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}
