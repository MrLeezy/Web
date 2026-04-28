/**
 * 微信小程序二维码生成器 - 后端模块
 * 使用 Playwright 自动化生成小程序二维码
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// 插件 ID
const PLUGIN_ID = "wechat-xcx-qacode";

// 微信公众平台 URL
const MP_URL = "https://mp.weixin.qq.com/";

/**
 * 解析上传的文件，提取 title 和 path 字段
 * 支持 CSV、TXT、XLSX 格式
 */
async function parseRecordsFromFile(filePath, originalFilename) {
  const ext = path.extname(originalFilename).toLowerCase();

  if (ext === ".xlsx") {
    return parseXlsxFile(filePath);
  }

  // CSV/TXT 格式解析
  const content = await fsp.readFile(filePath, "utf8");
  return parseCsvContent(content);
}

/**
 * 解析 XLSX 文件
 */
function parseXlsxFile(filePath) {
  const XLSX = require("xlsx");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("XLSX 文件中没有工作表");
  }

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (data.length === 0) {
    return [];
  }

  // 查找 title 和 path 字段（不区分大小写）
  const firstRow = data[0];
  const keys = Object.keys(firstRow);
  const titleKey = keys.find((k) => k.toLowerCase().trim() === "title");
  const pathKey = keys.find((k) => k.toLowerCase().trim() === "path");

  if (!titleKey || !pathKey) {
    throw new Error("文件缺少必要字段：需要包含 title 和 path 列");
  }

  const records = [];
  for (const row of data) {
    const title = String(row[titleKey] || "").trim();
    const mpPath = String(row[pathKey] || "").trim();
    if (title && mpPath) {
      records.push({ title, path: mpPath });
    }
  }

  return records;
}

/**
 * 解析 CSV/TXT 内容
 */
function parseCsvContent(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return [];
  }

  // 检测分隔符
  const firstLine = lines[0];
  const separator = firstLine.includes("\t") ? "\t" : ",";

  // 解析表头
  const headers = parseCSVLine(firstLine, separator);
  const titleIndex = headers.findIndex((h) => h.toLowerCase().trim() === "title");
  const pathIndex = headers.findIndex((h) => h.toLowerCase().trim() === "path");

  if (titleIndex === -1 || pathIndex === -1) {
    throw new Error("文件缺少必要字段：需要包含 title 和 path 列");
  }

  // 解析数据行
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], separator);
    const title = values[titleIndex]?.trim();
    const mpPath = values[pathIndex]?.trim();

    if (title && mpPath) {
      records.push({ title, path: mpPath });
    }
  }

  return records;
}

/**
 * 解析 CSV 行，处理引号
 */
function parseCSVLine(line, separator) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * 生成模板文件内容
 */
function generateTemplate() {
  return "title,path\n示例小程序,pages/index/index\n另一个小程序,pages/detail/detail?id=123\n";
}

/**
 * 创建二维码生成器
 * @param {object} options - 配置选项
 * @param {string} options.outputDir - 输出目录
 * @param {function} options.onLog - 日志回调
 * @param {function} options.onProgress - 进度回调
 */
