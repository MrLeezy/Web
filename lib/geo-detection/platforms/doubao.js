/**
 * 豆包平台适配器
 * URL: https://www.doubao.com/chat/
 */

const { sleep } = require("../browser");

const PLATFORM_NAME = "豆包";
const PLATFORM_ID = "doubao";
const URL = "https://www.doubao.com/chat/";

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
      hasReferenceText: false,
      hasThinkingBox: false,
      bodyTextLength: 0,
      debugInfo: []
    };

    const bodyText = document.body.innerText;
    status.bodyTextLength = bodyText.length;

    // 1. 检查"停止生成"按钮 - 这是最直接的生成中标志
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

    // 2. 检查加载动画元素
    const loadingSelectors = [
      '[class*="loading"]',
      '[class*="spinner"]',
      '[class*="generating"]',
      '[class*="typing"]',
      '[class*="cursor-blink"]',
      '.animate-pulse',
      '.animate-spin'
    ];

    for (const selector of loadingSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.offsetWidth > 0 && el.offsetHeight > 0) {
          status.hasLoadingAnimation = true;
          status.isGenerating = true;
          status.debugInfo.push(`发现加载动画`);
          break;
        }
      }
      if (status.hasLoadingAnimation) break;
    }

    // 3. 检查"正在思考"等文字
    const thinkingKeywords = ['正在思考', '思考中', '生成中', '正在生成', '正在回答'];
    for (const keyword of thinkingKeywords) {
      if (bodyText.includes(keyword)) {
        status.hasThinkingText = true;
        status.isGenerating = true;
        status.debugInfo.push(`发现思考文字: ${keyword}`);
        break;
      }
    }

    // 4. 检查完成标志 - 这些只是参考，不能单独作为完成依据
    if (bodyText.includes('已完成思考') || bodyText.includes('思考完成')) {
      status.hasCompleteText = true;
      status.debugInfo.push('发现完成文字');
    }

    // 5. 检查参考资料标志
    if (/参考\s*\d+\s*篇?\s*资料/.test(bodyText)) {
      status.hasReferenceText = true;
      status.debugInfo.push('发现参考资料标志');
    }

    // 6. 检查 thinking-box 元素
    const thinkingBox = document.querySelector('div[data-thinking-box="title"]');
    if (thinkingBox) {
      status.hasThinkingBox = true;
      status.debugInfo.push('发现thinking-box');
    }

    // 完成的判断：没有在生成 + 有完成标志
    if (!status.isGenerating && (status.hasCompleteText || status.hasReferenceText || status.hasThinkingBox)) {
      status.isComplete = true;
    }

    return status;
  });
}

/**
 * 在豆包平台执行检测
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

    // 检查登录
    const pageContent = await page.content();
    if (pageContent.includes("登录") || pageContent.includes("请先登录")) {
      onLog(`[${PLATFORM_NAME}] 需要登录，请在浏览器中登录...`);
      await sleep(15000);
    }

    // 开启思考模式
    onLog(`[${PLATFORM_NAME}] 开启思考模式...`);
    try {
      const modeButton = await page.$('button:has-text("快速")');
      if (modeButton) {
        await modeButton.click();
        await sleep(1000);
        const thinkOption = await page.$('div[role="menuitem"]:has-text("思考")');
        if (thinkOption) {
          await thinkOption.click();
          onLog(`[${PLATFORM_NAME}] 已选择思考模式`, "success");
          await sleep(1000);
        }
      }
    } catch (e) {
      onLog(`[${PLATFORM_NAME}] 思考模式: ${e.message}`);
    }

    // 查找输入框
    onLog(`[${PLATFORM_NAME}] 查找输入框...`);
    let inputFound = false;
    const inputSelectors = ['div[contenteditable="true"]', 'div.ql-editor', 'div[role="textbox"]', 'textarea'];

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

    if (!inputFound) throw new Error("找不到输入框");

    onLog(`[${PLATFORM_NAME}] 发送问题...`);
    await page.keyboard.press("Enter");
    await sleep(3000);

    // 等待回复完成
    onLog(`[${PLATFORM_NAME}] 等待回复完成...`);

    const maxWait = 300000; // 5分钟最大等待
    const startTime = Date.now();
    let lastBodyLength = 0;
    let stableCount = 0;
    const requiredStableCount = 3; // 需要连续3次稳定（9秒）才认为完成

    while (Date.now() - startTime < maxWait) {
      await sleep(3000);

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const status = await getGenerationStatus(page);

      // 关键：如果还在生成，继续等待
      if (status.isGenerating) {
        onLog(`[${PLATFORM_NAME}] 正在生成回复... (${elapsed}秒) [${status.debugInfo.join(', ')}]`);
        stableCount = 0;
        lastBodyLength = status.bodyTextLength;
        continue;
      }

      // 内容稳定性检测 - 必须连续稳定才认为完成
      const lengthDiff = Math.abs(status.bodyTextLength - lastBodyLength);

      if (lengthDiff < 50) {
        stableCount++;
        onLog(`[${PLATFORM_NAME}] 内容稳定 ${stableCount}/${requiredStableCount} (${elapsed}秒)`);

        if (stableCount >= requiredStableCount) {
          onLog(`[${PLATFORM_NAME}] 回复完成`, "success");
          break;
        }
      } else {
        stableCount = 0;
        onLog(`[${PLATFORM_NAME}] 内容变化中... (${elapsed}秒, 变化${lengthDiff}字符)`);
      }

      lastBodyLength = status.bodyTextLength;
    }

    // 额外等待确保稳定
    await sleep(3000);

    onLog(`[${PLATFORM_NAME}] 获取回复内容...`);
    result.content = await page.textContent("body").catch(() => "");

    // 查找参考资料
    onLog(`[${PLATFORM_NAME}] 查找参考资料...`);
    try {
      const refSelectors = [
        'div[data-thinking-box="title"]',
        'button:has-text("参考")',
        'div:has-text("参考"):has-text("资料")'
      ];

      let refClicked = false;
      for (const selector of refSelectors) {
        try {
          const refElement = await page.$(selector);
          if (refElement && await refElement.isVisible()) {
            await refElement.click();
            onLog(`[${PLATFORM_NAME}] 已点击参考资料`);
            refClicked = true;
            await sleep(2000);
            break;
          }
        } catch (e) {}
      }

      // 尝试展开 - 点击所有包含"展开"的按钮
      if (refClicked) {
        onLog(`[${PLATFORM_NAME}] 查找展开按钮...`);
        await sleep(1000);

        // 循环点击展开按钮，直到没有"展开"文字
        let maxExpandTries = 5;
        while (maxExpandTries > 0) {
          const expandBtn = await page.$('div[data-thinking-box-tool-call="true"]:has-text("展开")');
          if (expandBtn && await expandBtn.isVisible()) {
            await expandBtn.click();
            onLog(`[${PLATFORM_NAME}] 已点击展开按钮`);
            await sleep(1500);
            maxExpandTries--;
          } else {
            onLog(`[${PLATFORM_NAME}] 已展开所有参考资料`);
            break;
          }
        }
      }

      const refContent = await page.textContent("body").catch(() => "");
      result.references.push(refContent);
    } catch (e) {
      onLog(`[${PLATFORM_NAME}] 参考资料: ${e.message}`);
    }

    onLog(`[${PLATFORM_NAME}] 检测完成`, "success");
  } catch (error) {
    result.error = error.message;
    onLog(`[${PLATFORM_NAME}] 错误: ${error.message}`, "error");
  }

  return result;
}

module.exports = { PLATFORM_ID, PLATFORM_NAME, URL, detect };
