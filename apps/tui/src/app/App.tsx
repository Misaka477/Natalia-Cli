import {
  type KeyEvent,
  TextareaRenderable,
  TextAttributes,
  type PasteEvent,
} from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/solid";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { PromptRefProvider, usePromptRef } from "../context/prompt";
import { RuntimeProvider } from "../context/runtime";
import { RouteProvider, useRouteController } from "../context/route";
import { StateProvider, useAppState } from "../context/state";
import { ClipboardProvider, useClipboard } from "../context/clipboard";
import { ToastProvider, ToastRegion, useToast } from "../context/toast";
import { DialogLayer } from "../dialog/DialogLayer";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import {
  buildKeybindMap,
  composerKeyAction,
  keybindForEvent,
  keymapBoundary,
  type UserKeybindOverrides,
} from "../keymap";
import { dispatchModalKey } from "../modal/key-handler";
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
      if (route.route().kind === "palette") route.back();
      else route.push({ kind: "palette" });
      return;
    }
    if (command === "session.new") {
      changeSession(
        `ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}`,
      );
      return;
    }
    if (command === "session.list") {
      route.push({ kind: "sessions" });
      return;
    }
    if (command === "settings.open") {
      route.push({ kind: "settings" });
      return;
    }
    if (command === "status") {
      route.push({ kind: "status" });
      return;
    }
    if (command === "help.open") {
      route.push({ kind: "help" });
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

  useKeyboard((event) => {
    const key = normalizeKey(event.name);
    if (event.ctrl && key === "c") {
      event.preventDefault();
      event.stopPropagation();
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
      return;
    }
    if (key === "escape" && !state.dialog && route.route().kind !== "none") {
      event.preventDefault();
      event.stopPropagation();
      route.back();
      return;
    }
    const formattedKey = keybindForEvent(event);
    const command = Object.entries(
      buildKeybindMap(preferences().keybinds).map,
    ).find(([, keys]) => keys === formattedKey)?.[0];
    if (command) {
      event.preventDefault();
      event.stopPropagation();
      runCommand(command);
      return;
    }
    if (event.ctrl && key === "t" && state.ptyPane.selectedID) {
      event.preventDefault();
      event.stopPropagation();
      dispatch({
        type: "pty.pane.focus",
        focus: state.ptyPane.focus === "chat" ? "pty" : "chat",
      });
      return;
    }
    if (state.ptyPane.focus === "pty") {
      event.preventDefault();
      event.stopPropagation();
      const ptyScrollbox = ptyScrollRef.current;
      if (
        ptyScrollbox &&
        ["pageup", "pagedown", "home", "end"].includes(key ?? "")
      ) {
        if (key === "pageup")
          ptyScrollbox.scrollBy(-(ptyScrollbox.viewport?.height ?? 8) * 0.8);
        if (key === "pagedown")
          ptyScrollbox.scrollBy((ptyScrollbox.viewport?.height ?? 8) * 0.8);
        if (key === "home") ptyScrollbox.scrollTo(0);
        if (key === "end")
          ptyScrollbox.scrollTo(ptyScrollbox.scrollHeight ?? 0);
        return;
      }
      const sessions = Object.values(state.pty).filter(
        (pty) =>
          pty.ownership === "model" &&
          pty.status !== "exited" &&
          pty.status !== "failed",
      );
      if (
        sessions.length > 1 &&
        (key === "tab" || key === "left" || key === "right")
      ) {
        const current = sessions.findIndex(
          (pty) => pty.id === state.ptyPane.selectedID,
        );
        const direction =
          key === "left" || (key === "tab" && event.shift) ? -1 : 1;
        const next =
          sessions[(current + direction + sessions.length) % sessions.length];
        if (next) dispatch({ type: "pty.pane.select", id: next.id });
      }
      return;
    }
    if (route.route().kind !== "none") {
      event.preventDefault();
      event.stopPropagation();
      const handled = dispatchModalKey(key ?? "");
      if (!handled && key === "escape") route.back();
      if (!handled && event.ctrl && key === "d") exitOrCancel();
      return;
    }
    if (event.ctrl && key === "d") {
      event.preventDefault();
      event.stopPropagation();
      if (!composer()?.plainText) renderer.destroy();
      return;
    }
    const scrollbox = scrollRef.current;
    if (!scrollbox) return;
    if (key === "pageup") {
      event.preventDefault();
      event.stopPropagation();
      setFollowMode(false);
      scrollbox.scrollBy(-(scrollbox.viewport?.height ?? 10) * 0.8);
      return;
    }
    if (key === "pagedown") {
      event.preventDefault();
      event.stopPropagation();
      scrollbox.scrollBy((scrollbox.viewport?.height ?? 10) * 0.8);
      return;
    }
    if (key === "home") {
      event.preventDefault();
      event.stopPropagation();
      setFollowMode(false);
      scrollbox.scrollTo(0);
      return;
    }
    if (key === "end") {
      event.preventDefault();
      event.stopPropagation();
      setFollowMode(true);
      toBottom(0);
    }
  });

  createEffect(() => {
    if (route.route().kind === "none" && state.ptyPane.focus === "chat") {
      setTimeout(() => composer()?.focus(), 1);
    }
  });

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
            <Show
              when={state.dialog === "approval" || state.dialog === "question"}
            >
              <box
                flexDirection="row"
                justifyContent="space-between"
                paddingBottom={1}
              >
                <text fg={darkTheme.warning}>
                  {state.dialog === "approval"
                    ? "Action requires your approval"
                    : "Natalia needs your answer"}
                </text>
                <text fg={darkTheme.muted}>Respond in the active dialog</text>
              </box>
            </Show>
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
      <DialogLayer
        backend={props.backend}
        onExit={exitOrCancel}
        workspaceRoot={props.workspaceRoot}
        onSessionChange={changeSession}
        onCommand={runCommand}
        tuiConfig={preferences()}
        keybindOverrides={preferences().keybinds}
        tuiWriteScope={tuiWriteScope()}
        onTuiConfigScopeChange={setTuiWriteScope}
        onTuiConfigChange={updatePreferences}
      />
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
