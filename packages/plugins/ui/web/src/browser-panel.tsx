import { createSignal, createEffect, Show } from "solid-js";
import type { AppState } from "@natalia/view-store";

export function BrowserPanel(props: { state: AppState }) {
  const [url, setUrl] = createSignal("https://example.com");
  const [history, setHistory] = createSignal<string[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(0);

  function open(next: string) {
    let normalized = next.trim();
    if (!normalized) return;
    if (!/^https?:\/\//u.test(normalized)) normalized = `https://${normalized}`;
    const h = history();
    const before = h.slice(0, historyIndex() + 1);
    before.push(normalized);
    setHistory(before);
    setHistoryIndex(before.length - 1);
    setUrl(normalized);
    window.open(normalized, "_blank", "noopener,noreferrer");
  }

  let lastHandledTool = "";

  // Model browser tools update the URL bar. We do not embed heavy pages in an
  // iframe; opening in a separate tab keeps the Natalia UI from freezing.
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
        setUrl(normalized);
      }
    } catch {
      // argument text may be partial; ignore
    }
  });

  function back() {
    const idx = historyIndex() - 1;
    if (idx < 0) return;
    setHistoryIndex(idx);
    setUrl(history()[idx]!);
  }

  function forward() {
    const idx = historyIndex() + 1;
    if (idx >= history().length) return;
    setHistoryIndex(idx);
    setUrl(history()[idx]!);
  }

  return (
    <div class="browser-pane">
      <div class="browser-toolbar">
        <button type="button" class="browser-nav-btn" onClick={back} disabled={historyIndex() <= 0} title="后退">←</button>
        <button type="button" class="browser-nav-btn" onClick={forward} disabled={historyIndex() >= history().length - 1} title="前进">→</button>
        <form class="browser-url-form" onSubmit={(event) => {
          event.preventDefault();
          open(url());
        }}>
          <input
            class="browser-url-input"
            value={url()}
            placeholder="输入 URL，例如 https://example.com"
            onInput={(event) => setUrl(event.currentTarget.value)}
          />
        </form>
        <button type="button" class="browser-open-btn" onClick={() => open(url())}>
          打开
        </button>
      </div>
      <div class="browser-empty">
        <div class="browser-empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5" />
            <path d="M16 24C16 19.5817 19.5817 16 24 16C28.4183 16 32 19.5817 32 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M8 24H40" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <div class="browser-empty-text">
          浏览器页面在新标签页打开，避免 iframe 导致 Natalia UI 卡死。
        </div>
      </div>
    </div>
  );
}
