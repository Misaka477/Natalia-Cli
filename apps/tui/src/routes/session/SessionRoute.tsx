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
import { ModalSurface } from "../../modal/ModalSurface";
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
  toolColor,
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
              {state.facts.title}
            </text>
            <text fg={darkTheme.muted}>Start a new task below</text>
          </box>
        </Show>
      </scrollbox>
      <Show when={props.backend && modal()?.kind === "approval"}>
        <ModalSurface mode="approval">
          <PermissionPrompt
            request={
              modal() as Extract<ReturnType<typeof modal>, { kind: "approval" }>
            }
            backend={props.backend!}
            onExit={props.onExit ?? (() => {})}
          />
        </ModalSurface>
      </Show>
      <Show when={props.backend && modal()?.kind === "question"}>
        <ModalSurface mode="question">
          <QuestionPrompt
            request={
              modal() as Extract<ReturnType<typeof modal>, { kind: "question" }>
            }
            backend={props.backend!}
            onExit={props.onExit ?? (() => {})}
          />
        </ModalSurface>
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
        <Show when={Object.keys(state.facts.terminals).length > 0}>
          <text fg={darkTheme.text}>
            <span style={{ fg: darkTheme.success }}>•</span>{" "}
            {Object.keys(state.facts.terminals).length} terminal
          </text>
        </Show>
        <Show when={Object.keys(state.facts.sandboxes).length > 0}>
          <text fg={darkTheme.text}>
            <span style={{ fg: darkTheme.success }}>•</span>{" "}
            {Object.keys(state.facts.sandboxes).length} Sandbox
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
  const tools = () => Object.values(state.facts.tools);
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
            {state.facts.title}
          </text>
          <Show when={state.facts.sessionID}>
            <text fg={darkTheme.muted}>{state.facts.sessionID}</text>
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
          <Show when={state.facts.todos.length > 0}>
            <box marginTop={1} flexDirection="column">
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                Todo
              </text>
              <For each={state.facts.todos}>
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
              Object.values(state.facts.subagents).filter(
                (agent) => !agent.parentAgentID,
              ).length > 0
            }
          >
            <box marginTop={1} flexDirection="column">
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                Agents
              </text>
              <For
                each={Object.values(state.facts.subagents).filter(
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
            when={
              Object.values(state.facts.sandboxes).length > 0 && !props.compact
            }
          >
            <box marginTop={1} flexDirection="column">
              <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
                Workspace
              </text>
              <For each={Object.values(state.facts.sandboxes)}>
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

export function SubagentRoute(props: { agentID: string; onBack(): void }) {
  const { state } = useAppState();
  const agent = () => state.facts.subagents[props.agentID];
  const history = () => state.facts.subagentHistory[props.agentID] ?? [];
  const children = () =>
    Object.values(state.facts.subagents).filter(
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
