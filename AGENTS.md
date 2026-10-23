# 映屿 · CineIsle 基础开发约定

HarmonyOS NEXT 原生手机工程，ArkTS/ArkUI Stage 模型，最低 API 12。固定 Android 基准为 `codex/actor-experience` 的 `225fba7cb5ad68865986a96e4b62d883c1d987a0`；以 `docs/source-baseline.json` 和 `docs/MIGRATION.md` 为准，不混入未提交修改。

## 所有任务适用

- 源码结构发现优先使用 codebase-memory MCP；尚未索引时先 index_repository。字面量、配置及图谱覆盖不足处可用文本搜索。
- UI、业务规则、REST、存储、下载与播放器保持职责边界；优先扩展现有抽象。规则由所属模块统一维护，禁止混合职责的全局 Constants；保留合理局部值。
- 用户文案放资源文件。外部数据须在边界校验；平台能力以本机 SDK 声明验证，不直接复用 Kotlin、Android AAR、Room、ExoPlayer 依赖。
- 重构保持既有数值、默认值、错误分支和格式兼容；调参、迁移、依赖升级与无关格式化另列变更，保留用户已有修改。
- 不提交令牌、账户凭据、证书、私钥或签名密码；不记录含 api_key 的图片/播放地址。不得用空实现或固定成功提示伪装待迁移功能完成。
- `docs` 只保存可复用文档及无本机信息的基准；审计、执行计划、日志、截图与产物放被忽略的 `.local`。
- 修改后完成相关回归；产品代码合入前执行 `node tests/protocol.test.cjs`、`node tests/run-regression.cjs` 和 `scripts/build.sh`。纯文档变更检查内容、链接与改动范围。
- 构建、签名安装、设备 UI、真实 Jellyfin 与实际解码分别报告；未执行的验证明确列出。
- 日常使用 `develop` 或从其创建的 `feature/*`；`master` 为发布基线，不使用 `main`。提交、推送与合并遵循已有授权及 `docs/BRANCHING.md`。

## 按需加载

开始修改前，根据下表的**路径或行为**读取命中的专题；仅阅读、讨论时按实际需要加载。不要预读全部专题。新增文件按其职责判断，不能因路径未命中而跳过。

| 本次改动涉及 | 必须读取 |
|---|---|
| 新增模块/公共接口，调整依赖、业务规则、枚举、默认值或共享常量 | [架构与规则](docs/development/architecture-rules.md) |
| 页面、组件、主题、布局、文案、语言或资源 | [UI 与资源](docs/development/ui-resources.md) |
| REST/DTO、网络策略、错误身份/展示、重试或降级的错误分类 | [传输与错误](docs/development/transport-errors.md) |
| Store/Preferences/Asset、凭据/PIN、文件格式/路径、持久化校验、迁移或账号隔离 | [存储与安全](docs/development/storage-security.md) |
| 异步副作用、定时器、任务、重试调度、并发、取消、资源释放或账号/页面/会话切换 | [异步与生命周期](docs/development/async-lifecycle.md) |
| C++/N-API、播放器、字幕、解码、媒体资源上限或平台能力 | [原生与媒体](docs/development/native-media.md) |
| 修改测试/fixture，新增功能、修复或行为等价重构 | [测试与验收](docs/development/testing.md) |
| 构建脚本/配置、生成器/生成物、工具环境、依赖/源码锁定、版本元数据 | [工具链与生成物](docs/development/tooling-generated.md) |
| 提交、推送、PR、合并或发布 | [交付](docs/development/delivery.md) |

多项命中时取并集、每份只读一次。影响范围扩大时先补读新增专题，再修改。拿不准时读取相关专题核实；专题只在其职责内细化基础约定，不能放宽它。专题缺失或约定冲突时先处理缺口，不自行跳过。使用说明见 [开发规范入口](docs/DEVELOPMENT.md)。
