# 映屿 · CineIsle

映屿是一款面向 HarmonyOS NEXT 的私人影视库客户端，通过 Jellyfin 连接自己的电影与剧集。使用 ArkTS、ArkUI Stage 模型，最低 HarmonyOS 5.0 / API 12，包名 `com.cineisle.app`。

产品从 2026-10-10 起以独立的名称和视觉身份发展。“映屿”意为一座属于自己的影像岛屿，英文名 CineIsle 由 cinema 与 isle 组成。新 Logo 为原创的岛屿、银幕光束与暖色光点，见 [品牌规范](docs/BRAND.md)。已接入 Jellyfin REST 接口；功能进展与历史对照见 [功能清单](docs/MIGRATION.md)，当前验证证据见 [验证记录](docs/VALIDATION.md)。

## 开始开发

仓库采用特性/发布模型：`master` 保存发布基线，`develop` 集成日常开发，特性在 `feature/<名称>` 分支实现。开发请检出 `develop`；分支创建、合并与发布流程见 [分支约定](docs/BRANCHING.md)。

1. 在 DevEco Studio 打开本目录，使用本机 API 12 或兼容的 SDK。
2. 配置工程的 Signing Configs / Automatically generate signature，选择登录的华为开发者账户及目标设备。仓库没有证书、私钥或签名密码。
3. 选择 `entry`、`default`、`debug` 运行。首次启动输入 Jellyfin 完整地址（可包含 `/jellyfin` 反向代理路径）、用户名和密码。
4. 首页固定提供收藏与离线下载入口，四个底部入口为首页、推荐、演员、更多，媒体库在更多中进入。首页为继续观看、下一集及各媒体库最近添加横向分区，查看全部进入相应库；搜索通过工具栏图标展开。可浏览媒体库、推荐；在“更多 → 同步媒体库”建立媒体与演员缓存，再查看演员排行。
5. 电影/剧集详情显示原名、年份范围、分级/评分、类型、导演/编剧和演员；电影还显示文件大小与音视频规格。详情支持媒体版本、继续/从头播放、预告片、收藏/已看、按权限下载与管理；剧集/季支持一键播放、下一集及横向季度入口。电影的服务器删除需服务端权限与页面确认，本机下载单独管理。“更多 → 离线下载”管理本机文件。播放页“播放选项”提供媒体源、设备音轨和文本字幕选择；单集支持自动连播及手动下一集。“播放选项”还可进入画中画、开启后台听音频；系统媒体会话提供锁屏控制，画中画会同步显示当前文本字幕。在“播放选项 → 音轨与字幕语言偏好”填写语言码（如 zh、en、zh-Hant），可保存并应用、默认关闭字幕或恢复默认；设置在重启/退出登录后保留。具体设备能力及显示效果需验收。

命令行构建：

```bash
./scripts/build.sh
```

编译前以 Python 3 执行 OpenAPI 与原创图标生成漂移检查。图标几何和统一颜色来源见 `scripts/generate-icons.py` 与 `entry/src/main/resources/base/element/color.json`；更新后执行 `python3 scripts/generate-icons.py`。重新生成使用 `python3 scripts/generate-jellyfin.py`，版本固定和升级流程见 [OpenAPI 说明](openapi/README.md)。

默认读取 `/Applications/DevEco-Studio.app/Contents` 下的工具。可通过 `DEVECO_CONTENTS`、`NODE_HOME`、`DEVECO_SDK_HOME` 覆盖安装路径。生成 `entry/build/default/outputs/default/entry-default-unsigned.hap`。未配置签名时只生成 unsigned HAP，不能直接当作可安装发行包。

全套回归：`node tests/run-regression.cjs`（无需 npm 或网络安装依赖）。单独测试：

```bash
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/branding.test.cjs
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/openapi-regression.test.cjs
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/protocol.test.cjs
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/feature-regression.test.cjs
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/library-grid.test.cjs
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/media-presentation.test.cjs
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/detail-regression.test.cjs
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/player-regression.test.cjs
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/system-playback.test.cjs
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/pip-subtitle.test.cjs
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/language-preferences.test.cjs
# 原创图标、引用、状态、留白、对比度与旧路径移除检查
python3 tests/original-icons.test.py
# 构建后核验实际 HAP 的名称、包名、全部原创图标与编译身份
python3 tests/brand-package.test.py
```

测试加载真实 TypeScript/ArkTS 服务代码，并对平台 HTTP API 使用模拟对象。ArkTS 编译单独由 SDK 校验，模拟测试不验证系统 Asset、下载服务或视频解码。

