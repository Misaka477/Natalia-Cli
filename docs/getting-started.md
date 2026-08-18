# Natalia CLI: Install and Use

A complete path from a fresh machine to a working agent, including skills.

This guide is self-contained and covers Linux, macOS, and Windows.

Commands are given for PowerShell and for bash. Run whichever matches your shell.

---

## 1. Install the prerequisites

| Component                                           | Required              | Why                                                                                                                                                 |
| --------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Bun](https://bun.com/docs/installation) 1.3.x      | yes                   | The whole runtime uses `Bun.*` APIs. Node is not a substitute.                                                                                      |
| [Git for Windows](https://git-scm.com/download/win) | Windows only          | Shell tools, workflows, skill scripts, and the sandbox all run through a bash-compatible shell. Without it those tools fail with an explicit error. |
| Three `wezterm*` binaries (Natalia fork build)      | interactive terminals | `interactive_terminal_*` has no fallback, and a stock WezTerm cannot be used.                                                                       |
| A provider credential                               | for live turns        | Any OpenAI-compatible, Anthropic, or Gemini key.                                                                                                    |
| Chrome, Chromium, or Edge                           | optional              | `browser_screenshot` only. On Windows all three are discovered automatically and Edge ships with the OS.                                            |

Install Bun:

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

```bash
curl -fsSL https://bun.sh/install | bash
```

### Windows: make Git Bash discoverable

Natalia looks for Git Bash under `%ProgramFiles%`, `%ProgramW6432%`,
`%ProgramFiles(x86)%`, and `%LOCALAPPDATA%\Programs`. If you installed Git
somewhere else, point at it once, permanently:

```powershell
setx NATALIA_BASH_EXECUTABLE "D:\path\to\Git\bin\bash.exe"
```

Then **open a new terminal** so the variable takes effect.

## 2. Get the code and install dependencies

```powershell
git clone <repository-url> natalia-cli
cd natalia-cli
bun install
```

`bun install` is mandatory: workspace packages resolve without it, but the
third-party dependencies (`@opentui/*`, `solid-js`, `zod`) do not.

> **If, after `bun install`, the root `node_modules` has no `@natalia/*`
> links** (bun ≥ 1.3 defaults to the isolated layout on Windows, leaving every
> package under `node_modules/.bun` and making `tsc` fail with `Cannot find
module '@natalia/client'`), run `bun install --linker=hoisted` from the
> repository root to rebuild the standard hoisted layout.
>
> An `IntxLNK` parse error (the account cannot create symlinks; that needs
> Administrator or Developer Mode) is behavior of bun 1.2 and earlier; the
> old advice of `--backend copyfile` or installing from inside `apps\tui`
> only fixes local resolution and no longer applies to bun ≥ 1.3.

The interactive terminal also needs the WezTerm binaries. **They must be the
Natalia fork build** — a stock or system-installed WezTerm cannot be used: the
runtime never falls back to `PATH`, and the patched GUI is the only one that
participates in input ownership arbitration. Build the fork, or copy its
binaries from a machine that has them:

```powershell
# from Linux, cross-compiling for Windows
npm run native-terminal:build-wezterm:windows-cross
# on Windows with MSVC
npm run native-terminal:build-wezterm:windows
```

They land in `packages/native-terminal/wezterm/target/release/`.

**From a Windows release archive** — the prebuilt fork binaries are included in
the archive at their expected path, so nothing needs to be moved:

```text
packages/native-terminal/wezterm/target/release/
├── wezterm.exe            ← CLI client
├── wezterm-gui.exe        ← visible window
└── wezterm-mux-server.exe ← background multiplexer daemon
```

The runtime finds them at this **fixed path relative to the repository root**
(derived from the module location, not the current directory), and the three
binaries must stay in the same directory — the mux server and GUI are located
relative to `wezterm.exe`. If you place the binaries elsewhere, keep all three
together and set `NATALIA_WEZTERM_EXECUTABLE` to the full path of
`wezterm.exe`. Whatever you point it at must be a **Natalia fork build**, not a
stock WezTerm.

Verify once after unpacking:

```powershell
packages\native-terminal\wezterm\target\release\wezterm.exe --version
packages\native-terminal\wezterm\target\release\wezterm-gui.exe start
```

## 3. Configure a provider

Environment variables are the simplest way and keep credentials out of files:

```powershell
$env:NATALIA_API_KEY  = "..."
$env:NATALIA_MODEL    = "gpt-4o-mini"
$env:NATALIA_PROVIDER = "openai-compatible"
$env:NATALIA_BASE_URL = "https://api.example.com/v1"   # optional
```

```bash
export NATALIA_API_KEY="..."
export NATALIA_MODEL="gpt-4o-mini"
export NATALIA_PROVIDER="openai-compatible"
export NATALIA_BASE_URL="https://api.example.com/v1"   # optional
```

Alternatively put credentials under `providers` in `.natalia/config.json`, or
configure them in the TUI Settings Center (`ctrl+,`). A file takes precedence
over the environment.

Settings saved in the TUI are read when the runtime initializes. If you
configure a provider from an empty state, restart the TUI so it starts a session
with that provider.

Never commit an API key, and never paste one into a prompt, a screenshot, or a
session file.

## 4. Start the TUI

The TUI **must be started from `apps/tui`**:

```powershell
cd apps\tui
bun run src/main.tsx --workspace C:\path\to\your\project
```

```bash
cd apps/tui
bun run src/main.tsx --workspace /path/to/your/project
```

Starting from the repository root fails with
`Cannot find module 'react/jsx-dev-runtime'`, because Bun resolves the JSX
runtime from the current directory's `tsconfig.json` and only
`apps/tui/tsconfig.json` sets `jsxImportSource` to `@opentui/solid`.

Because the start directory is fixed, `--workspace` decides which project the
agent works on. Without it the workspace becomes the Natalia repository itself.

| Flag                | Effect                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--workspace <dir>` | The directory the agent reads, writes, and checkpoints.                                                             |
| `--session <id>`    | Resume a session instead of starting a new one.                                                                     |
| `--doctor`          | Start the TUI and immediately run `/doctor`, reporting the resolved provider, workspace, tool count, and readiness. |
| `--diagnostics`     | Same, but runs `/diagnostics` for verbose runtime detail.                                                           |

`NATALIA_WORKSPACE` has the same effect as `--workspace`.

### Health check

```powershell
bun run src/main.tsx --doctor --workspace C:\path\to\your\project
```

This starts the TUI and runs `/doctor` for you; it stays open afterwards, so
read the report and leave with `ctrl+d`.

A healthy report shows your provider, the workspace path, `native tools: 66`
(the count grows as tools are added), the discovered skill count, and `ready`.
`provider: not configured` means step 3 did not take effect.

## 5. Drive the TUI

Type a request and press Enter. Useful keys:

| Key                 | Action                                       |
| ------------------- | -------------------------------------------- |
| `enter`             | Submit                                       |
| `ctrl+j`            | Newline instead of submitting                |
| `ctrl+c`            | Cancel the current turn                      |
| `ctrl+d`            | Exit (on an empty composer)                  |
| `ctrl+p`            | Command palette                              |
| `ctrl+g`            | Switch Chat/Plan in the two-pane layout      |
| `ctrl+b`            | Sidebar                                      |
| `ctrl+n` / `ctrl+l` | New session / session list                   |
| `ctrl+,`            | Settings                                     |
| `ctrl+i` / `ctrl+h` | Status / help                                |
| `up` / `down`       | Move through the `/` and `@` completion list |
| `escape`            | Dismiss completions                          |

Type `/` for commands and `@` to mention a workspace file, an agent, or an MCP
resource.

Open `Live Work Chat` from the command palette. It appears as an overlay below
112 columns, shares the secondary pane with Plan from 112 to 167 columns, and
appears beside Main and Plan from 168 columns onward.

Frequently used commands:

| Command                                         | Purpose                              |
| ----------------------------------------------- | ------------------------------------ |
| `/help`, `/doctor`, `/status`                   | Help, health, runtime snapshot       |
| `/sessions`, `/models`, `/model <name>`         | Sessions and model selection         |
| `/files <query>`, `/search <text>`              | Find files, search content           |
| `/skills`, `/skill <name>`                      | List and activate skills             |
| `/checkpoint`, `/checkpoints`, `/rollback <id>` | Workspace checkpoints                |
| `/agents`, `/agent <name>`                      | Agent selection                      |
| `/editor`                                       | Edit the draft in an external editor |
| `/pause`, `/resume`                             | Pause and resume at a safe boundary  |

`/editor` needs `EDITOR` or `VISUAL`. Neither is normally set on Windows, so set
one to an editor that blocks until closed:

```powershell
setx EDITOR "code --wait"
```

## 6. Install skills

A skill is a directory containing `SKILL.md`. Natalia discovers skills at
startup, advertises them to the model, and loads one on demand.

Choose a scope:

| Scope   | Location                                                                                  | Use when                                                      |
| ------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| user    | `%APPDATA%\natalia-cli\skills\` (Windows), `~/.config/natalia-cli/skills/` (Linux, macOS) | the skill is general purpose and should work in every project |
| project | `<workspace>/.natalia/skills/`                                                            | the skill belongs to one repository                           |

For a skill repository that keeps its skills in a `skills/` folder:

```powershell
git clone --depth 1 <skill-repo-url> "$env:TEMP\pull"
$dst = "$env:APPDATA\natalia-cli\skills"
New-Item -ItemType Directory -Path $dst -Force
Get-ChildItem "$env:TEMP\pull\skills" -Directory |
  ForEach-Object { Copy-Item $_.FullName -Destination $dst -Recurse -Force }
Remove-Item "$env:TEMP\pull" -Recurse -Force
```

```bash
git clone --depth 1 <skill-repo-url> /tmp/pull
mkdir -p ~/.config/natalia-cli/skills
cp -r /tmp/pull/skills/* ~/.config/natalia-cli/skills/
rm -rf /tmp/pull
```

Swap the destination for `<workspace>/.natalia/skills` to install per project.
When the same skill name exists in both, the project copy wins.

Remove a skill by deleting its directory.

Skills can also be pulled from a URL declared under `skills.urls` in
`.natalia/config.json`. The URL must serve an `index.json` listing the available
skills, and each entry is fetched into the user skill directory.

### Verify

Restart the TUI, then:

```text
/skills
```

Every installed skill is listed with its name and description. `--doctor` also
reports the count.

If a skill is missing, the usual causes are a missing `SKILL.md`, a `name` that
is not lowercase letters, digits, and hyphens, block-style YAML in the
frontmatter, or a UTF-8 BOM. Note that **one malformed `SKILL.md` makes every
skill unavailable**, and the error does not name the offending directory; remove
the directory you added last to confirm.

### Use

The installed skills are described to the model on every turn, so simply state
the task:

```text
Plan the export feature for this project.
```

To pick one yourself:

```text
/skill planning-layer-runtime
```

`/skill` loads it without spending a model turn, which is handy when you already
know which one you want.

## 7. Interactive terminals

Ask the agent to open an interactive terminal and it starts a WezTerm window
driven through a mux server. Several sessions can be open at once, for example
one running an editor and one running a REPL. What runs inside a pane is up to
you, and the agent can launch other interactive programs on request.

If the first attempt reports a WezTerm timeout, retry once: the first mux server
start pays a cold-start cost on Windows.

## 8. Escape hatches

| Variable                     | Purpose                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `NATALIA_BASH_EXECUTABLE`    | Absolute path to `bash.exe` when Git for Windows is installed outside the searched locations.                                       |
| `NATALIA_WEZTERM_EXECUTABLE` | Absolute path to `wezterm.exe` when the binaries are not in the fork's build directory. Its siblings must be in the same directory. |
| `NATALIA_CHROME_BIN`         | Browser for `browser_screenshot`. Set it if discovery picks a broken install; Edge works well on Windows.                           |
| `EDITOR`, `VISUAL`           | External editor for `/editor`.                                                                                                      |
| `NATALIA_WORKSPACE`          | Same as `--workspace`.                                                                                                              |

## 9. Where your data lives

| Contents                                      | Location                                                             |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Project config, sessions, checkpoints, skills | `<workspace>/.natalia/`                                              |
| Global config                                 | `%APPDATA%\natalia-cli\` (Windows), `~/.config/natalia-cli/` (POSIX) |
| Terminal runtime files                        | `%LOCALAPPDATA%` (Windows), `$XDG_RUNTIME_DIR` (POSIX)               |

`.natalia/` is git-ignored, and it holds credentials if you saved any through
the Settings Center. Do not copy it between machines or into a repository.

## 10. Known limits on Windows

- File modes are advisory. `chmod` and `mode:` cannot set execute bits, so
  sandbox mode changes do not affect executability.
- Process ownership checks degrade to a liveness check, because `/proc` is
  unavailable.
- Every shell-backed tool requires a bash-compatible shell. There is
  deliberately no `cmd.exe` fallback, because that would silently reinterpret
  quoted commands.

## 11. If something goes wrong

| Symptom                                                                         | Cause and fix                                                                          |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Cannot find module 'react/jsx-dev-runtime'`                                    | Started outside `apps/tui`. `cd apps/tui` first.                                       |
| `IntxLNK` parse error                                                           | Account cannot create symlinks (bun ≤ 1.2). See step 2.                                |
| No `@natalia/*` in root `node_modules` (`Cannot find module '@natalia/client'`) | bun ≥ 1.3 isolated layout. Run `bun install --linker=hoisted`, see step 2.             |
| `A bash-compatible shell is unavailable`                                        | Install Git for Windows, or set `NATALIA_BASH_EXECUTABLE`, then open a new terminal.   |
| `provider: not configured`                                                      | Step 3 did not apply. Verify the variables in the same terminal, then restart the TUI. |
| `No real provider configured` on submit                                         | The provider was saved after the runtime started. Restart the TUI.                     |
| `external editor is not configured`                                             | Set `EDITOR` or `VISUAL`, see step 5.                                                  |
| Skills do not appear                                                            | See the verification notes in step 6.                                                  |
| WezTerm timeout on the first terminal                                           | Retry once; cold start.                                                                |
| The agent works in the wrong directory                                          | Pass `--workspace`.                                                                    |

Collect details with `/doctor` and `/diagnostics` inside the TUI, or pass
`--doctor` at startup to have the report run for you.
