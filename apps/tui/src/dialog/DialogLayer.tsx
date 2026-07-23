import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
  type JSX,
} from "solid-js";
import { TextAttributes } from "@opentui/core";
import { useAppState } from "../context/state";
import { darkTheme } from "../theme/theme";
import { useBindings } from "@opentui/keymap/solid";
import type {
  RuntimeDiagnostic,
  RuntimeSessionSummary,
  RuntimeStatusSnapshot,
} from "@natalia/contracts";
import { ConfirmDialog } from "./ConfirmDialog";
import { DialogPrompt } from "./DialogPrompt";
import { useDialog } from "./provider";
import { commands, formatKeybinds } from "../keymap";
import { useKeybinds } from "../context/keybind";

export function DialogHelp(props: { onClose(): void }) {
  const keybinds = useKeybinds();
  const bindings = () => keybinds.resolved().bindings;
  return (
    <DialogFrame title="Keyboard Shortcuts" tone="accent">
      <scrollbox height={16} border={["left"]} borderColor={darkTheme.muted}>
        <For each={Object.values(commands)}>
          {(command) => (
            <box flexDirection="row" justifyContent="space-between" gap={2}>
              <text fg={darkTheme.text}>{command.desc}</text>
              <text fg={darkTheme.accent}>
                {bindings()[command.id]
                  ? formatKeybinds(bindings()[command.id]!)
                  : "disabled"}
              </text>
            </box>
          )}
        </For>
      </scrollbox>
      <text fg={darkTheme.muted}>
        Current bindings include TUI config overrides · Escape returns
      </text>
    </DialogFrame>
  );
}

export function statusRows(snapshot: RuntimeStatusSnapshot) {
  return [
    ["Model", snapshot.model],
    ["Provider", snapshot.provider],
    ["Context", snapshot.context],
    ["Step", snapshot.step],
    ["Permissions", snapshot.permissions],
    ["Workspace", snapshot.cwd],
    ["Background", snapshot.background],
  ] as const;
}

export function DialogStatus(props: {
  load(): Promise<RuntimeStatusSnapshot>;
}) {
  const { state } = useAppState();
  const dialog = useDialog();
  const [snapshot, setSnapshot] = createSignal<RuntimeStatusSnapshot>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let refreshing = false;
  const refresh = async () => {
    refreshing = true;
    setLoading(true);
    setError(undefined);
    try {
      setSnapshot(await props.load());
    } catch {
      setError("Unable to load runtime status");
    } finally {
      setLoading(false);
      refreshing = false;
    }
  };
  onMount(() => void refresh());
  useBindings(() => ({
    mode: "modal",
    enabled: true,
    bindings: [
      {
        key: "r",
        desc: "Refresh runtime status",
        group: "Dialog",
        cmd: () => void refresh(),
      },
      {
        key: "escape",
        desc: "Close status",
        group: "Dialog",
        cmd: () => dialog.pop(),
      },
    ],
  }));
  return (
    <DialogFrame title="Runtime Status" tone="accent">
      <Show when={error()}>
        {(message) => <text fg={darkTheme.danger}>{message()}</text>}
      </Show>
      <Show
        when={snapshot()}
        fallback={<text fg={darkTheme.muted}>Loading runtime status...</text>}
      >
        {(current) => (
          <For each={statusRows(current())}>
            {([label, value]) => (
              <text fg={darkTheme.text}>
                {label}: {value}
              </text>
            )}
          </For>
        )}
      </Show>
      <text fg={darkTheme.muted}>
        PTY sessions: {Object.keys(state.pty).length} · Messages:{" "}
        {state.messages.length}
      </text>
      <text fg={darkTheme.muted}>
        {loading() ? "Refreshing... · " : ""}R refresh · Escape close
      </text>
    </DialogFrame>
  );
}

export function formatDiagnosticsReport(items: RuntimeDiagnostic[]) {
  return items
    .map((item) => `${item.at} ${item.level.toUpperCase()} ${item.message}`)
    .join("\n");
}

export function diagnosticsSummary(items: RuntimeDiagnostic[]) {
  return items.reduce(
    (summary, item) => {
      summary[item.level]++;
      return summary;
    },
    { info: 0, warning: 0, error: 0 },
  );
}

