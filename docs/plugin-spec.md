# Plugins 开发约束与合并规范

本规范用于约束“由其他 AI 在本仓库中新增或改造 `PLUGINS` 能力”时的实现方式，目标是：

- 保证插件结构统一，后续便于人工 review 和代码合并
- 避免不同 AI 输出的代码风格、目录结构、接口设计彼此冲突
- 保证插件能被首页 `PLUGINS` 区域、后台配置、以及本地 Node 服务正确识别

以下规范以当前仓库实现为准，默认适用于新增内置插件。

## 1. 当前插件架构

当前项目的插件不是 npm 包，也不是独立微前端，而是“仓库内置插件页面”：

- 前端入口文件放在 `plugins/`
- 每个插件通常由 3 个静态文件组成：
  - `plugins/<plugin-id>.html`
  - `plugins/<plugin-id>.css`
  - `plugins/<plugin-id>.js`
- 插件页面由 `server.js` 作为静态资源直接提供
- 插件后端接口统一挂在 `/api/plugins/<plugin-id>/...`
- 首页 `PLUGINS` 区域展示的数据来源于 `data/plugin-cards.json`
- 系统默认插件注册入口在 `server.js` 的 `DEFAULT_PLUGIN_CARDS`

结论：新增插件必须同时考虑“页面文件 + API 路由 + 插件卡片注册”三部分，缺一不可。

## 2. 必须遵守的命名规范

### 2.1 插件 ID

插件 ID 必须满足：

- 使用 `kebab-case`
- 全仓库唯一
- 只能使用小写字母、数字、中划线
- 插件 ID 必须在以下位置保持一致：
  - `DEFAULT_PLUGIN_CARDS[].id`
  - `data/plugin-cards.json` 中对应卡片的 `id`
  - 插件页面文件名
  - 插件 API 路由命名空间
  - 插件前端 JS 中的 `PLUGIN_ID`

示例：

- 合法：`leads-splitter`
- 合法：`haft-uploader`
- 不建议：`LeadsSplitter`
- 不建议：`plugin_01`

### 2.2 文件命名

新增插件时，默认采用一插件一组同名前缀文件：

```text
plugins/
  my-plugin.html
  my-plugin.css
  my-plugin.js
```

不要使用：

- `plugins/myPlugin.html`
- `plugins/index.html`
- `plugins/foo/main.js`

除非你同时完成了服务端静态路由兼容，否则不要私自改成子目录结构。

## 3. 目录与文件落点约束

### 3.1 前端文件

插件前端文件统一放在 `plugins/`：

- HTML：页面结构
- CSS：插件独立样式
- JS：插件页面逻辑

要求：

- 插件 CSS 必须尽量自包含，避免依赖首页或后台页的全局样式
- HTML 中引用资源应使用相对路径，例如：

```html
<link rel="stylesheet" href="./my-plugin.css" />
<script src="./my-plugin.js"></script>
```

### 3.2 服务端数据目录

如果插件需要落盘数据，优先使用以下路径：

- 普通运行数据：`data/<plugin-id>/`
- 上传临时文件：`data/plugin-uploads/` 或 `data/<plugin-id>/uploads/`
- 输出结果文件：`data/plugin-outputs/<plugin-id>/`
- 私密配置：`private/<plugin-id>/`

不要：

- 把运行态数据直接写进 `plugins/`
- 把敏感配置放进 `data/`
- 新插件继续依赖你本机其他目录下的历史项目路径

说明：

- 当前 `server.js` 会禁止直接通过静态资源访问 `/data`、`/private`、`/scripts`
- 所有这些数据都必须通过 API 间接访问

## 4. 插件注册规范

### 4.1 必做项

新增内置插件时，至少要完成以下注册动作：

1. 在 `server.js` 的 `DEFAULT_PLUGIN_CARDS` 中增加插件卡片定义
2. 在 `server.js` 的 `handlePluginsApi()` 中增加该插件的 API 路由
3. 在 `plugins/` 下新增对应页面文件

推荐同时做：

4. 在 `data/plugin-cards.json` 中补一条同 ID 卡片，保证当前仓库开箱即见

### 4.2 插件卡片字段规范

卡片对象字段必须兼容现有 `sanitizePluginCards()` 规则：

