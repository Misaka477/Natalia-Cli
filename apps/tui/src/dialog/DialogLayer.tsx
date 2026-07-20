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
import { TextareaRenderable, TextAttributes } from "@opentui/core";
import type { RuntimeClient } from "@natalia/contracts";
import type { ModalRequest } from "@natalia/ui-model";
import { usePromptRef } from "../context/prompt";
import { useAppState } from "../context/state";
import { useRouteController } from "../context/route";
import { darkTheme } from "../theme/theme";
import { useBindings } from "@opentui/keymap/solid";
import { useModeStack } from "../modal/mode-stack";
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

export function ApprovalPrompt(props: {
  request: Extract<ModalRequest, { kind: "approval" }>;
  backend: RuntimeClient;
  onExit: () => void;
}) {
  const [selected, setSelected] = createSignal(0);
  const [stage, setStage] = createSignal<"decision" | "feedback">("decision");
  const [feedback, setFeedback] = createSignal("");
  const [expanded, setExpanded] = createSignal(false);
  const promptRef = usePromptRef();
  const modeStack = useModeStack();
  const actions = ["once", "session", "reject"] as const;
  let input: TextareaRenderable | undefined;

  onMount(() => {
    const popMode = modeStack.push("approval");
    onCleanup(popMode);
  });

  function confirm(
    feedbackOverride = feedback(),
    decision = actions[selected()],
  ) {
    if (decision === "reject" && stage() === "decision") {
      setStage("feedback");
      queueMicrotask(() => input?.focus());
      return;
    }
    queueMicrotask(() => {
      props.backend.respondApproval({
        requestID: props.request.id,
        decision,
        feedback:
          decision === "reject"
            ? feedbackOverride.trim() || undefined
            : undefined,
      });
      queueMicrotask(() => promptRef.focus());
    });
  }

  function rejectImmediately() {
    queueMicrotask(() => {
      props.backend.respondApproval({
        requestID: props.request.id,
        decision: "reject",
        feedback: feedback().trim() || "rejected from modal",
      });
      queueMicrotask(() => promptRef.focus());
    });
  }

  useBindings(() => ({
    mode: "approval",
    enabled: stage() === "feedback",
    bindings: [
      {
        key: "escape",
        desc: "Back to decision",
        group: "Dialog",
        cmd: () => setStage("decision"),
      },
    ],
  }));

  useBindings(() => ({
    mode: "approval",
    enabled: stage() === "decision",
    bindings: [
      {
        key: "left",
        desc: "Previous option",
        group: "Dialog",
        cmd: () =>
          setSelected(
            (selected() + actions.length - 1) % actions.length,
          ),
      },
      {
        key: "up",
        desc: "Previous option",
        group: "Dialog",
        cmd: () =>
          setSelected(
            (selected() + actions.length - 1) % actions.length,
          ),
      },
      {
        key: "right",
        desc: "Next option",
        group: "Dialog",
        cmd: () =>
          setSelected((selected() + 1) % actions.length),
      },
      {
        key: "down",
        desc: "Next option",
        group: "Dialog",
        cmd: () =>
          setSelected((selected() + 1) % actions.length),
      },
      {
        key: "tab",
        desc: "Next option",
        group: "Dialog",
        cmd: () =>
          setSelected((selected() + 1) % actions.length),
      },
      {
        key: "return",
        desc: "Confirm",
        group: "Dialog",
        cmd: confirm,
      },
      {
        key: "escape",
        desc: "Reject",
        group: "Dialog",
        cmd: rejectImmediately,
      },
      {
        key: "d",
        desc: "Toggle detail",
        group: "Dialog",
        cmd: () => setExpanded((value) => !value),
      },
      {
        key: "1",
        desc: "Allow once",
        group: "Dialog",
        cmd: () => {
          const index = Math.min(0, actions.length - 1);
          setSelected(index);
          confirm(feedback(), actions[index]);
        },
      },
      {
        key: "2",
        desc: "Allow session",
        group: "Dialog",
        cmd: () => {
          const index = Math.min(1, actions.length - 1);
          setSelected(index);
          confirm(feedback(), actions[index]);
        },
      },
      {
        key: "3",
        desc: "Reject",
        group: "Dialog",
        cmd: () => {
          const index = Math.min(2, actions.length - 1);
          setSelected(index);
          confirm(feedback(), actions[index]);
        },
      },
    ],
  }));

  return (
    <DialogFrame inline title="Approval required" tone="warning">
      <box flexDirection="column" gap={1}>
        <text
          attributes={TextAttributes.BOLD}
          fg={darkTheme.text}
          wrapMode="word"
        >
          {props.request.title}
        </text>
        <scrollbox height={4} border={[]} paddingLeft={0}>
          <text fg={darkTheme.text} wrapMode="word">
            {props.request.preview}
          </text>
        </scrollbox>
        <Show when={props.request.keyArguments?.length}>
          <text fg={darkTheme.muted} wrapMode="word">
            args: {props.request.keyArguments?.join(", ")}
          </text>
        </Show>
        <Show when={props.request.sensitive}>
          <text fg={darkTheme.warning}>sensitive fields are redacted</text>
        </Show>
        <Show when={props.request.detail}>
          <box flexDirection="column">
            <text fg={darkTheme.muted}>
              {expanded()
                ? "raw request detail open · d closes"
                : "raw request detail hidden · d opens"}
            </text>
            <Show when={expanded()}>
              <scrollbox
                height={12}
                borderColor={darkTheme.muted}
                border={["left"]}
                paddingLeft={1}
              >
                <text fg={darkTheme.text} wrapMode="word">
                  {props.request.detail}
                </text>
              </scrollbox>
            </Show>
          </box>
        </Show>
        <Show when={stage() === "feedback"}>
          <box flexDirection="column" gap={1}>
            <text fg={darkTheme.muted}>
              Reject feedback does not enter prompt history.
            </text>
            <textarea
              ref={(value: TextareaRenderable) => {
                input = value;
                value.traits = { status: "REJECT" };
                queueMicrotask(() => value.focus());
              }}
              minHeight={1}
              maxHeight={4}
              placeholder="Tell Natalia what to do differently"
              placeholderColor={darkTheme.muted}
              textColor={darkTheme.text}
              focusedTextColor={darkTheme.text}
              cursorColor={darkTheme.warning}
              onKeyDown={(event: ModalKeyEvent) => {
                if (isExitChord(event)) {
                  consumeModalKey(event);
                  props.onExit();
                  return;
                }
                if (
                  normalizeModalKey(event.name ?? event.key ?? "") !== "return"
                )
                  return;
                consumeModalKey(event);
                const text = input?.plainText ?? "";
                setFeedback(text);
                confirm(text);
              }}
            />
          </box>
        </Show>
        <ModalActions
          actions={["Allow once", "Allow session", "Reject"]}
          selected={selected()}
          onSelect={setSelected}
          onConfirm={confirm}
          onQuickSelect={(index) => {
            setSelected(index);
            confirm(feedback(), actions[index]);
          }}
          onCancel={rejectImmediately}
          onToggleDetail={() => setExpanded((value) => !value)}
          onExit={props.onExit}
        />
      </box>
    </DialogFrame>
  );
}

