import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { TextAttributes } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import type { RuntimeClient } from "@natalia/contracts";
import { activeModal } from "@natalia/ui-model";
import {
  collapseToolOutput,
  parseTodoItems,
  stripAnsiOutput,
} from "@natalia/ui-model";
import { useAppState, type MessageBlock } from "../../context/state";
import { roleColor, themeTokens as darkTheme } from "../../theme/theme";
import { terminalPreview } from "../../terminal-preview";
import type { TuiPreferences } from "../../settings";
import { timelineLayout } from "../../session-layout";
import { useRouteController } from "../../context/route";
import { useDialog } from "../../dialog/provider";
import { Dialog } from "../../dialog/Dialog";
import { DialogPrompt } from "../../dialog/DialogPrompt";
import { PermissionPrompt } from "./permission";
import { QuestionPrompt } from "./question";
import {
  TimelineVirtualizer,
  groupTimelineBlocks,
  type TimelineRange,
} from "./timeline-virtualizer";
import {
  filetype,
  formatToolPath,
  formatPrimitiveArgs,
  parseExecuteCalls,
  parseQuestionAnswers,
  parseResultRecord,
  stringField,
  subagentColor,
  toolColor,
  toolIcon,
  toolInput,
  toolPath,
  toolRecord,
} from "./tool-utils";
import { markdownSyntax, ToolBlockView } from "./tool-views";



