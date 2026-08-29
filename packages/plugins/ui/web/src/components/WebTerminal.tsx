import { createEffect, onCleanup, onMount } from "solid-js";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export type WebTerminalProps = {
  sessionID: string;
  runtimeURL: string;
  token?: string;
  active?: boolean;
};

type ServerMessage =
  | { type: "ready"; id: string; rows?: number; cols?: number }
  | { type: "output"; data: string }
  | { type: "exit"; id: string }
  | { type: "error"; message: string };

function terminalSocketURL(runtimeURL: string, sessionID: string, token?: string) {
  const url = new URL(
    `/terminal/${encodeURIComponent(sessionID)}/${encodeURIComponent(sessionID)}`,
    runtimeURL,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export function WebTerminal(props: WebTerminalProps) {
  let host: HTMLDivElement | undefined;
  let term: Terminal | undefined;
  let fit: FitAddon | undefined;
  let socket: WebSocket | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  function theme() {
    const styles = getComputedStyle(document.documentElement);
    return {
      background: styles.getPropertyValue("--neu-bg-light").trim() || "#1b1e24",
      foreground: styles.getPropertyValue("--neu-text").trim() || "#e6e8eb",
      cursor: styles.getPropertyValue("--neu-accent").trim() || "#5fd4b8",
      selectionBackground: styles.getPropertyValue("--neu-accent-soft").trim() || "#7de8d0",
    };
  }

  function connect() {
    if (closed || !props.sessionID || !props.runtimeURL) return;
    socket?.close();
    const ws = new WebSocket(
      terminalSocketURL(props.runtimeURL, props.sessionID, props.token),
    );
    socket = ws;
    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      if (message.type === "output") term?.write(message.data);
      if (message.type === "error") term?.writeln(`\r\n[${message.message}]`);
      if (message.type === "exit") term?.writeln("\r\n[terminated]");
    };
    ws.onopen = () => {
      if (term && fit) {
        fit.fit();
        ws.send(
          JSON.stringify({
            type: "resize",
            rows: term.rows,
            cols: term.cols,
          }),
        );
      }
    };
    ws.onclose = () => {
      if (closed) return;
      reconnectTimer = setTimeout(connect, 1500);
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
    });
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(host);
    fit.fit();
    term.onData((data) => {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "input", data }));
    });
    term.onResize(({ cols, rows }) => {
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
    connect();
  });

  createEffect((previous?: string) => {
    const key = `${props.sessionID}\0${props.runtimeURL}`;
    if (previous && previous !== key && term) connect();
    return key;
  });

  onCleanup(() => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    resizeObserver?.disconnect();
    socket?.close();
    term?.dispose();
  });

  return <div class="web-terminal" ref={host} />;
}
