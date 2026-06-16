import fs from "node:fs/promises";
import path from "node:path";
import { prepareFilesForTask } from "./file-prep.mjs";
import { runUploadFlow } from "./rpa.mjs";
import { resolveLeadsSplitterCycleWindow, runLeadsSplitterDownloadCycle } from "../leads-splitter/automation.mjs";
import { processLeadsSplitterFile } from "../leads-splitter/process.mjs";
import {
  LEADS_SPLITTER_DOWNLOAD_DIR,
  LEADS_SPLITTER_OUTPUT_DIR,
  LEADS_SPLITTER_STATE_PATH,
} from "../leads-splitter/paths.mjs";

function createLockMap() {
  const heldKeys = new Set();

  return {
    async runExclusive(key, action) {
      if (heldKeys.has(key)) {
        throw new Error(`资源正在使用中：${key}`);
      }

      heldKeys.add(key);
      try {
        return await action();
      } finally {
        heldKeys.delete(key);
      }
    },
  };
}

const accountLocks = createLockMap();

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function canReuseLeadsSplitterOutputs(period, state) {
  if (!state?.lastSuccessfulStartAt || !state?.lastSuccessfulEndAt) {
    return null;
  }

  const isSameSuccessfulPeriod =
    state.lastSuccessfulStartAt === period.startAt && state.lastSuccessfulEndAt === period.endAt;
  const isRetryInsideCurrentCycle =
    period.startAt === period.endAt && state.lastSuccessfulEndAt === period.endAt;

  if (!isSameSuccessfulPeriod && !isRetryInsideCurrentCycle) {
    return null;
  }

  const outputs = Array.isArray(state.lastResult?.outputs) ? state.lastResult.outputs : [];
  if (outputs.length < 2) {
    return null;
  }

  const allExist = await Promise.all(
    outputs.map((output) => fileExists(path.join(LEADS_SPLITTER_OUTPUT_DIR, output.filename))),
  );

  if (allExist.some((exists) => !exists)) {
    return null;
  }

  return {
    period: isRetryInsideCurrentCycle
      ? {
          startAt: state.lastSuccessfulStartAt,
          endAt: state.lastSuccessfulEndAt,
          source: "reused_same_cycle",
        }
      : period,
    result: state.lastResult,
    outputs,
    reused: true,
  };
}

async function runTaskPreprocess(task, appConfig) {
  const preprocess = task.preprocess ?? {};
  if (preprocess.kind !== "leads_splitter_auto") {
    return null;
  }

  const planned = await resolveLeadsSplitterCycleWindow({
    statePath: LEADS_SPLITTER_STATE_PATH,
  });
  const reusable = await canReuseLeadsSplitterOutputs(planned.period, planned.state);
  if (reusable) {
    return reusable;
  }

  const cycle = await runLeadsSplitterDownloadCycle({
    statePath: LEADS_SPLITTER_STATE_PATH,
    destinationDir: LEADS_SPLITTER_DOWNLOAD_DIR,
    auth: appConfig.downloadPortalAuth,
    browserOptions: {
      headless: preprocess.headless !== false,
      slowMoMs: Number.isFinite(Number(preprocess.slowMoMs)) ? Number(preprocess.slowMoMs) : 120,
    },
  });

  const result = await processLeadsSplitterFile(cycle.download.filePath);
  await cycle.markSuccess({
    lastResult: {
      total: result.total,
      table1_count: result.table1_count,
      table2_count: result.table2_count,
      outputs: result.outputs,
    },
  });

  return {
    period: cycle.period,
    download: cycle.download,
    result,
    reused: false,
  };
}