export function SessionRoute(props: {
  scrollRef?: { current?: any };
  terminalScrollRef?: { current?: any };
  followBottom?: boolean;
  onFollowChange?: (follow: boolean) => void;
  density?: TuiPreferences["density"];
  toolDetails?: TuiPreferences["toolDetails"];
  diffStyle?: TuiPreferences["diffStyle"];
  terminalWidth?: number;
  toolPreviewLines?: number;
  showJumpToBottom?: boolean;
  onJumpToBottom?: () => void;
  onMessageCopy?: (text: string) => void;
  onMessageFork?: (turnID: string, prompt: string) => void;
  onLoadOlderHistory?: () => Promise<void>;
  onLoadNewerHistory?: () => Promise<void>;
  backend?: RuntimeClient;
  onExit?: () => void;
}) {
  const { state, dispatch } = useAppState();
  const layout = () => timelineLayout(props.terminalWidth ?? 80);
  const modal = createMemo(() => activeModal(state.modal));
  const timelineGroups = createMemo(() => groupTimelineBlocks(state.messages));
  const virtualizer = new TimelineVirtualizer<MessageBlock>(24);
  const [timelineRange, setTimelineRange] = createSignal<
    TimelineRange<MessageBlock>
  >({ items: [], top: 0, bottom: 0, total: 0 });
  const renderedGroups = new Map<string, any>();
  let timelineScroll: any;
  let measuring = false;
  let observedScrollTop = -1;
  let wasAtTop = false;
  let wasAtBottom = false;
  const scrollObserver = setInterval(() => {
    if (!timelineScroll || timelineScroll.isDestroyed) return;
    const scrollTop = timelineScroll.scrollTop ?? 0;
    if (scrollTop === observedScrollTop) return;
    observedScrollTop = scrollTop;
    const isAtTop = scrollTop <= 1;
    if (isAtTop && !wasAtTop) void props.onLoadOlderHistory?.();
    wasAtTop = isAtTop;
    const isAtBottom =
      scrollTop + viewportHeight() >=
      virtualizer.range(scrollTop, viewportHeight()).total - 1;
    if (isAtBottom) props.onFollowChange?.(true);
    if (isAtBottom && !wasAtBottom) void props.onLoadNewerHistory?.();
    wasAtBottom = isAtBottom;
    updateRange();
    measureRenderedGroups();
  }, 50);
  onCleanup(() => clearInterval(scrollObserver));

  const viewportHeight = () => timelineScroll?.viewport?.height ?? 1;
  const updateRange = () => {
    if (!timelineScroll || timelineScroll.isDestroyed) return;
    setTimelineRange(
      virtualizer.range(timelineScroll.scrollTop ?? 0, viewportHeight()),
    );
  };
  const measureRenderedGroups = () => {
    if (measuring || !timelineScroll || timelineScroll.isDestroyed) return;
    measuring = true;
    queueMicrotask(() => {
      measuring = false;
      if (!timelineScroll || timelineScroll.isDestroyed) return;
      const scrollTop = timelineScroll.scrollTop ?? 0;
      if (scrollTop !== observedScrollTop) {
        observedScrollTop = scrollTop;
        updateRange();
      }
      let adjustment = 0;
      for (const [key, element] of renderedGroups) {
        if (!element || element.isDestroyed) continue;
        const measured = virtualizer.measure(
          key,
          element.height ?? 1,
          (timelineScroll.scrollTop ?? 0) + adjustment,
          viewportHeight(),
        );
        adjustment += measured.adjustment;
      }
      if (adjustment && !props.followBottom)
        timelineScroll.scrollTop += adjustment;
      observedScrollTop = timelineScroll.scrollTop ?? 0;
      updateRange();
    });
  };

  createEffect(() => {
    const groups = timelineGroups();
    const scrollTop = timelineScroll?.scrollTop ?? 0;
    const result = virtualizer.replace(groups, scrollTop, viewportHeight());
    const visibleKeys = new Set(result.range.items.map((group) => group.key));
    for (const key of renderedGroups.keys())
      if (!visibleKeys.has(key)) renderedGroups.delete(key);
    setTimelineRange(result.range);
    if (result.adjustment && timelineScroll && !props.followBottom)
      queueMicrotask(() => {
        if (!timelineScroll || timelineScroll.isDestroyed) return;
        timelineScroll.scrollTop += result.adjustment;
        updateRange();
      });
    measureRenderedGroups();
  });
  return (
    <box flexGrow={1} minHeight={0} flexDirection="column" width="100%">
      <scrollbox
        ref={(r: any) => {
          if (props.scrollRef) props.scrollRef.current = r;
          timelineScroll = r;
          updateRange();
        }}
        flexGrow={1}
        stickyScroll={props.followBottom ?? true}
        stickyStart="bottom"
        paddingLeft={layout().horizontalPadding}
        paddingRight={layout().horizontalPadding}
      >
        <box height={timelineRange().top} flexShrink={0} />
        <For each={timelineRange().items}>
          {(group) => (
            <box
              flexDirection="column"
              ref={(element: any) => {
                renderedGroups.set(group.key, element);
                measureRenderedGroups();
              }}
            >
              <For each={group.items}>
                {(block) => (
                  <MessageBlockView
                    block={block}
                    backend={props.backend}
                    onCopy={props.onMessageCopy}
                    onFork={props.onMessageFork}
                    density={props.density ?? "comfortable"}
                    toolDetails={props.toolDetails ?? "collapsed"}
                    diffStyle={props.diffStyle ?? "auto"}
                    terminalWidth={props.terminalWidth ?? 80}
                    toolPreviewLines={props.toolPreviewLines ?? 10}
                  />
                )}
              </For>
            </box>
          )}
        </For>
        <box height={timelineRange().bottom} flexShrink={0} />
        <Show when={state.messages.length === 0}>
          <box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight={12}
            gap={1}
          >
            <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
              {state.title}
            </text>
            <text fg={darkTheme.muted}>Start a new task below</text>
          </box>
        </Show>
      </scrollbox>
      <Show when={props.backend && modal()?.kind === "approval"}>
        <Dialog dismissible={false} size="medium" onClose={() => undefined}>
          <PermissionPrompt
            request={
              modal() as Extract<ReturnType<typeof modal>, { kind: "approval" }>
            }
            backend={props.backend!}
            onExit={props.onExit ?? (() => {})}
          />
        </Dialog>
      </Show>
      <Show when={props.backend && modal()?.kind === "question"}>
        <Dialog dismissible={false} size="medium" onClose={() => undefined}>
          <QuestionPrompt
            request={
              modal() as Extract<ReturnType<typeof modal>, { kind: "question" }>
            }
            backend={props.backend!}
            onExit={props.onExit ?? (() => {})}
          />
        </Dialog>
      </Show>
      <Show when={props.showJumpToBottom}>
        <box
          position="absolute"
          bottom={1}
          alignSelf="center"
          backgroundColor={darkTheme.panel}
          border
          borderColor={darkTheme.muted}
          paddingLeft={1}
          paddingRight={1}
          onMouseUp={props.onJumpToBottom}
        >
          <text fg={darkTheme.text}>↓ Jump to latest</text>
        </box>
      </Show>
      <Show when={state.terminalPane.selectedID}>
        {(selectedID) => {
          const terminal = () => state.terminals[selectedID()];
          return (
            <Show when={terminal()}>
              <ModelTerminalPane
                terminal={terminal()!}
                timeline={state.terminalTimeline[selectedID()] ?? []}
                sessions={Object.values(state.terminals).filter(
                  (item) =>
                    item.ownership === "model" &&
                    item.status !== "exited" &&
                    item.status !== "failed",
                )}
                onSelect={(id) =>
                  dispatch({ type: "terminal.pane.select", id })
                }
                focus={state.terminalPane.focus}
                onFocus={() =>
                  dispatch({ type: "terminal.pane.focus", focus: "terminal" })
                }
                scrollRef={props.terminalScrollRef}
              />
            </Show>
          );
        }}
      </Show>
      <Show when={state.retryBanner}>
        {(retry) => (
          <box flexShrink={0} paddingLeft={1} backgroundColor={darkTheme.panel}>
            <text fg={darkTheme.warning}>{retry()}</text>
          </box>
        )}
      </Show>
      <Show when={state.compactionBanner}>
        {(banner) => (
          <box flexShrink={0} paddingLeft={1} backgroundColor={darkTheme.panel}>
            <text fg={darkTheme.accent}>{banner()}</text>
          </box>
        )}
      </Show>
    </box>
  );
}

