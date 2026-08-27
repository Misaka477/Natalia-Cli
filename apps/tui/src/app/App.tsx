import {
  InputRenderable,
  MouseEvent,
  TextareaRenderable,
  type PasteEvent,
} from "@opentui/core";
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
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { usePromptRef } from "../context/prompt";
import { useRouteController, type AppRoute } from "../context/route";
import { StateProvider, useAppState } from "../context/state";
import { activeModal } from "@natalia/ui-model";
import { useClipboard } from "../context/clipboard";
import { ToastRegion, useToast } from "../context/toast";
import type {
  RuntimeClient,
  RuntimeEvent,
  RuntimeModelSelection,
  UiAdapterMountInput,
} from "@natalia/contracts";
import type { ConfigV3 } from "@natalia/contracts";
import {
  createUiAdapterCommandHost,
  createUiAdapterMountInput,
} from "@natalia/plugin";
import { buildKeybindMap, commands, composerKeyAction } from "../keymap";
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
  DialogDiagnostics,
  DialogSessionList,
  DialogStatus,
} from "../dialog/DialogLayer";
import { DialogProviderManager } from "../component/DialogProviderManager";
import { DialogMcp } from "../component/DialogMcp";
import { DialogThemeList } from "../component/DialogThemeList";
import { messageBlockFromProjection } from "../context/view-store-adapter";
import {
  PROMPT_BOTTOM_BORDER,
  PROMPT_FRAME_BORDER,
  promptTextareaRows,
} from "../prompt-border";
import { compactModelLabel, statusValues } from "../routes/session/tool-utils";
import { markdownSyntax } from "../routes/session/tool-views";
import { DialogModel } from "../component/DialogModel";
import { DialogSkill } from "../component/DialogSkill";
import { DialogStash } from "../component/DialogStash";
import { DialogAttachment } from "../component/DialogAttachment";
import { DialogWorkspaceSearch } from "../component/DialogWorkspaceSearch";
import { DialogCheckpoint } from "../component/DialogCheckpoint";
import { DialogSandbox } from "../component/DialogSandbox";
import { LiveChatView } from "../component/LiveChatView";
import { PromptAutocomplete } from "../component/PromptAutocomplete";
import {
  editPromptExternally,
  retainEditorMentions,
} from "../prompt/external-editor";
import { DialogAgent } from "../component/DialogAgent";
import { CommandPalette } from "../component/CommandPalette";
import {
  configPatch,
  type ConfigPatch,
  type ConfigWriteScope,
} from "@natalia/config";
import { statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative as relativePath, resolve } from "node:path";
import { readClipboardImage } from "../clipboard";
import { decidePaste } from "../prompt/paste";
import { PromptHistory, shouldUseHistory } from "../prompt/history";
import {
  SessionFooter,
  SessionRoute,
  SessionSidebar,
  SubagentRoute,
} from "../routes/session/SessionRoute";
import { isLiveChatPlanApproval } from "../routes/session/permission";
import { darkTheme } from "../theme/theme";
import { ThemeProvider, useTheme } from "../context/theme";
import { LocalProvider, useLocal } from "../context/local";
import {
  sessionLayout,
  type SessionView,
  type SidebarMode,
} from "../session-layout";
import {
  defaultTuiPreferences,
  loadTuiPreferences,
  reloadTuiPreferencesOnSettingsUpdate,
  saveTuiPreferences,
  tuiPreferencePatch,
  type TuiPreferences,
} from "../settings";
import type { TuiConfigWriteScope } from "../config";
import { resolveWorkspaceInput, validateWorkspaceInput } from "../workspace";

import {
  parseSettingsRecord,
  parseSettingsStringRecord,
} from "./settings-utils";
import { runCommand } from "./command-controller";

type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";
type TuiRuntimeClient = RuntimeClient;