export function DialogDiagnostics(props: {
  load(): Promise<RuntimeDiagnostic[]>;
  copy(text: string): Promise<void> | void;
}) {
  const dialog = useDialog();
  const [items, setItems] = createSignal<RuntimeDiagnostic[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let refreshing = false;
  const report = () => formatDiagnosticsReport(items());
  const summary = () => diagnosticsSummary(items());
  const refresh = async () => {
    if (refreshing) return;
    refreshing = true;
    setLoading(true);
    setError(undefined);
    try {
      setItems(await props.load());
    } catch {
      // Diagnostics may originate from unavailable local transports. Do not expose
      // an unredacted transport error in this report surface.
      setError("Unable to load runtime diagnostics");
    } finally {
      setLoading(false);
      refreshing = false;
    }
  };
  const copy = async () => {
    try {
      await props.copy(report());
      setCopied(true);
      setError(undefined);
    } catch {
      setCopied(false);
      setError("Unable to copy diagnostics report");
    }
  };
  createEffect(() => void refresh());
  useBindings(() => ({
    mode: "modal",
    enabled: true,
    bindings: [
      {
        key: "r",
        desc: "Refresh diagnostics",
        group: "Dialog",
        cmd: () => void refresh(),
      },
      {
        key: "return",
        desc: "Copy diagnostics",
        group: "Dialog",
        cmd: () => void copy(),
      },
      {
        key: "escape",
        desc: "Close diagnostics",
        group: "Dialog",
        cmd: () => dialog.pop(),
      },
    ],
  }));
  return (
    <DialogFrame title="Runtime Diagnostics" tone="accent">
      <Show when={!loading() && items().length > 0}>
        <text fg={darkTheme.muted}>
          {items().length} entries · {summary().error} errors ·{" "}
          {summary().warning} warnings
        </text>
      </Show>
      <Show when={error()}>
        {(message) => <text fg={darkTheme.danger}>{message()}</text>}
      </Show>
      <scrollbox height={16} border={["left"]} borderColor={darkTheme.muted}>
        <Show
          when={!loading()}
          fallback={<text fg={darkTheme.muted}>Loading diagnostics...</text>}
        >
          <For
            each={items()}
            fallback={<text fg={darkTheme.muted}>No runtime diagnostics</text>}
          >
            {(item) => (
              <text
                fg={item.level === "error" ? darkTheme.danger : darkTheme.text}
              >
                {item.at} {item.level.toUpperCase()} {item.message}
              </text>
            )}
          </For>
        </Show>
      </scrollbox>
      <text fg={darkTheme.muted}>
        Enter {copied() ? "copied" : "copy"} · R refresh · Escape close
      </text>
    </DialogFrame>
  );
}

export function DialogSessionList(props: {
  backend: {
    list(): Promise<RuntimeSessionSummary[]>;
    touch(id: string): Promise<void>;
    rename(id: string, title: string): Promise<RuntimeSessionSummary>;
    pin(id: string, pinned: boolean): Promise<RuntimeSessionSummary>;
    duplicate(id: string): Promise<RuntimeSessionSummary>;
    delete(id: string): Promise<{ id: string; removedAttachments: number }>;
  };
  onSelect?: (sessionID?: string) => void;
}) {
  const dialog = useDialog();
  const [sessions, setSessions] = createSignal<RuntimeSessionSummary[]>([]);
  const [selected, setSelected] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [mode, setMode] = createSignal<"list" | "confirm-delete">("list");

  const filtered = createMemo(() => {
    const terms = query().toLowerCase().trim().split(/\s+/u).filter(Boolean);
    if (!terms.length) return sessions();
    return sessions().filter((s) =>
      terms.every((t) => `${s.title} ${s.id}`.toLowerCase().includes(t)),
    );
  });

  async function refresh() {
    setLoading(true);
    try {
      const items = await props.backend.list();
      setSessions(items);
      setSelected(0);
      setQuery("");
      setMode("list");
    } finally {
      setLoading(false);
    }
  }

  async function selectSession(session: RuntimeSessionSummary) {
    await props.backend.touch(session.id);
    props.onSelect?.(session.id);
  }

  async function confirmDelete() {
    const session = filtered()[selected()];
    if (!session) return;
    await props.backend.delete(session.id);
    void refresh();
  }

  async function duplicateSession() {
    const session = filtered()[selected()];
    if (!session) return;
    const copy = await props.backend.duplicate(session.id);
    props.onSelect?.(copy.id);
  }

  createEffect(() => void refresh());

  useBindings(() => ({
    mode: "modal",
    enabled: true,
    bindings: [
      {
        key: "escape",
        desc: "Close or go back",
        group: "Dialog",
        cmd: () => {
          if (mode() === "confirm-delete") {
            setMode("list");
          } else {
            dialog.pop();
          }
        },
      },
    ],
  }));

  useBindings(() => ({
    mode: "modal",
    enabled: mode() === "list",
    bindings: [
      {
        key: "up",
        desc: "Previous session",
        group: "Dialog",
        cmd: () => {
          setSelected((value) => Math.max(0, value - 1));
        },
      },
      {
        key: "down",
        desc: "Next session",
        group: "Dialog",
        cmd: () => {
          setSelected((value) => Math.min(filtered().length - 1, value + 1));
        },
      },
      {
        key: "return",
        desc: "Open session",
        group: "Dialog",
        cmd: () => {
          const session = filtered()[selected()];
          if (session) void selectSession(session);
        },
      },
      {
        key: "n",
        desc: "New session",
        group: "Dialog",
        cmd: () => {
          props.onSelect?.(
            `ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}`,
          );
        },
      },
      {
        key: "p",
        desc: "Toggle pin",
        group: "Dialog",
        cmd: () => {
          const session = filtered()[selected()];
          if (session) {
            void props.backend
              .pin(session.id, !session.pinned)
              .then(() => refresh());
          }
        },
      },
      {
        key: "r",
        desc: "Rename session",
        group: "Dialog",
        cmd: () => {
          const session = filtered()[selected()];
          if (session) {
            dialog.push(() => (
              <DialogPrompt
                title="Rename Session"
                value={session.title}
                validate={(value) =>
                  value.trim() ? undefined : "Session title is required"
                }
                onConfirm={(title) => {
                  void props.backend.rename(session.id, title).then(() => {
                    dialog.pop();
                    void refresh();
                  });
                }}
              />
            ));
          }
        },
      },
      {
        key: "d",
        desc: "Delete session",
        group: "Dialog",
        cmd: () => {
          const session = filtered()[selected()];
          if (session) setMode("confirm-delete");
        },
      },
      {
        key: "c",
        desc: "Duplicate session",
        group: "Dialog",
        cmd: () => {
          void duplicateSession();
        },
      },
    ],
  }));

  return (
    <DialogFrame title="Session History" tone="accent">
      <Show when={mode() === "list"}>
        <Show when={!loading()}>
          <input
            placeholder="Search sessions... (type to filter)"
            placeholderColor={darkTheme.muted}
            textColor={darkTheme.text}
            focusedTextColor={darkTheme.text}
            onInput={(value: string) => {
              setQuery(value);
              setSelected(0);
            }}
          />
        </Show>
        <text fg={darkTheme.muted}>
          Enter open · N new · C copy · P pin · R rename · D delete · Escape
          close
        </text>
        <Show when={loading()}>
          <text fg={darkTheme.muted}>Loading sessions...</text>
        </Show>
        <Show when={!loading() && sessions().length === 0}>
          <text fg={darkTheme.muted}>
            No saved sessions yet. Press N to start one.
          </text>
        </Show>
        <Show
          when={!loading() && sessions().length > 0 && filtered().length === 0}
        >
          <text fg={darkTheme.muted}>No sessions match your search.</text>
        </Show>
        <scrollbox height={12} border={["left"]} borderColor={darkTheme.muted}>
          <For each={filtered().slice(0, 100)}>
            {(session, index) => (
              <text
                fg={index() === selected() ? darkTheme.accent : darkTheme.text}
                attributes={
                  index() === selected() ? TextAttributes.BOLD : undefined
                }
              >
                {index() === selected() ? ">" : " "}
                {session.pinned ? "* " : "  "}
                {session.title} · {session.id} · {session.events}
              </text>
            )}
          </For>
        </scrollbox>
      </Show>
      <ConfirmDialog
        open={mode() === "confirm-delete"}
        title="Delete Session"
        message={`Remove "${filtered()[selected()]?.title ?? ""}" (${filtered()[selected()]?.id ?? ""})? This cannot be undone.`}
        dangerous
        onClose={() => setMode("list")}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </DialogFrame>
  );
}

function DialogFrame(props: {
  title: string;
  tone: "accent" | "warning";
  inline?: boolean;
  children: JSX.Element;
}) {
  const color = props.tone === "warning" ? darkTheme.warning : darkTheme.accent;
  return (
    <box
      position={props.inline ? "relative" : "absolute"}
      left={props.inline ? undefined : 4}
      right={props.inline ? undefined : 4}
      bottom={props.inline ? undefined : 3}
      maxHeight={props.inline ? 16 : "80%"}
      border
      borderColor={color}
      backgroundColor={darkTheme.panel}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      gap={1}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={color}>
          {props.title}
        </text>
        <text fg={darkTheme.muted}>Modal</text>
      </box>
      {props.children}
    </box>
  );
}
