const { BrowserView, session } = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAX_TABS = 8;
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;
const MUTATING_ACTIONS = new Set(["navigate", "click", "input", "execute_js"]);

const SCAN_JS = String.raw`(function (opt) {
  const textOnly = !!opt.textOnly;
  const maxlen = Number(opt.maxlen) || 35000;
  const SKIP = new Set(["SCRIPT","STYLE","NOSCRIPT","META","LINK","TEMPLATE","SVG"]);
  function clean(src, dst) {
    const out = dst.cloneNode(false);
    if (src.tagName === "INPUT" && src.value !== undefined) out.setAttribute("value", src.value);
    if (src.tagName === "TEXTAREA" && src.value !== undefined) out.textContent = src.value;
    if (src.tagName === "SELECT") out.setAttribute("data-selected", src.value || "");
    if (src.tagName === "INPUT" && src.checked) out.setAttribute("checked", "");
    for (const child of src.childNodes) {
      if (child.nodeType === 3) {
        out.appendChild(document.createTextNode(child.textContent || ""));
      } else if (child.nodeType === 1) {
        if (SKIP.has(child.tagName)) continue;
        if (child.getAttribute("aria-hidden") === "true") continue;
        const r = child.getBoundingClientRect();
        const s = window.getComputedStyle(child);
        if (r.width <= 0 || r.height <= 0 || s.display === "none" || s.visibility === "hidden" || (Number(s.opacity) === 0)) continue;
        const childClone = clean(child, child.cloneNode(false));
        const isInteractive = ["INPUT","TEXTAREA","SELECT","BUTTON","A"].includes(child.tagName) || child.getAttribute("role") === "button";
        if (childClone.childNodes.length || isInteractive) out.appendChild(childClone);
      }
    }
    return out;
  }
  const cleaned = clean(document.body, document.createElement("body"));
  const html = cleaned.outerHTML;
  const text = document.body.innerText || "";
  const out = {
    title: document.title,
    url: location.href,
    text: text,
    html: html,
    truncated: false
  };
  if (text.length > maxlen) { out.text = text.slice(0, maxlen); out.truncated = true; }
  if (html.length > maxlen) { out.html = html.slice(0, maxlen); out.truncated = true; }
  return out;
})(__OPTIONS__)`;

function browserHistory(contents) {
  return contents.navigationHistory ?? contents;
}

function tabTitle(url) {
  if (!url || url === "about:blank") return "新标签";
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "") || parsed.href;
  } catch {
    return url.slice(0, 32);
  }
}

