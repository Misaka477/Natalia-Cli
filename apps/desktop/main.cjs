const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const WebSocket = require("ws");

const DESKTOP_START = performance.now();
console.log("[perf] desktop main start");

// Local runtime requests must never go through the user's HTTP proxy. A
// system/HTTP proxy can add multi-second delays to every 127.0.0.1 RPC and is
// the main reason startup RPCs took ~7s while the runtime itself answered in
// a few hundred ms.
app.commandLine.appendSwitch("proxy-bypass-list", "127.0.0.1,localhost");
process.env.NO_PROXY = [process.env.NO_PROXY, "127.0.0.1,localhost"]
  .filter(Boolean)
  .join(",");

// NB: keep these definitions before readDesktopSettings() is called below.
// DESKTOP_SETTINGS_FILE is a const and readDesktopSettings() runs before
// Electron is ready; accessing the file-path helper before its initializer
// would throw a TDZ ReferenceError inside the try/catch, making every startup
// silently treat settings as “{}” even after the UI persists gpuEnabled=true.
const DESKTOP_SETTINGS_FILE = () =>
  path.join(app.getPath("userData"), "desktop-settings.json");

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

// GPU acceleration is opt-in through Desktop settings. On Wayland/niri the
// GPU compositor path is noisy and can stall rendering, so the default is off
// with software WebGL allowed. Restart is required to change this setting.
const desktopSettings = readDesktopSettings();
console.warn("[perf] desktop gpuEnabled", desktopSettings.gpuEnabled);
if (desktopSettings.gpuEnabled !== true) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("enable-unsafe-swiftshader");
}
const TOKEN = process.env.NATALIA_TRANSPORT_TOKEN;
const WORKSPACE_ROOT = path.resolve(__dirname, "../..");

let runtimeURL = process.env.NATALIA_RUNTIME_URL || "";
let runtimeProcess;
let runtimeOwned = false;

let mainWindow;
const terminalSubscriptions = new Map();

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
  const runtimeStart = Date.now();
  if (runtimeURL) {
    try {
      await waitForRuntime(runtimeURL, 8);
      console.log("[desktop] using existing runtime", runtimeURL, `${Date.now() - runtimeStart}ms`);
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
  console.log("[desktop] runtime ready", runtimeURL, `${Date.now() - runtimeStart}ms`);
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

function runtimeCall(method, params) {
  const callStart = Date.now();
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: params ?? {},
    });
    const url = new URL(runtimeURL);
    const headers = {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
    };
    if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: "/rpc",
        method: "POST",
        headers,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          const elapsed = Date.now() - callStart;
          console.log(`[desktop] runtime_call ${String(method)} ${elapsed}ms`);
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode !== 200 || parsed.error) {
              const message =
                parsed.error?.message ||
                parsed.error ||
                `runtime RPC failed: ${res.statusCode}`;
              reject(new Error(message));
              return;
            }
            resolve(parsed.result);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const runtimeEventBatch = [];
let runtimeEventFlushTimer;
function sendRuntimeEvent(event) {
  runtimeEventBatch.push(event);
  if (runtimeEventBatch.length >= 100) {
    clearTimeout(runtimeEventFlushTimer);
    runtimeEventFlushTimer = undefined;
    flushRuntimeEvents();
    return;
  }
  if (runtimeEventFlushTimer) return;
  runtimeEventFlushTimer = setTimeout(flushRuntimeEvents, 16);
}
function flushRuntimeEvents() {
  runtimeEventFlushTimer = undefined;
  if (!runtimeEventBatch.length) return;
  const events = runtimeEventBatch.splice(0);
  mainWindow?.webContents.send("natalia-runtime-events", events);
}