export function App(props: {
  backend: TuiRuntimeClient;
  commands?: UiAdapterMountInput["commands"];
  createBackend?: (
    sessionID?: string,
  ) => TuiRuntimeClient | Promise<TuiRuntimeClient>;
  onBackendChange?: (backend: RuntimeClient) => void;
  onWorkspaceRootChange?: (root: string) => void;
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
  const [workspaceRoot, setWorkspaceRoot] = createSignal(props.workspaceRoot);
  const [historyCursor, setHistoryCursor] = createSignal<string>();
  const [newerHistoryCursor, setNewerHistoryCursor] = createSignal<string>();
  const runtimeEventListeners = new Set<(event: RuntimeEvent) => void>();
  let loadingHistory = false;
  let historyHydrate:
    | ((
        messages: import("@natalia/contracts").RuntimeProjectedMessage[],
        direction?: "older" | "newer",
      ) => boolean)
    | undefined;

  async function changeSession(sessionID?: string) {
    setHistoryCursor(undefined);
    setNewerHistoryCursor(undefined);
    historyHydrate = undefined;
    if (props.createBackend) {
      const previous = backend();
      const next = await props.createBackend(sessionID);
      setBackend(next);
      props.onBackendChange?.(next);
      await previous.dispose?.();
    }
    props.onSessionChange?.(sessionID);
  }

  /** Switches the live workspace: re-point the root, create a fresh backend on
      it, swap, and dispose the old — no TUI restart. The active-turn guard
      lives at the command layer, which has the turn state. */
  async function changeWorkspace(nextRoot: string) {
    if (props.createBackend && props.onWorkspaceRootChange) {
      const previous = backend();
      // Carry user-level team settings from the source workspace into the
      // global scope. Model configuration is already global-only.
      try {
        const source = await previous.configGet?.();
        const userPatch: Record<string, unknown> = {};
        if (source?.team) userPatch.team = source.team;
        if (Object.keys(userPatch).length)
          await previous.updateConfig?.({
            scope: "global",
            patch: userPatch as never,
          });
      } catch {
        // A failed migration must not block the switch itself.
      }
      setWorkspaceRoot(nextRoot);
      props.onWorkspaceRootChange(nextRoot);
      const next = await props.createBackend();
      setBackend(next);
      props.onBackendChange?.(next);
      await previous.dispose?.();
    }
  }

  return (
    <Show when={backend()} keyed>
      {(activeBackend) => (
        <ThemeProvider workspaceRoot={workspaceRoot()}>
          <LocalProvider workspaceRoot={workspaceRoot()}>
            <StateProvider
              onReady={(bridge) => {
                historyHydrate = bridge.hydrateMessages;
                activeBackend.start(
                  (event: RuntimeEvent) => {
                    bridge.dispatch(event);
                    for (const listener of runtimeEventListeners)
                      listener(event);
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
                  commands={
                    activeBackend === props.backend
                      ? props.commands
                      : commandHostFor(activeBackend)
                  }
                  workspaceRoot={workspaceRoot()}
                  onSessionChange={(sessionID) => void changeSession(sessionID)}
                  onWorkspaceChange={
                    props.createBackend && props.onWorkspaceRootChange
                      ? (root) => void changeWorkspace(root)
                      : undefined
                  }
                  initialRoute={props.initialRoute}
                  subscribeRuntimeEvents={(handler) => {
                    runtimeEventListeners.add(handler);
                    return () => runtimeEventListeners.delete(handler);
                  }}
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
          </LocalProvider>
        </ThemeProvider>
      )}
    </Show>
  );
}

const commandHostCache = new WeakMap<
  RuntimeClient,
  UiAdapterMountInput["commands"]
>();
/**
 * The full adapter command host for a backend the app itself created (a worker
 * after a session/workspace switch). Use the command-only host builder: the
 * mount-input variant calls `runtime.start` and would clobber the event sink
 * installed by StateProvider. Cached per backend for object identity stability.
 */
function commandHostFor(
  runtime: RuntimeClient,
): UiAdapterMountInput["commands"] {
  let host = commandHostCache.get(runtime);
  if (!host) {
    host = createUiAdapterCommandHost(runtime);
    commandHostCache.set(runtime, host);
  }
  return host;
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
  backend: TuiRuntimeClient;
  commands?: UiAdapterMountInput["commands"];
  workspaceRoot?: string;
  onSessionChange?: (sessionID?: string) => void;
  onWorkspaceChange?: (root: string) => void;
  onLoadOlderHistory?: () => Promise<void>;
  onLoadNewerHistory?: () => Promise<void>;
  subscribeRuntimeEvents?: (
    handler: (event: RuntimeEvent) => void,
  ) => () => void;
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
  // The docked view host: which view is open and which pane owns the keyboard.
  // Presentation state, so it lives here (like the sidebar) rather than in the
  // runtime event stream.
  const [viewActive, setViewActive] = createSignal<SessionView | null>(
    renderer.width < 112 ? null : "chat",
  );
  const [viewFocus, setViewFocus] = createSignal<"main" | "chat" | "sidebar">(
    "main",
  );
  const [chatInput, setChatInput] = createSignal<InputRenderable>();
  const promptRef = usePromptRef();
  const { state, dispatch } = useAppState();
  const route = useRouteController();
  const clipboard = useClipboard();
  const toast = useToast();
  const dialog = useDialog();
  const [composer, setComposer] = createSignal<TextareaRenderable>();
  const [composerRows, setComposerRows] = createSignal(1);
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
  // User-level settings (models, providers, team, TUI prefs) default to the
  // GLOBAL scope so they follow the user across workspace switches; the scope
  // toggle writes workspace-specific settings to the project scope.
  const [tuiWriteScope, setTuiWriteScope] =
    createSignal<TuiConfigWriteScope>("global");
  const [configWriteScope, setConfigWriteScope] =
    createSignal<ConfigWriteScope>("global");
  const [configRevision, setConfigRevision] = createSignal(0);
  const layout = () =>
    sessionLayout(
      terminalWidth(),
      terminalHeight(),
      sidebarMode(),
      sidebarOpen(),
      viewActive() !== null,
    );
  const compactComposerControls = () => layout().contentWidth < 64;
  const minimalComposerControls = () => layout().contentWidth < 34;
  const interactivePromptActive = () => {
    if (state.dialog === "question") return true;
    if (state.dialog !== "approval") return false;
    return !isLiveChatPlanApproval(activeModal(state.modal), state.facts.plans);
  };
  // The pane owns the keyboard: chat hands focus to the view's input, main (or
  // a closed view) hands it back to the composer. LiveChatView itself focuses
  // its input when focused(), so this only blurs the side leaving focus.
  createEffect(() => {
    const pane = viewFocus();
    const open = viewActive() !== null;
    if (interactivePromptActive() || (open && pane !== "main")) {
      composer()?.blur();
      return;
    }
    chatInput()?.blur();
    queueMicrotask(() => composer()?.focus());
  });
  createEffect(() => {
    if (interactivePromptActive() || route.route().kind === "subagent") return;
    queueMicrotask(() => composer()?.focus());
  });
  createEffect(() => {
    layout().contentWidth;
    const maxHeight = Math.min(
      preferences().prompt.maxHeight,
      layout().promptMaxHeight,
    );
    queueMicrotask(() =>
      setComposerRows(promptTextareaRows(composer(), maxHeight)),
    );
  });
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
  const [modelSubmissions, setModelSubmissions] = createSignal(0);
  const [quickModel, setQuickModel] = createSignal<RuntimeModelSelection>({});
  const [quickReasoning, setQuickReasoning] = createSignal<ReasoningEffort>();
  const [chatNormalModel, setChatNormalModel] =
    createSignal<RuntimeModelSelection>({});
  const [chatExpertModel, setChatExpertModel] =
    createSignal<RuntimeModelSelection>({});
  const [chatNormalReasoning, setChatNormalReasoning] =
    createSignal<ReasoningEffort>();
  const [chatExpertReasoning, setChatExpertReasoning] =
    createSignal<ReasoningEffort>();
  const [chatUseExpert, setChatUseExpert] = createSignal(false);
  const [chatAttachmentPaths, setChatAttachmentPaths] = createSignal<string[]>(
    [],
  );
  const [quickProfile, setQuickProfile] = createSignal("ask");
  let composerControlTimer: ReturnType<typeof setTimeout> | undefined;
  let ignoreStopUntil = 0;
  let restoredAgent = false;
  let preferencesLoad = 0;

  async function reloadTuiPreferences() {
    if (!props.workspaceRoot) return;
    const load = ++preferencesLoad;
    const loaded = await loadTuiPreferences(props.workspaceRoot);
    if (load !== preferencesLoad) return;
    setPreferences(loaded);
    keybinds.set(loaded.keybinds);
    setFollowMode(loaded.followBottom);
    theme.preview(loaded.theme);
  }

  onMount(() => {
    const unsubscribe = props.subscribeRuntimeEvents?.((event) => {
      const reload = reloadTuiPreferencesOnSettingsUpdate(
        event,
        reloadTuiPreferences,
      );
      if (reload) void reload.catch(toast.error);
    });
    onCleanup(() => unsubscribe?.());
  });

  createEffect(() => {
    if (restoredAgent || !local.ready) return;
    restoredAgent = true;
    if (local.state.activeAgent)
      props.backend.selectAgent?.(local.state.activeAgent);
  });

  createEffect(() => {
    if (!props.workspaceRoot) return;
    void reloadTuiPreferences().catch(toast.error);
  });

  onMount(() => {
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

  async function persistConfigOutcome(
    next: ConfigPatch,
    base?: ConfigV3,
    scopeOverride?: ConfigWriteScope,
  ): Promise<boolean> {
    // The same path a remote consumer takes: write via the public config
    // surface, so the TUI and an external integration cannot drift apart.
    const scope = scopeOverride ?? configWriteScope();
    if (!props.backend.updateConfig)
      throw new Error("Runtime backend does not support config updates");
    const reload = await props.backend.updateConfig({
      patch: (base ? configPatch(base, next as ConfigV3) : next) as Record<
        string,
        unknown
      >,
      scope,
    });
    // Dialogs resolve the effective global + project configuration themselves.
    // Notify any mounted reader after the durable write, even when the runtime
    // cannot apply that write until the active turn finishes.
    setConfigRevision((revision) => revision + 1);
    // Refusal is an ordinary answer now, not an exception, so it has to be said:
    // the file was written either way, and reporting "applied" when the runtime
    // declined would tell the user their change is live when it is not.
    if (!reload.applied) {
      toast.show({
        variant: "warning",
        message: `Runtime config saved but not applied: ${
          reload.reason ?? "the runtime declined to apply it"
        }`,
      });
      return false;
    }
    toast.show({
      variant: "success",
      message: "Runtime config saved and applied",
    });
    return true;
  }

  async function persistConfig(
    next: ConfigPatch,
    base?: ConfigV3,
  ): Promise<boolean> {
    return persistConfigOutcome(next, base);
  }

  function isReasoningEffort(value: unknown): value is ReasoningEffort {
    return (
      value === "minimal" ||
      value === "low" ||
      value === "medium" ||
      value === "high" ||
      value === "xhigh"
    );
  }

  function syncChatModelProfileToBackend() {
    const profile: import("@natalia/contracts").ChatModelProfile = {
      normal: chatNormalModel().modelID
        ? {
            modelID: chatNormalModel().modelID,
            variant: chatNormalModel().variant,
            reasoningEffort: chatNormalReasoning(),
          }
        : undefined,
      expert: chatExpertModel().modelID
        ? {
            modelID: chatExpertModel().modelID,
            variant: chatExpertModel().variant,
            reasoningEffort: chatExpertReasoning(),
          }
        : undefined,
    };
    void props.backend.setChatModelProfile?.(profile).catch(() => undefined);
  }

  async function refreshQuickControls() {
    const root = props.workspaceRoot ?? process.cwd();
    const [selection, profiles, reasoning] = await Promise.all([
      props.backend.modelSelection?.(),
      props.backend.permissionList?.(),
      props.backend.reasoningEffort?.(),
    ]);
    if (selection) setQuickModel(selection);
    if (profiles) setQuickProfile(profiles.default);
    setQuickReasoning(reasoning);
  }

  onMount(() => {
    void refreshQuickControls().catch(() => undefined);
  });

  createEffect(() => {
    if (!local.ready) return;
    if (local.state.chatNormalModel)
      setChatNormalModel(local.state.chatNormalModel);
    if (local.state.chatExpertModel)
      setChatExpertModel(local.state.chatExpertModel);
    if (local.state.chatNormalReasoning)
      setChatNormalReasoning(local.state.chatNormalReasoning);
    if (local.state.chatExpertReasoning)
      setChatExpertReasoning(local.state.chatExpertReasoning);
    syncChatModelProfileToBackend();
  });

  createEffect(() => {
    const selection = state.facts.modelSelection;
    if (!selection) return;
    setQuickModel(selection);
    void props.backend
      .reasoningEffort?.()
      .then((reasoning) => setQuickReasoning(reasoning))
      .catch(() => undefined);
  });

  function openModelPicker() {
    if (modelBusy()) {
      toast.show({
        variant: "warning",
        message: "Finish or stop queued work before changing the model",
      });
      return;
    }
    dialog.push(() => (
      <DialogModel
        workspaceRoot={props.workspaceRoot ?? process.cwd()}
        catalog={props.backend.modelCatalog}
        selection={props.backend.modelSelection}
        selectRuntimeModel={props.backend.selectModel}
        configRevision={configRevision}
        loadConfig={() =>
          props.backend.configGet?.() ??
          Promise.reject(new Error("runtime config read unavailable"))
        }
        onPersist={persistConfig}
        onSelected={(selection) => {
          setQuickModel(selection);
          void props.backend
            .reasoningEffort?.()
            .then((reasoning) => setQuickReasoning(reasoning))
            .catch(() => undefined);
        }}
      />
    ));
  }

  function openReasoningPicker() {
    if (modelBusy()) {
      toast.show({
        variant: "warning",
        message: "Finish or stop queued work before changing reasoning effort",
      });
      return;
    }
    const modelID = quickModel().modelID ?? state.facts.modelSelection?.modelID;
    if (!modelID) {
      toast.show({ variant: "warning", message: "Select a model first" });
      return;
    }
    dialog.push(() => (
      <DialogSelect
        title="Reasoning effort"
        renderFilter={false}
        current={quickReasoning() ?? ""}
        options={
          [
            { title: "Default", value: "" },
            { title: "Minimal", value: "minimal" },
            { title: "Low", value: "low" },
            { title: "Medium", value: "medium" },
            { title: "High", value: "high" },
            { title: "XHigh", value: "xhigh" },
          ] as Array<
            DialogSelectOption<
              "" | "minimal" | "low" | "medium" | "high" | "xhigh"
            >
          >
        }
        onSelect={(option) => {
          dialog.pop();
          const reasoningEffort = (option.value || undefined) as
            | ReasoningEffort
            | undefined;
          void props.backend
            .setReasoningEffort?.(reasoningEffort)
            .then(() => setQuickReasoning(reasoningEffort))
            .catch(toast.error);
        }}
      />
    ));
  }

  function openChatModelPicker(kind: "normal" | "expert") {
    const current = kind === "normal" ? chatNormalModel() : chatExpertModel();
    dialog.push(() => (
      <DialogModel
        workspaceRoot={props.workspaceRoot ?? process.cwd()}
        catalog={props.backend.modelCatalog}
        selection={async () => current}
        loadConfig={() =>
          props.backend.configGet?.() ??
          Promise.reject(new Error("runtime config read unavailable"))
        }
        onPersist={async () => true}
        onSelected={(selection) => {
          if (kind === "normal") {
            setChatNormalModel(selection);
            local.setChatNormalModel(selection);
          } else {
            setChatExpertModel(selection);
            local.setChatExpertModel(selection);
          }
          syncChatModelProfileToBackend();
        }}
      />
    ));
  }

  function openChatReasoningPicker(kind: "normal" | "expert") {
    const model =
      kind === "normal"
        ? (chatNormalModel().modelID ??
          quickModel().modelID ??
          state.facts.modelSelection?.modelID)
        : (chatExpertModel().modelID ??
          quickModel().modelID ??
          state.facts.modelSelection?.modelID);
    if (!model) {
      toast.show({ variant: "warning", message: "Select a Chat model first" });
      return;
    }
    const current =
      kind === "normal" ? chatNormalReasoning() : chatExpertReasoning();
    dialog.push(() => (
      <DialogSelect
        title={`${kind === "normal" ? "Chat" : "Expert"} reasoning effort`}
        renderFilter={false}
        current={current ?? ""}
        options={
          [
            { title: "Default", value: "" },
            { title: "Minimal", value: "minimal" },
            { title: "Low", value: "low" },
            { title: "Medium", value: "medium" },
            { title: "High", value: "high" },
            { title: "XHigh", value: "xhigh" },
          ] as Array<
            DialogSelectOption<
              "" | "minimal" | "low" | "medium" | "high" | "xhigh"
            >
          >
        }
        onSelect={(option) => {
          dialog.pop();
          const reasoningEffort = (option.value || undefined) as
            | ReasoningEffort
            | undefined;
          if (kind === "normal") {
            setChatNormalReasoning(reasoningEffort);
            local.setChatNormalReasoning(reasoningEffort);
          } else {
            setChatExpertReasoning(reasoningEffort);
            local.setChatExpertReasoning(reasoningEffort);
          }
          syncChatModelProfileToBackend();
        }}
      />
    ));
  }

  function openProfilePicker() {
    if (modelBusy()) {
      toast.show({
        variant: "warning",
        message: "Finish or stop queued work before changing the work profile",
      });
      return;
    }
    if (!props.backend.permissionList) {
      toast.show({
        variant: "warning",
        message: "This runtime does not expose permission profiles",
      });
      return;
    }
    void props.backend.permissionList().then(
      (profiles) =>
        dialog.push(() => (
          <DialogSelect
            title="Work profile"
            placeholder="Search profiles"
            current={quickProfile()}
            options={profiles.profiles.map((profile) => ({
              title:
                profile.name === "ask"
                  ? "Ask"
                  : profile.name === "auto"
                    ? "Auto"
                    : profile.name === "read_only"
                      ? "Read-only"
                      : profile.name,
              value: profile.name,
              category:
                profile.name === "ask" ||
                profile.name === "auto" ||
                profile.name === "read_only"
                  ? "Built-in"
                  : "Profiles",
              description:
                profile.description || `approval: ${profile.approval}`,
            }))}
            onSelect={(option) => {
              dialog.pop();
              void persistConfigOutcome({ defaultPermission: option.value })
                .then((applied) => {
                  if (applied) setQuickProfile(option.value);
                })
                .catch(toast.error);
            }}
          />
        )),
      toast.error,
    );
  }

  function openAttachmentManager() {
    onCommand("prompt.attachment.list");
  }

  function openChatAttachmentManager() {
    dialog.push(() => (
      <DialogAttachment
        paths={chatAttachmentPaths}
        add={() => addChatAttachment()}
        pasteImage={() => void pasteChatAttachmentImage()}
        remove={(path) =>
          setChatAttachmentPaths((current) =>
            current.filter((item) => item !== path),
          )
        }
      />
    ));
  }

  function addChatAttachment() {
    dialog.push(() => (
      <DialogPrompt
        title="Queue Chat attachment"
        placeholder="workspace-relative path, e.g. assets/diagram.png"
        validate={(value) => {
          const path = value.trim();
          if (!path) return "Attachment path is required";
          if (path.startsWith("/") || path.split(/[\/]/u).includes(".."))
            return "Path must remain within the workspace";
          return undefined;
        }}
        onConfirm={(value) => {
          const path = value.trim();
          setChatAttachmentPaths((current) =>
            current.includes(path) ? current : [...current, path],
          );
          dialog.pop();
          setViewFocus("chat");
        }}
      />
    ));
  }

  async function pasteChatAttachmentImage() {
    const root = props.workspaceRoot ?? process.cwd();
    const bytes = await readClipboardImage();
    if (!bytes || !bytes.length) {
      toast.show({
        variant: "error",
        message:
          "no image on the system clipboard (needs wl-paste/xclip on Linux, osascript on macOS, or PowerShell on Windows)",
      });
      return;
    }
    const dir = join(root, ".natalia", "attachments");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const filename = `chat-pasted-${Date.now()}.png`;
    await writeFile(join(dir, filename), bytes);
    const relative = `.natalia/attachments/${filename}`;
    setChatAttachmentPaths((current) =>
      current.includes(relative) ? current : [...current, relative],
    );
    toast.show({
      variant: "success",
      message: `queued clipboard image: ${relative}`,
    });
    setViewFocus("chat");
  }

  function undoMainRollback() {
    const pending = state.pendingRollback;
    if (!pending || pending.kind !== "main") return;
    composer()?.setText?.("");
    setComposerText("");
    composer()?.gotoBufferEnd();
    if (!props.backend.checkpointRollback || !pending.safetyCheckpointID) {
      toast.show({
        variant: "warning",
        message: "Rollback undo is unavailable",
      });
      return;
    }
    void props.backend
      .checkpointRollback({ id: pending.safetyCheckpointID })
      .then(
        () => {
          toast.show({ variant: "success", message: "Rollback undone" });
          setViewFocus("main");
        },
        (error) => toast.error(error),
      );
  }

  function undoChatRollback() {
    const pending = state.pendingRollback;
    if (!pending || pending.kind !== "chat") return;
    chatInput()?.setText?.("");
    dispatch({ type: "tui.rollback.undo" } as never);
    setViewFocus("chat");
  }

  async function submit() {
    const input = composer();
    const text = (input?.plainText ?? "").replace(/\n$/, "");
    if (!text.trim()) return;
    const control = text.trim();
    // While an approval or question is pending, Enter is owned by the inline
    // prompt card; this guard exists for the other submit paths so a turn can
    // never be launched past a decision the runtime is waiting on.
    if (
      (state.dialog === "approval" || state.dialog === "question") &&
      viewFocus() !== "chat"
    ) {
      if (control !== "/pause" && control !== "/resume") {
        toast.show({
          variant: "warning",
          message: "Answer the pending prompt above first",
        });
        return;
      }
    }
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
    const commandMatch = control.match(/^\/(\S+)(?:\s+(.*))?$/u);
    if (commandMatch) {
      const commandHost =
        props.commands ?? createUiAdapterCommandHost(props.backend);
      const name = commandMatch[1]!;
      if ((await commandHost.list()).some((entry) => entry.name === name)) {
        input?.clear();
        history.add(text);
        const args =
          commandMatch[2]?.trim().split(/\s+/u).filter(Boolean) ?? [];
        await commandHost.execute({ name, raw: control, args });
        setTimeout(() => composer()?.focus(), 1);
        return;
      }
    }
    const attachments = attachmentPaths();
    const agents = mentionAgents();
    const resources = mentionResources();
    const previousSubmissionID = state.facts.lastSubmission?.id;
    // Busy stays steer: a follow-up joins the live turn at its next safe
    // boundary (admission is durable) instead of parking behind queue
    // delivery. Explicit queue delivery stays available to the CLI/API.
    if (
      (attachments.length || agents.length || resources.length) &&
      !props.backend.submitInput
    ) {
      toast.show({
        variant: "warning",
        message: "This runtime transport does not support attachments",
      });
      return;
    }
    setModelSubmissions((value) => value + 1);
    const shouldFollow = isNearBottom(scrollRef.current);
    setFollowMode(shouldFollow);
    if (shouldFollow) toBottom(0);
    try {
      input?.clear();
      setPastePreview("");
      history.add(text);
      setAttachmentPaths([]);
      setMentionAgents([]);
      setMentionResources([]);
      // A live follow-up steers through submitInput so its admission is
      // durable and never blocks on the running drain; an idle text submit
      // keeps the plain submit path for transports without an inbox.
      const steerLive = Boolean(props.backend.submitInput && modelBusy());
      const admitted =
        props.backend.submitInput &&
        (attachments.length || agents.length || resources.length || steerLive)
          ? props.backend.submitInput({
              text,
              delivery: "steer",
              ...(attachments.length ? { attachments } : {}),
              ...(agents.length
                ? { agents: agents.map((name) => ({ name })) }
                : {}),
              ...(resources.length
                ? {
                    resources: resources.map((resource) => ({
                      server: resource.server,
                      uri: resource.uri,
                      name: resource.name,
                      mimeType: resource.mimeType,
                    })),
                  }
                : {}),
            })
          : props.backend.submit(text);
      void admitted.catch((error: unknown) => {
        toast.error(error);
      });
    } catch (error) {
      // Runtime events are batched before they reach the projection. Give an
      // admission event a chance to land before deciding this draft was lost.
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (
        state.facts.lastSubmission?.id === previousSubmissionID &&
        !composer()?.plainText
      ) {
        composer()?.setText(text);
        setComposerText(text);
        setAttachmentPaths((current) => [
          ...new Set([...attachments, ...current]),
        ]);
        setMentionAgents((current) => [...new Set([...agents, ...current])]);
        setMentionResources((current) => [
          ...resources,
          ...current.filter(
            (candidate) =>
              !resources.some(
                (resource) =>
                  resource.server === candidate.server &&
                  resource.uri === candidate.uri,
              ),
          ),
        ]);
      }
      toast.error(error);
    } finally {
      setModelSubmissions((value) => Math.max(0, value - 1));
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
    // A paste whose every non-empty line is an existing workspace file is
    // queued as attachments and never inserted into the composer: the user
    // dragged files in, and the paths are not what they wanted to send.
    if (detectPastedFilePaths(event.bytes)) {
      event.preventDefault();
      return;
    }
  }

  /**
   * Terminals paste a dragged-in file as its path text, so "drag a screenshot
   * or a video into the composer" arrives here as lines of text. When every
   * non-empty line is an existing file inside the workspace, queue them as
   * attachments instead of leaving the user to notice the paths in the text.
   * Partial matches are left alone: the paste may be prose mentioning paths.
   */
  function detectPastedFilePaths(bytes: Uint8Array): boolean {
    const root = props.workspaceRoot;
    if (!root) return false;
    const lines = new TextDecoder("utf-8")
      .decode(bytes)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return false;
    const resolved = lines.map((line) => resolve(root, line));
    const inside = resolved.map((path) => {
      const relative = relativePath(root, path);
      return relative !== "" && !relative.startsWith("..");
    });
    if (!inside.every(Boolean)) return false;
    const files = resolved.filter((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    });
    if (files.length !== resolved.length) return false;
    setAttachmentPaths((current) => {
      const next = [...current];
      for (const path of resolved) {
        const relative = relativePath(root, path);
        if (!next.includes(relative)) next.push(relative);
      }
      return next;
    });
    setPastePreview(
      `queued ${files.length} pasted ${files.length === 1 ? "file" : "files"} as attachments`,
    );
    return true;
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
    if (
      state.facts.activeTurn ||
      modelSubmissions() > 0 ||
      hasQueuedPrompts()
    ) {
      props.backend.cancel();
    } else if (composer()?.plainText) {
      composer()?.clear();
    } else {
      renderer.destroy();
    }
  }

  function busy() {
    return modelBusy();
  }

  function modelBusy() {
    // Queued inbox rows are durable pending work, not a live turn: Stop stays
    // idle with them until the next prompt wakes the drain.
    return Boolean(state.facts.activeTurn);
  }

  function modelActive() {
    return Boolean(state.facts.activeTurn);
  }

  function hasQueuedPrompts() {
    return state.facts.messages.some(
      (message) => message.role === "user" && message.status === "queued",
    );
  }

  function queuedPromptCount() {
    return state.facts.messages.filter(
      (message) => message.role === "user" && message.status === "queued",
    ).length;
  }

  function activateComposerControl() {
    if (modelActive()) {
      if (Date.now() < ignoreStopUntil) return;
      exitOrCancel();
      return;
    }
    if (composerControlTimer) clearTimeout(composerControlTimer);
    composerControlTimer = setTimeout(() => {
      composerControlTimer = undefined;
      ignoreStopUntil = Date.now() + 250;
      void submit();
    }, 100);
  }

  onCleanup(() => {
    if (composerControlTimer) clearTimeout(composerControlTimer);
  });

  function changeSession(sessionID?: string) {
    if (busy()) {
      props.backend.diagnostic(
        "Finish or cancel the current turn before switching sessions.",
      );
      return;
    }
    props.onSessionChange?.(sessionID);
  }

  function changeWorkspace(root: string) {
    if (busy()) {
      props.backend.diagnostic(
        "Finish or cancel the current turn before switching workspaces.",
      );
      return;
    }
    props.onWorkspaceChange?.(root);
  }

  function openWorkspaceSwitcher() {
    if (!props.onWorkspaceChange) {
      toast.show({
        variant: "warning",
        message: "Workspace switching is not available in this runtime",
      });
      return;
    }
    if (busy()) {
      props.backend.diagnostic(
        "Finish or cancel the current turn before switching workspaces.",
      );
      return;
    }
    dialog.push(() => (
      <DialogPrompt
        title="Switch Workspace"
        description={() => (
          <text fg={theme.theme.muted}>
            Enter a directory to re-create the runtime in that workspace.
          </text>
        )}
        value={props.workspaceRoot ?? process.cwd()}
        validate={(value) => validateWorkspaceInput(value, props.workspaceRoot)}
        onConfirm={(value) => {
          dialog.clear();
          changeWorkspace(resolveWorkspaceInput(value, props.workspaceRoot));
        }}
      />
    ));
  }

  function onCommand(command: string) {
    void runCommand(command, {
      backend: props.backend,
      commands: props.commands ?? createUiAdapterCommandHost(props.backend),
      workspaceRoot: props.workspaceRoot,
      composer: () => composer(),
      setAttachmentPaths,
      setMentionAgents,
      setMentionResources,
      attachmentPaths,
      changeSession,
      changeWorkspace,
      openWorkspaceSwitcher,
      persistConfig,
      configRevision,
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
      subscribeRuntimeEvents: props.subscribeRuntimeEvents,
      viewDock: {
        active: viewActive,
        focus: viewFocus,
        openChat: () => {
          setViewActive("chat");
          setViewFocus("chat");
        },
        switchView: () => {
          if (layout().paneMode === "single") {
            if (viewActive() === null) {
              setViewActive("chat");
              setViewFocus("chat");
            } else if (viewActive() === "chat") {
              setViewActive("plan");
              setViewFocus("sidebar");
            } else {
              setViewActive(null);
              setViewFocus("main");
            }
            return;
          }
          if (layout().paneMode === "double") {
            const next = viewActive() === "chat" ? "plan" : "chat";
            setViewActive(next);
            setViewFocus(next === "chat" ? "chat" : "sidebar");
            return;
          }
          setViewActive("chat");
          setViewFocus((current) =>
            current === "main"
              ? "chat"
              : current === "chat"
                ? "sidebar"
                : "main",
          );
        },
        focusChat: () => {
          if (viewActive() === "chat") {
            setViewFocus("chat");
            return;
          }
          setViewActive("chat");
          setViewFocus("chat");
        },
        focusMain: () => setViewFocus("main"),
      },
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

  function toBottom(delay = 50) {
    setTimeout(() => scrollToBottom(scrollRef.current), delay);
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

  function copyMessage(text: string) {
    if (!clipboard.write) {
      toast.show({ variant: "warning", message: "Clipboard unavailable" });
      return;
    }
    void clipboard.write(text).then(
      () => toast.show({ variant: "success", message: "Copied to clipboard" }),
      (error) => toast.error(error),
    );
  }

  return (
    <box
      flexDirection="row"
      width="100%"
      height="100%"
      backgroundColor={theme.theme.background}
      border={["top", "bottom"]}
      borderColor={theme.theme.muted}
    >
      <box
        flexGrow={1}
        minWidth={0}
        height="100%"
        flexDirection="column"
        border={["left", "right"]}
        borderColor={theme.theme.muted}
      >
        <Show when={activeSubagentRoute()} keyed>
          {(current) => (
            <SubagentRoute
              agentID={current.id}
              onBack={() => route.back()}
              scrollRef={scrollRef}
              followBottom={followBottom()}
              onFollowChange={setFollowMode}
              density={preferences().density}
              toolDetails={preferences().toolDetails}
              diffStyle={preferences().diffStyle}
              reasoning={preferences().reasoning}
              terminalWidth={layout().toolContentWidth}
              toolPreviewLines={layout().toolPreviewLines}
              showJumpToBottom={jumpToBottomVisible()}
              onJumpToBottom={jumpToBottom}
              backend={props.backend}
              onExit={() => renderer.destroy()}
              onMessageCopy={copyMessage}
              workspaceRoot={props.workspaceRoot}
              onWorkspaceSelect={openWorkspaceSwitcher}
            />
          )}
        </Show>
        <Show when={!activeSubagentRoute()}>
          <SessionRoute
            scrollRef={scrollRef}
            followBottom={followBottom()}
            onFollowChange={setFollowMode}
            density={preferences().density}
            toolDetails={preferences().toolDetails}
            diffStyle={preferences().diffStyle}
            reasoning={preferences().reasoning}
            terminalWidth={layout().toolContentWidth}
            toolPreviewLines={layout().toolPreviewLines}
            showJumpToBottom={jumpToBottomVisible()}
            onLoadOlderHistory={props.onLoadOlderHistory}
            onLoadNewerHistory={props.onLoadNewerHistory}
            onJumpToBottom={jumpToBottom}
            onMessageCopy={copyMessage}
            onMessageFork={(turnID, prompt) => {
              if (!state.facts.sessionID || !props.backend.sessionFork) {
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
                  state.facts.sessionID!,
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
            onMessageRestore={(turnID) => {
              if (!props.backend.checkpointList) {
                toast.show({
                  variant: "warning",
                  message:
                    "Checkpoint management is unavailable in this runtime",
                });
                return;
              }
              dialog.push(() => (
                <DialogCheckpoint
                  backend={props.backend}
                  turnID={turnID}
                  onRestored={(restoredTurnID) => {
                    const source = state.messages.find(
                      (block) =>
                        block.role === "user" &&
                        block.id === `${restoredTurnID}:user`,
                    );
                    if (!source) return;
                    composer()?.setText?.(source.text);
                    setComposerText(source.text);
                    composer()?.gotoBufferEnd();
                    setViewFocus("main");
                  }}
                />
              ));
            }}
            onToolRestore={(turnID, callID) => {
              if (!props.backend.checkpointList) {
                toast.show({
                  variant: "warning",
                  message:
                    "Checkpoint management is unavailable in this runtime",
                });
                return;
              }
              dialog.push(() => (
                <DialogCheckpoint
                  backend={props.backend}
                  turnID={turnID}
                  stepID={`${turnID}:${callID}`}
                />
              ));
            }}
            backend={props.backend}
            onExit={exitOrCancel}
            showInteractivePrompt={
              viewActive() !== "chat" ||
              !isLiveChatPlanApproval(
                activeModal(state.modal),
                state.facts.plans,
              )
            }
          />
          {/* The composer box, copied line for line from the reference TUI's prompt
              (packages/tui/src/component/prompt/index.tsx): an outer anchor, a
              left frame with a rounded bottom-left corner, a padded panel box
              holding the textarea and a meta row, and a one-line bottom frame. */}
          <box visible={!interactivePromptActive()} width="100%" flexShrink={0}>
            <box
              width="100%"
              border={["left"]}
              borderColor={
                route.route().kind !== "none"
                  ? theme.theme.muted
                  : theme.theme.accent
              }
              customBorderChars={PROMPT_FRAME_BORDER}
            >
              <box
                paddingLeft={2}
                paddingRight={2}
                paddingTop={1}
                flexShrink={0}
                backgroundColor={theme.theme.panel}
                flexGrow={1}
                width="100%"
              >
                <Show when={state.pendingRollback?.kind === "main"}>
                  <box
                    flexDirection="row"
                    justifyContent="space-between"
                    paddingBottom={1}
                  >
                    <text fg={theme.theme.warning} wrapMode="word">
                      Rollback pending — edit the restored message and send, or
                      undo.
                    </text>
                    <text fg={theme.theme.warning} onMouseUp={undoMainRollback}>
                      undo
                    </text>
                  </box>
                </Show>
                <box width="100%" flexDirection="row" alignItems="flex-end">
                  <textarea
                    ref={(value: TextareaRenderable) => {
                      setComposer(value);
                      promptRef.set(value);
                      queueMicrotask(() =>
                        setComposerRows(
                          promptTextareaRows(
                            value,
                            Math.min(
                              preferences().prompt.maxHeight,
                              layout().promptMaxHeight,
                            ),
                          ),
                        ),
                      );
                    }}
                    height={composerRows()}
                    minHeight={1}
                    maxHeight={Math.min(
                      preferences().prompt.maxHeight,
                      layout().promptMaxHeight,
                    )}
                    flexGrow={1}
                    minWidth={0}
                    placeholder={
                      state.dialog === "approval" || state.dialog === "question"
                        ? "Answer the pending prompt above"
                        : route.route().kind !== "none"
                          ? "Press Escape to return"
                          : modelBusy()
                            ? "Working — your message joins the current turn"
                            : "Ask anything..."
                    }
                    placeholderColor={theme.theme.muted}
                    textColor={
                      state.dialog === "approval" || state.dialog === "question"
                        ? theme.theme.muted
                        : route.route().kind !== "none"
                          ? theme.theme.muted
                          : theme.theme.text
                    }
                    focusedTextColor={theme.theme.text}
                    focusedBackgroundColor={theme.theme.panel}
                    cursorColor={theme.theme.text}
                    syntaxStyle={markdownSyntax()}
                    onMouseDown={(event: MouseEvent) => event.target?.focus()}
                    onPaste={handlePaste}
                    onContentChange={() => {
                      setComposerText(composer()?.plainText ?? "");
                      setComposerRows(
                        promptTextareaRows(
                          composer(),
                          Math.min(
                            preferences().prompt.maxHeight,
                            layout().promptMaxHeight,
                          ),
                        ),
                      );
                    }}
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
                </box>
                <box
                  flexDirection="row"
                  justifyContent="space-between"
                  paddingTop={1}
                  flexShrink={0}
                >
                  <box flexDirection="row" gap={1} minWidth={0}>
                    <text fg={theme.theme.text} onMouseUp={openProfilePicker}>
                      {compactComposerLabel(
                        profileLabel(quickProfile()),
                        minimalComposerControls() ? 6 : 12,
                      )}{" "}
                      ▼
                    </text>
                    <text fg={theme.theme.muted}>·</text>
                    <text fg={theme.theme.text} onMouseUp={openModelPicker}>
                      {compactModelLabel(
                        quickModel().modelID ??
                          state.facts.modelSelection?.modelID ??
                          statusValues(state.statusSegments).model ??
                          "Model",
                        minimalComposerControls()
                          ? 7
                          : compactComposerControls()
                            ? 12
                            : 24,
                      )}{" "}
                      ▼
                    </text>
                    <text fg={theme.theme.muted}>·</text>
                    <text fg={theme.theme.text} onMouseUp={openReasoningPicker}>
                      {compactComposerLabel(
                        reasoningLabel(quickReasoning()),
                        minimalComposerControls() ? 4 : 10,
                      )}{" "}
                      ▼
                    </text>
                  </box>
                  <box flexDirection="row" gap={1} flexShrink={0}>
                    <text
                      fg={
                        attachmentPaths().length
                          ? theme.theme.text
                          : theme.theme.muted
                      }
                      onMouseUp={openAttachmentManager}
                    >
                      {minimalComposerControls()
                        ? `+${attachmentPaths().length}`
                        : attachmentPaths().length
                          ? `${attachmentPaths().length} files`
                          : "+ Add"}
                    </text>
                    <Show when={!minimalComposerControls()}>
                      <text fg={theme.theme.muted}>
                        {modelActive()
                          ? hasQueuedPrompts()
                            ? `${queuedPromptCount()} queued`
                            : "Working"
                          : hasQueuedPrompts()
                            ? `${queuedPromptCount()} queued`
                            : (statusValues(state.statusSegments).ctx ??
                              "Ready")}
                      </text>
                    </Show>
                    <text
                      fg={
                        modelActive() ? theme.theme.danger : theme.theme.accent
                      }
                      onMouseUp={activateComposerControl}
                    >
                      {modelActive() ? "■ Stop" : "↑ Send"}
                    </text>
                  </box>
                </box>
                <Show when={pastePreview()}>
                  <text
                    paddingTop={1}
                    fg={
                      pastePreview().startsWith("paste rejected")
                        ? theme.theme.danger
                        : theme.theme.muted
                    }
                  >
                    {pastePreview()}
                  </text>
                </Show>
                <PromptAutocomplete
                  input={composer}
                  text={composerText}
                  workspaceFiles={props.backend.workspaceFiles}
                  agents={props.backend.agents}
                  mcpCatalog={props.backend.mcpCatalog}
                  commands={() =>
                    (
                      props.commands ??
                      createUiAdapterCommandHost(props.backend)
                    )
                      .list()
                      .then((commands) => [
                        ...commands,
                        {
                          name: "editor",
                          title: "External editor",
                          description:
                            "Open the composer draft in an external editor",
                          acceptsArguments: true,
                          category: "tui",
                        },
                      ])
                  }
                  workflows={
                    props.workspaceRoot && props.backend.documentCatalog
                      ? async () =>
                          props.backend.documentCatalog!().catch(() => [])
                      : undefined
                  }
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
                    {" · Alt+D removes last, Alt+O manage"}
                  </text>
                </Show>
              </box>
            </box>
            <box
              height={1}
              width="100%"
              border={["left"]}
              borderColor={
                route.route().kind !== "none"
                  ? theme.theme.muted
                  : theme.theme.accent
              }
              customBorderChars={PROMPT_BOTTOM_BORDER}
            />
          </box>
          <SessionFooter
            width={layout().contentWidth}
            workspaceRoot={props.workspaceRoot}
            onWorkspaceSelect={openWorkspaceSwitcher}
          />
        </Show>
      </box>
      <Show
        when={
          layout().viewVisible
            ? viewActive() === "chat"
              ? "chat"
              : layout().paneMode === "triple"
                ? "triple"
                : false
            : false
        }
        keyed
      >
        <box
          position={layout().viewOverlay ? "absolute" : "relative"}
          width={layout().viewWidth}
          flexShrink={0}
          height="100%"
          right={layout().viewOverlay ? 0 : undefined}
          top={layout().viewOverlay ? 0 : undefined}
          bottom={layout().viewOverlay ? 0 : undefined}
          zIndex={layout().viewOverlay ? 20 : undefined}
          flexDirection="column"
          backgroundColor={theme.theme.background}
          border={["left", "right"]}
          borderColor={theme.theme.muted}
        >
          <LiveChatView
            backend={props.backend}
            messages={() => state.chatMessages}
            activity={() => state.facts.chatActivity}
            intelligence={() => state.facts.intelligence}
            focused={() => viewFocus() === "chat"}
            onRequestFocus={() => setViewFocus("chat")}
            onEscape={() => {
              if (layout().viewOverlay) setViewActive(null);
              setViewFocus("main");
            }}
            onInputRef={setChatInput}
            onSend={(text) => {
              const usedExpert = chatUseExpert();
              const activeChatModel = usedExpert
                ? chatExpertModel()
                : chatNormalModel();
              const activeReasoning = usedExpert
                ? chatExpertReasoning()
                : chatNormalReasoning();
              const attachments = chatAttachmentPaths();
              void props.backend
                .chatSubmit?.({
                  text,
                  ...(activeChatModel.modelID
                    ? { model: activeChatModel }
                    : {}),
                  ...(activeReasoning
                    ? { reasoningEffort: activeReasoning }
                    : {}),
                  ...(attachments.length ? { attachments } : {}),
                })
                .then(() => {
                  if (attachments.length) setChatAttachmentPaths([]);
                })
                .then(() => {
                  if (usedExpert) setChatUseExpert(false);
                })
                .catch((error) =>
                  toast.show({
                    variant: "error",
                    message: `Chat message not delivered: ${
                      error instanceof Error ? error.message : String(error)
                    }`.slice(0, 160),
                  }),
                );
            }}
            onStop={() => {
              void props.backend.chatAbort?.();
            }}
            onCopy={copyMessage}
            pendingRollback={() => state.pendingRollback}
            onUndoRollback={undoChatRollback}
            attachments={chatAttachmentPaths}
            onOpenAttachment={openChatAttachmentManager}
            chatModelLabel={() =>
              compactModelLabel(
                chatUseExpert()
                  ? (chatExpertModel().modelID ??
                      quickModel().modelID ??
                      "Expert")
                  : (chatNormalModel().modelID ??
                      quickModel().modelID ??
                      state.facts.modelSelection?.modelID ??
                      "Chat"),
                minimalComposerControls() ? 7 : 12,
              )
            }
            chatExpertModelLabel={() =>
              compactModelLabel(
                chatExpertModel().modelID ?? "Expert",
                minimalComposerControls() ? 7 : 10,
              )
            }
            onOpenChatModel={openChatModelPicker}
            onOpenChatReasoning={openChatReasoningPicker}
            chatUseExpert={chatUseExpert}
            onToggleExpert={() => setChatUseExpert((value) => !value)}
            onChatRollback={(messageID) => {
              if (!props.backend.chatRollback) {
                toast.show({
                  variant: "warning",
                  message: "Chat rollback is unavailable in this runtime",
                });
                return;
              }
              const source = state.chatMessages.find(
                (block) =>
                  block.role === "user" &&
                  (block.id === `chat:${messageID}:user` ||
                    block.id.startsWith(`chat:${messageID}:user:`)),
              );
              void DialogConfirm.show(
                dialog,
                "Rollback Chat",
                "Roll the Chat conversation back to this message? This only affects Chat context; workspace and Main Agent state are not touched.",
              ).then((confirmed) => {
                if (!confirmed) return;
                void props.backend.chatRollback!({
                  toMessageID: messageID,
                }).then(
                  (result) => {
                    toast.show({
                      variant: "success",
                      message: `Chat rolled back (removed ${result.removed} messages)`,
                    });
                    if (source?.text) {
                      chatInput()?.setText?.(source.text);
                      setViewFocus("chat");
                    }
                  },
                  (error) => toast.error(error),
                );
              });
            }}
            approvalRequest={() => {
              const request = activeModal(state.modal);
              if (request?.kind !== "approval") return undefined;
              return isLiveChatPlanApproval(request, state.facts.plans)
                ? request
                : undefined;
            }}
            onPlanRollback={(mailboxMessageID) => {
              if (!props.backend.checkpointList) {
                toast.show({
                  variant: "warning",
                  message:
                    "Checkpoint management is unavailable in this runtime",
                });
                return;
              }
              dialog.push(() => (
                <DialogCheckpoint
                  backend={props.backend}
                  stepID={`mailbox:${mailboxMessageID}`}
                />
              ));
            }}
            onPlanAccept={(planID) => {
              void props.backend.planAccept?.(planID).catch((error) =>
                toast.show({
                  variant: "error",
                  message: `Plan not accepted: ${
                    error instanceof Error ? error.message : String(error)
                  }`.slice(0, 160),
                }),
              );
            }}
            onPlanReject={(planID) => {
              void props.backend.planSupersede?.(
                planID,
                "rejected in live work chat",
              );
            }}
            selectedTaskID={() => state.facts.selectedTaskID}
            promptMaxHeight={Math.min(
              preferences().prompt.maxHeight,
              layout().promptMaxHeight,
            )}
            contentWidth={Math.max(1, layout().viewWidth - 4)}
            density={preferences().density}
            toolDetails={preferences().toolDetails}
            reasoning={preferences().reasoning}
            diffStyle={preferences().diffStyle}
            toolPreviewLines={layout().toolPreviewLines}
          />
        </box>
      </Show>
      <Show
        when={
          layout().viewVisible &&
          viewActive() === "plan" &&
          layout().paneMode !== "triple"
        }
      >
        <SessionSidebar
          workspaceRoot={props.workspaceRoot}
          width={layout().viewWidth}
          compact
          overlay={layout().viewOverlay}
        />
      </Show>
      <Show when={layout().sidebarGap > 0}>
        <box
          width={layout().sidebarGap}
          flexShrink={0}
          height="100%"
          backgroundColor={theme.theme.background}
        />
      </Show>
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

function profileLabel(profile: string) {
  if (profile === "ask") return "Ask";
  if (profile === "auto") return "Auto";
  if (profile === "read_only") return "Read-only";
  return profile || "Profile";
}

function reasoningLabel(reasoning: ReasoningEffort | undefined) {
  if (!reasoning) return "Default";
  if (reasoning === "xhigh") return "XHigh";
  return reasoning[0]!.toUpperCase() + reasoning.slice(1);
}

function compactComposerLabel(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, Math.max(1, maxLength - 3))}...`
    : value;
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
