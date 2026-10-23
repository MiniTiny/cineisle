# 映屿分支约定

仓库托管于 [GitHub](https://github.com/MiniTiny/cineisle)，`origin` 指向 `https://github.com/MiniTiny/cineisle.git`。仓库采用特性/发布模型，使用以下三种分支类型。

| 分支 | 用途 | 创建与合并 |
|---|---|---|
| `master` | 发布基线，仓库默认分支 | 发布验收后接收 `develop`，按实际版本打标签 |
| `develop` | 日常集成与下一版本开发 | 接收已验收的特性分支 |
| `feature/<名称>` | 单个功能、修复或独立改进 | 从 `develop` 创建，完成后通过 PR 合入 `develop` |

首次迁移时 `master` 与 `develop` 指向同一工程快照；建立发布分支不表示已通过正式签名、真机或真实服务验收。后续日常开发检出 `develop`，功能修改在对应 `feature/*` 上进行。

## 开发特性

保持工作区干净，再从最新集成分支创建特性，例如：

```bash
git fetch origin
git switch develop
git pull --ff-only
git switch -c feature/quick-connect
# 完成功能、测试与必要的迁移清单更新后
git push -u origin feature/quick-connect
```

示例名称仅说明命名方式，不代表 Quick Connect 已实现。分支名称使用简短英文与连字符；每个分支限定一个可验收的变更范围。

在 GitHub 创建从 `feature/<名称>` 到 `develop` 的 PR，说明实际行为、验证证据和未运行的验收。合并前运行 `./scripts/build.sh` 与 `node tests/run-regression.cjs`；根据功能补充设备、真实 Jellyfin 或视频验收。合并后可删除已完成的特性分支。

## 发布

冻结并验收 `develop` 的发布范围，更新版本和验证记录，再创建 `develop` 到 `master` 的发布 PR。合入后，在实际发布提交上打版本标签，例如 `v0.1.0`，并按正式发布要求构建、签名与验收。

修复同样从 `develop` 创建 `feature/fix-<名称>`，验收并集成后进入发布流程。不要直接在 `master` 开发，也不要以分支名称或构建成功代替发布验收。

仓库默认分支应设置为 `master`；本地日常工作分支为 `develop`。本约定不创建示例特性分支或版本标签，实际开发及发布时再创建。
