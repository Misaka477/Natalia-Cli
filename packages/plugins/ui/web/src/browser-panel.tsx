import { createSignal, Show, onMount, onCleanup } from "solid-js";
import type { AppState } from "@natalia/view-store";

type ElectronGlobal = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  on<T>(channel: string, listener: (payload: T) => void): () => void;
};

type BrowserOwner = "model" | "human" | "shared";

type BrowserStatus = {
  url?: string;
  loading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  error?: string | null;
  owner?: BrowserOwner;
  secureInput?: boolean;
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

function ownerLabel(owner: BrowserOwner) {
  if (owner === "human") return "人工控制";
  if (owner === "model") return "模型控制";
  return "共享";
}

export function BrowserPanel(_props: { state: AppState }) {
  const [url, setUrl] = createSignal("");
  const [current, setCurrent] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [canGoBack, setCanGoBack] = createSignal(false);
  const [canGoForward, setCanGoForward] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [owner, setOwner] = createSignal<BrowserOwner>("shared");
  const [secureInput, setSecureInput] = createSignal(false);
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
    if (payload.owner) setOwner(payload.owner);
    if (typeof payload.secureInput === "boolean") setSecureInput(payload.secureInput);
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
    void desktop
      .invoke("browser_move", { rect })
      .catch((err) => electron?.log("[browser-panel] move failed", err));
  }

  onMount(() => {
    if (!desktop || !host) return;
    urlUnlisten = electron?.on<{ url: string }>("browser-url-changed", (payload) => {
      setUrl(payload.url);
      setCurrent(payload.url);
    });
    statusUnlisten = electron?.on<BrowserStatus>("browser-status", (payload) => {
      applyStatus(payload);
    });
    const rect = browserRect();
    if (rect) {
      void desktop
        .invoke("browser_show", { rect })
        .then(() => desktop.invoke<BrowserStatus>("browser_status"))
        .then((status) => applyStatus(status ?? {}))
        .catch((err) => electron?.log("[browser-panel] show failed", err));
    }
    resizeObserver = new ResizeObserver(() => syncBrowserWindow());
    resizeObserver.observe(host);
    window.addEventListener("resize", syncBrowserWindow);
  });

  onCleanup(() => {
    if (desktop) {
      void desktop
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
      void desktop
        .invoke("browser_navigate", { url: normalized })
        .catch((err) => {
          setLoading(false);
          setError(err instanceof Error ? err.message : String(err));
          electron?.log("[browser-panel] navigate failed", err);
        });
    }
  }

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

  function claimHuman() {
    if (!desktop) return;
    void desktop
      .invoke<BrowserStatus>("browser_claim_human")
      .then(applyStatus)
      .catch((err) => electron?.log("[browser-panel] claim failed", err));
  }

  function releaseModel() {
    if (!desktop) return;
    void desktop
      .invoke<BrowserStatus>("browser_release_model")
      .then(applyStatus)
      .catch((err) => electron?.log("[browser-panel] release failed", err));
  }

  function shareControl() {
    if (!desktop) return;
    void desktop
      .invoke<BrowserStatus>("browser_share")
      .then(applyStatus)
      .catch((err) => electron?.log("[browser-panel] share failed", err));
  }

  function toggleSecureInput() {
    if (!desktop) return;
    const command = secureInput() ? "browser_end_secure_input" : "browser_begin_secure_input";
    void desktop
      .invoke<BrowserStatus>(command)
      .then(applyStatus)
      .catch((err) => electron?.log("[browser-panel] secure input failed", err));
  }

  return (
    <div class="browser-pane">
      <div class="browser-toolbar">
        <button type="button" class="browser-nav-btn" onClick={back} disabled={!canGoBack()} title="后退">←</button>
        <button type="button" class="browser-nav-btn" onClick={forward} disabled={!canGoForward()} title="前进">→</button>
        <button type="button" class="browser-nav-btn" onClick={reload} title="刷新">⟳</button>
        <span class="terminal-owner-badge" data-owner={owner()}>{ownerLabel(owner())}</span>
        <Show when={owner() !== "human"}>
          <button type="button" class="browser-nav-btn browser-owner-btn" onClick={claimHuman} title="接管浏览器">接管</button>
        </Show>
        <Show when={owner() === "human"}>
          <button type="button" class="browser-nav-btn browser-owner-btn" onClick={releaseModel} title="交还模型控制">交还模型</button>
          <button type="button" class="browser-nav-btn browser-owner-btn" onClick={toggleSecureInput} title={secureInput() ? "结束安全输入" : "开始安全输入"}>
            {secureInput() ? "结束安全输入" : "安全输入"}
          </button>
        </Show>
        <Show when={owner() !== "shared"}>
          <button type="button" class="browser-nav-btn browser-owner-btn" onClick={shareControl} title="共享控制">共享</button>
        </Show>
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
      <Show when={owner() === "human" || secureInput()}>
        <div class="browser-pause-hint">
          {secureInput() ? "安全输入中，模型读写已暂停" : "人工控制中，模型写入已暂停"}
        </div>
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
