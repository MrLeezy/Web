const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const XLSX = require("xlsx");

const { createOpportunityMasterService } = require("../lib/opportunity-master/service.js");

function writeWorkbook(filePath, sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }
  XLSX.writeFile(workbook, filePath);
}

test("detects website/chat/400/combined/order uploads and supports workspace import/remove", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "opportunity-master-"));
  const dataDir = path.join(root, "data", "opportunity-master");
  const tmpDir = path.join(root, "tmp");
  await fsp.mkdir(tmpDir, { recursive: true });

  const service = createOpportunityMasterService({
    root,
    dataDir,
  });
  await service.ensureDirs();

  const websiteFile = path.join(tmpDir, "FY27Q2网站来源.xlsx");
  writeWorkbook(websiteFile, {
    "FY27Q2数据明细-唯一": [["用户ID", "Email"], ["1", "a@test.com"]],
  });
  assert.equal(service.detectSourceForWorkbook(websiteFile, "FY27Q2网站来源.xlsx").detectedSource, "website_q2");

  const chatFile = path.join(tmpDir, "finished-solution客服数据明细.xlsx");
  writeWorkbook(chatFile, {
    sheet1: [["MKT ID", "电话号码"], ["1", "13800000000"]],
  });
  assert.equal(service.detectSourceForWorkbook(chatFile, "finished-solution客服数据明细.xlsx").detectedSource, "chat");

  const phoneFile = path.join(tmpDir, "finished-solution400客服数据明细.xlsx");
  writeWorkbook(phoneFile, {
    sheet1: [["媒体来源", "来电手机号"], ["wechat", "13800000000"]],
  });
  assert.equal(service.detectSourceForWorkbook(phoneFile, "finished-solution400客服数据明细.xlsx").detectedSource, "phone_400");

  const combinedFile = path.join(tmpDir, "FY27Q2-400&chat数据汇总.xlsx");
  writeWorkbook(combinedFile, {
    Sheet1: [[
      "MKT ID",
      "Email",
      "Mobile Phone",
      "Dell Salesforce Account ID",
      "Company",
      "City",
      "State",
      "数据来源",
      "Call Date",
      "Call Wk",
      "Call Quarter",
      "Call Type",
      "Remark Type",
      "来源表单",
      "LV2来源模块",
      "广告名称 (utm_campaign)",
      "广告内容 (utm_content)",
      "广告关键字 (utm_term)",
      "广告媒介 (utm_medium)",
      "广告来源 (utm_source)",
    ], ["1", "a@test.com", "13800000000", "ACC", "Demo", "Shanghai", "Shanghai", "sales_chat", "2026-06-05", "FY27Q2W02", "FY27Q2", "QSRL", "Remark", "表单", "模块", "c", "ct", "t", "m", "sms"]],
  });
  assert.equal(service.detectSourceForWorkbook(combinedFile, "FY27Q2-400&chat数据汇总.xlsx").detectedSource, "chat_phone_combined");

  const sfdcSignalFile = path.join(tmpDir, "SFDC_Signal_FY27Q2W6.xlsx");
  writeWorkbook(sfdcSignalFile, {
    Sheet1: [[
      "Mobile",
      "Email",
      "Company",
      "Lead : Account : Affinity Account ID",
      "State/Province",
      "City",
      "Created Date",
      "Additional Comments",
      "Lead Status",
      "Reason",
      "Lead Rating",
      "Allocaida ID",
      "call_type",
    ], ["13800000000", "signal@test.com", "Demo", "ACC", "上海", "上海", "2026-06-16", "", "", "", "", "3445891", "Leads"]],
  });
  assert.equal(service.detectSourceForWorkbook(sfdcSignalFile, "SFDC_Signal_FY27Q2W6.xlsx").detectedSource, "sfdc_signal_mapping");

  const orderFile = path.join(tmpDir, "2025-2026订单.xlsx");
  writeWorkbook(orderFile, {
    orders: [["订单编号", "utm参数"], ["O-1", "utm_source=sms"]],
  });
  assert.equal(service.detectSourceForWorkbook(orderFile, "2025-2026订单.xlsx").detectedSource, "order");

  const unknownFile = path.join(tmpDir, "unknown.xlsx");
  writeWorkbook(unknownFile, {
    Sheet1: [["foo", "bar"], ["1", "2"]],
  });
  const imported = await service.importUploadedFile(unknownFile, "unknown.xlsx");
  assert.equal(imported.importedFile.detectedSource, "unknown");
  assert.equal(imported.workspace.summary.totalFiles, 1);

  const removed = await service.removeWorkspaceFile(imported.importedFile.id);
  assert.equal(removed.workspace.summary.totalFiles, 0);

  await fsp.rm(root, { recursive: true, force: true });
});
