import { displayText, type MessageBlock } from "@natalia/view-store";
import { For, Show, type JSX } from "solid-js";

const labels: Record<MessageBlock["role"], string> = {
  user: "You",
  assistant: "Natalia",
  thinking: "Thinking",
  system: "System",
  tool: "Tool",
};
const initials: Record<MessageBlock["role"], string> = {
  user: "Y",
  assistant: "N",
  thinking: "·",
  system: "S",
  tool: "T",
};

export function Transcript(props: {
  messages: MessageBlock[];
  emptyTitle: string;
  emptyHint: string;
}) {
  return (
    <div class="natalia-web__thread">
      <Show
        when={props.messages.length}
        fallback={
          <div class="natalia-web__empty">
            <div>
              <strong>{props.emptyTitle}</strong>
              {props.emptyHint}
            </div>
          </div>
        }
      >
        <For each={props.messages}>
          {(block) => (
            <article
              class={`natalia-web__message natalia-web__message--${block.role}`}
            >
              <span class="natalia-web__avatar">{initials[block.role]}</span>
              <div class="natalia-web__bubble">
                <header>{labels[block.role]}</header>
                <pre>{displayText(block)}</pre>
              </div>
            </article>
          )}
        </For>
      </Show>
    </div>
  );
}

export function Composer(props: {
  value: string;
  placeholder: string;
  busy: boolean;
  onInput(value: string): void;
  onSubmit(): void;
  onStop(): void;
  children?: JSX.Element;
}) {
  return (
    <form
      class="natalia-web__composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (props.busy) props.onStop();
        else props.onSubmit();
      }}
    >
      <textarea
        value={props.value}
        placeholder={props.placeholder}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (props.busy) props.onStop();
            else props.onSubmit();
          }
        }}
      />
      <div class="natalia-web__bar">
        {props.children}
        <button
          class="natalia-web__send"
          type="submit"
          data-kind={props.busy ? "stop" : undefined}
        >
          {props.busy ? "Stop" : "Send"}
        </button>
      </div>
    </form>
  );
}
