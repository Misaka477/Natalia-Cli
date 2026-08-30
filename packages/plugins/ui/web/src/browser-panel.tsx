import { createSignal, createEffect, Show, onMount, onCleanup } from "solid-js";
import type { AppState } from "@natalia/view-store";

type ElectronGlobal = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  on<T>(channel: string, listener: (payload: T) => void): () => void;
};

type BrowserStatus = {
  url?: string;
  loading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  error?: string | null;
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
  const [loading, setLoading] = createSignal(false);
  const [canGoBack, setCanGoBack] = createSignal(false);
  const [canGoForward, setCanGoForward] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let host: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let urlUnlisten: (() => void) | undefined;
  let statusUnlisten: (() => void) | undefined;
  const electron = getElectronGlobal();
  const desktop = electron;

  function applyStatus(payload: BrowserStatus) {
    if (typeof payload.url === "string" && payload.url) {
      setUrl(payload.url);
      setCurrent(payload.url);
    }
    if (typeof payload.loading === "boolean") setLoading(payload.loading);
    if (typeof payload.canGoBack === "boolean") setCanGoBack(payload.canGoBack);
    if (typeof payload.canGoForward === "boolean") setCanGoForward(payload.canGoForward);
    if (payload.error === null) setError(null);
    else if (typeof payload.error === "string") setError(payload.error);
  }

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
      .catch((err) => electron?.log("[browser-panel] move failed", err));
  }

  onMount(() => {
    if (!desktop || !host) return;
    urlUnlisten = electron?.on<{ url: string }>("browser-url-changed", (payload) => {
      console.log("[browser-panel] url changed", payload.url);
      setUrl(payload.url);
      setCurrent(payload.url);
    });
    statusUnlisten = electron?.on<BrowserStatus>("browser-status", (payload) => {
      applyStatus(payload);
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
        .catch((err) => electron?.log("[browser-panel] show failed", err));
    }
    resizeObserver = new ResizeObserver(() => syncBrowserWindow());
    resizeObserver.observe(host);
    window.addEventListener("resize", syncBrowserWindow);
  });

  onCleanup(() => {
    if (desktop) {
      void desktop!
        .invoke("browser_hide")
        .catch((err) => electron?.log("[browser-panel] hide failed", err));
    }
    urlUnlisten?.();
    statusUnlisten?.();
    resizeObserver?.disconnect();
    window.removeEventListener("resize", syncBrowserWindow);
  });

  function load(next: string) {
    let normalized = next.trim();
    if (!normalized) return;
    if (!/^https?:\/\//u.test(normalized)) normalized = `https://${normalized}`;
    setUrl(normalized);
    setCurrent(normalized);
    setLoading(true);
    setError(null);
    if (desktop) {
      void desktop!
        .invoke("browser_navigate", { url: normalized })
        .catch((err) => {
          setLoading(false);
          setError(err instanceof Error ? err.message : String(err));
          electron?.log("[browser-panel] navigate failed", err);
        });
    }
  }

  let lastHandledTool = "";

  createEffect(() => {
    const tools = props.state.tools ?? {};
    const entries = Object.values(tools);
    const browserTool = [...entries]
      .reverse()
      .find((tool) =>
        [
          "browser_visit",
          "browser_screenshot",
          "web_fetch",
          "browser_session_open",
          "browser_session_navigate",
        ].includes(tool.name),
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
    if (!desktop || !canGoBack()) return;
    void desktop
      .invoke("browser_go_back")
      .catch((err) => electron?.log("[browser-panel] back failed", err));
  }

  function forward() {
    if (!desktop || !canGoForward()) return;
    void desktop
      .invoke("browser_go_forward")
      .catch((err) => electron?.log("[browser-panel] forward failed", err));
  }

  function reload() {
    if (desktop) {
      void desktop
        .invoke("browser_reload")
        .catch((err) => electron?.log("[browser-panel] reload failed", err));
      return;
    }
    if (current()) load(current());
  }

  return (
    <div class="browser-pane">
      <div class="browser-toolbar">
        <button type="button" class="browser-nav-btn" onClick={back} disabled={!canGoBack()} title="后退">←</button>
        <button type="button" class="browser-nav-btn" onClick={forward} disabled={!canGoForward()} title="前进">→</button>
        <button type="button" class="browser-nav-btn" onClick={reload} title="刷新">⟳</button>
        <form class="browser-url-form" onSubmit={(event) => {
          event.preventDefault();
          load(url());
        }}>
          <input
            class="browser-url-input"
            classList={{ "browser-url-input-loading": loading() }}
            value={url()}
            placeholder="输入 URL，例如 https://example.com"
            onInput={(event) => setUrl(event.currentTarget.value)}
          />
          <button type="submit" class="browser-load-btn" title="前往">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12H19" />
              <path d="M13 6L19 12L13 18" />
            </svg>
          </button>
        </form>
      </div>
      <Show when={loading()}>
        <div class="browser-loading-bar" aria-hidden="true" />
      </Show>
      <Show when={error()}>
        <div class="browser-error">{error()}</div>
      </Show>
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
