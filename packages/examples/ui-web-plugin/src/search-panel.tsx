import { createSignal, Show, onCleanup, onMount, For } from "solid-js";
import type { RuntimeWorkspaceMatch } from "@natalia/contracts";

const fallbackResults: RuntimeWorkspaceMatch[] = [
  { path: "packages/examples/ui-web-plugin/src/app-neu.tsx", line: 12, text: "export function AppNeu(props: { ctx: UiPluginContext })" },
  { path: "packages/examples/ui-web-plugin/src/file-editor.tsx", line: 167, text: "export function FileEditor()" },
  { path: "packages/examples/ui-web-plugin/src/settings-panel.tsx", line: 31, text: "const categories: Category[] = [" },
  { path: "packages/examples/ui-web-shell/src/main-neu.ts", line: 1, text: "import { createNataliaNeuPlugin } from" },
];

export function SearchPanel(props: {
  open: boolean;
  onClose: () => void;
  onSearch?: (query: string) => Promise<RuntimeWorkspaceMatch[]> | void;
}) {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<RuntimeWorkspaceMatch[]>(fallbackResults);

  function runSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults(fallbackResults);
      return;
    }
    if (props.onSearch) {
      const promise = props.onSearch(value.trim());
      if (promise && typeof (promise as Promise<RuntimeWorkspaceMatch[]>).then === "function") {
        void (promise as Promise<RuntimeWorkspaceMatch[]>).then(setResults);
      }
    } else {
      setResults(fallbackResults);
    }
  }

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => window.removeEventListener("keydown", handleKeydown));
  });

  return (
    <Show when={props.open}>
      <div class="neu-settings-backdrop" onClick={props.onClose}>
        <div class="neu-search-window" onClick={(event) => event.stopPropagation()}>
          <div class="neu-settings-header">
            <span class="neu-settings-title">搜索工作区</span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭搜索"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
          <div class="neu-search-body">
            <input
              class="neu-form-input neu-search-input"
              value={query()}
              placeholder="正则表达式搜索，例如 createSignal|FileEditor"
              onInput={(event) => runSearch(event.currentTarget.value)}
            />
            <div class="neu-search-results">
              <For each={results()}>
                {(result) => (
                  <button type="button" class="neu-search-result">
                    <span class="neu-search-path">
                      {result.path}:{result.line}
                    </span>
                    <span class="neu-search-snippet">{result.text}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
