const { app, BrowserWindow, ipcMain, BrowserView, session } = require("electron");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const http = require("http");

const RUNTIME_URL =
  process.env.NATALIA_RUNTIME_URL || "http://127.0.0.1:8790";
const TOKEN = process.env.NATALIA_TRANSPORT_TOKEN;

let mainWindow;
let browserView;
let browserViewAttached = false;
let browserUrl = "";
let lastBrowserRect = { x: 0, y: 0, width: 0, height: 0 };
let browserOwner = "shared";
let browserSecureInput = false;
let browserSessionHandlersBound = false;
const terminalSubscriptions = new Map();

function browserHistory(contents) {
  return contents.navigationHistory ?? contents;
}

function lastUrlPath() {
  return path.join(app.getPath("userData"), "browser-last-url.txt");
}

function loadPersistedBrowserUrl() {
  try {
    const saved = fs.readFileSync(lastUrlPath(), "utf8").trim();
    if (saved) browserUrl = saved;
  } catch {
    // first launch or unreadable file
  }
}

function persistBrowserUrl(url) {
  if (!url || url === "about:blank") return;
  browserUrl = url;
  try {
    fs.writeFileSync(lastUrlPath(), url);
  } catch (error) {
    console.error("[desktop] failed to persist browser url", error);
  }
}

function browserState(extra = {}) {
  const contents = browserView?.webContents;
  const history = contents ? browserHistory(contents) : null;
  return {
    url: contents?.getURL() || browserUrl || "",
    loading: Boolean(contents?.isLoadingMainFrame()),
    canGoBack: Boolean(history?.canGoBack()),
    canGoForward: Boolean(history?.canGoForward()),
    owner: browserOwner,
    secureInput: browserSecureInput,
    attached: browserViewAttached,
    ...extra,
  };
}

function assertModelMayMutate() {
  if (browserSecureInput) {
    throw new Error("browser is in secure input; model writes are paused");
  }
  if (browserOwner === "human") {
    throw new Error("human controls the browser; model writes are paused");
  }
}

function runtimeFetch(pathname, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  return fetch(`${RUNTIME_URL}${pathname}`, { ...options, headers });
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

function sendBrowserStatus(extra = {}) {
  if (!mainWindow) return;
  mainWindow.webContents.send("browser-status", browserState(extra));
}

function ensureBrowserView() {
  if (browserView) return browserView;
  const browserSession = session.fromPartition("persist:natalia-browser");
  if (!browserSessionHandlersBound) {
    browserSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(permission === "clipboard-sanitized-write" || permission === "fullscreen");
    });
    browserSession.on("will-download", (_event, item) => {
      console.log("[desktop] browser download", item.getFilename(), item.getURL());
    });
    browserSessionHandlersBound = true;
  }
  browserView = new BrowserView({
    webPreferences: {
      session: browserSession,
      contextIsolation: true,
      sandbox: true,
    },
  });
  mainWindow.addBrowserView(browserView);
  browserViewAttached = true;
  try {
    browserView.setBorderRadius(12);
  } catch {
    // Linux does not apply BrowserView border radius; keep the rectangular view.
  }
  browserView.webContents.loadURL(browserUrl || "about:blank");
  console.log("[desktop] browser BrowserView created", {
    attached: browserViewAttached,
    url: browserUrl,
    partition: "persist:natalia-browser",
  });
  const sendBrowserUrl = (url) => {
    persistBrowserUrl(url);
    mainWindow?.webContents.send("browser-url-changed", { url });
    sendBrowserStatus({ url });
  };
  browserView.webContents.on("did-start-loading", () => {
    console.log("[desktop] browser did-start-loading", browserView.webContents.getURL() || browserUrl);
    sendBrowserStatus({ loading: true, error: null });
  });
  browserView.webContents.on("did-stop-loading", () => {
    sendBrowserStatus({ loading: false });
  });
  browserView.webContents.on("did-navigate", (_event, url) => {
    console.log("[desktop] browser did-navigate", url);
    sendBrowserUrl(url);
  });
  browserView.webContents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
    if (isMainFrame) sendBrowserUrl(url);
  });
  browserView.webContents.on("did-finish-load", () => {
    console.log("[desktop] browser BrowserView finished loading", browserView.webContents.getURL() || browserUrl);
    sendBrowserStatus({ loading: false, error: null });
    if (lastBrowserRect.width && lastBrowserRect.height) {
      browserView.setBounds(lastBrowserRect);
      console.log("[desktop] re-applied browser bounds after load", lastBrowserRect);
    }
  });
  browserView.webContents.on("did-fail-load", (_event, code, desc, url, isMainFrame) => {
    console.error("[desktop] browser did-fail-load", { code, desc, url, isMainFrame });
    if (!isMainFrame) return;
    sendBrowserStatus({
      loading: false,
      error: desc || `load failed (${code})`,
      url,
    });
  });
  browserView.webContents.on("render-process-gone", (_event, details) => {
    console.error("[desktop] browser renderer gone", details);
    sendBrowserStatus({
      loading: false,
      error: details?.reason || "renderer gone",
    });
  });
  return browserView;
}

