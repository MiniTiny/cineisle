# 映屿验证说明

## 可复现检查

在配置 DevEco Studio SDK 与 Node.js/Python 3 后执行：

```bash
./scripts/build.sh
node tests/run-regression.cjs
```

构建前检查 OpenAPI 与图标生成漂移，并编译 ArkTS、ArkUI 和资源。默认未配置签名，生成 unsigned HAP。全套回归包含协议、业务、播放器、系统播放、字幕、语言偏好、媒体与详情、品牌、SDK 网格及固定基准检查。

回归输出默认写入 `.local/test-results/regression`；可通过 `CINEISLE_TEST_OUTPUT_DIR` 指定本地输出目录。日志、证据 JSON、截图、服务探测、工作区快照和 HAP 不提交。原生 UI 检查需要自行采集截图与布局，使用 `CINEISLE_UI_CAPTURE_DIR` 指定目录，默认 `.local/ui-captures`。

## 账户与服务器专项检查

```bash
node tests/accounts-regression.test.cjs
node tests/openapi-regression.test.cjs
```

专项使用真实服务、存储、传输适配层和页面方法，网络/Asset为显式夹具。覆盖旧会话迁移、多服务器/多账户、Asset分块与UTF-8边界、最后索引提交失败/回滚、损坏账户、并发更新、退出/移除/重置、账户缓存隔离与PIN门禁；地址匿名探测、服务器身份、完整候选重试、有界并发及未知写入不重放；Quick Connect禁用、检查节流、授权交换、过期、取消和晚到结果。全部操作按固定规范验证，10.8的初始化GET及旧别名单独回归。

设备或测试服务器验收应分别检查：旧账户升级迁移；至少两服务器与同服务器两账户冷启动/切换；主地址断开及备地址身份错误；错误密码、失效令牌与不可达缓存；已登录客户端输入Quick Connect代码并完成授权；取消/过期/服务端禁用；退出与移除后本机文件保留；播放、下载和同步活跃时的管理限制。没有设备或授权测试服务器时明确标为未执行，不用模拟代码兑换冒充真实登录。

原生隔离验收可启动 `tests/accounts-fixture-server.cjs`，仅监听本机并使用合成账户；通过设备端口转发连接测试包。夹具提供两个独立服务器、同服务器两账户、代理前缀、503主地址、错误身份备地址，以及Quick Connect禁用/等待/失效/授权状态。控制端点仅用于本机夹具，不能当作真实Jellyfin授权。

采集原生截图、布局及脱敏请求轨迹后执行：

```bash
CINEISLE_UI_CAPTURE_DIR=.local/ui-captures python3 tests/accounts-emulator.test.py
```

原生证据回归验证账户媒体隔离、冷启动恢复、顶部布局、地址故障恢复和代码登录。测试包仅更换包名，应用源码与资源须逐文件核对；不读取或导出主应用凭据。正式包使用对应设备的调试签名覆盖安装，保留主应用数据。旧单会话升级、多块上限、长时存活和真实服务器授权仍需独立验收。

本地详细报告和构建结果放在被忽略的 `.local/audits`，可用 `CINEISLE_TEST_OUTPUT_DIR` 将本次全套回归归档到同一目录；不将个人服务器、地址、账户、设备或签名材料写入本文件。

## 图标和布局回归

`node tests/button-layout.test.cjs` 使用本机ArkUI编译器生成真实菜单、详情按钮及倍速选择的构建树，检查图文共享点击区域、辅助功能、居中、字重、换行和滚动锚点；旧孤立图标结构作为负对照。全套回归包含该专项。

设备检查需保存带`index`、`parent`的脱敏布局和原始PNG截图，然后执行（需要Pillow）：

```bash
CINEISLE_UI_CAPTURE_DIR=.local/ui-captures python3 tests/alignment-emulator.test.py
```

验收包含更多页按钮边界与图标点击、四项底部导航、详情按钮/两行文字像素居中、七档倍速的完整显示及选择、短表单/简介顶部位置，以及其他已采集页面的控件边界。应逐页覆盖首页、推荐、媒体库、演员、更多、账户、设置、收藏、下载、电影/剧集/季/单集/人物详情和播放器选项。

