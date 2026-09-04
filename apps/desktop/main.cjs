const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
const WebSocket = require("ws");
const http = require("http");
const { createBrowserHost } = require("./browser-host.cjs");

// GPU acceleration is opt-in through Desktop settings. On Wayland/niri the
// GPU compositor path is noisy and can stall rendering, so the default is off
// with software WebGL allowed. Restart is required to change this setting.
const desktopSettings = readDesktopSettings();
if (desktopSettings.gpuEnabled === true) {
  // Keep hardware acceleration enabled; user opted in.
} else {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("enable-unsafe-swiftshader");
}


const TOKEN = process.env.NATALIA_TRANSPORT_TOKEN;
const WORKSPACE_ROOT = path.resolve(__dirname, "../..");

const DESKTOP_SETTINGS_FILE = () => path.join(app.getPath("userData"), "desktop-settings.json");

function readDesktopSettings() {
  try {
    return JSON.parse(fs.readFileSync(DESKTOP_SETTINGS_FILE(), "utf8"));
  } catch {
    return {};
  }
}

function writeDesktopSettings(patch) {
  const current = readDesktopSettings();
  const next = { ...current, ...patch };
  try {
    fs.mkdirSync(path.dirname(DESKTOP_SETTINGS_FILE()), { recursive: true });
    fs.writeFileSync(DESKTOP_SETTINGS_FILE(), JSON.stringify(next));
  } catch (error) {
    console.error("[desktop] failed to persist desktop settings", error);
  }
  return next;
}
let runtimeURL = process.env.NATALIA_RUNTIME_URL || "";
let runtimeProcess;
let runtimeOwned = false;

let mainWindow;
const terminalSubscriptions = new Map();
const browserHost = createBrowserHost({
  getMainWindow: () => mainWindow,
  persistFile: () => path.join(app.getPath("userData"), "browser-tabs.json"),
});

function runtimeFetch(pathname, options = {}) {
  if (!runtimeURL) throw new Error("runtime URL is not ready");
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  return fetch(`${runtimeURL}${pathname}`, { ...options, headers });
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function findFreePort(start = 8790) {
  for (let port = start; port < start + 100; port += 1) {
    if (await portFree(port)) return port;
  }
  throw new Error("no free runtime port found");
}

async function waitForRuntime(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`runtime server did not start at ${url}`);
}

function runtimeCommand() {
  const bun = process.env.NATALIA_BUN_BIN || "bun";
  const entry = path.join(WORKSPACE_ROOT, "apps/cli/src/main.ts");
  return { bun, entry };
}

async function ensureRuntime() {
  if (runtimeURL) {
    try {
      await waitForRuntime(runtimeURL, 8);
      console.log("[desktop] using existing runtime", runtimeURL);
      return runtimeURL;
    } catch {
      if (process.env.NATALIA_RUNTIME_URL) {
        throw new Error(`configured runtime ${runtimeURL} is not reachable`);
      }
    }
  }
  const port = await findFreePort();
  runtimeURL = `http://127.0.0.1:${port}`;
  const { bun, entry } = runtimeCommand();
  const nataliaDir = path.join(WORKSPACE_ROOT, ".natalia");
  fs.mkdirSync(nataliaDir, { recursive: true });
  const env = {
    ...process.env,
    NATALIA_CONFIG: path.join(nataliaDir, "global-config.json"),
    NATALIA_WORKSPACES_FILE: path.join(nataliaDir, "workspaces.json"),
    NATALIA_BROWSER_BRIDGE_URL: "http://127.0.0.1:8788",
  };
  console.log("[desktop] starting runtime", bun, entry, "serve", String(port));
  runtimeProcess = spawn(bun, [entry, "serve", String(port)], {
    cwd: WORKSPACE_ROOT,
    env,
    stdio: "inherit",
  });
  runtimeOwned = true;
  runtimeProcess.on("exit", (code, signal) => {
    console.log("[desktop] runtime exited", { code, signal });
    if (runtimeOwned) runtimeProcess = undefined;
  });
  await waitForRuntime(runtimeURL);
  console.log("[desktop] runtime ready", runtimeURL);
  return runtimeURL;
}

