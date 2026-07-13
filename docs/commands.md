# Natalia CLI 使用手册

## 目录

1. [快速开始](#1-快速开始)
2. [启动方式](#2-启动方式)
3. [交互式 Slash 命令](#3-交互式-slash-命令)
4. [运行时配置](#4-运行时配置)
5. [对话与会话管理](#5-对话与会话管理)
6. [模型工具详解](#6-模型工具详解)
7. [安全模型](#7-安全模型)
8. [Wire 远程协议](#8-wire-远程协议)
9. [常见工作流](#9-常见工作流)
10. [故障排查](#10-故障排查)

---

## 1 快速开始

### 首次启动

```bash
# 编译
go build -o ./bin/natalia ./cmd/natalia

# 首次运行（自动进入配置向导）
./bin/natalia
```

配置向导会引导你设置：
- 服务商（Provider）：API 地址和 Key
- 模型（Model）：如 `deepseek-v4-flash`、`step-3.7-flash`
- 上下文窗口、温度、最大 Token 等

之后进入交互式 CLI：

```
natalia> 你好
```

### 配置文件位置

```text
~/.config/natalia-cli/config.yaml
```

你可以直接编辑此文件，也可以通过 CLI 内的 `/setup` 命令重新配置。

---

## 2 启动方式

### 交互式 CLI（默认）

```bash
./bin/natalia
```

进入后输入提示词，模型会调用工具并返回结果。

### 单次执行

```bash
./bin/natalia "列出当前目录的文件"
```

执行完单次 prompt 后退出。

### 指定配置 Profile

```bash
./bin/natalia --profile step-ai
```

使用配置文件中预先定义的 profile。

### Wire 协议模式

运行 Wire JSON-RPC 服务器，供外部前端/IDE 接入：

```bash
# 标准输入输出
./bin/natalia --wire

# HTTP + SSE + WebSocket
./bin/natalia --wire-http 127.0.0.1:8787 --wire-auth-token "my-token"

# Unix socket
./bin/natalia --wire-unix /tmp/natalia.sock --wire-auth-token "my-token"

# TLS
./bin/natalia --wire-https 0.0.0.0:8743 --wire-tls-cert cert.pem --wire-tls-key key.pem
```

详见第 8 节。

### Replay 录制的 Wire 会话

```bash
./bin/natalia --wire-replay ~/.config/natalia-cli/sessions/<id>/wire.jsonl
```

---

## 3 交互式 Slash 命令

所有 slash 命令在 `natalia>` 提示符下输入。

### 3.1 帮助和配置

| 命令 | 作用 |
|------|------|
| `/help` | 显示内置帮助 |
| `/setup` | 重新配置服务商/模型/Profile 设置 |
| `/profile` | 交互式切换配置 Profile |
| `/config` | 打印当前配置（敏感信息已脱敏） |
| `/quit` / `/exit` | 退出 CLI |

### 3.2 Runtime 状态

| 命令 | 作用 |
|------|------|
| `/status` | 显示当前 mode、模型、权限、上下文用量、注入诊断 |
| `/mode` | 显示当前 mode 和可选值 |
| `/mode <name>` | 切换 mode（code / ask / plan / debug / chat） |
| `/model` | 列出可用 model_profile |
| `/model <profile>` | 切换模型（支持多词名称，如 `step ai`） |
| `/permission` | 列出权限 Profile |
| `/permission <profile>` | 切换权限策略（just_do_it / ask / read_only） |

### 3.3 自动故障恢复

| 命令 | 作用 |
|------|------|
| `/auto` | 显示自动故障恢复状态 |
| `/auto status` | 同上 |
| `/auto on` | 启用自动恢复（连续失败后自动进入 debug mode） |
| `/auto off` | 禁用自动恢复 |

### 3.4 计划管理

| 命令 | 作用 |
|------|------|
| `/execute-plan <path.md|slug>` | 加载 Markdown 计划文件并切换到 code mode |
| `/plan status` | 显示当前计划进度 |
| `/plan show` | 打印计划内容 + 进度 |
| `/plan done` | 标记当前步骤完成 |
| `/plan confirm` | 确认当前步骤完成并写回计划文件 |
| `/plan clear` | 清除当前计划状态 |

### 3.5 会话管理

| 命令 | 作用 |
|------|------|
| `/sessions` | 列出历史会话列表 |
| `/sessions restore <id|序号>` | 恢复历史会话（例如 `/sessions restore 3`） |
| `/compact` | 手动压缩上下文 |
| `/checkpoint` | 创建快照检查点 |
| `/rollback <step>` | 回退到之前的快照步骤 |

### 3.6 子 Agent 管理

| 命令 | 作用 |
|------|------|
| `/workers` | 列出所有子 agent |
| `/stop` | 取消当前正在运行的 turn |
| `/stop <id>` | 停止指定子 agent |
| `/go <id>` | 恢复已暂停的子 agent |
| `/attach <id>` | 附加子 agent 事件到当前视图 |
| `/detach <id>` | 从当前视图分离子 agent（agent 继续运行） |

### 3.7 沙盒

| 命令 | 作用 |
|------|------|
| `/sandbox` | 列出沙盒 |
| `/sandbox create user <name>` | 创建用户沙盒 |
| `/sandbox create agent <name>` | 创建 Agent 沙盒 |
| `/sandbox diff <name>` | 显示沙盒变更 |
| `/sandbox merge <name>` | 合并沙盒变更到工作区 |
| `/sandbox delete <name>` | 删除沙盒 |

### 3.8 Workflow 管理

| 命令 | 作用 |
|------|------|
| `/workflow list` | 列出已发现的 workflow |
| `/workflow run <name>` | 运行 workflow |
| `/workflow diagnostics` | 显示 workflow 加载诊断 |

---

## 4 运行时配置

### 4.1 Mode（模式）

| Mode | 用途 | 工具范围 |
|------|------|----------|
| `code` | 编程模式（默认） | 全部工具 |
| `ask` | 问答模式 | 只读工具 + ask_user |
| `plan` | 规划模式 | 只允许读文件和写 PLANS/ 目录 |
| `debug` | 调试模式 | 全部工具 + 自动升级目标 |
| `chat` | 聊天模式 | 仅 web_search / ask_user 等 |

切换：`/mode debug`

### 4.2 Model Profile（模型配置）

配置文件中可以定义多个 model_profile，每个包含：
- `model`: 模型名称（如 `step-3.7-flash`）
- `provider`: 使用哪个服务商
- `stream`: 是否流式输出
- `reasoning_effort`: high / medium / low
- `max_tokens`, `temperature` 等

切换：`/model step-3.7-flash` 或 `/model step ai`（多词名称）

### 4.3 Permission Profile（权限策略）

| Profile | 效果 |
|---------|------|
| `just_do_it` | 自动批准所有工具调用（危险命令除外） |
| `ask` | 写工具、进程管理等需要交互确认 |
| `read_only` | 拒绝所有修改性操作 |

切换：`/permission read_only`

### 4.4 自动故障恢复（Auto Flow）

启用后（默认开启），连续失败（如 API 错误、max_steps 耗尽）超过阈值后自动切换到 debug mode，使用更强模型尝试修复。修复成功后自动切回原 mode。

---

## 5 对话与会话管理

### 5.1 历史会话

每次对话（从启动到退出）会自动保存为一个 session。session 保存了：
- 完整消息上下文
- Runtime 状态（mode / model / permission）
- Wire 录制文件

### 5.2 恢复历史会话

```text
/sessions           # 列出所有历史会话
/sessions restore 2  # 恢复第 2 个会话
```

恢复后之前的所有对话历史和状态都会被还原。**不会**重新打开真实终端窗口。

### 5.3 上下文管理

长时间对话后上下文可能过大：
- `/compact`: 手动压缩上下文（调用 LLM 做摘要）
- `/checkpoint`: 在关键步骤前创建快照
- `/rollback 3`: 退回到第 3 步的快照

---

## 6 模型工具详解

以下工具由模型调用，用户不需要手动输入。这里列出每个工具的典型参数和使用场景。

### 6.1 文件工具

#### read_file — 读取文件

```
read_file(path="/path/to/file", limit="all", offset=0)
```

- `limit`: 行数或 `"all"`；`offset`: 起始行号
- 适合看源码、配置、日志

#### write_file — 写入/创建文件

```
write_file(path="src/main.py", content="print('hello')")
```

- 创建新文件或覆盖已有文件
- 触发审批（ask 模式下）

#### edit_file — 精确替换

```
edit_file(path="main.go", old_string="fmt.Println(a)", new_string="fmt.Println(b)")
edit_file(path="main.go", edits=[{old_string: "a", new_string: "b"}], replace_all=true)
```

- `edits`: 批量替换数组
- `replace_all`: 替换所有匹配处
- 触发审批，显示 diff 预览

#### grep — 搜索文件内容

```
grep(pattern="func main", path="./src", include="*.go", context=3, multiline=true, hidden=false, ignored=false, type="go")
```

- 支持正则、多行、上下文行
- `type`: 按语言过滤（go / python / rust / ...）
- `ignored`: 是否搜索被 gitignore 的文件

#### glob — 查找文件

```
glob(pattern="**/*.py", path=".", limit=20, offset=0)
```

- 支持 `**` 递归匹配

### 6.2 Shell 执行

#### run_shell — 执行命令

```
run_shell(command="go test ./...", timeout="120", cwd="/project", max_output="50000")
```

- `timeout`: 秒数，默认 60，最大 600
- `max_output`: 默认 50000 字节
- 危险命令自动拦截（rm -rf /, mkfs, dd 等），需要二次确认
- **大输出自动缓存**：输出超过阈值时自动缓存，返回 `output_cached_id=sh_abc123`，模型可以：
  ```
  run_shell(output_id="sh_abc123", offset=0, limit=200000)
  ```
  用同一个工具分页读取全量输出

#### 危险命令识别列表

| 模式 | 说明 |
|------|------|
| `rm -rf /` | 删除根目录 |
| `rm -rf /*` | 删除根目录内容 |
| `sudo rm -rf /` | 带 sudo 删除 |
| `mkfs` | 格式化磁盘 |
| `dd if=/dev/zero of=/dev/` | 覆写块设备 |
| `:(){ :\|:& };:` | Fork 炸弹 |

以上命令即使 `just_do_it` 模式也需要显式审批。

### 6.3 进程管理

#### process_start — 启动进程

```
process_start(command="python", args=["-m", "http.server", "8080"], cwd="/project", idle_timeout=300, max_lifetime=3600)
```

- `command` 和 `args` 必须分开（例如 `command="sleep"` + `args=["30"]`），不能合在 command 里

#### process_list / process_status — 查看进程

```
process_list()
process_status(id="proc_1")
```

#### process_output — 读取进程输出

```
process_output(id="proc_1", tail=50)
```

- `tail`: 最近 N 行；也支持 offset/limit 分页

#### process_stop / process_restart — 停止/重启

```
process_stop(id="proc_1")
process_restart(id="proc_1")
```

#### process_attach / process_detach — 事件绑定

```
process_attach(id="proc_1")
process_detach(id="proc_1")
```

detach 后进程继续运行，但不再向 UI 转发事件。

#### process_cleanup — 清理

```
process_cleanup(finished_max_age=60, idle_timeout=120, max_lifetime=86400, detect_stale=true)
```

- `detect_stale`: 检查 PID 是否已不存在

#### process_audit — 审计日志

```
process_audit(id="proc_1")
```

显示 start/stop/restart/cleanup 事件，env 中的 secret 已脱敏。

### 6.4 后台任务

与进程管理器类似，但专门用于长期运行的任务（dev server、watcher 等）。

```
background_start(command="npm", args=["run", "dev"], cwd="/project", max_tail=1000, idle_timeout=0, max_lifetime=0)
background_list()
background_output(id="proc_1", offset=0, limit=100)
background_restart(id="proc_1")
background_stop(id="proc_1")
background_cleanup(finished_max_age=60, idle_timeout=300)
background_audit(id="proc_1")
```

### 6.5 交互式 PTY

用于操作 REPL、安装器、脚手架等需要交互 prompt 的 CLI。

#### interactive_start — 启动 PTY

```
interactive_start(command="python3", rows=24, cols=80, wait_for=">>>", idle_timeout_ms=200, max_wait_ms=2000)
```

- 返回 session ID，后续操作基于此 ID
- 启动后自动等待 prompt 出现

#### interactive_write — 写入输入

```
interactive_write(id="tty_1", input="print('hello')")
```

- 默认提交（追加换行），`submit=false` 可分段输入
- `sensitive=true` 时输入不会回显
- 返回 `new_output`（增量输出，默认不返回完整 tail）

#### interactive_read — 观察输出

```
interactive_read(id="tty_1", wait_for=">>>", idle_timeout_ms=500, max_wait_ms=3000)
```

- 等待新输出直到静默超时或匹配 wait_for
- 默认只返回 `new_output`（自上次读取以来的增量）；
  显式传 `tail_bytes` 才返回完整 tail
- 可以不带任何等待参数直接调用，用于快速检查当前状态

#### interactive_keys — 发送特殊键

```
interactive_keys(id="tty_1", key="ctrl-c")
```

支持：`enter`、`ctrl-c`、`ctrl-d`、`tab`、`esc`

#### interactive_stop — 停止 PTY

```
interactive_stop(id="tty_1")
```

#### 更多

```
interactive_list()
interactive_attach(id="tty_1")
interactive_detach(id="tty_1")
interactive_resize(id="tty_1", rows=40, cols=100)
interactive_transcript(id="tty_1", offset=0, limit=100)
```

> **注意**：Python REPL 等场景下，输入会被 readline 逐字符回显到 PTY buffer 中。当前的新版 `cleanTerminal` 已经支持 CSI 擦除、CR 回退和 backspace 模拟，可以正确清洗大多数中间态残留；如果仍然出现，请使用 `tail_bytes` 显式读取完整 buffer 查看原始标记序列。

### 6.6 网络工具

#### web_search — 搜索网络

```
web_search(query="Natalia CLI", limit=5, include_content="true", provider_priority="bing,google,duckduckgo")
```

- 默认按 `bing → google → duckduckgo` 优先级尝试
- 低相关性结果会输出 `low lexical relevance` 警告
- 可通过环境变量 `SEARCH_PROVIDER_PRIORITY` 或配置 `web_search.provider_priority` 设置全局优先级

#### web_fetch — 抓取网页

```
web_fetch(url="https://example.com", format="text", timeout="30", max_bytes="1048576", include_links="true")
```

- `format`: text / markdown / html
- `timeout`: 默认 60 秒，最大 120
- `max_bytes`: 默认 1MB，最大 5MB
- 空结果时返回 URL、Content-Type、状态码和读取字节数

### 6.7 浏览器工具

```
browser_visit(url="https://example.com", wait="5", timeout="30", viewport="1024x768", selector="#main")
browser_screenshot(url="https://example.com", path="/tmp/shot.png", wait="3", timeout="30", viewport="1024x768")
```

### 6.8 子 Agent

```
agent_spawn(task="阅读 src/main.go 并总结结构", mode="code", foreground=true, timeout_sec=30, model_profile="step-3.7-flash", allowed_tools=["read_file", "grep"])
```

- `mode`: code / ask / plan / debug / chat（非法值会提示可用枚举）
- `foreground`: true（等待完成返回摘要）或 false（后台运行）
- `allowed_tools` / `exclude_tools`: 控制子 agent 可使用的工具

其他子 Agent 工具：

```
agent_list()
agent_output(agent_id="w1")
agent_attach(agent_id="w1")
agent_detach(agent_id="w1")
agent_stop(agent_id="w1")
```

### 6.9 计划模式工具

```
plan_mode_enter(plan_path="plans/arch.md")
plan_mode_exit()
plan_mode_status()
```

### 6.10 Workflow 工具

```
workflow_list()
workflow_read(name="review")
workflow_run(name="review", state_path="/tmp/state.json")
```

Workflow 文件位于 `.natalia/workflows/*.yaml`、`.natalia/commands/*.md`；`package.json` 中的 scripts 和 `Makefile` 中的 targets 也会自动导入。

### 6.11 Todo 工具

```
todo_set(items=["完成模块A", "修复bug", "写测试"])
todo_add(items=["重构"])
todo_done(index=2)     # 标记第 2 项完成（1-based）
todo_list()
```

### 6.12 用户交互

```
ask_user(question="你更喜欢哪个方案？", options=["方案A", "方案B"], multiple=false, fallback="方案A")
```

- `options`: 最多 4 个选项
- `multiple`: 允许多选
- `fallback`: 超时或无输入时的默认值

---

## 7 安全模型

### 7.1 三层安全控制

1. **模式（Mode）过滤**：不同 mode 限制可用的工具集（如 ask mode 不允许写文件）
2. **权限 Profile**：`just_do_it`, `ask`, `read_only` 控制是否交互确认
3. **危险命令策略**：即使 `just_do_it` 模式下，内建危险命令也需二次确认

### 7.2 环境变量安全

- shell/process/background/PTY 默认不继承宿主环境中的敏感 env
- 敏感名称：SECRET, TOKEN, PASSWORD, KEY, CREDENTIAL 等
- 可通过配置文件 `security.env_allowlist` 放行需要的变量

### 7.3 文件权限

- 配置文件、session 存储、Wire 录制的文件权限为 `0600`
- 配置/会话目录权限为 `0700`
- 敏感路径自动脱敏：`.env`、`.netrc`、`.ssh/`、`.aws/credentials`、`.kube/config`、`.docker/config.json` 等

### 7.4 网络安全

- 默认拒绝 localhost / 内网 / link-local / 云 metadata 地址
- 可通过 `network_policy.allow_localhost` 和 `allowed_hosts` 放行

---

## 8 Wire 远程协议

Wire 是 Natalia 的 JSON-RPC 协议，支持多传输层。

### 8.1 启动 Wire 服务器

```bash
# HTTP + SSE + WebSocket
./bin/natalia --wire-http 127.0.0.1:8787 --wire-auth-token "my-token"

# Unix socket
./bin/natalia --wire-unix /tmp/natalia.sock --wire-auth-token "my-token"

# 限制方法范围
./bin/natalia --wire-http 127.0.0.1:8787 --wire-auth-token "my-token" --wire-allow-methods initialize,prompt,cancel
```

### 8.2 HTTP 端点

| 端点 | 协议 | 用途 |
|------|------|------|
| `/rpc` | JSON-RPC over HTTP POST | 请求-响应 RPC |
| `/events` | SSE (text/event-stream) | 事件流推送 |
| `/ws` | WebSocket | 双向 Wire 流 |
| `/healthz` | HTTP GET | 健康检查（无认证） |

### 8.3 JSON-RPC 方法

| 方法 | 参数 | 说明 |
|------|------|------|
| `initialize` | `{}` | 握手初始化 |
| `prompt` | `{user_input: "..."}` | 执行用户输入 |
| `steer` | `{user_input: "..."}` | 向运行中的引擎发送引导 |
| `cancel` | `{}` | 取消当前 turn |
| `set_plan_mode` | `{enabled: true/false}` | 启用/禁用计划模式 |
| `set_runtime_profile` | `{mode, model_profile, permission_profile}` | 切换运行时配置 |
| `restore_session` | `{session_id}` | 恢复历史会话 |
| `list_sessions` | `{}` | 列出会话 |

---

## 9 常见工作流

### 9.1 日常编码

```text
# 启动
./bin/natalia

# 恢复上次会话
/sessions
/sessions restore 2

# 或者看当前状态
/status
```

### 9.2 切换模型

```text
/model step-3.7-flash
# 或包含空格的 profile 名称
/model step ai
```

### 9.3 加载计划文件推进

```text
/execute-plan .kilo/plans/natalia-cli-roadmap.md
/plan status     # 看进度
/plan show       # 看完整计划
# 完成后
/plan confirm    # 标记完成并写回 .md
```

### 9.4 测试命令但不放心

```text
/permission ask    # 切换到 ask 模式，每次写操作都审批
run_shell(command="rm -rf /tmp/test_dir")
# 会触发审批确认
```

### 9.5 观察 REPL/交互命令

```text
interactive_start(command="python3", wait_for=">>>")
interactive_write(id="tty_1", input="x = [i*i for i in range(10)]")
interactive_write(id="tty_1", input="print(x)")
interactive_stop(id="tty_1")
```

### 9.6 阅读大文件/搜索结果

```text
# 文件分页
read_file(path="large.log", offset=0, limit=50)
read_file(path="large.log", offset=50, limit=50)

# 搜索
grep(pattern="ERROR", path="/var/log", context=5)

# 大命令输出自动缓存
run_shell(command="cat large_file.txt")
# 超过 50KB 时返回 output_cached_id=sh_xxx，
# 然后用同一工具分页读取
run_shell(output_id="sh_xxx", offset=0, limit=100000)
```

### 9.7 启动 Wire 前端

```bash
export NATALIA_WIRE_TOKEN="$(openssl rand -hex 32)"
./bin/natalia --wire-http 127.0.0.1:8787 --wire-auth-token "$NATALIA_WIRE_TOKEN" --wire-allow-methods initialize,prompt,cancel
```

### 9.8 使用子 Agent 做后台任务

```text
# 后台跑一个耗时的分析任务
agent_spawn(task="对整个项目做安全审计：检查 .env、secret 硬编码、不安全函数调用",
            mode="code", foreground=false, timeout_sec=300)

# 查看进度
/workers
agent_output(agent_id="w1")
```

---

## 10 故障排查

### 模型返回空或不响应

可能原因和解决办法：
1. **上下文过大** → `/compact` 压缩后重试
2. **旧 session 有异常状态** → `/sessions` 查看，尝试新对话
3. **API 返回空** → 查看 stderr 是否有 `API error` 或 `empty assistant response` 提示
4. **死循环 / max_steps** → `/stop` 取消当前 turn

### 审批卡住

如果审批提示后输入没生效：
- 确保在当前终端窗口输入（不是 popup 对话框）
- 按 `y` 或 `Y` 批准，`n` 或 `N` 拒绝，Enter 提交

### Wire 连接被拒绝

- 检查 `--wire-auth-token` 是否与客户端一致
- HTTP: 检查端口是否被占用
- Unix socket: 检查路径是否有 stale socket 残留

### 工具调用不符合预期

- `/status` 查看当前 mode 和 permission profile
- `/model` 确认是否用对了模型
- 检查工具参数：`process_start(command="sleep", args=["30"])` 而不是 `command="sleep 30"`
- `ask_user` 的 `options` 最多 4 个

### 日志和调试

```bash
# 启动时加 --debug
./bin/natalia --debug

# 查看 Wire 录制
ls ~/.config/natalia-cli/sessions/<id>/
# wire.jsonl 是完整的事件日志

# Unix socket 启动时自动清理 dead socket，
# 不会误删普通文件或活跃 socket
```
