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
import type {
  RuntimeClient,
  RuntimeEvent,
  RuntimeModelSelection,
} from "@natalia/contracts";
import type {
  WorkerRuntimeClient,
  WorkflowExecutionHandle,
} from "@natalia/client";
import type { ConfigV3 } from "@natalia/contracts";
import { getPluginCommands } from "@natalia/plugin";
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
  DialogHelp,
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
import { statusValues } from "../routes/session/tool-utils";
import { markdownSyntax } from "../routes/session/tool-views";
import { DialogModel } from "../component/DialogModel";
import { DialogSkill } from "../component/DialogSkill";
import { DialogStash } from "../component/DialogStash";
import { DialogAttachment } from "../component/DialogAttachment";
import { DialogWorkspaceSearch } from "../component/DialogWorkspaceSearch";
import { DialogTerminal } from "../component/DialogTerminal";
import { DialogCheckpoint } from "../component/DialogCheckpoint";
import { DialogSandbox } from "../component/DialogSandbox";
import { LiveChatView } from "../component/LiveChatView";
import {
  PromptAutocomplete,
  workflowRunUnavailableReason,
  workflowRunRequest,
} from "../component/PromptAutocomplete";
import { runWorkflowProcess } from "../component/DialogScheduledTasks";
import {
  editPromptExternally,
  retainEditorMentions,
} from "../prompt/external-editor";
import { DialogAgent } from "../component/DialogAgent";
import { CommandPalette } from "../component/CommandPalette";
import {
  resolveConfig,
  configPatch,
  type ConfigPatch,
  type ConfigWriteScope,
} from "@natalia/config";
import { statSync } from "node:fs";
import { relative as relativePath, resolve } from "node:path";
import { decidePaste } from "../prompt/paste";
import { PromptHistory, shouldUseHistory } from "../prompt/history";
import {
  SessionFooter,
  SessionRoute,
  SessionSidebar,
  SubagentRoute,
} from "../routes/session/SessionRoute";
import { darkTheme } from "../theme/theme";
import { ThemeProvider, useTheme } from "../context/theme";
import { LocalProvider, useLocal } from "../context/local";
import { sessionLayout, type SidebarMode } from "../session-layout";
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

