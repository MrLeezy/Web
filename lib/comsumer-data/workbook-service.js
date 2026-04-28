const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const XLSX = require("xlsx");
const database = require("./database.js");

const ROOT = path.join(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");
const COMSUMER_DIR = path.join(DATA_DIR, "comsumer");
const COMSUMER_PLUGIN_DIR = path.join(DATA_DIR, "comsumer-data");
const OUTPUTS_DIR = path.join(COMSUMER_PLUGIN_DIR, "outputs");
const WORKSPACES_DIR = path.join(COMSUMER_PLUGIN_DIR, "workspaces");
const CONFIG_PATH = path.join(COMSUMER_DIR, "配置表.xlsx");
const USER_TEMPLATE_PATH = path.join(COMSUMER_DIR, "UserRawdata.xlsx");
const USER_MERGED_PATH = path.join(COMSUMER_DIR, "UserRawdata_merged.xlsx");
const DEMAND_MASTER_PATH = path.join(COMSUMER_DIR, "DemandRawdata.xlsx");
const PRODUCT_MASTER_PATH = path.join(COMSUMER_DIR, "ProductRawdata.xlsx");

const PERIOD_FILE_PATTERN = /^【(FY\d+)(Q[1-4])\s+W(\d+)】User Rawdata\.xlsx$/;
const WEEKS_PER_QUARTER = 13;
const WEEKS_PER_FISCAL_YEAR = 52;

const DEFAULT_PLUGIN_CONFIG = {
  fiscalYears: {
    FY27: { start: "2026-01-31", end: "2027-01-29" },
    FY28: { start: "2027-01-30", end: "2028-01-28" },
  },
};

const TABLE_COLUMNS_CACHE = new Map();
const ROBOT_DEFAULT_UNIQUE_ID = "b_wechat_other";

const USER_HEADERS = [
  "Year",
  "Quarter",
  "Month",
  "Week",
  "当周数据匹配",
  "分类",
  "Channel",
  "Source",
  "Term",
  "唯一标识符",
  "触达人数",
  "触达成功数",
  "PV",
  "UV",
  "Unionid",
  "User",
  "New User",
  "Chat",
  "Chat 需求",
  "商机收集",
  "表单外呼",
  "Chat 标记 ",
  "Funel",
  "Pengjian",
  "机器人",
  "B2B",
  "订单数据",
  "线下订单",
  "dm占位3",
  "sum",
  "领取积分",
  "是否领取优惠券",
  "是否订阅",
  "0元试用",
  "老用户激活",
  "新品预约",
  "秒杀",
  "抽奖",
  "周年庆",
  "互动汇总",
  "企点成单数据",
  "报价单成单",
  "Phone call 成单",
];

const UNIQUE_CHANNEL_HEADERS = ["Channel", "Source", "Term", "来源合并", "唯一标识符"];
const UTM_HEADERS = ["广告来源(utm_source)", "广告名称(utm_campaign)", "广告关键字(utm_term)", "合并", "Channel", "Source", "Term", "来源合并", "唯一标识符"];
const QCHAT_PROCESSED_HEADERS = [
  "会话ID",
  "客服",
  "客户",
  "会话通路",
  "会话开始时间",
  "会话质量",
  "首次响应时长",
  "会话时长",
  "社交账号ID",
  "消息记录",
  "visitor_id",
  "member_id",
  "URL",
  "路径",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "状态",
  "描述",
  "数据库时间",
  "数据标记",
  "DAM",
  "DAM渠道",
  "Year",
  "Quarter",
  "Month",
  "Week",
  "当周数据匹配",
  "唯一标识符",
];

const DEMAND_HEADERS = [
  "Year",
  "Quarter",
  "Month",
  "Fiscal_Quarter",
  "Week",
  "Day",
  "Segment",
  "Phone call",
  "Phone call",
  "机器人",
  "B2B",
  "QQ企点 Chat",
  "报价单",
  "Red note Chat",
];

const PRODUCT_HEADERS = [
  "ID",
  "产品名称",
  "分类",
  "Bundle code",
  "confing",
  "Dell.com页面 price",
  "DA",
  "焕新补贴",
  "联系砍一刀",
  "会员价格",
  "页面低offer价格",
  "访问人数",
  "访问人次",
  "咨询人数",
  "咨询人次",
  "推荐系数",
];

const STATIC_SHEETS = ["唯一渠道数据分布", "UTM", "Dictionary "];
const GENERATED_SHEETS = ["UserRawdata", "DemandRawdata", "ProductRawdata"];
const SOURCE_SHEETS = [
  "MA",
  "GIO",
  "Unionid",
  "User",
  "Q-Chat描述",
  "Q-Chat",
  "Funnel",
  "Weily Offline",
  "Sunny Offline",
  "Order",
  "机器人",
  "B2B",
  "领取积分",
  "领取优惠券",
  "订阅模版消息",
  "0元试用申请",
  "新品预约",
  "参与抽奖",
  "参与周年庆活动",
  "频道数据情况",
];

const IMPORT_DEFINITIONS = [
  { target: "GIO", aliases: ["gio"], requiredHeaders: ["广告来源", "广告名称", "用户量", "页面浏览量"] },
  { target: "Q-Chat", aliases: ["q-chat", "qchat"], requiredHeaders: ["会话质量", "社交账号ID", "消息记录"] },
  { target: "Funnel", aliases: ["funnel", "sales_funnel_summary"], requiredHeaders: ["Fiscal_Quarter", "Fiscal_Week", "Pending Reason 1类"] },
  { target: "Weily Offline", aliases: ["weilyoffline", "weily offline", "外呼唯一"], requiredHeaders: ["Capture Date", "是否有互动", "广告来源 (utm_source)"] },
  { target: "Sunny Offline", aliases: ["sunnyoffline", "sunny offline", "外呼累计"], requiredHeaders: ["Call Date", "组别", "SRL导入标识"] },
  { target: "机器人", aliases: ["机器人", "机器外呼明细"], requiredHeaders: ["呼叫开始时间", "呼叫结果", "Leads_ID"] },
  { target: "B2B", aliases: ["b2b", "大企来源个人商机总表"], requiredHeaders: ["Customer Name", "企点QQ渠道", "商机标签"] },
  { target: "Order", aliases: ["order"], requiredHeaders: ["销售", "来源", "客户手机号", "订单编号"] },
  { target: "频道数据情况", aliases: ["频道数据情况"], requiredHeaders: ["页面", "访问人数", "访问次数", "咨询人数", "咨询次数"] },
  { target: "领取积分", aliases: ["领取积分"], requiredHeaders: ["手机号", "广告来源", "广告名称"] },
  { target: "领取优惠券", aliases: ["领取优惠券"], requiredHeaders: ["手机号", "广告来源", "广告名称"] },
  { target: "订阅模版消息", aliases: ["订阅模版消息"], requiredHeaders: ["手机号", "广告来源", "广告名称"] },
  { target: "0元试用申请", aliases: ["0元试用申请"], requiredHeaders: ["申请时间", "手机号", "广告来源"] },
  { target: "新品预约", aliases: ["新品预约"], requiredHeaders: ["手机号"] },
  { target: "参与抽奖", aliases: ["参与抽奖"], requiredHeaders: ["手机号", "抽奖时间"] },
  { target: "参与周年庆活动", aliases: ["参与周年庆活动"], requiredHeaders: ["手机号"] },
  { target: "MA", aliases: ["ma"], requiredHeaders: ["营销渠道", "发送人数", "发送成功数"] },
];

function readPluginConfig() {
  const configPath = path.join(COMSUMER_PLUGIN_DIR, "config.json");

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return DEFAULT_PLUGIN_CONFIG;
  }
}

function normalizeHeader(value) {
  return String(value || "")
    .replace(/^\ufeff/, "")
    .replace(/\r?\n/g, "")
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .toLowerCase();
}

function normalizeText(value) {
  return String(value || "")
    .replace(/^\ufeff/, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeCompareText(value) {
  return normalizeText(value).replace(/\s+/g, "").toLowerCase();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || "";
}

function looksLikeMojibake(value) {
  return /[ÃÂâçåéè¤½]/.test(String(value || ""));
}

function decodeCsvBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    return "";
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le");
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer);
    for (let index = 0; index + 1 < swapped.length; index += 2) {
      const current = swapped[index];
      swapped[index] = swapped[index + 1];
      swapped[index + 1] = current;
    }
    return swapped.toString("utf16le");
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString("utf8");
  }

  const evenNullBytes = buffer.reduce((count, value, index) => count + (index % 2 === 1 && value === 0 ? 1 : 0), 0);
  if (evenNullBytes > Math.floor(buffer.length / 8)) {
    return buffer.toString("utf16le");
  }

  return buffer.toString("utf8");
}

function detectCsvDelimiter(text) {
  const firstLine = String(text || "")
    .replace(/^\ufeff/, "")
    .split(/\r?\n/, 1)[0];
  const delimiters = ["\t", ",", ";"];
  let best = ",";
  let bestCount = -1;

  for (const delimiter of delimiters) {
    const count = firstLine.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
}

function readCsvWorkbook(filePath) {
  const buffer = fs.readFileSync(filePath);
  const text = decodeCsvBuffer(buffer);
  const delimiter = detectCsvDelimiter(text);
  return XLSX.read(text, {
    type: "string",
    FS: delimiter,
    cellDates: true,
    dense: false,
    raw: true,
  });
}

function buildHeaderIndex(headers) {
  const index = new Map();

  headers.forEach((header, position) => {
    const key = normalizeHeader(header);
    if (!key) {
      return;
    }
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(position);
  });

  return index;
}

function findHeaderPosition(headers, candidates, occurrence = 0) {
  const index = buildHeaderIndex(headers);

  for (const candidate of candidates) {
    const key = normalizeHeader(candidate);
    const positions = index.get(key);
    if (positions && positions.length > occurrence) {
      return positions[occurrence];
    }
  }

  return -1;
}

function getCell(row, headers, candidates, occurrence = 0) {
  const position = findHeaderPosition(headers, candidates, occurrence);
  return position >= 0 ? row[position] : "";
}

function asNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = normalizeText(value).replace(/,/g, "");
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function excelSerialToDate(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeImportedBusinessDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const normalized = new Date(date.getTime());

  // Excel date-only cells from the offline source sheets are often parsed into
  // UTC timestamps around 15:59/16:00 of the previous day. Normalize them back
  // to the calendar day users see in Excel before doing period mapping.
  if (normalized.getUTCHours() >= 15 && normalized.getUTCHours() <= 16) {
    normalized.setUTCDate(normalized.getUTCDate() + 1);
  }

  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), normalized.getUTCDate(), 12, 0, 0));
}

function dateToExcelSerial(date) {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utc / 86400000) + 25569;
}

function formatMonth(date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}月`;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function formatSqlDateTime(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}`;
}

function padWeekNumber(weekNumber) {
  return String(weekNumber).padStart(2, "0");
}

function parseWeekNumber(value) {
  const matched = String(value || "").match(/(\d+)/);
  if (!matched) {
    return 0;
  }
  return Number.parseInt(matched[1], 10);
}

function parseQuarterNumber(value) {
  const matched = String(value || "").match(/Q([1-4])/i);
  if (!matched) {
    return 0;
  }
  return Number.parseInt(matched[1], 10);
}

function getFiscalYearConfig(fiscalYear) {
  const pluginConfig = readPluginConfig();
  const config = pluginConfig.fiscalYears?.[fiscalYear];
  if (!config) {
    throw new Error(`未配置财年：${fiscalYear}`);
  }
  return config;
}

function buildPeriodInfo(input) {
  const fiscalYear = normalizeText(input?.fiscalYear);
  const quarter = normalizeText(input?.quarter);
  const quarterNumber = parseQuarterNumber(quarter);
  const weekNumber = parseWeekNumber(input?.week);

  if (!fiscalYear || !quarterNumber || !weekNumber) {
    throw new Error("请选择完整的财年、季度和周度");
  }
  if (weekNumber < 1 || weekNumber > WEEKS_PER_QUARTER) {
    throw new Error("周度范围无效，请选择 Q1-Q4 内的第 1-13 周");
  }

  const fiscalConfig = getFiscalYearConfig(fiscalYear);
  const startDate = new Date(`${fiscalConfig.start}T00:00:00`);
  const absoluteWeekNumber = (quarterNumber - 1) * WEEKS_PER_QUARTER + weekNumber;
  startDate.setDate(startDate.getDate() + (absoluteWeekNumber - 1) * 7);

  const endDate = new Date(startDate.getTime());
  endDate.setDate(endDate.getDate() + 6);

  return {
    fiscalYear,
    quarter,
    fiscalQuarter: `${fiscalYear}${quarter}`,
    weekNumber,
    absoluteWeekNumber,
    shortWeek: `W${weekNumber}`,
    weekLabel: `Week${weekNumber}`,
    fiscalWeek: `${fiscalYear}${quarter}W${padWeekNumber(weekNumber)}`,
    monthLabel: formatMonth(endDate),
    startDate,
    endDate,
    keyPrefix: `${fiscalYear}${quarter}Week${weekNumber}`,
  };
}

function detectCurrentPeriod(referenceDate = new Date()) {
  const pluginConfig = readPluginConfig();
  const today = new Date(referenceDate);
  today.setHours(12, 0, 0, 0);

  for (const [fiscalYear, config] of Object.entries(pluginConfig.fiscalYears || {})) {
    const fiscalStart = new Date(`${config.start}T00:00:00`);
    const fiscalEnd = new Date(`${config.end}T23:59:59`);
    fiscalStart.setHours(12, 0, 0, 0);
    fiscalEnd.setHours(12, 0, 0, 0);

    if (today < fiscalStart || today > fiscalEnd) {
      continue;
    }

    const diffDays = Math.floor((today.getTime() - fiscalStart.getTime()) / 86400000);
    const absoluteWeekNumber = Math.floor(diffDays / 7) + 1;

    if (absoluteWeekNumber < 1 || absoluteWeekNumber > WEEKS_PER_FISCAL_YEAR) {
      continue;
    }

    const quarterNumber = Math.floor((absoluteWeekNumber - 1) / WEEKS_PER_QUARTER) + 1;
    const weekNumber = ((absoluteWeekNumber - 1) % WEEKS_PER_QUARTER) + 1;
    return buildPeriodInfo({
      fiscalYear,
      quarter: `Q${quarterNumber}`,
      week: `W${weekNumber}`,
    });
  }

  return null;
}

function resolvePeriodByDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const pluginConfig = readPluginConfig();
  const target = new Date(date.getTime());
  target.setHours(12, 0, 0, 0);

  for (const [fiscalYear, config] of Object.entries(pluginConfig.fiscalYears || {})) {
    const fiscalStart = new Date(`${config.start}T00:00:00`);
    const fiscalEnd = new Date(`${config.end}T23:59:59`);
    fiscalStart.setHours(12, 0, 0, 0);
    fiscalEnd.setHours(12, 0, 0, 0);

    if (target < fiscalStart || target > fiscalEnd) {
      continue;
    }

    const diffDays = Math.floor((target.getTime() - fiscalStart.getTime()) / 86400000);
    const absoluteWeekNumber = Math.floor(diffDays / 7) + 1;
    if (absoluteWeekNumber < 1 || absoluteWeekNumber > WEEKS_PER_FISCAL_YEAR) {
      return null;
    }

    const quarterNumber = Math.floor((absoluteWeekNumber - 1) / WEEKS_PER_QUARTER) + 1;
    const weekNumber = ((absoluteWeekNumber - 1) % WEEKS_PER_QUARTER) + 1;
    return buildPeriodInfo({
      fiscalYear,
      quarter: `Q${quarterNumber}`,
      week: `W${weekNumber}`,
    });
  }

  return null;
}

function getPeriodFileName(period) {
  return `【${period.fiscalYear}${period.quarter} W${period.weekNumber}】User Rawdata.xlsx`;
}

function getPeriodFilePath(period) {
  return path.join(COMSUMER_DIR, getPeriodFileName(period));
}

function getWorkspaceFileName(period) {
  return `${period.fiscalYear}_${period.quarter}_${period.shortWeek}.xlsx`;
}

function getWorkspaceFilePath(period) {
  return path.join(WORKSPACES_DIR, getWorkspaceFileName(period));
}

function readWorkbook(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") {
    const workbook = readCsvWorkbook(filePath);
    const firstSheet = workbook.SheetNames[0];
    const previewRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
      range: 0,
    });
    const headers = previewRows[0] || [];
    if (!headers.some((header) => looksLikeMojibake(header))) {
      return workbook;
    }
  }

  return XLSX.readFile(filePath, {
    cellDates: true,
    dense: false,
    codepage: 65001,
  });
}

function sheetToAoA(sheet) {
  if (!sheet) {
    return [];
  }
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });
}

function writeAoAToSheet(workbook, sheetName, rows) {
  const oldSheet = workbook.Sheets[sheetName];
  const nextSheet = XLSX.utils.aoa_to_sheet(rows);

  if (oldSheet?.["!cols"]) {
    nextSheet["!cols"] = oldSheet["!cols"];
  }
  if (oldSheet?.["!rows"]) {
    nextSheet["!rows"] = oldSheet["!rows"];
  }

  workbook.Sheets[sheetName] = nextSheet;
  if (!workbook.SheetNames.includes(sheetName)) {
    workbook.SheetNames.push(sheetName);
  }
}

function ensureHeaderSheet(workbook, sheetName, headers) {
  const existing = sheetToAoA(workbook.Sheets[sheetName]);
  if (existing.length > 0 && existing[0].length > 0) {
    writeAoAToSheet(workbook, sheetName, [existing[0]]);
    return existing[0];
  }

  writeAoAToSheet(workbook, sheetName, [headers]);
  return headers;
}

function cloneRows(rows) {
  return rows.map((row) => [...row]);
}

function listPeriodWorkbooks() {
  const items = [];

  try {
    const entries = fs.readdirSync(COMSUMER_DIR);
    for (const entry of entries) {
      const matched = entry.match(PERIOD_FILE_PATTERN);
      if (!matched) {
        continue;
      }

      const stat = fs.statSync(path.join(COMSUMER_DIR, entry));
      items.push({
        fileName: entry,
        fiscalYear: matched[1],
        quarter: matched[2],
        weekNumber: Number.parseInt(matched[3], 10),
        weekLabel: `Week${Number.parseInt(matched[3], 10)}`,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  } catch {
    return [];
  }

  return items.sort((left, right) => {
    if (left.fiscalYear !== right.fiscalYear) {
      return right.fiscalYear.localeCompare(left.fiscalYear);
    }
    if (left.quarter !== right.quarter) {
      return right.quarter.localeCompare(left.quarter);
    }
    return right.weekNumber - left.weekNumber;
  });
}

function getLatestTemplatePath(period) {
  if (fs.existsSync(USER_TEMPLATE_PATH)) {
    return USER_TEMPLATE_PATH;
  }

  const candidates = listPeriodWorkbooks()
    .filter((entry) => entry.fiscalYear === period.fiscalYear && entry.quarter === period.quarter)
    .sort((left, right) => right.weekNumber - left.weekNumber);

  if (candidates.length) {
    return path.join(COMSUMER_DIR, candidates[0].fileName);
  }

  const anyPeriod = listPeriodWorkbooks()[0];
  if (anyPeriod) {
    return path.join(COMSUMER_DIR, anyPeriod.fileName);
  }

  throw new Error("未找到可用的 Consumer 周工作簿模板");
}

async function ensurePeriodWorkbook(period) {
  const filePath = getWorkspaceFilePath(period);

  if (fs.existsSync(filePath)) {
    return { filePath, created: false, scope: "plugin-workspace" };
  }

  const legacyFilePath = getPeriodFilePath(period);
  const templatePath = fs.existsSync(legacyFilePath) ? legacyFilePath : getLatestTemplatePath(period);
  const workbook = readWorkbook(templatePath);

  for (const sheetName of [...SOURCE_SHEETS, ...GENERATED_SHEETS]) {
    const current = sheetToAoA(workbook.Sheets[sheetName]);
    if (current.length > 0) {
      writeAoAToSheet(workbook, sheetName, [current[0]]);
    }
  }

  if (fs.existsSync(CONFIG_PATH)) {
    const configWorkbook = readWorkbook(CONFIG_PATH);
    for (const sheetName of STATIC_SHEETS) {
      const rows = sheetToAoA(configWorkbook.Sheets[sheetName]);
      if (rows.length > 0) {
        writeAoAToSheet(workbook, sheetName, cloneRows(rows));
      }
    }
  }

  const baseUserRows = buildUserRawdataRows(workbook, period).rows;
  const baseDemandRows = buildDemandRawdataRows(workbook, period).rows;
  const baseProductRows = buildProductRawdataRows(workbook, period).rows;

  writeAoAToSheet(workbook, "UserRawdata", [USER_HEADERS, ...baseUserRows]);
  writeAoAToSheet(workbook, "DemandRawdata", [DEMAND_HEADERS, ...baseDemandRows]);
  writeAoAToSheet(workbook, "ProductRawdata", [PRODUCT_HEADERS, ...baseProductRows]);

  await fsp.mkdir(WORKSPACES_DIR, { recursive: true });
  XLSX.writeFile(workbook, filePath);
  return { filePath, created: true, scope: "plugin-workspace" };
}

function getSheetRowCount(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.["!ref"]) {
    return 0;
  }

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  return Math.max(0, range.e.r - range.s.r);
}

function inspectPeriodWorkbook(period) {
  const workspacePath = getWorkspaceFilePath(period);
  const legacyFilePath = getPeriodFilePath(period);
  const filePath = fs.existsSync(workspacePath) ? workspacePath : legacyFilePath;
  const scope = fs.existsSync(workspacePath) ? "plugin-workspace" : fs.existsSync(legacyFilePath) ? "legacy-period-file" : "";

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      exists: false,
      fileName: getWorkspaceFileName(period),
      filePath: workspacePath,
      scope: "pending",
      note: "当前周期还没有插件工作区；后续导入或重建时会在 data/comsumer-data/workspaces 中生成，不会自动在 data/comsumer 下新建周文件。",
    };
  }

  const workbook = readWorkbook(filePath);
  const stat = fs.statSync(filePath);

  return {
    exists: true,
    fileName: path.basename(filePath),
    filePath,
    scope,
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
    sourceSheets: SOURCE_SHEETS.map((sheetName) => ({
      sheetName,
      rows: getSheetRowCount(workbook, sheetName),
      present: workbook.SheetNames.includes(sheetName),
    })),
    generatedSheets: GENERATED_SHEETS.map((sheetName) => ({
      sheetName,
      rows: getSheetRowCount(workbook, sheetName),
      present: workbook.SheetNames.includes(sheetName),
    })),
  };
}

function getConfigSummary() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      exists: false,
      path: CONFIG_PATH,
    };
  }

  const workbook = readWorkbook(CONFIG_PATH);
  const uniqueChannelRows = sheetToAoA(workbook.Sheets["唯一渠道数据分布"]);
  const utmRows = sheetToAoA(workbook.Sheets.UTM);
  const dictionaryRows = sheetToAoA(workbook.Sheets["Dictionary "]);

  return {
    exists: true,
    path: CONFIG_PATH,
    uniqueChannels: Math.max(0, uniqueChannelRows.length - 1),
    utmMappings: Math.max(0, utmRows.length - 1),
    dictionaryRows: Math.max(0, dictionaryRows.length - 1),
  };
}

function getMasterFileSummary() {
  const files = [
    { label: "UserRawdata_merged", path: USER_MERGED_PATH },
    { label: "DemandRawdata", path: DEMAND_MASTER_PATH },
    { label: "ProductRawdata", path: PRODUCT_MASTER_PATH },
  ];

  return files.map((entry) => {
    if (!fs.existsSync(entry.path)) {
      return {
        label: entry.label,
        path: entry.path,
        exists: false,
      };
    }

    const workbook = readWorkbook(entry.path);
    const firstSheet = workbook.SheetNames[0];
    const rows = sheetToAoA(workbook.Sheets[firstSheet]);
    const stat = fs.statSync(entry.path);

    return {
      label: entry.label,
      path: entry.path,
      exists: true,
      sheetName: firstSheet,
      rows: Math.max(0, rows.length - 1),
      updatedAt: stat.mtime.toISOString(),
      size: stat.size,
    };
  });
}

function getBootstrapData() {
  const periodFiles = listPeriodWorkbooks();
  const currentPeriod = detectCurrentPeriod();

  return {
    config: getConfigSummary(),
    masterFiles: getMasterFileSummary(),
    periods: periodFiles.slice(0, 12),
    currentPeriod: currentPeriod
      ? {
          fiscalYear: currentPeriod.fiscalYear,
          quarter: currentPeriod.quarter,
          week: currentPeriod.shortWeek,
          absoluteWeekNumber: currentPeriod.absoluteWeekNumber,
          month: currentPeriod.monthLabel,
        }
      : null,
    importTargets: IMPORT_DEFINITIONS.map((definition) => definition.target),
    fiscalYears: Object.entries(readPluginConfig().fiscalYears || {}).map(([key, value]) => ({
      fiscalYear: key,
      start: value.start,
      end: value.end,
    })),
  };
}

function getTable(workbook, sheetName) {
  const rows = sheetToAoA(workbook.Sheets[sheetName]);
  if (!rows.length) {
    return { headers: [], rows: [] };
  }
  return {
    headers: rows[0],
    rows: rows.slice(1),
  };
}

function buildUtmMergeKey(source, campaign, term) {
  return normalizeCompareText(`${normalizeNullableText(source)}${normalizeNullableText(campaign)}${normalizeNullableText(term)}`);
}

function buildWritableUtmMerge(source, campaign, term) {
  return `${normalizeNullableText(source)}${normalizeNullableText(campaign)}${normalizeNullableText(term)}`;
}

function buildSourceMerge(channel, source, term) {
  const normalizedTerm = normalizeNullableText(term) || "/";
  return `${normalizeNullableText(channel)}${normalizeNullableText(source)}${normalizedTerm}`;
}

function readConfigWorkbook() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error("配置表不存在，无法维护线上配置");
  }

  return readWorkbook(CONFIG_PATH);
}

function getUtmIdentifierMap() {
  const configWorkbook = readConfigWorkbook();
  const utmTable = getTable(configWorkbook, "UTM");
  const utmMap = new Map();

  for (const row of utmTable.rows) {
    const uniqueId = normalizeText(getCell(row, utmTable.headers, ["唯一标识符"]));
    if (!uniqueId) {
      continue;
    }

    const explicitMerge = normalizeText(getCell(row, utmTable.headers, ["合并"]));
    const mergeKey =
      normalizeCompareText(explicitMerge) ||
      buildUtmMergeKey(
        getCell(row, utmTable.headers, ["广告来源(utm_source)"]),
        getCell(row, utmTable.headers, ["广告名称(utm_campaign)"]),
        getCell(row, utmTable.headers, ["广告关键字(utm_term)"])
      );

    if (!utmMap.has(mergeKey)) {
      utmMap.set(mergeKey, uniqueId);
    }
  }

  return utmMap;
}

function getDictionaryAaKeywords() {
  const workbook = readConfigWorkbook();
  const sheet = workbook.Sheets["Dictionary "];
  const rows = sheetToAoA(sheet);
  if (!rows.length) {
    return [];
  }

  const keywords = [];
  for (let index = 1; index < rows.length; index += 1) {
    const value = normalizeText(rows[index][26]);
    if (value) {
      keywords.push(value);
    }
  }
  return keywords;
}

function getDictionaryAbKeywords() {
  const workbook = readConfigWorkbook();
  const sheet = workbook.Sheets["Dictionary "];
  const rows = sheetToAoA(sheet);
  if (!rows.length) {
    return [];
  }

  const keywords = [];
  for (let index = 1; index < rows.length; index += 1) {
    const value = normalizeText(rows[index][27]);
    if (value) {
      keywords.push(value);
    }
  }
  return keywords;
}

function normalizeChatQuality(value) {
  return normalizeText(value);
}

