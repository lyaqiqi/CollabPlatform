# Git 协作约定

## 分支策略

- **main**：保护分支，**禁止直接 push**。所有改动必须通过 PR 合并。
- **功能分支**：每人一条，从 main 签出：

| 成员 | 分支名 | 负责模块 |
|------|--------|----------|
| B    | `feature/board`  | 白板实时协作 |
| C    | `feature/doc`    | 文档实时协作 |
| D    | `feature/user`   | 用户认证 & 项目管理页 |
| E    | `feature/collab` | 版本快照 & 评论 |

## PR 流程

1. 在自己的功能分支开发完毕后，推送到远程。
2. 发起 PR，目标分支为 `main`。
3. 至少需要 **1 名其他成员 review 并 approve** 后方可合并。
4. merge 方式统一用 **Squash and merge**，保持 main 历史整洁。
5. 合并后本地同步：`git fetch && git rebase origin/main`。

## Commit Message 格式

```
<type>: <简短描述>
```

| type | 含义 |
|------|------|
| `feat` | 新功能 |
| `fix`  | Bug 修复 |
| `docs` | 文档变更 |
| `refactor` | 代码重构（不影响功能） |
| `style` | 代码格式（不影响逻辑） |
| `test` | 测试相关 |
| `chore` | 构建/依赖/杂项 |

示例：
```
feat: 实现白板笔迹实时同步
fix: 修复断线重连后房间状态丢失的问题
docs: 补充 Socket 事件说明
```

## 日常建议

- 每次开始开发前先 `git pull --rebase origin main`，减少冲突。
- 小步提交，commit 粒度以"一个独立功能点"为单位。
- `.env` 文件不要提交（已在 .gitignore 中排除）。