export function SessionFooter(props: { workspaceRoot?: string }) {
  const { state } = useAppState();
  const pending = state.dialog === "approval" || state.dialog === "question";
  return (
    <box
      flexShrink={0}
      flexDirection="row"
      justifyContent="space-between"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={darkTheme.muted}>{compactPath(props.workspaceRoot)}</text>
      <box flexDirection="row" gap={2} flexShrink={0}>
        <Show when={pending}>
          <text fg={darkTheme.warning}>△ Action required</text>
        </Show>
        <Show when={Object.keys(state.terminals).length > 0}>
          <text fg={darkTheme.text}>
            <span style={{ fg: darkTheme.success }}>•</span>{" "}
            {Object.keys(state.terminals).length} terminal
          </text>
        </Show>
        <Show when={Object.keys(state.sandboxes).length > 0}>
          <text fg={darkTheme.text}>
            <span style={{ fg: darkTheme.success }}>•</span>{" "}
            {Object.keys(state.sandboxes).length} Sandbox
          </text>
        </Show>
        <text fg={state.status === "ready" ? darkTheme.text : darkTheme.muted}>
          <span
            style={{
              fg:
                state.status === "ready"
                  ? darkTheme.success
                  : state.status === "error"
                    ? darkTheme.danger
                    : darkTheme.warning,
            }}
          >
            •
          </span>{" "}
          {state.status}
        </text>
        <text fg={darkTheme.muted}>/status</text>
      </box>
    </box>
  );
}

export function SessionSidebar(props: {
  width?: number;
  workspaceRoot?: string;
  overlay?: boolean;
  compact?: boolean;
}) {
  const { state } = useAppState();
  const route = useRouteController();
  const values = () => statusValues(state.statusSegments);
  const tools = () => Object.values(state.tools);
  return (
    <box
      width={props.width ?? 42}
      height="100%"
      flexShrink={0}
      position={props.overlay ? "absolute" : "relative"}
      right={props.overlay ? 0 : undefined}
      top={props.overlay ? 0 : undefined}
      bottom={props.overlay ? 0 : undefined}
      zIndex={props.overlay ? 20 : undefined}
      backgroundColor={darkTheme.panel}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
    >
      <scrollbox flexGrow={1}>
        <box flexDirection="column" gap={1} paddingRight={1}>
          <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
            {state.title}
          </text>
          <Show when={state.sessionID}>
            <text fg={darkTheme.muted}>{state.sessionID}</text>
          </Show>
          <Show when={props.workspaceRoot && !props.compact}>
            <text fg={darkTheme.muted}>{compactPath(props.workspaceRoot)}</text>
          </Show>
          <box marginTop={1} flexDirection="column">
            <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
              Context
            </text>
            <text fg={darkTheme.muted}>{values().ctx ?? "pending"}</text>
            <Show when={!props.compact}>
              <text fg={darkTheme.muted}>
                {values().model ?? "model not selected"}
              </text>
              <text fg={darkTheme.muted}>
                {values().provider ?? "provider not selected"}
              </text>
            </Show>
          </box>
          <Show when={state.todos.length > 0}>
            <box marginTop={1} flexDirection="column">
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                Todo
              </text>
              <For each={state.todos}>
                {(todo) => (
                  <text
                    fg={
                      todo.status === "in_progress"
                        ? darkTheme.warning
                        : darkTheme.muted
                    }
                    wrapMode="word"
                  >
                    {todo.status === "completed"
                      ? "✓"
                      : todo.status === "in_progress"
                        ? "•"
                        : "○"}{" "}
                    {todo.content}
                  </text>
                )}
              </For>
            </box>
          </Show>
          <Show
            when={
              Object.values(state.subagents).filter(
                (agent) => !agent.parentAgentID,
              ).length > 0
            }
          >
            <box marginTop={1} flexDirection="column">
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                Agents
              </text>
              <For
                each={Object.values(state.subagents).filter(
                  (agent) => !agent.parentAgentID,
                )}
              >
                {(agent) => (
                  <box flexDirection="column">
                    <text
                      fg={subagentColor(agent.status)}
                      onMouseUp={() =>
                        route.push({ kind: "subagent", id: agent.id })
                      }
                    >
                      {agent.status === "completed" ? "✓" : "│"} {agent.id}
                    </text>
                    <Show when={agent.task && !props.compact}>
                      <text
                        paddingLeft={2}
                        fg={darkTheme.muted}
                        wrapMode="word"
                      >
                        {agent.task}
                      </text>
                    </Show>
                  </box>
                )}
              </For>
            </box>
          </Show>
          <Show when={tools().length > 0 && !props.compact}>
            <box marginTop={1} flexDirection="column">
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                Tools
              </text>
              <For each={tools().slice(-8)}>
                {(tool) => (
                  <text fg={toolColor(tool.status)}>
                    {tool.status === "succeeded" ? "✓" : "•"} {tool.name}
                  </text>
                )}
              </For>
            </box>
          </Show>
          <Show
            when={Object.values(state.sandboxes).length > 0 && !props.compact}
          >
            <box marginTop={1} flexDirection="column">
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                Workspace
              </text>
              <For each={Object.values(state.sandboxes)}>
                {(sandbox) => (
                  <text fg={darkTheme.muted}>
                    {sandbox.changedFiles} changed · {sandbox.runningResources}{" "}
                    running
                  </text>
                )}
              </For>
            </box>
          </Show>
        </box>
      </scrollbox>
      <text fg={darkTheme.muted}>
        <span style={{ fg: darkTheme.success }}>•</span> <b>Natalia</b> local
      </text>
    </box>
  );
}

