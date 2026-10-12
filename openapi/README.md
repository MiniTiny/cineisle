# Jellyfin OpenAPI 客户端

正式客户端固定使用官方 TypeScript SDK `v0.11.0` 标签提供的 Jellyfin **10.10.0 / OpenAPI 3.0.1** 规范。原始文件为 `jellyfin-10.10.0.json`；来源、SHA-256、选用操作及输出目录见 `client-config.json`。这是主要 DTO 协议基准。另固定官方 SDK v0.8.0 的 10.8.9 规范及 SHA，生成 10.8.x 路由兼容变体；运行时不下载规范。已从用户服务器公开系统信息确认实际版本为 10.8.13。

```bash
python3 scripts/generate-jellyfin.py
python3 scripts/generate-jellyfin.py --check
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/openapi-regression.test.cjs
./scripts/build.sh
```

命令在工程根目录执行，生成过程只需要 Python 3 标准库，无 Java/npm/网络依赖。`build.sh` 编译前执行 `--check`；生成文件被手改、输入变化而未重新生成或不支持的 schema 会让检查失败。升级时固定新的官方规范与 SHA，再重新生成、检查代码差异、运行全部回归、编译并对目标服务端联调；不要单独修改输出 DTO。

`scripts/generate-jellyfin.py` 是为当前应用接口维护的 ArkTS 子集生成器，并非完整 OpenAPI Generator 或完整 Jellyfin SDK。它生成命名接口、枚举、请求参数、返回 DTO、路由、查询/JSON 请求体和图片/视频 URL 方法，保留 required、optional 和 nullable。支持本规范使用的本地引用、数组、字典、标量和单引用 allOf；其他组合、媒体类型或参数格式遇到时立即失败。新增接口先加 `operations`，遇到新结构则扩展生成器和相应回归。

## 分层

- `entry/src/main/ets/api/generated`：24 个当前操作、88 个模型/枚举/内联类型及 23 个请求类型。参数名来自规范；数组按 OpenAPI 默认 `form/explode` 使用重复键。生成的 `getItemsFromQuery` 把现有业务入口的 CSV 字符串查询转换为规范类型，后出现的同名选项覆盖前项；账户 userId 始终由业务会话指定。
- `api/NativeHttpTransport.ets`：系统 `@ohos.net.http`，MediaBrowser 请求头、超时、状态码、HTML/JSON 错误、连接释放。文本字幕使用文本请求；图片、视频与系统下载由原有平台组件消费 URL，不额外下载二进制。
- `api/DomainMapping.ets`：生成 DTO 转为现有页面/缓存业务模型。校验媒体身份、分页总数、已使用的数据结构；把 optional/null 转为领域约定。官方 `IsTextSubtitleStream` 映射到播放器的 `IsTextSubtitle`。
- `service/JellyfinClient.ets`：保留登录、列表、推荐、详情、收藏、观看、播放信息、字幕、流、上报和媒体删除等业务入口。应用功能全部调用生成操作；低层 `request` 仅保留兼容入口。
- `model/Models.ts`：账户、UI/缓存媒体、下载、快照及播放路由的领域模型，不再声明手写认证/系统信息/上报协议 DTO。

## 当前覆盖

公开系统信息、密码认证、用户 Views、Items、详情、Resume、Latest、NextUp、电影推荐、Seasons、Episodes、收藏添加/取消、观看添加/取消、DeleteItem、PlaybackInfo、SRT 字幕、视频流 URL、主图/背景图 URL、开始/进度/停止上报，共 24 个操作。完整列表和原始路由见生成的 `manifest.json`。

按规范使用 `/Items`、`/UserViews`、`/UserItems/Resume`、`/Items/Latest`、`/UserFavoriteItems/{itemId}`、`/UserPlayedItems/{itemId}`，账户通过 userId 查询传入。登录读取公开 Version；恢复的旧会话首次联网同样读取版本，并发请求共享查询，失败可重试。10.8.x 使用历史规范生成的 Views、详情、Resume、Latest、收藏/观看共 8 个 `/Users/{userId}/…` 路由变体，userId 编码进路径且不再重复到查询；`/Items`、播放和上报路径不变。其他版本使用主要规范路由；不会因 405 自动改方法或重复写入。版本仅在当前客户端内存缓存，重新启动的会话会重新识别；10.9 等其他版本未专门适配或联调。开始、进度、停止使用各自 DTO，停止不发送规范未定义的暂停/播放方式字段。

## 边界

DTO 类型不是完整运行时 JSON schema 验证。HTTP 层与领域映射验证当前必要边界，未使用的 DTO 字段不全部校验。int64 映射为 JavaScript number；传输层拒绝请求/响应中的非有限数字及不安全整数，生成的整数参数还检查 int32 范围。暂不支持任意精度 int64，超范围数据明确失败，不静默四舍五入后继续使用。

图片/视频 URL 为适配现有组件携带 `api_key`，不能记录到日志；JSON/字幕请求只在授权请求头携带令牌。生成 DTO 不存储账户令牌，认证返回的 AccessToken 由现有 Session/Asset 流程管理。未引入 Axios 或社区 SDK 运行时依赖。SRT 转换不新增图片字幕、ASS 样式或视频转码能力。

405 修复后 OpenAPI 回归 54 项、功能回归 41 项，全部 261 项通过。新增 10.8 路由、旧会话首页、并发版本识别/重试、无写入重试及历史规范漂移测试。主要 DTO 仍由 10.10.0 生成，兼容输入只用于路由/参数位置校验；不是完整历史版本 DTO 生成或任意版本保证。10.8 不支持的新增查询参数会明确拒绝。HTTP 回归是平台模拟；真实服务器公开探测复现 405/404 并确认旧路由返回 401，未使用账号验收媒体、动作、下载或播放。见 `docs/VALIDATION.md` 与迁移报告。

首页对齐阶段新增 GetNextUp（/Shows/NextUp），10.8/10.10 路由一致；业务取9项并显式userId/enableUserData。库内Latest指定parentId和limit12，不限定Movie/Series以保留服务端剧集分组。当前59项OpenAPI回归、全部295项回归通过，仍是平台HTTP模拟；真实NextUp/认证图片与设备需另行验收。

详情页新增 `DeleteItem`（`DELETE /Items/{itemId}`，10.8/10.10 相同），24个操作全部经过模拟协议回归；删除权限不由生成客户端推断，`AppService.deleteMedia` 先重新获取详情并核对 `CanDelete === true`，页面提供不可逆服务器删除确认。`GetNextUp` 详情查询携带 seriesId/limit=1，首页仍limit=9；扩展领域映射的原名、分级、类型、播出时间、权限、预告片及音视频规格，nullable字段归一化，必要字段类型校验。不手改生成文件，也未执行真实服务器删除。
