# Jellyfin OpenAPI 客户端

主协议固定为官方 TypeScript SDK `v0.11.0` 的 Jellyfin **10.10.0 / OpenAPI 3.0.1** 规范。另固定官方SDK `v0.8.0` 的10.8.9规范，生成10.8.x路由、操作别名及方法兼容分支。来源、SHA-256、选用操作与输出目录见 `client-config.json`；运行时使用打包代码，不下载规范。

在工程根目录执行：

```bash
python3 scripts/generate-jellyfin.py
python3 scripts/generate-jellyfin.py --check
node tests/openapi-regression.test.cjs
node tests/accounts-regression.test.cjs
./scripts/build.sh
```

生成只需Python标准库。构建前执行漂移检查；修改输入后重新生成并运行回归，不手改生成DTO。升级时固定新的官方规范与SHA，核对路由/参数/方法/字段变化，再构建和联调支持的服务版本。

## 分层与覆盖

- `api/generated`：30操作、90模型/枚举/内联定义及25请求类型，共115定义。保留required、optional、nullable；参数名和路由来自规范，数组按form/explode生成重复查询键。
- `api/NativeHttpTransport.ets`：原生HTTP、MediaBrowser头、超时、状态/JSON/HTML校验、资源释放及已配置地址的故障切换。无体POST/DELETE省略extraData。
- `api/DomainMapping.ets`：协议DTO转为页面/缓存模型，校验使用到的媒体身份、分页和元数据，归一化null；官方IsTextSubtitleStream映射到领域IsTextSubtitle。
- `service/JellyfinClient.ets`：稳定的登录、当前用户、媒体、字幕、上报等业务入口；版本查询共用并发请求。公开系统信息与公开用户不发送令牌；恢复账户先匹配服务器ID，切换校验当前用户ID。
- `service/SessionStore.ets`：账户/服务器集合及令牌由分块Asset保存，普通JSON不保存凭据。
- `service/QuickConnectLogin.ets`：代码、授权检查、取消与超时；Secret只在内存，授权后交换令牌并经统一账户入口保存。

当前选用公开系统信息、公开用户、密码认证、Views/Items/详情/Resume/Latest/NextUp/推荐/Seasons/Episodes、收藏/观看、DeleteItem、PlaybackInfo、SRT、图片/视频URL、开始/进度/停止上报，以及Quick Connect启用/初始化/状态/兑换和当前用户。完整清单见生成的manifest。

## 版本兼容

主规范使用Items、UserViews、UserItems/Resume、Items/Latest、UserFavoriteItems、UserPlayedItems等路由。10.8.x按固定旧规范生成8项 `/Users/{userId}/…` 变体，将userId移入路径并去掉重复查询；其余已选媒体/播放路由维持规范方法。GetNextUp的seriesId用于限定详情查询。DeleteItem权限在业务层重新获取并验证，不由生成器推断。

Quick Connect新增GetQuickConnectEnabled、InitiateQuickConnect、GetQuickConnectState、AuthenticateWithQuickConnect和GetCurrentUser。10.8.9将前三项命名为GetEnabled/Initiate/Connect，且初始化为GET；10.10.0为POST。兼容配置显式声明别名和允许的方法变化，生成时逐项检查，不因405在运行时猜测或重复写入。其他版本采用主规范分支，仍需独立联调。

## 连接与认证

已保存服务器的密码登录、Quick Connect及恢复账户可以在公开探测失败时选择备地址。每个候选先无令牌核对公开服务器ID；只有同一身份可进入认证或携带现有令牌。GET有界重试并共享候选探测；未知POST/DELETE不自动重放，离线业务意图另行幂等回传。成功地址尽力持久化。新图片/视频/下载URL使用当前地址，已建立的媒体连接不透明重启。

Quick Connect按 [官方授权流程](https://jellyfin.org/docs/general/server/quick-connect/) 显示代码，由已登录客户端授权；最多每5秒检查一次。使用生成的QuickConnectDto兑换，身份与令牌校验后保存。应用不实现替其他客户端授权的操作。

## 生成器与验收边界

生成器是应用接口的ArkTS子集客户端，支持当前规范的本地引用、数组、字典、标量、枚举和单引用allOf。不支持的组合、格式或成功响应结构会停止生成。新增接口先加入operations，必要时扩展生成器和对应测试。

DTO是静态类型而非完整运行时schema验证；传输层和领域层只校验当前必要边界。int64使用number，不安全整数、非有限值及超int32参数明确拒绝；没有任意精度整数支持。图片/视频由平台组件消费生成URL，URL可能包含api_key，不记录到日志。未引入Axios/第三方JavaScript SDK运行时依赖。

回归使用显式平台与服务器响应夹具；构建和协议检查不证明原生Asset、设备UI、真实登录、视频解码或后台存活。设备/服务验收方法见 [验证说明](../docs/VALIDATION.md)；本地日志、探测和产物仅保存在忽略目录。
