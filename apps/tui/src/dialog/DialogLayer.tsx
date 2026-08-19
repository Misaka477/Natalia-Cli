import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  type JSX,
} from "solid-js";
import { ScrollBoxRenderable, TextAttributes } from "@opentui/core";
import { useAppState } from "../context/state";
import { darkTheme } from "../theme/theme";
import { useBindings } from "@opentui/keymap/solid";
import type {
  RuntimeDiagnostic,
  RuntimeEvent,
  RuntimeSessionSummary,
  RuntimeStatusSnapshot,
} from "@natalia/contracts";
import { ConfirmDialog } from "./ConfirmDialog";
import { DialogPrompt } from "./DialogPrompt";
import { useDialog } from "./provider";
import { commands, formatKeybinds } from "../keymap";
import { useKeybinds } from "../context/keybind";

export function DialogHelp() {
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
        Terminal sessions: {Object.keys(state.facts.terminals).length} ·
        Messages: {state.messages.length}
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
  subscribeRuntimeEvents?: (
    handler: (event: RuntimeEvent) => void,
  ) => () => void;
}) {
  const dialog = useDialog();
  const [sessions, setSessions] = createSignal<RuntimeSessionSummary[]>([]);
  const [selected, setSelected] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [mode, setMode] = createSignal<"list" | "confirm-delete">("list");
  const [deleteTargetID, setDeleteTargetID] = createSignal<string>();
  let sessionScroll: ScrollBoxRenderable | undefined;
  let refreshSequence = 0;

  const filtered = createMemo(() => filterSessions(sessions(), query()));
  const visible = createMemo(() => filtered().slice(0, 100));

  const dateLabel = (createdAt: string) => {
    const date = new Date(createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  };

  async function refresh(options: { quiet?: boolean; reset?: boolean } = {}) {
    if (options.quiet && loading()) return;
    const sequence = ++refreshSequence;
    const selectedID = filtered()[selected()]?.id;
    if (!options.quiet) setLoading(true);
    try {
      const items = await props.backend.list();
      if (sequence !== refreshSequence) return;
      setSessions(items);
      if (options.reset) {
        setSelected(0);
        setQuery("");
        setMode("list");
        queueMicrotask(() => sessionScroll?.scrollTo(0));
      } else {
        restoreSessionSelection(items, selectedID, selected());
      }
    } finally {
      if (!options.quiet && sequence === refreshSequence) setLoading(false);
    }
  }

  function moveSelection(direction: -1 | 1) {
    const count = visible().length;
    if (!count) return;
    setSelected((value) => Math.max(0, Math.min(count - 1, value + direction)));
    queueMicrotask(scrollToSelected);
  }

  function scrollToSelected() {
    if (!sessionScroll) return;
    const target = sessionScroll.getChildren()[selected()];
    if (!target) return;
    const y = target.y - sessionScroll.y;
    if (y < 0) sessionScroll.scrollBy(y);
    else if (y >= sessionScroll.height)
      sessionScroll.scrollBy(y - sessionScroll.height + 1);
  }

  async function selectSession(session: RuntimeSessionSummary) {
    await props.backend.touch(session.id);
    props.onSelect?.(session.id);
  }

  async function confirmDelete() {
    const session = sessions().find((item) => item.id === deleteTargetID());
    if (!session) return;
    await props.backend.delete(session.id);
    setDeleteTargetID(undefined);
    setMode("list");
    void refresh();
  }

  async function duplicateSession() {
    const session = filtered()[selected()];
    if (!session) return;
    const copy = await props.backend.duplicate(session.id);
    props.onSelect?.(copy.id);
  }

  function restoreSessionSelection(
    items: RuntimeSessionSummary[],
    selectedID: string | undefined,
    previousIndex: number,
  ) {
    const nextFiltered = filterSessions(items, query()).slice(0, 100);
    const byID = selectedID
      ? nextFiltered.findIndex((item) => item.id === selectedID)
      : -1;
    setSelected(
      byID >= 0
        ? byID
        : Math.max(0, Math.min(previousIndex, nextFiltered.length - 1)),
    );
  }

  onMount(() => {
    void refresh({ reset: true });
    const unsubscribe = props.subscribeRuntimeEvents?.((event) => {
      if (event.type !== "session.title.updated") return;
      const selectedID = visible()[selected()]?.id;
      const next = sessions().map((session) =>
        session.id === event.sessionID
          ? { ...session, title: event.title }
          : session,
      );
      setSessions(next);
      restoreSessionSelection(next, selectedID, selected());
    });
    onCleanup(() => unsubscribe?.());
  });

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
            setDeleteTargetID(undefined);
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
          moveSelection(-1);
        },
      },
      {
        key: "down",
        desc: "Next session",
        group: "Dialog",
        cmd: () => {
          moveSelection(1);
        },
      },
      {
        key: "return",
        desc: "Open session",
        group: "Dialog",
        cmd: () => {
          const session = visible()[selected()];
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
          const session = visible()[selected()];
          if (session) {
            void props.backend
              .pin(session.id, !session.pinned)
              .then(() => refresh());
          }
        },
      },
      {
        key: "alt+e",
        desc: "Rename session",
        group: "Dialog",
        cmd: () => {
          const session = visible()[selected()];
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
        key: "alt+d",
        desc: "Delete session",
        group: "Dialog",
        cmd: () => {
          const session = visible()[selected()];
          if (session) {
            setDeleteTargetID(session.id);
            setMode("confirm-delete");
          }
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
              queueMicrotask(() => sessionScroll?.scrollTo(0));
            }}
          />
        </Show>
        <text fg={darkTheme.muted}>
          Enter open · N new · C copy · P pin · Alt+E rename · Alt+D delete ·
          Escape close
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
        <scrollbox
          height={12}
          maxHeight={12}
          border={["left"]}
          borderColor={darkTheme.muted}
          ref={(value: ScrollBoxRenderable) => (sessionScroll = value)}
        >
          <For each={visible()}>
            {(session, index) => (
              <box flexDirection="column" paddingRight={1}>
                <Show
                  when={
                    index() === 0 ||
                    dateLabel(visible()[index() - 1]!.createdAt) !==
                      dateLabel(session.createdAt)
                  }
                >
                  <text fg={darkTheme.muted}>
                    {dateLabel(session.createdAt)}
                  </text>
                </Show>
                <text
                  flexGrow={1}
                  overflow="hidden"
                  wrapMode="none"
                  fg={
                    index() === selected() ? darkTheme.accent : darkTheme.text
                  }
                  attributes={
                    index() === selected() ? TextAttributes.BOLD : undefined
                  }
                >
                  {index() === selected() ? ">" : " "}
                  {session.pinned ? "* " : "  "}
                  {session.title || "Untitled"}
                </text>
                <text
                  fg={darkTheme.muted}
                  paddingLeft={4}
                  overflow="hidden"
                  wrapMode="none"
                >
                  {session.id} · {session.events} events
                  {session.pendingHumanTerminal ? " · waiting for human" : ""}
                </text>
              </box>
            )}
          </For>
        </scrollbox>
      </Show>
      <ConfirmDialog
        open={mode() === "confirm-delete"}
        title="Delete Session"
        message={`Remove "${sessions().find((item) => item.id === deleteTargetID())?.title ?? ""}" (${deleteTargetID() ?? ""})? This cannot be undone.`}
        dangerous
        onClose={() => setMode("list")}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </DialogFrame>
  );
}