function stopOwnedRuntime() {
  if (!runtimeOwned || !runtimeProcess) return;
  const child = runtimeProcess;
  runtimeOwned = false;
  runtimeProcess = undefined;
  try {
    child.kill("SIGTERM");
    child.kill("SIGKILL");
  } catch {
    // already gone
  }
}

async function runtimeCall(method, params) {
  const response = await runtimeFetch("/rpc", {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? {} }),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    const message = body.error?.message || body.error || `runtime RPC failed: ${response.status}`;
    throw new Error(message);
  }
  return body.result;
}

function sendRuntimeEvent(event) {
  mainWindow?.webContents.send("natalia-runtime-event", event);
}

async function streamRuntimeEvents() {
  try {
    const response = await runtimeFetch("/events", {
      headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : undefined,
    });
    if (!response.ok || !response.body) {
      console.error("[desktop] runtime event stream failed", response.status);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let current = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            current = JSON.parse(line.slice(6));
          } catch {
            current = null;
          }
        } else if (line === "" && current) {
          sendRuntimeEvent(current);
          current = null;
        }
      }
    }
  } catch (error) {
    console.error("[desktop] runtime event stream error", error);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "Natalia Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const webDist = path.resolve(__dirname, "../../apps/web/dist/index.html");
  mainWindow.loadFile(webDist);

  mainWindow.on("closed", () => {
    browserHost.destroy();
    mainWindow = undefined;
  });
}

ipcMain.handle("runtime_call", (_event, payload) => {
  const { method, params } = payload || {};
  return runtimeCall(method, params);
});

ipcMain.handle("runtime_info", () => ({
  url: runtimeURL,
  token: TOKEN ?? "",
}));

ipcMain.on("renderer-log", (_event, data) => {
  console.log("[renderer]", data.message, ...(data.args || []));
});

ipcMain.handle("terminal_output_subscribe", (_event, payload) => {
  const { sessionId, terminalId } = payload || {};
  if (!sessionId || !terminalId) throw new Error("missing sessionId/terminalId");

  const existing = terminalSubscriptions.get(terminalId);
  if (existing && existing.readyState === WebSocket.OPEN) {
    console.log("[desktop] reuse existing terminal output bridge", terminalId);
    return { subscribed: true, reused: true };
  }

  const base = runtimeURL.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  const url = `${base}/terminal/${encodeURIComponent(sessionId)}/${encodeURIComponent(terminalId)}${TOKEN ? `?token=${TOKEN}` : ""}`;
  const ws = new WebSocket(url);
  terminalSubscriptions.set(terminalId, ws);
  ws.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    mainWindow?.webContents.send("natalia-terminal-output", {
      id: terminalId,
      message,
    });
  });
  ws.on("open", () => console.log("[desktop] terminal output bridge connected", url));
  ws.on("close", () => {
    if (terminalSubscriptions.get(terminalId) === ws) {
      terminalSubscriptions.delete(terminalId);
    }
  });
  ws.on("error", (error) => console.error("[desktop] terminal output bridge error", error));
  return { subscribed: true };
});

