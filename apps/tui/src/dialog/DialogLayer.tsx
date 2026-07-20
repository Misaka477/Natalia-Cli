import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  type JSX,
} from "solid-js";
import { TextareaRenderable, TextAttributes } from "@opentui/core";
import { useAppState } from "../context/state";
import { useRouteController } from "../context/route";
import { darkTheme } from "../theme/theme";
import { useBindings } from "@opentui/keymap/solid";
import { JsonSessionStore, type SessionRecord } from "@natalia/session";
import type { TuiConfig, TuiConfigWriteScope } from "../config";
import { SettingsDialog } from "./SettingsDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { commands, formatKeybindKey } from "../keymap";
import { buildKeybindMap, type UserKeybindOverrides } from "../keymap";

export function DialogLayer(props: {
  workspaceRoot?: string;
  onSessionChange?: (sessionID?: string) => void;
  tuiConfig?: TuiConfig;
  tuiWriteScope?: TuiConfigWriteScope;
  onTuiConfigChange?: (config: TuiConfig, scope?: TuiConfigWriteScope) => void;
  onTuiConfigScopeChange?: (scope: TuiConfigWriteScope) => void;
  keybindOverrides?: UserKeybindOverrides;
}) {
  const route = useRouteController();
  return (
    <>
      <SessionListDialog
        open={route.route().kind === "sessions"}
        workspaceRoot={props.workspaceRoot}
        onClose={() => route.back()}
        onSelect={props.onSessionChange}
      />
      <SettingsDialog
        open={route.route().kind === "settings"}
        tuiConfig={props.tuiConfig}
        tuiWriteScope={props.tuiWriteScope}
        workspaceRoot={props.workspaceRoot}
        onClose={() => route.back()}
        onTuiConfigChange={props.onTuiConfigChange}
        onTuiConfigScopeChange={props.onTuiConfigScopeChange}
      />
      <StatusDialog
        open={route.route().kind === "status"}
        onClose={() => route.back()}
      />
      <HelpDialog
        open={route.route().kind === "help"}
        keybindOverrides={props.keybindOverrides}
        onClose={() => route.back()}
      />
    </>
  );
}

