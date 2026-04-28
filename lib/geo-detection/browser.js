/**
 * GEO长尾词监控 - 浏览器管理模块
 * 使用 Playwright 进行浏览器自动化
 */

const os = require("os");
const path = require("path");
const fs = require("fs");

let browser = null;
let context = null;

/**
 * 获取自动化专用的用户数据目录
 * 使用独立目录避免与正在运行的 Chrome 冲突
 * @returns {string}
 */
function getAutomationUserDataDir() {
  const platform = os.platform();
  const baseDir = path.join(os.homedir(), ".geo-detection-browser");

  // 确保目录存在
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  return baseDir;
}

/**
 * 启动浏览器
 * @param {object} options - 配置选项
 * @param {function} options.onLog - 日志回调
 * @param {boolean} options.headless - 是否无头模式（默认 false）
 * @returns {Promise<object>} 浏览器上下文
 */
async function launchBrowser(options = {}) {
  const { onLog, headless = false } = options;
  const { chromium } = require("playwright");

  if (onLog) onLog(headless ? "正在启动浏览器（后台模式）..." : "正在启动浏览器...");

  const userDataDir = getAutomationUserDataDir();

  try {
    // 使用持久化上下文，使用独立的自动化目录
    context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      viewport: { width: 1280, height: 900 },
      // 不指定 channel，使用 Playwright 自带的 Chromium
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });

    if (onLog) {
      if (headless) {
        onLog("浏览器已启动（后台模式）", "success");
      } else {
        onLog("浏览器已启动（首次使用需要登录各平台）", "success");
      }
    }
    return context;
  } catch (error) {
    if (onLog) onLog(`浏览器启动失败: ${error.message}`, "error");
    throw error;
  }
}

/**
 * 获取当前浏览器上下文
 * @returns {object|null}
 */
function getContext() {
  return context;
}

/**
 * 创建新页面
 * @returns {Promise<object>}
 */
async function createPage() {
  if (!context) {
    throw new Error("浏览器未启动");
  }
  return await context.newPage();
}

/**
 * 获取所有页面
 * @returns {Promise<object[]>}
 */
async function getPages() {
  if (!context) {
    throw new Error("浏览器未启动");
  }
  return context.pages();
}

/**
 * 关闭浏览器
 */
async function closeBrowser() {
  if (context) {
    await context.close().catch(() => {});
    context = null;
  }
}

/**
 * 等待指定时间
 * @param {number} ms - 毫秒数
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  launchBrowser,
  getContext,
  createPage,
  getPages,
  closeBrowser,
  sleep,
  getAutomationUserDataDir,
};
