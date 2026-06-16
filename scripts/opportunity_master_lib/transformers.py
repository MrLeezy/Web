from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from urllib.parse import parse_qsl, unquote, urlsplit

from openpyxl.utils.datetime import from_excel

from .channel_rules import ChannelRuleEngine


PHONE_PATTERN = re.compile(r"^1\d{10}$")
EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
DATETIME_PATTERNS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y-%m-%d %H:%M:%S",
    "%Y/%m/%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y/%m/%d %H:%M",
)

PAID_MEDIA_CHANNELS = {"douyin", "toutiao", "kuaishou", "xiaohongshu", "xiaohongshu_xcx"}
TENCENT_CHANNELS = {"wechat-dsp", "wechat-dsp-xcx"}


@dataclass
class BuildStats:
    input_counts: Counter = field(default_factory=Counter)
    output_counts: Counter = field(default_factory=Counter)
    invalid_counts: Counter = field(default_factory=Counter)
    channel_counts: Counter = field(default_factory=Counter)
    filtered_counts: Counter = field(default_factory=Counter)


def empty_target_row(target_fields: list[str]) -> dict[str, str]:
    return {field: "" for field in target_fields}


def stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def normalize_account_id(value: Any, stats: BuildStats) -> str:
    text = stringify(value)
    if text in {"未查到", "无公司名"}:
        stats.invalid_counts["account_id_cleared"] += 1
        return ""
    return text


def normalize_phone(value: Any, stats: BuildStats, counter_key: str = "invalid_phone") -> str:
    text = stringify(value)
    if not text:
        return ""
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    text = re.sub(r"\D", "", text)
    if PHONE_PATTERN.fullmatch(text):
        return text
    stats.invalid_counts[counter_key] += 1
    return ""


def normalize_phone_for_match(value: Any) -> str:
    text = stringify(value)
    if not text:
        return ""
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    text = re.sub(r"\D", "", text)
    if text.startswith("86") and len(text) > 11:
        text = text[2:]
    return text if PHONE_PATTERN.fullmatch(text) else ""


def normalize_email(value: Any, stats: BuildStats) -> str:
    text = stringify(value)
    if not text:
        return ""
    lowered = text.lower()
    if EMAIL_PATTERN.fullmatch(lowered):
        return lowered
    stats.invalid_counts["invalid_email"] += 1
    return ""


def normalize_email_for_match(value: Any) -> str:
    text = stringify(value)
    if not text:
        return ""
    lowered = text.lower()
    return lowered if EMAIL_PATTERN.fullmatch(lowered) else ""


def normalize_date(value: Any, stats: BuildStats, counter_key: str) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, (int, float)):
        try:
            return from_excel(value).strftime("%Y-%m-%d")
        except (OverflowError, ValueError):
            stats.invalid_counts[counter_key] += 1
            return ""
    text = stringify(value)
    if not text:
        return ""
    if re.fullmatch(r"\d+(\.\d+)?", text):
        stats.invalid_counts[counter_key] += 1
        return ""
    for pattern in DATETIME_PATTERNS:
        try:
            return datetime.strptime(text, pattern).strftime("%Y-%m-%d")
        except ValueError:
            continue
    stats.invalid_counts[counter_key] += 1
    return ""


def normalize_blankish_text(value: Any) -> str:
    text = stringify(value)
    if text in {"0", "未提供"}:
        return ""
    return text


