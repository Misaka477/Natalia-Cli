import { createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  onResize,
  useKeyboard,
  usePaste,
  useTerminalDimensions,
} from "@opentui/solid";
import { randomUUID } from "node:crypto";
import type {
  RuntimeClient,
  RuntimePTYSession,
  TerminalScrollbackPage,
} from "@natalia/contracts";
import { applyTerminalScreenUpdate } from "@natalia/terminal";
import { darkTheme } from "../theme/theme";
import { TerminalScreen } from "../component/TerminalScreen";

export function TerminalWorkspace(props: {
  backend: RuntimeClient;
  id: string;
  onBack(): void;
}) {
  const viewerID = `embedded_${randomUUID()}`;
  const dimensions = useTerminalDimensions();
  const [session, setSession] = createSignal<RuntimePTYSession>();
  const [control, setControl] = createSignal(false);
  const [secureInput, setSecureInput] = createSignal(false);
  const [scrollOffset, setScrollOffset] = createSignal(0);
  const [scrollback, setScrollback] = createSignal<TerminalScrollbackPage>();
  const [error, setError] = createSignal<string>();
  const controller = new AbortController();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let mounted = true;
  let registered = false;
  let resolveRegistered!: () => void;
  let rejectRegistered!: (cause: unknown) => void;
  const registration = new Promise<void>((resolve, reject) => {
    resolveRegistered = resolve;
    rejectRegistered = reject;
  });
  void registration.catch(() => undefined);
  let writes = Promise.resolve();
  let queuedInput = "";
  let flushQueuedInput = false;

  const reportError = (cause: unknown) => {
    if (mounted)
      setError(cause instanceof Error ? cause.message : String(cause));
  };
  const queueWrite = (data: string) => {
    if (!props.backend.terminalViewerWrite) return;
    queuedInput += data;
    if (flushQueuedInput) return;
    flushQueuedInput = true;
    queueMicrotask(() => {
      const input = queuedInput;
      queuedInput = "";
      flushQueuedInput = false;
      if (!input) return;
      enqueueWrite(input);
    });
  };
  const enqueueWrite = (data: string) => {
    writes = writes
      .then(async () => {
        await registration;
        if (!mounted || !control()) return;
        await props.backend.terminalViewerWrite!({
          id: props.id,
          viewerID,
          data,
          sensitive: secureInput(),
        });
      })
      .catch(reportError);
  };

  const update = async () => {
    if (!props.backend.ptyRead) return;
    setSession(await props.backend.ptyRead({ id: props.id, maxChars: 1 }));
  };
  const viewer = async (
    action:
      | "takeover"
      | "take_geometry"
      | "release_input"
      | "release"
      | "unregister",
  ) => {
    if (!props.backend.terminalViewerControl) return;
    await registration;
    if (!mounted && action !== "unregister") return;
    setSession(
      await props.backend.terminalViewerControl({
        id: props.id,
        viewerID,
        action,
      }),
    );
    if (action === "takeover") setControl(true);
    if (action === "release" || action === "release_input") setControl(false);
  };
  const resize = () => {
    const geometryOwner = session()?.geometryOwner;
    if (
      geometryOwner?.type !== "viewer" ||
      geometryOwner.viewerID !== viewerID ||
      !props.backend.terminalViewerResize
    )
      return;
    void props.backend
      .terminalViewerResize({
        id: props.id,
        viewerID,
        rows: Math.max(10, dimensions().height - 2),
        cols: Math.max(20, dimensions().width),
      })
      .then(setSession, (cause) => setError(String(cause)));
  };
  const loadScrollback = async (offset: number) => {
    if (!props.backend.terminalScrollback) return;
    const next = Math.max(0, offset);
    setScrollOffset(next);
    if (next === 0) {
      setScrollback(undefined);
      return;
    }
    try {
      setScrollback(
        await props.backend.terminalScrollback({
          id: props.id,
          offsetFromBottom: next,
          maxRows: Math.max(1, dimensions().height - 2),
        }),
      );
    } catch (cause) {
      reportError(cause);
    }
  };
  const displayScreen = () => {
    const page = scrollback();
    const screen = session()?.screen;
    if (!page || !screen) return screen;
    return {
      ...screen,
      rows: page.lines.length,
      cursor: { ...screen.cursor, visible: false },
      lines: page.lines,
      text: page.text,
    };
  };

  onMount(async () => {
    try {
      if (!props.backend.terminalViewerRegister)
        throw new Error("Terminal viewer runtime is unavailable");
      setSession(
        await props.backend.terminalViewerRegister({
          id: props.id,
          viewerID,
          kind: "embedded",
        }),
      );
      registered = true;
      resolveRegistered();
      if (!mounted) {
        await props.backend.terminalViewerControl?.({
          id: props.id,
          viewerID,
          action: "unregister",
        });
        return;
      }
      await update();
      await viewer("take_geometry");
      resize();
      heartbeat = setInterval(() => {
        if (!mounted || !registered || !props.backend.terminalViewerHeartbeat)
          return;
        void props.backend
          .terminalViewerHeartbeat({ id: props.id, viewerID })
          .catch(reportError);
      }, 10_000);
      if (props.backend.terminalObserve) {
        let revision = session()?.revision ?? 0;
        while (!controller.signal.aborted) {
          const observation = await props.backend.terminalObserve({
            id: props.id,
            afterRevision: revision,
            timeoutMs: 30_000,
            signal: controller.signal,
            differential: true,
          });
          setSession((current) => ({
            ...observation.session,
            screen: applyTerminalScreenUpdate(
              current?.screen ?? observation.session.screen,
              observation.screenUpdate,
              current?.revision,
            ),
          }));
          revision = observation.session.revision ?? revision;
          if (observation.reason === "exited") break;
        }
      }
    } catch (cause) {
      rejectRegistered(cause);
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : String(cause));
    }
  });
  onCleanup(() => {
    mounted = false;
    controller.abort();
    if (heartbeat) clearInterval(heartbeat);
    if (registered)
      void writes
        .finally(() =>
          props.backend.terminalViewerControl?.({
            id: props.id,
            viewerID,
            action: "unregister",
          }),
        )
        .catch(() => undefined);
  });
  onResize(resize);

  useKeyboard((event) => {
    if (event.ctrl && event.name === "g") {
      event.preventDefault();
      event.stopPropagation();
      void viewer(control() ? "release_input" : "takeover")
        .then(resize)
        .catch(reportError);
      return;
    }
    if (event.ctrl && event.shift && event.name === "s") {
      event.preventDefault();
      event.stopPropagation();
      if (control()) setSecureInput((current) => !current);
      return;
    }
    if (!control() && event.name === "pageup") {
      event.preventDefault();
      event.stopPropagation();
      void loadScrollback(
        scrollOffset() + Math.max(1, dimensions().height - 3),
      );
      return;
    }
    if (!control() && event.name === "pagedown") {
      event.preventDefault();
      event.stopPropagation();
      void loadScrollback(
        scrollOffset() - Math.max(1, dimensions().height - 3),
      );
      return;
    }
    if (!control() && event.name === "escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onBack();
      return;
    }
    if (!control() || !props.backend.terminalViewerWrite) return;
    event.preventDefault();
    event.stopPropagation();
    queueWrite(event.sequence || event.raw);
  });
  usePaste((event) => {
    if (!control() || !props.backend.terminalViewerWrite) return;
    event.preventDefault();
    event.stopPropagation();
    queueWrite(
      session()?.screen?.modes?.bracketedPaste
        ? `\x1b[200~${new TextDecoder().decode(event.bytes)}\x1b[201~`
        : new TextDecoder().decode(event.bytes),
    );
  });

  return (
    <box width="100%" height="100%" flexDirection="column">
      <box flexShrink={0} justifyContent="space-between">
        <text fg={darkTheme.text}>
          Terminal {props.id} · {control() ? "USER CONTROL" : "read-only"} ·{" "}
          {session()?.rows ?? "-"}x{session()?.cols ?? "-"}
        </text>
        <text fg={control() ? darkTheme.warning : darkTheme.muted}>
          Ctrl+G {control() ? "return to model" : "take control"} ·{" "}
          {control()
            ? `Ctrl+Shift+S secure ${secureInput() ? "ON" : "off"}`
            : scrollOffset()
              ? `history -${scrollOffset()} · PgDn toward live`
              : "Esc back · PgUp history"}
        </text>
      </box>
      <Show when={error()}>
        <text fg={darkTheme.danger}>{error()}</text>
      </Show>
      <box flexGrow={1} overflow="hidden">
        <TerminalScreen
          screen={displayScreen()}
          fallback={session()?.transcript ?? "Waiting for terminal output"}
          maxRows={Math.max(1, dimensions().height - 2)}
        />
      </box>
    </box>
  );
}
