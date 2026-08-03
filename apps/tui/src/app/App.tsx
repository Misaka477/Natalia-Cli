import { TextareaRenderable, type PasteEvent } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import {
  useBindings,
  useKeymap,
  useKeymapSelector,
} from "@opentui/keymap/solid";
import { stringifyKeySequence } from "@opentui/keymap";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { usePromptRef } from "../context/prompt";
import { useRouteController, type AppRoute } from "../context/route";
import { StateProvider, useAppState } from "../context/state";
import { useClipboard } from "../context/clipboard";
import { ToastRegion, useToast } from "../context/toast";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import type { ConfigV2 } from "@natalia/contracts";
import { getPluginCommands } from "@natalia/plugin";
import {
  buildKeybindMap,
  commands,
  composerKeyAction,
  keymapBoundary,
} from "../keymap";
import { useKeybinds } from "../context/keybind";
import {
  DialogProvider,
  useDialog,
  type DialogContext,
} from "../dialog/provider";
import { DialogConfirm } from "../dialog/DialogConfirm";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import {
  DialogHelp,
  DialogDiagnostics,
  DialogSessionList,
  DialogStatus,
} from "../dialog/DialogLayer";
import { DialogProviderSetup } from "../component/DialogProviderSetup";
import { DialogMcp } from "../component/DialogMcp";
import { DialogThemeList } from "../component/DialogThemeList";
import { DialogModel } from "../component/DialogModel";
import { DialogSkill } from "../component/DialogSkill";
import { DialogStash } from "../component/DialogStash";
import { DialogAttachment } from "../component/DialogAttachment";
import { DialogWorkspaceSearch } from "../component/DialogWorkspaceSearch";
import { DialogTerminal } from "../component/DialogTerminal";
import { DialogCheckpoint } from "../component/DialogCheckpoint";
import { DialogSandbox } from "../component/DialogSandbox";
import { PromptAutocomplete } from "../component/PromptAutocomplete";
import {
  editPromptExternally,
  retainEditorMentions,
} from "../prompt/external-editor";
import { DialogAgent } from "../component/DialogAgent";
import { CommandPalette } from "../component/CommandPalette";
import {
  resolveConfig,
  configPatch,
  updateConfigAtScope,
  type ConfigPatch,
  type ConfigWriteScope,
} from "@natalia/config";
import { discoverProviderModels } from "@natalia/config";
import { decidePaste } from "../prompt/paste";
import { PromptHistory, shouldUseHistory } from "../prompt/history";
import {
  SessionFooter,
  SessionRoute,
  SessionSidebar,
  SubagentRoute,
} from "../routes/session/SessionRoute";
import { darkTheme } from "../theme/theme";
import { useTheme } from "../context/theme";
import { useLocal } from "../context/local";
import { sessionLayout, type SidebarMode } from "../session-layout";
import {
  defaultTuiPreferences,
  loadTuiPreferences,
  saveTuiPreferences,
  tuiPreferencePatch,
  type TuiPreferences,
} from "../settings";
import type { TuiConfigWriteScope } from "../config";

import {
  parseSettingsRecord,
  parseSettingsStringRecord,
} from "./settings-utils";
import { runCommand } from "./command-controller";

