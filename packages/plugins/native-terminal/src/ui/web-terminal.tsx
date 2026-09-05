import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { Terminal } from "@xterm/xterm";
import { cssVar } from "@natalia/ui-kit";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";

type ElectronGlobal = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  on<T>(channel: string, listener: (payload: T) => void): () => void;
};

function getElectronGlobal(): ElectronGlobal | undefined {
  return (globalThis as { electron?: ElectronGlobal }).electron;
}

async function callRuntime<T = unknown>(
  ipc: { invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> },
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return await ipc.invoke<T>("runtime_call", {
    method,
    params: params ?? {},
  });
}

export type WebTerminalApi = {
  clear(): void;
  findNext(query: string): boolean;
  findPrevious(query: string): boolean;
  reset(): void;
  copy(): Promise<void>;
  paste(): Promise<void>;
  zoomIn(): void;
  zoomOut(): void;
};

export type WebTerminalProps = {
  sessionID: string;
  terminalID: string;
  runtimeURL: string;
  token?: string;
  active?: boolean;
  command?: string;
  registerApi?: (api: WebTerminalApi | undefined) => void;
};

type ServerMessage =
  | { type: "ready"; id: string; rows?: number; cols?: number }
  | { type: "restore"; id: string; text: string }
  | { type: "output"; data: string; id?: string }
  | { type: "exit"; id: string }
  | { type: "error"; message: string; fatal?: boolean; id?: string };

const TRANSIENT_CLOSE_CODES = new Set([1001, 1006, 1012, 1013]);

