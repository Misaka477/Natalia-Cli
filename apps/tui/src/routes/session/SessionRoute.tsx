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
import { selectPrimaryActivity, type ActivityView } from "@natalia/view-store";
import { activeModal } from "@natalia/ui-model";
import {
  collapseToolOutput,
  parseTodoItems,
  stripAnsiOutput,
} from "@natalia/ui-model";
import {
  useAppState,
  type AppState,
  type MessageBlock,
} from "../../context/state";
import { roleColor, themeTokens as darkTheme } from "../../theme/theme";
import { terminalPreview } from "../../terminal-preview";
import type { TuiPreferences } from "../../settings";
import { timelineLayout } from "../../session-layout";
import { useRouteController } from "../../context/route";
import { useDialog } from "../../dialog/provider";
import { DialogPrompt } from "../../dialog/DialogPrompt";
import { PermissionPrompt } from "./permission";
import { QuestionPrompt } from "./question";
import {
  TimelineVirtualizer,
  groupTimelineBlocks,
  type TimelineRange,
} from "./timeline-virtualizer";
import {
  compactPath,
  filetype,
  formatToolPath,
  formatPrimitiveArgs,
  parseExecuteCalls,
  parseQuestionAnswers,
  parseResultRecord,
  statusValues,
  stringField,
  subagentColor,
  toolIcon,
  toolInput,
  toolPath,
  toolRecord,
} from "./tool-utils";
import { markdownSyntax, ToolBlockView } from "./tool-views";
import { InlineInteractiveBlock } from "./interactive-rows";
import { ModelTerminalPane } from "./terminal-pane";
import { MessageBlockView } from "./message-rows";