```json
{
  "id": "my-plugin",
  "icon": "MP",
  "title": "My Plugin",
  "category": "Automation",
  "summary": "一句话说明插件解决什么问题。",
  "pageUrl": "/plugins/my-plugin.html",
  "enabled": true
}
```

字段约束：

- `id`: 必填，唯一
- `icon`: 建议 2 个字符，适合卡片展示
- `title`: 必填
- `category`: 建议简短，例如 `Data Ops`、`Automation`
- `summary`: 必填，一句话说明用途
- `pageUrl`: 必填，必须是 `/plugins/...` 或合法 `http(s)` 地址
- `enabled`: 布尔值

## 5. API 设计规范

### 5.1 路由命名

统一使用：

```text
/api/plugins/<plugin-id>/...
```

不要新增：

- `/api/<plugin-id>/...`
- `/plugins/api/...`
- 与其他插件共享但没有明确归属的匿名路由

### 5.2 接口风格

接口约束：

- 健康检查：提供 `GET /api/plugins/<plugin-id>/health`
- 初始化数据：如有复杂页面，建议提供 `GET /bootstrap`
- 查询用 `GET`
- 创建/执行/清理等动作用 `POST`
- 删除用 `DELETE`
- 返回格式统一为 JSON

成功返回示例：

```json
{
  "ok": true,
  "plugin": "my-plugin"
}
```

失败返回示例：

```json
{
  "error": "错误说明"
}
```

要求：

- 服务端失败时使用 `sendJson(res, <status>, { error: ... })`
- 不要返回 HTML 错误页给插件前端
- 错误文案要能直接给业务同学看懂

### 5.3 输入校验

所有外部输入都必须做校验或清洗，包括：

- query 参数
- JSON body
- multipart 上传
- 文件名
- 路径参数

最少要求：

- 文件名使用 `path.basename` 或等价方式处理
- 上传文件后缀做白名单判断
- 任何落盘路径都必须防止目录穿越
- ID、数组、时间、开关值都要做类型归一化

## 6. 前端页面规范

### 6.1 技术约束

当前插件页面采用原生 HTML/CSS/JS，不使用打包器。新增插件默认也必须保持一致：

- 不引入 React/Vue/TypeScript 构建链
- 不新增 Vite、Webpack、Parcel 等构建依赖
- 不依赖外部 CDN 才能运行
- 不新增必须联网才能打开的前端资源

原因：

- 当前服务端是纯 `node server.js`
- 静态页面直接由 `serveStatic()` 提供
- 引入构建链会抬高合并和维护成本

### 6.2 页面结构建议

建议复用现有插件页面模式：

- 顶部 hero 区
- 返回首页入口
- 插件标题、分类、摘要
- 主操作区
- 状态提示区
- 结果区或日志区

最低要求：

- 页面在桌面端可用
- 页面在窄屏下不严重错位
- 有明确的加载中、成功、失败状态反馈

### 6.3 插件元信息加载

建议前端通过 `/api/plugin-cards` 读取自己的标题、分类、摘要，而不是把这些文案只写死在 HTML 中。

要求：

- 即使元信息加载失败，页面也必须可继续使用
- 即使 API 失败，也要有可读错误提示，而不是白屏

### 6.4 安全与渲染

如果 JS 需要把动态字符串插入 DOM：

- 优先使用 `textContent`
- 若必须拼接 `innerHTML`，必须先做 HTML 转义

当前 `haft-uploader.js` 中的 `escapeHtml()` 可以作为参考。

## 7. 服务端实现规范

### 7.1 路由组织

新增插件建议按以下方式接入：

- 若插件简单，可直接在 `handlePluginsApi()` 里写分支
- 若插件复杂，建议新增独立的 `handle<PluginName>Api()`，再在 `handlePluginsApi()` 中分发

目标：

- 单个插件逻辑尽量自洽
- 不要把多个插件逻辑互相穿插在一起

### 7.2 初始化与目录创建

如果插件依赖目录或数据文件：

- 在 `ensureDataFiles()` 中补充目录初始化
- 需要默认文件时，按当前项目风格在缺失时自动创建

不要要求使用者手工 mkdir 一堆目录后才能跑起来。

### 7.3 外部脚本调用

若插件需要调用 Python 或其他脚本：