async function streamRuntimeEvents() {
  while (true) {
    try {
      const response = await runtimeFetch("/events", {
        headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : undefined,
      });
      if (!response.ok || !response.body) {
        console.error("[desktop] runtime event stream failed", response.status);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
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
      console.log("[desktop] runtime event stream closed; reconnecting");
    } catch (error) {
      console.log("[desktop] runtime event stream disconnected, retrying");
    }
    if (mainWindow?.isDestroyed()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
  mainWindow.webContents.on("did-finish-load", () => {
    console.log(
      `[perf] desktop renderer did-finish-load +${(performance.now() - DESKTOP_START).toFixed(1)}ms`,
    );
  });

  mainWindow.on("closed", () => {
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

function readEdgeX11Environment() {
  try {
    const candidates = fs
      .readdirSync("/proc")
      .filter((name) => /^\d+$/u.test(name))
      .map(Number);
    for (const pid of candidates) {
      try {
        const cmdline = fs
          .readFileSync(`/proc/${pid}/cmdline`, "utf8")
          .replace(/\0+/gu, " ");
        if (!cmdline.includes("/opt/microsoft/msedge/") &&
            !cmdline.includes("msedge")) continue;
        const environ = fs.readFileSync(`/proc/${pid}/environ`, "utf8");
        const variables = environ.split("\0");
        for (const entry of variables) {
          if (entry.startsWith("DISPLAY=")) {
            process.env.DISPLAY = entry.slice("DISPLAY=".length);
          }
          if (entry.startsWith("XAUTHORITY=")) {
            process.env.XAUTHORITY = entry.slice("XAUTHORITY=".length);
          }
        }
        if (process.env.DISPLAY) return true;
      } catch {
        // Ignore unreadable processes and keep scanning.
      }
    }
  } catch {
    // /proc not available; keep current environment.
  }
  return false;
}

function findStandardXAuthority() {
  const candidates = [
    path.join(process.env.HOME || "", ".Xauthority"),
    path.join(process.env.XDG_RUNTIME_DIR || "", "Xauthority"),
    path.join(process.env.XDG_RUNTIME_DIR || "", "xwayland", "Xauthority"),
    path.join(process.env.XDG_RUNTIME_DIR || "", "niri", "Xauthority"),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

if (process.platform === "linux") {
  const edgeX11 = readEdgeX11Environment();
  if (!process.env.XAUTHORITY) {
    const standardAuth = findStandardXAuthority();
    if (standardAuth) process.env.XAUTHORITY = standardAuth;
  }
  let xSockets = [];
  try {
    xSockets = fs.readdirSync("/tmp/.X11-unix");
  } catch {
    xSockets = [];
  }
  console.warn(
    `[perf] desktop edgeX11=${edgeX11} DISPLAY=${process.env.DISPLAY || ""} XAUTHORITY=${process.env.XAUTHORITY || ""} xSockets=${xSockets.join(",") || "none"}`,
  );
  try {
    const edgeGpuProcesses = fs
      .readdirSync("/proc")
      .filter((name) => /^\d+$/u.test(name))
      .map(Number)
      .map((pid) => {
        try {
          return fs
            .readFileSync(`/proc/${pid}/cmdline`, "utf8")
            .replace(/\0+/gu, " ");
        } catch {
          return "";
        }
      })
      .filter(
        (cmdline) => cmdline.includes("msedge") && cmdline.includes("--type=gpu-process"),
      );
    for (const edgeGpu of edgeGpuProcesses) {
      console.warn(`[perf] desktop edge gpu-process ${edgeGpu}`);
    }
  } catch {
    // ignore
  }

  // Mirror Edge's working Wayland GPU process as closely as possible:
  // only ozone-platform + render-node-override, no ANGLE/zygote/blocklist
  // overrides that Electron's Chromium build may not handle.
  app.commandLine.appendSwitch("ozone-platform", "wayland");
  for (let renderNodeIndex = 128; renderNodeIndex < 160; renderNodeIndex++) {
    const renderNode = `/dev/dri/renderD${renderNodeIndex}`;
    if (fs.existsSync(renderNode)) {
      app.commandLine.appendSwitch("render-node-override", renderNode);
      break;
    }
  }
}

app.whenReady().then(async () => {
  console.log(`[perf] desktop app ready +${(performance.now() - DESKTOP_START).toFixed(1)}ms`);
  try {
    console.warn("[perf] desktop gpu", app.getGPUFeatureStatus());
  } catch {
    console.warn("[perf] desktop gpu unavailable");
  }
  try {
    const gpuInfo = await app.getGPUInfo("basic");
    console.warn("[perf] desktop gpuInfo", JSON.stringify(gpuInfo));
  } catch {
    console.warn("[perf] desktop gpuInfo unavailable");
  }
  try {
    console.warn(
      "[perf] desktop hardwareAccelerationEnabled",
      app.isHardwareAccelerationEnabled(),
    );
  } catch {
    console.warn("[perf] desktop hardwareAccelerationEnabled unavailable");
  }
  app.userAgentFallback =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  try {
    await ensureRuntime();
  } catch (error) {
    console.error("[desktop] failed to start runtime", error);
  }
  console.log(`[perf] desktop runtime ready +${(performance.now() - DESKTOP_START).toFixed(1)}ms`);
  // Warm the workspace runtime before the renderer requests data. The first
  // RPC triggers a ~1-2s initialize; starting it here overlaps with window
  // creation and removes most of that wait from the visible startup path.
  void runtimeCall("plugin.catalog", {}).catch(() => undefined);
  createMainWindow();
  console.log(`[perf] desktop window created +${(performance.now() - DESKTOP_START).toFixed(1)}ms`);
  void streamRuntimeEvents();
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
