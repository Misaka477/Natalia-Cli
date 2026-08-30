import { createSignal, Show } from "solid-js";

export function BrowserPanel() {
  const [url, setUrl] = createSignal("https://example.com");
  const [current, setCurrent] = createSignal("https://example.com");
  const [history, setHistory] = createSignal<string[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(0);

  function navigate(next: string) {
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
        <button type="button" class="browser-nav-btn" onClick={() => navigate(current())} title="刷新">⟳</button>
        <form class="browser-url-form" onSubmit={(event) => {
          event.preventDefault();
          navigate(url());
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
      />
    </div>
  );
}