- 脚本放在 `scripts/`
- 由 `server.js` 统一调用
- 前端不直接调用本地脚本

要求：

- 清楚区分输入文件、输出目录、临时文件
- 执行结束后及时清理临时文件
- 脚本异常要转成可读 JSON 错误返回

## 8. UI 与交互统一要求

其他 AI 新增插件时，界面不要求和现有页面完全同构，但必须满足以下统一要求：

- 有“返回首页”入口
- 有插件名称和用途说明
- 主按钮文案明确，不用 `Submit`、`Run` 这类过泛描述，除非上下文非常清楚
- 错误信息可读，不直接暴露技术栈报错
- 不要在插件页里嵌入后台管理功能入口，插件页只做插件本身

建议：

- 视觉上延续当前插件页的独立工作台风格
- 不污染全局样式，不覆盖首页组件

## 9. 禁止事项

其他 AI 实现插件时，禁止出现以下行为：

- 修改现有插件 ID
- 修改其他插件的 API 命名空间
- 为了接入新插件而重写首页 `PLUGINS` 整体渲染逻辑
- 引入大型前端框架或新的构建系统
- 把敏感信息硬编码进前端文件
- 把临时调试日志、测试账号、绝对本机路径直接提交进仓库
- 绕过 `server.js` 直接让前端读取 `data/` 或 `private/`
- 新增与当前 Node 服务冲突的第二套服务入口

## 10. 推荐交付格式

要求其他 AI 交付插件时，至少包含以下内容：

1. 插件 ID
2. 新增/修改文件列表
3. 插件卡片配置
4. 后端接口列表
5. 页面入口路径
6. 数据落盘位置
7. 手动验证步骤
8. 已知限制或未完成项

推荐输出模板：

```md
插件 ID：my-plugin

修改文件：
- plugins/my-plugin.html
- plugins/my-plugin.css
- plugins/my-plugin.js
- server.js
- data/plugin-cards.json

新增接口：
- GET /api/plugins/my-plugin/health
- GET /api/plugins/my-plugin/bootstrap
- POST /api/plugins/my-plugin/process

数据目录：
- data/my-plugin/
- private/my-plugin/

验证：
- 打开 /plugins/my-plugin.html
- 首页 PLUGINS 卡片可见
- 主流程成功
- 异常输入时返回 JSON 错误
```

## 11. 合并前检查清单

合并前必须逐项自检：

- 插件 ID 是否唯一且全链路一致
- 首页 `PLUGINS` 是否能看到新卡片
- 点击卡片是否能打开正确页面
- 页面 CSS/JS 资源是否都能正常加载
- `GET /api/plugins/<plugin-id>/health` 是否可用
- 所有接口失败时是否返回 JSON 错误
- 页面是否存在加载态、成功态、失败态
- 是否没有把敏感数据提交到仓库
- 是否没有修改其他插件的行为
- 是否没有引入新的打包/构建依赖
- 是否在移动宽度下仍可操作

## 12. 建议的最小实现骨架

### 12.1 前端

```text
plugins/
  my-plugin.html
  my-plugin.css
  my-plugin.js
```

### 12.2 后端

在 `server.js` 中至少补：

- `DEFAULT_PLUGIN_CARDS` 新卡片
- `GET /api/plugins/my-plugin/health`
- 业务接口

### 12.3 数据

如需要持久化：

```text
data/my-plugin/
private/my-plugin/
```

## 13. 建议给其他 AI 的一句话任务约束

如果要把任务直接丢给其他 AI，可附带下面这段约束：

> 你是在当前仓库内新增一个内置插件，不是新建独立项目。请严格遵循现有插件架构：前端文件放在 `plugins/`，页面入口为 `/plugins/<plugin-id>.html`，后端接口统一挂在 `/api/plugins/<plugin-id>/...`，并在 `server.js` 的 `DEFAULT_PLUGIN_CARDS` 中注册卡片。不要引入新的前端框架、打包器、第二套服务，所有运行数据放在 `data/` 或 `private/` 下的插件专属目录中，所有错误统一返回 JSON。

---

如果后续插件数量继续增长，建议下一步再补一版“插件脚手架模板”和“插件 API 抽象层”，但在当前阶段，先统一约束比抽象更重要。
