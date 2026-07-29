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
    const range = virtualizer.range(scrollTop, viewportHeight());
    const isAtBottom =
      scrollTop + viewportHeight() >= range.total - 1;
    if (isAtBottom) props.onFollowChange?.(true);
    if (props.followBottom && !isAtBottom && range.total > observedTotal)
      props.onFollowChange?.(true);
    observedTotal = range.total;
    if (isAtBottom && !wasAtBottom) void props.onLoadNewerHistory?.();
    wasAtBottom = isAtBottom;
    updateRange();
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
      const oldTotal = virtualizer.range(timelineScroll.scrollTop ?? 0, viewportHeight()).total;
      for (const [key, element] of renderedGroups) {
        if (!element || element.isDestroyed) continue;
        const measured = virtualizer.measure(
          key,
          element.height ?? 1,
          (timelineScroll.scrollTop ?? 0) + adjustment,
          viewportHeight(),
        );
        adjustment += measured.adjustment;
        if (measured.changed) anyChanged = true;
      }
      const wasNearBottom = props.followBottom && (timelineScroll.scrollTop ?? 0) + viewportHeight() >= oldTotal - 1;
      const newTop = props.followBottom && anyChanged && wasNearBottom
        ? Math.max(0, virtualizer.range(timelineScroll.scrollTop ?? 0, viewportHeight()).total - viewportHeight())
        : adjustment && !props.followBottom
          ? (timelineScroll.scrollTop ?? 0) + adjustment
          : undefined;
      if (newTop !== undefined) timelineScroll.scrollTo(newTop);

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