export function createTaskRunner({ appConfig, store }) {
  const accountByKey = new Map(appConfig.accounts.map((account) => [account.key, account]));

  return async function runTask(task) {
    const startedAt = new Date().toISOString();
    const account = accountByKey.get(task.accountKey);

    if (!account) {
      console.error(`任务 ${task.name} 失败：未找到账号。`);
      return {
        ok: false,
        status: "failed",
        message: "未找到账号。",
      };
    }

    try {
      return await accountLocks.runExclusive(task.accountKey, async () => {
        const preprocessResult = await runTaskPreprocess(task, appConfig);
        const { selectedFiles, skippedFiles, skipUpload, skipUploadReason } = await prepareFilesForTask(
          task,
          store,
          appConfig,
        );

        if (selectedFiles.length < task.fileSource.requiredCount) {
          const message = [
            `符合条件的文件不足。需要 ${task.fileSource.requiredCount} 个，当前只有 ${selectedFiles.length} 个。`,
            skippedFiles.length > 0 ? `已跳过重复文件：${skippedFiles.map((file) => file.name).join("、")}` : "",
          ]
            .filter(Boolean)
            .join(" ");

          store.recordExecution({
            taskId: task.id,
            taskName: task.name,
            accountKey: task.accountKey,
            status: "skipped",
            startedAt,
            finishedAt: new Date().toISOString(),
            fileCount: selectedFiles.length,
            fileNames: selectedFiles.map((file) => file.name),
            message,
          });
          console.warn(`${task.name}: ${message}`);
          return {
            ok: false,
            status: "skipped",
            message,
            files: selectedFiles,
          };
        }

        if (skipUpload) {
          const message = [
            skipUploadReason || "已按任务规则跳过上传流程。",
            preprocessResult
              ? `前置拆表周期：${preprocessResult.period.startAt} -> ${preprocessResult.period.endAt}。`
              : "",
            `本次已准备 ${selectedFiles.length} 个文件。`,
          ].join(" ");

          store.recordExecution({
            taskId: task.id,
            taskName: task.name,
            accountKey: task.accountKey,
            status: "skipped",
            startedAt,
            finishedAt: new Date().toISOString(),
            fileCount: selectedFiles.length,
            fileNames: selectedFiles.map((file) => file.name),
            message,
          });
          console.warn(`${task.name}: ${message}`);
          return {
            ok: false,
            status: "skipped",
            message,
            files: selectedFiles,
          };
        }

        const result = await runUploadFlow({
          loginUrl: appConfig.loginUrl,
          account,
          task,
          files: selectedFiles,
        });

        if (!result.ok) {
          const failureMessage = [
            preprocessResult
              ? preprocessResult.reused
                ? `已复用本周期拆表结果：${preprocessResult.period.startAt} -> ${preprocessResult.period.endAt}`
                : `前置拆表周期：${preprocessResult.period.startAt} -> ${preprocessResult.period.endAt}`
              : "",
            result.error?.message ?? "未知上传错误",
            result.tracePath ? `调试追踪：${result.tracePath}` : "",
          ]
            .filter(Boolean)
            .join(" | ");

          store.recordExecution({
            taskId: task.id,
            taskName: task.name,
            accountKey: task.accountKey,
            status: "failed",
            startedAt,
            finishedAt: new Date().toISOString(),
            fileCount: selectedFiles.length,
            fileNames: selectedFiles.map((file) => file.name),
            message: failureMessage,
            screenshotPath: result.screenshotPath,
          });
          console.error(`${task.name}: 上传失败`, result.error);
          return {
            ok: false,
            status: "failed",
            message: failureMessage,
            files: selectedFiles,
            screenshotPath: result.screenshotPath,
          };
        }

        const uploadedAt = new Date().toISOString();
        store.recordUploadedFiles(task.id, selectedFiles, uploadedAt);
        store.recordExecution({
          taskId: task.id,
          taskName: task.name,
          accountKey: task.accountKey,
          status: "success",
          startedAt,
          finishedAt: uploadedAt,
          fileCount: selectedFiles.length,
          fileNames: selectedFiles.map((file) => file.name),
          message: result.tracePath
            ? [
                preprocessResult
                  ? preprocessResult.reused
                    ? `已复用本周期拆表结果：${preprocessResult.period.startAt} -> ${preprocessResult.period.endAt}。`
                    : `前置拆表周期：${preprocessResult.period.startAt} -> ${preprocessResult.period.endAt}。`
                  : "",
                `上传已成功完成。调试追踪：${result.tracePath}`,
              ]
                .filter(Boolean)
                .join(" ")
            : [
                preprocessResult
                  ? preprocessResult.reused
                    ? `已复用本周期拆表结果：${preprocessResult.period.startAt} -> ${preprocessResult.period.endAt}。`
                    : `前置拆表周期：${preprocessResult.period.startAt} -> ${preprocessResult.period.endAt}。`
                  : "",
                "上传已成功完成。",
              ]
                .filter(Boolean)
                .join(" "),
        });
        console.log(`${task.name}: 已上传 ${selectedFiles.length} 个文件。`);
        return {
          ok: true,
          status: "success",
          message: preprocessResult
            ? preprocessResult.reused
              ? `已复用同周期拆表结果 ${preprocessResult.period.startAt} -> ${preprocessResult.period.endAt}，并已上传成功。`
              : `前置拆表已完成，周期 ${preprocessResult.period.startAt} -> ${preprocessResult.period.endAt}，并已上传成功。`
            : "上传已成功完成。",
          files: selectedFiles,
        };
      });
    } catch (error) {
      store.recordExecution({
        taskId: task.id,
        taskName: task.name,
        accountKey: task.accountKey,
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        fileCount: 0,
        fileNames: [],
        message: error.message,
      });
      console.error(`${task.name}: 执行失败`, error);
      return {
        ok: false,
        status: "failed",
        message: error.message,
      };
    }
  };
}
