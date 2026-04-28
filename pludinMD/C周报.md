我准备让其他AI新增一个插件，帮忙整理一下需求文档，下面文案比较多，整体逻辑需要严谨，不要能失误，或者我哪里说不对需要进行提醒纠正，以及我下面是我平时人作报告的时候的逻辑，是不是很多步骤比较重复，是否能比较好的解决，反正从专家的角度，100%的完成我的需求。
背景完成comsumer数据分析报告。
一、下面这个表之前都是人工维护的，现在想做前端或者变得更灵活的配置
1、/Users/lizhongyu/程序/团队协作系统/data/comsumer/配置表.xlsx 这个表 sheet1 唯一渠道数据分布 为标准渠道字典表，分别是 Channel 、 Source、Term 来标记推广渠道来源，D列为三个值的合并，E列为合并后给的唯一渠道的标识。 后面的跑的每一个数据都要对应上唯一渠道的标识，这样就知道哪个季度哪个月份，那周，哪天。哪个渠道带来的多少数据。
2、/Users/lizhongyu/程序/团队协作系统/data/comsumer/配置表.xlsx 这个表 sheet2  UTM，实际上用户的各种明细数据，都有广告来源(utm_source) 广告名称(utm_campaign) 广告关键字(utm_term)这三个字段，然后我让他们进行合并后，在和
人工归类到 唯一渠道数据分布 里面的渠道，这样就可以把人的数据和报告的数据进行匹配上。
3、/Users/lizhongyu/程序/团队协作系统/data/comsumer/配置表.xlsx 这个表 sheet3 Dictionary ，A C Q列为渠道的字典表，M-0列是后面的客服数据分析字典表。 S-V列是后面商品分析的字典表，X-Y是商品字典表哪些需要分析对应关系。AA列是有效聊天关键词。AB列是外星人产品型号。

二、/Users/lizhongyu/程序/团队协作系统/data/comsumer/UserRawdata_merged.xlsx 这个表 主要是comsumer最终合并完的数据底层数据表，最终需要通过各种线下数据、线上连数据库获取过来的。
1、前端根据首页的规范日历，选择：Year	Quarter	Month	Week
2、选择的日期如果/UserRawdata_merged.xlsx 表里面存在，就在原数据进行更新，如果不存在进行对应数据的部分。
3、UserRawdata_merged.xlsx表 A-D列 是选择的日期。
4、E列是 Year+Quarter+Week+J列唯一标识符，为每一周的的标准渠道唯一值。
5、现在是统一的表，暂时没有用。
6、G-J 是根据 /Users/lizhongyu/程序/团队协作系统/data/comsumer/配置表.xlsx 这个表 sheet1 唯一渠道数据分布 进行获取过来的渠道，比如 唯一渠道数据分布有20个渠道，这样通过当前表就知道当前周，这20个渠道的数据情况。
7、K-L 是 Source = sms / 5g-sms 这种短信渠道发送人群与发送成功人数，这个数据是通过线下表的方式上传，解析到嘴硬的数据。
8、M-N 是每一个渠道的访问次数和访问人数，是一个线下提供的表，大概表头是：广告关键词	广告来源	广告名称	用户量	页面浏览量，通过 UTM 找到对应的唯一值。

#未处理
目标列：M列 PV N列 UV
线下数据表：大概命名是 20260321-20260327_372266650_各渠道数据情况.csv 前面数字不贵，主要当时导出的时间段。
查询字段：目标用户	广告关键字 = utm_term  广告来源 = utm_source	广告名称 = utm_campaign 	用户量	页面浏览量
时间归属：按 加载当前数据 映射 FY / Quarter / Month / Week
渠道归属：按 UTM 匹配到唯一标识符
汇总方式：按 周期 + 唯一标识符 统计记录数，不去重
写入位置：页面浏览量对应行的 M列 用户量对应行的 N列

