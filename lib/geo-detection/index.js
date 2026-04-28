/**
 * GEO长尾词监控 - 主模块入口
 */

const { launchBrowser, createPage, closeBrowser, sleep } = require("./browser");
const { matchBrands, formatMatches } = require("./matcher");

// 检测任务状态
let isRunning = false;
let shouldStop = false;

/**
 * 获取平台适配器（每次重新加载，避免缓存）
 */
function getPlatform(platformId) {
  // 清除缓存，确保加载最新代码
  const platformPath = `./platforms/${platformId}`;
  delete require.cache[require.resolve(platformPath)];
  return require(platformPath);
}

/**
 * 按项目分组品牌词
 * @param {object[]} brands - 品牌词列表（含项目信息）
 * @returns {Map} 项目 -> 品牌词列表
 */
function groupBrandsByProject(brands) {
  const projectMap = new Map();

  for (const brand of brands) {
    const projectId = brand.projectId || "default";
    const projectName = brand.projectName || "未分组";

    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, {
        projectId,
        projectName,
        brands: [],
      });
    }

    projectMap.get(projectId).brands.push(brand.name);
  }

  return projectMap;
}

/**
 * 停止检测任务
 */
async function stopDetection() {
  shouldStop = true;
  if (isRunning) {
    await closeBrowser();
  }
}

/**
 * 执行检测任务
 * @param {object} options - 配置选项
 * @param {string[]} options.keywords - 长尾词列表
 * @param {string[]} options.platforms - 平台列表
 * @param {object[]} options.brands - 品牌词列表（含项目信息）
 * @param {boolean} options.browserMode - 是否使用浏览器模式（默认 true）
 * @param {number} options.repeatCount - 每个长尾词重复检测次数
 * @param {function} options.onLog - 日志回调
 * @param {function} options.onProgress - 进度回调
 * @param {function} options.onReport - 报告回调
 * @returns {Promise<object[]>} 检测结果列表
 */
async function runDetection(options) {
  const { keywords, platforms, brands, browserMode = true, repeatCount = 1, onLog, onProgress, onReport } = options;

  // 如果已有任务在运行，先停止
  if (isRunning) {
    await stopDetection();
  }

  isRunning = true;
  shouldStop = false;

  const results = [];
  let context = null;

  // 按项目分组品牌词
  const projectMap = groupBrandsByProject(brands);

  // 计算总任务数
  const totalTasks = keywords.length * platforms.length * repeatCount;
  let doneTasks = 0;

  try {
    // 启动浏览器
    context = await launchBrowser({ onLog, headless: !browserMode });

    // 遍历每个长尾词
    for (const keyword of keywords) {
      if (shouldStop) {
        onLog("检测任务已停止", "error");
        break;
      }

      onLog(`开始检测长尾词: "${keyword}"`);

      // 遍历每个平台
      for (const platformId of platforms) {
        if (shouldStop) break;

        const platform = getPlatform(platformId);
        if (!platform || !platform.detect) {
          onLog(`未知平台: ${platformId}`, "error");
          continue;
        }

        // 批量检测：重复多次
        let successCount = 0;
        const repeatResults = [];

        for (let i = 0; i < repeatCount; i++) {
          if (shouldStop) break;
          const repeatLabel = repeatCount > 1 ? ` (第 ${i + 1}/${repeatCount} 次)` : "";

          onProgress({
            platform: platformId,
            keyword,
            status: `正在检测${repeatLabel}`,
            percent: Math.round((doneTasks / totalTasks) * 100),
          });

          // 每次创建新页面，确保独立窗口
          const page = await context.newPage();

          try {
            // 执行检测
            const result = await platform.detect(page, keyword, onLog);

            repeatResults.push(result);

            doneTasks++;
          } catch (error) {
            onLog(`检测失败: ${error.message}`, "error");
          } finally {
            // 关闭页面
            await page.close().catch(() => {});
          }
        }

        // 按项目分别生成报告
        for (const [projectId, projectData] of projectMap) {
          const projectBrands = projectData.brands;

          // 对每个项目分别匹配品牌词
          let projectSuccessCount = 0;

          for (const result of repeatResults) {
            const contentMatches = matchBrands(result.content, projectBrands);
            const refText = result.references.join(" ");
            const refMatches = matchBrands(refText, projectBrands);

            result.contentMatched = contentMatches.length > 0;
            result.contentMatchedBrands = contentMatches;
            result.referenceMatched = refMatches.length > 0;
            result.referenceMatchedBrands = refMatches;

            // 推荐指数只基于内容匹配（不算参考资料匹配）
            if (result.contentMatched) {
              projectSuccessCount++;
            }
          }

          // 计算推荐指数：10 / 批量次数 * 成功次数（保留整数）
          const recommendationScore = repeatCount > 1 ? Math.round((10 / repeatCount) * projectSuccessCount) : null;

          const report = {
            id: generateId(),
            date: getLocalDate(),
            keyword,
            projectId: projectData.projectId,
            projectName: projectData.projectName,
            platform: platformId,
            contentMatched: repeatResults.some((r) => r.contentMatched),
            contentMatchedBrands: formatMatches(repeatResults.flatMap((r) => r.contentMatchedBrands || [])),
            hasReference: repeatResults.some((r) => r.references && r.references.length > 0 && r.references[0] && r.references[0].length > 0),
            referenceMatched: repeatResults.some((r) => r.referenceMatched),
            referenceMatchedBrands: formatMatches(repeatResults.flatMap((r) => r.referenceMatchedBrands || [])),
            recommendationScore,
            createdAt: new Date().toISOString(),
          };

          onReport(report);
        }

        onProgress({
          platform: platformId,
          keyword,
          status: "检测完成",
          percent: Math.round((doneTasks / totalTasks) * 100),
        });
      }
    }

    onLog("所有检测任务完成", "success");
  } finally {
    isRunning = false;
    shouldStop = false;
    // 关闭浏览器
    await closeBrowser();
  }

  return results;
}

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * 获取本地日期字符串
 */
function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

module.exports = {
  runDetection,
  stopDetection,
};