function getChatDataFlagByQuality(qualityValue) {
  const quality = normalizeChatQuality(qualityValue);
  const validValues = new Set(["一般会话", "优质会话"]);
  const invalidValues = new Set(["静默会话", "客服未响应会话", "客户未回复会话", "客户为回复会话"]);
  if (validValues.has(quality)) {
    return "有效数据";
  }
  if (invalidValues.has(quality)) {
    return "无效数据";
  }
  return quality ? "无效数据" : "无效数据";
}

function parseTrackedUrl(rawUrl) {
  const cleaned = normalizeText(rawUrl).replace(/&amp;/gi, "&");
  if (!cleaned) {
    return {
      originalUrl: "",
      path: "",
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      utmContent: "",
      utmTerm: "",
    };
  }

  try {
    const url = cleaned.startsWith("http://") || cleaned.startsWith("https://") ? new URL(cleaned) : new URL(cleaned, "https://placeholder.local/");
    const pathName = normalizeText(url.pathname || "").replace(/^\//, "");
    return {
      originalUrl: cleaned,
      path: pathName,
      utmSource: normalizeNullableText(url.searchParams.get("utm_source")),
      utmMedium: normalizeNullableText(url.searchParams.get("utm_medium")),
      utmCampaign: normalizeNullableText(url.searchParams.get("utm_campaign")),
      utmContent: normalizeNullableText(url.searchParams.get("utm_content")),
      utmTerm: normalizeNullableText(url.searchParams.get("utm_term")),
    };
  } catch {
    const [pathPart] = cleaned.split("?");
    return {
      originalUrl: cleaned,
      path: normalizeText(pathPart).replace(/^\//, ""),
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      utmContent: "",
      utmTerm: "",
    };
  }
}

function messageMatchesDictionaryKeyword(message, keywords) {
  const normalizedMessage = normalizeCompareText(message);
  if (!normalizedMessage) {
    return false;
  }

  return keywords.some((keyword) => normalizedMessage.includes(normalizeCompareText(keyword)));
}

function getQChatDamValue(message, dataFlag, demandKeywords, alwKeywords) {
  if (dataFlag === "无效数据") {
    return "无需求";
  }

  if (!messageMatchesDictionaryKeyword(message, demandKeywords)) {
    return "无需求";
  }

  return messageMatchesDictionaryKeyword(message, alwKeywords) ? "Con ALW" : "Con NonALW";
}

async function fetchKefuVisitorMap(visitorIds = []) {
  const dedupedIds = Array.from(new Set(visitorIds.map((item) => normalizeText(item)).filter(Boolean)));
  const rows = [];
  const chunkSize = 500;
  const softDelete = await getSoftDeleteMeta("consumer.kefu_visitor");

  for (let index = 0; index < dedupedIds.length; index += chunkSize) {
    const chunk = dedupedIds.slice(index, index + chunkSize);
    if (!chunk.length) {
      continue;
    }
    const placeholders = chunk.map(() => "?").join(", ");
    const chunkRows = await database.query(
      `
        SELECT
          visitor_id,
          member_id,
          url,
          status,
          description,
          createTime
        FROM consumer.kefu_visitor
        WHERE visitor_id IN (${placeholders})${softDelete.whereClause}
      `,
      chunk
    );
    rows.push(...chunkRows);
  }

  return new Map(rows.map((row) => [normalizeText(row.visitor_id), row]));
}

async function buildQChatProcessedRows(rows, period) {
  if (!rows.length) {
    return {
      rawRows: rows,
      processedRows: [QCHAT_PROCESSED_HEADERS],
    };
  }

  const headers = rows[0];
  const bodyRows = rows.slice(1);
  const visitorIds = bodyRows.map((row) => getCell(row, headers, ["社交账号ID"]));
  const visitorMap = await fetchKefuVisitorMap(visitorIds);
  const utmMap = getUtmIdentifierMap();
  const dictionaryAaKeywords = getDictionaryAaKeywords();
  const dictionaryAbKeywords = getDictionaryAbKeywords();

  const processedRows = bodyRows.map((row) => {
    const chatStart = excelSerialToDate(getCell(row, headers, ["会话开始时间"]));
    const rowPeriod = resolvePeriodByDate(chatStart) || period;
    const socialId = normalizeText(getCell(row, headers, ["社交账号ID"]));
    const visitorRecord = visitorMap.get(socialId) || {};
    const parsedUrl = parseTrackedUrl(visitorRecord.url);
    const dataFlag = getChatDataFlagByQuality(getCell(row, headers, ["会话质量"]));
    const dam = getQChatDamValue(getCell(row, headers, ["消息记录"]), dataFlag, dictionaryAaKeywords, dictionaryAbKeywords);
    const damChannel = dam === "无需求" ? "NO" : "YES";
    const uniqueId = utmMap.get(buildUtmMergeKey(parsedUrl.utmSource, parsedUrl.utmCampaign, parsedUrl.utmTerm)) || "";
    const weeklyKey = uniqueId ? `${rowPeriod.keyPrefix}${uniqueId}` : "";

    return [
      getCell(row, headers, ["会话ID"]),
      getCell(row, headers, ["客服"]),
      getCell(row, headers, ["客户"]),
      getCell(row, headers, ["会话通路"]),
      chatStart || getCell(row, headers, ["会话开始时间"]),
      getCell(row, headers, ["会话质量"]),
      getCell(row, headers, ["首次响应时长"]),
      getCell(row, headers, ["会话时长"]),
      socialId,
      getCell(row, headers, ["消息记录"]),
      normalizeText(visitorRecord.visitor_id),
      visitorRecord.member_id ?? "",
      parsedUrl.originalUrl,
      parsedUrl.path,
      parsedUrl.utmSource,
      parsedUrl.utmMedium,
      parsedUrl.utmCampaign,
      parsedUrl.utmContent,
      parsedUrl.utmTerm,
      normalizeText(visitorRecord.status),
      normalizeText(visitorRecord.description),
      visitorRecord.createTime instanceof Date ? visitorRecord.createTime : normalizeText(visitorRecord.createTime),
      dataFlag,
      dam,
      damChannel,
      rowPeriod.fiscalYear,
      rowPeriod.quarter,
      rowPeriod.monthLabel,
      rowPeriod.weekLabel,
      weeklyKey,
      uniqueId,
    ];
  });

  return {
    rawRows: rows,
    processedRows: [QCHAT_PROCESSED_HEADERS, ...processedRows],
  };
}

function getUniqueChannelEntries(workbook = readConfigWorkbook()) {
  const uniqueTable = getTable(workbook, "唯一渠道数据分布");
  const uniqueMap = new Map();

  uniqueTable.rows.forEach((row) => {
    const entry = {
      channel: normalizeText(getCell(row, uniqueTable.headers, ["Channel"])),
      source: normalizeText(getCell(row, uniqueTable.headers, ["Source"])),
      term: normalizeText(getCell(row, uniqueTable.headers, ["Term"])) || "/",
      sourceMerge: normalizeText(getCell(row, uniqueTable.headers, ["来源合并"])) || buildSourceMerge(row[0], row[1], row[2]),
      uniqueId: normalizeText(getCell(row, uniqueTable.headers, ["唯一标识符"])),
    };

    if (entry.uniqueId) {
      uniqueMap.set(entry.uniqueId, entry);
    }
  });

  return Array.from(uniqueMap.values()).sort((left, right) => left.uniqueId.localeCompare(right.uniqueId, "zh-CN"));
}

function getUtmEntries(workbook = readConfigWorkbook()) {
  const utmTable = getTable(workbook, "UTM");
  const utmMap = new Map();

  utmTable.rows.forEach((row) => {
    const entry = {
      utmSource: normalizeNullableText(getCell(row, utmTable.headers, ["广告来源(utm_source)"])),
      utmCampaign: normalizeNullableText(getCell(row, utmTable.headers, ["广告名称(utm_campaign)"])),
      utmTerm: normalizeNullableText(getCell(row, utmTable.headers, ["广告关键字(utm_term)"])),
      mergeKey: normalizeNullableText(getCell(row, utmTable.headers, ["合并"])) || buildWritableUtmMerge(row[0], row[1], row[2]),
      channel: normalizeText(getCell(row, utmTable.headers, ["Channel"])),
      source: normalizeText(getCell(row, utmTable.headers, ["Source"])),
      term: normalizeText(getCell(row, utmTable.headers, ["Term"])) || "/",
      sourceMerge: normalizeText(getCell(row, utmTable.headers, ["来源合并"])),
      uniqueId: normalizeText(getCell(row, utmTable.headers, ["唯一标识符"])),
    };

    if (entry.uniqueId) {
      utmMap.set(buildUtmMergeKey(entry.utmSource, entry.utmCampaign, entry.utmTerm), entry);
    }
  });

  return Array.from(utmMap.values()).sort((left, right) => right.mergeKey.localeCompare(left.mergeKey, "zh-CN"));
}

function buildLatestUnmatchedEntries(rawArtifact = {}) {
  if (Array.isArray(rawArtifact.unmatchedByUtm) && rawArtifact.unmatchedByUtm.length) {
    return rawArtifact.unmatchedByUtm;
  }

  const counts = new Map();
  for (const row of rawArtifact.unmatchedSample || []) {
    const key = buildWritableUtmMerge(row.utm_source, row.utm_campaign, row.utm_term);
    if (!counts.has(key)) {
      counts.set(key, {
        utmSource: normalizeNullableText(row.utm_source),
        utmCampaign: normalizeNullableText(row.utm_campaign),
        utmTerm: normalizeNullableText(row.utm_term),
        count: 0,
      });
    }
    counts.get(key).count += 1;
  }

  return Array.from(counts.values()).sort((left, right) => right.count - left.count);
}

function getLatestUnmatchedUtmEntries() {
  if (!fs.existsSync(OUTPUTS_DIR)) {
    return { periodLabel: "", items: [], totalItems: 0, resolvedItems: 0 };
  }

  const candidates = fs
    .readdirSync(OUTPUTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dirPath = path.join(OUTPUTS_DIR, entry.name);
      const combinedArtifactPath = path.join(dirPath, "utm_data.json");
      const legacyArtifactPath = path.join(dirPath, "unionid_data.json");
      const artifactPath = fs.existsSync(combinedArtifactPath) ? combinedArtifactPath : legacyArtifactPath;
      if (!fs.existsSync(artifactPath)) {
        return null;
      }

      const stat = fs.statSync(artifactPath);
      return {
        dirName: entry.name,
        artifactPath,
        updatedAt: stat.mtimeMs,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.updatedAt - left.updatedAt);

  if (!candidates.length) {
    return { periodLabel: "", items: [], totalItems: 0, resolvedItems: 0 };
  }

  const latest = candidates[0];
  const rawArtifact = JSON.parse(fs.readFileSync(latest.artifactPath, "utf8"));
  const period = rawArtifact.period || {};
  const utmMap = getUtmIdentifierMap();
  const allItems = buildLatestUnmatchedEntries(rawArtifact);
  const items = allItems.filter(
    (entry) => !utmMap.has(buildUtmMergeKey(entry.utmSource, entry.utmCampaign, entry.utmTerm))
  );

  return {
    periodLabel: [period.fiscalYear, period.quarter, period.week].filter(Boolean).join(" "),
    items,
    totalItems: allItems.length,
    resolvedItems: allItems.length - items.length,
  };
}

function getConfigEditorData() {
  const workbook = readConfigWorkbook();
  return {
    uniqueChannels: getUniqueChannelEntries(workbook),
    utmMappings: getUtmEntries(workbook),
    latestUnmatched: getLatestUnmatchedUtmEntries(),
  };
}

function upsertUniqueChannelEntry(input = {}) {
  const channel = normalizeText(input.channel);
  const source = normalizeText(input.source);
  const term = normalizeText(input.term) || "/";
  const uniqueId = normalizeText(input.uniqueId);

  if (!channel || !source || !uniqueId) {
    throw new Error("唯一渠道必须填写 Channel、Source 和 唯一标识符");
  }

  const workbook = readConfigWorkbook();
  const uniqueTable = getTable(workbook, "唯一渠道数据分布");
  const utmTable = getTable(workbook, "UTM");
  const nextEntry = {
    channel,
    source,
    term,
    sourceMerge: buildSourceMerge(channel, source, term),
    uniqueId,
  };

  const uniqueRows = getUniqueChannelEntries(workbook);
  const existingIndex = uniqueRows.findIndex((entry) => entry.uniqueId === uniqueId);
  if (existingIndex >= 0) {
    uniqueRows[existingIndex] = nextEntry;
  } else {
    uniqueRows.push(nextEntry);
  }
  uniqueRows.sort((left, right) => left.uniqueId.localeCompare(right.uniqueId, "zh-CN"));

  const utmRows = getUtmEntries(workbook).map((entry) => {
    if (entry.uniqueId !== uniqueId) {
      return entry;
    }

    return {
      ...entry,
      channel,
      source,
      term,
      sourceMerge: nextEntry.sourceMerge,
      uniqueId,
    };
  });

  writeAoAToSheet(
    workbook,
    "唯一渠道数据分布",
    [UNIQUE_CHANNEL_HEADERS, ...uniqueRows.map((entry) => [entry.channel, entry.source, entry.term, entry.sourceMerge, entry.uniqueId])]
  );
  writeAoAToSheet(
    workbook,
    "UTM",
    [UTM_HEADERS, ...utmRows.map((entry) => [entry.utmSource, entry.utmCampaign, entry.utmTerm, entry.mergeKey, entry.channel, entry.source, entry.term, entry.sourceMerge, entry.uniqueId])]
  );
  XLSX.writeFile(workbook, CONFIG_PATH);

  return {
    saved: nextEntry,
    editor: getConfigEditorData(),
  };
}

function upsertUtmEntry(input = {}) {
  const utmSource = normalizeNullableText(input.utmSource);
  const utmCampaign = normalizeNullableText(input.utmCampaign);
  const utmTerm = normalizeNullableText(input.utmTerm);
  const uniqueId = normalizeText(input.uniqueId);

  const payload = upsertUtmEntries(
    [
      {
        utmSource,
        utmCampaign,
        utmTerm,
      },
    ],
    uniqueId
  );

  return {
    saved: payload.savedEntries[0],
    editor: payload.editor,
  };
}

function upsertUtmEntries(items = [], uniqueIdInput = "") {
  const uniqueId = normalizeText(uniqueIdInput);
  if (!uniqueId) {
    throw new Error("UTM 映射必须先选择唯一标识符");
  }

  const normalizedItems = items
    .map((item) => ({
      utmSource: normalizeNullableText(item.utmSource),
      utmCampaign: normalizeNullableText(item.utmCampaign),
      utmTerm: normalizeNullableText(item.utmTerm),
    }))
    .filter((item) => item.utmSource || item.utmCampaign || item.utmTerm);

  if (!normalizedItems.length) {
    throw new Error("请至少选择一条未匹配 UTM");
  }

  const workbook = readConfigWorkbook();
  const uniqueRows = getUniqueChannelEntries(workbook);
  const uniqueEntry = uniqueRows.find((entry) => entry.uniqueId === uniqueId);
  if (!uniqueEntry) {
    throw new Error("当前唯一标识符不存在，请先在线补充唯一渠道");
  }

  const dedupedItems = new Map();
  normalizedItems.forEach((item) => {
    dedupedItems.set(buildUtmMergeKey(item.utmSource, item.utmCampaign, item.utmTerm), item);
  });

  const utmRows = getUtmEntries(workbook);
  const savedEntries = [];

  for (const item of dedupedItems.values()) {
    const nextEntry = {
      utmSource: item.utmSource,
      utmCampaign: item.utmCampaign,
      utmTerm: item.utmTerm,
      mergeKey: buildWritableUtmMerge(item.utmSource, item.utmCampaign, item.utmTerm),
      channel: uniqueEntry.channel,
      source: uniqueEntry.source,
      term: uniqueEntry.term,
      sourceMerge: uniqueEntry.sourceMerge,
      uniqueId,
    };

    const existingIndex = utmRows.findIndex(
      (entry) => buildUtmMergeKey(entry.utmSource, entry.utmCampaign, entry.utmTerm) === buildUtmMergeKey(item.utmSource, item.utmCampaign, item.utmTerm)
    );
    if (existingIndex >= 0) {
      utmRows[existingIndex] = nextEntry;
    } else {
      utmRows.push(nextEntry);
    }
    savedEntries.push(nextEntry);
  }

  utmRows.sort((left, right) => left.uniqueId.localeCompare(right.uniqueId, "zh-CN") || left.mergeKey.localeCompare(right.mergeKey, "zh-CN"));

  writeAoAToSheet(
    workbook,
    "UTM",
    [UTM_HEADERS, ...utmRows.map((entry) => [entry.utmSource, entry.utmCampaign, entry.utmTerm, entry.mergeKey, entry.channel, entry.source, entry.term, entry.sourceMerge, entry.uniqueId])]
  );
  XLSX.writeFile(workbook, CONFIG_PATH);

  return {
    savedEntries,
    editor: getConfigEditorData(),
  };
}

function extractUniqueIdentifier(row, headers, period) {
  const direct = normalizeText(getCell(row, headers, ["唯一标识符"]));
  if (direct) {
    return direct;
  }

  const keyLike = normalizeText(getCell(row, headers, ["关键标识符", "当周数据匹配"], 0));
  if (keyLike && keyLike.startsWith(period.keyPrefix)) {
    return keyLike.slice(period.keyPrefix.length);
  }

  return "";
}

function rowMatchesPeriod(row, headers, period) {
  const uniqueKey = normalizeText(getCell(row, headers, ["关键标识符", "当周数据匹配"]));
  if (uniqueKey && uniqueKey.startsWith(period.keyPrefix)) {
    return true;
  }

  const year = normalizeText(getCell(row, headers, ["Year"]));
  const quarter = normalizeText(getCell(row, headers, ["Quarter"]));
  const week = normalizeText(getCell(row, headers, ["Week"]));
  const fiscalQuarter = normalizeText(getCell(row, headers, ["Fiscal_Quarter"]));
  const fiscalWeek = normalizeText(getCell(row, headers, ["Fiscal_Week"]));

  if (
    year === period.fiscalYear &&
    quarter === period.quarter &&
    [period.weekLabel, period.shortWeek].includes(week)
  ) {
    return true;
  }

  if (quarter === period.fiscalQuarter && [period.weekLabel, period.shortWeek].includes(week)) {
    return true;
  }

  if (fiscalQuarter === period.fiscalQuarter && fiscalWeek === period.fiscalWeek) {
    return true;
  }

  return false;
}

function sumByUniqueIdentifier(table, period, options = {}) {
  const map = new Map();
  const unmatched = [];

  for (const row of table.rows) {
    if (!rowMatchesPeriod(row, table.headers, period)) {
      continue;
    }

    if (options.predicate && !options.predicate(row, table.headers)) {
      continue;
    }

    const uniqueId = extractUniqueIdentifier(row, table.headers, period);
    if (!uniqueId) {
      unmatched.push(row);
      continue;
    }

    const current = map.get(uniqueId) || 0;
    const amount = options.value ? options.value(row, table.headers) : 1;
    map.set(uniqueId, current + amount);
  }

  return { map, unmatched };
}

function buildPeriodSqlRange(period) {
  const rangeStart = new Date(period.startDate.getTime());
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(period.endDate.getTime());
  rangeEnd.setDate(rangeEnd.getDate() + 1);
  rangeEnd.setHours(0, 0, 0, 0);

  return {
    start: formatSqlDateTime(rangeStart),
    end: formatSqlDateTime(rangeEnd),
  };
}

function normalizeDbDateTime(value) {
  if (value instanceof Date) {
    return formatSqlDateTime(value);
  }

  return normalizeText(value);
}

function normalizeDbMetricRow(row, extra = {}) {
  return {
    ...extra,
    create_time: normalizeDbDateTime(row.create_time),
    delete_time: normalizeDbDateTime(row.delete_time),
    member_id: normalizeText(row.member_id),
    mobile: normalizeText(row.mobile),
    union_id: normalizeText(row.union_id),
    order_id: normalizeText(row.order_id),
    utm_term: normalizeNullableText(row.utm_term),
    utm_content: normalizeNullableText(row.utm_content),
    utm_medium: normalizeNullableText(row.utm_medium),
    utm_source: normalizeNullableText(row.utm_source),
    utm_campaign: normalizeNullableText(row.utm_campaign),
  };
}

async function getTableColumns(tableName) {
  if (!TABLE_COLUMNS_CACHE.has(tableName)) {
    const rows = await database.describeTable(tableName);
    TABLE_COLUMNS_CACHE.set(
      tableName,
      new Set(rows.map((row) => normalizeCompareText(row.Field)))
    );
  }

  return TABLE_COLUMNS_CACHE.get(tableName);
}

async function getSoftDeleteMeta(tableName, alias = "") {
  const columns = await getTableColumns(tableName);
  const hasDeleteTime = columns.has("deletetime");
  const qualified = alias ? `${alias}.delete_time` : "delete_time";

  return {
    hasDeleteTime,
    selectClause: hasDeleteTime ? `, ${qualified} AS delete_time` : "",
    whereClause: hasDeleteTime ? ` AND ${qualified} IS NULL` : "",
  };
}

function getFallbackDedupeKey(row, fieldCandidates = []) {
  for (const fieldName of fieldCandidates) {
    const value = normalizeText(row[fieldName]);
    if (value) {
      return value;
    }
  }

  return "";
}

function aggregateNormalizedRowsByUtm(rows, options = {}) {
  const utmMap = options.utmMap || getUtmIdentifierMap();
  const map = new Map();
  const unmatchedRows = [];
  const dedupeMap = new Map();
  let matchedRows = 0;

  rows.forEach((row, index) => {
    if (options.rowFilter && !options.rowFilter(row, index)) {
      return;
    }

    const uniqueId = getUniqueIdFromUtmValues(utmMap, row.utm_source, row.utm_campaign, row.utm_term);
    if (!uniqueId) {
      unmatchedRows.push(row);
      return;
    }

    matchedRows += 1;
    const amount = options.valueResolver ? options.valueResolver(row, index) : 1;
    if (!Number.isFinite(amount) || amount === 0) {
      return;
    }

    const dedupeKey = options.dedupeKey ? normalizeText(options.dedupeKey(row, index)) : "";
    if (dedupeKey) {
      if (!dedupeMap.has(uniqueId)) {
        dedupeMap.set(uniqueId, new Set());
      }

      const seen = dedupeMap.get(uniqueId);
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);
    }

    map.set(uniqueId, (map.get(uniqueId) || 0) + amount);
  });

  return {
    map,
    queriedRows: rows.length,
    matchedRows,
    unmatchedRows,
    rawRows: rows,
  };
}

async function fetchSimpleMetricSourceFromDatabase(period, config = {}) {
  const alias = config.alias || "t";
  const dateColumn = config.dateColumn || "create_time";
  const periodRange = buildPeriodSqlRange(period);
  const softDelete = await getSoftDeleteMeta(config.tableName, alias);
  const selectColumns = [
    ...(config.selectColumns || []),
    softDelete.hasDeleteTime ? `${alias}.delete_time AS delete_time` : "",
  ].filter(Boolean);

  const sql = `
    SELECT
      ${selectColumns.join(",\n      ")}
    FROM ${config.tableName} ${alias}
    WHERE ${alias}.${dateColumn} >= ? AND ${alias}.${dateColumn} < ?${softDelete.whereClause}${config.extraWhere ? ` AND ${config.extraWhere}` : ""}
    ORDER BY ${alias}.${dateColumn} ASC
  `;
  const rows = await database.query(sql, [periodRange.start, periodRange.end, ...(config.params || [])]);
  const normalizedRows = rows.map((row, index) =>
    config.normalizeRow ? config.normalizeRow(row, index) : normalizeDbMetricRow(row)
  );

  return aggregateNormalizedRowsByUtm(normalizedRows, {
    dedupeKey: config.dedupeKey,
    valueResolver: config.valueResolver,
  });
}

async function fetchUnionidSourceFromDatabase(period) {
  const periodRange = buildPeriodSqlRange(period);
  const softDelete = await getSoftDeleteMeta("consumer.member_wx");

  const rows = await database.query(
    `
      SELECT
        union_id,
        create_time,
        utm_term,
        utm_content,
        utm_medium,
        utm_source,
        utm_campaign
      FROM consumer.member_wx
      WHERE create_time >= ? AND create_time < ?${softDelete.whereClause}
      ORDER BY create_time ASC
    `,
    [periodRange.start, periodRange.end]
  );

  const utmMap = getUtmIdentifierMap();
  const aggregated = new Map();
  const unmatchedRows = [];
  const normalizedRows = [];

  for (const row of rows) {
    const normalized = {
      union_id: normalizeText(row.union_id),
      create_time: row.create_time instanceof Date ? formatSqlDateTime(row.create_time) : normalizeText(row.create_time),
      utm_term: normalizeNullableText(row.utm_term),
      utm_content: normalizeNullableText(row.utm_content),
      utm_medium: normalizeNullableText(row.utm_medium),
      utm_source: normalizeNullableText(row.utm_source),
      utm_campaign: normalizeNullableText(row.utm_campaign),
    };
    normalizedRows.push(normalized);

    const mergeKey = buildUtmMergeKey(normalized.utm_source, normalized.utm_campaign, normalized.utm_term);
    const uniqueId = utmMap.get(mergeKey);
    if (!uniqueId) {
      unmatchedRows.push(normalized);
      continue;
    }

    aggregated.set(uniqueId, (aggregated.get(uniqueId) || 0) + 1);
  }

  return {
    map: aggregated,
    queriedRows: rows.length,
    matchedRows: rows.length - unmatchedRows.length,
    unmatchedRows,
    rawRows: normalizedRows,
  };
}

async function fetchMemberSourceFromDatabase(period) {
  const periodRange = buildPeriodSqlRange(period);
  const softDelete = await getSoftDeleteMeta("consumer.member");

  const rows = await database.query(
    `
      SELECT
        mobile,
        create_time,
        old_mobile,
        old_member,
        utm_term,
        utm_content,
        utm_medium,
        utm_source,
        utm_campaign
        ${softDelete.selectClause}
      FROM consumer.member
      WHERE create_time >= ? AND create_time < ?${softDelete.whereClause}
      ORDER BY create_time ASC
    `,
    [periodRange.start, periodRange.end]
  );

  const utmMap = getUtmIdentifierMap();
  const userMap = new Map();
  const oldMemberMap = new Map();
  const unmatchedRows = [];
  const normalizedRows = [];

  for (const row of rows) {
    const normalized = {
      mobile: normalizeText(row.mobile),
      create_time: row.create_time instanceof Date ? formatSqlDateTime(row.create_time) : normalizeText(row.create_time),
      old_mobile: normalizeNullableText(row.old_mobile),
      old_member: Number(row.old_member || 0),
      utm_term: normalizeNullableText(row.utm_term),
      utm_content: normalizeNullableText(row.utm_content),
      utm_medium: normalizeNullableText(row.utm_medium),
      utm_source: normalizeNullableText(row.utm_source),
      utm_campaign: normalizeNullableText(row.utm_campaign),
    };
    normalizedRows.push(normalized);

    const mergeKey = buildUtmMergeKey(normalized.utm_source, normalized.utm_campaign, normalized.utm_term);
    const uniqueId = utmMap.get(mergeKey);
    if (!uniqueId) {
      unmatchedRows.push(normalized);
      continue;
    }

    userMap.set(uniqueId, (userMap.get(uniqueId) || 0) + 1);
    if (normalized.old_member === 1) {
      oldMemberMap.set(uniqueId, (oldMemberMap.get(uniqueId) || 0) + 1);
    }
  }

  return {
    userMap,
    oldMemberMap,
    queriedRows: rows.length,
    matchedRows: rows.length - unmatchedRows.length,
    unmatchedRows,
    rawRows: normalizedRows,
  };
}

async function fetchAnniversarySourceFromDatabase(period) {
  return fetchSimpleMetricSourceFromDatabase(period, {
    tableName: "consumer.interaction_log",
    alias: "il",
    selectColumns: [
      "il.id",
      "il.member_id",
      "il.create_time",
      "il.category1",
      "il.utm_term",
      "il.utm_content",
      "il.utm_medium",
      "il.utm_source",
      "il.utm_campaign",
    ],
    extraWhere: "il.category1 = ?",
    params: ["周年庆"],
    normalizeRow: (row) =>
      normalizeDbMetricRow(row, {
        id: normalizeText(row.id),
        category1: normalizeText(row.category1),
      }),
    dedupeKey: (row) => getFallbackDedupeKey(row, ["member_id", "id"]),
  });
}

async function fetchLuckySourceFromDatabase(period) {
  return fetchSimpleMetricSourceFromDatabase(period, {
    tableName: "consumer.lucky_log",
    alias: "ll",
    selectColumns: [
      "ll.log_id",
      "ll.member_id",
      "ll.create_time",
      "ll.utm_term",
      "ll.utm_content",
      "ll.utm_medium",
      "ll.utm_source",
      "ll.utm_campaign",
    ],
    normalizeRow: (row) =>
      normalizeDbMetricRow(row, {
        log_id: normalizeText(row.log_id),
      }),
    dedupeKey: (row) => getFallbackDedupeKey(row, ["member_id", "log_id"]),
  });
}

async function fetchTryApplySourceFromDatabase(period) {
  return fetchSimpleMetricSourceFromDatabase(period, {
    tableName: "consumer.try_apply",
    alias: "ta",
    selectColumns: [
      "ta.id",
      "ta.try_id",
      "ta.member_id",
      "ta.create_time",
      "ta.utm_term",
      "ta.utm_content",
      "ta.utm_medium",
      "ta.utm_source",
      "ta.utm_campaign",
    ],
    normalizeRow: (row) =>
      normalizeDbMetricRow(row, {
        id: normalizeText(row.id),
        try_id: normalizeText(row.try_id),
      }),
    dedupeKey: (row) => getFallbackDedupeKey(row, ["member_id", "try_id", "id"]),
  });
}

async function fetchSubscriptionSourceFromDatabase(period) {
  return fetchSimpleMetricSourceFromDatabase(period, {
    tableName: "consumer.message_subscribe_log",
    alias: "msl",
    selectColumns: [
      "msl.id",
      "msl.member_id",
      "msl.create_time",
      "msl.utm_term",
      "msl.utm_content",
      "msl.utm_medium",
      "msl.utm_source",
      "msl.utm_campaign",
    ],
    normalizeRow: (row) =>
      normalizeDbMetricRow(row, {
        id: normalizeText(row.id),
      }),
    dedupeKey: (row) => getFallbackDedupeKey(row, ["member_id", "id"]),
  });
}

async function fetchCouponSourceFromDatabase(period) {
  const periodRange = buildPeriodSqlRange(period);
  const couponDelete = await getSoftDeleteMeta("consumer.member_coupon", "mc");

  const rows = await database.query(
    `
      SELECT
        mc.id AS member_coupon_id,
        mc.member_id,
        mc.coupon_code_id,
        mc.create_time,
        COALESCE(mu.utm_term, '') AS utm_term,
        COALESCE(mu.utm_content, '') AS utm_content,
        COALESCE(mu.utm_medium, '') AS utm_medium,
        COALESCE(mu.utm_source, '') AS utm_source,
        COALESCE(mu.utm_campaign, '') AS utm_campaign
        ${couponDelete.selectClause}
      FROM consumer.member_coupon mc
      LEFT JOIN consumer.member_coupon_utm mu
        ON mu.member_coupon_id = mc.id
      WHERE mc.create_time >= ? AND mc.create_time < ?${couponDelete.whereClause}
      ORDER BY mc.create_time ASC
    `,
    [periodRange.start, periodRange.end]
  );

  const normalizedRows = rows.map((row) =>
    normalizeDbMetricRow(row, {
      member_coupon_id: normalizeText(row.member_coupon_id),
      coupon_code_id: normalizeText(row.coupon_code_id),
    })
  );

  return aggregateNormalizedRowsByUtm(normalizedRows, {
    dedupeKey: (row) => getFallbackDedupeKey(row, ["member_id", "member_coupon_id", "coupon_code_id"]),
  });
}

async function fetchPointsSourceFromDatabase(period) {
  const periodRange = buildPeriodSqlRange(period);
  const pointsDelete = await getSoftDeleteMeta("consumer.member_points_log", "mpl");
  const memberDelete = await getSoftDeleteMeta("consumer.member", "m");

  const rows = await database.query(
    `
      SELECT
        mpl.id,
        mpl.member_id,
        mpl.create_time,
        mpl.type,
        mpl.points,
        mpl.remark,
        COALESCE(NULLIF(mpl.utm_term, ''), NULLIF(m.utm_term, ''), '') AS utm_term,
        COALESCE(NULLIF(mpl.utm_content, ''), NULLIF(m.utm_content, ''), '') AS utm_content,
        COALESCE(NULLIF(mpl.utm_medium, ''), NULLIF(m.utm_medium, ''), '') AS utm_medium,
        COALESCE(NULLIF(mpl.utm_source, ''), NULLIF(m.utm_source, ''), '') AS utm_source,
        COALESCE(NULLIF(mpl.utm_campaign, ''), NULLIF(m.utm_campaign, ''), '') AS utm_campaign
        ${pointsDelete.selectClause}
      FROM consumer.member_points_log mpl
      LEFT JOIN consumer.member m
        ON m.id = mpl.member_id${memberDelete.whereClause}
      WHERE mpl.create_time >= ? AND mpl.create_time < ?${pointsDelete.whereClause}
      ORDER BY mpl.create_time ASC
    `,
    [periodRange.start, periodRange.end]
  );

  const normalizedRows = rows.map((row) =>
    normalizeDbMetricRow(row, {
      id: normalizeText(row.id),
      type: normalizeText(row.type),
      points: asNumber(row.points),
      remark: normalizeText(row.remark),
    })
  );

  return aggregateNormalizedRowsByUtm(normalizedRows);
}

async function fetchOrderSourceFromDatabase(period) {
  const periodRange = buildPeriodSqlRange(period);
  const orderDelete = await getSoftDeleteMeta("consumer.order", "o");
  const clueDelete = await getSoftDeleteMeta("consumer.clue", "c");
  const historyDelete = await getSoftDeleteMeta("consumer.clue_history", "ch");

  const rows = await database.query(
    `
      SELECT
        o.order_id,
        o.member_id,
        o.create_time,
        o.type,
        o.utm_term,
        o.utm_content,
        o.utm_medium,
        o.utm_source,
        o.utm_campaign,
        EXISTS (
          SELECT 1
          FROM consumer.clue c
          JOIN consumer.clue_history ch
            ON ch.clue_id = c.id${historyDelete.whereClause}
          WHERE c.object_id = o.order_id${clueDelete.whereClause}
            AND ch.remark LIKE '【有效商机 / 已成单】%'
        ) AS has_success_remark
        ${orderDelete.selectClause}
      FROM consumer.order o
      WHERE o.create_time >= ? AND o.create_time < ?${orderDelete.whereClause}
      ORDER BY o.create_time ASC
    `,
    [periodRange.start, periodRange.end]
  );

  const normalizedRows = rows.map((row) =>
    normalizeDbMetricRow(row, {
      type: normalizeText(row.type),
      has_success_remark: Number(row.has_success_remark || 0) === 1,
    })
  );

  const report = aggregateNormalizedRowsByUtm(normalizedRows.filter((row) => row.type === "report"));
  const offline = aggregateNormalizedRowsByUtm(normalizedRows.filter((row) => row.type === "offline"));
  const flash = aggregateNormalizedRowsByUtm(normalizedRows.filter((row) => row.type === "flash"));
  const success = aggregateNormalizedRowsByUtm(
    normalizedRows.filter((row) => row.type === "report" && row.has_success_remark)
  );
  const unmatchedRows = Array.from(
    normalizedRows.reduce((map, row) => {
      const mergeKey = buildWritableUtmMerge(row.utm_source, row.utm_campaign, row.utm_term);
      if (!map.has(mergeKey) && !getUniqueIdFromUtmValues(getUtmIdentifierMap(), row.utm_source, row.utm_campaign, row.utm_term)) {
        map.set(mergeKey, row);
      }
      return map;
    }, new Map()).values()
  );

  return {
    reportMap: report.map,
    offlineMap: offline.map,
    flashMap: flash.map,
    successMap: success.map,
    queriedRows: normalizedRows.length,
    matchedRows: normalizedRows.length - unmatchedRows.length,
    unmatchedRows,
    rawRows: normalizedRows,
  };
}

function getDateFromRow(row, headers, period) {
  const dateValue =
    getCell(row, headers, ["Call Date"]) ||
    getCell(row, headers, ["呼叫开始时间"]) ||
    getCell(row, headers, ["会话开始时间"]) ||
    getCell(row, headers, ["下单时间"]);

  const date = normalizeImportedBusinessDate(excelSerialToDate(dateValue));
  if (date) {
    return date;
  }

  return period.endDate;
}

function normalizePhone(value) {
  const normalized = normalizeText(value).replace(/\.0$/, "");
  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized) || /^访客/i.test(normalized) || /[^\x00-\x7F]/.test(normalized.replace(/[\u4e00-\u9fa5]/g, ""))) {
    return "";
  }

  let digits = normalized.replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length > 11 && digits.startsWith("86")) {
    digits = digits.slice(-11);
  }
  if (digits.length > 11) {
    digits = digits.slice(-11);
  }

  return digits;
}

