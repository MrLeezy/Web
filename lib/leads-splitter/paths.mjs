import path from "node:path";

const ROOT_DIR = process.cwd();

export const LEADS_SPLITTER_DATA_DIR = path.join(ROOT_DIR, "data", "leads-splitter");
export const LEADS_SPLITTER_DOWNLOAD_DIR = path.join(LEADS_SPLITTER_DATA_DIR, "downloads");
export const LEADS_SPLITTER_STATE_PATH = path.join(LEADS_SPLITTER_DATA_DIR, "automation-state.json");
export const LEADS_SPLITTER_OUTPUT_DIR = path.join(ROOT_DIR, "data", "plugin-outputs", "leads-splitter");
export const LEADS_SPLITTER_SCRIPT_PATH = path.join(ROOT_DIR, "scripts", "leads_splitter.py");
