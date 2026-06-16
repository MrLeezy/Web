# Channel 映射规则

本文档基于最新版 [`/Users/lizhongyu/程序/团队协作系统/data/opportunity-master/渠道映射.xlsx`](/Users/lizhongyu/程序/团队协作系统/data/opportunity-master/渠道映射.xlsx) 整理，更新时间为 `2026-05-22 20:55:40`。

## 总体口径

- `channel_classification` 和 `channel` 只能来自这张映射表。
- 匹配顺序严格按照 Excel 行序自上而下，命中第一条即停止。
- 程序匹配前统一处理：
  - 字母转小写
  - 去首尾空格
  - 连续空格压缩为单空格
  - 规则中的 `utmContent / utmSource / utmcampaign / formTitle / moduleSource` 分别对应：
    - `utm_content`
    - `utm_source`
    - `utm_campaign`
    - `form_title`
    - `module_source`
- 若完全未命中，默认输出：
  - `channel_classification = 自然流量`
  - `channel = 自然流量`

## 规则明细

| 行号 | 原始规则摘要 | 输出 `channel_classification` | 输出 `channel` | 来源标签 |
| --- | --- | --- | --- | --- |
| 2 | `utmContent` 包含 `mona / ellis / anna-sun / bonnie-sun / mona_li` 且 `utmSource` 包含 `sms_5G` | MA | sms_5g | 会员 |
| 3 | 同上，且 `utmSource` 包含 `sms` 且不含 `5G` | MA | sms | 会员 |
| 4 | 同上，且 `utmSource` 包含 `edm` | MA | edm | 会员 |
| 5 | 同上，且 `utmSource` 包含 `xcxdingyue / wechat_template` | MA | wechat_template | 会员 |
| 6 | 同上，且 `utmSource` 包含 `wechat_dellemcsolution` | 营销渠道 | wechat_dellemcsolution | 会员 |
| 7 | 同上，且 `utmSource` 包含 `wechat_dellkeji` | 营销渠道 | wechat_dellkeji | 会员 |
| 8 | 同上，且 `utmSource` 包含 `wechat_dellqicai` | 营销渠道 | wechat_dellqicai | 会员 |
| 9 | 同上，且 `utmSource` 包含 `wechat_dellshangyong` | 营销渠道 | wechat_dellshangyong | 会员 |
| 10 | 同上，且 `utmSource` 包含 `wechat_shequn / shequn` | 营销渠道 | wechat_shequn | 会员 |
| 11 | `utmContent` 包含 `mona-li / ellis / anna-sun / bonnie-sun` 且 `utmSource` 包含 `sino-call` | sino-call | sino-call | 会员 |
| 12 | `utmContent` 包含 `mona-li` 且 `utmSource` 包含 `xuanxingbao` | 媒体渠道 | 选型宝 | 会员 |
| 13 | `utmContent` 包含 `mona-li` 且 `utmSource` 包含 `d1net` | 媒体渠道 | d1net | 会员 |
| 14 | `utm_campaign` 包含 `wechatservice` | 自然流量 | 自然流量 | 会员 |
| 15 | `utm_campaign` 包含 `promotion-small / small-promotion` | 自然流量 | 自然流量 | 会员 |
| 16 | `utmSource` 包含 `zijie-brz / zijie-kew / toutiao_brz / douyin_brz` | 自然流量 | 自然流量 | 会员 |
| 17 | `utm_campaign` 包含 `baidu_sem_kew / baidu_sem_brz / 360-sem-kew / bdwp-fy23q4` | 自然流量 | 自然流量 | 会员 |
| 18 | `formTitle = 表单是产品中心采购单` 且 `moduleSource = ISV经销商` | 自然流量 | 自然流量 | 会员 |
| 19 | `utmSource` 包含 `douyin` | 付费媒体 | douyin | 网站 |
| 20 | `utmSource` 包含 `kuaishou` | 付费媒体 | kuaishou | 网站 |
| 21 | `utmSource` 包含 `xiaohongshu` | 付费媒体 | xiaohongshu | 网站 |
| 22 | `utmSource` 包含 `xiaohongshu_xcx` | 付费媒体 | xiaohongshu_xcx | 网站 |
| 23 | `utmSource` 包含 `wechat-dsp / wechats_dsp` | 付费媒体 | wechat-dsp | 网站 |
| 24 | `utmSource` 包含 `wechat-dsp-xcx` | 付费媒体 | wechat-dsp-xcx | 网站 |
| 25 | `utm_campaign` 包含 `brz / kew` | 自然流量 | 自然流量 | 会员 |
| 26 | `utmSource` 包含 `51cto` | 传统媒体 | 51cto | 网站 |
| 27 | `utmSource` 包含 `it168 / it68` | 传统媒体 | it168 | 网站 |
| 28 | `utmSource` 包含 `zhiding` | 传统媒体 | zhiding | 网站 |
| 29 | `utmSource` 包含 `doit` | 传统媒体 | doit | 网站 |
| 30 | `utmSource` 包含 `yesky` | 传统媒体 | yesky | 网站 |
| 31 | `utmSource` 包含 `d1net` 且 `utmContent` 不包含 `mona` | 传统媒体 | wechat-dsp | 网站 |
| 32 | `utmSource` 包含 `cbi` | 传统媒体 | cbi | 网站 |
| 33 | `utmSource` 包含 `ciotimes` | 传统媒体 | ciotimes | 网站 |
| 34 | `utmSource` 包含 `dtinsight` | 传统媒体 | dtinsight | 网站 |
| 35 | `utmSource` 等于 `wechat_dell` | 营销渠道 | wechat_dell | 网站 |
| 36 | `utmSource` 包含 `toutiao` | 付费媒体 | toutiao | 网站 |
| 37 | `utmSource` 等于 `dell-call` | 主动外呼 | 主动外呼 | 补充规则 |
| 38 | `utmSource` 包含 `wechat_dellshangyongsolution` | 营销渠道 | wechat_dellshangyong | 补充规则 |

