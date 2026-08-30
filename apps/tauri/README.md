# Natalia Tauri Desktop

Tauri 宿主插件骨架，复用现有 Web UI（`packages/plugins/ui/web`），把前端
`RuntimeClient` 的 HTTP/SSE transport 替换成 Tauri IPC。

## 当前进度

- Stage A 骨架：
  - `src-tauri` 基础工程（Cargo、tauri.conf、capability）
  - Rust `runtime_call` 将前端 Tauri IPC 转发到本地 Natalia runtime RPC
  - Rust 保持 `/events` SSE 长连接，并把事件转发为 `natalia-runtime-event`
  - `apps/web/src/runtime-rpc.ts` 在检测到 `window.__TAURI__` 时自动走 IPC

## 前置条件

- Rust stable
- Tauri CLI（`@tauri-apps/cli` 在 `dependencies`/`devDependencies` 中）
- Linux/macOS 需要系统 WebView 依赖：
  - webkit2gtk-4.1（Tauri v2）
  - libgtk-3
- 本地运行 `bun install` / `npm install` 安装前端依赖

## 常用命令

```bash
npm run ts:ui        # 启动本地 runtime + Web Vite dev server
npm --workspace @natalia/desktop run dev
npm --workspace @natalia/desktop run build
```

## 结构

```text
apps/tauri
├── src-tauri
│   ├── capabilities/default.json
│   ├── src/lib.rs
│   ├── src/main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
└── README.md
```