仅使用有效截图证明对应屏幕及字号；换设备、放大字体或横屏时需重新检查。非视频夹具可验证播放器控件布局与选择状态，但播放失败截图不能证明解码和实际倍速效果。各阶段截图应区分修复前和最终包；同源码检查与安装证据分别归档。

## 屏幕、字号和横屏回归

`node tests/responsive-layout.test.cjs` 校验窄屏/宽屏及两倍字号的网格、按钮、海报、筛选和视频区域，包含原有固定尺寸的负对照。窗口生命周期回归验证冷启动字号、旋转方向及配置变化的广播；这些专项已加入全套回归。

字号跟随采用应用配置资源，配置形式可参考 [官方示例](https://github.com/AppGalleryConnect/agc-template-market-harmonyos-demos/blob/main/FoodAndDrinkTemplate/Recipes/components/app_setting/README.md)。数值文本行距在本机SDK中使用 `fp`，由平台缩放；布局高度与宽度使用 `vp`，不能对行距再次乘字号比例。

可准备一个独立包进行原生窗口矩阵验收：

```bash
python3 scripts/prepare-responsive-qa.py /tmp/cineisle-responsive-qa
```

脚本仅改变测试包名并加入诊断Ability/背景页，产品页面和资源逐文件比对并生成 `responsive-source-match.json`。诊断Ability的 `width`、`height` 参数为vp，`font`为百分比，`landscape`控制真实窗口方向。字体设置API仅在API13以上测试设备使用，正式Ability仍通过API12配置回调读取字号。诊断窗口不包含系统安全区，因此另行检查正式包状态栏与底部手势区。诊断目标只能使用合成夹具；PIN和代码均为测试数据，不能替换为真实凭据。

验收至少覆盖320×640vp、较大竖屏和短横屏，分别检查正常/两倍字号；确认实际窗口尺寸、字号与旋转，而非仅凭请求参数。保留首页与滚动后的媒体、导航、电影/剧集/季/单集详情、播放器选项、账户与地址表单、设置、收藏、下载、人物、登录及PIN门禁截图。滚动内容在屏幕边缘部分可见属于正常滚动状态；按钮的文字和图标必须位于同一完整点击区，底部操作必须能滚动访问。

将脱敏布局、PNG、各模式的 `*-viewport.json` 和 `matrix.json` 置于指定采集目录，再执行：

```bash
CINEISLE_UI_CAPTURE_DIR=.local/ui-captures python3 tests/responsive-emulator.test.py
```

矩阵回归检查实际几何、像素、导航居中、标题和按钮边界、详情元数据行距、短横屏内容区域、滚动后表单操作及倍速选择。原生可调整视口能证明相应窗口尺寸下的布局；本轮矩阵检查至200%字号，200%以上字号、其他硬件密度、折叠屏、安全区和系统键盘行为仍需独立验收。夹具播放器不能证明实际视频解码。

## 验收边界

| 层次 | 能证明的内容 | 需要独立完成的验收 |
|---|---|---|
| Node/Python 回归 | 协议、业务时序、缓存隔离、生成漂移、SVG 与 HAP 资源 | 原生持久化、后台存活、触摸与像素效果 |
| SDK 构建 | 当前 SDK 的 ArkTS、资源与打包检查 | API12 工具链与设备兼容性 |
| 签名与安装 | 指定签名包能在指定设备安装 | 正式发布签名、商店发布 |
| 设备 UI | 已执行场景的布局与交互 | 未执行场景、其他设备 |
| 真实 Jellyfin 与视频 | 已执行的服务操作与解码场景 | 其他版本、编码、转码及播放生命周期 |

源码实现、构建、安装、设备 UI、真实服务和实际视频解码是不同证据。迁移差异见 [功能清单](MIGRATION.md)；发布前按实际功能补充各层验收。仓库中不保留个人设备或服务器的历史验收材料。
