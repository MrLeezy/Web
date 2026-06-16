import { spawn } from "node:child_process";
import { LEADS_SPLITTER_OUTPUT_DIR, LEADS_SPLITTER_SCRIPT_PATH } from "./paths.mjs";

export async function processLeadsSplitterFile(inputPath) {
  return runJsonScript(LEADS_SPLITTER_SCRIPT_PATH, [
    "--input",
    inputPath,
    "--output-dir",
    LEADS_SPLITTER_OUTPUT_DIR,
  ]);
}

async function runJsonScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [scriptPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "拆表脚本执行失败"));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("拆表脚本返回结果解析失败"));
      }
    });
  });
}
