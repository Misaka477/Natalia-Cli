import { createSignal, createEffect, Show, onMount, onCleanup } from "solid-js";
import type { AppState } from "@natalia/view-store";

type ElectronGlobal = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  on<T>(channel: string, listener: (payload: T) => void): () => void;
};

function getElectronGlobal(): ElectronGlobal | undefined {
  return (globalThis as { electron?: ElectronGlobal }).electron;
}

type BrowserRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function BrowserPanel(props: { state: AppState }) {
  const [url, setUrl] = createSignal("");
  const [current, setCurrent] = createSignal("");
  const [history, setHistory] = createSignal<string[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(0);
  let host: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let urlUnlisten: (() => void) | undefined;
  const electron = getElectronGlobal();
  const desktop = electron;

  function browserRect(): BrowserRect | undefined {
    if (!host) return undefined;
    const rect = host.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  function syncBrowserWindow() {
    if (!desktop) return;
    const rect = browserRect();
    if (!rect) return;
    electron?.log("[browser-panel] move rect", rect, {
      dpr: window.devicePixelRatio,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    });
    void desktop!
      .invoke("browser_move", { rect })
      .catch((error) => electron?.log("[browser-panel] move failed", error));
  }

  onMount(() => {
    if (!desktop || !host) return;
    urlUnlisten = electron?.on<{ url: string }>("browser-url-changed", (payload) => {
      console.log("[browser-panel] url changed", payload.url);
      setUrl(payload.url);
      setCurrent(payload.url);
    });
    const rect = browserRect();
    electron?.log("[browser-panel] show rect", rect, {
      dpr: window.devicePixelRatio,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    });
    if (rect) {
      void desktop!
        .invoke("browser_show", { rect })
        .catch((error) => electron?.log("[browser-panel] show failed", error));
    }
    resizeObserver = new ResizeObserver(() => syncBrowserWindow());
    resizeObserver.observe(host);
    window.addEventListener("resize", syncBrowserWindow);
  });

  onCleanup(() => {
    if (desktop) {
      void desktop!
        .invoke("browser_hide")
        .catch((error) => electron?.log("[browser-panel] hide failed", error));
    }
    urlUnlisten?.();
    resizeObserver?.disconnect();
    window.removeEventListener("resize", syncBrowserWindow);
  });

  function load(next: string) {
    let normalized = next.trim();
    if (!normalized) return;
    if (!/^https?:\/\//u.test(normalized)) normalized = `https://${normalized}`;
    const h = history();
    const before = h.slice(0, historyIndex() + 1);
    before.push(normalized);
    setHistory(before);
    setHistoryIndex(before.length - 1);
    setUrl(normalized);
    setCurrent(normalized);
    if (desktop) {
      void desktop!
        .invoke("browser_navigate", { url: normalized })
        .catch((error) => electron?.log("[browser-panel] navigate failed", error));
    }
  }

  let lastHandledTool = "";

  // Model browser tools automatically load the target once per tool call.
  // The dedup guard prevents repeated navigation on every state update.
  createEffect(() => {
    const tools = props.state.tools ?? {};
    const entries = Object.values(tools);
    const browserTool = [...entries]
      .reverse()
      .find((tool) =>
        ["browser_visit", "browser_screenshot", "web_fetch"].includes(tool.name),
      );
    if (!browserTool || browserTool.status === "failed") return;
    const key = `${browserTool.name}:${browserTool.callID ?? ""}:${browserTool.status}`;
    if (key === lastHandledTool) return;
    lastHandledTool = key;
    const raw = browserTool.argumentsRaw || "";
    try {
      const args = JSON.parse(raw) as Record<string, unknown>;
      const target =
        typeof args.url === "string"
          ? args.url
          : typeof args.src === "string"
            ? args.src
            : undefined;
      if (target) {
        let normalized = target.trim();
        if (!/^https?:\/\//u.test(normalized)) normalized = `https://${normalized}`;
        load(normalized);
      }
    } catch {
      // argument text may be partial; ignore
    }
  });

  function back() {
    const idx = historyIndex() - 1;
    if (idx < 0) return;
    setHistoryIndex(idx);
    const target = history()[idx]!;
    setUrl(target);
    setCurrent(target);
    if (desktop) {
      void desktop!
        .invoke("browser_navigate", { url: target })
        .catch((error) => electron?.log("[browser-panel] navigate failed", error));
    }
  }

  function forward() {
    const idx = historyIndex() + 1;
    if (idx >= history().length) return;
    setHistoryIndex(idx);
    const target = history()[idx]!;
    setUrl(target);
    setCurrent(target);
    if (desktop) {
      void desktop!
        .invoke("browser_navigate", { url: target })
        .catch((error) => electron?.log("[browser-panel] navigate failed", error));
    }
  }

  return (
    <div class="browser-pane">
      <div class="browser-toolbar">
        <button type="button" class="browser-nav-btn" onClick={back} disabled={historyIndex() <= 0} title="后退">←</button>
        <button type="button" class="browser-nav-btn" onClick={forward} disabled={historyIndex() >= history().length - 1} title="前进">→</button>
        <button type="button" class="browser-nav-btn" onClick={() => current() && load(current())} title="刷新">⟳</button>
        <form class="browser-url-form" onSubmit={(event) => {
          event.preventDefault();
          load(url());
        }}>
          <input
            class="browser-url-input"
            value={url()}
            placeholder="输入 URL，例如 https://example.com"
            onInput={(event) => setUrl(event.currentTarget.value)}
          />
        </form>
      </div>
      <div class="browser-webview-host" ref={host}>
        <Show when={!desktop}>
          <iframe
            class="browser-frame"
            src={current()}
            title="Natalia Browser"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            loading="lazy"
          />
        </Show>
      </div>
    </div>
  );
}