export function QuestionPrompt(props: {
  request: Extract<ModalRequest, { kind: "question" }>;
  backend: RuntimeClient;
  onExit: () => void;
}) {
  const request = props.request;
  const requestID = request.id;
  const title = request.title;
  const questionItems = request.questions ?? [];
  const [tab, setTab] = createSignal(0);
  const [selected, setSelected] = createSignal(0);
  const [editing, setEditing] = createSignal(false);
  const [custom, setCustom] = createSignal<string[]>([]);
  const [answers, setAnswers] = createSignal<string[][]>([]);
  const promptRef = usePromptRef();
  const modeStack = useModeStack();
  let input: TextareaRenderable | undefined;
  const questions = () => questionItems;
  const single = () => questions().length === 1 && !questions()[0]?.multiple;
  const confirmTab = () => !single() && tab() === questions().length;
  const question = () => questions()[tab()];
  const options = () => question()?.options ?? [];
  const customEnabled = () => question()?.custom !== false;
  const customSelected = () => selected() === options().length;
  const currentAnswers = () => answers()[tab()] ?? [];

  onMount(() => {
    const popMode = modeStack.push("question");
    onCleanup(popMode);
  });

  useBindings(() => ({
    mode: "question",
    enabled: editing(),
    bindings: [
      {
        key: "escape",
        desc: "Cancel editing",
        group: "Dialog",
        cmd: () => setEditing(false),
      },
    ],
  }));

  useBindings(() => ({
    mode: "question",
    enabled: !editing(),
    bindings: [
      {
        key: "up",
        desc: "Previous option",
        group: "Dialog",
        cmd: () => moveSelected(-1),
      },
      {
        key: "down",
        desc: "Next option",
        group: "Dialog",
        cmd: () => moveSelected(1),
      },
      {
        key: "left",
        desc: "Previous tab",
        group: "Dialog",
        cmd: () => moveTab(-1),
      },
      {
        key: "right",
        desc: "Next tab",
        group: "Dialog",
        cmd: () => moveTab(1),
      },
      {
        key: "tab",
        desc: "Next tab",
        group: "Dialog",
        cmd: () => moveTab(1),
      },
      {
        key: "return",
        desc: "Select",
        group: "Dialog",
        cmd: selectCurrent,
      },
      {
        key: "escape",
        desc: "Reject",
        group: "Dialog",
        cmd: reject,
      },
    ],
  }));

  useBindings(() => ({
    mode: "question",
    enabled: !editing(),
    bindings: Array.from({ length: 9 }, (_, i) => ({
      key: String(i + 1),
      desc: `Quick select #${i + 1}`,
      group: "Dialog",
      cmd: () => {
        const max = options().length + (customEnabled() ? 1 : 0);
        selectIndex(Math.min(i, Math.max(0, max - 1)));
      },
    })),
  }));

  function setAnswer(index: number, value: string[]) {
    const next = [...answers()];
    next[index] = value;
    setAnswers(next);
  }

  function pick(value: string) {
    if (question()?.multiple) {
      const existing = currentAnswers();
      setAnswer(
        tab(),
        existing.includes(value)
          ? existing.filter((item) => item !== value)
          : [...existing, value],
      );
      return;
    }
    setAnswer(tab(), [value]);
    if (single()) submit();
    if (!single()) moveTab(1);
  }

  function submitCustom() {
    const text = (input?.plainText ?? "").trim();
    const next = [...custom()];
    if (!text) {
      next[tab()] = "";
      setCustom(next);
      setAnswer(tab(), []);
      setEditing(false);
      queueMicrotask(() => promptRef.focus());
      return;
    }
    next[tab()] = text;
    setCustom(next);
    pick(text);
    setEditing(false);
    queueMicrotask(() => promptRef.focus());
  }

  function selectCurrent() {
    selectIndex(selected());
  }

  function selectIndex(index: number) {
    if (confirmTab()) {
      submit();
      return;
    }
    setSelected(index);
    if (index === options().length && customEnabled()) {
      setEditing(true);
      queueMicrotask(() => input?.focus());
      return;
    }
    const option = options()[index];
    if (option) pick(option.label);
  }

  function moveTab(delta: number) {
    const count = questions().length + (single() ? 0 : 1);
    setTab(Math.max(0, Math.min(count - 1, tab() + delta)));
    setSelected(0);
    setEditing(false);
  }

  function moveSelected(delta: number) {
    const max = Math.max(1, options().length + (customEnabled() ? 1 : 0));
    setSelected((selected() + delta + max) % max);
  }

  function submit() {
    const submittedAnswers = questions().map(
      (_, index) => answers()[index] ?? [],
    );
    queueMicrotask(() => {
      props.backend.respondQuestion({
        requestID,
        answers: submittedAnswers,
      });
      queueMicrotask(() => promptRef.focus());
    });
  }

  function reject() {
    queueMicrotask(() => {
      props.backend.respondQuestion({
        requestID,
        answers: [],
        rejected: true,
      });
      queueMicrotask(() => promptRef.focus());
    });
  }

  return (
    <DialogFrame inline title={title} tone="accent">
      <box flexDirection="column" gap={1}>
        <Show when={!single()}>
          <box flexDirection="row" gap={1}>
            <For each={questions()}>
              {(item, index) => (
                <text
                  fg={index() === tab() ? darkTheme.accent : darkTheme.muted}
                >
                  {index() === tab() ? "[" : " "}
                  {item.header}
                  {answers()[index()]?.length ? "*" : ""}
                  {index() === tab() ? "]" : " "}
                </text>
              )}
            </For>
            <text fg={confirmTab() ? darkTheme.accent : darkTheme.muted}>
              [Confirm]
            </text>
          </box>
        </Show>
        <Show
          when={!confirmTab()}
          fallback={
            <QuestionReview questions={questions()} answers={answers()} />
          }
        >
          <box flexDirection="column" gap={1}>
            <text fg={darkTheme.text} wrapMode="word">
              {question()?.question}
              {question()?.multiple ? " (select all that apply)" : ""}
            </text>
            <For each={options()}>
              {(option, index) => (
                <QuestionOptionRow
                  index={index()}
                  selected={selected() === index()}
                  picked={currentAnswers().includes(option.label)}
                  multiple={question()?.multiple === true}
                  label={option.label}
                  description={option.description}
                />
              )}
            </For>
            <Show when={customEnabled()}>
              <QuestionOptionRow
                index={options().length}
                selected={customSelected()}
                picked={Boolean(
                  custom()[tab()] && currentAnswers().includes(custom()[tab()]),
                )}
                multiple={question()?.multiple === true}
                label="Type your own answer"
                description={custom()[tab()]}
              />
              <Show when={editing()}>
                <textarea
                  ref={(value: TextareaRenderable) => {
                    input = value;
                    value.traits = { status: "ANSWER" };
                    queueMicrotask(() => value.focus());
                  }}
                  initialValue={custom()[tab()] ?? ""}
                  minHeight={1}
                  maxHeight={4}
                  placeholder="Type your own answer"
                  placeholderColor={darkTheme.muted}
                  textColor={darkTheme.text}
                  focusedTextColor={darkTheme.text}
                  cursorColor={darkTheme.accent}
                  onKeyDown={(event: ModalKeyEvent) => {
                    if (isExitChord(event)) {
                      consumeModalKey(event);
                      props.onExit();
                      return;
                    }
                    const key = normalizeModalKey(
                      event.name ?? event.key ?? "",
                    );
                    if (key === "escape") {
                      consumeModalKey(event);
                      setEditing(false);
                      queueMicrotask(() => input?.blur?.());
                      reject();
                      return;
                    }
                    if (key === "return") {
                      consumeModalKey(event);
                      submitCustom();
                      return;
                    }
                  }}
                />
              </Show>
            </Show>
          </box>
        </Show>
        <QuestionActions
          confirm={confirmTab()}
          editing={editing()}
          multiple={question()?.multiple === true}
          selected={selected()}
          max={options().length + (customEnabled() ? 1 : 0)}
          onMove={(delta) =>
            setSelected(
              (selected() +
                delta +
                Math.max(1, options().length + (customEnabled() ? 1 : 0))) %
                Math.max(1, options().length + (customEnabled() ? 1 : 0)),
            )
          }
          onTab={moveTab}
          onSelect={selectCurrent}
          onQuickSelect={selectIndex}
          onReject={reject}
          onExit={props.onExit}
        />
      </box>
    </DialogFrame>
  );
}