function createGenerator(options) {
  const { outputDir, onLog, onProgress, onFailure, onOutputDir } = options;
  let browser = null;
  let context = null;
  let page = null;
  let isLoggedIn = false;

  /**
   * 初始化浏览器
   */
  async function initBrowser() {
    const { chromium } = require("playwright");

    onLog("正在启动浏览器...");
    browser = await chromium.launch({
      headless: false, // 非无头模式，可见
      slowMo: 100, // 稍微放慢操作，便于观察
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    page = await context.newPage();
    onLog("浏览器已启动");
  }

  /**
   * 打开微信公众平台并等待登录
   */
  async function openAndWaitForLogin() {
    if (!page) await initBrowser();

    onLog(`正在打开微信公众平台: ${MP_URL}`);
    await page.goto(MP_URL, { waitUntil: "networkidle", timeout: 30000 });

    // 等待页面完全加载
    await page.waitForTimeout(3000);

    /**
     * 检查是否明确已登录
     */
    const isClearlyLoggedIn = async () => {
      try {
        // 检查是否有明确的小程序管理相关内容
        const bodyText = await page.textContent("body").catch(() => "");

        // 已登录的特征：能看到"小程序码"、"开发管理"等菜单
        if (bodyText.includes("小程序码") && bodyText.includes("开发管理")) {
          return true;
        }

        // 检查是否有小程序名称显示
        if (bodyText.includes("设置") && bodyText.includes("开发")) {
          return true;
        }

        return false;
      } catch {
        return false;
      }
    };

    // 检查是否已登录
    if (await isClearlyLoggedIn()) {
      isLoggedIn = true;
      onLog("检测到已登录状态", "success");
      return true;
    }

    // 等待用户扫码登录 - 通过前端确认
    onLog("========================================");
    onLog("请使用微信扫描二维码登录！");
    onLog("登录成功后，请点击页面上的「确认登录」按钮继续...");
    onLog("========================================");

    // 等待前端确认（通过检查文件标记）
    const confirmFlagFile = path.join(outputDir, ".login_confirm");

    const maxWaitTime = 5 * 60 * 1000; // 最多等待 5 分钟
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      // 检查是否有确认文件
      if (fs.existsSync(confirmFlagFile)) {
        await fsp.unlink(confirmFlagFile).catch(() => {});
        isLoggedIn = true;
        onLog("用户确认登录成功，开始生成二维码...", "success");
        return true;
      }

      // 也检查是否实际已登录
      if (await isClearlyLoggedIn()) {
        isLoggedIn = true;
        onLog("检测到已登录状态", "success");
        return true;
      }

      await page.waitForTimeout(2000);
    }

    throw new Error("登录超时，请在 5 分钟内完成扫码登录");
  }

  /**
   * 为单条记录生成二维码
   */
  async function generateQrCode(record, index, total) {
    if (!isLoggedIn) {
      await openAndWaitForLogin();
    }

    onLog(`[${index + 1}/${total}] 正在为 "${record.title}" 生成二维码...`);

    try {
      // 步骤5: 找到"小程序码"按钮并点击
      onLog("查找小程序码入口...");

      await page.waitForTimeout(500);

      // 使用 JavaScript 直接点击小程序码按钮
      let clicked = await page.evaluate(() => {
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent.trim() === '小程序码') {
            span.click();
            return true;
          }
        }
        return false;
      }).catch(() => false);

      if (!clicked) {
        throw new Error("找不到小程序码按钮，请确认已在小程序管理页面");
      }

      onLog("已点击小程序码按钮");
      await page.waitForTimeout(1500);

      // 步骤6: 等待对话框出现，然后填写路径
      onLog("等待对话框出现...");

      let pathInput = null;
      let retryCount = 0;

      // 等待输入框出现（最多等待 15 秒）
      while (retryCount < 30) {
        // 直接用选择器找，不检查可见性
        pathInput = await page.$("input.weui-desktop-form__input").catch(() => null);

        if (pathInput) {
          break;
        }

        await page.waitForTimeout(500);
        retryCount++;
      }

      if (!pathInput) {
        const url = page.url();
        onLog(`当前页面URL: ${url}`, "error");
        throw new Error("找不到路径输入框");
      }

      onLog("找到输入框，开始填写路径...");

      // 使用 JavaScript 直接操作输入框
      await page.evaluate(({ selector, path }) => {
        const input = document.querySelector(selector);
        if (input) {
          input.focus();
          input.value = '';
          input.value = path;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { selector: "input.weui-desktop-form__input", path: record.path });

      onLog(`已填写路径: ${record.path}`);
      await page.waitForTimeout(800);

      // 步骤7: 点击确定按钮生成二维码
      onLog("查找确定按钮...");

      let confirmFound = false;
      retryCount = 0;

      while (retryCount < 20 && !confirmFound) {
        // 使用 JavaScript 直接点击确定按钮
        confirmFound = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.textContent.trim() === '确定') {
              const className = btn.className || '';
              if (!className.includes('disabled')) {
                btn.click();
                return true;
              }
            }
          }
          return false;
        }).catch(() => false);

        if (!confirmFound) {
          await page.waitForTimeout(500);
          retryCount++;
        }
      }

      if (!confirmFound) {
        throw new Error("找不到确定按钮或按钮不可点击");
      }

      onLog("已点击确定按钮，等待生成...");
      await page.waitForTimeout(3000);

      // 步骤8: 等待二维码生成并保存
      onLog("等待二维码生成...");

      let qrImage = null;
      retryCount = 0;

      while (retryCount < 20) {
        qrImage = await page.$(".image-wrp img").catch(() => null);
        if (qrImage) {
          const isVisible = await qrImage.isVisible().catch(() => false);
          if (isVisible) {
            const imgSrc = await qrImage.getAttribute("src").catch(() => "");
            if (imgSrc && imgSrc.length > 10) {
              break;
            }
          }
        }
        await page.waitForTimeout(1000);
        retryCount++;
      }

      if (!qrImage) {
        throw new Error("二维码生成超时，未找到图片元素");
      }

      // 获取图片并保存
      const imgSrc = await qrImage.getAttribute("src");
      if (!imgSrc) {
        throw new Error("无法获取二维码图片地址");
      }

      onLog("正在下载二维码图片...");

      let imageBuffer;
      if (imgSrc.startsWith("data:")) {
        const base64 = imgSrc.split(",")[1];
        imageBuffer = Buffer.from(base64, "base64");
      } else {
        const response = await context.request.get(imgSrc);
        imageBuffer = await response.body();
      }

      // 保存图片
      const safeTitle = sanitizeFilename(record.title);
      const outputPath = path.join(outputDir, `${safeTitle}.png`);

      let finalPath = outputPath;
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        finalPath = path.join(outputDir, `${safeTitle}_${counter}.png`);
        counter++;
      }

      await fsp.writeFile(finalPath, imageBuffer);
      onLog(`二维码已保存: ${path.basename(finalPath)}`, "success");

      // 步骤9: 点击完成按钮
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent.trim() === '完成') {
            btn.click();
            return;
          }
        }
      }).catch(() => {});
      onLog("已点击完成按钮");
      await page.waitForTimeout(1500);

      return { success: true, path: finalPath };
    } catch (error) {
      onLog(`生成失败: ${error.message}`, "error");
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量生成二维码
   */
  async function generateAll(records) {
    const total = records.length;
    let success = 0;
    let failed = 0;
    const failures = [];

    onOutputDir(outputDir);
    onProgress({ total, done: 0, success: 0, failed: 0 });

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const result = await generateQrCode(record, i, total);

      if (result.success) {
        success++;
      } else {
        failed++;
        failures.push({ title: record.title, reason: result.error });
        onFailure({ title: record.title, reason: result.error });
      }

      onProgress({
        total,
        done: i + 1,
        success,
        failed,
        current: `正在处理: ${record.title}`,
      });
    }

    return { success, failed, failures };
  }

  /**
   * 关闭浏览器
   */
  async function close() {
    if (browser) {
      onLog("正在关闭浏览器...");
      await browser.close().catch(() => {});
      browser = null;
      context = null;
      page = null;
    }
  }

  return {
    initBrowser,
    openAndWaitForLogin,
    generateQrCode,
    generateAll,
    close,
  };
}

/**
 * 清理文件名
 */
function sanitizeFilename(name) {
  return String(name || "qrcode")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}

module.exports = {
  PLUGIN_ID,
  parseRecordsFromFile,
  generateTemplate,
  createGenerator,
  sanitizeFilename,
};
