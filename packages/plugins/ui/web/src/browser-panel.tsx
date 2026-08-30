import { createSignal, createEffect, Show } from "solid-js";
import type { AppState } from "@natalia/view-store";

export function BrowserPanel(props: { state: AppState }) {
  const [url, setUrl] = createSignal("https://example.com");
  const [current, setCurrent] = createSignal("https://example.com");
  const [history, setHistory] = createSignal<string[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(0);

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
  }

  function forward() {
    const idx = historyIndex() + 1;
    if (idx >= history().length) return;
    setHistoryIndex(idx);
    const target = history()[idx]!;
    setUrl(target);
    setCurrent(target);
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
      <iframe
        class="browser-frame"
        src={current()}
        title="Natalia Browser"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        loading="lazy"
      />
    </div>
  );
}