9、 0列 Unonid 是每周新增的匿名数据，是通过数据库对查询获取，大概表头是：Unionid （匿名用户）	Unionid（入库时间）	广告关键词	广告内容	广告媒介	广告来源	广告名称，通过 UTM 找到对应的唯一值。
目标列：O列 Unionid
来源表：consumer.member_wx
查询字段：union_id, create_time, utm_term, utm_content, utm_medium, utm_source, utm_campaign
时间归属：按 create_time 映射 FY / Quarter / Month / Week
渠道归属：按 UTM 匹配到唯一标识符
汇总方式：按 周期 + 唯一标识符 统计记录数，不去重
写入位置：写入对应行的 O列
10、P-Q列 user  是每周新增的实名数据，是通过数据库对查询获取，大概表头是：User（实名用户）	User（实名用户入库时间）	New User（是否老用户）	广告关键词	广告内容	广告媒介	广告来源	广告名称，通过 UTM 找到对应的唯一值；Q列 New User 是每周新增的实名数据，哪些是老用户，这个和User逻辑一样，通过上面的数据库的 New User（是否老用户）进行判断等于是的是老用户，否的不进行计算。
#未处理
目标列：P列 user Q列 New User AI列 老用户激活
来源表：consumer.member
查询字段：mobile create_time old_mobile utm_term utm_content utm_medium utm_source utm_campaign
时间归属：按 create_time 映射 FY / Quarter / Month / Week
渠道归属：按 UTM 匹配到唯一标识符
汇总方式1：按 周期 + 唯一标识符 统计记录数，不去重
写入位置1：写入对应行的 P列
汇总方式2：按 周期 + 唯一标识符 统计记录数，不去重，并且 old_mobile 不为空
写入位置2：写入对应行的 Q列 AI列


11、R-S以及U列：S列chat 是每周新增的在线客服的咨询量，这个是通过线下上传的 会话质量	首次响应时长	会话时长	社交账号ID	消息记录 这些字段，然后自定义新增1个字段是数据标记“根据会话质量里面一般会话/优质会话标记：有晓数据； 静默会话、客服未响应会话、客户为回复会话标记：无效数据”，然后在根据设计账号ID 与数据库进行匹配出 广告来源	广告媒介	广告名称	广告内容	广告关键词	商机是否有效	商机描述 字段，这个时候有utm了。以及增加两个自定义字段：DAM ：数据标记 = 无效数据，直接标记无需求，有效数据根据聊天记录字段与/Users/lizhongyu/程序/团队协作系统/data/comsumer/配置表的Dictionary 的AA列这款的关键词进行匹配，模糊匹配上就标记 Con ALW，匹配不上就标记 Con NonALW。第二个自定义DAM渠道字段判断DAM字段不是物需求的就是YES，否是就是NO，通过 UTM 找到对应的唯一值。 
S列的chat需求，是根据上面新增自定义 数据标记字段，选择有效数据进行统计。
U列chat标记，根据上面新增的自定义 DAM渠道字段，选择YES进行统计。