export function App(props: {
  backend: TuiRuntimeClient;
  createBackend?: (sessionID?: string) => TuiRuntimeClient;
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
      const next = props.createBackend(sessionID);
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
        const source = (
          await resolveConfig({
            workspaceRoot: workspaceRoot() ?? process.cwd(),
          })
        ).config;
        const userPatch: Record<string, unknown> = {};
        if (source.team) userPatch.team = source.team;
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
      const next = props.createBackend();
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
  const [viewActive, setViewActive] = createSignal<"chat" | null>(null);
  const [viewFocus, setViewFocus] = createSignal<"main" | "chat">("main");
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
  const interactivePromptActive = () =>
    state.dialog === "approval" || state.dialog === "question";
  // The pane owns the keyboard: chat hands focus to the view's input, main (or
  // a closed view) hands it back to the composer. LiveChatView itself focuses
  // its input when focused(), so this only blurs the side leaving focus.
  createEffect(() => {
    const pane = viewFocus();
    const open = viewActive() !== null;
    if (interactivePromptActive() || (open && pane === "chat")) {
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
  const terminalScrollRef: { current?: any } = {};
  const [modelSubmissions, setModelSubmissions] = createSignal(0);
  const [workflowRunning, setWorkflowRunning] = createSignal(false);
  const [quickModel, setQuickModel] = createSignal<RuntimeModelSelection>({});
  const [quickReasoning, setQuickReasoning] = createSignal<ReasoningEffort>();
  const [quickProfile, setQuickProfile] = createSignal("ask");
  let composerControlTimer: ReturnType<typeof setTimeout> | undefined;
  let ignoreStopUntil = 0;
  let activeWorkflow: WorkflowExecutionHandle<unknown> | undefined;
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

  async function submit() {
    const input = composer();
    const text = (input?.plainText ?? "").replace(/\n$/, "");
    if (!text.trim()) return;
    const control = text.trim();
    // While an approval or question is pending, Enter is owned by the inline
    // prompt card; this guard exists for the other submit paths so a turn can
    // never be launched past a decision the runtime is waiting on.
    if (state.dialog === "approval" || state.dialog === "question") {
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
    const workflowRun = workflowRunRequest(control);
    if (workflowRun) {
      if (busy()) {
        toast.show({
          variant: "warning",
          message: "Stop the current work before starting a workflow",
        });
        return;
      }
      if (!props.workspaceRoot) {
        toast.show({
          variant: "warning",
          message: "Task and flow runs require a workspace root",
        });
        return;
      }
      const unavailable = workflowRunUnavailableReason(
        workflowRun.kind,
        workflowRun.path,
        Boolean(props.backend.runWorkflowTask),
      );
      if (unavailable) {
        toast.show({
          variant: "warning",
          message: unavailable,
        });
        return;
      }
      setWorkflowRunning(true);
      input?.clear();
      history.add(text);
      try {
        toast.show({
          variant: "info",
          message: `Starting ${workflowRun.kind} ${workflowRun.path}`,
        });
        dispatch({
          type: "status.update",
          status: "running",
          detail: `${workflowRun.kind === "flow" ? "Flow" : "Task"}: ${workflowRun.path}`,
        });
        const outcome = workflowRun.path.startsWith("cap:")
          ? await runCapabilityWorkflowTask({
              backend: props.backend,
              path: workflowRun.path,
              workspaceRoot: props.workspaceRoot,
              sessionID: state.facts.sessionID,
              setActive: (handle) => (activeWorkflow = handle),
              onEvent: dispatchWorkflowEvent,
            })
          : await runWorkflowProcess({
              kind: workflowRun.kind,
              path: workflowRun.path,
              workspaceRoot: props.workspaceRoot,
              onEvent: dispatchWorkflowEvent,
            });
        dispatch({
          type: "status.update",
          status: outcome.ok ? "ready" : "failed",
          detail: outcome.message,
        });
        dispatch({
          type: "flow.finished",
          outcome: outcome.ok
            ? "succeeded"
            : outcome.status === "skipped_due_to_overlap"
              ? "skipped"
              : "failed",
          reason: outcome.message,
        });
        toast.show({
          variant: outcome.ok ? "success" : "warning",
          message: outcome.message,
        });
      } finally {
        activeWorkflow = undefined;
        setWorkflowRunning(false);
        setTimeout(() => composer()?.focus(), 1);
      }
      return;
    }
    if (control === "/task" || control === "/flow") {
      toast.show({
        variant: "warning",
        message: `Select an existing ${control.slice(1)} from autocomplete`,
      });
      return;
    }
    if (workflowRunning()) {
      toast.show({
        variant: "warning",
        message: "Wait for the current workflow to finish before sending",
      });
      return;
    }
    const attachments = attachmentPaths();
    const agents = mentionAgents();
    const resources = mentionResources();
    const previousSubmissionID = state.facts.lastSubmission?.id;
    const queued = modelBusy();
    if (
      (attachments.length || agents.length || resources.length || queued) &&
      !props.backend.submitInput
    ) {
      toast.show({
        variant: "warning",
        message: queued
          ? "This runtime transport does not support queued prompts"
          : "This runtime transport does not support attachments",
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
      if (attachments.length || agents.length || resources.length || queued)
        await props.backend.submitInput!({
          text,
          delivery: queued ? "queue" : "steer",
          attachments,
          agents: agents.map((name) => ({ name })),
          resources: resources.map((resource) => ({
            server: resource.server,
            uri: resource.uri,
            name: resource.name,
            mimeType: resource.mimeType,
          })),
        });
      else await props.backend.submit(text);
      if (queued)
        toast.show({
          variant: "info",
          message: "Message queued for the next turn",
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
    if (workflowRunning()) {
      activeWorkflow?.cancel("TUI workflow cancellation");
      return;
    }
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
    return Boolean(modelBusy() || workflowRunning());
  }

  function modelBusy() {
    return Boolean(
      state.facts.activeTurn || modelSubmissions() > 0 || hasQueuedPrompts(),
    );
  }

  function modelActive() {
    return Boolean(state.facts.activeTurn || hasQueuedPrompts());
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
    if (modelSubmissions() > 0) return;
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

  function dispatchWorkflowEvent(event: Record<string, unknown>) {
    if (
      event.type !== "task.invocation" &&
      event.type !== "task.alert" &&
      event.type !== "task.alert_delivery" &&
      event.type !== "task.state"
    )
      dispatch(event as RuntimeEvent);
  }

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
        close: () => {
          setViewActive(null);
          setViewFocus("main");
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
    const sessions = Object.values(state.facts.terminals).filter(
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
    >
      <Show when={layout().viewVisible}>
        <box
          position="relative"
          width={layout().viewWidth}
          flexShrink={0}
          height="100%"
          flexDirection="column"
          backgroundColor={theme.theme.background}
          border={["right"]}
          borderColor={theme.theme.muted}
        >
          <LiveChatView
            backend={props.backend}
            messages={() => state.chatMessages}
            activity={() => state.facts.chatActivity}
            focused={() => viewFocus() === "chat"}
            onRequestFocus={() => setViewFocus("chat")}
            onEscape={() => {
              if (layout().viewOverlay) setViewActive(null);
              setViewFocus("main");
            }}
            onClose={() => {
              setViewActive(null);
              setViewFocus("main");
            }}
            onInputRef={setChatInput}
            onSend={(text) => {
              void props.backend.chatSubmit?.({ text }).catch((error) =>
                toast.show({
                  variant: "error",
                  message: `Chat message not delivered: ${
                    error instanceof Error ? error.message : String(error)
                  }`.slice(0, 160),
                }),
              );
            }}
            onRollback={(toMessageID) => {
              void props.backend.chatRollback?.({ toMessageID });
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
      <box flexGrow={1} minWidth={0} height="100%" flexDirection="column">
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
            terminalScrollRef={terminalScrollRef}
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
            backend={props.backend}
            onExit={exitOrCancel}
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
                            ? "Type the next message and press Enter to queue..."
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
                      {compactComposerLabel(
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
                          : (statusValues(state.statusSegments).ctx ?? "Ready")}
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
                    {" · Alt+X removes last, Alt+O manage"}
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
            workspaceRoot={props.workspaceRoot}
            onWorkspaceSelect={openWorkspaceSwitcher}
          />
        </Show>
      </box>
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

type TuiRuntimeClient = RuntimeClient &
  Partial<Pick<WorkerRuntimeClient, "runWorkflowTask">>;

export async function runCapabilityWorkflowTask(input: {
  backend: TuiRuntimeClient;
  path: string;
  workspaceRoot: string;
  sessionID?: string;
  setActive(handle: WorkflowExecutionHandle<unknown>): void;
  onEvent(event: Record<string, unknown>): void;
}) {
  if (!input.backend.runWorkflowTask)
    throw new Error("Capability task execution is not available");
  const handle = input.backend.runWorkflowTask({
    workspaceRoot: input.workspaceRoot,
    path: input.path,
    requestedBy: { sessionID: input.sessionID },
  });
  input.setActive(handle);
  const consume = (async () => {
    for await (const event of handle.events) {
      if (event.type !== "workflow.execution.output") continue;
      try {
        const parsed = JSON.parse(event.line) as Record<string, unknown>;
        if (typeof parsed.type === "string") input.onEvent(parsed);
      } catch {
        // The worker runs JSON mode; a plain diagnostic line remains a status only.
      }
    }
  })();
  const result = await handle.result;
  await consume;
  const ok = result.status === "succeeded" || result.status === "stalled";
  return {
    ok,
    status: result.status,
    message: `task ${input.path}: ${result.status}`,
  };
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
