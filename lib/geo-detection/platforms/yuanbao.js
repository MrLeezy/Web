/**
 * 元宝平台适配器
 * URL: https://yuanbao.tencent.com/chat/naQivTmsDa
 */

const { sleep } = require("../browser");

const PLATFORM_NAME = "元宝";
const PLATFORM_ID = "yuanbao";
const URL = "https://yuanbao.tencent.com/chat/naQivTmsDa";

/**
 * 获取页面生成状态的详细信息
 */
async function getGenerationStatus(page) {
  return await page.evaluate(() => {
    const status = {
      isGenerating: false,
      isComplete: false,
      hasStopButton: false,
      hasLoadingAnimation: false,
      hasThinkingText: false,
      hasCompleteText: false,
      bodyTextLength: 0,
      debugInfo: []
    };

    const bodyText = document.body.innerText;
    status.bodyTextLength = bodyText.length;

    // 1. 检查停止按钮
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const text = btn.textContent || '';
      if (text.includes('停止') || text.includes('Stop')) {
        status.hasStopButton = true;
        status.isGenerating = true;
        status.debugInfo.push('发现停止按钮');
        break;
      }
    }

    // 2. 检查加载动画
    const loadingSelectors = [
      '[class*="loading"]',
      '[class*="spinner"]',
      '[class*="generating"]',
      '[class*="typing"]'
    ];

    for (const selector of loadingSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.offsetWidth > 0 && el.offsetHeight > 0) {
          status.hasLoadingAnimation = true;
          status.isGenerating = true;
          status.debugInfo.push(`发现加载动画: ${selector}`);
          break;
        }
      }
      if (status.hasLoadingAnimation) break;
    }

    // 3. 检查思考中文字
    const thinkingKeywords = ['正在思考', '思考中', '生成中', '正在生成'];
    for (const keyword of thinkingKeywords) {
      if (bodyText.includes(keyword)) {
        status.hasThinkingText = true;
        status.isGenerating = true;
        status.debugInfo.push(`发现思考文字: ${keyword}`);
        break;
      }
    }

    // 4. 检查完成标志
    const completeKeywords = ['思考完成', '已完成', '回答完成'];
    for (const keyword of completeKeywords) {
      if (bodyText.includes(keyword)) {
        status.hasCompleteText = true;
        status.isComplete = true;
        status.debugInfo.push(`发现完成文字: ${keyword}`);
        break;
      }
    }

    return status;
  });
}

/**
 * 在元宝平台执行检测
 */