目标列：R列 chat S列 chat需求 U列 chat标记
线下数据表：大概命名是会话记录_含会话消息_2026年04月04日至2026年04月17日_569890778.xlsx，中间时间是不固定的，主要当时导出的时间段。
线下表包含字段：会话ID	客服	客户	会话通路	会话开始时间	会话质量	首次响应时长	会话时长	社交账号ID	消息记录
线下数据新增一个自定义字段数据标记：根据 会话质量 字段里面的 一般会话/优质会话标记标记 “有效数据”， 根据 会话质量 字段里面的 静默会话/客服未响应会话/客户为回复会话标记 “有效数据”
线下表时间归属：按 会话开始时间 映射 FY / Quarter / Month / Week
判断逻辑：如果上传线下数据表，然后进行连接数据库
来源表：consumer.kefu_visitor
查询字段：visitor_id url creareTime status description member_id url 根据url进行数据拆解
数据根据URL进行拆解：路径（保留问号之前的数据）	根据问号之后的参数拆解到 utm_source	utm_medium	utm_campaign	utm_content	utm_term
最后根据线下表上传+数据库匹配完的数据，补充两个定义字段：1、DAM（自定义字段会话质量 如果等于 无效数据，这个字段就是 无需求，否则根据消息记录与配置表.xlsx Dictionary AA列进行模糊匹配，匹配上就是标记Con ALW，匹配不上就标记Con NonALW）；2、DAM渠道（自定义字段会话质量DAM字段 = 无需求 ，这个字段就是NO，否是是YES）
渠道归属：按上面的拆解 UTM 匹配到唯一标识符
汇总方式1：按 周期 + 唯一标识符 统计记录数，不去重
写入位置1：写入对应行的 R列
汇总方式2：按 周期 + 唯一标识符 统计记录数，不去重，并且自定义字段 数据标记 = 有效数据
写入位置2：写入对应行的 S列
汇总方式3：按 周期 + 唯一标识符 统计记录数，不去重，并且自定义字段 DAM渠道 = YES
写入位置3：写入对应行的 U列

12、T列 表单外呼是每周外呼的数据情况，这个是一个线下数据表，主要包含 caller	Call Date	Quarter	Month	Week	Capture Date	Leads ID	类型	手机号	是否联系	是否有需求	Remark Type	leads remark	Details Remark	感兴趣产品	OB 销售	呼叫次数	类型备注	说明说明	用户参与时间	"广告名称(utm_campaign)"	"广告内容 (utm_content)"	"广告关键字 (utm_term)"	"广告媒介 (utm_medium)"	"广告来源(utm_source)"  这些字段，通过 UTM 找到对应的唯一值。
X列 也是上面这个表，新增两个字段 DAM字段：否有需求 = 是，并且 Remark Type 不等于 销售Reject，并且 感兴趣产品字段与/Users/lizhongyu/程序/团队协作系统/data/comsumer/配置表.xlsx 这个表 sheet3 Dictionary AB列是否能模糊匹配上，能匹配上就标记Con ALW，匹配不上就标记Con NonALW，如果第一个标签都不满足（否有需求 = 是，并且 Remark Type 不等于 销售Reject），就标记无需求，所以这个字段就三个标准值，新增的第二个字段 DAM渠道 就是判断如果刚新增DAM 字段=无需求就是NO，否则就是 YES，这个X列就是按照YES选择的数据。
但需要筛选一下 是。


