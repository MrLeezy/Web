import fs from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR, DB_PATH } from "./paths.mjs";

export async function createExecutionStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS execution_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      account_key TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      file_count INTEGER NOT NULL,
      file_names TEXT NOT NULL,
      message TEXT,
      screenshot_path TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      task_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_birthtime_ms INTEGER NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      PRIMARY KEY (task_id, file_path, file_birthtime_ms, file_size)
    );
  `);

  return {
    recordExecution(input) {
      const statement = db.prepare(`
        INSERT INTO execution_logs (
          task_id, task_name, account_key, status, started_at, finished_at,
          file_count, file_names, message, screenshot_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      statement.run(
        input.taskId,
        input.taskName,
        input.accountKey,
        input.status,
        input.startedAt,
        input.finishedAt,
        input.fileCount,
        JSON.stringify(input.fileNames),
        input.message ?? null,
        input.screenshotPath ?? null,
      );
    },
    recordUploadedFiles(taskId, files, uploadedAt) {
      const statement = db.prepare(`
        INSERT OR IGNORE INTO uploaded_files (
          task_id, file_path, file_birthtime_ms, file_size, uploaded_at
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const file of files) {
        statement.run(taskId, file.path, file.birthtimeMs, file.size, uploadedAt);
      }
    },
    findPreviouslyUploaded(taskId, files) {
      const statement = db.prepare(`
        SELECT 1
        FROM uploaded_files
        WHERE task_id = ?
          AND file_path = ?
          AND file_birthtime_ms = ?
          AND file_size = ?
        LIMIT 1
      `);

      return files.filter((file) =>
        Boolean(statement.get(taskId, file.path, file.birthtimeMs, file.size)),
      );
    },
    listExecutionLogs(limit = 50) {
      const statement = db.prepare(`
        SELECT
          id,
          task_id AS taskId,
          task_name AS taskName,
          account_key AS accountKey,
          status,
          started_at AS startedAt,
          finished_at AS finishedAt,
          file_count AS fileCount,
          file_names AS fileNames,
          message,
          screenshot_path AS screenshotPath
        FROM execution_logs
        ORDER BY id DESC
        LIMIT ?
      `);

      return statement.all(limit).map((row) => ({
        ...row,
        fileNames: JSON.parse(row.fileNames),
      }));
    },
    clearExecutionLogs() {
      db.exec("DELETE FROM execution_logs");
    },
  };
}