export function SessionRoute(props: {
  messages?: MessageBlock[];
  viewState?: AppState;
  emptyTitle?: string;
  emptyHint?: string;
  displayOnly?: boolean;
  scrollRef?: { current?: any };
  terminalScrollRef?: { current?: any };
  followBottom?: boolean;
  onFollowChange?: (follow: boolean) => void;
  density?: TuiPreferences["density"];
  toolDetails?: TuiPreferences["toolDetails"];
  reasoning?: TuiPreferences["reasoning"];
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
  showInteractivePrompt?: boolean;
}) {
  const { state, dispatch } = useAppState();
  const viewState = () =>
    props.viewState ?? (props.displayOnly ? undefined : state);
  const layout = () => timelineLayout(props.terminalWidth ?? 80);
  const modal = createMemo(() =>
    activeModal(viewState()?.modal ?? state.modal),
  );
  const messages = () => props.messages ?? viewState()?.messages ?? [];
  const timelineGroups = createMemo(() => groupTimelineBlocks(messages()));
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
  let observedTotal = 0;
  const scrollObserver = setInterval(() => {
    if (!timelineScroll || timelineScroll.isDestroyed) return;
    const scrollTop = timelineScroll.scrollTop ?? 0;
    measureRenderedGroups();
    if (scrollTop === observedScrollTop) return;
    observedScrollTop = scrollTop;
    const isAtTop = scrollTop <= 1;
    if (isAtTop && !wasAtTop) void props.onLoadOlderHistory?.();
    wasAtTop = isAtTop;
    // Bottom detection must use the scrollbox's real geometry. range.total is
    // in estimate space and drifts from reality as tall tool blocks render,
    // which would strand follow mode off while visually at the bottom.
    const isAtBottom = atRealBottom();
    if (isAtBottom) {
      props.onFollowChange?.(true);
    } else if (props.followBottom) {
      props.onFollowChange?.(false);
    }
    observedTotal = virtualizer.range(scrollTop, viewportHeight()).total;
    if (isAtBottom && !wasAtBottom) void props.onLoadNewerHistory?.();
    wasAtBottom = isAtBottom;
    updateRange();
  }, 50);
  onCleanup(() => clearInterval(scrollObserver));

  const viewportHeight = () => timelineScroll?.viewport?.height ?? 1;
  const atRealBottom = () => {
    if (!timelineScroll || timelineScroll.isDestroyed) return true;
    const height = timelineScroll.scrollHeight ?? 0;
    const view = viewportHeight();
    if (height <= view) return true;
    return (timelineScroll.scrollTop ?? 0) + view >= height - 1;
  };
  // Overshoot and let the scrollbar clamp. Landing on an exactly computed
  // target that is even one line short flips opentui's _hasManualScroll and
  // permanently disengages stickyScroll for all later content growth.
  const scrollToRealBottom = () => {
    if (!timelineScroll || timelineScroll.isDestroyed) return;
    timelineScroll.scrollTo(timelineScroll.scrollHeight ?? 0);
  };
  const updateRange = () => {
    if (!timelineScroll || timelineScroll.isDestroyed) return;
    setTimelineRange(
      virtualizer.range(timelineScroll.scrollTop ?? 0, viewportHeight()),
    );
  };
  const measureRenderedGroups = () => {
    if (measuring || !timelineScroll || timelineScroll.isDestroyed) return;
    measuring = true;
    requestAnimationFrame(() => {
      measuring = false;
      if (!timelineScroll || timelineScroll.isDestroyed) return;
      const scrollTop = timelineScroll.scrollTop ?? 0;
      if (scrollTop !== observedScrollTop) {
        observedScrollTop = scrollTop;
        updateRange();
      }
      let adjustment = 0;
      let anyChanged = false;
      // Sample real geometry before measurement mutates the estimate model.
      const wasNearBottom = props.followBottom && atRealBottom();
      for (const [key, element] of renderedGroups) {
        if (!element || element.isDestroyed) continue;
        // A box laid out this frame reports 0, which is not nullish. Recording
        // it as 1 line collapses total and makes every scroll target garbage
        // until the next frame, so keep the existing estimate instead.
        const height = element.height;
        if (!height) continue;
        const measured = virtualizer.measure(
          key,
          height,
          (timelineScroll.scrollTop ?? 0) + adjustment,
          viewportHeight(),
        );
        adjustment += measured.adjustment;
        if (measured.changed) anyChanged = true;
      }
      if (props.followBottom && anyChanged && wasNearBottom)
        scrollToRealBottom();
      else if (adjustment && !props.followBottom)
        timelineScroll.scrollTo((timelineScroll.scrollTop ?? 0) + adjustment);

      observedScrollTop = timelineScroll.scrollTop ?? 0;
      updateRange();
    });
  };

  createEffect(() => {
    // Rewrapping or re-styling invalidates every cached height. Without this
    // only on-screen groups are ever re-measured, so stale off-screen sizes
    // accumulate into a permanent estimate-vs-real offset that eventually
    // strands follow mode and freezes the range short of the newest groups.
    props.terminalWidth;
    props.density;
    props.toolDetails;
    props.diffStyle;
    props.toolPreviewLines;
    virtualizer.invalidate();
    if (timelineScroll && !timelineScroll.isDestroyed) {
      updateRange();
      measureRenderedGroups();
    }
  });

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
        timelineScroll.scrollTo(
          (timelineScroll.scrollTop ?? 0) + result.adjustment,
        );
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
                    reasoning={props.reasoning ?? "step"}
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
        <Show when={messages().length === 0}>
          <box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight={12}
            gap={1}
          >
            <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
              {props.emptyTitle ?? viewState()?.facts.title}
            </text>
            <text fg={darkTheme.muted}>
              {props.emptyHint ?? "Start a new task below"}
            </text>
          </box>
        </Show>
      </scrollbox>
      <Show
        when={
          props.showInteractivePrompt !== false &&
          props.backend &&
          modal()?.kind === "approval"
        }
      >
        <PermissionPrompt
          request={
            modal() as Extract<ReturnType<typeof modal>, { kind: "approval" }>
          }
          backend={props.backend!}
          onExit={props.onExit ?? (() => {})}
        />
      </Show>
      <Show
        when={
          props.showInteractivePrompt !== false &&
          props.backend &&
          modal()?.kind === "question"
        }
      >
        <QuestionPrompt
          request={
            modal() as Extract<ReturnType<typeof modal>, { kind: "question" }>
          }
          backend={props.backend!}
          onExit={props.onExit ?? (() => {})}
        />
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
      <Show when={!props.displayOnly && state.terminalPane.selectedID}>
        {(selectedID) => {
          const terminal = () => state.facts.terminals[selectedID()];
          return (
            <Show when={terminal()}>
              <ModelTerminalPane
                terminal={terminal()!}
                sessions={Object.values(state.facts.terminals).filter(
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
      <Show when={viewState()?.facts.retryBanner}>
        {(retry) => (
          <box flexShrink={0} paddingLeft={1} backgroundColor={darkTheme.panel}>
            <text fg={darkTheme.warning}>{retry().text}</text>
          </box>
        )}
      </Show>
      <Show when={viewState()?.facts.compactionBanner}>
        {(banner) => (
          <box flexShrink={0} paddingLeft={1} backgroundColor={darkTheme.panel}>
            <text fg={darkTheme.accent}>{banner().text}</text>
          </box>
        )}
      </Show>
    </box>
  );
}

export function SessionFooter(props: {
  workspaceRoot?: string;
  onWorkspaceSelect?: () => void;
  viewState?: AppState;
  context?: string;
  children?: Array<{ id: string; status?: string }>;
  onChildSelect?: (id: string) => void;
}) {
  const { state } = useAppState();
  const viewState = () => props.viewState ?? state;
  const primaryActivity = () => selectPrimaryActivity(viewState().facts);
  const status = createMemo(() => footerStatus(viewState(), primaryActivity()));
  const [scanPosition, setScanPosition] = createSignal(0);
  const [turnElapsedMs, setTurnElapsedMs] = createSignal(0);
  const visibleChildren = () => props.children?.slice(0, 3) ?? [];
  const hiddenChildren = () =>
    Math.max(0, (props.children?.length ?? 0) - visibleChildren().length);

  createEffect(() => {
    if (primaryActivity()?.state !== "active") {
      setScanPosition(0);
      return;
    }
    const timer = setInterval(
      () => setScanPosition((current) => current + 1),
      140,
    );
    onCleanup(() => clearInterval(timer));
  });

  createEffect(() => {
    const turnID = viewState().facts.activeTurn;
    if (!turnID) {
      setTurnElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    setTurnElapsedMs(0);
    const timer = setInterval(
      () => setTurnElapsedMs(Date.now() - startedAt),
      1_000,
    );
    onCleanup(() => clearInterval(timer));
  });

  return (
    <box
      flexShrink={0}
      flexDirection="row"
      justifyContent="space-between"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
    >
      <text
        fg={props.onWorkspaceSelect ? darkTheme.text : darkTheme.muted}
        onMouseUp={props.onWorkspaceSelect}
      >
        {compactPath(props.workspaceRoot)}
        <Show when={props.onWorkspaceSelect}> ▼</Show>
      </text>
      <box flexDirection="row" gap={2} flexShrink={0}>
        <Show when={props.context}>
          <text fg={darkTheme.muted}>{props.context}</text>
        </Show>
        <Show when={props.children?.length}>
          <box flexDirection="row" gap={1}>
            <text fg={darkTheme.muted}>children:</text>
            <For each={visibleChildren()}>
              {(child) => (
                <text
                  fg={subagentColor(child.status ?? "pending")}
                  onMouseUp={() => props.onChildSelect?.(child.id)}
                >
                  {child.id}
                </text>
              )}
            </For>
            <Show when={hiddenChildren() > 0}>
              <text fg={darkTheme.muted}>+{hiddenChildren()}</text>
            </Show>
          </box>
        </Show>
        <Show when={Object.keys(viewState().facts.terminals).length > 0}>
          <text fg={darkTheme.text}>
            <span style={{ fg: darkTheme.success }}>•</span>{" "}
            {Object.keys(viewState().facts.terminals).length} terminal
          </text>
        </Show>
        <Show when={Object.keys(viewState().facts.sandboxes).length > 0}>
          <text fg={darkTheme.text}>
            <span style={{ fg: darkTheme.success }}>•</span>{" "}
            {Object.keys(viewState().facts.sandboxes).length} Sandbox
          </text>
        </Show>
        <box flexDirection="row" gap={1}>
          <text
            fg={status().tone === "ready" ? darkTheme.text : darkTheme.muted}
          >
            <span
              style={{
                fg:
                  status().tone === "ready"
                    ? darkTheme.success
                    : status().tone === "error"
                      ? darkTheme.danger
                      : darkTheme.warning,
              }}
            >
              {footerIndicator(primaryActivity(), scanPosition())}
            </span>{" "}
            {status().label}
          </text>
          <Show when={viewState().facts.activeTurn}>
            <text fg={darkTheme.muted}>
              · {formatTurnElapsed(turnElapsedMs())}
            </text>
          </Show>
        </box>
      </box>
    </box>
  );
}

function formatTurnElapsed(elapsedMs: number) {
  const elapsedSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds} elapsed`;
}

function footerIndicator(
  activity: ActivityView | undefined,
  scanPosition: number,
) {
  if (!activity) return "•";
  if (activity.state === "waiting") return "?";
  if (activity.state === "paused") return "=";
  return [".  ", " . ", "  .", " . "][scanPosition % 4]!;
}

function footerStatus(viewState: AppState, activity?: ActivityView) {
  const modal = activeModal(viewState.modal);
  if (modal?.kind === "approval")
    return { label: "Waiting for approval", tone: "waiting" };
  if (modal?.kind === "question")
    return { label: "Waiting for answer", tone: "waiting" };
  if (viewState.status === "error") return { label: "Error", tone: "error" };
  if (viewState.status === "stopped" || viewState.status === "cancelled")
    return { label: "Stopped", tone: "waiting" };
  if (viewState.status === "waiting_human")
    return { label: "Waiting for human input", tone: "waiting" };
  if (activity) return { label: activityLabel(activity), tone: "working" };
  return { label: "Ready", tone: "ready" };
}

function activityLabel(activity: ActivityView) {
  switch (activity.kind) {
    case "planning":
      return "Planning";
    case "thinking":
      return "Thinking";
    case "generating":
      return "Generating";
    case "tool":
      return activity.label ? `Using ${activity.label}` : "Using a tool";
    case "command":
      return "Running command";
    case "workflow":
      return "Running workflow";
    case "subagent":
      return "Working with subagent";
    case "compacting":
      return "Compacting context";
    case "retrying":
      return "Retrying";
    case "waiting_for_user":
      return "Waiting for input";
    case "paused":
      return "Paused";
  }
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
  const todos = () => state.facts.todos;
  const visibleTodos = () => {
    const items = todos();
    if (items.length <= 6) return items;
    return items.filter((todo) => todo.status !== "completed").slice(0, 6);
  };
  const hiddenCompletedTodos = () => todos().length - visibleTodos().length;
  const agents = () =>
    Object.values(state.facts.subagents).filter(
      (agent) => !agent.parentAgentID,
    );
  const activeAgents = () =>
    agents().filter((agent) => agent.status !== "completed").length;
  const sessionStatus = () => {
    const activity = selectPrimaryActivity(state.facts);
    if (activity) return activityLabel(activity);
    if (state.facts.activeTurn) return "Working";
    if (activeAgents())
      return `${activeAgents()} agent${activeAgents() === 1 ? "" : "s"} working`;
    return "Ready";
  };
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
      backgroundColor={darkTheme.background}
      border={props.overlay ? undefined : ["left"]}
      borderColor={darkTheme.muted}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
    >
      <scrollbox flexGrow={1}>
        <box flexDirection="column" gap={2} paddingRight={1}>
          <box flexDirection="column">
            <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
              {state.facts.title || "Natalia session"}
            </text>
            <text fg={darkTheme.muted}>{sessionStatus()}</text>
          </box>
          <Show when={todos().length > 0}>
            <box flexDirection="column" gap={1}>
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                Plan
              </text>
              <For each={visibleTodos()}>
                {(todo) => (
                  <text
                    fg={
                      todo.status === "in_progress"
                        ? darkTheme.text
                        : darkTheme.muted
                    }
                    wrapMode="word"
                  >
                    <span
                      style={{
                        fg:
                          todo.status === "completed"
                            ? darkTheme.success
                            : todo.status === "in_progress"
                              ? darkTheme.warning
                              : darkTheme.muted,
                      }}
                    >
                      {todo.status === "completed"
                        ? "✓"
                        : todo.status === "in_progress"
                          ? "•"
                          : "○"}
                    </span>{" "}
                    {todo.content}
                  </text>
                )}
              </For>
              <Show when={hiddenCompletedTodos() > 0}>
                <text fg={darkTheme.muted}>
                  Completed ({hiddenCompletedTodos()})
                </text>
              </Show>
            </box>
          </Show>
          <Show when={agents().length > 0}>
            <box flexDirection="column" gap={1}>
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                Agents
              </text>
              <For each={agents()}>
                {(agent) => (
                  <text
                    fg={subagentColor(agent.status)}
                    onMouseUp={() =>
                      route.push({ kind: "subagent", id: agent.id })
                    }
                  >
                    {agent.status === "completed" ? "✓" : "•"} {agent.id} ·{" "}
                    {agent.status}
                  </text>
                )}
              </For>
            </box>
          </Show>
        </box>
      </scrollbox>
      <text fg={darkTheme.muted}>
        {values().model ?? "model not selected"} ·{" "}
        {values().ctx ?? "context pending"}
      </text>
    </box>
  );
}

export function SubagentRoute(props: {
  agentID: string;
  onBack(): void;
  scrollRef?: { current?: any };
  followBottom?: boolean;
  onFollowChange?: (follow: boolean) => void;
  density?: TuiPreferences["density"];
  toolDetails?: TuiPreferences["toolDetails"];
  reasoning?: TuiPreferences["reasoning"];
  diffStyle?: TuiPreferences["diffStyle"];
  terminalWidth?: number;
  toolPreviewLines?: number;
  showJumpToBottom?: boolean;
  onJumpToBottom?: () => void;
  onMessageCopy?: (text: string) => void;
  backend?: RuntimeClient;
  onExit?: () => void;
  workspaceRoot?: string;
  onWorkspaceSelect?: () => void;
}) {
  const { state } = useAppState();
  const route = useRouteController();
  const agent = () => state.facts.subagents[props.agentID];
  const messages = () => state.subagentStates[props.agentID]?.messages ?? [];
  const children = () =>
    Object.values(state.facts.subagents)
      .filter((item) => item.parentAgentID === props.agentID)
      .map((item) => ({ id: item.id, status: item.status }));
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
      <SessionRoute
        messages={messages()}
        viewState={state.subagentStates[props.agentID]}
        emptyTitle={agent()?.task || props.agentID}
        emptyHint="Waiting for subagent output"
        displayOnly
        backend={props.backend}
        onExit={props.onExit}
        onMessageCopy={props.onMessageCopy}
        scrollRef={props.scrollRef}
        followBottom={props.followBottom}
        onFollowChange={props.onFollowChange}
        density={props.density}
        toolDetails={props.toolDetails}
        reasoning={props.reasoning}
        diffStyle={props.diffStyle}
        terminalWidth={props.terminalWidth}
        toolPreviewLines={props.toolPreviewLines}
        showJumpToBottom={props.showJumpToBottom}
        onJumpToBottom={props.onJumpToBottom}
        showInteractivePrompt
      />
      <SessionFooter
        workspaceRoot={props.workspaceRoot}
        onWorkspaceSelect={props.onWorkspaceSelect}
        viewState={state.subagentStates[props.agentID]}
        context={`${props.agentID} · ${agent()?.status ?? "unavailable"} · Esc back`}
        children={children()}
        onChildSelect={(id) => route.push({ kind: "subagent", id })}
      />
    </box>
  );
}
