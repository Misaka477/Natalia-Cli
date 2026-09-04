# Natalia Browser Plugin

`@natalia/plugin-browser` 提供完整的浏览器控制能力，通过本地 bridge server 和浏览器扩展连接用户现有的 Chrome / Edge / Firefox。

插件中包含：

- `src/server.ts`：本地 bridge server，默认监听 `127.0.0.1:18765`
- `src/extension/chromium/`：Chrome / Edge 扩展
- `src/extension/firefox/`：Firefox 扩展
- `scripts/install.ts`：自动安装/启动辅助脚本

## 安装浏览器扩展

### 方式一：自动安装辅助脚本

在仓库根目录执行：

```bash
bun packages/plugins/browser/scripts/install.ts
```

或者在浏览器插件目录执行：

```bash
cd packages/plugins/browser
bun run install-extension
```

脚本会：

1. 启动本地 bridge server
2. 检测 Chromium 系浏览器（Chrome / Edge / Brave / Opera / Vivaldi / Arc）
3. 浏览器未运行时，用 `--load-extension` 自动加载扩展
4. 浏览器已运行时，打开扩展管理页并提示手动加载目录

### 方式二：手动安装

#### Chrome / Edge

1. 打开扩展管理页：
   - Chrome：`chrome://extensions`
   - Edge：`edge://extensions`
2. 打开「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择目录：

```text
packages/plugins/browser/src/extension/chromium
```

#### Firefox

1. 打开：

```text
about:debugging#/runtime/this-firefox
```

2. 点击「临时载入附加组件」
3. 选择文件：

```text
packages/plugins/browser/src/extension/firefox/manifest.json
```

> Firefox 临时加载的扩展在浏览器重启后需要重新加载。

## 启动本地 bridge server

通常不需要手动启动：第一次调用 `browser_*` 工具时，插件会自动启动 bridge server。

如果需要手动启动以便提前确认扩展连接：

```bash
bun packages/plugins/browser/src/server.ts
```

## 验证扩展是否已连接

扩展加载后会自动连接：

```text
ws://127.0.0.1:18765
```

扩展断线后每秒自动重连。

服务启动后可以检查连接状态：

```bash
curl http://127.0.0.1:18765/healthz
```

看到类似输出即表示连接成功：

```json
{"ok":true,"extensions":1}
```

如果 `extensions` 为 `0`，说明扩展还没有连接；请确认扩展已经加载，并且本地 bridge server 正在运行。
