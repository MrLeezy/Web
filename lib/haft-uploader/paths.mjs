import path from "node:path";

export const PRIVATE_DIR = path.resolve(process.cwd(), "private", "haft-uploader");
export const DATA_DIR = path.resolve(process.cwd(), "data", "haft-uploader");
export const DOWNLOAD_DIR = path.join(DATA_DIR, "downloads");
export const SCREENSHOT_DIR = path.join(DATA_DIR, "screenshots");
export const TRACE_DIR = path.join(DATA_DIR, "traces");
export const DB_PATH = path.join(DATA_DIR, "executions.db");
export const ACCOUNTS_FILE = path.join(PRIVATE_DIR, "accounts.local.json");
export const ACCOUNTS_EXAMPLE_FILE = path.join(PRIVATE_DIR, "accounts.example.json");
export const TASKS_FILE = path.join(PRIVATE_DIR, "tasks.json");
export const TASKS_EXAMPLE_FILE = path.join(PRIVATE_DIR, "tasks.example.json");