export function App(props: {
  backend: RuntimeClient;
  createBackend?: (sessionID?: string) => RuntimeClient;
  workspaceRoot?: string;
  onSessionChange?: (sessionID?: string) => void;
  onDispatch?: (event: RuntimeEvent) => void;
  initialPrompt?: string;
  initialRoute?: AppRoute;
  onHistoryControls?: (controls: {
    loadOlder(): Promise<void>;
    loadNewer(): Promise<void>;
  }) => void;
}) {
  const [backend, setBackend] = createSignal(props.backend);
  const [historyCursor, setHistoryCursor] = createSignal<string>();
  const [newerHistoryCursor, setNewerHistoryCursor] = createSignal<string>();
  let loadingHistory = false;
  let historyHydrate:
    | ((
        messages: import("@natalia/contracts").RuntimeProjectedMessage[],
        direction?: "older" | "newer",
      ) => boolean)
    | undefined;

  function changeSession(sessionID?: string) {
    setHistoryCursor(undefined);
    setNewerHistoryCursor(undefined);
    historyHydrate = undefined;
    if (props.createBackend) setBackend(props.createBackend(sessionID));
    props.onSessionChange?.(sessionID);
  }

  return (
    <Show when={backend()} keyed>
      {(activeBackend) => (
        <StateProvider
          onReady={(bridge) => {
            historyHydrate = bridge.hydrateMessages;
            activeBackend.start(
              (event: RuntimeEvent) => {
                bridge.dispatch(event);
                props.onDispatch?.(event);
                if (event.type === "session.ready")
                  void hydrateRecentMessages(
                    activeBackend,
                    bridge.hydrateMessages,
                  ).then((cursor) => setHistoryCursor(cursor));
              },
              { replay: "none" },
            );
          }}
        >
          <DialogProvider>
            <Shell
              backend={activeBackend}
              workspaceRoot={props.workspaceRoot}
              onSessionChange={changeSession}
              initialRoute={props.initialRoute}
              onHistoryControls={props.onHistoryControls}
              onLoadOlderHistory={async () => {
                const cursor = historyCursor();
                if (!cursor || loadingHistory || !historyHydrate) return;
                loadingHistory = true;
                try {
                  const page = await activeBackend.messages?.({
                    cursor,
                    limit: 100,
                  });
                  if (!page) return;
                  const evicted = historyHydrate(
                    [...page.data].reverse(),
                    "older",
                  );
                  if (evicted) setNewerHistoryCursor(page.cursor.previous);
                  setHistoryCursor(page.cursor.next);
                } finally {
                  loadingHistory = false;
                }
              }}
              onLoadNewerHistory={async () => {
                const cursor = newerHistoryCursor();
                if (!cursor || loadingHistory || !historyHydrate) return;
                loadingHistory = true;
                try {
                  const page = await activeBackend.messages?.({
                    cursor,
                    limit: 100,
                  });
                  if (!page) return;
                  const evicted = historyHydrate(
                    [...page.data].reverse(),
                    "newer",
                  );
                  if (evicted) setHistoryCursor(page.cursor.next);
                  setNewerHistoryCursor(page.cursor.previous);
                } finally {
                  loadingHistory = false;
                }
              }}
            />
          </DialogProvider>
        </StateProvider>
      )}
    </Show>
  );
}

async function hydrateRecentMessages(
  backend: RuntimeClient,
  hydrateMessages: (
    messages: import("@natalia/contracts").RuntimeProjectedMessage[],
    direction?: "older" | "newer",
  ) => boolean,
) {
  const page = await backend.messages?.({ limit: 100 }).catch(() => undefined);
  hydrateMessages([...(page?.data ?? [])].reverse());
  return page?.cursor.next;
}

