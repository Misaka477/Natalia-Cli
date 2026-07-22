import type { TextareaRenderable } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import {
  runtimeSlashCommands,
  type RuntimeWorkspaceFileEntry,
} from "@natalia/contracts";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { useModeStack } from "../modal/mode-stack";
import { useKeybinds } from "../context/keybind";
import { darkTheme } from "../theme/theme";

export function slashAutocompleteQuery(text: string) {
  if (!/^\/\S*$/u.test(text)) return undefined;
  return text.slice(1).toLowerCase();
}

export function slashAutocompleteOptions(text: string) {
  const query = slashAutocompleteQuery(text);
  if (query === undefined) return [];
  return runtimeSlashCommands.filter(
    (command) =>
      command.name.includes(query) ||
      command.description.toLowerCase().includes(query),
  );
}

export function mentionAutocompleteQuery(text: string) {
  return text.match(/(?:^|\s)@(\S*)$/u)?.[1];
}

export function PromptAutocomplete(props: {
  input(): TextareaRenderable | undefined;
  text(): string;
  workspaceFiles?(input: {
    query?: string;
    limit?: number;
  }): Promise<RuntimeWorkspaceFileEntry[]>;
  attach(path: string): void;
}) {
  const modeStack = useModeStack();
  const keybinds = useKeybinds();
  const [selected, setSelected] = createSignal(0);
  const [dismissed, setDismissed] = createSignal<string>();
  const slashQuery = createMemo(() => slashAutocompleteQuery(props.text()));
  const mentionQuery = createMemo(() => mentionAutocompleteQuery(props.text()));
  const [files] = createResource(mentionQuery, async (query) => {
    if (query === undefined || !props.workspaceFiles) return [];
    return (await props.workspaceFiles({ query, limit: 20 })).filter(
      (entry) => entry.type === "file",
    );
  });
  const options = createMemo(() =>
    slashQuery() !== undefined
      ? slashAutocompleteOptions(props.text()).map((command) => ({
          kind: "slash" as const,
          command,
        }))
      : (files() ?? []).map((file) => ({ kind: "mention" as const, file })),
  );
  const visible = createMemo(
    () =>
      (slashQuery() !== undefined || mentionQuery() !== undefined) &&
      dismissed() !== props.text(),
  );

  createEffect(() => {
    if (!visible()) return;
    const pop = modeStack.push("autocomplete");
    onCleanup(pop);
  });
  createEffect(() => {
    options();
    setSelected(0);
  });

  function move(direction: -1 | 1) {
    const items = options();
    if (!items.length) return;
    setSelected(
      (current) => (current + direction + items.length) % items.length,
    );
  }

  function select() {
    const item = options()[selected()];
    const input = props.input();
    if (!item || !input) return;
    const text =
      item.kind === "slash"
        ? `/${item.command.name}${item.command.acceptsArguments ? " " : ""}`
        : props.text().replace(/@(\S*)$/u, `@${item.file.path} `);
    setDismissed(text);
    if (item.kind === "mention") props.attach(item.file.path);
    input.setText(text);
    input.gotoBufferEnd();
  }

  useBindings(() => ({
    mode: "autocomplete",
    target: props.input,
    enabled: visible,
    priority: 2,
    bindings: [
      ...keybinds.bindings("prompt.autocomplete.prev", ["up"]).map((key) => ({
        key,
        desc: "Previous completion",
        group: "Autocomplete",
        cmd: () => move(-1),
      })),
      ...keybinds.bindings("prompt.autocomplete.next", ["down"]).map((key) => ({
        key,
        desc: "Next completion",
        group: "Autocomplete",
        cmd: () => move(1),
      })),
      ...keybinds
        .bindings("prompt.autocomplete.select", ["return"])
        .map((key) => ({
          key,
          desc: "Select completion",
          group: "Autocomplete",
          cmd: select,
        })),
      ...keybinds
        .bindings("prompt.autocomplete.hide", ["escape"])
        .map((key) => ({
          key,
          desc: "Hide completions",
          group: "Autocomplete",
          cmd: () => props.input()?.clear(),
        })),
    ],
  }));

  return (
    <Show when={visible()}>
      <box
        border={true}
        borderColor={darkTheme.muted}
        paddingLeft={1}
        paddingRight={1}
        maxHeight={6}
      >
        <For
          each={options()}
          fallback={<text fg={darkTheme.muted}>No matching commands</text>}
        >
          {(item, index) => (
            <box
              backgroundColor={
                index() === selected() ? darkTheme.accent : undefined
              }
            >
              <text
                fg={
                  index() === selected() ? darkTheme.background : darkTheme.text
                }
              >
                {item.kind === "slash"
                  ? `/${item.command.name}`
                  : `@${item.file.path}`}{" "}
                <span style={{ fg: darkTheme.muted }}>
                  {item.kind === "slash"
                    ? item.command.description
                    : "workspace file"}
                </span>
              </text>
            </box>
          )}
        </For>
      </box>
    </Show>
  );
}