function setBrowserBounds(rect) {
  const view = ensureBrowserView();
  if (!rect) return;
  console.log("[desktop] setBrowserBounds input", rect);
  lastBrowserRect = {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
  console.log("[desktop] setBrowserBounds result", lastBrowserRect);
  view.setBounds(lastBrowserRect);
}

function hideBrowser() {
  if (browserView && mainWindow && browserViewAttached) {
    mainWindow.removeBrowserView(browserView);
    browserViewAttached = false;
  }
}

function destroyBrowser() {
  hideBrowser();
  if (browserView) {
    try {
      browserView.webContents.destroy();
    } catch (error) {
      console.error("[desktop] browser destroy failed", error);
    }
  }
  browserView = undefined;
  browserViewAttached = false;
  sendBrowserStatus({ url: browserUrl, attached: false });
}

function showBrowser(rect) {
  if (!browserView) {
    ensureBrowserView();
  }
  if (!browserViewAttached) {
    mainWindow.addBrowserView(browserView);
    browserViewAttached = true;
    console.log("[desktop] BrowserView attached", {
      browserViews: mainWindow.getBrowserViews().length,
    });
  }
  setBrowserBounds(rect);
  browserView.webContents.focus();
  console.log("[desktop] BrowserView shown", {
    attached: browserViewAttached,
    bounds: lastBrowserRect,
    windowVisible: mainWindow?.isVisible(),
  });
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
    destroyBrowser();
    mainWindow = undefined;
  });
}

ipcMain.handle("runtime_call", (_event, payload) => {
  const { method, params } = payload || {};
  return runtimeCall(method, params);
});

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

  const base = RUNTIME_URL.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
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

ipcMain.handle("browser_show", (_event, payload) => {
  const rect = payload?.rect;
  console.log("[desktop] browser_show", { rect }, {
    attached: browserViewAttached,
  });
  showBrowser(rect);
  return { ok: true };
});

ipcMain.handle("browser_move", (_event, payload) => {
  const rect = payload?.rect;
  console.log("[desktop] browser_move", { rect }, {
    hasView: Boolean(browserView),
    attached: browserViewAttached,
  });
  if (!browserView || !rect) return { ok: false };
  setBrowserBounds(rect);
  return { ok: true };
});

ipcMain.handle("browser_hide", () => {
  hideBrowser();
  return { ok: true };
});

ipcMain.handle("browser_destroy", () => {
  destroyBrowser();
  return { ok: true };
});

ipcMain.handle("browser_status", () => browserState());

ipcMain.handle("browser_claim_human", () => {
  browserOwner = "human";
  sendBrowserStatus();
  return browserState();
});

ipcMain.handle("browser_release_model", () => {
  browserOwner = "model";
  browserSecureInput = false;
  sendBrowserStatus();
  return browserState();
});

ipcMain.handle("browser_share", () => {
  browserOwner = "shared";
  browserSecureInput = false;
  sendBrowserStatus();
  return browserState();
});

ipcMain.handle("browser_begin_secure_input", () => {
  browserOwner = "human";
  browserSecureInput = true;
  sendBrowserStatus();
  return browserState();
});