function matchesPeriodFromDateValue(dateValue, period) {
  const date = normalizeImportedBusinessDate(excelSerialToDate(dateValue));
  if (!date) {
    return false;
  }
  const rowPeriod = resolvePeriodByDate(date);
  return !!rowPeriod && rowPeriod.fiscalYear === period.fiscalYear && rowPeriod.quarter === period.quarter && rowPeriod.weekNumber === period.weekNumber;
}

function getStandardUtmValues(row, headers) {
  return {
    utmSource: normalizeNullableText(getCell(row, headers, ["广告来源 (utm_source)", "广告来源(utm_source)"])),
    utmCampaign: normalizeNullableText(getCell(row, headers, ["广告名称 (utm_campaign)", "广告名称(utm_campaign)"])),
    utmTerm: normalizeNullableText(getCell(row, headers, ["广告关键字 (utm_term)", "广告关键字(utm_term)"])),
    utmContent: normalizeNullableText(getCell(row, headers, ["广告内容 (utm_content)", "广告内容(utm_content)"])),
    utmMedium: normalizeNullableText(getCell(row, headers, ["广告媒介 (utm_medium)", "广告媒介(utm_medium)"])),
  };
}

function getGioUtmValues(row, headers) {
  return {
    utmSource: normalizeNullableText(getCell(row, headers, ["广告来源", "广告来源(utm_source)", "广告来源 (utm_source)"])),
    utmCampaign: normalizeNullableText(getCell(row, headers, ["广告名称", "广告名称(utm_campaign)", "广告名称 (utm_campaign)"])),
    utmTerm: normalizeNullableText(
      getCell(row, headers, ["广告关键字", "广告关键词", "广告关键字(utm_term)", "广告关键词(utm_term)", "广告关键字 (utm_term)", "广告关键词 (utm_term)"])
    ),
  };
}