ipcMain.handle("browser_show", (_event, payload) => browserHost.show(payload?.rect, payload?.sessionID));
ipcMain.handle("browser_move", (_event, payload) => browserHost.move(payload?.rect));
ipcMain.handle("browser_hide", () => browserHost.hide());
ipcMain.handle("browser_destroy", () => {
  browserHost.destroy();
  return { ok: true };
});
ipcMain.handle("browser_status", (_event, payload) => browserHost.state(payload?.sessionID));
ipcMain.handle("browser_claim_human", (_event, payload) => browserHost.setOwner("human", payload?.tabId));
ipcMain.handle("browser_release_model", (_event, payload) => browserHost.setOwner("model", payload?.tabId));
ipcMain.handle("browser_share", (_event, payload) => browserHost.setOwner("shared", payload?.tabId));
ipcMain.handle("browser_begin_secure_input", (_event, payload) => browserHost.setSecureInput(true, payload?.tabId));
ipcMain.handle("browser_end_secure_input", (_event, payload) => browserHost.setSecureInput(false, payload?.tabId));
ipcMain.handle("browser_set_approval_mode", (_event, payload) => browserHost.setApprovalMode(payload?.mode, payload?.tabId));
ipcMain.handle("browser_respond_approval", (_event, payload) => browserHost.respondApproval(payload));
ipcMain.handle("browser_create_tab", (_event, payload) => browserHost.createTab(payload?.url, undefined, payload?.sessionID));
ipcMain.handle("browser_close_tab", (_event, payload) => browserHost.closeTab(payload?.tabId));
ipcMain.handle("browser_activate_tab", (_event, payload) => browserHost.activate(payload?.tabId, payload?.rect, payload?.sessionID));
ipcMain.handle("browser_navigate", (_event, payload) => browserHost.navigate(payload));
ipcMain.handle("browser_read_dom", (_event, payload) => browserHost.readDom(payload?.tabId));
ipcMain.handle("browser_click", (_event, payload) => browserHost.click(payload));
ipcMain.handle("browser_input", (_event, payload) => browserHost.input(payload));
ipcMain.handle("browser_screenshot", (_event, payload) => browserHost.screenshot(payload?.tabId));
ipcMain.handle("browser_go_back", (_event, payload) => browserHost.goBack(payload?.tabId));
ipcMain.handle("browser_go_forward", (_event, payload) => browserHost.goForward(payload?.tabId));
ipcMain.handle("browser_reload", (_event, payload) => browserHost.reload(payload?.tabId));

ipcMain.handle("desktop_get_setting", (_event, key) => {
  const settings = readDesktopSettings();
  return typeof key === "string" ? settings[key] : settings;
});
ipcMain.handle("desktop_set_setting", (_event, payload) => {
  const key = payload?.key;
  const value = payload?.value;
  if (typeof key !== "string" || !key) throw new Error("desktop setting key is required");
  writeDesktopSettings({ [key]: value });
  return { ok: true };
});

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handleBrowserBridge(req, res) {
  res.setHeader("Content-Type", "application/json");
  const send = (status, payload) => {
    res.statusCode = status;
    res.end(JSON.stringify(payload));
  };
  try {
    const input = await readJsonBody(req);
    const routes = {
      "/browser/open": "open",
      "/browser/tabs": "tabs",
      "/browser/navigate": "navigate",
      "/browser/read": "read",
      "/browser/scan": "scan",
      "/browser/execute_js": "execute_js",
      "/browser/click": "click",
      "/browser/input": "input",
      "/browser/screenshot": "screenshot",
    };
    const action = req.method === "POST" ? routes[req.url] : undefined;
    if (!action) {
      send(404, { error: `unknown bridge route ${req.method} ${req.url}` });
      return;
    }
    console.log("[desktop] bridge", req.url, action);
    const result = await browserHost.handleBridge(action, input);
    send(200, result);
  } catch (error) {
    send(500, { error: error instanceof Error ? error.message : String(error) });
  }
}

function startBrowserBridge() {
  const server = http.createServer((req, res) => {
    void handleBrowserBridge(req, res);
  });
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.warn("[desktop] browser bridge port 8788 already in use; skipping bridge (another instance may be running)");
    } else {
      console.error("[desktop] browser bridge error", error);
    }
  });
  server.listen(8788, "127.0.0.1", () => {
    console.log("[desktop] browser bridge listening on http://127.0.0.1:8788");
  });
}

// Electron/Chromium works best on niri with explicit Wayland text-input-v3.
if (process.platform === "linux") {
  app.commandLine.appendSwitch("ozone-platform", "wayland");
  app.commandLine.appendSwitch("enable-features", "WaylandTextInputV3");
}

app.whenReady().then(async () => {
  app.userAgentFallback =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  browserHost.restore();
  try {
    await ensureRuntime();
  } catch (error) {
    console.error("[desktop] failed to start runtime", error);
  }
  createMainWindow();
  void streamRuntimeEvents();
  startBrowserBridge();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("before-quit", () => {
  stopOwnedRuntime();
});

process.on("SIGINT", () => {
  stopOwnedRuntime();
  app.exit(0);
});
process.on("SIGTERM", () => {
  stopOwnedRuntime();
  app.exit(0);
});

app.on("window-all-closed", () => {
  stopOwnedRuntime();
  if (process.platform !== "darwin") app.quit();
});
