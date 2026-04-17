import { prepareFilesForTask } from "./file-prep.mjs";
import { runUploadFlow } from "./rpa.mjs";

function createLockMap() {
  const heldKeys = new Set();

  return {
    async runExclusive(key, action) {
      if (heldKeys.has(key)) {
        throw new Error(`Resource is busy: ${key}`);
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

export function createTaskRunner({ appConfig, store }) {
  const accountByKey = new Map(appConfig.accounts.map((account) => [account.key, account]));

  return async function runTask(task) {
    const startedAt = new Date().toISOString();
    const account = accountByKey.get(task.accountKey);

    if (!account) {
      console.error(`Task ${task.name} failed: account not found.`);
      return {
        ok: false,
        status: "failed",
        message: "Account not found.",
      };
    }

    try {
      await accountLocks.runExclusive(task.accountKey, async () => {
        const { selectedFiles, skippedFiles } = await prepareFilesForTask(task, store, appConfig);

        if (selectedFiles.length < task.fileSource.requiredCount) {
          const message = [
            `Insufficient eligible files. Needed ${task.fileSource.requiredCount}, got ${selectedFiles.length}.`,
            skippedFiles.length > 0 ? `Skipped duplicates: ${skippedFiles.map((file) => file.name).join(", ")}` : "",
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

        const result = await runUploadFlow({
          loginUrl: appConfig.loginUrl,
          account,
          task,
          files: selectedFiles,
        });

        if (!result.ok) {
          const failureMessage = [
            result.error?.message ?? "Unknown upload error",
            result.tracePath ? `Trace: ${result.tracePath}` : "",
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
          console.error(`${task.name}: upload failed`, result.error);
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
            ? `Upload completed successfully. Trace: ${result.tracePath}`
            : "Upload completed successfully.",
        });
        console.log(`${task.name}: uploaded ${selectedFiles.length} file(s).`);
        return {
          ok: true,
          status: "success",
          message: "Upload completed successfully.",
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
      console.error(`${task.name}: execution failed`, error);
      return {
        ok: false,
        status: "failed",
        message: error.message,
      };
    }
  };
}
