import {
  type KeyEvent,
  TextareaRenderable,
  TextAttributes,
  type PasteEvent,
} from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import {
  useBindings,
  useKeymap,
  useKeymapSelector,
} from "@opentui/keymap/solid";
import { stringifyKeySequence } from "@opentui/keymap";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { PromptRefProvider, usePromptRef } from "../context/prompt";
import { RuntimeProvider } from "../context/runtime";
import { RouteProvider, useRouteController } from "../context/route";
import { StateProvider, useAppState } from "../context/state";
import { ClipboardProvider, useClipboard } from "../context/clipboard";
import { ToastProvider, ToastRegion, useToast } from "../context/toast";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import {
  buildKeybindMap,
  commands,
  composerKeyAction,
  keymapBoundary,
} from "../keymap";
import { useDialog } from "../dialog/provider";
import { DialogConfirm } from "../dialog/DialogConfirm";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { DialogSelect } from "../dialog/DialogSelect";
import {
  DialogHelp,
  DialogSessionList,
  DialogStatus,
} from "../dialog/DialogLayer";
import { SettingsDialog } from "../dialog/SettingsDialog";
import { useModeStack } from "../modal/mode-stack";
import { decidePaste } from "../prompt/paste";
import { PromptHistory, shouldUseHistory } from "../prompt/history";
import {
  SessionFooter,
  SessionRoute,
  SessionSidebar,
  SubagentRoute,
} from "../routes/session/SessionRoute";
import { darkTheme } from "../theme/theme";
import { sessionLayout, type SidebarMode } from "../session-layout";
import { ThemeService } from "../theme/service";
import {
  defaultTuiPreferences,
  loadTuiPreferences,
  saveTuiPreferences,
  tuiPreferencePatch,
  type TuiPreferences,
} from "../settings";
import type { TuiConfigWriteScope } from "../config";

export function App(props: {
  backend: RuntimeClient;
  createBackend?: (sessionID?: string) => RuntimeClient;
  workspaceRoot?: string;
  onSessionChange?: (sessionID?: string) => void;
  onDispatch?: (event: RuntimeEvent) => void;
  initialPrompt?: string;
}) {
  const [backend, setBackend] = createSignal(props.backend);

  function changeSession(sessionID?: string) {
    if (props.createBackend) setBackend(props.createBackend(sessionID));
    props.onSessionChange?.(sessionID);
  }

  return (
    <ClipboardProvider>
      <ToastProvider>
        <RuntimeProvider>
          <PromptRefProvider>
            <RouteProvider>
              <Show when={backend()} keyed>
                {(activeBackend) => (
                  <StateProvider
                    onReady={(dispatch) => {
                      activeBackend.start((event: RuntimeEvent) => {
                        dispatch(event);
                        props.onDispatch?.(event);
                      });
                    }}
                  >
                    <Shell
                      backend={activeBackend}
                      workspaceRoot={props.workspaceRoot}
                      onSessionChange={changeSession}
                    />
                  </StateProvider>
                )}
              </Show>
            </RouteProvider>
          </PromptRefProvider>
        </RuntimeProvider>
      </ToastProvider>
    </ClipboardProvider>
  );
}