function HelpDialog(props: {
  open: boolean;
  keybindOverrides?: UserKeybindOverrides;
  onClose(): void;
}) {
  const bindings = () => buildKeybindMap(props.keybindOverrides).map;
  return (
    <Show when={props.open}>
      <DialogFrame title="Keyboard Shortcuts" tone="accent">
        <scrollbox height={16} border={["left"]} borderColor={darkTheme.muted}>
          <For each={Object.values(commands)}>
            {(command) => (
              <box flexDirection="row" justifyContent="space-between" gap={2}>
                <text fg={darkTheme.text}>{command.desc}</text>
                <text fg={darkTheme.accent}>
                  {bindings()[command.id]
                    ? formatKeybindKey(bindings()[command.id]!)
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
    </Show>
  );
}

function StatusDialog(props: { open: boolean; onClose: () => void }) {
  const { state } = useAppState();
  const segments = () => {
    const map: Record<string, string> = {};
    for (const s of state.statusSegments) {
      const idx = s.indexOf(":");
      if (idx > 0) map[s.slice(0, idx)] = s.slice(idx + 1);
      else map._extra = s;
    }
    return map;
  };
  return (
    <Show when={props.open}>
      <DialogFrame title="Runtime Status" tone="accent">
        <text fg={darkTheme.text}>Mode: {segments().mode ?? "runtime"}</text>
        <text fg={darkTheme.text}>
          Model: {segments().model ?? "not connected"}
        </text>
        <text fg={darkTheme.text}>
          Provider: {segments().provider ?? "not connected"}
        </text>
        <text fg={darkTheme.text}>Context: {segments().ctx ?? "unknown"}</text>
        <Show when={segments().threshold}>
          <text fg={darkTheme.muted}>
            Threshold: {segments().threshold} · Reserved:{" "}
            {segments().reserved ?? "-"}
          </text>
        </Show>
        <Show when={segments().step}>
          <text fg={darkTheme.muted}>Step: {segments().step}</text>
        </Show>
        <Show when={segments().bg}>
          <text fg={darkTheme.muted}>Background: {segments().bg}</text>
        </Show>
        <Show when={segments()._extra}>
          <text fg={darkTheme.muted}>Permissions: {segments()._extra}</text>
        </Show>
        <text fg={darkTheme.muted}>
          PTY sessions: {Object.keys(state.pty).length} · Messages:{" "}
          {state.messages.length}
        </text>
        <text fg={darkTheme.muted}>Escape to close</text>
      </DialogFrame>
    </Show>
  );
}

function SessionListDialog(props: {
  open: boolean;
  workspaceRoot?: string;
  onClose(): void;
  onSelect?: (sessionID?: string) => void;
}) {
  const [sessions, setSessions] = createSignal<SessionRecord[]>([]);
  const [selected, setSelected] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [mode, setMode] = createSignal<
    "list" | "confirm-delete" | "confirm-rename"
  >("list");
  const [renameText, setRenameText] = createSignal("");
  let renameInput: TextareaRenderable | undefined;

  const store = () =>
    new JsonSessionStore(
      `${props.workspaceRoot ?? process.cwd()}/.natalia/sessions`,
    );

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
      const items = await store().list();
      setSessions(items);
      setSelected(0);
      setQuery("");
      setMode("list");
    } finally {
      setLoading(false);
    }
  }

  async function selectSession(session: SessionRecord) {
    await store().updateMetadata(session.id, {
      lastAccessedAt: new Date().toISOString(),
    });
    props.onSelect?.(session.id);
  }

  async function confirmRename() {
    const session = filtered()[selected()];
    if (!session || !renameText().trim()) return;
    await store().rename(session.id, renameText());
    void refresh();
  }

  async function confirmDelete() {
    const session = filtered()[selected()];
    if (!session) return;
    await store().delete(session.id);
    void refresh();
  }

  async function duplicateSession() {
    const session = filtered()[selected()];
    if (!session) return;
    const copy = await store().duplicate(session.id);
    props.onSelect?.(copy.id);
  }

  createEffect(() => {
    if (!props.open) return;
    void refresh();
  });

  useBindings(() => ({
    enabled: props.open,
    bindings: [
      {
        key: "escape",
        desc: "Close or go back",
        group: "Dialog",
        cmd: () => {
          if (mode() === "confirm-delete" || mode() === "confirm-rename") {
            setMode("list");
          } else {
            props.onClose();
          }
        },
      },
    ],
  }));

  useBindings(() => ({
    enabled: props.open && mode() === "list",
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
          setSelected((value) =>
            Math.min(filtered().length - 1, value + 1),
          );
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
            void store()
              .updateMetadata(session.id, {
                pinned: !session.metadata?.pinned,
              })
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
            setRenameText(session.title);
            setMode("confirm-rename");
            queueMicrotask(() => renameInput?.focus());
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
    <Show when={props.open}>
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
            when={
              !loading() && sessions().length > 0 && filtered().length === 0
            }
          >
            <text fg={darkTheme.muted}>No sessions match your search.</text>
          </Show>
          <scrollbox
            height={12}
            border={["left"]}
            borderColor={darkTheme.muted}
          >
            <For each={filtered().slice(0, 100)}>
              {(session, index) => (
                <text
                  fg={
                    index() === selected() ? darkTheme.accent : darkTheme.text
                  }
                  attributes={
                    index() === selected() ? TextAttributes.BOLD : undefined
                  }
                >
                  {index() === selected() ? ">" : " "}
                  {session.metadata?.pinned ? "* " : "  "}
                  {session.title} · {session.id} · {session.events.length}
                </text>
              )}
            </For>
          </scrollbox>
        </Show>
        <Show when={mode() === "confirm-rename"}>
          <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
            Rename "{filtered()[selected()]?.title}"
          </text>
          <textarea
            ref={(value: TextareaRenderable) => {
              renameInput = value;
            }}
            initialValue={renameText()}
            minHeight={1}
            maxHeight={3}
            placeholder="New session title"
            placeholderColor={darkTheme.muted}
            textColor={darkTheme.text}
            focusedTextColor={darkTheme.text}
            cursorColor={darkTheme.accent}
            onKeyDown={(event: ModalKeyEvent) => {
              const key = normalizeModalKey(event.name ?? event.key ?? "");
              if (isExitChord(event)) {
                consumeModalKey(event);
                props.onClose();
                return;
              }
              if (key === "escape") {
                consumeModalKey(event);
                setMode("list");
                return;
              }
              if (key === "return") {
                consumeModalKey(event);
                const text = renameInput?.plainText ?? "";
                setRenameText(text);
                void confirmRename();
                return;
              }
            }}
          />
          <text fg={darkTheme.muted}>Enter confirm · Escape cancel</text>
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
    </Show>
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

type ModalKeyEvent = {
  name?: string;
  key?: string;
  ctrl?: boolean;
  control?: boolean;
  meta?: boolean;
  preventDefault(): void;
  stopPropagation?(): void;
};

function isExitChord(event: ModalKeyEvent) {
  const key = normalizeModalKey(event.name ?? event.key ?? "");
  return (
    (event.ctrl || event.control || event.meta) && (key === "c" || key === "d")
  );
}

function consumeModalKey(event: ModalKeyEvent) {
  event.preventDefault();
  event.stopPropagation?.();
}

function normalizeModalKey(key: string) {
  if (key === "enter") return "return";
  return key;
}