function filterSessions(items: RuntimeSessionSummary[], query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return items;
  return items.filter((session) =>
    terms.every((term) =>
      `${session.title} ${session.id}`.toLowerCase().includes(term),
    ),
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
      position="relative"
      width="100%"
      maxHeight={props.inline ? 16 : "100%"}
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

export function DialogConstitution(props: {
  rules: Array<{
    ruleID: string;
    statement: string;
    priority: string;
    scope: string;
    enforcement: string;
  }>;
}) {
  const color = (priority: string) =>
    priority === "critical"
      ? darkTheme.danger
      : priority === "high"
        ? darkTheme.warning
        : darkTheme.muted;
  return (
    <box
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={1}
    >
      <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
        Constitution Rules
      </text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <For each={props.rules}>
          {(rule) => (
            <box flexDirection="column">
              <box flexDirection="row" gap={1}>
                <text
                  fg={color(rule.priority)}
                  attributes={TextAttributes.BOLD}
                >
                  {rule.ruleID}
                </text>
                <text fg={darkTheme.muted}>{rule.enforcement}</text>
                <text fg={darkTheme.muted}>{rule.scope}</text>
              </box>
              <text fg={darkTheme.text} wrapMode="word">
                {rule.statement}
              </text>
            </box>
          )}
        </For>
      </box>
    </box>
  );
}

export function DialogEvidence(props: {
  records: Array<{
    taskID: string;
    objective: string;
    status: string;
    knownGaps: string[];
  }>;
}) {
  return (
    <box
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={1}
    >
      <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
        Completion Evidence
      </text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <For each={props.records}>
          {(record) => (
            <box flexDirection="column">
              <box flexDirection="row" gap={1}>
                <text
                  fg={
                    record.status === "validated" ||
                    record.status === "accepted"
                      ? darkTheme.success
                      : record.status === "failed"
                        ? darkTheme.danger
                        : darkTheme.warning
                  }
                  attributes={TextAttributes.BOLD}
                >
                  {record.status}
                </text>
              </box>
              <text fg={darkTheme.text} wrapMode="word">
                {record.objective}
              </text>
              <Show when={record.knownGaps.length > 0}>
                <text fg={darkTheme.muted}>
                  Gaps: {record.knownGaps.join("; ")}
                </text>
              </Show>
            </box>
          )}
        </For>
      </box>
    </box>
  );
}

export function DialogSessionSnapshot(props: {
  snapshot?: {
    agentStatus: string;
    currentStep?: string;
    activeTool?: string;
    changedFiles: number;
    unvalidatedChanges: number;
    hasPTY: boolean;
    hasSandbox: boolean;
  };
}) {
  return (
    <box
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={1}
    >
      <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
        Session Intelligence
      </text>
      <Show
        when={props.snapshot}
        fallback={<text fg={darkTheme.muted}>No snapshot available</text>}
      >
        <box flexDirection="column" gap={1} paddingTop={1}>
          <text fg={darkTheme.text}>Status: {props.snapshot!.agentStatus}</text>
          <Show when={props.snapshot!.currentStep}>
            <text fg={darkTheme.muted}>
              Step: {props.snapshot!.currentStep}
            </text>
          </Show>
          <Show when={props.snapshot!.activeTool}>
            <text fg={darkTheme.muted}>Tool: {props.snapshot!.activeTool}</text>
          </Show>
          <text fg={darkTheme.muted}>
            Changed files: {props.snapshot!.changedFiles} · Unvalidated:{" "}
            {props.snapshot!.unvalidatedChanges}
          </text>
          <text fg={darkTheme.muted}>
            PTY: {props.snapshot!.hasPTY ? "attached" : "none"} · Sandbox:{" "}
            {props.snapshot!.hasSandbox ? "active" : "none"}
          </text>
        </box>
      </Show>
    </box>
  );
}

export function DialogDriftFindings(props: {
  findings: Array<{
    findingID: string;
    severity: string;
    confidence: number;
    originalObjective: string;
    currentActivity: string;
    evidence: string[];
    status: string;
  }>;
}) {
  const sevColor = (s: string) =>
    s === "high"
      ? darkTheme.danger
      : s === "warning"
        ? darkTheme.warning
        : darkTheme.muted;
  return (
    <box
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={1}
    >
      <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
        Goal Drift Findings
      </text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <For each={props.findings}>
          {(f) => (
            <box flexDirection="column" paddingLeft={1}>
              <box flexDirection="row" gap={1}>
                <text
                  fg={sevColor(f.severity)}
                  attributes={TextAttributes.BOLD}
                >
                  {f.severity}
                </text>
                <text fg={darkTheme.muted}>{f.status}</text>
                <text fg={darkTheme.muted}>
                  {Math.round(f.confidence * 100)}%
                </text>
              </box>
              <text fg={darkTheme.text}>Goal: {f.originalObjective}</text>
              <text fg={darkTheme.muted}>Current: {f.currentActivity}</text>
            </box>
          )}
        </For>
      </box>
    </box>
  );
}

export function DialogRegisteredTools(props: {
  tools: Array<{
    name: string;
    owner: string;
    scope: string;
    recovery: string;
    precedence: number;
    requiresApproval: boolean;
  }>;
}) {
  return (
    <box
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={1}
    >
      <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
        Canonical Tool Registry
      </text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <For each={props.tools}>
          {(tool) => (
            <box flexDirection="column" paddingLeft={1}>
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                {tool.name}
              </text>
              <text fg={darkTheme.muted}>
                owner: {tool.owner} · scope: {tool.scope} · recovery:{" "}
                {tool.recovery}
              </text>
            </box>
          )}
        </For>
      </box>
    </box>
  );
}

export function DialogCapabilities(props: {
  caps: Array<{
    id: string;
    name: string;
    version: string;
    scope: string;
    grants: string[];
  }>;
}) {
  return (
    <box
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={1}
    >
      <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
        Loaded Capabilities
      </text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <For each={props.caps}>
          {(cap) => (
            <box flexDirection="column" paddingLeft={1}>
              <box flexDirection="row" gap={1}>
                <text fg={darkTheme.accent} attributes={TextAttributes.BOLD}>
                  {cap.name}
                </text>
                <text fg={darkTheme.muted}>v{cap.version}</text>
              </box>
              <text fg={darkTheme.muted}>
                {cap.id} · {cap.scope}
              </text>
              <text fg={darkTheme.muted}>grants: {cap.grants.join(", ")}</text>
            </box>
          )}
        </For>
      </box>
    </box>
  );
}

export function DialogWorkGraph(props: {
  nodes: Array<{
    nodeID: string;
    kind: string;
    summary: string;
    actor?: string;
  }>;
  edges: Array<{
    sourceID: string;
    targetID: string;
    kind: string;
  }>;
}) {
  return (
    <box
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={1}
    >
      <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
        Work Graph
      </text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <For each={props.nodes}>
          {(node) => (
            <box flexDirection="column">
              <box flexDirection="row" gap={1}>
                <text fg={darkTheme.accent} attributes={TextAttributes.BOLD}>
                  {node.kind}
                </text>
                <text fg={darkTheme.muted}>{node.nodeID}</text>
              </box>
              <text fg={darkTheme.text} wrapMode="word">
                {node.summary}
              </text>
            </box>
          )}
        </For>
        <Show when={props.edges.length > 0}>
          <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
            Relations
          </text>
          <For each={props.edges}>
            {(edge) => (
              <text fg={darkTheme.muted} wrapMode="word">
                {edge.kind}: {edge.sourceID} -&gt; {edge.targetID}
              </text>
            )}
          </For>
        </Show>
      </box>
    </box>
  );
}

export function DialogDecision(props: {
  records: Array<{
    decision: string;
    rationale: string[];
    status: string;
    linkedPlans: string[];
    linkedConstraints: string[];
  }>;
}) {
  return (
    <box
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={1}
    >
      <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
        Decision Ledger
      </text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <For each={props.records}>
          {(record) => (
            <box flexDirection="column">
              <box flexDirection="row" gap={1}>
                <text
                  fg={
                    record.status === "accepted"
                      ? darkTheme.success
                      : record.status === "superseded"
                        ? darkTheme.muted
                        : darkTheme.warning
                  }
                  attributes={TextAttributes.BOLD}
                >
                  {record.status}
                </text>
              </box>
              <text fg={darkTheme.text} wrapMode="word">
                {record.decision}
              </text>
              <Show when={record.rationale.length > 0}>
                <text fg={darkTheme.muted}>
                  Rationale: {record.rationale.join("; ")}
                </text>
              </Show>
            </box>
          )}
        </For>
      </box>
    </box>
  );
}