function Shell(props: {
  backend: RuntimeClient;
  workspaceRoot?: string;
  onSessionChange?: (sessionID?: string) => void;
  onLoadOlderHistory?: () => Promise<void>;
  onLoadNewerHistory?: () => Promise<void>;
  onHistoryControls?: (controls: {
    loadOlder(): Promise<void>;
    loadNewer(): Promise<void>;
  }) => void;
  initialRoute?: AppRoute;
}) {
  const renderer = useRenderer();
  const [terminalWidth, setTerminalWidth] = createSignal(renderer.width);
  const [terminalHeight, setTerminalHeight] = createSignal(renderer.height);
  const [sidebarMode, setSidebarMode] = createSignal<SidebarMode>("auto");
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const promptRef = usePromptRef();
  const { state, dispatch } = useAppState();
  const route = useRouteController();
  const clipboard = useClipboard();
  const toast = useToast();
  const dialog = useDialog();
  const [composer, setComposer] = createSignal<TextareaRenderable>();
  const [pastePreview, setPastePreview] = createSignal("");
  const [attachmentPaths, setAttachmentPaths] = createSignal<string[]>([]);
  const [mentionAgents, setMentionAgents] = createSignal<string[]>([]);
  const [mentionResources, setMentionResources] = createSignal<
    import("@natalia/contracts").MCPResourceCatalog[]
  >([]);
  const [composerText, setComposerText] = createSignal("");
  const [followBottom, setFollowBottom] = createSignal(true);
  const [jumpToBottomVisible, setJumpToBottomVisible] = createSignal(false);
  const [preferences, setPreferences] = createSignal<TuiPreferences>(
    defaultTuiPreferences,
  );
  const keybinds = useKeybinds();
  const theme = useTheme();
  const local = useLocal();
  const [tuiWriteScope, setTuiWriteScope] =
    createSignal<TuiConfigWriteScope>("project");
  const [configWriteScope, setConfigWriteScope] =
    createSignal<ConfigWriteScope>("project");
  const layout = () =>
    sessionLayout(
      terminalWidth(),
      terminalHeight(),
      sidebarMode(),
      sidebarOpen(),
    );
  const activeSubagentRoute = () => {
    const current = route.route();
    return current.kind === "subagent" ? current : undefined;
  };

  onMount(() => {
    if (props.onHistoryControls)
      props.onHistoryControls({
        loadOlder: async () => props.onLoadOlderHistory?.(),
        loadNewer: async () => props.onLoadNewerHistory?.(),
      });
    const initialRoute = props.initialRoute;
    if (initialRoute && initialRoute.kind !== "none")
      route.replace(initialRoute);
    const resize = (width: number, height: number) => {
      setTerminalWidth(width);
      setTerminalHeight(height);
    };
    renderer.on("resize", resize);
    onCleanup(() => renderer.off("resize", resize));
  });
  const history = new PromptHistory();
  const scrollRef: { current?: any } = {};
  const terminalScrollRef: { current?: any } = {};
  let submitting = false;
  let restoredAgent = false;

  createEffect(() => {
    if (restoredAgent || !local.ready) return;
    restoredAgent = true;
    if (local.state.activeAgent)
      props.backend.selectAgent?.(local.state.activeAgent);
  });

  onMount(async () => {
    if (props.workspaceRoot) {
      const loaded = await loadTuiPreferences(props.workspaceRoot);
      setPreferences(loaded);
      keybinds.set(loaded.keybinds);
      setFollowMode(loaded.followBottom);
    }
    setTimeout(() => composer()?.focus(), 1);
  });

  onMount(() => {
    const timer = setInterval(() => {
      const scrollbox = scrollRef.current;
      if (!scrollbox || scrollbox.isDestroyed) return;
      const nearBottom = isNearBottom(scrollbox, 3);
      if (nearBottom) {
        setJumpToBottomVisible(false);
        return;
      }
      if (!followBottom()) setJumpToBottomVisible(true);
    }, 100);
    onCleanup(() => clearInterval(timer));
  });

  function updatePreferences(next: TuiPreferences, scope = tuiWriteScope()) {
    const patch = tuiPreferencePatch(preferences(), next);
    setPreferences(next);
    keybinds.set(next.keybinds);
    setFollowMode(next.followBottom);
    theme.preview(next.theme);
    if (props.workspaceRoot)
      void saveTuiPreferences(props.workspaceRoot, patch, scope).then(
        () =>
          toast.show({
            variant: "success",
            message: `TUI preferences saved to ${scope} config`,
          }),
        (error) => toast.error(error),
      );
  }

  async function persistConfig(next: ConfigPatch, base?: ConfigV2) {
    const scope = configWriteScope();
    await updateConfigAtScope(
      props.workspaceRoot ?? process.cwd(),
      base ? configPatch(base, next as ConfigV2) : next,
      scope,
    );
    toast.show({
      variant: "success",
      message: `Runtime config saved to ${scope} config`,
    });
  }

  async function submit() {
    const input = composer();
    const text = (input?.plainText ?? "").replace(/\n$/, "");
    if (!text.trim()) return;
    const control = text.trim();
    if (control === "/editor" || control.startsWith("/editor ")) {
      const draft = control === "/editor" ? "" : text.slice("/editor ".length);
      try {
        const edited = await editPromptExternally({
          text: draft,
          env: process.env,
        });
        input?.setText(edited);
        setComposerText(edited);
        const mentions = retainEditorMentions({
          text: edited,
          attachments: attachmentPaths(),
          agents: mentionAgents(),
          resources: mentionResources(),
        });
        setAttachmentPaths(mentions.attachments);
        setMentionAgents(mentions.agents);
        setMentionResources(mentions.resources);
        input?.gotoBufferEnd();
      } catch (error) {
        toast.error(error);
      }
      return;
    }
    if (submitting && control !== "/pause" && control !== "/resume") return;
    if (control === "/pause") {
      input?.clear();
      props.backend.pause?.("TUI composer control");
      setTimeout(() => composer()?.focus(), 1);
      return;
    }
    if (control === "/resume") {
      input?.clear();
      props.backend.resume?.();
      setTimeout(() => composer()?.focus(), 1);
      return;
    }
    const attachments = attachmentPaths();
    if (
      (attachments.length ||
        mentionAgents().length ||
        mentionResources().length) &&
      !props.backend.submitInput
    ) {
      toast.show({
        variant: "warning",
        message: "This runtime transport does not support attachments",
      });
      return;
    }
    submitting = true;
    const shouldFollow = isNearBottom(scrollRef.current);
    setFollowMode(shouldFollow);
    if (shouldFollow) toBottom(0);
    try {
      input?.clear();
      setPastePreview("");
      history.add(text);
      if (
        attachments.length ||
        mentionAgents().length ||
        mentionResources().length
      )
        await props.backend.submitInput!({
          text,
          attachments,
          agents: mentionAgents().map((name) => ({ name })),
          resources: mentionResources().map((resource) => ({
            server: resource.server,
            uri: resource.uri,
            name: resource.name,
            mimeType: resource.mimeType,
          })),
        });
      else await props.backend.submit(text);
      setAttachmentPaths([]);
      setMentionAgents([]);
      setMentionResources([]);
    } finally {
      submitting = false;
      if (followBottom()) toBottom(50);
      setTimeout(() => composer()?.focus(), 1);
    }
  }

  function handlePaste(event: PasteEvent) {
    const decision = decidePaste(event.bytes, composer()?.plainText ?? "");
    if (!decision.ok) {
      event.preventDefault();
      setPastePreview(decision.message);
      props.backend.diagnostic(decision.message);
      return;
    }
    if (decision.preview) setPastePreview(decision.preview);
  }

  function restoreHistory(direction: -1 | 1) {
    const input = composer();
    if (!input) return false;
    if (!shouldUseHistory(input.plainText, input.cursorOffset)) return false;
    input.setText(
      direction === -1
        ? history.previous(input.plainText)
        : history.next(input.plainText),
    );
    input.gotoBufferEnd();
    return true;
  }

  function exitOrCancel() {
    if (state.activeTurn) {
      props.backend.cancel();
    } else if (composer()?.plainText) {
      composer()?.clear();
    } else {
      renderer.destroy();
    }
  }

  function changeSession(sessionID?: string) {
    if (state.activeTurn || submitting) {
      props.backend.diagnostic(
        "Finish or cancel the current turn before switching sessions.",
      );
      return;
    }
    props.onSessionChange?.(sessionID);
  }

  function onCommand(command: string) {
    runCommand(command, {
      backend: props.backend,
      workspaceRoot: props.workspaceRoot,
      composer: () => composer(),
      setAttachmentPaths,
      setMentionAgents,
      setMentionResources,
      attachmentPaths,
      changeSession,
      persistConfig,
      toast,
      dialog,
      local,
      preferences,
      setPreferences,
      tuiWriteScope,
      configWriteScope,
      setTuiWriteScope,
      setConfigWriteScope,
      setFollowMode,
      state,
      dispatch,
      route,
      renderer,
      layout,
      setSidebarMode,
      setSidebarOpen,
      clipboard,
      setComposerText,
      submit,
      updatePreferences,
    });
  }

  useBindings(() => ({
    commands: [
      ...Object.values(commands)
        .filter((command) => command.scope !== "dialog")
        .map((command) => ({
          name: command.id,
          title: command.desc,
          category: command.id.split(".")[0],
          namespace: "palette",
          run: () => onCommand(command.id),
        })),
    ],
  }));

  useBindings(() => ({
    mode: "base",
    bindings: Object.entries(keybinds.resolved().bindings)
      .filter(([id]) => !commands[id]?.scope)
      .flatMap(([id, keys]) =>
        keys.map((key) => ({
          key,
          desc: commands[id]!.desc,
          group: "Natalia",
          cmd: () => onCommand(id),
        })),
      ),
  }));

  // Surface-opening commands are registered without a mode so they survive a
  // runtime modal, and below every other layer so a mode that binds the same
  // key still wins.
  useBindings(() => ({
    priority: -1,
    bindings: Object.entries(keybinds.resolved().bindings)
      .filter(([id]) => commands[id]?.overlay)
      .flatMap(([id, keys]) =>
        keys.map((key) => ({
          key,
          desc: commands[id]!.desc,
          group: "Natalia",
          cmd: () => onCommand(id),
        })),
      ),
  }));

  useBindings(() => ({
    target: composer,
    enabled: () => {
      const input = composer();
      return Boolean(
        input && shouldUseHistory(input.plainText, input.cursorOffset),
      );
    },
    bindings: [
      {
        key: "up",
        desc: "Previous prompt history",
        group: "Prompt",
        cmd: () => restoreHistory(-1),
      },
      {
        key: "down",
        desc: "Next prompt history",
        group: "Prompt",
        cmd: () => restoreHistory(1),
      },
    ],
  }));

  useBindings(() => ({
    mode: "base",
    priority: 1,
    enabled: () => state.terminalPane.focus === "terminal",
    bindings: [
      {
        key: "ctrl+t",
        desc: "Return focus to chat",
        group: "Terminal",
        cmd: () =>
          dispatch({
            type: "terminal.pane.focus",
            focus: "chat",
          }),
      },
      {
        key: "pageup",
        desc: "Scroll terminal up",
        group: "Terminal",
        cmd: () =>
          terminalScrollRef.current?.scrollBy(
            -(terminalScrollRef.current.viewport?.height ?? 8) * 0.8,
          ),
      },
      {
        key: "pagedown",
        desc: "Scroll terminal down",
        group: "Terminal",
        cmd: () =>
          terminalScrollRef.current?.scrollBy(
            (terminalScrollRef.current.viewport?.height ?? 8) * 0.8,
          ),
      },
      {
        key: "home",
        desc: "Scroll terminal to start",
        group: "Terminal",
        cmd: () => terminalScrollRef.current?.scrollTo(0),
      },
      {
        key: "end",
        desc: "Scroll terminal to end",
        group: "Terminal",
        cmd: () =>
          terminalScrollRef.current?.scrollTo(
            terminalScrollRef.current.scrollHeight ?? 0,
          ),
      },
      {
        key: "left",
        desc: "Previous terminal session",
        group: "Terminal",
        cmd: () => moveTerminalSelection(-1),
      },
      {
        key: "right",
        desc: "Next terminal session",
        group: "Terminal",
        cmd: () => moveTerminalSelection(1),
      },
      {
        key: "tab",
        desc: "Next terminal session",
        group: "Terminal",
        cmd: () => moveTerminalSelection(1),
      },
      {
        key: "shift+tab",
        desc: "Previous terminal session",
        group: "Terminal",
        cmd: () => moveTerminalSelection(-1),
      },
    ],
  }));

  useBindings(() => ({
    mode: "base",
    enabled: () => !composer()?.plainText,
    bindings: [
      {
        key: "ctrl+d",
        desc: "Exit on empty composer",
        group: "Natalia",
        cmd: () => renderer.destroy(),
      },
    ],
  }));

  useBindings(() => ({
    mode: "base",
    bindings: [
      {
        key: "ctrl+c",
        desc: "Cancel turn or clear composer",
        group: "Natalia",
        cmd: () => {
          const selected = renderer.getSelection()?.getSelectedText();
          if (selected && clipboard.write) {
            void clipboard.write(selected).then(
              () => {
                renderer.clearSelection();
                toast.show({ variant: "info", message: "Copied selection" });
              },
              (error) => toast.error(error),
            );
            return;
          }
          exitOrCancel();
        },
      },
      {
        key: "pageup",
        desc: "Scroll up",
        group: "Natalia",
        cmd: () => {
          const scrollbox = scrollRef.current;
          if (!scrollbox) return;
          setFollowMode(false);
          scrollbox.scrollBy(-(scrollbox.viewport?.height ?? 10) * 0.8);
        },
      },
      {
        key: "pagedown",
        desc: "Scroll down",
        group: "Natalia",
        cmd: () => {
          const scrollbox = scrollRef.current;
          if (!scrollbox) return;
          scrollbox.scrollBy((scrollbox.viewport?.height ?? 10) * 0.8);
        },
      },
      {
        key: "home",
        desc: "Scroll to top",
        group: "Natalia",
        cmd: () => {
          setFollowMode(false);
          scrollRef.current?.scrollTo(0);
        },
      },
      {
        key: "end",
        desc: "Scroll to bottom",
        group: "Natalia",
        cmd: () => {
          setFollowMode(true);
          toBottom(0);
        },
      },
    ],
  }));

  createEffect(() => {
    if (route.route().kind === "none" && state.terminalPane.focus === "chat") {
      setTimeout(() => composer()?.focus(), 1);
    }
  });

  function toBottom(delay = 50) {
    setTimeout(() => scrollToBottom(scrollRef.current), delay);
  }

  function moveTerminalSelection(direction: -1 | 1) {
    const sessions = Object.values(state.terminals).filter(
      (terminal) =>
        terminal.ownership === "model" &&
        terminal.status !== "exited" &&
        terminal.status !== "failed",
    );
    if (sessions.length < 2) return;
    const current = sessions.findIndex(
      (terminal) => terminal.id === state.terminalPane.selectedID,
    );
    const next =
      sessions[(current + direction + sessions.length) % sessions.length];
    if (next) dispatch({ type: "terminal.pane.select", id: next.id });
  }

  function setFollowMode(value: boolean) {
    setFollowBottom(value);
    setJumpToBottomVisible(!value);
    const scrollbox = scrollRef.current;
    if (!scrollbox || scrollbox.isDestroyed) return;
    scrollbox.stickyScroll = value;
  }

  function jumpToBottom() {
    setFollowMode(true);
    toBottom(0);
  }

  return (
    <box
      flexDirection="row"
      width="100%"
      height="100%"
      backgroundColor={theme.theme.background}
    >
      <box flexGrow={1} minWidth={0} height="100%" flexDirection="column">
        <Show when={activeSubagentRoute()} keyed>
          {(current) => (
            <SubagentRoute agentID={current.id} onBack={() => route.back()} />
          )}
        </Show>
        <Show when={!activeSubagentRoute()}>
          <SessionRoute
            scrollRef={scrollRef}
            terminalScrollRef={terminalScrollRef}
            followBottom={followBottom()}
            onFollowChange={setFollowMode}
            density={preferences().density}
            toolDetails={preferences().toolDetails}
            diffStyle={preferences().diffStyle}
            terminalWidth={layout().toolContentWidth}
            toolPreviewLines={layout().toolPreviewLines}
            showJumpToBottom={jumpToBottomVisible()}
            onLoadOlderHistory={props.onLoadOlderHistory}
            onLoadNewerHistory={props.onLoadNewerHistory}
            onJumpToBottom={jumpToBottom}
            onMessageCopy={(text) => {
              if (!clipboard.write) {
                toast.show({
                  variant: "warning",
                  message: "Clipboard unavailable",
                });
                return;
              }
              void clipboard.write(text).then(
                () =>
                  toast.show({
                    variant: "success",
                    message: "Copied to clipboard",
                  }),
                (error) => toast.error(error),
              );
            }}
            onMessageFork={(turnID, prompt) => {
              if (!state.sessionID || !props.backend.sessionFork) {
                toast.show({
                  variant: "warning",
                  message: "No fork-capable runtime is available",
                });
                return;
              }
              void DialogConfirm.show(
                dialog,
                "Fork message",
                "Create a child session before this user message and restore its prompt in the composer.",
              ).then((confirmed) => {
                if (!confirmed) return;
                return props.backend.sessionFork!(
                  state.sessionID!,
                  turnID,
                ).then(
                  (fork) => {
                    composer()?.setText(prompt);
                    setComposerText(prompt);
                    composer()?.gotoBufferEnd();
                    toast.show({
                      variant: "success",
                      message: `Forked session ${fork.id}`,
                    });
                    changeSession(fork.id);
                  },
                  (error) => toast.error(error),
                );
              });
            }}
            backend={props.backend}
            onExit={exitOrCancel}
          />
          <box
            flexShrink={0}
            border={["top"]}
            borderColor={
              route.route().kind !== "none"
                ? theme.theme.muted
                : theme.theme.accent
            }
            paddingTop={1}
            paddingLeft={2}
            paddingRight={2}
          >
            <textarea
              ref={(value: TextareaRenderable) => {
                setComposer(value);
                promptRef.set(value);
              }}
              minHeight={1}
              maxHeight={Math.min(
                preferences().prompt.maxHeight,
                layout().promptMaxHeight,
              )}
              width="100%"
              placeholder={
                route.route().kind !== "none"
                  ? "Press Escape to return"
                  : "Ask anything..."
              }
              placeholderColor={theme.theme.muted}
              textColor={
                route.route().kind !== "none"
                  ? theme.theme.muted
                  : theme.theme.text
              }
              focusedTextColor={theme.theme.text}
              cursorColor={theme.theme.accent}
              onPaste={handlePaste}
              onContentChange={() =>
                setComposerText(composer()?.plainText ?? "")
              }
              onKeyDown={(event: {
                name?: string;
                ctrl?: boolean;
                alt?: boolean;
                meta?: boolean;
                option?: boolean;
                shift?: boolean;
                preventDefault(): void;
              }) => {
                const key = normalizeKey(event.name ?? "");
                const action = composerKeyAction(event);
                if (action === "submit") {
                  event.preventDefault();
                  void submit();
                  return;
                }
                if (action === "newline") {
                  event.preventDefault();
                  composer()?.insertText("\n");
                  return;
                }
                if (action === "buffer-home") {
                  event.preventDefault();
                  composer()?.gotoBufferHome();
                  return;
                }
                if (action === "buffer-end") {
                  event.preventDefault();
                  composer()?.gotoBufferEnd();
                  return;
                }
              }}
            />
            <PromptAutocomplete
              input={composer}
              text={composerText}
              workspaceFiles={props.backend.workspaceFiles}
              agents={props.backend.agents}
              mcpCatalog={props.backend.mcpCatalog}
              attach={(path) =>
                setAttachmentPaths((current) =>
                  current.includes(path) ? current : [...current, path],
                )
              }
              mentionAgent={(name) =>
                setMentionAgents((current) =>
                  current.includes(name) ? current : [...current, name],
                )
              }
              mentionResource={(resource) =>
                setMentionResources((current) =>
                  current.some(
                    (item) =>
                      item.server === resource.server &&
                      item.uri === resource.uri,
                  )
                    ? current
                    : [...current, resource],
                )
              }
            />
            <Show when={attachmentPaths().length > 0}>
              <text fg={theme.theme.muted}>
                Attachments:{" "}
                {attachmentPaths()
                  .map((path) => path.split("/").at(-1) ?? path)
                  .join(", ")}
                {" · Ctrl+Shift+O manage"}
              </text>
            </Show>
            <Show when={layout().showComposerHints}>
              <text
                fg={
                  pastePreview().startsWith("paste rejected")
                    ? theme.theme.danger
                    : theme.theme.muted
                }
              >
                {pastePreview() ||
                  (route.route().kind !== "none"
                    ? `View: ${route.route().kind}`
                    : layout().compact
                      ? `${keymapBoundary.palette} commands · ${keymapBoundary.sidebar} sidebar`
                      : `${keymapBoundary.newline} newline · ${keymapBoundary.palette} commands · ${keymapBoundary.sidebar} sidebar · ctrl+c cancel/exit`)}
              </text>
            </Show>
          </box>
          <SessionFooter workspaceRoot={props.workspaceRoot} />
        </Show>
      </box>
      <Show when={layout().sidebarVisible && !layout().sidebarOverlay}>
        <SessionSidebar
          workspaceRoot={props.workspaceRoot}
          width={layout().sidebarWidth}
          compact={layout().short}
        />
      </Show>
      <Show when={layout().sidebarOverlay}>
        <SessionSidebar
          workspaceRoot={props.workspaceRoot}
          width={Math.min(42, Math.max(28, terminalWidth() - 4))}
          compact={layout().short}
          overlay
        />
      </Show>
      <ToastRegion />
    </box>
  );
}

function scrollToBottom(scrollbox: any) {
  if (!scrollbox || scrollbox.isDestroyed) return;
  scrollbox.scrollTo(scrollbox.scrollHeight ?? 0);
}

function isNearBottom(scrollbox: any, threshold = 10) {
  if (!scrollbox || scrollbox.isDestroyed) return true;
  const scrollTop = scrollbox.scrollTop ?? scrollbox.y ?? 0;
  const viewportHeight = scrollbox.viewport?.height ?? scrollbox.height ?? 0;
  const scrollHeight = scrollbox.scrollHeight ?? 0;
  if (scrollHeight <= viewportHeight + 1) return true;
  return scrollHeight - viewportHeight - scrollTop <= threshold;
}

function normalizeKey(key: string | undefined) {
  if (key === "enter") return "return";
  return key;
}