function getUniqueIdFromUtmValues(utmMap, utmSource, utmCampaign, utmTerm) {
  return utmMap.get(buildUtmMergeKey(utmSource, utmCampaign, utmTerm)) || "";
}

function getUniqueIdFromStandardUtmRow(row, headers, utmMap) {
  const utm = getStandardUtmValues(row, headers);
  return {
    ...utm,
    uniqueId: getUniqueIdFromUtmValues(utmMap, utm.utmSource, utm.utmCampaign, utm.utmTerm),
  };
}

function getUniqueIdFromUrlField(row, headers, utmMap, fieldCandidates = ["企点QQ渠道"]) {
  const parsedUrl = parseTrackedUrl(getCell(row, headers, fieldCandidates));
  return {
    parsedUrl,
    uniqueId: getUniqueIdFromUtmValues(utmMap, parsedUrl.utmSource, parsedUrl.utmCampaign, parsedUrl.utmTerm),
  };
}

function aggregateGioRows(table, utmMap) {
  const pvMap = new Map();
  const uvMap = new Map();
  const unmatchedRows = [];
  const normalizedRows = [];

  for (const row of table.rows) {
    const utm = getGioUtmValues(row, table.headers);
    const normalized = {
      target_user: normalizeText(getCell(row, table.headers, ["目标用户"])),
      utm_source: utm.utmSource,
      utm_campaign: utm.utmCampaign,
      utm_term: utm.utmTerm,
      user_count: asNumber(getCell(row, table.headers, ["用户量"])),
      page_view_count: asNumber(getCell(row, table.headers, ["页面浏览量"])),
    };
    normalizedRows.push(normalized);

    const uniqueId = getUniqueIdFromUtmValues(utmMap, normalized.utm_source, normalized.utm_campaign, normalized.utm_term);
    if (!uniqueId) {
      unmatchedRows.push(normalized);
      continue;
    }

    pvMap.set(uniqueId, (pvMap.get(uniqueId) || 0) + normalized.page_view_count);
    uvMap.set(uniqueId, (uvMap.get(uniqueId) || 0) + normalized.user_count);
  }

  return {
    pvMap,
    uvMap,
    queriedRows: normalizedRows.length,
    matchedRows: normalizedRows.length - unmatchedRows.length,
    unmatchedRows,
    rawRows: normalizedRows,
  };
}

