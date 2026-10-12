# 第三方材料与来源

更新日期：2026-10-10。本文件记录映屿 · CineIsle 当前保留的许可证与第三方协议材料。

## 项目许可证

本仓库当前许可证为 `GPL-3.0-only`，完整文本见 [LICENSE](LICENSE)。本次图标更新不修改该许可。

## 映屿原创视觉资源

启动 Logo、14个导航/搜索/已看图标和7个详情操作图标均为映屿重新绘制的 SVG。导航与详情的几何定义在 `scripts/generate-icons.py`，输出位于 `entry/src/main/resources/base/media`；使用统一圆角线条、青绿选中态、暖金收藏与珊瑚色删除提示，没有引用外部图标库、字体或图片。品牌规范见 [docs/BRAND.md](docs/BRAND.md)。

## Jellyfin OpenAPI

固定的官方 Jellyfin OpenAPI 规范、版本和获取地址见 [openapi/README.md](openapi/README.md) 与 `openapi/client-config.json`。生成客户端与 DTO 的文件头保留生成来源说明。网络协议名 Jellyfin 保留，用于说明用户连接的服务。