function terminalSocketURL(
  runtimeURL: string,
  sessionID: string,
  terminalID: string,
  token?: string,
  command?: string,
) {
  const url = new URL(
    `/terminal/${encodeURIComponent(sessionID)}/${encodeURIComponent(terminalID)}`,
    runtimeURL,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (token) url.searchParams.set("token", token);
  if (command) url.searchParams.set("command", command);
  return url.toString();
}

export function WebTerminal(props: WebTerminalProps) {
  let host: HTMLDivElement | undefined;
  let term: Terminal | undefined;
  let fit: FitAddon | undefined;
  let searchAddon: SearchAddon | undefined;
  let socket: WebSocket | undefined;
  let ipcUnlisten: (() => void) | undefined;
  let windowResizeHandler: (() => void) | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let lastError: string | undefined;
  let fatal = false;
  let sessionReady = false;
  let lastResizeKey = "";
  let lastInputSentAt: number | undefined;
  let lastEchoLogged = false;
  const electron = getElectronGlobal();
  const desktop = electron;

  function fitSafely() {
    if (!host || !fit) return;
    if (host.clientWidth <= 0 || host.clientHeight <= 0) return;
    try {
      fit.fit();
    } catch {
      // xterm can throw if the pane is hidden or its host is mid-layout.
    }
  }

  function validResize(rows: number, cols: number) {
    return (
      Number.isInteger(rows) &&
      Number.isInteger(cols) &&
      rows >= 1 &&
      rows <= 500 &&
      cols >= 1 &&
      cols <= 500
    );
  }

  function clampResize(rows: number, cols: number) {
    return {
      rows: Math.max(1, Math.min(500, Math.floor(rows))),
      cols: Math.max(1, Math.min(500, Math.floor(cols))),
    };
  }

  function sendResize(rows: number, cols: number, source: string) {
    if (closed || !sessionReady || !validResize(rows, cols)) {
      if (!closed) {
        console.warn("[web-terminal] ignore invalid resize", {
          source,
          rows,
          cols,
        });
      }
      return;
    }
    const resizeKey = `${props.terminalID}:${rows}:${cols}`;
    if (resizeKey === lastResizeKey) return;
    lastResizeKey = resizeKey;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "resize", rows, cols }));
      return;
    }
    if (desktop) {
      void callRuntime(desktop, "nativeTerminal.resize", {
        id: props.terminalID,
        rows,
        cols,
        sessionID: props.sessionID,
      }).catch((error) => {
        console.error("[web-terminal] resize failed", error);
      });
    }
  }

  function theme() {
    // Follow the active UiSkin instead of forcing a dark terminal pane. The
    // app defaults to the light Neumorphism theme; keeping a hardcoded dark
    // background made the terminal bottomless black and hard to read.
    // The terminal pane deliberately keeps a black background so full-screen
    // TUIs remain readable regardless of the surrounding light UI theme.
    const background = "#1b1e24";

    return {
      background,
      foreground: "#e5e5e5",
      cursor: cssVar("--neu-accent", "#5fd4b8"),
      selectionBackground: cssVar("--neu-accent-soft", "#7de8d0"),
      // Standard xterm 16-color palette. Keeps terminal apps that rely on
      // conventional ANSI colors (ls, vim, htop, tmux) looking normal while
      // staying readable on the dark #1b1e24 terminal background.
      black: "#000000",
      red: "#cd0000",
      green: "#00cd00",
      yellow: "#cdcd00",
      blue: "#0000ee",
      magenta: "#cd00cd",
      cyan: "#00cdcd",
      white: "#e5e5e5",
      brightBlack: "#7f7f7f",
      brightRed: "#ff0000",
      brightGreen: "#00ff00",
      brightYellow: "#ffff00",
      brightBlue: "#5c5cff",
      brightMagenta: "#ff00ff",
      brightCyan: "#00ffff",
      brightWhite: "#ffffff",
    };
  }

  function scheduleReconnect() {
    if (closed || fatal) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 1500);
  }

  function handleServerMessage(message: ServerMessage) {
    if (closed) return;
    if (message.type === "restore") {
      term?.clear();
      if (message.text) term?.write(message.text);
    }
    if (message.type === "output") {
      if (lastInputSentAt !== undefined && !lastEchoLogged) {
        lastEchoLogged = true;
        console.warn(
          `[terminal] echo delay ${(performance.now() - lastInputSentAt).toFixed(1)}ms`,
        );
        lastInputSentAt = undefined;
      }
      term?.write(message.data);
    }
    if (message.type === "error") {
      if (message.message === lastError) return;
      lastError = message.message;
      term?.writeln(`\r\n[${message.message}]`);
      if (message.fatal) fatal = true;
    }
    if (message.type === "exit") term?.writeln("\r\n[terminated]");
    if (message.type === "ready") {
      lastError = undefined;
      if (term && fit) {
        fitSafely();
        const { rows, cols } = clampResize(term.rows, term.cols);
        if (validResize(rows, cols))
          void callRuntime(desktop!, "nativeTerminal.resize", {
            id: props.terminalID,
            rows,
            cols,
            sessionID: props.sessionID,
          }).catch((error) => {
            console.error("[web-terminal] resize failed", error);
          });
      }
    }
  }

  async function ipcConnect() {
    if (
      closed ||
      fatal ||
      !props.sessionID ||
      !props.terminalID ||
      !desktop
    )
      return;
    const previous = ipcUnlisten;
    ipcUnlisten = undefined;
    previous?.();

    try {
      ipcUnlisten = electron.on<{ id: string; message: ServerMessage }>(
        "natalia-terminal-output",
        (event) => {
          if (event.id !== props.terminalID) return;
          handleServerMessage(event.message);
        },
      );
      if (closed) return;

      const listed =
        (await callRuntime<Array<{
          id: string;
          status: string;
          sessionID?: string;
        }>>(desktop, "nativeTerminal.list", { sessionID: props.sessionID })) ?? [];
      if (closed) return;
      let session = listed.find((item) => item.id === props.terminalID);
      if (!session || (session.sessionID && session.sessionID !== props.sessionID)) {
        session =
          (await callRuntime<{ id: string; status: string } | undefined>(
            desktop,
            "nativeTerminal.start",
            {
              command: props.command || "bash",
              id: props.terminalID,
              sessionID: props.sessionID,
            },
          )) ?? undefined;
      } else {
      }
      if (!session) {
        fatal = true;
        if (!lastError) {
          lastError = "native terminal start failed";
          term?.writeln("\r\n[native terminal start failed]");
        }
        console.error("[web-terminal] native terminal start returned no session");
        return;
      }
      sessionReady = true;

      if (closed) return;
      const subscribeResult =
        (await desktop!.invoke<{ subscribed?: boolean; reused?: boolean }>(
          "terminal_output_subscribe",
          {
            sessionId: props.sessionID,
            terminalId: props.terminalID,
          },
        )) ?? {};
      if (closed) return;

      if (subscribeResult.reused) {
        // The terminal WebSocket bridge replays the current PTY buffer through
        // `subscribeOutput` on every new WebSocket connection. Do not also
        // write nativeTerminal.read here: the plain-text snapshot would be
        // duplicated next to the ANSI-colored live replay and produce a grey
        // uncolored duplicate of the prompt.
      }

      // The terminal WebSocket bridge will send a `restore` message with the
      // full raw PTY buffer. Avoid also writing nativeTerminal.read here: the
      // plain text snapshot can overlap with live raw output and make the
      // terminal screen render incorrectly.
      console.log("[web-terminal] waiting for restore from terminal bridge");
      if (term && fit) {
        try {
          fitSafely();
          const { rows, cols } = clampResize(term.rows, term.cols);
          if (validResize(rows, cols))
            await callRuntime(desktop, "nativeTerminal.resize", {
              id: props.terminalID,
              rows,
              cols,
              sessionID: props.sessionID,
            });
        } catch {
          // fit can throw while restoring
        }
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      console.error("[web-terminal] ipcConnect failed", error);
      if (text !== lastError) {
        lastError = text;
        term?.writeln(`\r\n[${text}]`);
      }
      scheduleReconnect();
    }
  }

  function connect() {
    if (
      closed ||
      fatal ||
      !props.sessionID ||
      !props.terminalID ||
      (!props.runtimeURL && !desktop)
    )
      return;
    if (desktop && !props.runtimeURL) {
      console.log("[web-terminal] using desktop IPC transport");
      void ipcConnect();
      return;
    }
    console.log("[web-terminal] using WebSocket transport");
    const previous = socket;
    socket = undefined;
    previous?.close();
    const ws = new WebSocket(
      terminalSocketURL(
        props.runtimeURL,
        props.sessionID,
        props.terminalID,
        props.token,
        props.command,
      ),
    );
    socket = ws;
    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      if (lastInputSentAt !== undefined && !lastEchoLogged) {
        lastEchoLogged = true;
        console.warn(
          `[terminal] echo delay ${(performance.now() - lastInputSentAt).toFixed(1)}ms`,
        );
        lastInputSentAt = undefined;
      }
      if (message.type === "restore") {
        term?.clear();
        if (message.text) term?.write(message.text);
      }
      if (message.type === "output") term?.write(message.data);
      if (message.type === "error") {
        if (message.message === lastError) return;
        lastError = message.message;
        term?.writeln(`\r\n[${message.message}]`);
        if (message.fatal) fatal = true;
      }
      if (message.type === "exit") term?.writeln("\r\n[terminated]");
      if (message.type === "ready") {
        lastError = undefined;
        if (term && fit && ws.readyState === WebSocket.OPEN) {
          fitSafely();
          const { rows, cols } = clampResize(term.rows, term.cols);
          if (validResize(rows, cols))
            ws.send(
              JSON.stringify({
                type: "resize",
                rows,
                cols,
              }),
            );
        }
      }
    };
    ws.onopen = () => {
      lastError = undefined;
      sessionReady = true;
      // The server replays the full PTY buffer through the output subscription
      // immediately after opening; clear before that arrives so reconnect does
      // not append a duplicate screen.
      try {
        term?.clear();
      } catch {
        // xterm may not be ready yet
      }
    };
    ws.onclose = (event) => {
      if (socket !== ws || closed || fatal) return;
      if (event.code === 1011) {
        fatal = true;
        if (!lastError) {
          lastError = event.reason || "terminal unavailable";
          term?.writeln(`\r\n[${lastError}]`);
        }
        return;
      }
      if (TRANSIENT_CLOSE_CODES.has(event.code) || event.code === 1006) {
        scheduleReconnect();
        return;
      }
      if (!lastError) {
        lastError = event.reason || `disconnected (${event.code})`;
        term?.writeln(`\r\n[${lastError}]`);
      }
      scheduleReconnect();
    };
  }

  onMount(() => {
    if (!host) return;
    fit = new FitAddon();
    term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "SF Mono", Consolas, monospace',
      fontSize: 12,
      theme: theme(),
      convertEol: true,
      // xterm addons (WebGL/Canvas) use proposed APIs such as
      // registerCharacterJoiner; they require this flag to be enabled.
      allowProposedApi: true,
    });
    // Keep browser-only shortcuts (notably Ctrl+W, which closes the tab)
    // from stealing keys that terminal programs like vim/tmux need.
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown" && event.type !== "keyup") return true;
      const key = event.key.toLowerCase();
      if (event.ctrlKey && event.shiftKey && key === "c") {
        event.preventDefault();
        const selected = term?.getSelection();
        if (selected) void navigator.clipboard.writeText(selected);
        return false;
      }
      if (event.ctrlKey && event.shiftKey && key === "v") {
        event.preventDefault();
        void navigator.clipboard.readText().then((text) => {
          if (text) term?.paste(text);
        }).catch(() => undefined);
        return false;
      }
      if (event.ctrlKey && !event.shiftKey && key === "w") {
        event.preventDefault();
        return false;
      }
      return true;
    });
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    const unicode11 = new Unicode11Addon();
    term.loadAddon(unicode11);
    term.unicode.activeVersion = "11";
    // Use the DOM renderer. On this desktop hardware acceleration is off by
    // default, and both WebGL and Canvas renderers under software rendering
    // make xterm input feel laggy.
    searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    term.open(host);
    fitSafely();
    term.onData((data) => {
      if (closed) return;
      if (socket?.readyState === WebSocket.OPEN) {
        lastInputSentAt = performance.now();
        lastEchoLogged = false;
        socket.send(JSON.stringify({ type: "input", data }));
        return;
      }
      if (desktop) {
        void callRuntime(desktop, "nativeTerminal.write", {
          id: props.terminalID,
          input: data,
          sessionID: props.sessionID,
        }).catch((error) => {
          console.error("[web-terminal] write failed", error);
        });
      }
    });
    term.onResize(({ cols, rows }) => {
      if (closed) return;
      sendResize(rows, cols, "xterm-onResize");
    });
    windowResizeHandler = () => {
      if (!props.active) return;
      fitSafely();
    };
    window.addEventListener("resize", windowResizeHandler);
    props.registerApi?.(api);
    connect();
  });

  createEffect((previous?: string) => {
    const key = `${props.sessionID}\0${props.terminalID}\0${props.runtimeURL}`;
    if (previous && previous !== key && term) {
      fatal = false;
      lastError = undefined;
      term.reset();
      connect();
    }
    return key;
  });

  createEffect(() => {
    if (props.active) fitSafely();
  });

  let fontSize = 12;

  function changeFontSize(delta: number) {
    fontSize = Math.max(8, Math.min(24, fontSize + delta));
    if (term) term.options.fontSize = fontSize;
    fitSafely();
  }

  async function copySelection() {
    const selected = term?.getSelection();
    if (selected) {
      try {
        await navigator.clipboard.writeText(selected);
      } catch {
        // clipboard may be unavailable; ignore
      }
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) term?.paste(text);
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  const api: WebTerminalApi = {
    clear: () => term?.clear(),
    findNext: (query) => Boolean(searchAddon?.findNext(query)),
    findPrevious: (query) => Boolean(searchAddon?.findPrevious(query)),
    reset: () => {
      try {
        term?.reset();
        term?.clear();
      } catch {
        // xterm may be in a weird state; reconnect below
      }
      connect();
    },
    copy: copySelection,
    paste: pasteFromClipboard,
    zoomIn: () => changeFontSize(1),
    zoomOut: () => changeFontSize(-1),
  };

  onCleanup(() => {
    console.log("[web-terminal] cleanup", {
      sessionID: props.sessionID,
      terminalID: props.terminalID,
    });
    closed = true;
    props.registerApi?.(undefined);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ipcUnlisten?.();
    if (windowResizeHandler) window.removeEventListener("resize", windowResizeHandler);
    socket?.close();
    try {
      term?.dispose();
    } catch (error) {
      console.error("[web-terminal] xterm dispose failed", error);
    }
    term = undefined;
  });

  return <div class="web-terminal" ref={host} />;
}