## 程序实现补充

- `【包含】` / `【包括】`：按子串匹配处理。
- `【不包含】`：任一禁用词命中即判定失败。
- `【等于】`：按归一化后的全文精确匹配。
- 多个候选值之间的 `/` 或 `或` 视为“任一命中即可”。
- `sms【不含5G字样】` 的实现口径为：
  - `utm_source` 含 `sms`
  - 同时 `utm_source` 不含 `5g`
- 对 `utm_source` 的预处理口径：
  - 字母转小写
  - 去首尾空格
  - 连续空格压缩为单空格
- `wechat-dsp-xcx` 和 `xiaohongshu_xcx` 需要优先按完整值命中，不能被 `wechat-dsp`、`xiaohongshu` 这类宽规则提前吃掉。
- 若一条数据先命中宽泛的 `自然流量` 规则，但 `utm_source` 本身存在更明确的渠道归属，则优先采用更明确的渠道归属。

## 代码补充兜底

以下规则属于当前项目代码中的补充兜底逻辑。其他项目如果要和本项目做到完全一致，也需要一起实现：

- `utm_source` 精确值兜底：
  - `sms` -> `MA / sms`
  - `sms_5g`、`sms_5g_xcx` -> `MA / sms_5g`
  - `edm` -> `MA / edm`
  - `wechat_template`、`xcxdingyue` -> `MA / wechat_template`
  - `xuanxingbao` -> `媒体渠道 / 选型宝`
  - `d1net` -> `传统媒体 / wechat-dsp`
  - `douyin-laike` -> `付费媒体 / douyin-laike`
  - `toutiao` -> `付费媒体 / toutiao`
  - `dell-call` -> `主动外呼 / 主动外呼`
- `utm_source` 家族归并兜底：
  - `solutioncom`、`solution_mb`、`wechat_dellemcsolution`、`wechat_dellemcsolution_menu`、`wechat_dellemcsolution_tuiwen` -> `营销渠道 / wechat_dellemcsolution`
  - `wechat_dellkeji`、`wechat_dellkeji_menu`、`wechat_dellkeji_tuiwen` -> `营销渠道 / wechat_dellkeji`
  - `wechat_dellqicai`、`wechat_dellqicai_menu`、`wechat_dellqicai_tuiwen` -> `营销渠道 / wechat_dellqicai`
  - `wechat_dellshangyong`、`wechat_dellshangyongsolution_500integral` -> `营销渠道 / wechat_dellshangyong`
  - `wechat_shequn`、`shequn` -> `营销渠道 / wechat_shequn`
- 包含匹配兜底：
  - 只要 `utm_source` 包含 `wechat_dellshangyongsolution`，则映射为 `营销渠道 / wechat_dellshangyong`
