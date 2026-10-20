# ASS/SSA 字幕

在线ASS/SSA轨通过生成的Jellyfin接口请求ASS文档，保留样式与动画；下载可将相同文档缓存到所选媒体源所属的账户私有目录。其他文本轨仍转换为SRT。旧下载中缺少`format`的字幕仍视为SRT，可通过联网补缓存升级，失败保留可用旧字幕。

## 原生来源与构建

固定来源及SHA-256见[native-ass-sources.json](native-ass-sources.json)。运行库为libass、HarfBuzz、FreeType、FriBidi、Fontconfig和Expat；Meson与pkgconf仅用于构建。未修改这些上游源码，也未打包系统字体。上游许可证及组件声明保留在`entry/src/main/resources/rawfile/third_party/ass`并随HAP分发；完整源码归档由固定清单重新获取，静态链接所需源码和构建步骤均保留。

```bash
# 配置DevEco SDK、Python 3.12+及主机gperf后执行
python3 scripts/prepare-native-ass.py
python3 scripts/prepare-native-ass.py --check
./scripts/build.sh
```

准备器支持macOS/Linux主机，输出OHOS ARM64/API12静态依赖。首次下载公开归档，验证摘要后安全解包；后续复用经过源文件与安装指纹验证的缓存。`--check`只检查当前缓存，不下载。SDK可通过`OHOS_NDK_HOME`指定native目录，或通过`DEVECO_SDK_HOME`、`DEVECO_CONTENTS`选择。构建键包含来源清单、脚本、SDK及编译器信息，安装完成后原子激活；CMake跟踪当前激活指针，避免静默链接旧依赖。

归档、解包目录、构建日志及安装缓存均放在忽略的`.local/native-ass`，SDK生成的`.cxx`也不提交。HAP仅打包ARM64原生桥接库及声明文件，不包含源码缓存。库升级时更新固定清单与对应声明，并重新执行完整来源、字体、异步、业务和实际渲染验收；固定版本及已核对修复不构成全面安全认证。

## 渲染与字体

`PlaybackController`注入独立字幕会话工厂；`AssSubtitle`负责异步NAPI与PixelMap，`Player`及PiP各自消费图层。定时器按实际AVPlayer时间驱动动画，原生工作串行且只保留最新待处理时间。画面关闭、切源、拖动、结束、PIN及隐藏音频模式使旧帧失效；字幕准备失败保留原选择。图层按视频的完整显示或裁切几何缩放并剪裁，不覆盖ASS内的颜色、字号和定位。

字体来自公开`UIFontConfig`与`getFontByName`，生成仅供本应用使用的Fontconfig配置和缓存，不改系统字幕配置。回退保留平台字体顺序，避免某个数学字体的少量阿拉伯字符错误胜出。可用字形、精确字宽与附件字体仍可能与Android不同。已发布的PixelMap由页面/PiP引用与GC管理，仅对尚未发布且已经过期的新位图主动释放。

## 当前边界

- 单文档最多约一百万字符，文件/原生输入上限4MiB；渲染画布最多全高清面积和受限尺寸。超限或非法文档明确失败。
- 支持libass文档样式、动画、双向文字及文档内嵌字体处理；尚未提取视频容器中的附件字体。
- 图片字幕、手动字幕导入、额外播放引擎/编解码器和服务器视频转码回退未由本项实现。
- 编译、协议夹具、原生核心探针、隔离HAP、实际Player/PiP、真实Jellyfin及物理API12设备是不同证据。短时资源观察不证明长期GPU/内存行为。

专项检查与设备验收见[验证说明](VALIDATION.md#assssa-专项)。