function createBrowserHost(options) {
  const getMainWindow = options.getMainWindow;
  const persistFile = options.persistFile;
  const tabs = new Map();
  const pendingApprovals = new Map();
  let activeId;
  let lastRect = { x: 0, y: 0, width: 0, height: 0 };
  let sessionHandlersBound = false;
  let visible = false;

  function persist() {
    const payload = {
      activeId,
      tabs: [...tabs.values()].map((tab) => ({
        id: tab.id,
        url: tab.url,
        owner: tab.owner,
        approvalMode: tab.approvalMode,
      })),
    };
    try {
      fs.mkdirSync(path.dirname(persistFile()), { recursive: true });
      fs.writeFileSync(persistFile(), JSON.stringify(payload));
    } catch (error) {
      console.error("[desktop] failed to persist browser tabs", error);
    }
  }

  function loadPersisted() {
    try {
      const raw = fs.readFileSync(persistFile(), "utf8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function sendStatus(extra = {}) {
    const window = getMainWindow();
    if (!window) return;
    window.webContents.send("browser-status", state(extra));
  }

  function sendUrl(url) {
    const window = getMainWindow();
    window?.webContents.send("browser-url-changed", { url });
  }

  function attach(tab) {
    const window = getMainWindow();
    if (!window || !tab?.view) return;
    for (const other of tabs.values()) {
      if (other.attached && other.id !== tab.id) {
        window.removeBrowserView(other.view);
        other.attached = false;
      }
    }
    if (!tab.attached) {
      window.addBrowserView(tab.view);
      tab.attached = true;
    }
    if (lastRect.width && lastRect.height) tab.view.setBounds(lastRect);
    visible = true;
  }

  function detachAll() {
    const window = getMainWindow();
    if (!window) return;
    for (const tab of tabs.values()) {
      if (tab.attached) {
        window.removeBrowserView(tab.view);
        tab.attached = false;
      }
    }
    visible = false;
  }

  function publicTab(tab) {
    const contents = tab.view?.webContents;
    const history = contents ? browserHistory(contents) : null;
    const url = contents?.getURL() || tab.url || "";
    return {
      id: tab.id,
      url,
      title: tabTitle(url),
      loading: Boolean(contents?.isLoadingMainFrame()),
      canGoBack: Boolean(history?.canGoBack()),
      canGoForward: Boolean(history?.canGoForward()),
      owner: tab.owner,
      approvalMode: tab.approvalMode,
      secureInput: tab.secureInput,
      error: tab.error ?? null,
      active: tab.id === activeId,
    };
  }

  function state(extra = {}) {
    const active = activeId ? tabs.get(activeId) : undefined;
    const snapshot = active ? publicTab(active) : {
      id: "",
      url: "",
      title: "新标签",
      loading: false,
      canGoBack: false,
      canGoForward: false,
      owner: "shared",
      approvalMode: "ask",
      secureInput: false,
      error: null,
      active: false,
    };
    return {
      ...snapshot,
      attached: visible,
      tabs: [...tabs.values()].map(publicTab),
      pendingApproval: pendingApprovals.get(activeId) ? pendingPublic(pendingApprovals.get(activeId)) : null,
      ...extra,
    };
  }

  function pendingPublic(entry) {
    return {
      id: entry.id,
      tabId: entry.tabId,
      action: entry.action,
      summary: entry.summary,
    };
  }

  function browserSession() {
    const browserSessionRef = session.fromPartition("persist:natalia-browser");
    if (!sessionHandlersBound) {
      browserSessionRef.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(permission === "clipboard-sanitized-write" || permission === "fullscreen");
      });
      browserSessionRef.on("will-download", (_event, item) => {
        console.log("[desktop] browser download", item.getFilename(), item.getURL());
      });
      sessionHandlersBound = true;
    }
    return browserSessionRef;
  }

  function bindView(tab) {
    const contents = tab.view.webContents;
    const emitUrl = (url) => {
      tab.url = url;
      if (tab.id === activeId) sendUrl(url);
      persist();
      sendStatus({ url });
    };
    contents.on("did-start-loading", () => {
      tab.error = null;
      sendStatus({ loading: true, error: null });
    });
    contents.on("did-stop-loading", () => sendStatus({ loading: false }));
    contents.on("did-navigate", (_event, url) => emitUrl(url));
    contents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
      if (isMainFrame) emitUrl(url);
    });
    contents.on("did-finish-load", () => {
      tab.error = null;
      sendStatus({ loading: false, error: null });
      if (tab.attached && lastRect.width && lastRect.height) tab.view.setBounds(lastRect);
    });
    contents.on("did-fail-load", (_event, code, desc, url, isMainFrame) => {
      if (!isMainFrame) return;
      tab.error = desc || `load failed (${code})`;
      sendStatus({ loading: false, error: tab.error, url });
    });
    contents.on("render-process-gone", (_event, details) => {
      tab.error = details?.reason || "renderer gone";
      sendStatus({ loading: false, error: tab.error });
    });
  }

  function createTab(initialUrl = "about:blank", id) {
    if (tabs.size >= MAX_TABS) throw new Error(`browser already has ${MAX_TABS} tabs`);
    const tab = {
      id: id || `tab_${crypto.randomUUID()}`,
      url: initialUrl,
      owner: "shared",
      approvalMode: "ask",
      secureInput: false,
      sessionAllow: new Set(),
      attached: false,
      error: null,
      view: new BrowserView({
        webPreferences: {
          session: browserSession(),
          contextIsolation: true,
          sandbox: true,
        },
      }),
    };
    try {
      tab.view.setBorderRadius(12);
    } catch {
      // Linux does not apply BrowserView border radius.
    }
    bindView(tab);
    tabs.set(tab.id, tab);
    if (initialUrl && initialUrl !== "about:blank") {
      void tab.view.webContents.loadURL(initialUrl);
    } else {
      tab.view.webContents.loadURL("about:blank");
    }
    return tab;
  }

  function getTab(id) {
    if (id && id !== "default" && tabs.has(id)) return tabs.get(id);
    const tab = activeId ? tabs.get(activeId) : undefined;
    if (!tab) throw new Error("browser tab not found");
    return tab;
  }

  function activate(id, rect) {
    const tab = getTab(id);
    activeId = tab.id;
    if (rect) setBounds(rect);
    if (visible) attach(tab);
    persist();
    sendUrl(tab.view.webContents.getURL() || tab.url);
    sendStatus();
    return state();
  }

  function setBounds(rect) {
    if (!rect) return;
    lastRect = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    const tab = activeId ? tabs.get(activeId) : undefined;
    if (tab?.attached) tab.view.setBounds(lastRect);
  }

  function show(rect) {
    if (tabs.size === 0) createTab();
    if (!activeId) activeId = [...tabs.keys()][0];
    visible = true;
    activate(activeId, rect);
    const tab = getTab(activeId);
    tab.view.webContents.focus();
    return state();
  }

  function hide() {
    detachAll();
    sendStatus({ attached: false });
    return { ok: true };
  }

  function destroyAll() {
    for (const entry of pendingApprovals.values()) {
      entry.reject(new Error("browser closed"));
    }
    pendingApprovals.clear();
    detachAll();
    for (const tab of tabs.values()) {
      try {
        tab.view.webContents.destroy();
      } catch (error) {
        console.error("[desktop] browser destroy failed", error);
      }
    }
    tabs.clear();
    activeId = undefined;
    sendStatus({ attached: false });
  }

  function closeTab(id) {
    const tab = tabs.get(id);
    if (!tab) return state();
    const pending = pendingApprovals.get(id);
    if (pending) {
      pending.reject(new Error("browser tab closed"));
      pendingApprovals.delete(id);
    }
    const window = getMainWindow();
    if (tab.attached && window) window.removeBrowserView(tab.view);
    try {
      tab.view.webContents.destroy();
    } catch (error) {
      console.error("[desktop] browser tab destroy failed", error);
    }
    tabs.delete(id);
    if (activeId === id) activeId = [...tabs.keys()][0];
    if (tabs.size === 0) {
      const next = createTab();
      activeId = next.id;
    }
    if (visible && activeId) attach(getTab(activeId));
    persist();
    sendStatus();
    return state();
  }

  function restore() {
    const saved = loadPersisted();
    if (!saved?.tabs?.length) return;
    for (const entry of saved.tabs) {
      try {
        const tab = createTab(entry.url || "about:blank", entry.id);
        tab.owner = entry.owner || "shared";
        tab.approvalMode = entry.approvalMode || "ask";
      } catch (error) {
        console.error("[desktop] restore browser tab failed", error);
      }
    }
    if (saved.activeId && tabs.has(saved.activeId)) activeId = saved.activeId;
    else activeId = [...tabs.keys()][0];
  }

  async function navigate(payload) {
    const url = payload?.url;
    if (!url) throw new Error("missing url");
    const tab = payload?.create ? createTab(url) : getTab(payload?.tabId);
    tab.url = url;
    if (payload?.create || payload?.activate !== false) {
      activeId = tab.id;
      if (visible) attach(tab);
    }
    persist();
    await tab.view.webContents.loadURL(url);
    sendStatus();
    return { ok: true, tabId: tab.id, url };
  }

  async function readDom(tabId) {
    const tab = getTab(tabId);
    return await tab.view.webContents.executeJavaScript("document.documentElement.outerHTML");
  }

  async function click(payload) {
    const tab = getTab(payload?.tabId);
    const x = Number(payload?.x);
    const y = Number(payload?.y);
    return await tab.view.webContents.executeJavaScript(
      `JSON.stringify((()=>{const e=document.elementFromPoint(${x},${y}); if(e){e.click(); return 'ok';} return 'no_element';})())`,
    );
  }

  async function input(payload) {
    const tab = getTab(payload?.tabId);
    const encoded = JSON.stringify(String(payload?.text ?? ""));
    return await tab.view.webContents.executeJavaScript(
      `JSON.stringify((()=>{const el=document.activeElement; if(!el)return 'no_active'; if(el.value!==undefined)el.value=${encoded}; el.dispatchEvent(new Event('input',{bubbles:true})); return 'ok';})())`,
    );
  }

  async function screenshot(tabId) {
    const tab = getTab(tabId);
    const image = await tab.view.webContents.capturePage();
    return image.toDataURL();
  }

  function goBack(tabId) {
    const tab = getTab(tabId);
    const history = browserHistory(tab.view.webContents);
    if (!history.canGoBack()) return { ok: false };
    history.goBack();
    return { ok: true };
  }

  function goForward(tabId) {
    const tab = getTab(tabId);
    const history = browserHistory(tab.view.webContents);
    if (!history.canGoForward()) return { ok: false };
    history.goForward();
    return { ok: true };
  }

  function reload(tabId) {
    getTab(tabId).view.webContents.reload();
    return { ok: true };
  }

  function setOwner(owner, tabId) {
    const tab = getTab(tabId);
    tab.owner = owner;
    if (owner !== "human") tab.secureInput = false;
    if (owner === "model") tab.approvalMode = "off";
    if (owner === "shared") tab.approvalMode = "ask";
    persist();
    sendStatus();
    return state();
  }

  function setApprovalMode(mode, tabId) {
    const tab = getTab(tabId);
    tab.approvalMode = mode === "off" ? "off" : "ask";
    persist();
    sendStatus();
    return state();
  }

  function setSecureInput(enabled, tabId) {
    const tab = getTab(tabId);
    tab.owner = "human";
    tab.secureInput = Boolean(enabled);
    persist();
    sendStatus();
    return state();
  }

  function summarize(action, input) {
    if (action === "navigate") return `打开 ${input.url || ""}`;
    if (action === "click") return `点击 (${input.x}, ${input.y})`;
    if (action === "input") return `输入 ${String(input.text || "").slice(0, 80)}`;
    return action;
  }

  function assertNotPaused(tab, action) {
    if (tab.secureInput) throw new Error("browser is in secure input; model writes are paused");
    if (tab.owner === "human") throw new Error("human controls the browser; model writes are paused");
    if (action === "read" || action === "screenshot") return;
  }

  function needsApproval(tab, action) {
    if (!MUTATING_ACTIONS.has(action)) return false;
    if (tab.owner === "human") return false;
    if (tab.sessionAllow.has(action) || tab.sessionAllow.has("*")) return false;
    if (tab.approvalMode === "ask") return true;
    return false;
  }

  function requestApproval(tab, action, input) {
    const existing = pendingApprovals.get(tab.id);
    if (existing) {
      return Promise.reject(new Error("another browser action is waiting for approval"));
    }
    const id = `approval_${crypto.randomUUID()}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingApprovals.delete(tab.id);
        sendStatus();
        reject(new Error("browser action approval timed out"));
      }, APPROVAL_TIMEOUT_MS);
      pendingApprovals.set(tab.id, {
        id,
        tabId: tab.id,
        action,
        input,
        summary: summarize(action, input),
        resolve: (decision) => {
          clearTimeout(timer);
          resolve(decision);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      if (visible) {
        activeId = tab.id;
        attach(tab);
      }
      sendStatus();
    });
  }

  async function authorizeModel(tab, action, input) {
    assertNotPaused(tab, action);
    if (!needsApproval(tab, action)) return "allow";
    const decision = await requestApproval(tab, action, input);
    if (decision === "reject") throw new Error("human rejected the browser action");
    return decision;
  }

  function respondApproval(payload) {
    const tabId = payload?.tabId || activeId;
    const entry = pendingApprovals.get(tabId);
    if (!entry) return state();
    if (payload?.id && payload.id !== entry.id) return state();
    pendingApprovals.delete(tabId);
    const decision = payload?.decision === "session" ? "session" : payload?.decision === "reject" ? "reject" : "once";
    if (decision === "session") {
      const tab = tabs.get(tabId);
      tab?.sessionAllow.add(entry.action);
    }
    entry.resolve(decision);
    sendStatus();
    return state();
  }


  async function executeJS(tabId, script) {
    const tab = getTab(tabId);
    const result = await tab.view.webContents.executeJavaScript(script);
    sendStatus();
    return result;
  }

  async function scan(tabId, options = {}) {
    const tab = getTab(tabId);
    const script = SCAN_JS.replace(
      "__OPTIONS__",
      JSON.stringify({
        textOnly: Boolean(options?.textOnly),
        maxlen: Number(options?.maxlen) || 35000,
      }),
    );
    const result = await tab.view.webContents.executeJavaScript(script);
    return {
      tabId: tab.id,
      url: result.url,
      title: result.title,
      text: result.text,
      html: result.html,
      truncated: result.truncated,
      textOnly: Boolean(options?.textOnly),
    };
  }

  function listTabs() {
    return {
      activeId,
      tabs: [...tabs.values()].map(publicTab),
    };
  }

  async function handleBridge(action, input) {
    const tabId = input.sessionID || input.tabId;
    if (action === "open") {
      const policy = activeId
        ? getTab(activeId)
        : {
            id: activeId || "pending",
            owner: "shared",
            approvalMode: "ask",
            secureInput: false,
            sessionAllow: new Set(),
          };
      await authorizeModel(policy, "navigate", { url: input.url });
      const tab = createTab(String(input.url || "about:blank"));
      tab.owner = policy.owner;
      tab.approvalMode = policy.approvalMode;
      tab.sessionAllow = new Set(policy.sessionAllow);
      activeId = tab.id;
      if (visible) attach(tab);
      persist();
      sendStatus();
      return { ok: true, tabId: tab.id, sessionID: tab.id, url: input.url };
    }
    if (action === "tabs") return listTabs();
    const tab = getTab(tabId);
    if (action === "navigate") {
      await authorizeModel(tab, "navigate", input);
      if (visible) {
        activeId = tab.id;
        attach(tab);
      }
      await tab.view.webContents.loadURL(String(input.url || ""));
      sendStatus();
      return { ok: true, tabId: tab.id, url: input.url };
    }
    if (action === "read") {
      assertNotPaused(tab, "read");
      return { text: await readDom(tab.id) };
    }
    if (action === "scan") {
      assertNotPaused(tab, "read");
      return await scan(tab.id, input);
    }
    if (action === "execute_js") {
      const beforeTabIds = new Set([...tabs.values()].map((item) => item.id));
      let beforeText = "";
      try {
        beforeText = (await scan(tab.id, { textOnly: true, maxlen: 12000 })).text;
      } catch {
        beforeText = "";
      }
      await authorizeModel(tab, "execute_js", input);
      const result = await executeJS(tab.id, String(input.script || ""));
      let afterText = "";
      try {
        afterText = (await scan(tab.id, { textOnly: true, maxlen: 12000 })).text;
      } catch {
        afterText = "";
      }
      const newTabs = [...tabs.values()]
        .filter((item) => !beforeTabIds.has(item.id))
        .map((item) => ({ id: item.id, url: item.view.webContents.getURL() || item.url }));
      return {
        result,
        tabId: tab.id,
        diff: {
          changed: beforeText !== afterText,
          beforeLength: beforeText.length,
          afterLength: afterText.length,
        },
        newTabs,
      };
    }
    if (action === "click") {
      await authorizeModel(tab, "click", input);
      const result = await click({ tabId: tab.id, x: input.x, y: input.y });
      sendStatus();
      return { result, tabId: tab.id };
    }
    if (action === "input") {
      await authorizeModel(tab, "input", input);
      const result = await input({ tabId: tab.id, text: input.text });
      sendStatus();
      return { result, tabId: tab.id };
    }
    if (action === "screenshot") {
      assertNotPaused(tab, "screenshot");
      return { data: await screenshot(tab.id), tabId: tab.id };
    }
    throw new Error(`unknown browser action ${action}`);
  }

  return {
    restore,
    state,
    show,
    hide,
    move: (rect) => {
      setBounds(rect);
      return { ok: true };
    },
    destroy: destroyAll,
    createTab: (url) => {
      const tab = createTab(url);
      return activate(tab.id);
    },
    closeTab,
    activate,
    navigate,
    readDom,
    click,
    input,
    screenshot,
    goBack,
    goForward,
    reload,
    setOwner,
    setApprovalMode,
    setSecureInput,
    executeJS,
    scan,
    listTabs,
    respondApproval,
    handleBridge,
  };
}

module.exports = { createBrowserHost, MAX_TABS };
