from __future__ import annotations

import sys
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from opportunity_master_lib.transformers import (  # noqa: E402
    apply_sfdc_call_type_override,
    BuildStats,
    dedupe_rows,
    derive_campaign_fields,
    extract_utm_params,
    normalize_blankish_text,
    normalize_call_type,
    normalize_call_week,
    normalize_city,
    normalize_date,
    normalize_email,
    normalize_email_for_match,
    normalize_phone,
    normalize_phone_for_match,
    normalize_province,
    should_drop_row,
    transform_record,
)
from opportunity_master_lib.channel_rules import ChannelRuleEngine  # noqa: E402


class TransformersTest(unittest.TestCase):
    def test_normalize_phone(self) -> None:
        stats = BuildStats()
        self.assertEqual(normalize_phone("15934561712.0", stats), "15934561712")
        self.assertEqual(normalize_phone("abc", stats), "")
        self.assertEqual(stats.invalid_counts["invalid_phone"], 1)

    def test_normalize_email(self) -> None:
        stats = BuildStats()
        self.assertEqual(normalize_email("User@Test.com", stats), "user@test.com")
        self.assertEqual(normalize_email("bad-email", stats), "")

    def test_match_key_normalizers(self) -> None:
        self.assertEqual(normalize_phone_for_match("86 15934561712"), "15934561712")
        self.assertEqual(normalize_phone_for_match("bad"), "")
        self.assertEqual(normalize_email_for_match("User@Test.com"), "user@test.com")
        self.assertEqual(normalize_email_for_match("bad-email"), "")

    def test_normalize_date(self) -> None:
        stats = BuildStats()
        self.assertEqual(normalize_date(datetime(2026, 5, 15), stats, "invalid_date"), "2026-05-15")
        self.assertEqual(normalize_date("2026-05-15 09:08:07", stats, "invalid_date"), "2026-05-15")
        self.assertEqual(normalize_date(45951, stats, "invalid_date"), "2025-10-21")

    def test_call_type(self) -> None:
        self.assertEqual(normalize_call_type("QSRL"), "Leads")
        self.assertEqual(normalize_call_type("Leads"), "Leads")
        self.assertEqual(normalize_call_type("SRL"), "Signals")
        self.assertEqual(normalize_call_type("Signal"), "Signals")
        self.assertEqual(normalize_call_type("Signal-MRL"), "Signals")
        self.assertEqual(normalize_call_type("Signal(待确定)"), "Signal(待确定)")
        self.assertEqual(normalize_call_type("其他"), "Non-Signals")

    def test_apply_sfdc_call_type_override_sets_signals_when_matched(self) -> None:
        stats = BuildStats()
        row = {
            "email": "User@Test.com",
            "mobile Phone": "15934561712.0",
            "call type": "Non-Signals",
        }
        updated = apply_sfdc_call_type_override(
            row,
            {"15934561712"},
            {"user@test.com"},
            stats,
        )
        self.assertEqual(updated["call type"], "Signals")
        self.assertEqual(stats.filtered_counts["sfdc_call_type_overrides"], 1)

    def test_apply_sfdc_call_type_override_ignores_existing_leads(self) -> None:
        stats = BuildStats()
        row = {
            "email": "signal@test.com",
            "mobile Phone": "",
            "call type": "Leads",
        }
        updated = apply_sfdc_call_type_override(
            row,
            set(),
            {"signal@test.com"},
            stats,
        )
        self.assertEqual(updated["call type"], "Leads")
        self.assertEqual(stats.filtered_counts["sfdc_call_type_leads_ignored"], 1)

    def test_call_week(self) -> None:
        self.assertEqual(normalize_call_week("FY27Q2W5"), "FY27Q2W05")
        self.assertEqual(normalize_call_week("FY27Q2W05"), "FY27Q2W05")
        self.assertEqual(normalize_call_week("W5"), "W05")
        self.assertEqual(normalize_call_week("Week 5"), "Week 5")

    def test_extract_utm_params(self) -> None:
        values = extract_utm_params(
            "utm_source=wechat-dsp-xcx&utm_medium=ot_md_so&utm_campaign=abc&utm_content=mona-li&utm_term=term1"
        )
        self.assertEqual(values["utm_source"], "wechat-dsp-xcx")
        self.assertEqual(values["utm_campaign"], "abc")

    def test_blankish_company_city_province_and_utm(self) -> None:
        self.assertEqual(normalize_blankish_text("未提供"), "")
        self.assertEqual(normalize_blankish_text("0"), "")
        self.assertEqual(normalize_city("上海市"), "上海")
        self.assertEqual(normalize_city("北京"), "北京")
        self.assertEqual(normalize_province("江苏省"), "江苏")
        self.assertEqual(normalize_province("上海"), "上海")

    def test_should_drop_empty_order_row(self) -> None:
        row = {
            "商机渠道": "Order",
            "channel_classification": "自然流量",
            "channel": "自然流量",
        }
        self.assertTrue(should_drop_row(row))

    def test_dedupe_rows_prefers_leads_then_latest_date(self) -> None:
        rows = [
            {"leads id": "1", "call type": "Non-Signals", "call date": "2026-05-01", "capture date": "2026-05-01"},
            {"leads id": "1", "call type": "Leads", "call date": "2026-04-01", "capture date": "2026-04-01"},
            {"leads id": "1", "call type": "Leads", "call date": "2026-05-02", "capture date": "2026-05-02"},
        ]
        deduped = dedupe_rows(rows)
        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0]["call date"], "2026-05-02")

    def test_derive_campaign_fields(self) -> None:
        self.assertEqual(
            derive_campaign_fields("douyin"),
            ("FY27Q2_APJC_GC_CN Eshop_Promotion DY/Toutiao/Kuaishou", "3445890"),
        )
        self.assertEqual(
            derive_campaign_fields("wechat-dsp"),
            ("FY27Q2_APJC_GC_CN Eshop_Promotion Tencent-WPP", "3445892"),
        )
        self.assertEqual(
            derive_campaign_fields("wechat_template"),
            ("FY27Q2_APJC_GC_CN Commerical Membership MA", "3445891"),
        )

    def test_transform_record_populates_campaign_fields(self) -> None:
        stats = BuildStats()
        target_fields = ["商机渠道", "Campaign Name", "Allocaida ID", "call type", "channel_classification", "channel"]
        row = transform_record(
            "chat",
            {
                "MKT ID": "1",
                "Business_Week": "FY27Q2W04",
                "窗口粘贴": "Leads",
                "广告来源(utm_source)": "sms",
            },
            target_fields,
            stats,
            ChannelRuleEngine([]),
        )
        self.assertEqual(row["Campaign Name"], "FY27Q2_APJC_GC_CN Commerical Membership MA")
        self.assertEqual(row["Allocaida ID"], "3445891")
        self.assertEqual(row["call wk"], "FY27Q2W04")

    def test_transform_combined_chat_phone_row(self) -> None:
        stats = BuildStats()
        target_fields = [
            "商机渠道",
            "member_id",
            "email",
            "mobile Phone",
            "account id",
            "company",
            "title",
            "department",
            "street Address",
            "city",
            "province",
            "leads id",
            "utm_campaign",
            "utm_content",
            "utm_term",
            "utm_medium",
            "utm_source",
            "capture date",
            "call date",
            "call wk",
            "call quarter",
            "call type",
            "remark type",
            "channel_classification",
            "channel",
            "Campaign Name",
            "Allocaida ID",
        ]
        row = transform_record(
            "chat_phone_combined",
            {
                "数据来源": "400电话-CMG",
                "Email": "User@Test.com",
                "Mobile Phone": "15934561712.0",
                "Dell Salesforce Account ID": "ACC-1",
                "Company": "未提供",
                "City": "上海市",
                "State": "江苏省",
                "MKT ID": "lead-1",
                "广告名称 (utm_campaign)": "0",
                "广告内容 (utm_content)": "0",
                "广告关键字 (utm_term)": "0",
                "广告媒介 (utm_medium)": "0",
                "广告来源 (utm_source)": "0",
                "Call Date": "2026-06-05",
                "Call Wk": "FY27Q2W2",
                "Call Quarter": "FY27Q2",
                "Call Type": "QSRL",
                "Remark Type": "Wrong number",
                "来源表单": "表单A",
                "LV2来源模块": "模块A",
            },
            target_fields,
            stats,
            ChannelRuleEngine([]),
        )
        self.assertEqual(row["商机渠道"], "400")
        self.assertEqual(row["email"], "user@test.com")
        self.assertEqual(row["mobile Phone"], "15934561712")
        self.assertEqual(row["account id"], "ACC-1")
        self.assertEqual(row["title"], "")
        self.assertEqual(row["department"], "")
        self.assertEqual(row["street Address"], "")
        self.assertEqual(row["company"], "")
        self.assertEqual(row["city"], "上海")
        self.assertEqual(row["province"], "江苏")
        self.assertEqual(row["utm_campaign"], "")
        self.assertEqual(row["utm_content"], "")
        self.assertEqual(row["utm_term"], "")
        self.assertEqual(row["utm_medium"], "")
        self.assertEqual(row["utm_source"], "")
        self.assertEqual(row["call wk"], "FY27Q2W02")
        self.assertEqual(row["call type"], "Leads")
        self.assertEqual(row["Campaign Name"], "FY27Q2_APJC_GC_CN Commerical Membership MA")
        self.assertEqual(row["Allocaida ID"], "3445891")


if __name__ == "__main__":
    unittest.main()