function Shell(props: {
  backend: RuntimeClient;
  workspaceRoot?: string;
  onSessionChange?: (sessionID?: string) => void;
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
  const modeStack = useModeStack();
  const [composer, setComposer] = createSignal<TextareaRenderable>();
  const [pastePreview, setPastePreview] = createSignal("");
  const [followBottom, setFollowBottom] = createSignal(true);
  const [jumpToBottomVisible, setJumpToBottomVisible] = createSignal(false);
  const [preferences, setPreferences] = createSignal<TuiPreferences>(
    defaultTuiPreferences,
  );
  const [activeTheme, setActiveTheme] = createSignal(darkTheme);
  const [tuiWriteScope, setTuiWriteScope] =
    createSignal<TuiConfigWriteScope>("project");
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
    const resize = (width: number, height: number) => {
      setTerminalWidth(width);
      setTerminalHeight(height);
    };
    renderer.on("resize", resize);
    onCleanup(() => renderer.off("resize", resize));
  });
  const history = new PromptHistory();
  const scrollRef: { current?: any } = {};
  const ptyScrollRef: { current?: any } = {};
  let submitting = false;

  onMount(async () => {
    if (props.workspaceRoot) {
      const loaded = await loadTuiPreferences(props.workspaceRoot);
      setPreferences(loaded);
      setFollowBottom(loaded.followBottom);
      const available = await new ThemeService(
        props.workspaceRoot,
      ).getAllThemes();
      setActiveTheme(
        available.find((theme) => theme.name === loaded.theme) ?? darkTheme,
      );
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
        if (!followBottom()) {
          setFollowBottom(true);
          scrollbox.stickyScroll = true;
        }
        return;
      }
      setJumpToBottomVisible(true);
      if (followBottom()) {
        setFollowBottom(false);
        scrollbox.stickyScroll = false;
      }
    }, 100);
    onCleanup(() => clearInterval(timer));
  });

  function updatePreferences(next: TuiPreferences, scope = tuiWriteScope()) {
    const patch = tuiPreferencePatch(preferences(), next);
    setPreferences(next);
    setFollowBottom(next.followBottom);
    void new ThemeService(props.workspaceRoot)
      .getAllThemes()
      .then((available) =>
        setActiveTheme(
          available.find((theme) => theme.name === next.theme) ?? darkTheme,
        ),
      );
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

  async function submit() {
    const input = composer();
    const text = (input?.plainText ?? "").replace(/\n$/, "");
    if (!text.trim()) return;
    const control = text.trim();
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
    submitting = true;
    const shouldFollow = isNearBottom(scrollRef.current);
    setFollowMode(shouldFollow);
    if (shouldFollow) toBottom(0);
    try {
      input?.clear();
      setPastePreview("");
      history.add(text);
      await props.backend.submit(text);
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

  function runCommand(command: string) {
    if (command === "palette.toggle") {
      dialog.replace(() => <CommandPalette />);
      return;
    }
    if (command === "session.new") {
      changeSession(
        `ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}`,
      );
      return;
    }
    if (command === "session.list") {
      dialog.replace(() => (
        <DialogSessionList
          workspaceRoot={props.workspaceRoot}
          onSelect={changeSession}
        />
      ));
      return;
    }
    if (command === "settings.open") {
      dialog.replace(() => (
        <SettingsDialog
          workspaceRoot={props.workspaceRoot}
          tuiConfig={preferences()}
          tuiWriteScope={tuiWriteScope()}
          onTuiConfigScopeChange={setTuiWriteScope}
          onTuiConfigChange={updatePreferences}
        />
      ));
      return;
    }
    if (command === "status") {
      dialog.replace(() => <DialogStatus />);
      return;
    }
    if (command === "help.open") {
      dialog.replace(() => (
        <DialogHelp
          keybindOverrides={preferences().keybinds}
          onClose={() => dialog.clear()}
        />
      ));
      return;
    }
    if (command === "dialog.test") {
      try {
        void (async () => {
          const confirmed = await DialogConfirm.show(
            dialog,
            "Dialog Stack Test",
            "Press left/right to switch focus, Enter to confirm, Escape to cancel.",
          );
          if (confirmed === undefined) return;
          const name = await DialogPrompt.show(dialog, "Enter name", {
            placeholder: "Type something...",
          });
          if (name === null) return;
          toast.show({
            variant: "success",
            message: `Dialog test done: confirmed=${confirmed}, name="${name}"`,
          });
        })();
      } catch (error) {
        toast.show({
          variant: "error",
          message: `dialog.test failed: ${error}`,
        });
      }
      return;
    }
    if (command === "session.sidebar.toggle") {
      if (layout().wide) {
        setSidebarMode((value) => (value === "auto" ? "hide" : "auto"));
      } else {
        setSidebarOpen((value) => !value);
      }
      return;
    }
    if (command === "snapshot") {
      props.backend.snapshot();
      return;
    }
    if (command === "message.copy.last") {
      const block = [...state.messages]
        .reverse()
        .find((item) => ["assistant", "tool", "subagent"].includes(item.role));
      const text = block?.tool?.result?.detail || block?.text;
      if (!text || !clipboard.write) {
        toast.show({
          variant: "warning",
          message: "No message available to copy",
        });
        return;
      }
      void clipboard.write(text).then(
        () =>
          toast.show({ variant: "success", message: "Copied to clipboard" }),
        (error) => toast.error(error),
      );
      return;
    }
    if (command === "composer.submit") {
      void submit();
      return;
    }
    if (command === "composer.newline") {
      composer()?.insertText("\n");
      return;
    }
    if (command === "composer.buffer-home") {
      composer()?.gotoBufferHome();
      return;
    }
    if (command === "composer.buffer-end") {
      composer()?.gotoBufferEnd();
      return;
    }
    if (command === "cancel") {
      props.backend.cancel();
      return;
    }
    if (command === "exit") {
      if (!composer()?.plainText) renderer.destroy();
      return;
    }
    if (command === "dialog.close") {
      route.back();
      return;
    }
    if (command === "pty.focus-toggle") {
      if (state.ptyPane.selectedID)
        dispatch({
          type: "pty.pane.focus",
          focus: state.ptyPane.focus === "chat" ? "pty" : "chat",
        });
      return;
    }
  }

  useBindings(() => ({
    commands: [
      ...Object.values(commands).map((command) => ({
        name: command.id,
        title: command.desc,
        category: command.id.split(".")[0],
        namespace: "palette",
        run: () => runCommand(command.id),
      })),
    ],
  }));

  useBindings(() => ({
    mode: "base",
    bindings: Object.entries(buildKeybindMap(preferences().keybinds).map).map(
      ([id, key]) => ({
        key,
        desc: commands[id]!.desc,
        group: "Natalia",
        cmd: () => runCommand(id),
      }),
    ),
  }));

  useBindings(() => ({
    mode: "base",
    priority: 1,
    enabled: () => state.ptyPane.focus === "pty",
    bindings: [
      {
        key: "ctrl+t",
        desc: "Return focus to chat",
        group: "PTY",
        cmd: () =>
          dispatch({
            type: "pty.pane.focus",
            focus: "chat",
          }),
      },
      {
        key: "pageup",
        desc: "Scroll PTY up",
        group: "PTY",
        cmd: () =>
          ptyScrollRef.current?.scrollBy(
            -(ptyScrollRef.current.viewport?.height ?? 8) * 0.8,
          ),
      },
      {
        key: "pagedown",
        desc: "Scroll PTY down",
        group: "PTY",
        cmd: () =>
          ptyScrollRef.current?.scrollBy(
            (ptyScrollRef.current.viewport?.height ?? 8) * 0.8,
          ),
      },
      {
        key: "home",
        desc: "Scroll PTY to start",
        group: "PTY",
        cmd: () => ptyScrollRef.current?.scrollTo(0),
      },
      {
        key: "end",
        desc: "Scroll PTY to end",
        group: "PTY",
        cmd: () =>
          ptyScrollRef.current?.scrollTo(
            ptyScrollRef.current.scrollHeight ?? 0,
          ),
      },
      {
        key: "left",
        desc: "Previous PTY session",
        group: "PTY",
        cmd: () => movePtySelection(-1),
      },
      {
        key: "right",
        desc: "Next PTY session",
        group: "PTY",
        cmd: () => movePtySelection(1),
      },
      {
        key: "tab",
        desc: "Next PTY session",
        group: "PTY",
        cmd: () => movePtySelection(1),
      },
      {
        key: "shift+tab",
        desc: "Previous PTY session",
        group: "PTY",
        cmd: () => movePtySelection(-1),
      },
    ],
  }));

  createEffect(() => {
    if (route.route().kind === "none") return;
    const popMode = modeStack.push("modal");
    onCleanup(popMode);
  });

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
    if (route.route().kind === "none" && state.ptyPane.focus === "chat") {
      setTimeout(() => composer()?.focus(), 1);
    }
  });

  function toBottom(delay = 50) {
    setTimeout(() => scrollToBottom(scrollRef.current), delay);
  }

  function movePtySelection(direction: -1 | 1) {
    const sessions = Object.values(state.pty).filter(
      (pty) =>
        pty.ownership === "model" &&
        pty.status !== "exited" &&
        pty.status !== "failed",
    );
    if (sessions.length < 2) return;
    const current = sessions.findIndex(
      (pty) => pty.id === state.ptyPane.selectedID,
    );
    const next =
      sessions[(current + direction + sessions.length) % sessions.length];
    if (next) dispatch({ type: "pty.pane.select", id: next.id });
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
      backgroundColor={activeTheme().background}
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
            ptyScrollRef={ptyScrollRef}
            followBottom={followBottom()}
            density={preferences().density}
            toolDetails={preferences().toolDetails}
            diffStyle={preferences().diffStyle}
            terminalWidth={layout().toolContentWidth}
            toolPreviewLines={layout().toolPreviewLines}
            showJumpToBottom={jumpToBottomVisible()}
            onJumpToBottom={jumpToBottom}
            backend={props.backend}
            onExit={exitOrCancel}
          />
          <box
            flexShrink={0}
            border={["top"]}
            borderColor={
              route.route().kind !== "none" ? darkTheme.muted : darkTheme.accent
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
              placeholderColor={darkTheme.muted}
              textColor={
                route.route().kind !== "none" ? darkTheme.muted : darkTheme.text
              }
              focusedTextColor={darkTheme.text}
              cursorColor={darkTheme.accent}
              onPaste={handlePaste}
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
                if ((key === "up" || key === "down") && composer()?.plainText) {
                  if (restoreHistory(key === "up" ? -1 : 1)) {
                    event.preventDefault();
                    return;
                  }
                }
              }}
            />
            <Show when={layout().showComposerHints}>
              <text
                fg={
                  pastePreview().startsWith("paste rejected")
                    ? darkTheme.danger
                    : darkTheme.muted
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

function CommandPalette() {
  const dialog = useDialog();
  const keymap = useKeymap();
  const entries = useKeymapSelector((current) => {
    const commands = current.getCommandEntries({
      namespace: "palette",
      visibility: "reachable",
      filter: (command) => command.name !== "palette.toggle",
    });
    const bindings = current.getCommandBindings({
      commands: commands.map((entry) => entry.command.name),
      visibility: "registered",
    });
    return commands.map((entry) => ({
      entry,
      bindings: bindings.get(entry.command.name) ?? entry.bindings,
    }));
  });

  return (
    <DialogSelect
      title="Commands"
      options={entries().map(({ entry, bindings }) => ({
        title:
          typeof entry.command.title === "string"
            ? entry.command.title
            : entry.command.name,
        description:
          typeof entry.command.desc === "string"
            ? entry.command.desc
            : undefined,
        value: entry.command.name,
        category:
          typeof entry.command.category === "string"
            ? entry.command.category
            : undefined,
        footer: bindings
          .map((binding) =>
            stringifyKeySequence(binding.sequence, { preferDisplay: true }),
          )
          .join(" / "),
      }))}
      onSelect={(option) => {
        dialog.clear();
        keymap.dispatchCommand(option.value);
      }}
    />
  );
}

function normalizeKey(key: string | undefined) {
  if (key === "enter") return "return";
  return key;
}