功能回归还加载真实页面生命周期和查询方法，使用临时文件检查缓存保留、恢复及隔离；ArkUI 页面构建由 SDK 编译，不在 Node 中渲染。新增播放器回归覆盖字幕时间轴、轨道编号、切源、跨季连播、失败重试、生命周期和播放上报顺序。系统播放回归覆盖 AVSession 元数据/命令、后台任务授权/撤销、画中画生命周期、音频打断和晚到响应；平台会话/窗口使用模拟，不能证明锁屏 UI、后台存活或解码。画中画字幕回归加载真实字幕时间轴、页面和节点控制器，覆盖字幕同步、窗口 UIContext、缩放、释放与失败恢复；BuilderNode 和窗口是模拟，不验证像素、可读性或触摸命中。语言偏好回归覆盖应用级保存/恢复、语言匹配、自动选轨与手动覆盖、写入失败/重试及晚到响应；Preferences 用隔离文件模拟 put/flush，不证明原生 XML 持久化或实际音轨效果。媒体网格回归从当前 Index 页面抽取真实 Builder 和调用点，通过本机 SDK 的 ArkUI 编译器转换，再执行生成的观察回调；覆盖异步空→23项、刷新、分页、清空和离线更新，并以旧按值传参写法复现不刷新。观察/列表差异仍使用模拟，不证明真机像素或布局。功能回归联合实际页面 HTTP 加载与这套网格回调，验证同步与浏览的23项电影显示状态一致。首页新增SDK观察回调更新测试、分库/NextUp查询及账户时序回归；海报策略测试核对电影/单集/季的图片目标和进度范围，不证明实际海报加载或卡片像素。详情回归加载真实页面/服务/DTO，覆盖元数据缺失、季度/下一集范围、媒体版本播放与下载、从头播放、预告片原生意图、收藏/已看失败重试、下载取消/移除、服务端删除权限和缓存更新、生命周期及账户隔离；SDK观察回调再检查季度/单集发布、刷新和清空，平台能力仍为模拟，未执行真实删除或设备交互。

品牌更换、7 项审计问题、详情页与播放器补齐结果见 [功能完整性报告](docs/audits/2026-10-10/report.html)。

本轮补齐演员标签/关注与完整人物页、收藏全量分页/组合筛选/批量撤销、离线修改与进度队列、下载分类/重试/批量队列、PIN 应用锁及播放控制锁。当前固定功能基准为 `codex/actor-experience@225fba7c`，状态与验收差异见功能清单。

## 代码结构

- `entry/src/main/ets/pages`：连接登录、首页、推荐、演员、更多四个导航入口及更多内媒体库、详情、原生播放器。
- `components`：媒体卡片、首页横向分区、详情元数据/操作组件及画中画文本字幕节点。
- `api/generated`：按固定 Jellyfin OpenAPI 生成的 24 个操作及协议 DTO。
- `api/NativeHttpTransport.ets`：原生 HTTP、鉴权、超时、错误与资源释放。
- `api/DomainMapping.ets`：协议 DTO 到页面/缓存模型的转换和边界校验。
- `model`：页面/缓存媒体、账户、下载和同步快照领域模型。
- `service/JellyfinClient.ets`：业务入口，媒体查询、字幕和上报委托给生成客户端。
- `service/SessionStore.ets`：系统 Asset 安全存储登录会话，密码不持久化。
- `service/LocalStore.ets`：按服务器 ID / 用户 ID 隔离的原子 JSON 快照和下载元数据。
- `service/AppService.ets`：同步、下载、媒体源与下一集选择。
- `service/PlaybackController.ets`：AVPlayer 生命周期、轨道、字幕和串行播放上报。
- `service/PlaybackPreferenceStore.ets`：应用级音轨/字幕语言偏好，成功 flush 后发布设置。
- `utils/PlaybackPreferences.ts`：语言码归一化、匹配及设置结构校验。
- `service/SystemPlayback.ets`：画中画、AVSession、后台长时任务及锁屏控制，页面与 UIAbility 共用生命周期。
- `utils`：协议逻辑、推荐与演员排序、资源文案。

所有网络连接使用系统证书校验。HTTPS 连接建议用于公网；HTTP 允许连接自建局域网服务。未添加跳过 TLS 证书校验的选项。图片与播放 URL 根据 Jellyfin 协议附带访问令牌，不应记录这些 URL。

## 许可证与平台参考

当前仓库许可见 [LICENSE](LICENSE)，第三方材料来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。启动 Logo、导航、搜索/已看与详情操作图标均为映屿原创 SVG，使用统一的青绿配色与圆角线条。目录名保持不变；新的包名使用独立沙箱，安装时不会自动接管此前应用的登录、缓存、下载与语言设置。

平台接口可参考华为官方 [HarmonyOS NEXT 文档](https://developer.huawei.com/consumer/cn/doc/) 和 [文件上传下载指南](https://developer.huawei.com/consumer/en/doc/harmonyos-guides-V13/app-file-upload-download-V13)。当前本机 SDK 元数据为 API26 / 26.0.0.105，工程兼容/目标配置为 API12；旧 API12 工具链及设备运行仍需单独验证。