async function detect(page, keyword, onLog) {
  const result = {
    platform: PLATFORM_ID,
    platformName: PLATFORM_NAME,
    content: "",
    references: [],
    contentMatched: false,
    contentMatchedBrands: [],
    referenceMatched: false,
    referenceMatchedBrands: [],
    error: null,
  };

  try {
    onLog(`[${PLATFORM_NAME}] 正在打开页面...`);
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(5000);

    // 检查是否需要登录
    const pageContent = await page.content();
    if (pageContent.includes("登录") || pageContent.includes("请登录")) {
      onLog(`[${PLATFORM_NAME}] 需要登录，请在浏览器中登录...`);
      await sleep(15000);
    }

    onLog(`[${PLATFORM_NAME}] 开启深度思考...`);

    // 尝试开启深度思考
    try {
      // 元宝深度思考按钮: dt-button-id="deep_think"
      // 已选中时有 ThinkSelector_selected 类
      const deepThinkBtn = await page.$('[dt-button-id="deep_think"]');
      if (deepThinkBtn && await deepThinkBtn.isVisible()) {
        // 检查是否已选中
        const className = await deepThinkBtn.getAttribute('class');
        if (className && className.includes('ThinkSelector_selected')) {
          onLog(`[${PLATFORM_NAME}] 深度思考已开启`);
        } else {
          await deepThinkBtn.click();
          onLog(`[${PLATFORM_NAME}] 已开启深度思考`, "success");
          await sleep(1000);
        }
      } else {
        onLog(`[${PLATFORM_NAME}] 未找到深度思考按钮`);
      }
    } catch (e) {
      onLog(`[${PLATFORM_NAME}] 深度思考开关失败: ${e.message}`);
    }

    onLog(`[${PLATFORM_NAME}] 查找输入框...`);

    // 查找输入框
    let inputFound = false;
    const inputSelectors = [
      'textarea',
      'div[contenteditable="true"]',
      'div[role="textbox"]',
      '[class*="input"]',
    ];

    for (const selector of inputSelectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          inputFound = true;
          onLog(`[${PLATFORM_NAME}] 输入长尾词...`);
          await element.click();
          await sleep(300);
          await element.fill(keyword);
          await sleep(500);
          break;
        }
      } catch (e) {}
    }

    if (!inputFound) {
      throw new Error("找不到输入框，请检查页面是否正常加载");
    }

    onLog(`[${PLATFORM_NAME}] 发送问题...`);
    await page.keyboard.press("Enter");
    await sleep(3000);

    // 等待回复 - 使用详细状态检测
    onLog(`[${PLATFORM_NAME}] 等待回复...`);

    const maxWait = 300000;
    const startTime = Date.now();
    let lastBodyLength = 0;
    let stableCount = 0;
    const requiredStableCount = 3;

    while (Date.now() - startTime < maxWait) {
      await sleep(3000);

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const status = await getGenerationStatus(page);

      const debugStr = status.debugInfo.length > 0 ? ` [${status.debugInfo.join(', ')}]` : '';
      onLog(`[${PLATFORM_NAME}] 状态检测 (${elapsed}秒): 生成中=${status.isGenerating}, 完成=${status.isComplete}, 内容长度=${status.bodyTextLength}${debugStr}`);

      if (status.isGenerating) {
        stableCount = 0;
        lastBodyLength = status.bodyTextLength;
        continue;
      }

      if (status.isComplete) {
        onLog(`[${PLATFORM_NAME}] 检测到完成标志！`, "success");
        break;
      }

      const lengthDiff = Math.abs(status.bodyTextLength - lastBodyLength);
      if (lengthDiff < 20) {
        stableCount++;
        onLog(`[${PLATFORM_NAME}] 内容稳定 ${stableCount}/${requiredStableCount}`);
        if (stableCount >= requiredStableCount) {
          onLog(`[${PLATFORM_NAME}] 内容已稳定，认为回复完成`, "success");
          break;
        }
      } else {
        stableCount = 0;
        onLog(`[${PLATFORM_NAME}] 内容变化中...`);
      }

      lastBodyLength = status.bodyTextLength;
    }

    await sleep(5000);

    onLog(`[${PLATFORM_NAME}] 获取回复内容...`);
    result.content = await page.textContent("body").catch(() => "");

    onLog(`[${PLATFORM_NAME}] 查找参考资料...`);

    // 查找参考资料 - 元宝的"源"按钮
    try {
      const refSelectors = [
        'button:has-text("源")',
        'span:has-text("源")',
        '[class*="source-btn"]',
      ];

      for (const selector of refSelectors) {
        try {
          const refBtn = await page.$(selector);
          if (refBtn && await refBtn.isVisible()) {
            await refBtn.click();
            onLog(`[${PLATFORM_NAME}] 已点击源按钮`);
            await sleep(2000);
            break;
          }
        } catch (e) {}
      }

      const refText = await page.textContent("body").catch(() => "");
      result.references.push(refText);
    } catch (e) {
      onLog(`[${PLATFORM_NAME}] 未找到参考资料`);
    }

    onLog(`[${PLATFORM_NAME}] 检测完成`, "success");
  } catch (error) {
    result.error = error.message;
    onLog(`[${PLATFORM_NAME}] 错误: ${error.message}`, "error");
  }

  return result;
}

module.exports = {
  PLATFORM_ID,
  PLATFORM_NAME,
  URL,
  detect,
};