function QuestionOptionRow(props: {
  index: number;
  selected: boolean;
  picked: boolean;
  multiple: boolean;
  label: string;
  description?: string;
}) {
  return (
    <box flexDirection="column">
      <text
        fg={
          props.selected
            ? darkTheme.accent
            : props.picked
              ? darkTheme.success
              : darkTheme.text
        }
      >
        {props.index + 1}.{" "}
        {props.multiple ? `[${props.picked ? "x" : " "}] ` : ""}
        {props.label}
      </text>
      <Show when={props.description}>
        <text fg={darkTheme.muted} paddingLeft={3} wrapMode="word">
          {props.description}
        </text>
      </Show>
    </box>
  );
}

function QuestionReview(props: {
  questions: Array<{ header: string }>;
  answers: string[][];
}) {
  return (
    <box flexDirection="column" gap={1}>
      <text fg={darkTheme.text}>Review answers</text>
      <For each={props.questions}>
        {(question, index) => (
          <text
            fg={
              props.answers[index()]?.length ? darkTheme.text : darkTheme.danger
            }
          >
            {question.header}:{" "}
            {props.answers[index()]?.join(", ") || "(not answered)"}
          </text>
        )}
      </For>
    </box>
  );
}

function ModalActions(props: {
  actions: string[];
  selected: number;
  onSelect(index: number): void;
  onConfirm(): void;
  onQuickSelect(index: number): void;
  onCancel(): void;
  onToggleDetail(): void;
  onExit(): void;
}) {
  return (
    <ModalKeyCapture
      onExit={props.onExit}
      onKey={(key) => {
        if (key === "left" || key === "up")
          props.onSelect(
            (props.selected + props.actions.length - 1) % props.actions.length,
          );
        if (key === "right" || key === "down" || key === "tab")
          props.onSelect((props.selected + 1) % props.actions.length);
        if (/^[1-9]$/.test(key))
          props.onQuickSelect(
            Math.min(Number(key) - 1, props.actions.length - 1),
          );
        if (key === "return") props.onConfirm();
        if (key === "escape") props.onCancel();
        if (key === "d") props.onToggleDetail();
      }}
    >
      <box flexDirection="row" justifyContent="space-between" gap={1}>
        <For each={props.actions}>
          {(action, index) => (
            <box
              backgroundColor={
                index() === props.selected ? darkTheme.warning : darkTheme.panel
              }
              paddingLeft={1}
              paddingRight={1}
            >
              <text
                fg={
                  index() === props.selected
                    ? darkTheme.background
                    : darkTheme.text
                }
              >
                {action}
              </text>
            </box>
          )}
        </For>
        <text fg={darkTheme.muted}>
          ←→ select · 1-9 quick · enter confirm · esc reject · d raw detail
        </text>
      </box>
    </ModalKeyCapture>
  );
}

