---
name: help
description: Natalia CLI usage, commands, and troubleshooting
---

# Natalia CLI Help

回答关于 Natalia CLI 用法、命令、模式、Wire 协议和常见故障的问题。回答时以当前实现为准，不再使用旧的 `/rule` 术语。

## 启动方式
- `natalia` - 进入交互式 REPL。
- `natalia "你的任务"` - 单次运行一个 prompt。
- `natalia -profile <name>` - 使用指定 profile 启动。
- `natalia -no-setup` - 跳过首次交互式配置引导。
- `natalia -debug` - 打印调试日志。
- `natalia -wire` - 通过 stdin/stdout 启动 Wire JSON-RPC runtime。
- `natalia -wire-replay <wire.jsonl>` - 将已记录的 Wire JSONL 重放为 JSON-RPC 输出。

## REPL 命令
- `/setup` - 配置 LLM provider、model、profile 等。
- `/profile` - 选择并切换默认 profile；会清除当前 runtime override。
- `/mode <name>` - 切换运行模式，例如 `code`、`ask`、`plan`、`debug`、`chat` 或用户自定义 mode。
- `/model <profile>` - 临时切换当前会话的 model profile，不改变 mode。
- `/permission <just_do_it|ask|read_only>` - 临时切换当前会话权限策略。
- `/status` - 查看当前 mode、model profile、permission profile、实际 provider/model 与 manual override。
- `/checkpoint` - 手动创建文件快照。
- `/rollback <n>` - 回退到第 n 步的快照和上下文检查点。
- `/compact` - 手动压缩当前上下文。
- `/sandbox` - 查看沙盒命令帮助。
- `/sandbox create|merge|diff|delete ...` - 管理沙盒工作区。
- `/workers` - 查看子 agent。
- `/stop <id>` - 暂停子 agent。
- `/go <id>` - 恢复子 agent。
- `/sessions` - 查看历史会话。
- `/config` - 查看当前配置。
- `/help` - 显示内置帮助。
- `/quit` - 退出 REPL。

## Modes
- `code` - 执行者模式，用于按计划修改代码、运行测试、修复局部问题。
- `plan` - 规划模式，默认偏只读，用于设计方案、拆任务和制定验证策略。
- `debug` - 疑难诊断模式，用于排查复杂失败、连续测试失败或回归。
- `ask` - 只读问答模式，适合解释代码和回答问题。
- `chat` - 轻量聊天模式，适合低风险对话。

## 配置概念
- `profile` 是用户配置入口，包含默认模型、权限、mode 映射等。
- `mode` 是运行策略 preset，控制模型路由、权限策略、工具过滤和 prompt 策略。
- `model_profile` 是纯模型配置，包含 provider、model、temperature、max_tokens、reasoning_effort、thinking_enabled、stream、timeout 等。
- `permission_profile` 复用 `just_do_it`、`ask`、`read_only` 三种权限语义。
- 切换 `/mode` 默认回到该 mode 声明的模型和权限；`/model`、`/permission` 是当前会话临时覆盖。

## Wire 协议
- `-wire` 模式使用 JSON-RPC 2.0 over stdio。
- 已支持 `initialize`、`prompt`、`steer`、`cancel`、`set_plan_mode`。
- Runtime 会输出 `TurnBegin`、`StepBegin`、`ContentPart`、`ToolCall`、`ToolResult`、`CompactionBegin`、`CompactionEnd`、`StatusUpdate`、`TurnEnd` 等事件。
- 审批通过 `ApprovalRequest`/`ApprovalResponse` 连通，外部客户端需要按 request id 回复。
- Wire 会话可记录到 `wire.jsonl`，再用 `-wire-replay` 重放。

## 排障
- 看到“LLM 未配置”或“请先运行 /setup”时，先执行 `/setup`。
- 要确认当前实际使用的模型、权限和 mode，执行 `/status`。
- 工具被拒绝时检查当前 `/permission` 是否为 `read_only`，或 mode 是否过滤了该工具。
- 上下文过长时可执行 `/compact`，自动压缩也会在接近上下文预算时触发。
- 工具重复调用或输出异常时，先修复回归再继续推进新功能。
- 不要在日志、文档或 smoke test 输出中打印 API key；只显示 provider/model 或脱敏信息。
