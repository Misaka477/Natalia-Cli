import type { TextareaRenderable } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import {
  runtimeSlashCommands,
  type MCPResourceCatalog,
  type RuntimeAgentCatalogEntry,
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

type AutocompleteOption =
  | { kind: "slash"; command: (typeof runtimeSlashCommands)[number] }
  | { kind: "mention"; file: RuntimeWorkspaceFileEntry }
  | { kind: "agent"; agent: RuntimeAgentCatalogEntry }
  | { kind: "resource"; resource: MCPResourceCatalog };

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
  agents?(): Promise<RuntimeAgentCatalogEntry[]>;
  mcpCatalog?(): Promise<{ resources: MCPResourceCatalog[] }>;
  attach(path: string): void;
  mentionAgent(name: string): void;
  mentionResource(resource: MCPResourceCatalog): void;
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
  const [agents] = createResource(mentionQuery, async (query) => {
    if (query === undefined || !props.agents) return [];
    return (await props.agents()).filter(
      (agent) =>
        !agent.hidden &&
        agent.mode !== "primary" &&
        (agent.name.toLowerCase().includes(query) ||
          agent.description.toLowerCase().includes(query)),
    );
  });
  const [resources] = createResource(mentionQuery, async (query) => {
    if (query === undefined || !props.mcpCatalog) return [];
    return (await props.mcpCatalog()).resources.filter(
      (resource) =>
        resource.name.toLowerCase().includes(query) ||
        resource.uri.toLowerCase().includes(query),
    );
  });
  const options = createMemo<AutocompleteOption[]>(() =>
    slashQuery() !== undefined
      ? slashAutocompleteOptions(props.text()).map((command) => ({
          kind: "slash" as const,
          command,
        }))
      : [
          ...(agents() ?? []).map((agent) => ({
            kind: "agent" as const,
            agent,
          })),
          ...(files() ?? []).map((file) => ({
            kind: "mention" as const,
            file,
          })),
          ...(resources() ?? []).map((resource) => ({
            kind: "resource" as const,
            resource,
          })),
        ],
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
  createEffect(() => {
    if (!props.text()) setDismissed();
  });

  function move(direction: -1 | 1) {
    const items = options();
    if (!items.length) return;
    setSelected(
      (current) => (current + direction + items.length) % items.length,
    );
  }

  // Only a handful of rows fit above the prompt, but there are far more
  // commands than that. Without a window the selection walks past the last
  // rendered row and the highlight appears to vanish, so the visible slice
  // follows the selection instead.
  const visibleCount = 6;
  const windowed = createMemo(() => {
    const items = options();
    if (items.length <= visibleCount)
      return items.map((item, index) => ({ item, index }));
    const start = Math.min(
      Math.max(0, selected() - Math.floor(visibleCount / 2)),
      items.length - visibleCount,
    );
    return items
      .slice(start, start + visibleCount)
      .map((item, offset) => ({ item, index: start + offset }));
  });

  function mentionLabel(item: AutocompleteOption) {
    if (item.kind === "mention") return `@${item.file.path}`;
    if (item.kind === "agent") return `@${item.agent.name}`;
    if (item.kind === "resource") return `@${item.resource.name}`;
    return `/${item.command.name}`;
  }

  function optionDescription(item: AutocompleteOption) {
    if (item.kind === "slash") return item.command.description;
    if (item.kind === "mention") return "workspace file";
    if (item.kind === "agent") return item.agent.description || "agent";
    return item.resource.uri;
  }

  function select() {
    const item = options()[selected()];
    const input = props.input();
    if (!item || !input) return;
    const text =
      item.kind === "slash"
        ? `/${item.command.name}${item.command.acceptsArguments ? " " : ""}`
        : props
            .text()
            .replace(
              /@(\S*)$/u,
              `@${item.kind === "mention" ? item.file.path : item.kind === "agent" ? item.agent.name : item.resource.name} `,
            );
    setDismissed(text);
    if (item.kind === "mention") props.attach(item.file.path);
    if (item.kind === "agent") props.mentionAgent(item.agent.name);
    if (item.kind === "resource") props.mentionResource(item.resource);
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
          cmd: () => setDismissed(props.text()),
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
      >
        <Show
          when={options().length}
          fallback={<text fg={darkTheme.muted}>No matching commands</text>}
        >
          <For each={windowed()}>
            {(entry) => {
              const active = createMemo(() => entry.index === selected());
              return (
                <box
                  flexDirection="row"
                  backgroundColor={active() ? darkTheme.accent : undefined}
                >
                  {/*
                    The label and description must live in a single non-wrapping
                    clipped text node. A sibling whitespace child between two
                    dynamic children lets neighbouring rows' content land in
                    this row's blank cells, which renders as interleaved text.
                  */}
                  <text
                    flexGrow={1}
                    overflow="hidden"
                    wrapMode="none"
                    fg={active() ? darkTheme.background : darkTheme.text}
                  >
                    {mentionLabel(entry.item)}
                    <span
                      style={{
                        fg: active() ? darkTheme.background : darkTheme.muted,
                      }}
                    >
                      {" "}
                      {optionDescription(entry.item)}
                    </span>
                  </text>
                </box>
              );
            }}
          </For>
          <Show when={options().length > visibleCount}>
            <text fg={darkTheme.muted}>
              {`${selected() + 1}/${options().length}`}
            </text>
          </Show>
        </Show>
      </box>
    </Show>
  );
}