def first_present(raw: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in raw:
            value = raw.get(key)
            if value not in (None, ""):
                return value
    return ""


def normalize_city(value: Any) -> str:
    text = normalize_blankish_text(value)
    if not text:
        return ""
    return re.sub(r"市$", "", text)


def normalize_province(value: Any) -> str:
    text = normalize_blankish_text(value)
    if not text:
        return ""
    return re.sub(r"省$", "", text)


def call_quarter_from_week(value: Any) -> str:
    text = stringify(value)
    if "W" in text:
        return text.split("W", 1)[0]
    return text


def normalize_call_week(value: Any) -> str:
    text = stringify(value)
    if not text:
        return ""

    matched = re.fullmatch(r"(.*W)(\d{1,2})", text, flags=re.IGNORECASE)
    if not matched:
        return text

    prefix, week_number = matched.groups()
    return f"{prefix}{int(week_number):02d}"


def normalize_call_type(value: Any) -> str:
    text = stringify(value)
    mapping = {
        "QSRL": "Leads",
        "Leads": "Leads",
        "Route to CSB": "Leads",
        "Route to Dell Solution": "Leads",
        "Route to EMC Solution": "Leads",
        "SRL": "Signals",
        "Signal": "Signals",
        "Signals": "Signals",
        "Signal-MRL": "Signals",
        "SRL(待确定)": "Signal(待确定)",
        "Signal(待确定)": "Signal(待确定)",
        "非SRL": "Non-Signals",
    }
    return mapping.get(text, "Non-Signals" if text else "")


def apply_sfdc_call_type_override(
    row: dict[str, str],
    phone_matches: set[str],
    email_matches: set[str],
    stats: BuildStats,
) -> dict[str, str]:
    if row.get("call type") == "Leads":
        stats.filtered_counts["sfdc_call_type_leads_ignored"] += 1
        return row

    phone_key = normalize_phone_for_match(row.get("mobile Phone"))
    email_key = normalize_email_for_match(row.get("email"))
    phone_matched = bool(phone_key and phone_key in phone_matches)
    email_matched = bool(email_key and email_key in email_matches)
    if not phone_matched and not email_matched:
        return row

    row["call type"] = "Signals"
    stats.filtered_counts["sfdc_call_type_overrides"] += 1
    if phone_matched:
        stats.filtered_counts["sfdc_call_type_phone_matches"] += 1
    if email_matched:
        stats.filtered_counts["sfdc_call_type_email_matches"] += 1
    stats.filtered_counts["sfdc_call_type_signals"] += 1
    return row


def extract_utm_params(raw_value: Any) -> dict[str, str]:
    text = stringify(raw_value)
    if not text:
        return {
            "utm_campaign": "",
            "utm_content": "",
            "utm_term": "",
            "utm_medium": "",
            "utm_source": "",
        }
    decoded = unquote(text)
    query = urlsplit(decoded).query if "?" in decoded else decoded
    params = dict(parse_qsl(query, keep_blank_values=True))
    return {
        "utm_campaign": normalize_blankish_text(params.get("utm_campaign")),
        "utm_content": normalize_blankish_text(params.get("utm_content")),
        "utm_term": normalize_blankish_text(params.get("utm_term")),
        "utm_medium": normalize_blankish_text(params.get("utm_medium")),
        "utm_source": normalize_blankish_text(params.get("utm_source")),
    }


def derive_campaign_fields(channel: str) -> tuple[str, str]:
    normalized_channel = stringify(channel)
    if normalized_channel in PAID_MEDIA_CHANNELS:
        return ("FY27Q2_APJC_GC_CN Eshop_Promotion DY/Toutiao/Kuaishou", "3445890")
    if normalized_channel in TENCENT_CHANNELS:
        return ("FY27Q2_APJC_GC_CN Eshop_Promotion Tencent-WPP", "3445892")
    return ("FY27Q2_APJC_GC_CN Commerical Membership MA", "3445891")


def map_combined_data_source(value: Any) -> str:
    text = stringify(value)
    if text in {"400电话", "400电话-CMG"}:
        return "400"
    if text == "sales_chat":
        return "Chat"
    return ""


def _set_common_fields(target: dict[str, str], raw: dict[str, Any], stats: BuildStats, channel_engine: ChannelRuleEngine, context: dict[str, Any]) -> None:
    target["email"] = normalize_email(context.get("email"), stats)
    target["mobile Phone"] = normalize_phone(context.get("mobile Phone"), stats)
    target["account id"] = normalize_account_id(context.get("account id"), stats)
    target["capture date"] = normalize_date(context.get("capture date"), stats, "invalid_capture_date")
    target["call date"] = normalize_date(context.get("call date"), stats, "invalid_call_date")
    target["call wk"] = normalize_call_week(context.get("call wk"))
    target["call quarter"] = stringify(context.get("call quarter"))
    target["call type"] = normalize_call_type(context.get("call type"))
    target["channel_classification"], target["channel"], matched_rule = channel_engine.match(context)
    if matched_rule is None:
        stats.channel_counts["unmatched"] += 1
    else:
        stats.channel_counts[f"rule_{matched_rule}"] += 1
    campaign_name, allocaida_id = derive_campaign_fields(target["channel"])

    target["company"] = normalize_blankish_text(context.get("company"))
    target["title"] = stringify(context.get("title"))
    target["department"] = stringify(context.get("department"))
    target["street Address"] = stringify(context.get("street Address"))
    target["city"] = normalize_city(context.get("city"))
    target["province"] = normalize_province(context.get("province"))
    target["member_id"] = stringify(context.get("member_id"))
    target["leads id"] = stringify(context.get("leads id"))
    target["utm_campaign"] = normalize_blankish_text(context.get("utm_campaign"))
    target["utm_content"] = normalize_blankish_text(context.get("utm_content"))
    target["utm_term"] = normalize_blankish_text(context.get("utm_term"))
    target["utm_medium"] = normalize_blankish_text(context.get("utm_medium"))
    target["utm_source"] = normalize_blankish_text(context.get("utm_source"))
    target["Campaign Name"] = campaign_name
    target["Allocaida ID"] = allocaida_id
    target["remark type"] = stringify(context.get("remark type"))


def transform_record(source_name: str, raw: dict[str, Any], target_fields: list[str], stats: BuildStats, channel_engine: ChannelRuleEngine) -> dict[str, str]:
    target = empty_target_row(target_fields)

    if source_name == "website_q2":
        target["商机渠道"] = "主动外呼"
        context = {
            "member_id": first_present(raw, "用户ID"),
            "email": raw.get("Email"),
            "mobile Phone": raw.get("Mobile Phone"),
            "account id": first_present(raw, "Account ID", "AccountID"),
            "company": raw.get("Company"),
            "title": raw.get("Title"),
            "department": raw.get("Department"),
            "street Address": raw.get("Street Address"),
            "city": raw.get("City"),
            "province": raw.get("State"),
            "leads id": first_present(raw, "原始ID", "MKT ID"),
            "utm_campaign": first_present(raw, "广告名称\n(utm_campaign)", "广告名称 (utm_campaign)"),
            "utm_content": first_present(raw, "广告内容\n(utm_content)", "广告内容 (utm_content)"),
            "utm_term": first_present(raw, "广告关键字\n(utm_term)", "广告关键字 (utm_term)"),
            "utm_medium": first_present(raw, "广告媒介\n(utm_medium)", "广告媒介 (utm_medium)"),
            "utm_source": first_present(raw, "广告来源\n(utm_source)", "广告来源 (utm_source)"),
            "capture date": raw.get("Capture Date"),
            "call date": raw.get("Call Date"),
            "call wk": raw.get("Call Wk"),
            "call quarter": raw.get("Call Quarter"),
            "call type": raw.get("Call Type"),
            "remark type": raw.get("Details Remark"),
            "form_title": raw.get("来源表单"),
            "module_source": first_present(raw, "LV2来源模块", "LV2 来源模块"),
        }
    elif source_name in {"website_q1", "website_fy26q4_weekly", "website_fy26q3_combined", "website_fy26q2_sino"}:
        target["商机渠道"] = "主动外呼"
        context = {
            "email": raw.get("Email"),
            "mobile Phone": raw.get("Mobile Phone"),
            "account id": raw.get("Dell Salesforce AccountID"),
            "company": raw.get("Company"),
            "title": raw.get("Title"),
            "department": raw.get("Department"),
            "street Address": raw.get("Street Address"),
            "city": raw.get("City市"),
            "province": raw.get("State省"),
            "leads id": raw.get("ID"),
            "utm_campaign": raw.get("广告名称"),
            "utm_content": raw.get("广告内容"),
            "utm_term": raw.get("广告关键字"),
            "utm_medium": raw.get("广告媒介"),
            "utm_source": raw.get("广告来源"),
            "capture date": raw.get("Capture Date"),
            "call date": raw.get("Call Date"),
            "call wk": raw.get("Call Wk"),
            "call quarter": raw.get("Call Quarter"),
            "call type": raw.get("SRL导入标识"),
            "remark type": raw.get("Details Remark"),
            "form_title": raw.get("来源表单"),
            "module_source": raw.get("LV2 来源模块"),
        }
    elif source_name == "chat":
        target["商机渠道"] = "Chat"
        context = {
            "mobile Phone": raw.get("电话号码"),
            "leads id": raw.get("MKT ID"),
            "utm_campaign": raw.get("广告名称(utm_campaign)"),
            "utm_content": raw.get("广告内容(utm_content)"),
            "utm_term": raw.get("广告关键字(utm_term)"),
            "utm_medium": raw.get("广告媒介(utm_medium)"),
            "utm_source": raw.get("广告来源(utm_source)"),
            "capture date": raw.get("会话开始时间"),
            "call date": raw.get("会话开始时间"),
            "call wk": raw.get("Business_Week"),
            "call quarter": call_quarter_from_week(raw.get("Business_Week")),
            "call type": raw.get("窗口粘贴"),
            "remark type": "",
            "form_title": raw.get("来源表单"),
            "module_source": raw.get("栏目模块"),
        }
    elif source_name == "phone_400":
        target["商机渠道"] = "400"
        context = {
            "mobile Phone": raw.get("来电手机号") or raw.get("Mobile Phone"),
            "leads id": raw.get("MKT ID"),
            "capture date": raw.get("日期"),
            "call date": raw.get("日期"),
            "call wk": raw.get("Business Week"),
            "call quarter": call_quarter_from_week(raw.get("Business Week")),
            "call type": raw.get("标识归类"),
            "remark type": "",
            "form_title": raw.get("媒体来源"),
            "module_source": raw.get("来电归类"),
        }
    elif source_name == "chat_phone_combined":
        business_channel = map_combined_data_source(raw.get("数据来源"))
        if not business_channel:
            raise ValueError(f"Unsupported combined data source: {raw.get('数据来源')}")
        target["商机渠道"] = business_channel
        context = {
            "email": raw.get("Email"),
            "mobile Phone": raw.get("Mobile Phone"),
            "account id": raw.get("Dell Salesforce Account ID"),
            "company": raw.get("Company"),
            "title": "",
            "department": "",
            "street Address": "",
            "city": raw.get("City"),
            "province": raw.get("State"),
            "leads id": raw.get("MKT ID"),
            "utm_campaign": raw.get("广告名称 (utm_campaign)"),
            "utm_content": raw.get("广告内容 (utm_content)"),
            "utm_term": raw.get("广告关键字 (utm_term)"),
            "utm_medium": raw.get("广告媒介 (utm_medium)"),
            "utm_source": raw.get("广告来源 (utm_source)"),
            "capture date": raw.get("Call Date"),
            "call date": raw.get("Call Date"),
            "call wk": raw.get("Call Wk"),
            "call quarter": raw.get("Call Quarter"),
            "call type": raw.get("Call Type"),
            "remark type": raw.get("Remark Type"),
            "form_title": raw.get("来源表单"),
            "module_source": raw.get("LV2来源模块"),
        }
    elif source_name == "order":
        utm_values = extract_utm_params(raw.get("utm参数"))
        context = {
            "email": raw.get("注册公司邮箱"),
            "mobile Phone": raw.get("用户手机号"),
            "leads id": raw.get("订单编号"),
            "capture date": raw.get("生成日期"),
            "call date": raw.get("修改日期"),
            "call type": raw.get("订单操作状态"),
            "remark type": "",
            "form_title": raw.get("所属商家"),
            "module_source": raw.get("购买商品"),
            **utm_values,
        }
        target["商机渠道"] = "Order"
    else:
        raise ValueError(f"Unsupported source: {source_name}")

    _set_common_fields(target, raw, stats, channel_engine, context)
    if source_name == "chat_phone_combined":
        target["Campaign Name"] = "FY27Q2_APJC_GC_CN Commerical Membership MA"
        target["Allocaida ID"] = "3445891"
    return target


def should_drop_row(row: dict[str, str]) -> bool:
    if row.get("商机渠道") != "Order":
        return False
    meaningful_fields = [
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
    ]
    return not any(row.get(field) for field in meaningful_fields)


def _date_rank(value: str) -> tuple[int, str]:
    if not value:
        return (0, "")
    return (1, value)


def dedupe_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    grouped: dict[str, list[dict[str, str]]] = {}
    ordered: list[dict[str, str]] = []
    for row in rows:
        leads_id = row.get("leads id", "")
        if not leads_id:
            ordered.append(row)
            continue
        grouped.setdefault(leads_id, []).append(row)

    deduped: list[dict[str, str]] = []
    deduped.extend(ordered)
    for leads_id, items in grouped.items():
        items.sort(
            key=lambda row: (
                1 if row.get("call type") == "Leads" else 0,
                _date_rank(row.get("call date", "")),
                _date_rank(row.get("capture date", "")),
            ),
            reverse=True,
        )
        deduped.append(items[0])
    return deduped
