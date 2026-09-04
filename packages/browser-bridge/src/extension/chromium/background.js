// Natalia Browser Bridge extension (Chromium).
// Connects to the local @natalia/browser-bridge server and executes commands
// against the user's existing Chrome/Edge browser.

const BRIDGE_URL = "ws://127.0.0.1:18765";
function normalizeTabId(tabId) {
  if (tabId == null || tabId === "") return undefined;
  const id = Number(tabId);
  return Number.isInteger(id) ? id : undefined;
}

let socket = null;

function connect() {
  try {
    socket = new WebSocket(BRIDGE_URL);
    socket.onopen = () => console.log("[natalia-browser-bridge] connected");
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      void handle(message);
    };
    socket.onclose = () => {
      socket = null;
      setTimeout(connect, 1000);
    };
    socket.onerror = () => {
      socket?.close();
    };
  } catch (error) {
    console.error("[natalia-browser-bridge] connect failed", error);
    setTimeout(connect, 1000);
  }
}

function respond(message, result, error) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ id: message.id, result, error }));
}

async function activeTab(tabId) {
  const normalized = normalizeTabId(tabId);
  if (normalized) return normalized;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("no active browser tab");
  return tab.id;
}

async function scan(tabId) {
  const id = await activeTab(tabId);
  const results = await chrome.scripting.executeScript({
    target: { tabId: id },
    func: () => {
      const text = document.body?.innerText || "";
      const html = document.body?.innerHTML || "";
      const title = document.title;
      const url = location.href;
      return {
        text: text.slice(0, 35000),
        html: html.slice(0, 35000),
        title,
        url,
        truncated: text.length > 35000 || html.length > 35000,
      };
    },
  });
  return results[0]?.result || { text: "", html: "", title: "", url: "" };
}

async function attachDebugger(tabId) {
  const id = await activeTab(tabId);
  try {
    await chrome.debugger.attach({ tabId: id }, "1.3");
  } catch (error) {
    // already attached is fine
  }
  return id;
}

async function detachDebugger(tabId) {
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // already detached
  }
}

async function evaluate(expression, tabId) {
  const id = await attachDebugger(tabId);
  try {
    const wrapped = /^\s*return\b/u.test(expression)
      ? `(() => { ${expression} })()`
      : expression;
    const response = await chrome.debugger.sendCommand(
      { tabId: id },
      "Runtime.evaluate",
      { expression: wrapped, returnByValue: true, awaitPromise: true },
    );
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text || "JS evaluation failed");
    }
    return response.result?.value;
  } finally {
    await detachDebugger(id);
  }
}

async function handle(message) {
  const { action, payload = {} } = message;
  try {
    let result;
    switch (action) {
      case "tabs": {
        const tabs = await chrome.tabs.query({});
        result = {
          activeId: tabs.find((tab) => tab.active)?.id,
          tabs: tabs.map((tab) => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
            active: tab.active,
          })),
        };
        break;
      }
      case "open": {
        const tab = await chrome.tabs.create({ url: payload.url || "about:blank" });
        result = { ok: true, tabId: tab.id, url: tab.url };
        break;
      }
      case "navigate": {
        const id = normalizeTabId(payload.tabId) || await activeTab();
        const targetUrl = new URL(String(payload.url || "")).href;
        await chrome.tabs.update(id, { url: targetUrl });
        let tab = await chrome.tabs.get(id);
        for (let i = 0; i < 50; i += 1) {
          if (tab.status !== "loading" && tab.url === targetUrl) break;
          if (tab.url && tab.url !== "about:blank" && tab.url === targetUrl) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
          tab = await chrome.tabs.get(id);
        }
        result = {
          ok: true,
          tabId: tab.id,
          requestedUrl: targetUrl,
          currentUrl: tab.url,
        };
        break;
      }
      case "scan": {
        result = await scan(payload.tabId);
        break;
      }
      case "read": {
        const id = await activeTab(payload.tabId);
        const results = await chrome.scripting.executeScript({
          target: { tabId: id },
          func: () => document.documentElement.outerHTML,
        });
        result = { text: results[0]?.result || "" };
        break;
      }
      case "execute_js": {
        const value = await evaluate(String(payload.script || ""), payload.tabId);
        result = { result: value, tabId: payload.tabId };
        break;
      }
      case "click": {
        const x = Number(payload.x);
        const y = Number(payload.y);
        result = await evaluate(
          `(() => { const el = document.elementFromPoint(${x},${y}); if (el) { el.click(); return "ok"; } return "no_element"; })()`,
          payload.tabId,
        );
        result = { result, tabId: payload.tabId };
        break;
      }
      case "input": {
        const text = JSON.stringify(String(payload.text || ""));
        result = await evaluate(
          `(() => { const el = document.activeElement; if (!el) return "no_active"; if (el.value !== undefined) el.value = ${text}; el.dispatchEvent(new Event("input", {bubbles:true})); return "ok"; })()`,
          payload.tabId,
        );
        result = { result, tabId: payload.tabId };
        break;
      }
      case "screenshot": {
        const id = await attachDebugger(payload.tabId);
        try {
          const shot = await chrome.debugger.sendCommand(
            { tabId: id },
            "Page.captureScreenshot",
            { format: "png", fromSurface: true },
          );
          result = { data: `data:image/png;base64,${shot.data}` };
        } finally {
          await detachDebugger(id);
        }
        break;
      }
      default:
        throw new Error(`unknown browser action: ${action}`);
    }
    respond(message, result);
  } catch (error) {
    respond(message, undefined, error instanceof Error ? error.message : String(error));
  }
}

connect();
