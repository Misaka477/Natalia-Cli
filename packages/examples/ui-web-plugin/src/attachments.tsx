import { For, Show } from "solid-js";

export function AttachmentRow(props: {
  items: string[];
  onAdd(): void;
  onRemove(path: string): void;
  onPaste(event: ClipboardEvent): void;
}) {
  return (
    <div class="natalia-web__bar">
      <button
        type="button"
        data-kind="ghost"
        onClick={props.onAdd}
        onPaste={props.onPaste}
      >
        Attach
      </button>
      <Show when={props.items.length}>
        <div class="natalia-web__chips">
          <For each={props.items}>
            {(path) => (
              <span class="natalia-web__chip">
                {path.split("/").at(-1)}
                <button type="button" onClick={() => props.onRemove(path)}>
                  ×
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