目标列：T列 表单外呼，T前面新增1列商机收集 X列pengjian Y列机器人 Y列后面增加1列B2B
线下数据表：大概命名是 0260419234145356_FY27Q1 Consumer leadsform follow up summary_20260420-yunfei.xlsx，只是作为参考，里面的日期相关和数字都是随机的。
线下表包含sheet主要看：FY26Q4-FY27Q1 外呼唯一（前面时间有可能会变）、机器外呼明细、大企来源个人商机总表、外呼累计
线下表 sheet FY26Q4-FY27Q1 外呼唯一（前面时间有可能会变）字段：caller	Call Date	Quarter	Month	Week	Capture Date	Leads ID	类型	手机号	是否联系	是否有需求	Remark Type	leads remark	Details Remark	感兴趣产品	OB 销售	呼叫次数	是否有互动	类型备注	说明说明	用户参与时间	"广告名称(utm_campaign)"	"广告内容 (utm_content)"	"广告关键字 (utm_term)"	"广告媒介 (utm_medium)"	"广告来源 (utm_source)"	优先级	状态标识	11123	来源归类	2呼标识	1111	2026/1/25待机器外呼数据
线下表 sheet FY26Q4-FY27Q1 外呼唯一：按 Capture Date 映射 FY / Quarter / Month / Week
线下表 sheet FY26Q4-FY27Q1 外呼唯一 渠道归属：按上面的拆解 UTM 匹配到唯一标识符
线下表 sheet FY26Q4-FY27Q1 外呼唯一汇总方式1：按 周期 + 唯一标识符 统计记录数，不去重
线下表 sheet FY26Q4-FY27Q1 外呼唯一写入位置1：写入对应行的 新增字段 商机收集列
线下表 sheet 外呼累计字段：caller	Call Date	Quarter	Month	Week	Capture Date	Leads ID	类型	手机号	是否联系	是否有需求	Remark Type	leads remark	Details Remark	1	2	感兴趣产品	OB 销售	呼叫次数	类型备注	说明说明	用户参与时间	"广告名称 (utm_campaign)"	"广告内容 (utm_content)"	"广告关键字 (utm_term)"	"广告媒介 (utm_medium)"	"广告来源 (utm_source)"	状态标识	组别	SRL导入标识
线下表 sheet 外呼累计：按 Call Date 映射 FY / Quarter / Month / Week
线下表 sheet 外呼累计渠道归属：按上面的拆解 UTM 匹配到唯一标识符
线下表 sheet 外呼累计数据处理新增2个字段：1、DAM （根据是否有需求字段 等于 否，这个子段标记 无需求，否则根据 感兴趣产品 与 否则根据消息记录与配置表.xlsx Dictionary AB列进行模糊匹配，匹配上就是标记Con ALW，匹配不上就标记Con NonALW），2、DAM渠道（自定义字段会话质量DAM字段 = 无需求 ，这个字段就是NO，否是是YES）
线下表 sheet 外呼累计汇总方式2:按 周期 + 唯一标识符 统计记录数，不去重
线下表 sheet 外呼累计写入位置2:按 写入对应行的 之前表的T列
线下表 sheet 外呼累计汇总方式3:按 周期 + 唯一标识符 统计记录数，不去重，并且自定义字段 DAM渠道 = YES
线下表 sheet 外呼累计写入位置3:按 写入对应行的 之前表的X列
线下表 sheet 机器外呼明细字段：呼叫开始时间	呼叫结果	坐席	人工通话时长(秒)	坐席通话计费次数	电话号码	来源类型	Leads_ID	Capture_Date	姓名	Program	WPS文档	企微提醒	打招呼-原话	permission-原话	挽回-原话	外呼标签	感兴趣产品	是否触发短信	转接确认-原话	外呼形式	remark type	SRL导入标识	备注	人工leads备注	数据来源标签	备注
线下表 sheet 机器外呼明细：按 呼叫开始时间 映射 FY / Quarter / Month / Week
线下表 sheet 机器外呼明细渠道归属：按上面的拆解 UTM 匹配到唯一标识符
线下表 sheet 机器外呼明细汇总方式4:按 周期 + 唯一标识符 统计记录数，不去重
线下表 sheet 机器外呼明细写入位置4:按 写入对应行的 之前表的Y列
线下表 sheet 大企来源个人商机总表字段：caller	Call Date	Quarter	Month	Week	Capture Date	Leads ID	类型	Phone	微信	Customer Name	"Details Remark 企采网外呼备注"	感兴趣产品	ISR 	紧急标记	No	Fiscal_Week	DATE	RTM	Source	ALW_Flag	Tele team remark	预约销售联系的时间（紧急的在这里标记）	销售跟进标识 (下拉选择pending reason）	Remark(ACD & OB)使用需要，预算，行业背景，地域背景	SFDC号码	客户了解渠道	Email	企点QQ渠道	是否添加方式	Win%	Pending Reason 1类	Pending Reason 2类	Pending Reason 3类	product	platform	Product bundle	Others bundle(自行备注）	SVC upsell	CP upsell	LCD upsell	offer礼品	Invoice	Customer ID	Order	生产状态	现货/BTO	打招呼-原话	permission-原话	挽回-原话	商机标签
线下表 sheet 大企来源个人商机总表：按 Call Date 映射 FY / Quarter / Month / Week
线下表 sheet 大企来源个人商机总表渠道归属：按上面的拆解 UTM 匹配到唯一标识符
线下表 sheet 大企来源个人商机总表汇总方式5:按 周期 + 唯一标识符 统计记录数，不去重
线下表 sheet 大企来源个人商机总表写入位置5:按 写入对应行的 新增字段 B2B列

13、V列 Funnel是销售提供的线下成单表，主要包括：Source.Name	Fiscal_Quarter	ISR_Name	No	Fiscal_Week	DATE	RTM	Source	ALW_Flag	微信名	City	Phone	Remark(ACD & OB)使用需要，预算，行业背景，地域背景	SFDC号码	福建补贴	Email	企点QQ渠道	是否添加方式	Win%	Pending Reason 1类	Pending Reason 2类	Pending Reason 3类	product	platform	Product bundle	Others bundle(自行备注）	SVC upsell	CP upsell	LCD upsell	offer礼品	Invoice	Customer ID	Order	生产状态	现货/BTO 字段，需要根据 Fiscal_Quarter 、 Fiscal_Week 拆解出对应我们的 Year	Quarter	Month	Week，再根据 企点QQ渠道 拆分出 5个UTM参数（这块是因为链接，把参数都合并访问URL后面了），再找到唯一标识。这个时候需要增加两个自定义字段：QQ企点成单（根据RTM、Souerce、微信名包含访问，三个条件，并且根据Win% = 1 为QQ企点成单成单数据），Phone call 成单（根据非QQ企点成单的成单数据，以外的用户数据，phone 与 12点需求的里面Sunny offline表里面的I列手机号进行匹配，匹配上的，并且并且根据Win% = 1 为QPhone call 成单数据）。最终这个字段funnel = Phone call 成单 + QQ企点成单。
AO列是QQ企点成单数据
AQ列是 Phone call 成单


目标列：AO列企点成单数据 AQ列Phone call 成单
线下数据表：：Sales_Funnel_Summary (16).xlsx 类似这样的命名
线下数据表查询字段：Source.Name	Fiscal_Quarter	ISR_Name	No	Fiscal_Week	DATE	RTM	Source	ALW_Flag	微信名	City	Phone	Remark(ACD & OB)使用需要，预算，行业背景，地域背景	SFDC号码	福建补贴	Email	企点QQ渠道	是否添加方式	Win%	Pending Reason 1类	Pending Reason 2类	Pending Reason 3类	product	platform	Product bundle	Others bundle(自行备注）	SVC upsell	CP upsell	LCD upsell	offer礼品	Invoice	Customer ID	Order	生产状态	现货/BTO
时间归属：按 DATE 映射 FY / Quarter / Month / Week
渠道处理与归属：按 企点QQ渠道 字段路径后面的参数拆分对应的5组UTM参数，再匹配到唯一标识符
汇总方式1：按 周期 + 唯一标识符 统计记录数，不去重，以及 RTM = 企点 或者 Source = 企点 或者 企点QQ渠道 包含 pages 或者 微信名称 包含 访客 ，并且Pending Reason 1类 = 已付款
写入位置1：写入对应行的 AO列
汇总方式2：按 周期 + 唯一标识符 统计记录数，不去重，不等与汇总方式1的相关数据，通过 Phone 字段 与最新上传的 线下表 sheet FY26Q4-FY27Q1 外呼唯一 里面的 手机号 可以匹配上，并且Pending Reason 1类 = 已付款
写入位置2：写入对应行的 AQ列



14、W列先空着；
15、Y列机器人，是一个单独的表，字段包含：呼叫开始时间	呼叫结果	坐席	人工通话时长(秒)	坐席通话计费次数	电话号码	跟进码	来源类型	Leads_ID	Capture_Date	姓名	Program	WPS文档	企微提醒	打招呼-原话	permission-原话	挽回-原话	外呼标签	感兴趣产品	是否触发短信	remark type	SRL导入标识	Leads级别	人工外呼备注（备注）	人工leads备注	数据来源标签	备注 这些字段，根据呼叫开始时间拆机Year	Quarter	Month	Week字段，然后根据 Year	Quarter	Month	Week = QSRL 放到单签字段，这个数据的唯一标识都可以用b_wechat_other。
其实可以Y列后面再增加一个机器人外呼量字段，按照Year	Quarter	Month	Week拆解整体的外呼数据，不用考虑Year	Quarter	Month	Week = QSRL这个条件。
16、可以在这个位置在增加一个字段为B2B，之前没有，字段主要包括：caller	Call Date	Quarter	Month	Week	Capture Date	Leads ID	类型	Phone	微信	Customer Name	"Details Remark
企采网外呼备注"	感兴趣产品	ISR 	紧急标记	No	Fiscal_Week	DATE	RTM	Source	ALW_Flag	Tele team  remark	预约销售联系的时间（紧急的在这里标记）	销售跟进标识 (下拉选择pending reason）	Remark(ACD & OB)使用需要，预算，行业背景，地域背景	SFDC号码	客户了解渠道	Email	企点QQ渠道	是否添加方式	Win%	Pending Reason 1类	Pending Reason 2类	Pending Reason 3类	product	platform	Product bundle	Others bundle(自行备注）	SVC upsell	CP upsell	LCD upsell	offer礼品	Invoice	Customer ID	Order	生产状态	现货/BTO	打招呼-原话	permission-原话	挽回-原话	商机标签 这些字段，根据 Call Data 字段拆解 Year	Quarter	Month	Week ，筛选出来的数据进行赋值，唯一标识都可以用b_wechat_other。
17、Z列 报价单是在我们商城用户主动下单的数据，字典主要包含：销售	来源	客户手机号	订单编号	下单时间	线索信息	商品价格	商机数量	跟进状态	商机状态	广告名称	广告内容	广告关键词	广告媒介	广告来源字段，根据下单时间拆解 Year	Quarter	Month	Week 字段，并且在来源字段不等于秒杀订单。并且新增两个自定义字段， DAM  来源字段等于秒杀 直接写无需求，否则订单根据J列线索信息与/Users/lizhongyu/程序/团队协作系统/data/comsumer/配置表.xlsx 这个表 sheet3 Dictionary AB列匹配，匹配上就是NonALW，匹配不上就是Con NonALW。自定义字段 ADM渠道，根据ADM进行判断如果 = 无需求就是NO，否则就是YES
AP列 是上面的数据表商机状态 = 已成单。
* 线上产品是哪个表？ pd_product 是这个表么？ 根据哪个字段看是否是线上产品？
* 小程序每个页面PV/UV是哪个表 page_statistics 这个表么？
* 用户参与参与抽奖年是哪个表？
目标列：AM列 周年庆
来源表：consumer.interaction_log
查询字段：category1 , member_id, create_time, utm_term, utm_content, utm_medium, utm_source, utm_campaign
数据过滤：category1 = '周年庆'
时间归属：按 create_time 映射 FY / Quarter / Month / Week
渠道归属：按 UTM 匹配到唯一标识符
汇总方式：按 周期 + 唯一标识符 统计记录数，根据 member_id 去重
写入位置：写入对应行的 AM列
* 用户参与抽奖是哪个数据表？
目标列：AL列 抽奖
来源表：consumer.lucky_log
查询字段：member_id, create_time, utm_term, utm_content, utm_medium, utm_source, utm_campaign
时间归属：按 create_time 映射 FY / Quarter / Month / Week
渠道归属：按 UTM 匹配到唯一标识符
汇总方式：按 周期 + 唯一标识符 统计记录数，根据 member_id 去重
写入位置：写入对应行的 AL列
* 用户参与0元使用的数据表 try_apply  是这个表么？
目标列：AH列 0元试用
来源表：consumer.try_apply
查询字段：try_id, member_id, create_time, utm_term, utm_content, utm_medium, utm_source, utm_campaign
时间归属：按 create_time 映射 FY / Quarter / Month / Week
渠道归属：按 UTM 匹配到唯一标识符
汇总方式：按 周期 + 唯一标识符 统计记录数，根据 member_id 去重
写入位置：写入对应行的 AH列
* 用户订阅模版消息的数据表在哪里？
目标列：AG列 是否订阅
来源表：consumer.message_subscribe_log
查询字段：member_id, create_time, utm_term, utm_content, utm_medium, utm_source, utm_campaign
时间归属：按 create_time 映射 FY / Quarter / Month / Week
渠道归属：按 UTM 匹配到唯一标识符
汇总方式：按 周期 + 唯一标识符 统计记录数，根据 member_id 去重
写入位置：写入对应行的 AG列
* 用户领取优惠券的数据表 member_coupon + member_coupon_utm 么？
目标列：AF列 是否领取优惠券 
来源表1：consumer.member_coupon 
来源表2：consumer.member_coupon_utm
来源表1查询字段：member_id, coupon_code_id，create_time
来源表1查询来源2：通过 coupon_code_id 查询 来源2 coupon_code_id 获取 utm_term, utm_content, utm_medium, utm_source, utm_campaign
时间归属：按 create_time 映射 FY / Quarter / Month / Week
渠道归属：按 UTM 匹配到唯一标识符
汇总方式：按 周期 + 唯一标识符 统计记录数，根据 member_id 去重
写入位置：写入对应行的 AF列
* 用户在首页领取的2000积分在哪里查看？
目标列：AE列 领取积分
来源表1：consumer.member_points_log
来源表2：consumer.member
表1查询字段：member_id, create_time
表2查询字段：member_id, new_member，utm_term, utm_content, utm_medium, utm_source, utm_campaign
来源表1关联性：通过 表1 member_id 与 表2 member_id 关联到 utm_term, utm_content, utm_medium, utm_source, utm_campaign
时间归属：按 create_time 映射 FY / Quarter / Month / Week
渠道归属：按 UTM 匹配到唯一标识符
汇总方式：按 周期 + 唯一标识符 统计记录数
写入位置：写入对应行的 AE列
* 所有订单数据在哪里下载，包括用户主动下单，线下订单上传，秒杀订单，并且主动下单的销售跟进状态？
目标列：AA列 订单数据 ,后面可以新增一个字段 线下订单 , AK列 秒杀 , AP列 报价单成单
来源表1：consumer.order
来源表2：consumer.clue
来源表2：consumer.clue_history
表1查询字段：member_id, create_time, type, order_id, new_member，utm_term, utm_content, utm_medium, utm_source, utm_campaign
表2查询字段：member_id, id, object_id
表3查询字段：clude_id, remark
来源表1关联性：通过 表1 order_id 与 表2 object_id 关联到 id 在通过 id 与 表3 clude_id 关联到 remark（这个字段是每一个clude_id对应多条remark记录，值保留【有效商机 / 已成单】）
表1数据解读：type = reprot 为报价单，flash 为 秒杀 offline 为线下订单
时间归属：按 create_time 映射 FY / Quarter / Month / Week
渠道归属：按 UTM 匹配到唯一标识符
汇总方式：按 周期 + 唯一标识符 统计记录数，并且 type = reprot
写入位置：写入对应行的 AA列
汇总方式：按 周期 + 唯一标识符 统计记录数，并且 type = offline
写入位置：写入对应行的 新增字段 线下订单
汇总方式：按 周期 + 唯一标识符 统计记录数，并且 type = flash
写入位置：写入对应行的 AK列
汇总方式：按 周期 + 唯一标识符 统计记录数，并且 remark = 【有效商机 / 已成单】
写入位置：写入对应行的 AP列

9、所有订单在order表，type区分；销售跟进线索  clue  clue_history 两个表。
所有数据库可以查看表结构的设计，字段和表大部分都标记了注释，如果有注释不清的，可以找我


#未处理
订单数据怎么查，以及销售的标记
18、AA-AD列可以暂时忽略。
19、AE列 是数据库查询领取积分数据。
领取2000积分
20、AE列 是数据库查询领取优惠券数据。
member_coupon + member_coupon_utm
21、AG列 是数据库查询订阅小程序数据。
哪个表？
22、AH列 是数据库查询参与0元使用的数据。
23、AI列 适合 Q列 New User 是一样的数据。
24、AJ 是数据库查询新品预约的数据，暂时没有这个活动。
25、AK 列是需求17里面的报价单里面的需求，但：来源字段等于秒杀订单的数据。
秒杀数据成功的数据在哪里看？
26、AL 是数据库查询参与抽奖的数据。
*哪个表
27、AM 是数据库查询参与周年庆的数据。
*如何定义
28、AN 是 AE+AM的汇总。

三、/Users/lizhongyu/程序/团队协作系统/data/comsumer/DemandRawdata.xlsx 表，是一个每天的商机表，主要根据UserRawdata 这个表里面进行获取对应的数据，每次更新需要累积，如果有相同日期进行更新。
1、ABDE是之前统一的日期格式，D列是A+B，F列是每天的日期，G列是每天都有两行一个是外星人商机Con ALW，一个是非外星人商机 Con NonALW
2、H列是IJK的汇总；I列是/Users/lizhongyu/程序/团队协作系统/data/comsumer/UserRawdata_merged.xlsx 这个表的需求12 根据那个原始表，Call Date是每天的日期，然后根据自定义的DAM字段的Con ALW Con NonALW 去匹配，匹配不上的不算。 J列是根据/Users/lizhongyu/程序/团队协作系统/data/comsumer/UserRawdata_merged.xlsx 里面的需求15机器人外呼开始时间当前每天的时间，并且SRL导入识别 =QSRL的进行计算，全部汇总到Con NonALW这个分类里面。K列是根据/Users/lizhongyu/程序/团队协作系统/data/comsumer/UserRawdata_merged.xlsx 这个表的需求16的B2B Call Date为日数据，全部汇总到Con NonALW这个分类里面。
3、L列QQ企点Chat 是看/Users/lizhongyu/程序/团队协作系统/data/comsumer/UserRawdata_merged.xlsx 这个表的需求11 ，会员开始时间当成日，然后根据自定义字段DAM拆分Con NonALW NonALW数据。
4、M列报价单是看/Users/lizhongyu/程序/团队协作系统/data/comsumer/UserRawdata_merged.xlsx 这个表的需求17，自定义字段DAM进行拆分Con NonALW NonALW数据。
5、Red note Chat 先忽略，暂时没有数据。

四、/Users/lizhongyu/程序/团队协作系统/data/comsumer/ProductRawdata.xlsx 表是我们线上的产品，这个数据不是每次更新累计的，应该每次都进行覆盖。
1、A-K列是从数据库获取的数据。
*线上产品表 以及行为数据表
2、线下会上传一个新表，字段包含页面	访问人数	访问次数	咨询人数	咨询次数，然后根据页面与/Users/lizhongyu/程序/团队协作系统/data/comsumer/配置表.xlsx 这个表 sheet3 Dictionary 的S列进行匹配出T/U/V字段、在根据T匹配/Users/lizhongyu/程序/团队协作系统/data/comsumer/配置表.xlsxX找到Y。
3、最终根据商品表AID找到线下上传这个表的ID获取到访问人数	访问次数	咨询人数	咨询次数	频道映射	页面是否重要	产品类型	产品名称，这些数据。