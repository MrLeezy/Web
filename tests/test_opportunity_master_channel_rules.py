from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from opportunity_master_lib.channel_rules import ChannelRuleEngine  # noqa: E402


class ChannelRuleEngineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = ChannelRuleEngine.from_workbook(ROOT / "data" / "opportunity-master" / "渠道映射.xlsx")

    def test_match_member_sms(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_content": "mona-li", "utm_source": "sms_5g"}
        )
        self.assertEqual(classification, "MA")
        self.assertEqual(channel, "sms_5g")
        self.assertEqual(row_number, 2)

    def test_match_paid_media_wechat_dsp(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_content": "", "utm_source": "wechat-dsp"}
        )
        self.assertEqual(classification, "付费媒体")
        self.assertEqual(channel, "wechat-dsp")
        self.assertEqual(row_number, 24)

    def test_match_xcx_variant_before_broader_rule(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_content": "", "utm_source": "wechat-dsp-xcx"}
        )
        self.assertEqual(classification, "付费媒体")
        self.assertEqual(channel, "wechat-dsp-xcx")
        self.assertEqual(row_number, 25)

    def test_match_xiaohongshu_xcx_before_broader_rule(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_content": "", "utm_source": "xiaohongshu_xcx"}
        )
        self.assertEqual(classification, "付费媒体")
        self.assertEqual(channel, "xiaohongshu_xcx")
        self.assertEqual(row_number, 23)

    def test_fallback_alias_solutioncom(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_content": "", "utm_source": "solutioncom"}
        )
        self.assertEqual(classification, "营销渠道")
        self.assertEqual(channel, "wechat_dellemcsolution")
        self.assertIsNone(row_number)

    def test_member_edm_xcx_still_matches_edm_rule(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_content": "mona-li", "utm_source": "edm_b_xcx"}
        )
        self.assertEqual(classification, "MA")
        self.assertEqual(channel, "edm")
        self.assertEqual(row_number, 4)

    def test_source_specific_mapping_overrides_natural_traffic(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_campaign": "wechatservice-dellqicai", "utm_source": "wechat_dellqicai_menu"}
        )
        self.assertEqual(classification, "营销渠道")
        self.assertEqual(channel, "wechat_dellqicai")
        self.assertIsNone(row_number)

    def test_dell_call_fallback(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_source": "dell-call"}
        )
        self.assertEqual(classification, "主动外呼")
        self.assertEqual(channel, "主动外呼")
        self.assertIsNone(row_number)

    def test_douyin_laike_fallback(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_source": "douyin-laike"}
        )
        self.assertEqual(classification, "付费媒体")
        self.assertEqual(channel, "douyin-laike")
        self.assertIsNone(row_number)

    def test_wechat_dellshangyongsolution_family(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_source": "wechat_dellshangyongsolution_500integral"}
        )
        self.assertEqual(classification, "营销渠道")
        self.assertEqual(channel, "wechat_dellshangyong")
        self.assertIsNone(row_number)

    def test_unmatched_returns_empty(self) -> None:
        classification, channel, row_number = self.engine.match(
            {"utm_content": "unknown", "utm_source": "unknown"}
        )
        self.assertEqual(classification, "自然流量")
        self.assertEqual(channel, "自然流量")
        self.assertIsNone(row_number)


if __name__ == "__main__":
    unittest.main()