function buildLeadSourceReference(workbook, utmMap) {
  const leadIdToUniqueId = new Map();
  const phoneToUniqueId = new Map();
  const tables = [getTable(workbook, "Weily Offline"), getTable(workbook, "Sunny Offline")];

  for (const table of tables) {
    for (const row of table.rows) {
      const { uniqueId } = getUniqueIdFromStandardUtmRow(row, table.headers, utmMap);
      if (!uniqueId) {
        continue;
      }

      const leadId = normalizeText(getCell(row, table.headers, ["Leads ID", "Leads_ID"]));
      const phone = normalizePhone(getCell(row, table.headers, ["手机号", "Phone", "电话号码"]));

      if (leadId && !leadIdToUniqueId.has(leadId)) {
        leadIdToUniqueId.set(leadId, uniqueId);
      }
      if (phone && !phoneToUniqueId.has(phone)) {
        phoneToUniqueId.set(phone, uniqueId);
      }
    }
  }

  return { leadIdToUniqueId, phoneToUniqueId };
}

function aggregateRowsByMap(table, period, options = {}) {
  const map = new Map();
  const unmatched = [];

  for (const row of table.rows) {
    const dateValue = getCell(row, table.headers, options.dateHeaders || []);
    if (!matchesPeriodFromDateValue(dateValue, period)) {
      continue;
    }

    if (options.predicate && !options.predicate(row, table.headers)) {
      continue;
    }

    const uniqueId = options.uniqueIdResolver ? options.uniqueIdResolver(row, table.headers) : "";
    if (!uniqueId) {
      unmatched.push(row);
      continue;
    }

    map.set(uniqueId, (map.get(uniqueId) || 0) + 1);
  }

  return { map, unmatched };
}

function buildSunnyDam(row, headers, alwKeywords) {
  const hasDemand = normalizeText(getCell(row, headers, ["是否有需求"])) !== "否";
  if (!hasDemand) {
    return { dam: "无需求", damChannel: "NO" };
  }

  const interestProduct = getCell(row, headers, ["感兴趣产品"]);
  const dam = messageMatchesDictionaryKeyword(interestProduct, alwKeywords) ? "Con ALW" : "Con NonALW";
  return {
    dam,
    damChannel: dam === "无需求" ? "NO" : "YES",
  };
}

function buildFunnelOrderFlags(row, headers) {
  const pendingReason = normalizeText(getCell(row, headers, ["Pending Reason 1类"]));
  const rtm = normalizeText(getCell(row, headers, ["RTM"]));
  const source = normalizeText(getCell(row, headers, ["Source"]));
  const wechatName = normalizeText(getCell(row, headers, ["微信名"]));
  const qidianChannel = normalizeText(getCell(row, headers, ["企点QQ渠道"]));
  const isQidian =
    pendingReason === "已付款" &&
    (rtm === "企点" ||
      source === "企点" ||
      normalizeCompareText(qidianChannel).includes("pages") ||
      normalizeCompareText(wechatName).includes("访客"));

  return {
    isPaid: pendingReason === "已付款",
    isQidian,
  };
}

function getUnmatchedSummary(unmatchedBySheet) {
  return Object.entries(unmatchedBySheet)
    .map(([sheetName, count]) => ({ sheetName, count }))
    .filter((entry) => entry.count > 0);
}

function getUserBaseRows(workbook, period) {
  const configWorkbook = readWorkbook(CONFIG_PATH);
  const uniqueTable = getTable(configWorkbook, "唯一渠道数据分布");
  const existingTable = getTable(workbook, "UserRawdata");
  const existingRows = new Map();

  for (const row of existingTable.rows) {
    if (!rowMatchesPeriod(row, existingTable.headers, period)) {
      continue;
    }

    const uniqueId = normalizeText(getCell(row, existingTable.headers, ["唯一标识符"]));
    if (!uniqueId) {
      continue;
    }

    const snapshot = {};
    existingTable.headers.forEach((header, index) => {
      snapshot[header] = row[index] ?? "";
    });
    existingRows.set(uniqueId, snapshot);
  }

  const rows = [];
  const order = [];

  for (const row of uniqueTable.rows) {
    const channel = normalizeText(getCell(row, uniqueTable.headers, ["Channel"]));
    const source = normalizeText(getCell(row, uniqueTable.headers, ["Source"]));
    const term = normalizeText(getCell(row, uniqueTable.headers, ["Term"])) || "/";
    const uniqueId = normalizeText(getCell(row, uniqueTable.headers, ["唯一标识符"]));

    if (!uniqueId) {
      continue;
    }

    order.push(uniqueId);

    const previous = existingRows.get(uniqueId) || {};
    const base = {
      Year: period.fiscalYear,
      Quarter: period.quarter,
      Month: previous.Month || period.monthLabel,
      Week: period.weekLabel,
      当周数据匹配: `${period.keyPrefix}${uniqueId}`,
      分类: previous["分类"] || "用户身份",
      Channel: channel,
      Source: source,
      Term: term,
      唯一标识符: uniqueId,
      触达人数: previous["触达人数"] || 0,
      触达成功数: previous["触达成功数"] || 0,
      PV: 0,
      UV: 0,
      Unionid: 0,
      User: 0,
      "New User": 0,
      Chat: 0,
      "Chat 需求": 0,
      商机收集: 0,
      表单外呼: 0,
      "Chat 标记 ": 0,
      Funel: previous.Funel || 0,
      Pengjian: 0,
      机器人: 0,
      B2B: 0,
      订单数据: previous["订单数据"] || previous["报价单"] || 0,
      线下订单: previous["线下订单"] || previous.dm占位2 || 0,
      dm占位3: previous.dm占位3 || 0,
      sum: 0,
      领取积分: 0,
      是否领取优惠券: 0,
      是否订阅: 0,
      "0元试用": 0,
      老用户激活: 0,
      新品预约: 0,
      秒杀: 0,
      抽奖: 0,
      周年庆: 0,
      互动汇总: 0,
      企点成单数据: previous["企点成单数据"] || previous.Chat成单 || 0,
      报价单成单: 0,
      "Phone call 成单": previous["Phone call 成单"] || previous["pengjian 成单"] || 0,
    };

    rows.push(base);
  }

  return { rows, order };
}

function getMapValue(map, uniqueId) {
  return map.get(uniqueId) || 0;
}

function buildUserRawdataRows(workbook, period, options = {}) {
  const { rows: baseRows, order } = getUserBaseRows(workbook, period);
  const byId = new Map(baseRows.map((row) => [row["唯一标识符"], row]));
  const unmatchedBySheet = {};
  const utmIdentifierMap = getUtmIdentifierMap();
  const alwKeywords = getDictionaryAbKeywords();
  const leadReference = buildLeadSourceReference(workbook, utmIdentifierMap);
  const unmatchedUtmRows = [];
  const collectUtmUnmatched = (rows = [], sourceName = "") => {
    rows.forEach((row) => {
      unmatchedUtmRows.push({
        sourceName,
        utm_source: normalizeNullableText(row.utm_source),
        utm_campaign: normalizeNullableText(row.utm_campaign),
        utm_term: normalizeNullableText(row.utm_term),
      });
    });
  };

  const maTable = getTable(workbook, "MA");
  if (maTable.rows.length) {
    for (const row of maTable.rows) {
      if (!rowMatchesPeriod(row, maTable.headers, period)) {
        continue;
      }

      const uniqueId =
        normalizeText(getCell(row, maTable.headers, ["关键标识符"], 1)) ||
        extractUniqueIdentifier(row, maTable.headers, period);
      if (!byId.has(uniqueId)) {
        unmatchedBySheet.MA = (unmatchedBySheet.MA || 0) + 1;
        continue;
      }

      const target = byId.get(uniqueId);
      target["触达人数"] += asNumber(getCell(row, maTable.headers, ["发送人数"]));
      target["触达成功数"] += asNumber(getCell(row, maTable.headers, ["发送成功数"]));
    }
  }

  const gioTable = getTable(workbook, "GIO");
  const gioSource = aggregateGioRows(gioTable, utmIdentifierMap);
  unmatchedBySheet.GIO = gioSource.unmatchedRows.length;
  collectUtmUnmatched(gioSource.unmatchedRows, "GIO");

  const unionid =
    options.unionidSource?.map
      ? { map: options.unionidSource.map, unmatched: options.unionidSource.unmatchedRows || [] }
      : sumByUniqueIdentifier(getTable(workbook, "Unionid"), period);
  unmatchedBySheet.Unionid = unionid.unmatched.length;
  collectUtmUnmatched(options.unionidSource?.unmatchedRows || [], "Unionid");

  const userTable = getTable(workbook, "User");
  const users =
    options.memberSource?.userMap
      ? { map: options.memberSource.userMap, unmatched: options.memberSource.unmatchedRows || [] }
      : sumByUniqueIdentifier(userTable, period);
  const newUsers =
    options.memberSource?.oldMemberMap
      ? { map: options.memberSource.oldMemberMap, unmatched: options.memberSource.unmatchedRows || [] }
      : sumByUniqueIdentifier(userTable, period, {
          predicate: (row, headers) => normalizeText(getCell(row, headers, ["New User(是否老用户)", "New User（是否老用户）"])) !== "是",
        });
  const oldUsers =
    options.memberSource?.oldMemberMap
      ? { map: options.memberSource.oldMemberMap, unmatched: options.memberSource.unmatchedRows || [] }
      : sumByUniqueIdentifier(userTable, period, {
          predicate: (row, headers) => normalizeText(getCell(row, headers, ["New User(是否老用户)", "New User（是否老用户）"])) === "是",
        });
  unmatchedBySheet.User = users.unmatched.length + newUsers.unmatched.length;
  collectUtmUnmatched(options.memberSource?.unmatchedRows || [], "User");

  const qChatTable = getTable(workbook, "Q-Chat");
  const chat = sumByUniqueIdentifier(qChatTable, period);
  const chatDemand = sumByUniqueIdentifier(qChatTable, period, {
    predicate: (row, headers) => normalizeText(getCell(row, headers, ["数据标记"])) === "有效数据",
  });
  const chatFlag = sumByUniqueIdentifier(qChatTable, period, {
    predicate: (row, headers) => normalizeText(getCell(row, headers, ["DAM渠道"])) === "YES",
  });
  unmatchedBySheet["Q-Chat"] = chat.unmatched.length + chatDemand.unmatched.length;

  const weilyTable = getTable(workbook, "Weily Offline");
  const opportunityCollection = aggregateRowsByMap(weilyTable, period, {
    dateHeaders: ["Capture Date"],
    uniqueIdResolver: (row, headers) => getUniqueIdFromStandardUtmRow(row, headers, utmIdentifierMap).uniqueId,
  });
  unmatchedBySheet["Weily Offline"] = opportunityCollection.unmatched.length;

  const sunnyTable = getTable(workbook, "Sunny Offline");
  const sunnyCall = aggregateRowsByMap(sunnyTable, period, {
    dateHeaders: ["Call Date"],
    uniqueIdResolver: (row, headers) => getUniqueIdFromStandardUtmRow(row, headers, utmIdentifierMap).uniqueId,
  });
  const sunnyDemand = aggregateRowsByMap(sunnyTable, period, {
    dateHeaders: ["Call Date"],
    uniqueIdResolver: (row, headers) => getUniqueIdFromStandardUtmRow(row, headers, utmIdentifierMap).uniqueId,
    predicate: (row, headers) => buildSunnyDam(row, headers, alwKeywords).damChannel === "YES",
  });
  unmatchedBySheet["Sunny Offline"] = sunnyCall.unmatched.length + sunnyDemand.unmatched.length;

  const robotTable = getTable(workbook, "机器人");
  const robots = aggregateRowsByMap(robotTable, period, {
    dateHeaders: ["呼叫开始时间"],
    uniqueIdResolver: (row, headers) => {
      const leadId = normalizeText(getCell(row, headers, ["Leads ID", "Leads_ID"]));
      const phone = normalizePhone(getCell(row, headers, ["电话号码", "手机号", "Phone"]));
      return leadReference.leadIdToUniqueId.get(leadId) || leadReference.phoneToUniqueId.get(phone) || "";
    },
  });
  unmatchedBySheet["机器人"] = robots.unmatched.length;

  const b2bTable = getTable(workbook, "B2B");
  const b2b = aggregateRowsByMap(b2bTable, period, {
    dateHeaders: ["Call Date"],
    uniqueIdResolver: (row, headers) => getUniqueIdFromUrlField(row, headers, utmIdentifierMap, ["企点QQ渠道"]).uniqueId,
  });
  unmatchedBySheet.B2B = b2b.unmatched.length;

  const orderTable = getTable(workbook, "Order");
  const orderData =
    options.orderSource?.reportMap
      ? { map: options.orderSource.reportMap, unmatched: options.orderSource.unmatchedRows || [] }
      : sumByUniqueIdentifier(orderTable, period, {
          predicate: (row, headers) => normalizeText(getCell(row, headers, ["来源"])) !== "秒杀订单",
        });
  const offlineOrder =
    options.orderSource?.offlineMap
      ? { map: options.orderSource.offlineMap, unmatched: options.orderSource.unmatchedRows || [] }
      : { map: new Map(), unmatched: [] };
  const flashSale =
    options.orderSource?.flashMap
      ? { map: options.orderSource.flashMap, unmatched: options.orderSource.unmatchedRows || [] }
      : sumByUniqueIdentifier(orderTable, period, {
          predicate: (row, headers) => normalizeText(getCell(row, headers, ["来源"])) === "秒杀订单",
        });
  const orderSuccess =
    options.orderSource?.successMap
      ? { map: options.orderSource.successMap, unmatched: options.orderSource.unmatchedRows || [] }
      : sumByUniqueIdentifier(orderTable, period, {
          predicate: (row, headers) => normalizeText(getCell(row, headers, ["商机状态"])) === "已成单",
        });
  unmatchedBySheet.Order = orderData.unmatched.length + flashSale.unmatched.length + offlineOrder.unmatched.length;
  collectUtmUnmatched(options.orderSource?.unmatchedRows || [], "Order");

  const points =
    options.pointsSource?.map
      ? { map: options.pointsSource.map, unmatched: options.pointsSource.unmatchedRows || [] }
      : sumByUniqueIdentifier(getTable(workbook, "领取积分"), period);
  const coupons =
    options.couponSource?.map
      ? { map: options.couponSource.map, unmatched: options.couponSource.unmatchedRows || [] }
      : sumByUniqueIdentifier(getTable(workbook, "领取优惠券"), period);
  const subscription =
    options.subscriptionSource?.map
      ? { map: options.subscriptionSource.map, unmatched: options.subscriptionSource.unmatchedRows || [] }
      : sumByUniqueIdentifier(getTable(workbook, "订阅模版消息"), period);
  const zeroCost =
    options.tryApplySource?.map
      ? { map: options.tryApplySource.map, unmatched: options.tryApplySource.unmatchedRows || [] }
      : sumByUniqueIdentifier(getTable(workbook, "0元试用申请"), period);
  const newLaunch = sumByUniqueIdentifier(getTable(workbook, "新品预约"), period);
  const lottery =
    options.luckySource?.map
      ? { map: options.luckySource.map, unmatched: options.luckySource.unmatchedRows || [] }
      : sumByUniqueIdentifier(getTable(workbook, "参与抽奖"), period);
  const anniversary =
    options.anniversarySource?.map
      ? { map: options.anniversarySource.map, unmatched: options.anniversarySource.unmatchedRows || [] }
      : sumByUniqueIdentifier(getTable(workbook, "参与周年庆活动"), period);
  unmatchedBySheet["领取积分"] = points.unmatched.length;
  unmatchedBySheet["是否领取优惠券"] = coupons.unmatched.length;
  unmatchedBySheet["是否订阅"] = subscription.unmatched.length;
  unmatchedBySheet["0元试用"] = zeroCost.unmatched.length;
  unmatchedBySheet["抽奖"] = lottery.unmatched.length;
  unmatchedBySheet["周年庆"] = anniversary.unmatched.length;

  collectUtmUnmatched(options.pointsSource?.unmatchedRows || [], "领取积分");
  collectUtmUnmatched(options.couponSource?.unmatchedRows || [], "是否领取优惠券");
  collectUtmUnmatched(options.subscriptionSource?.unmatchedRows || [], "是否订阅");
  collectUtmUnmatched(options.tryApplySource?.unmatchedRows || [], "0元试用");
  collectUtmUnmatched(options.luckySource?.unmatchedRows || [], "抽奖");
  collectUtmUnmatched(options.anniversarySource?.unmatchedRows || [], "周年庆");

  const funnelTable = getTable(workbook, "Funnel");
  const funnelQidian = aggregateRowsByMap(funnelTable, period, {
    dateHeaders: ["DATE"],
    uniqueIdResolver: (row, headers) => getUniqueIdFromUrlField(row, headers, utmIdentifierMap, ["企点QQ渠道"]).uniqueId,
    predicate: (row, headers) => {
      const flags = buildFunnelOrderFlags(row, headers);
      return flags.isPaid && flags.isQidian;
    },
  });
  const funnelPhoneCall = aggregateRowsByMap(funnelTable, period, {
    dateHeaders: ["DATE"],
    uniqueIdResolver: (row, headers) => {
      const phone = normalizePhone(getCell(row, headers, ["Phone", "客户手机号"]));
      return leadReference.phoneToUniqueId.get(phone) || "";
    },
    predicate: (row, headers) => {
      const flags = buildFunnelOrderFlags(row, headers);
      return flags.isPaid && !flags.isQidian;
    },
  });
  unmatchedBySheet.Funnel = funnelQidian.unmatched.length + funnelPhoneCall.unmatched.length;

  for (const uniqueId of order) {
    const target = byId.get(uniqueId);
    if (!target) {
      continue;
    }

    target.PV = getMapValue(gioSource.pvMap, uniqueId);
    target.UV = getMapValue(gioSource.uvMap, uniqueId);
    target.Unionid = getMapValue(unionid.map, uniqueId);
    target.User = getMapValue(users.map, uniqueId);
    target["New User"] = getMapValue(newUsers.map, uniqueId);
    target.Chat = getMapValue(chat.map, uniqueId);
    target["Chat 需求"] = getMapValue(chatDemand.map, uniqueId);
    target.商机收集 = getMapValue(opportunityCollection.map, uniqueId);
    target["Chat 标记 "] = getMapValue(chatFlag.map, uniqueId);
    target.表单外呼 = getMapValue(sunnyCall.map, uniqueId);
    target.Pengjian = getMapValue(sunnyDemand.map, uniqueId);
    target.机器人 = getMapValue(robots.map, uniqueId);
    target.B2B = getMapValue(b2b.map, uniqueId);
    target.订单数据 = getMapValue(orderData.map, uniqueId);
    target.线下订单 = getMapValue(offlineOrder.map, uniqueId);
    target.领取积分 = getMapValue(points.map, uniqueId);
    target.是否领取优惠券 = getMapValue(coupons.map, uniqueId);
    target.是否订阅 = getMapValue(subscription.map, uniqueId);
    target["0元试用"] = getMapValue(zeroCost.map, uniqueId);
    target.老用户激活 = getMapValue(oldUsers.map, uniqueId);
    target.新品预约 = getMapValue(newLaunch.map, uniqueId);
    target.秒杀 = getMapValue(flashSale.map, uniqueId);
    target.抽奖 = getMapValue(lottery.map, uniqueId);
    target.周年庆 = getMapValue(anniversary.map, uniqueId);
    target["企点成单数据"] = getMapValue(funnelQidian.map, uniqueId);
    target["Phone call 成单"] = getMapValue(funnelPhoneCall.map, uniqueId);
    target.报价单成单 = getMapValue(orderSuccess.map, uniqueId);
    target.Funel = target["企点成单数据"] + target["Phone call 成单"];
    target.sum = target["Chat 标记 "] + target.Pengjian + target.订单数据;
    target.互动汇总 =
      target.领取积分 +
      target.是否领取优惠券 +
      target.是否订阅 +
      target["0元试用"] +
      target.老用户激活 +
      target.新品预约 +
      target.秒杀 +
      target.抽奖 +
      target.周年庆;
  }

  return {
    rows: order.map((uniqueId) => {
      const current = byId.get(uniqueId);
      return USER_HEADERS.map((header) => current[header] ?? "");
    }),
    unmatched: getUnmatchedSummary(unmatchedBySheet),
    unmatchedUtmRows,
  };
}

