import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { CanvasAddon } from "@xterm/addon-canvas";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";

type TauriGlobal = {
  core: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
  event: {
    listen<T>(
      event: string,
      handler: (event: { payload: T }) => void,
    ): Promise<() => void>;
  };
};

function getTauriGlobal(): TauriGlobal | undefined {
  return (globalThis as { __TAURI__?: TauriGlobal }).__TAURI__;
}

async function callRuntime<T = unknown>(
  tauri: TauriGlobal,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return await tauri.core.invoke<T>("runtime_call", {
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
  | { type: "output"; data: string }
  | { type: "exit"; id: string }
  | { type: "error"; message: string; fatal?: boolean };

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
  let resizeObserver: ResizeObserver | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let lastError: string | undefined;
  let fatal = false;
  const tauri = getTauriGlobal();

  function theme() {
    const styles = getComputedStyle(document.documentElement);
    return {
      background: styles.getPropertyValue("--neu-bg-light").trim() || "#1b1e24",
      foreground: styles.getPropertyValue("--neu-text").trim() || "#e6e8eb",
      cursor: styles.getPropertyValue("--neu-accent").trim() || "#5fd4b8",
      selectionBackground: styles.getPropertyValue("--neu-accent-soft").trim() || "#7de8d0",
    };
  }

  function scheduleReconnect() {
    if (closed || fatal) return;
    console.log("[web-terminal] schedule reconnect", {
      sessionID: props.sessionID,
      terminalID: props.terminalID,
    });
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 1500);
  }

  function handleServerMessage(message: ServerMessage) {
    console.log("[web-terminal] ipc message", {
      type: message.type,
      id: message.id,
      bytes: message.type === "output" ? message.data.length : undefined,
      textLength: message.type === "restore" ? message.text.length : undefined,
    });
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
      if (term && fit) {
        fit.fit();
        void callRuntime(tauri!, "nativeTerminal.resize", {
          id: props.terminalID,
          rows: term.rows,
          cols: term.cols,
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
      !tauri
    )
      return;
    const previous = ipcUnlisten;
    ipcUnlisten = undefined;
    previous?.();

    console.log("[web-terminal] ipcConnect start", {
      sessionID: props.sessionID,
      terminalID: props.terminalID,
      command: props.command,
    });

    try {
      ipcUnlisten = await tauri.event.listen<{
        id: string;
        message: ServerMessage;
      }>("natalia-terminal-output", (event) => {
        if (event.payload.id !== props.terminalID) return;
        handleServerMessage(event.payload.message);
      });
      console.log("[web-terminal] ipc event listener ready");

      const listed =
        (await callRuntime<Array<{
          id: string;
          status: string;
          sessionID?: string;
        }>>(tauri, "nativeTerminal.list")) ?? [];
      let session = listed.find((item) => item.id === props.terminalID);
      if (!session || (session.sessionID && session.sessionID !== props.sessionID)) {
        console.log("[web-terminal] nativeTerminal.start", {
          terminalID: props.terminalID,
          sessionID: props.sessionID,
          command: props.command || "bash",
        });
        session =
          (await callRuntime<{ id: string; status: string } | undefined>(
            tauri,
            "nativeTerminal.start",
            {
              command: props.command || "bash",
              id: props.terminalID,
              sessionID: props.sessionID,
            },
          )) ?? undefined;
        console.log("[web-terminal] nativeTerminal.start result", session);
      } else {
        console.log("[web-terminal] reuse existing terminal", session);
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

      console.log("[web-terminal] call terminal_output_subscribe", {
        sessionId: props.sessionID,
        terminalId: props.terminalID,
      });
      await tauri.core.invoke("terminal_output_subscribe", {
        sessionId: props.sessionID,
        terminalId: props.terminalID,
      });
      console.log("[web-terminal] terminal_output_subscribe ok");

      const read = await callRuntime<{ text: string } | undefined>(
        tauri,
        "nativeTerminal.read",
        { id: props.terminalID },
      );
      console.log("[web-terminal] nativeTerminal.read", {
        textLength: read?.text.length ?? 0,
      });
      try {
        term?.clear();
      } catch {
        // xterm may not be ready yet
      }
      if (read?.text) term?.write(read.text);
      if (term && fit) {
        fit.fit();
        await callRuntime(tauri, "nativeTerminal.resize", {
          id: props.terminalID,
          rows: term.rows,
          cols: term.cols,
        });
        console.log("[web-terminal] initial resize ok", {
          rows: term.rows,
          cols: term.cols,
        });
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
      (!props.runtimeURL && !tauri)
    )
      return;
    if (tauri) {
      console.log("[web-terminal] using Tauri IPC transport");
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
          fit.fit();
          ws.send(
            JSON.stringify({
              type: "resize",
              rows: term.rows,
              cols: term.cols,
            }),
          );
        }
      }
    };
    ws.onopen = () => {
      lastError = undefined;
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
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      try {
        term.loadAddon(new CanvasAddon());
      } catch {
        // Keep the DOM renderer as a final fallback.
      }
    }
    searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    term.open(host);
    fit.fit();
    term.onData((data) => {
      if (tauri) {
        console.log("[web-terminal] write through IPC", {
          terminalID: props.terminalID,
          bytes: data.length,
        });
        void callRuntime(tauri, "nativeTerminal.write", {
          id: props.terminalID,
          input: data,
        }).catch((error) => {
          console.error("[web-terminal] write failed", error);
        });
        return;
      }
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "input", data }));
    });
    term.onResize(({ cols, rows }) => {
      if (tauri) {
        console.log("[web-terminal] resize through IPC", {
          terminalID: props.terminalID,
          rows,
          cols,
        });
        void callRuntime(tauri, "nativeTerminal.resize", {
          id: props.terminalID,
          rows,
          cols,
        }).catch((error) => {
          console.error("[web-terminal] resize failed", error);
        });
        return;
      }
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "resize", rows, cols }));
    });
    resizeObserver = new ResizeObserver(() => {
      if (!props.active) return;
      try {
        fit?.fit();
      } catch {
        // xterm can throw if the pane is hidden
      }
    });
    resizeObserver.observe(host);
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
    if (props.active) {
      try {
        fit?.fit();
      } catch {
        // xterm can throw if the pane is hidden
      }
    }
  });

  let fontSize = 12;

  function changeFontSize(delta: number) {
    fontSize = Math.max(8, Math.min(24, fontSize + delta));
    if (term) term.options.fontSize = fontSize;
    try {
      fit?.fit();
    } catch {
      // ignore when hidden
    }
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
    resizeObserver?.disconnect();
    socket?.close();
    term?.dispose();
  });

  return <div class="web-terminal" ref={host} />;
}
