# 映屿验证说明

## 可复现检查

在配置 DevEco Studio SDK 与 Node.js/Python 3 后执行：

```bash
./scripts/build.sh
node tests/run-regression.cjs
```

构建前检查 OpenAPI 与图标生成漂移，并编译 ArkTS、ArkUI 和资源。默认未配置签名，生成 unsigned HAP。全套回归包含协议、业务、播放器、系统播放、字幕、语言偏好、媒体与详情、品牌、SDK 网格及固定基准检查。

回归输出默认写入 `.local/test-results/regression`；可通过 `CINEISLE_TEST_OUTPUT_DIR` 指定本地输出目录。日志、证据 JSON、截图、服务探测、工作区快照和 HAP 不提交。原生 UI 检查需要自行采集截图与布局，使用 `CINEISLE_UI_CAPTURE_DIR` 指定目录，默认 `.local/ui-captures`。

## 验收边界

| 层次 | 能证明的内容 | 需要独立完成的验收 |
|---|---|---|
| Node/Python 回归 | 协议、业务时序、缓存隔离、生成漂移、SVG 与 HAP 资源 | 原生持久化、后台存活、触摸与像素效果 |
| SDK 构建 | 当前 SDK 的 ArkTS、资源与打包检查 | API12 工具链与设备兼容性 |
| 签名与安装 | 指定签名包能在指定设备安装 | 正式发布签名、商店发布 |
| 设备 UI | 已执行场景的布局与交互 | 未执行场景、其他设备 |
| 真实 Jellyfin 与视频 | 已执行的服务操作与解码场景 | 其他版本、编码、转码及播放生命周期 |

源码实现、构建、安装、设备 UI、真实服务和实际视频解码是不同证据。迁移差异见 [功能清单](MIGRATION.md)；发布前按实际功能补充各层验收。仓库中不保留个人设备或服务器的历史验收材料。