function createDemandDateRows(period) {
  const rows = [];
  const cursor = new Date(period.startDate.getTime());

  while (cursor <= period.endDate) {
    rows.push(new Date(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

function buildDemandRawdataRows(workbook, period) {
  const qChatTable = getTable(workbook, "Q-Chat");
  const sunnyTable = getTable(workbook, "Sunny Offline");
  const robotTable = getTable(workbook, "机器人");
  const b2bTable = getTable(workbook, "B2B");
  const orderTable = getTable(workbook, "Order");
  const segments = ["Con ALW", "Con NonALW"];

  const demandMap = new Map();
  const makeKey = (dateSerial, segment) => `${dateSerial}:${segment}`;

  for (const date of createDemandDateRows(period)) {
    const dateSerial = dateToExcelSerial(date);
    for (const segment of segments) {
      demandMap.set(makeKey(dateSerial, segment), {
        Year: period.fiscalYear,
        Quarter: period.quarter,
        Month: formatMonth(date),
        Fiscal_Quarter: period.fiscalQuarter,
        Week: period.weekLabel,
        Day: dateSerial,
        Segment: segment,
        "Phone call_left": 0,
        "Phone call_right": 0,
        机器人: 0,
        B2B: 0,
        "QQ企点 Chat": 0,
        报价单: 0,
        "Red note Chat": "",
      });
    }
  }

  for (const row of qChatTable.rows) {
    if (!rowMatchesPeriod(row, qChatTable.headers, period)) {
      continue;
    }

    const segment = normalizeText(getCell(row, qChatTable.headers, ["DAM"]));
    if (!segments.includes(segment)) {
      continue;
    }

    const day = getDateFromRow(row, qChatTable.headers, period);
    const key = makeKey(dateToExcelSerial(day), segment);
    const target = demandMap.get(key);
    if (target) {
      target["QQ企点 Chat"] += 1;
    }
  }

  for (const row of sunnyTable.rows) {
    if (!rowMatchesPeriod(row, sunnyTable.headers, period)) {
      continue;
    }

    const segment = normalizeText(getCell(row, sunnyTable.headers, ["DAM"]));
    if (!segments.includes(segment)) {
      continue;
    }

    const day = getDateFromRow(row, sunnyTable.headers, period);
    const key = makeKey(dateToExcelSerial(day), segment);
    const target = demandMap.get(key);
    if (target) {
      if (segment === "Con ALW") {
        target["Phone call_left"] += 1;
      } else {
        target["Phone call_right"] += 1;
      }
    }
  }

  for (const row of robotTable.rows) {
    if (!rowMatchesPeriod(row, robotTable.headers, period)) {
      continue;
    }

    if (normalizeText(getCell(row, robotTable.headers, ["SRL导入标识"])) !== "QSRL") {
      continue;
    }

    const day = getDateFromRow(row, robotTable.headers, period);
    const key = makeKey(dateToExcelSerial(day), "Con NonALW");
    const target = demandMap.get(key);
    if (target) {
      target["机器人"] += 1;
    }
  }

  for (const row of b2bTable.rows) {
    if (!rowMatchesPeriod(row, b2bTable.headers, period)) {
      continue;
    }

    const day = getDateFromRow(row, b2bTable.headers, period);
    const key = makeKey(dateToExcelSerial(day), "Con NonALW");
    const target = demandMap.get(key);
    if (target) {
      target.B2B += 1;
    }
  }

  for (const row of orderTable.rows) {
    if (!rowMatchesPeriod(row, orderTable.headers, period)) {
      continue;
    }

    const segment = normalizeText(getCell(row, orderTable.headers, ["DAM"]));
    if (!segments.includes(segment)) {
      continue;
    }

    const day = getDateFromRow(row, orderTable.headers, period);
    const key = makeKey(dateToExcelSerial(day), segment);
    const target = demandMap.get(key);
    if (target) {
      target.报价单 += 1;
    }
  }

  return {
    rows: Array.from(demandMap.values()).map((row) => [
      row.Year,
      row.Quarter,
      row.Month,
      row.Fiscal_Quarter,
      row.Week,
      row.Day,
      row.Segment,
      row["Phone call_left"],
      row["Phone call_right"],
      row["机器人"],
      row.B2B,
      row["QQ企点 Chat"],
      row.报价单,
      row["Red note Chat"],
    ]),
  };
}

function buildProductRawdataRows(workbook) {
  const baseWorkbook = readWorkbook(PRODUCT_MASTER_PATH);
  const baseTable = getTable(baseWorkbook, baseWorkbook.SheetNames[0]);
  const trafficTable = getTable(workbook, "频道数据情况");
  const trafficByName = new Map();
  const unmatched = [];

  for (const row of trafficTable.rows) {
    const name = normalizeCompareText(getCell(row, trafficTable.headers, ["产品名称"]));
    if (!name) {
      continue;
    }

    if (!trafficByName.has(name)) {
      trafficByName.set(name, {
        访问人数: 0,
        访问次数: 0,
        咨询人数: 0,
        咨询次数: 0,
      });
    }

    const target = trafficByName.get(name);
    target.访问人数 += asNumber(getCell(row, trafficTable.headers, ["访问人数"]));
    target.访问次数 += asNumber(getCell(row, trafficTable.headers, ["访问次数"]));
    target.咨询人数 += asNumber(getCell(row, trafficTable.headers, ["咨询人数"]));
    target.咨询次数 += asNumber(getCell(row, trafficTable.headers, ["咨询次数"]));
  }

  const totalConsultTimes = Array.from(trafficByName.values()).reduce((sum, item) => sum + item.咨询次数, 0);
  const rows = [];

  for (const baseRow of baseTable.rows) {
    const data = PRODUCT_HEADERS.reduce((result, header, index) => {
      result[header] = baseRow[index] ?? "";
      return result;
    }, {});

    const key = normalizeCompareText(data["产品名称"]);
    const traffic = trafficByName.get(key);
    if (!traffic) {
      unmatched.push(data["产品名称"]);
    } else {
      data["访问人数"] = traffic.访问人数;
      data["访问人次"] = traffic.访问次数;
      data["咨询人数"] = traffic.咨询人数;
      data["咨询人次"] = traffic.咨询次数;
      data["推荐系数"] = totalConsultTimes > 0 ? traffic.咨询次数 / totalConsultTimes : 0;
    }

    rows.push(PRODUCT_HEADERS.map((header) => data[header] ?? ""));
  }

  return {
    rows,
    unmatched: unmatched.filter(Boolean),
  };
}

function keyFromUserRow(row) {
  const weeklyMatchKey = normalizeText(row[4]);
  if (weeklyMatchKey) {
    return weeklyMatchKey;
  }

  return `${row[0]}__${row[1]}__${row[3]}__${row[9]}`;
}

function keyFromDemandRow(row) {
  return `${row[0]}__${row[1]}__${row[3]}__${row[4]}__${row[5]}__${row[6]}`;
}

function upsertRows(filePath, headers, rows, keyBuilder) {
  const workbook = readWorkbook(filePath);
  const firstSheet = workbook.SheetNames[0];
  const table = getTable(workbook, firstSheet);
  const nextRows = [];
  const replacingKeys = new Set(rows.map((row) => keyBuilder(row)));

  for (const row of table.rows) {
    if (!replacingKeys.has(keyBuilder(row))) {
      nextRows.push(row.slice(0, headers.length));
    }
  }

  nextRows.push(...rows);
  writeAoAToSheet(workbook, firstSheet, [headers, ...nextRows]);
  XLSX.writeFile(workbook, filePath);

  return {
    filePath,
    sheetName: firstSheet,
    rowCount: nextRows.length,
  };
}

function overwriteRows(filePath, headers, rows) {
  const workbook = readWorkbook(filePath);
  const firstSheet = workbook.SheetNames[0];
  writeAoAToSheet(workbook, firstSheet, [headers, ...rows]);
  XLSX.writeFile(workbook, filePath);

  return {
    filePath,
    sheetName: firstSheet,
    rowCount: rows.length,
  };
}

async function writeSummaryReport(period, payload) {
  await fsp.mkdir(OUTPUTS_DIR, { recursive: true });
  const periodDir = path.join(OUTPUTS_DIR, `${period.fiscalYear}_${period.quarter}_${period.shortWeek}`);
  await fsp.mkdir(periodDir, { recursive: true });
  const reportPath = path.join(periodDir, "rebuild-summary.json");
  await fsp.writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return reportPath;
}

async function writePeriodArtifact(period, fileName, payload) {
  await fsp.mkdir(OUTPUTS_DIR, { recursive: true });
  const periodDir = path.join(OUTPUTS_DIR, `${period.fiscalYear}_${period.quarter}_${period.shortWeek}`);
  await fsp.mkdir(periodDir, { recursive: true });
  const artifactPath = path.join(periodDir, fileName);
  await fsp.writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return artifactPath;
}

function aggregateUnmatchedUtmEntries(rows = []) {
  return Array.from(
    rows.reduce((map, row) => {
      const utmSource = normalizeNullableText(row.utm_source);
      const utmCampaign = normalizeNullableText(row.utm_campaign);
      const utmTerm = normalizeNullableText(row.utm_term);
      if (!utmSource && !utmCampaign && !utmTerm) {
        return map;
      }

      const key = buildWritableUtmMerge(utmSource, utmCampaign, utmTerm);
      if (!map.has(key)) {
        map.set(key, {
          utmSource,
          utmCampaign,
          utmTerm,
          count: 0,
        });
      }

      map.get(key).count += 1;
      return map;
    }, new Map()).values()
  ).sort((left, right) => right.count - left.count);
}

function detectImportTarget(sheetName, headers) {
  const normalizedSheetName = normalizeHeader(sheetName);

  for (const definition of IMPORT_DEFINITIONS) {
    if (definition.aliases.some((alias) => normalizedSheetName.includes(normalizeHeader(alias)))) {
      return definition.target;
    }
  }

  for (const definition of IMPORT_DEFINITIONS) {
    if (definition.target === "GIO") {
      const requiredMatched = definition.requiredHeaders.every((header) => findHeaderPosition(headers, [header]) >= 0);
      const hasTermHeader =
        findHeaderPosition(headers, ["广告关键字", "广告关键词", "广告关键字(utm_term)", "广告关键词(utm_term)"]) >= 0;
      if (requiredMatched && hasTermHeader) {
        return definition.target;
      }
      continue;
    }

    const matchedHeaders = definition.requiredHeaders.filter((header) => findHeaderPosition(headers, [header]) >= 0);
    if (matchedHeaders.length === definition.requiredHeaders.length) {
      return definition.target;
    }
  }

  return "";
}

async function importWorkbookIntoPeriod(periodInput, uploadedFilePath, originalName) {
  const period = buildPeriodInfo(periodInput);
  const { filePath } = await ensurePeriodWorkbook(period);
  const targetWorkbook = readWorkbook(filePath);
  const importWorkbook = readWorkbook(uploadedFilePath);
  const imported = [];

  for (const sheetName of importWorkbook.SheetNames) {
    const rows = sheetToAoA(importWorkbook.Sheets[sheetName]);
    if (!rows.length) {
      continue;
    }

    const targetName = detectImportTarget(sheetName, rows[0]);
    if (!targetName) {
      continue;
    }

    if (targetName === "Q-Chat") {
      const processed = await buildQChatProcessedRows(cloneRows(rows), period);
      writeAoAToSheet(targetWorkbook, "Q-Chat描述", cloneRows(processed.rawRows));
      writeAoAToSheet(targetWorkbook, "Q-Chat", cloneRows(processed.processedRows));
      imported.push(
        {
          fromSheet: sheetName,
          targetSheet: "Q-Chat描述",
          rows: Math.max(0, processed.rawRows.length - 1),
        },
        {
          fromSheet: sheetName,
          targetSheet: "Q-Chat",
          rows: Math.max(0, processed.processedRows.length - 1),
        }
      );
      continue;
    }

    writeAoAToSheet(targetWorkbook, targetName, cloneRows(rows));
    imported.push({
      fromSheet: sheetName,
      targetSheet: targetName,
      rows: Math.max(0, rows.length - 1),
    });
  }

  if (!imported.length) {
    throw new Error(`文件「${originalName}」中未识别到可导入的 Consumer 数据 Sheet`);
  }

  XLSX.writeFile(targetWorkbook, filePath);

  return {
    filePath,
    imported,
    workbook: inspectPeriodWorkbook(period),
  };
}

async function rebuildPeriod(periodInput) {
  const period = buildPeriodInfo(periodInput);
  const { filePath } = await ensurePeriodWorkbook(period);
  const workbook = readWorkbook(filePath);
  const rawQChatRows = sheetToAoA(workbook.Sheets["Q-Chat描述"]);
  if (rawQChatRows.length > 1) {
    const processedQChat = await buildQChatProcessedRows(cloneRows(rawQChatRows), period);
    writeAoAToSheet(workbook, "Q-Chat", cloneRows(processedQChat.processedRows));
  }
  const [
    unionidSource,
    memberSource,
    anniversarySource,
    luckySource,
    tryApplySource,
    subscriptionSource,
    couponSource,
    pointsSource,
    orderSource,
  ] = await Promise.all([
    fetchUnionidSourceFromDatabase(period),
    fetchMemberSourceFromDatabase(period),
    fetchAnniversarySourceFromDatabase(period),
    fetchLuckySourceFromDatabase(period),
    fetchTryApplySourceFromDatabase(period),
    fetchSubscriptionSourceFromDatabase(period),
    fetchCouponSourceFromDatabase(period),
    fetchPointsSourceFromDatabase(period),
    fetchOrderSourceFromDatabase(period),
  ]);

  const userResult = buildUserRawdataRows(workbook, period, {
    unionidSource,
    memberSource,
    anniversarySource,
    luckySource,
    tryApplySource,
    subscriptionSource,
    couponSource,
    pointsSource,
    orderSource,
  });
  const demandResult = buildDemandRawdataRows(workbook, period);
  const productResult = buildProductRawdataRows(workbook, period);

  writeAoAToSheet(workbook, "UserRawdata", [USER_HEADERS, ...userResult.rows]);
  writeAoAToSheet(workbook, "DemandRawdata", [DEMAND_HEADERS, ...demandResult.rows]);
  writeAoAToSheet(workbook, "ProductRawdata", [PRODUCT_HEADERS, ...productResult.rows]);
  XLSX.writeFile(workbook, filePath);

  const mergedSync = upsertRows(USER_MERGED_PATH, USER_HEADERS, userResult.rows, keyFromUserRow);
  const demandSync = upsertRows(DEMAND_MASTER_PATH, DEMAND_HEADERS, demandResult.rows, keyFromDemandRow);
  const productSync = overwriteRows(PRODUCT_MASTER_PATH, PRODUCT_HEADERS, productResult.rows);

  const summary = {
    period: {
      fiscalYear: period.fiscalYear,
      quarter: period.quarter,
      week: period.weekLabel,
      month: period.monthLabel,
    },
    outputs: {
      periodWorkbook: filePath,
      userMerged: mergedSync.filePath,
      demandMerged: demandSync.filePath,
      productMerged: productSync.filePath,
    },
    generated: {
      userRows: userResult.rows.length,
      demandRows: demandResult.rows.length,
      productRows: productResult.rows.length,
    },
    databaseSources: {
      unionid: {
        source: "consumer.member_wx",
        queriedRows: unionidSource.queriedRows,
        matchedRows: unionidSource.matchedRows,
        unmatchedRows: unionidSource.unmatchedRows.length,
      },
      user: {
        source: "consumer.member",
        queriedRows: memberSource.queriedRows,
        matchedRows: memberSource.matchedRows,
        unmatchedRows: memberSource.unmatchedRows.length,
      },
      anniversary: {
        source: "consumer.interaction_log",
        queriedRows: anniversarySource.queriedRows,
        matchedRows: anniversarySource.matchedRows,
        unmatchedRows: anniversarySource.unmatchedRows.length,
      },
      lucky: {
        source: "consumer.lucky_log",
        queriedRows: luckySource.queriedRows,
        matchedRows: luckySource.matchedRows,
        unmatchedRows: luckySource.unmatchedRows.length,
      },
      tryApply: {
        source: "consumer.try_apply",
        queriedRows: tryApplySource.queriedRows,
        matchedRows: tryApplySource.matchedRows,
        unmatchedRows: tryApplySource.unmatchedRows.length,
      },
      subscription: {
        source: "consumer.message_subscribe_log",
        queriedRows: subscriptionSource.queriedRows,
        matchedRows: subscriptionSource.matchedRows,
        unmatchedRows: subscriptionSource.unmatchedRows.length,
      },
      coupon: {
        source: "consumer.member_coupon + consumer.member_coupon_utm",
        queriedRows: couponSource.queriedRows,
        matchedRows: couponSource.matchedRows,
        unmatchedRows: couponSource.unmatchedRows.length,
      },
      points: {
        source: "consumer.member_points_log + consumer.member",
        queriedRows: pointsSource.queriedRows,
        matchedRows: pointsSource.matchedRows,
        unmatchedRows: pointsSource.unmatchedRows.length,
      },
      order: {
        source: "consumer.order + consumer.clue + consumer.clue_history",
        queriedRows: orderSource.queriedRows,
        matchedRows: orderSource.matchedRows,
        unmatchedRows: orderSource.unmatchedRows.length,
      },
    },
    unmatched: {
      user: userResult.unmatched,
      product: productResult.unmatched,
    },
  };

  const [reportPath, utmArtifactPath, unionidArtifactPath, memberArtifactPath] = await Promise.all([
    writeSummaryReport(period, summary),
    writePeriodArtifact(period, "utm_data.json", {
      period: {
        fiscalYear: period.fiscalYear,
        quarter: period.quarter,
        week: period.weekLabel,
        month: period.monthLabel,
      },
      unmatchedByUtm: aggregateUnmatchedUtmEntries(userResult.unmatchedUtmRows),
      unmatchedSample: userResult.unmatchedUtmRows.slice(0, 500),
    }),
    writePeriodArtifact(period, "unionid_data.json", {
      period: {
        fiscalYear: period.fiscalYear,
        quarter: period.quarter,
        week: period.weekLabel,
        month: period.monthLabel,
      },
      source: "consumer.member_wx",
      queriedRows: unionidSource.queriedRows,
      matchedRows: unionidSource.matchedRows,
      unmatchedRows: unionidSource.unmatchedRows.length,
      unmatchedByUtm: Array.from(
        unionidSource.unmatchedRows.reduce((map, row) => {
          const key = buildWritableUtmMerge(row.utm_source, row.utm_campaign, row.utm_term);
          if (!map.has(key)) {
            map.set(key, {
              utmSource: normalizeNullableText(row.utm_source),
              utmCampaign: normalizeNullableText(row.utm_campaign),
              utmTerm: normalizeNullableText(row.utm_term),
              count: 0,
            });
          }
          map.get(key).count += 1;
          return map;
        }, new Map()).values()
      ).sort((left, right) => right.count - left.count),
      unmatchedSample: unionidSource.unmatchedRows.slice(0, 200),
      byUniqueIdentifier: Array.from(unionidSource.map.entries()).map(([uniqueId, count]) => ({ uniqueId, count })),
    }),
    writePeriodArtifact(period, "member_data.json", {
      period: {
        fiscalYear: period.fiscalYear,
        quarter: period.quarter,
        week: period.weekLabel,
        month: period.monthLabel,
      },
      source: "consumer.member",
      queriedRows: memberSource.queriedRows,
      matchedRows: memberSource.matchedRows,
      unmatchedRows: memberSource.unmatchedRows.length,
      unmatchedByUtm: Array.from(
        memberSource.unmatchedRows.reduce((map, row) => {
          const key = buildWritableUtmMerge(row.utm_source, row.utm_campaign, row.utm_term);
          if (!map.has(key)) {
            map.set(key, {
              utmSource: normalizeNullableText(row.utm_source),
              utmCampaign: normalizeNullableText(row.utm_campaign),
              utmTerm: normalizeNullableText(row.utm_term),
              count: 0,
            });
          }
          map.get(key).count += 1;
          return map;
        }, new Map()).values()
      ).sort((left, right) => right.count - left.count),
      unmatchedSample: memberSource.unmatchedRows.slice(0, 200),
      byUniqueIdentifierUser: Array.from(memberSource.userMap.entries()).map(([uniqueId, count]) => ({ uniqueId, count })),
      byUniqueIdentifierOldMember: Array.from(memberSource.oldMemberMap.entries()).map(([uniqueId, count]) => ({ uniqueId, count })),
    }),
  ]);

  return {
    ...summary,
    reportPath,
    utmArtifactPath,
    unionidArtifactPath,
    memberArtifactPath,
    workbook: inspectPeriodWorkbook(period),
  };
}

function resolveDownloadTarget(kind, periodInput) {
  if (kind === "config") {
    return CONFIG_PATH;
  }

  if (kind === "user-merged") {
    return USER_MERGED_PATH;
  }

  if (kind === "demand-master") {
    return DEMAND_MASTER_PATH;
  }

  if (kind === "product-master") {
    return PRODUCT_MASTER_PATH;
  }

  if (kind === "period-workbook") {
    const period = buildPeriodInfo(periodInput);
    const workbook = inspectPeriodWorkbook(period);
    if (!workbook.exists) {
      throw new Error("当前周期还没有可下载的插件工作区");
    }
    return workbook.filePath;
  }

  throw new Error(`不支持的下载类型：${kind}`);
}

module.exports = {
  buildDemandRawdataRows,
  buildPeriodInfo,
  buildProductRawdataRows,
  buildUserRawdataRows,
  detectImportTarget,
  ensurePeriodWorkbook,
  getBootstrapData,
  getConfigEditorData,
  getPeriodFileName,
  getPeriodFilePath,
  readWorkbook,
  importWorkbookIntoPeriod,
  inspectPeriodWorkbook,
  listPeriodWorkbooks,
  rebuildPeriod,
  resolveDownloadTarget,
  upsertUniqueChannelEntry,
  upsertUtmEntry,
  upsertUtmEntries,
};