function statusValues(segments: string[]) {
  return Object.fromEntries(
    segments.flatMap((segment) => {
      const index = segment.indexOf(":");
      return index < 0
        ? []
        : [[segment.slice(0, index), segment.slice(index + 1)]];
    }),
  ) as Record<string, string>;
}

function compactPath(path?: string) {
  if (!path) return "local workspace";
  const home = process.env.HOME;
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function ModelTerminalPane(props: {
  terminal: Extract<
    ReturnType<typeof useAppState>["state"]["terminals"][string],
    { type: "terminal.update" }
  >;
  timeline: Extract<
    ReturnType<typeof useAppState>["state"]["terminalTimeline"][string][number],
    { type: "terminal.timeline" }
  >[];
  sessions: Extract<
    ReturnType<typeof useAppState>["state"]["terminals"][string],
    { type: "terminal.update" }
  >[];
  onSelect(id: string): void;
  focus: "chat" | "terminal";
  onFocus(): void;
  scrollRef?: { current?: any };
}) {
  const target = () =>
    props.terminal.target.kind === "host"
      ? `host:${props.terminal.target.cwd}`
      : `sandbox:${props.terminal.target.sandboxID}:${props.terminal.target.isolationLevel}`;
  return (
    <box
      flexShrink={0}
      flexDirection="column"
      border
      borderColor={
        props.focus === "terminal" ? darkTheme.accent : darkTheme.muted
      }
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      marginTop={1}
      marginBottom={1}
      backgroundColor={darkTheme.panel}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text
          fg={props.focus === "terminal" ? darkTheme.accent : darkTheme.muted}
          attributes={TextAttributes.BOLD}
        >
          Terminal Preview · model control · {props.terminal.status}
        </text>
        <text fg={darkTheme.muted} onMouseUp={props.onFocus}>
          {props.focus === "terminal"
            ? "preview focus · Ctrl+T chat"
            : "Ctrl+T preview · F8 manage"}
        </text>
      </box>
      <Show when={props.sessions.length > 1}>
        <box flexDirection="row" gap={1}>
          <For each={props.sessions}>
            {(session, index) => (
              <text
                fg={
                  session.id === props.terminal.id
                    ? darkTheme.accent
                    : darkTheme.muted
                }
                attributes={
                  session.id === props.terminal.id ? TextAttributes.BOLD : undefined
                }
                onMouseUp={() => props.onSelect(session.id)}
              >
                {index() + 1}:{session.id} {session.status}
              </text>
            )}
          </For>
        </box>
      </Show>
      <text fg={darkTheme.muted}>
        {props.terminal.id} · {target()} · {props.terminal.cwd} · {props.terminal.rows}x
        {props.terminal.cols} · prompt {props.terminal.prompt ?? "-"}
        {" · "}
        {props.terminal.inputOwner?.type === "viewer"
          ? `user control (${props.terminal.inputOwner.viewerID})`
          : "model control"}
        {` · ${props.terminal.viewers?.length ?? 0} viewer(s)`}
      </text>
      <Show when={props.terminal.approvalID}>
        <text fg={darkTheme.warning}>
          Awaiting user approval: {props.terminal.approvalID}. Model writes are
          paused.
        </text>
      </Show>
      <For each={terminalPreview(props.terminal.screen?.text ?? props.terminal.tail)}>
        {(line) => (
          <text fg={darkTheme.muted} wrapMode="none">
            {line}
          </text>
        )}
      </For>
      <text fg={darkTheme.muted}>
        Preview is read-only and never resizes the terminal.
      </text>
    </box>
  );
}

function MessageBlockView(props: {
  block: MessageBlock;
  backend?: RuntimeClient;
  onCopy?: (text: string) => void;
  onFork?: (turnID: string, prompt: string) => void;
  density: TuiPreferences["density"];
  toolDetails: TuiPreferences["toolDetails"];
  diffStyle: TuiPreferences["diffStyle"];
  terminalWidth: number;
  toolPreviewLines: number;
}) {
  if (props.block.interactive)
    return (
      <InlineInteractiveBlock block={props.block} backend={props.backend} />
    );
  if (props.block.tool)
    return (
      <ToolBlockView
        block={props.block}
        toolDetails={props.toolDetails}
        diffStyle={props.diffStyle}
        terminalWidth={props.terminalWidth}
        toolPreviewLines={props.toolPreviewLines}
      />
    );
  const isUser = props.block.role === "user";
  const isThinking = props.block.role === "thinking";
  const isAssistant = props.block.role === "assistant";
  const isCopyable = isUser || isThinking || isAssistant;
  return (
    <box
      flexDirection="column"
      marginTop={props.density === "comfortable" ? 1 : 0}
      border={isThinking || isAssistant ? ["left"] : []}
      borderColor={isThinking ? darkTheme.muted : darkTheme.accent}
      paddingLeft={isThinking || isAssistant ? 1 : 0}
    >
      <box flexDirection="row" gap={1}>
        <text
          fg={isUser ? darkTheme.accent : darkTheme.muted}
          attributes={TextAttributes.BOLD}
        >
          {isUser
            ? "▎You"
            : props.block.role === "system"
              ? " System"
              : props.block.role === "assistant"
                ? " Natalia"
                : props.block.role === "subagent"
                  ? " Subagent"
                  : ` ${props.block.role.charAt(0).toUpperCase()}${props.block.role.slice(1)}`}
        </text>
        {props.block.status ? (
          <text fg={darkTheme.muted}>[{props.block.status}]</text>
        ) : null}
        {props.block.role === "thinking" &&
        props.block.providerPolicy === "hidden" ? (
          <text fg={darkTheme.warning}>provider-safe</text>
        ) : null}
        <Show when={isCopyable && (props.onCopy || (isUser && props.onFork))}>
          <box flexDirection="row" gap={1}>
            <Show when={props.onCopy}>
              <text
                fg={darkTheme.muted}
                onMouseUp={() => props.onCopy?.(props.block.text)}
              >
                copy
              </text>
            </Show>
            <Show when={isUser && props.onFork}>
              <text
                fg={darkTheme.muted}
                onMouseUp={() =>
                  props.onFork?.(props.block.id, props.block.text)
                }
              >
                fork
              </text>
            </Show>
          </box>
        </Show>
      </box>
      <BlockBody block={props.block} toolDetails={props.toolDetails} />
    </box>
  );
}

function InlineInteractiveBlock(props: {
  block: MessageBlock;
  backend?: RuntimeClient;
}) {
  const dialog = useDialog();
  const interactive = () => props.block.interactive!;
  const resolved = () => Boolean(interactive().response);
  const approval = () => {
    const value = interactive();
    return value.kind === "approval" ? value : undefined;
  };
  const question = () => {
    const value = interactive();
    return value.kind === "question" ? value : undefined;
  };
  const [answers, setAnswers] = createSignal<string[][]>([]);
  const answer = (index: number, value: string, multiple = false) => {
    const next = [...answers()];
    const current = next[index] ?? [];
    next[index] = multiple
      ? current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
      : [value];
    setAnswers(next);
  };
  const respondApproval = (decision: "once" | "session" | "reject") => {
    const value = interactive();
    if (value.kind !== "approval" || resolved()) return;
    props.backend?.respondApproval({ requestID: value.request.id, decision });
  };
  const respondQuestion = (rejected = false) => {
    const value = interactive();
    if (value.kind !== "question" || resolved()) return;
    props.backend?.respondQuestion({
      requestID: value.request.id,
      answers: rejected
        ? []
        : (value.request.questions?.map((_, index) => answers()[index] ?? []) ??
          []),
      rejected,
    });
  };
  const addCustomAnswer = (questionIndex: number, multiple: boolean) => {
    void DialogPrompt.show(dialog, "Type your own answer", {
      placeholder: "Enter answer",
    }).then((value) => {
      if (value === null || !value.trim() || resolved()) return;
      answer(questionIndex, value.trim(), multiple);
    });
  };

  return (
    <box
      flexDirection="column"
      border={["left"]}
      borderColor={
        interactive().kind === "approval" ? darkTheme.warning : darkTheme.accent
      }
      paddingLeft={1}
      marginTop={1}
    >
      <Show when={interactive().kind === "approval"}>
        <box flexDirection="column" gap={1}>
          <text fg={darkTheme.warning} attributes={TextAttributes.BOLD}>
            △ Permission {resolved() ? props.block.status : "required"}
          </text>
          <text fg={darkTheme.text} wrapMode="word">
            {approval()?.request.title}
          </text>
          <text fg={darkTheme.muted} wrapMode="word">
            {approval()?.request.preview}
          </text>
          <Show when={approval()?.response}>
            <text fg={darkTheme.muted}>{props.block.text}</text>
          </Show>
          <Show when={!resolved()}>
            <box flexDirection="row" gap={1}>
              <InlineAction
                label="Allow once"
                onSelect={() => respondApproval("once")}
              />
              <InlineAction
                label="Allow session"
                onSelect={() => respondApproval("session")}
              />
              <InlineAction
                label="Reject"
                onSelect={() => respondApproval("reject")}
              />
            </box>
          </Show>
        </box>
      </Show>
      <Show when={interactive().kind === "question"}>
        <box flexDirection="column" gap={1}>
          <text fg={darkTheme.accent} attributes={TextAttributes.BOLD}>
            ? {resolved() ? props.block.status : "Question"}
          </text>
          <text fg={darkTheme.text} wrapMode="word">
            {question()?.request.title}
          </text>
          <Show when={!resolved()}>
            <For each={question()?.request.questions ?? []}>
              {(question, questionIndex) => (
                <box flexDirection="column" paddingLeft={1}>
                  <text fg={darkTheme.text} wrapMode="word">
                    {question.question}
                  </text>
                  <For each={question.options}>
                    {(option) => (
                      <InlineAction
                        label={`${(answers()[questionIndex()] ?? []).includes(option.label) ? "[x]" : "[ ]"} ${option.label}`}
                        detail={option.description}
                        onSelect={() =>
                          answer(
                            questionIndex(),
                            option.label,
                            question.multiple,
                          )
                        }
                      />
                    )}
                  </For>
                  <Show when={question.custom !== false}>
                    <InlineAction
                      label={`[ ] Type your own answer${(answers()[questionIndex()] ?? []).some((answer) => !question.options.some((option) => option.label === answer)) ? " (added)" : ""}`}
                      onSelect={() =>
                        addCustomAnswer(
                          questionIndex(),
                          question.multiple === true,
                        )
                      }
                    />
                  </Show>
                </box>
              )}
            </For>
            <box flexDirection="row" gap={1}>
              <InlineAction
                label="Submit answers"
                onSelect={() => respondQuestion()}
              />
              <InlineAction
                label="Reject"
                onSelect={() => respondQuestion(true)}
              />
            </box>
          </Show>
          <Show when={resolved()}>
            <text fg={darkTheme.muted}>{props.block.text}</text>
          </Show>
        </box>
      </Show>
    </box>
  );
}

function InlineAction(props: {
  label: string;
  detail?: string;
  onSelect(): void;
}) {
  return (
    <box flexDirection="column" onMouseUp={props.onSelect} paddingRight={1}>
      <text fg={darkTheme.accent}>{props.label}</text>
      <Show when={props.detail}>
        <text fg={darkTheme.muted} paddingLeft={2} wrapMode="word">
          {props.detail}
        </text>
      </Show>
    </box>
  );
}

function BlockBody(props: {
  block: MessageBlock;
  toolDetails: TuiPreferences["toolDetails"];
}) {
  if (props.block.role === "assistant") {
    return (
      <box flexDirection="column">
        <markdown
          content={props.block.text}
          streaming={true}
          syntaxStyle={markdownSyntax()}
          fg={darkTheme.text}
        />
        <Show when={props.block.pendingText}>
          <text fg={darkTheme.muted} wrapMode="word">
            {props.block.pendingText}
          </text>
        </Show>
      </box>
    );
  }
  if (props.block.role === "thinking") {
    return (
      <box flexDirection="column">
        <text fg={darkTheme.muted} wrapMode="word">
          {props.block.text || "Thinking..."}
        </text>
        <Show when={props.block.pendingText}>
          <text fg={darkTheme.muted} wrapMode="word">
            {props.block.pendingText}
          </text>
        </Show>
      </box>
    );
  }
  return (
    <text
      fg={roleColor(props.block.role, darkTheme)}
      wrapMode="word"
      paddingLeft={1}
    >
      {props.block.text}
    </text>
  );
}

export function SubagentRoute(props: { agentID: string; onBack(): void }) {
  const { state } = useAppState();
  const agent = () => state.subagents[props.agentID];
  const history = () => state.subagentHistory[props.agentID] ?? [];
  const children = () =>
    Object.values(state.subagents).filter(
      (candidate) => candidate.parentAgentID === props.agentID,
    );
  const route = useRouteController();
  useBindings(() => ({
    mode: "base",
    bindings: [
      {
        key: "escape",
        desc: "Return from subagent detail",
        group: "Subagent",
        cmd: props.onBack,
      },
    ],
  }));
  return (
    <box flexGrow={1} minHeight={0} flexDirection="column">
      <scrollbox flexGrow={1} paddingLeft={3} paddingRight={3} paddingTop={1}>
        <box flexDirection="column" gap={1}>
          <Show when={!agent()}>
            <text fg={darkTheme.warning}>Subagent state is not available.</text>
          </Show>
          <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
            {agent()?.task || props.agentID}
          </text>
          <text fg={darkTheme.muted}>{props.agentID}</text>
          <Show when={agent()}>
            {(value) => (
              <box flexDirection="row" gap={2}>
                <text fg={subagentColor(value().status)}>{value().status}</text>
                <text fg={darkTheme.muted}>
                  {value().attached ? "attached" : "detached"}
                </text>
              </box>
            )}
          </Show>
          <Show when={agent()?.parentAgentID}>
            <text fg={darkTheme.muted}>Parent: {agent()!.parentAgentID}</text>
          </Show>
          <Show when={children().length > 0}>
            <box marginTop={1} flexDirection="column" gap={1}>
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                Child agents
              </text>
              <For each={children()}>
                {(child) => (
                  <text
                    fg={subagentColor(child.status)}
                    onMouseUp={() =>
                      route.push({ kind: "subagent", id: child.id })
                    }
                  >
                    {child.status === "completed" ? "✓" : "│"} {child.id} ·{" "}
                    {child.status}
                  </text>
                )}
              </For>
            </box>
          </Show>
          <box marginTop={1} flexDirection="column" gap={1}>
            <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
              Activity
            </text>
            <For each={history()}>
              {(event) => (
                <box flexDirection="column">
                  <text fg={subagentColor(event.status)}>
                    {event.event} · {event.status}
                  </text>
                  <Show when={event.text}>
                    <text paddingLeft={2} fg={darkTheme.muted} wrapMode="word">
                      {event.text}
                    </text>
                  </Show>
                </box>
              )}
            </For>
          </box>
        </box>
      </scrollbox>
      <box
        flexShrink={0}
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        border={["top"]}
        borderColor={darkTheme.muted}
      >
        <text fg={darkTheme.muted}>Subagent detail · read-only</text>
        <text fg={darkTheme.text} onMouseUp={props.onBack}>
          Escape return
        </text>
      </box>
    </box>
  );
}

function ToolPanel(props: {
  title: string;
  tool: NonNullable<MessageBlock["tool"]>;
  children: unknown;
}) {
  const renderer = useRenderer();
  const [hover, setHover] = createSignal(false);
  const [errorExpanded, setErrorExpanded] = createSignal(false);
  const failed = () =>
    props.tool.status === "failed" || props.tool.status === "cancelled";
  const error = () =>
    props.tool.result?.detail ||
    props.tool.result?.preview ||
    props.tool.summary;
  return (
    <box
      border={["left"]}
      borderColor={darkTheme.background}
      backgroundColor={hover() ? darkTheme.background : darkTheme.panel}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      marginTop={1}
      gap={1}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => {
        if (renderer.getSelection()?.getSelectedText()) return;
        if (failed()) setErrorExpanded((value) => !value);
      }}
    >
      <text paddingLeft={3} fg={darkTheme.muted}>
        {props.title}
        {props.tool.elapsed ? ` · ${props.tool.elapsed}` : ""}
      </text>
      {props.children as never}
      <Show when={failed()}>
        <box flexDirection="column" gap={1}>
          <text fg={darkTheme.danger} wrapMode="word">
            {props.tool.summary}
          </text>
          <Show when={errorExpanded() && error() !== props.tool.summary}>
            <text fg={darkTheme.danger} wrapMode="word">
              {error()}
            </text>
          </Show>
          <Show when={error() !== props.tool.summary}>
            <text fg={darkTheme.muted}>
              {errorExpanded()
                ? "Click to hide error detail"
                : "Click to show error detail"}
            </text>
          </Show>
        </box>
      </Show>
    </box>
  );
}