function QuestionActions(props: {
  confirm: boolean;
  editing: boolean;
  multiple: boolean;
  selected: number;
  max: number;
  onMove(delta: number): void;
  onTab(delta: number): void;
  onSelect(): void;
  onQuickSelect(index: number): void;
  onReject(): void;
  onExit(): void;
}) {
  return (
    <ModalKeyCapture
      enabled={!props.editing}
      onExit={props.onExit}
      onKey={(key) => {
        if (key === "up") props.onMove(-1);
        if (key === "down") props.onMove(1);
        if (key === "left") props.onTab(-1);
        if (key === "right" || key === "tab") props.onTab(1);
        if (/^[1-9]$/.test(key))
          props.onQuickSelect(
            Math.min(Number(key) - 1, Math.max(0, props.max - 1)),
          );
        if (key === "return") props.onSelect();
        if (key === "escape") props.onReject();
      }}
    >
      <box flexDirection="row" gap={2}>
        <text fg={darkTheme.text}>Tab/→ next</text>
        <text fg={darkTheme.text}>← back</text>
        <text fg={darkTheme.text}>↑↓ select</text>
        <text fg={darkTheme.text}>1-{Math.min(9, props.max)} quick</text>
        <text fg={darkTheme.text}>
          enter{" "}
          {props.confirm ? "submit" : props.multiple ? "toggle" : "select"}
        </text>
        <Show when={props.multiple && !props.confirm}>
          <text fg={darkTheme.muted}>
            Tab/→ to Confirm; Enter there submits
          </text>
        </Show>
        <text fg={darkTheme.text}>esc reject</text>
      </box>
    </ModalKeyCapture>
  );
}

function ModalKeyCapture(props: {
  children: JSX.Element;
  enabled?: boolean;
  onKey(key: string): void;
  onExit?: () => void;
}) {
  void props.enabled;
  void props.onKey;
  void props.onExit;
  return (
    <box flexDirection="column" gap={1}>
      {props.children}
    </box>
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
