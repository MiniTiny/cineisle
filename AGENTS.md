# 映屿 · CineIsle 开发约定

这是 HarmonyOS NEXT 原生手机工程，ArkTS/ArkUI Stage 模型，最低 API 12。功能基准以 docs/source-baseline.json 和 docs/MIGRATION.md 为准，当前固定基准为 codex/actor-experience 的 225fba7cb5ad68865986a96e4b62d883c1d987a0 提交，不混入未提交修改。

- 保持 UI 与 Jellyfin REST、存储、下载、播放器职责分离。用户文案放资源文件。
- 使用本机 SDK 声明检查平台 API；不要直接复用 Kotlin、Android AAR、Room、ExoPlayer 依赖。
- 优先使用 codebase-memory MCP 做源码结构发现；尚未索引时先 index_repository。字面量和配置可用文本搜索。
- 运行 scripts/build.sh 做 ArkTS 与资源编译；运行 tests/protocol.test.cjs 做协议回归。
- 构建 HAP、签名安装、设备 UI、真实 Jellyfin 联调、实际视频解码是不同的证据，不得互相替代。
- 不提交访问令牌、测试账户、证书、私钥或签名密码。不要记录包含 api_key 的图片/播放地址。
- 当前待迁移功能不得以空实现按钮或固定成功提示伪装已实现；更新迁移清单并补相应验收。
- 分支使用特性/发布模型：`master` 为发布基线，`develop` 为日常集成分支，特性从 `develop` 创建 `feature/<名称>`，验收后合入 `develop`，发布时再将 `develop` 合入 `master` 并打版本标签。日常工作使用 `develop` 或 `feature/*`，不使用 `main`。详见 `docs/BRANCHING.md`。