function ShellToolView(props: {
  block: MessageBlock;
  terminalWidth: number;
  previewLines: number;
}) {
  const renderer = useRenderer();
  const tool = () => props.block.tool!;
  const input = createMemo(() => toolInput(tool().redactedArguments));
  const output = createMemo(() =>
    stripAnsiOutput(tool().result?.detail ?? "").trim(),
  );
  const [expanded, setExpanded] = createSignal(false);
  const [hover, setHover] = createSignal(false);
  const collapsed = createMemo(() =>
    collapseToolOutput(
      output(),
      props.previewLines,
      props.previewLines * Math.max(20, props.terminalWidth - 6),
    ),
  );
  const visibleOutput = createMemo(() =>
    expanded() || !collapsed().overflow ? output() : collapsed().output,
  );
  const failed = () =>
    tool().status === "failed" ||
    tool().status === "rejected" ||
    tool().status === "cancelled";
  const running = () => tool().status === "running";
  const pending = () =>
    tool().status === "receiving_arguments" || tool().status === "queued";

  if (!tool().result)
    return (
      <box paddingLeft={3} marginTop={1} flexDirection="row">
        <text width={2} fg={failed() ? darkTheme.danger : darkTheme.muted}>
          {running() ? "│" : failed() ? "✗" : "$"}
        </text>
        <text
          flexGrow={1}
          fg={
            failed()
              ? darkTheme.danger
              : tool().status === "awaiting_approval"
                ? darkTheme.warning
                : pending()
                  ? darkTheme.text
                  : darkTheme.muted
          }
          attributes={
            tool().status === "rejected"
              ? TextAttributes.STRIKETHROUGH
              : undefined
          }
        >
          {input().command ||
            (pending() ? "Writing command..." : tool().summary)}
        </text>
      </box>
    );

  return (
    <box
      border={["left"]}
      borderColor={darkTheme.background}
      backgroundColor={hover() ? darkTheme.background : darkTheme.panel}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      marginTop={1}
      gap={1}
      onMouseOver={() => collapsed().overflow && setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => {
        if (renderer.getSelection()?.getSelectedText()) return;
        if (collapsed().overflow) setExpanded((value) => !value);
      }}
    >
      <Show when={input().workdir && input().workdir !== "."}>
        <text paddingLeft={3} fg={darkTheme.muted}>
          # Running in {input().workdir}
        </text>
      </Show>
      <box gap={1}>
        <Show
          when={running()}
          fallback={
            <text fg={failed() ? darkTheme.danger : darkTheme.text}>
              $ {input().command || tool().name}
              {tool().elapsed ? ` · ${tool().elapsed}` : ""}
            </text>
          }
        >
          <ShellSpinner command={input().command || tool().name} />
        </Show>
        <Show when={output()}>
          <text
            fg={failed() ? darkTheme.danger : darkTheme.text}
            wrapMode="word"
          >
            {visibleOutput()}
          </text>
        </Show>
        <Show when={collapsed().overflow}>
          <text fg={darkTheme.muted}>
            {expanded() ? "Click to collapse" : "Click to expand"}
          </text>
        </Show>
      </box>
    </box>
  );
}

function ShellSpinner(props: { command: string }) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const [index, setIndex] = createSignal(0);
  createEffect(() => {
    const timer = setInterval(
      () => setIndex((value) => (value + 1) % frames.length),
      80,
    );
    onCleanup(() => clearInterval(timer));
  });
  return (
    <text fg={darkTheme.text}>
      {frames[index()]} {props.command}
    </text>
  );
}