ipcMain.handle("browser_end_secure_input", () => {
  browserSecureInput = false;
  sendBrowserStatus();
  return browserState();
});

async function browser_navigate(payload) {
  const url = payload?.url;
  if (!url) throw new Error("missing url");
  persistBrowserUrl(url);
  const view = ensureBrowserView();
  await view.webContents.loadURL(url);
  return { ok: true };
}

async function browser_read_dom() {
  const view = browserView || ensureBrowserView();
  return await view.webContents.executeJavaScript("document.documentElement.outerHTML");
}

async function browser_click(payload) {
  const view = browserView || ensureBrowserView();
  const x = Number(payload?.x);
  const y = Number(payload?.y);
  return await view.webContents.executeJavaScript(
    `JSON.stringify((()=>{const e=document.elementFromPoint(${x},${y}); if(e){e.click(); return 'ok';} return 'no_element';})())`
  );
}

async function browser_input(payload) {
  const view = browserView || ensureBrowserView();
  const text = String(payload?.text ?? "");
  const encoded = JSON.stringify(text);
  return await view.webContents.executeJavaScript(
    `JSON.stringify((()=>{const el=document.activeElement; if(!el)return 'no_active'; if(el.value!==undefined)el.value=${encoded}; el.dispatchEvent(new Event('input',{bubbles:true})); return 'ok';})())`
  );
}

async function browser_screenshot() {
  const view = browserView || ensureBrowserView();
  const image = await view.webContents.capturePage();
  return image.toDataURL();
}

function browser_go_back() {
  const view = browserView || ensureBrowserView();
  const history = browserHistory(view.webContents);
  if (!history.canGoBack()) return { ok: false };
  history.goBack();
  return { ok: true };
}

function browser_go_forward() {
  const view = browserView || ensureBrowserView();
  const history = browserHistory(view.webContents);
  if (!history.canGoForward()) return { ok: false };
  history.goForward();
  return { ok: true };
}

function browser_reload() {
  const view = browserView || ensureBrowserView();
  view.webContents.reload();
  return { ok: true };
}

ipcMain.handle("browser_navigate", (_event, payload) => browser_navigate(payload));
ipcMain.handle("browser_read_dom", () => browser_read_dom());
ipcMain.handle("browser_click", (_event, payload) => browser_click(payload));
ipcMain.handle("browser_input", (_event, payload) => browser_input(payload));
ipcMain.handle("browser_screenshot", () => browser_screenshot());
ipcMain.handle("browser_go_back", () => browser_go_back());
ipcMain.handle("browser_go_forward", () => browser_go_forward());
ipcMain.handle("browser_reload", () => browser_reload());

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
    if (req.method === "POST" && req.url === "/browser/navigate") {
      assertModelMayMutate();
      console.log("[desktop] bridge /browser/navigate", input.url);
      await browser_navigate({ url: String(input.url || "") });
      send(200, { ok: true });
    } else if (req.method === "POST" && req.url === "/browser/read") {
      if (browserSecureInput) throw new Error("browser is in secure input; model reads are paused");
      console.log("[desktop] bridge /browser/read");
      const text = await browser_read_dom();
      send(200, { text });
    } else if (req.method === "POST" && req.url === "/browser/click") {
      assertModelMayMutate();
      console.log("[desktop] bridge /browser/click", input.x, input.y);
      const result = await browser_click({ x: Number(input.x), y: Number(input.y) });
      send(200, { result });
    } else if (req.method === "POST" && req.url === "/browser/input") {
      assertModelMayMutate();
      console.log("[desktop] bridge /browser/input");
      const result = await browser_input({ text: String(input.text || "") });
      send(200, { result });
    } else if (req.method === "POST" && req.url === "/browser/screenshot") {
      if (browserSecureInput) throw new Error("browser is in secure input; model screenshots are paused");
      console.log("[desktop] bridge /browser/screenshot");
      const data = await browser_screenshot();
      send(200, { data });
    } else {
      send(404, { error: `unknown bridge route ${req.method} ${req.url}` });
    }
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

app.whenReady().then(() => {
  app.userAgentFallback =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  loadPersistedBrowserUrl();
  createMainWindow();
  streamRuntimeEvents();
  startBrowserBridge();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
