# 映屿 · CineIsle

映屿（CineIsle）是一款面向 HarmonyOS NEXT 的私人影视库客户端，通过 Jellyfin 连接您的电影与剧集。使用 ArkTS 与 ArkUI Stage 模型开发，最低支持 HarmonyOS 5.0 / API 12，应用包名为 `com.cineisle.app`。

「映屿」意为一座属于自己的影像岛屿，英文名 CineIsle 由 cinema 与 isle 组合而成。

## 功能特性

- **多端入口**：首页固定提供收藏与离线下载入口，底部四个导航入口分别为首页、推荐、演员、更多
- **媒体库浏览**：在「更多」中进入媒体库，首页展示继续观看、下一集及各媒体库最近添加的内容
- **搜索功能**：通过工具栏图标展开搜索
- **详情页**：显示原名、年份、分级/评分、类型、导演/编剧和演员等信息；电影还显示文件大小与音视频规格
- **播放控制**：支持播放选项（媒体源、音轨、字幕选择）、画中画、后台音频播放、锁屏控制
- **离线下载**：支持本地下载与管理
- **语言偏好**：可自定义音轨与字幕语言偏好设置
- **应用锁**：支持 PIN 锁与播放控制锁

## 环境要求

- HarmonyOS NEXT / API 12 及以上
- DevEco Studio（本地 API 12 或兼容 SDK）
- Jellyfin 服务器（10.8.9 或 10.10.0 版本）

## 快速开始

1. 克隆仓库并切换到 `develop` 分支：
   ```bash
   git clone https://gitee.com/angeladoudou/cineisle.git
   cd cineisle
   git checkout develop
   ```

2. 在 DevEco Studio 中打开项目目录，配置 Signing Configs（选择您的华为开发者账户）

3. 选择 `entry` → `default` → `debug` 运行到目标设备

4. 首次启动输入 Jellyfin 服务器地址、用户名和密码即可使用

## 命令行构建

```bash
./scripts/build.sh
```

构建前会执行 OpenAPI 与原创图标生成漂移检查，并准备固定版本的ASS原生渲染依赖（Python 3.12+、主机gperf，首次需联网下载源码）。来源、缓存与离线检查见[ASS字幕说明](docs/ASS_SUBTITLES.md)。生成文件位于 `entry/build/default/outputs/default/entry-default-unsigned.hap`。

## 项目结构

```
entry/src/main/ets/
├── api/                # API 层：HTTP 传输、协议映射、生成的客户端
├── components/         # 可复用组件：媒体卡片、分区、元数据、画中画字幕
├── entryability/       # 应用入口
├── model/              # 领域模型
├── pages/              # 页面：登录、首页、推荐、演员、更多、详情、播放器等
├── service/            # 业务服务：JellyfinClient、SessionStore、LocalStore、下载、播放控制等
└── utils/              # 工具函数：协议、缓存、播放、语言偏好等
```

## 测试

运行全套回归测试：

```bash
node tests/run-regression.cjs
```

单独运行各类测试：

```bash
# 品牌与图标测试
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/branding.test.cjs
# OpenAPI 回归测试
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/openapi-regression.test.cjs
# 协议测试
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node tests/protocol.test.cjs
# 原创图标检查
python3 tests/original-icons.test.py
# 构建产物品牌核验
python3 tests/brand-package.test.py
```

## 许可证

本项目基于特定许可证开源，详情请参阅 [LICENSE](LICENSE) 文件。

第三方材料来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 品牌规范

映屿新 Logo 为原创的岛屿、银幕光束与暖色光点，详情见 [品牌规范](docs/BRAND.md)。

## 了解更多

- [分支约定](docs/BRANCHING.md)：开发流程与发布规范
- [功能清单](docs/MIGRATION.md)：功能进展与基准对照
- [验证说明](docs/VALIDATION.md)：验收方法与边界
- [OpenAPI 说明](openapi/README.md)：Jellyfin 客户端版本与升级流程

## 平台参考

- [HarmonyOS NEXT 官方文档](https://developer.huawei.com/consumer/cn/doc/)
- [文件上传下载指南](https://developer.huawei.com/consumer/en/doc/harmonyos-guides-V13/app-file-upload-download-V13)