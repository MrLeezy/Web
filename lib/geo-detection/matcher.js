/**
 * GEO长尾词监控 - 品牌词匹配模块
 */

/**
 * 在文本中匹配品牌词
 * @param {string} text - 要搜索的文本
 * @param {string[]} brandList - 品牌词列表
 * @returns {string[]} 匹配到的品牌词列表
 */
function matchBrands(text, brandList) {
  if (!text || !brandList || brandList.length === 0) {
    return [];
  }

  const matches = [];
  const lowerText = text.toLowerCase();

  for (const brand of brandList) {
    if (!brand) continue;
    // 不区分大小写匹配
    if (lowerText.includes(brand.toLowerCase())) {
      matches.push(brand);
    }
  }

  return matches;
}

/**
 * 格式化匹配结果为管道分隔的字符串
 * @param {string[]} matches - 匹配的品牌词列表
 * @returns {string} 格式化后的字符串
 */
function formatMatches(matches) {
  if (!matches || matches.length === 0) {
    return "";
  }
  return matches.join("|");
}

module.exports = {
  matchBrands,
  formatMatches,
};
