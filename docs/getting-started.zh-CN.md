# Natalia CLI：安装与使用

从一台干净的机器到可用的 agent（含 skill）的完整路径。

本文自成一体，覆盖 Linux、macOS 与 Windows。

命令同时给出 PowerShell 与 bash 两种写法，按你的 shell 选用。

---

## 1. 安装前置组件

| 组件                                                | 必需           | 用途                                                                                                         |
| --------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| [Bun](https://bun.com/docs/installation) 1.3.x      | 是             | 整个运行时使用 `Bun.*` API，Node 不能替代。                                                                  |
| [Git for Windows](https://git-scm.com/download/win) | 仅 Windows     | shell 工具、workflow、skill 脚本和 sandbox 都通过兼容 bash 的 shell 执行。缺少它这些工具会以明确的错误失败。 |
| 三个 `wezterm*` 二进制（必须是 Natalia fork 构建）  | 交互式终端需要 | `interactive_terminal_*` 没有备选方案，且普通 WezTerm 不可用。                                               |
| provider 凭据                                       | 真实对话需要   | 任意 OpenAI 兼容、Anthropic 或 Gemini 的 key。                                                               |
| Chrome、Chromium 或 Edge                            | 可选           | 仅 `browser_screenshot` 使用。Windows 上三者都会被自动发现，且 Edge 随系统预装。                             |

安装 Bun：

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

```bash
curl -fsSL https://bun.sh/install | bash
```

### Windows：让 Git Bash 能被找到

Natalia 会在 `%ProgramFiles%`、`%ProgramW6432%`、`%ProgramFiles(x86)%` 和
`%LOCALAPPDATA%\Programs` 下查找 Git Bash。如果你装在别处，永久指定一次：

```powershell
setx NATALIA_BASH_EXECUTABLE "D:\path\to\Git\bin\bash.exe"
```

然后**新开一个终端**让变量生效。

## 2. 获取代码并安装依赖

```powershell
git clone <仓库地址> natalia-cli
cd natalia-cli
bun install
```

`bun install` 是必须的：工作区包不装也能解析，但第三方依赖
（`@opentui/*`、`solid-js`、`zod`）不会存在。

> **如果 `bun install` 之后根 `node_modules` 里没有 `@natalia/*` 链接**（bun ≥ 1.3
> 在 Windows 上默认使用 isolated 布局，包会全部落在 `node_modules/.bun`，导致
> `tsc` 报 `Cannot find module '@natalia/client'`），在仓库根目录改用
> `bun install --linker=hoisted` 重建标准的提升式布局。
>
> 报 `IntxLNK` 解析错误（账户无法创建符号链接，需要管理员或开发者模式）属于
> bun 1.2 及更早版本的行为；旧版建议的 `--backend copyfile` 与在 `apps\tui`
> 目录内安装只解决局部解析，不再适用于 bun ≥ 1.3。

交互式终端还需要 WezTerm 的二进制文件，**必须是 Natalia fork 的构建**——系统
安装的普通 WezTerm 不可用：运行时不会去 `PATH` 里找它，而且只有打过补丁的
GUI 才能参与输入所有权仲裁。构建 fork，或从已有二进制的机器上拷贝：

```powershell
# 在 Linux 上交叉编译出 Windows 版
npm run native-terminal:build-wezterm:windows-cross
# 在 Windows 上用 MSVC 构建
npm run native-terminal:build-wezterm:windows
```

产物在 `packages/native-terminal/wezterm/target/release/`。

**从 Windows release 包安装** —— 预编译三件套已放在压缩包内的预期路径，解压即用，无需移动：

```text
packages/native-terminal/wezterm/target/release/
├── wezterm.exe            ← CLI 客户端
├── wezterm-gui.exe        ← 可见窗口
└── wezterm-mux-server.exe ← 后台 multiplexer daemon
```

运行时按**仓库根下的固定相对路径**查找（基于模块位置解析，与当前目录无关），
且三个二进制必须**在同一目录** —— mux server 和 GUI 都相对 `wezterm.exe`
定位。如果你把二进制放到别处，三个要放在一起，并设置
`NATALIA_WEZTERM_EXECUTABLE` 指向 `wezterm.exe` 的完整路径。无论指向哪里，
都必须是 **Natalia fork 的构建**，不能是普通 WezTerm。

解压后验证一次：

```powershell
packages\native-terminal\wezterm\target\release\wezterm.exe --version
packages\native-terminal\wezterm\target\release\wezterm-gui.exe start
```

## 3. 配置 provider

用环境变量最简单，也能避免凭据落到文件里：

```powershell
$env:NATALIA_API_KEY  = "..."
$env:NATALIA_MODEL    = "gpt-4o-mini"
$env:NATALIA_PROVIDER = "openai-compatible"
$env:NATALIA_BASE_URL = "https://api.example.com/v1"   # 可选
```

```bash
export NATALIA_API_KEY="..."
export NATALIA_MODEL="gpt-4o-mini"
export NATALIA_PROVIDER="openai-compatible"
export NATALIA_BASE_URL="https://api.example.com/v1"   # 可选
```

也可以把凭据写在 `.natalia/config.json` 的 `providers` 下，或在 TUI 的设置中心
（`ctrl+p`）里配置。**文件优先于环境变量。**

TUI 里保存的设置在 runtime 初始化时读取。如果你是从「完全没有 provider」的状态
配置的，配置完请重启 TUI，让它带着这个 provider 开始会话。

切勿提交 API key，也切勿把它粘贴到提示词、截图或会话文件里。

## 4. 启动 TUI

TUI **必须从 `apps/tui` 目录启动**：

```powershell
cd apps\tui
bun run src/main.tsx --workspace C:\path\to\your\project
```

```bash
cd apps/tui
bun run src/main.tsx --workspace /path/to/your/project
```

从仓库根目录启动会报 `Cannot find module 'react/jsx-dev-runtime'`，因为 Bun 用
当前目录的 `tsconfig.json` 解析 JSX 运行时，而只有 `apps/tui/tsconfig.json` 把
`jsxImportSource` 设成了 `@opentui/solid`。

由于启动目录固定，`--workspace` 决定 agent 在哪个项目上工作。不指定的话工作区
就是 Natalia 仓库本身。

| 参数                 | 作用                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| `--workspace <目录>` | agent 读取、写入和做检查点的目录                                                 |
| `--session <id>`     | 恢复指定会话而不是新建                                                           |
| `--doctor`           | 启动 TUI 并立即执行 `/doctor`，报告已解析的 provider、工作区、工具数量和就绪状态 |
| `--diagnostics`      | 同上，但执行 `/diagnostics` 获取详细运行时信息                                   |

`NATALIA_WORKSPACE` 与 `--workspace` 等效。

### 健康检查

```powershell
bun run src/main.tsx --doctor --workspace C:\path\to\your\project
```

它会启动 TUI 并自动执行 `/doctor`，**执行完不会退出**，看完报告用 `ctrl+d` 退出。

正常的报告会显示你的 provider、工作区路径、`native tools: 66`（数量随工具
目录增长）、发现的 skill 数量，以及 `ready`。如果显示 `provider: not
configured`，说明第 3 步没生效。

## 5. 操作 TUI

输入需求按回车。常用按键：

| 按键                | 作用                         |
| ------------------- | ---------------------------- |
| `enter`             | 提交                         |
| `ctrl+j`            | 换行（不提交）               |
| `ctrl+c`            | 取消当前回合                 |
| `ctrl+d`            | 退出（输入框为空时）         |
| `ctrl+p`            | 命令面板                     |
| `ctrl+b`            | 侧边栏                       |
| `ctrl+n` / `ctrl+l` | 新会话 / 会话列表            |
| `ctrl+i` / `ctrl+h` | 状态 / 帮助                  |
| `up` / `down`       | 在 `/` 和 `@` 补全列表中移动 |
| `escape`            | 关闭补全                     |

输入 `/` 唤出命令，输入 `@` 引用工作区文件、agent 或 MCP 资源。

常用命令：

| 命令                                            | 用途                       |
| ----------------------------------------------- | -------------------------- |
| `/help`、`/doctor`、`/status`                   | 帮助、健康检查、运行时快照 |
| `/sessions`、`/models`、`/model <名字>`         | 会话与模型选择             |
| `/files <关键词>`、`/search <文本>`             | 查找文件、搜索内容         |
| `/skills`、`/skill <名字>`                      | 列出与激活 skill           |
| `/checkpoint`、`/checkpoints`、`/rollback <id>` | 工作区检查点               |
| `/agents`、`/agent <名字>`                      | agent 选择                 |
| `/editor`                                       | 用外部编辑器编辑草稿       |
| `/pause`、`/resume`                             | 在安全边界暂停与恢复       |

`/editor` 需要 `EDITOR` 或 `VISUAL`。Windows 上两者通常都没设置，需要指定一个
会阻塞等待关闭的编辑器：

```powershell
setx EDITOR "code --wait"
```

## 6. 安装 Skill

Skill 就是一个包含 `SKILL.md` 的目录。Natalia 在启动时发现它们、把清单告知模型，
再按需加载。

先选作用范围：

| 范围    | 位置                                                                                        | 适用场景                           |
| ------- | ------------------------------------------------------------------------------------------- | ---------------------------------- |
| user    | `%APPDATA%\natalia-cli\skills\`（Windows）、`~/.config/natalia-cli/skills/`（Linux、macOS） | 通用 skill，希望在所有项目里都能用 |
| project | `<工作区>/.natalia/skills/`                                                                 | skill 只属于某一个仓库             |

对于把 skill 放在 `skills/` 目录下的仓库：

```powershell
git clone --depth 1 <skill仓库地址> "$env:TEMP\pull"
$dst = "$env:APPDATA\natalia-cli\skills"
New-Item -ItemType Directory -Path $dst -Force
Get-ChildItem "$env:TEMP\pull\skills" -Directory |
  ForEach-Object { Copy-Item $_.FullName -Destination $dst -Recurse -Force }
Remove-Item "$env:TEMP\pull" -Recurse -Force
```

```bash
git clone --depth 1 <skill仓库地址> /tmp/pull
mkdir -p ~/.config/natalia-cli/skills
cp -r /tmp/pull/skills/* ~/.config/natalia-cli/skills/
rm -rf /tmp/pull
```

要按项目安装就把目标改成 `<工作区>/.natalia/skills`。同名 skill 同时存在时，
**项目级覆盖用户级**。

删除某个 skill 直接删掉它的目录。

Skill 也可以从 `.natalia/config.json` 的 `skills.urls` 声明的 URL 拉取。该 URL
需要提供一个 `index.json`，其中的 `skills` 数组列出可用 skill，每一项会被下载
到用户级 skill 目录。

### 验证

重启 TUI，然后：

```text
/skills
```

会列出每个已安装 skill 的名字和描述。`--doctor` 也会报告数量。

如果某个 skill 没出现，常见原因是：缺少 `SKILL.md`、`name` 不是小写字母数字和
连字符、frontmatter 用了缩进块式 YAML，或者文件带 UTF-8 BOM。注意
**一个损坏的 `SKILL.md` 会让所有 skill 都不可用**，而且报错不会指出是哪个目录；
把最后添加的那个目录移走即可确认。

### 使用

已安装的 skill 每个回合都会描述给模型，所以直接说需求就行：

```text
帮我规划这个项目的导出功能。
```

想自己指定：

```text
/skill planning-layer-runtime
```

`/skill` 不消耗模型回合就能加载，在你已经确定用哪个时更省事。

## 7. 交互式终端

让 agent 打开交互式终端，它会启动一个由 mux 服务器驱动的 WezTerm 窗口。多个
会话可以同时存在，比如一个跑编辑器、一个跑 REPL。终端 pane 里运行什么程序由
你决定，agent 也可以按需启动其他交互式程序。

如果第一次报 WezTerm 超时，重试一次即可：Windows 上首次启动 mux 服务器有冷启动
开销。

## 8. 转义机制

| 变量                         | 用途                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `NATALIA_BASH_EXECUTABLE`    | Git for Windows 装在搜索路径之外时，`bash.exe` 的绝对路径                                       |
| `NATALIA_WEZTERM_EXECUTABLE` | 二进制不在 fork 构建目录时，`wezterm.exe` 的绝对路径；其同级文件必须在同一目录                  |
| `NATALIA_CHROME_BIN`         | `browser_screenshot` 使用的浏览器。若自动发现选中了损坏的安装，用它指定；Windows 上 Edge 很可靠 |
| `EDITOR`、`VISUAL`           | `/editor` 使用的外部编辑器                                                                      |
| `NATALIA_WORKSPACE`          | 等同 `--workspace`                                                                              |

## 9. 数据存放位置

| 内容                          | 位置                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| 项目配置、会话、检查点、skill | `<工作区>/.natalia/`                                                   |
| 全局配置                      | `%APPDATA%\natalia-cli\`（Windows）、`~/.config/natalia-cli/`（POSIX） |
| 终端运行时文件                | `%LOCALAPPDATA%`（Windows）、`$XDG_RUNTIME_DIR`（POSIX）               |

`.natalia/` 被 git 忽略；如果你通过设置中心保存过凭据，它里面就含有密钥。
不要在机器之间拷贝它，也不要把它放进仓库。

## 10. Windows 上的已知限制

- 文件权限位是建议性的。`chmod` 和 `mode:` 设置不了执行位，因此 sandbox 的
  mode 变更不影响可执行性。
- 进程归属检查降级为存活检查，因为 `/proc` 不可用。
- 所有依赖 shell 的工具都需要兼容 bash 的 shell。**刻意没有** `cmd.exe` 备选
  方案，因为那会静默重新解释所有带引号的命令。

## 11. Docker 部署（Ubuntu 24.04）

仓库自带 multi-stage `Dockerfile`，产出自包含镜像：应用源码、bun、依赖、
**在 Ubuntu 24.04 内编译的 WezTerm fork**（放在包内默认解析路径）和 sshd，不依赖
任何宿主挂载。SSH 登录使用非 root 的 `natalia` 用户。

### 构建

```bash
# 普通网络
docker build --target server -t natalia-deploy:ubuntu24 .

# 构建机需要代理才能拉取 crates/git 依赖时
docker build --target server \
  --build-arg NATALIA_BUILD_PROXY=http://代理:端口 \
  -t natalia-deploy:ubuntu24 .

# 只想要纯 CLI 镜像（无 sshd）
docker build --target cli -t natalia-cli:ubuntu24 .
```

### 导出到目标服务器

在别处构建、目标服务器有 Docker 时：

```bash
docker save natalia-deploy:ubuntu24 | gzip > natalia-deploy-ubuntu24.tar.gz
# 把压缩包传到服务器后
docker load < natalia-deploy-ubuntu24.tar.gz
```

### 运行

```bash
docker run -d --name natalia \
  -p 2222:22 \
  -e NATALIA_SSH_PASSWORD='设置一个强密码' \
  -v natalia-data:/workspace \
  -v natalia-home:/home/natalia \
  natalia-deploy:ubuntu24
```

- 不设 `NATALIA_SSH_PASSWORD` 时启动会生成随机密码，`docker logs natalia` 可读到。
- `natalia-data` 卷保存项目配置、会话与检查点（`/workspace/.natalia`）。
- `natalia-home` 卷保存用户级配置（`/home/natalia/.config/natalia-cli/`）；不挂的话
  容器重建会丢。

### 使用

```bash
ssh natalia@服务器IP -p 2222   # 密码同上
cd /workspace
natalia                        # 交互式 TUI
natalia-cli                    # 命令行
```

镜像内的 `natalia` 启动器会把 cwd 固定到 `apps/tui`（TUI 的 JSX 配置依赖当前目录）
并把 `NATALIA_WORKSPACE` 指向你所在的目录，因此不需要像本地那样手动 `cd apps/tui`。
provider 照常写在 `/workspace/.natalia/config.json` 或用环境变量。

### 关键点

- fork 二进制位于镜像内的包路径下，**无需** `NATALIA_WEZTERM_EXECUTABLE`。
- 容器以 root 启动 sshd，SSH 会话落到非 root 的 `natalia` 用户。
- 无 GUI 的服务器上交互式终端以 headless（windowless）方式运行，模型照常读写。

## 12. 出问题时

| 现象                                                                            | 原因与处理                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Cannot find module 'react/jsx-dev-runtime'`                                    | 不是从 `apps/tui` 启动的，先 `cd apps/tui`                                 |
| `IntxLNK` 解析错误                                                              | 账户无法创建符号链接（bun ≤ 1.2），见第 2 步                               |
| 根 `node_modules` 里没有 `@natalia/*`（`Cannot find module '@natalia/client'`） | bun ≥ 1.3 默认 isolated 布局，用 `bun install --linker=hoisted`，见第 2 步 |
| `A bash-compatible shell is unavailable`                                        | 装 Git for Windows，或设 `NATALIA_BASH_EXECUTABLE`，然后新开终端           |
| `provider: not configured`                                                      | 第 3 步没生效。在同一个终端里确认变量，然后重启 TUI                        |
| 提交时报 `No real provider configured`                                          | provider 是在 runtime 启动之后才保存的，重启 TUI                           |
| `external editor is not configured`                                             | 设置 `EDITOR` 或 `VISUAL`，见第 5 步                                       |
| Skill 不出现                                                                    | 见第 6 步的验证说明                                                        |
| 第一个终端报 WezTerm 超时                                                       | 重试一次，冷启动导致                                                       |
| agent 在错误的目录里工作                                                        | 传 `--workspace`                                                           |
| Docker 里 SSH `Permission denied`                                              | 确认 `NATALIA_SSH_PASSWORD` 已设置，或看 `docker logs` 里的随机密码         |

排查时可在 TUI 内用 `/doctor` 和 `/diagnostics`，或启动时加 `--doctor` 让它自动
执行一次报告。
