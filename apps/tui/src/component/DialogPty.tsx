import { createSignal, For, onMount, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { RuntimeClient, RuntimePTYSession } from "@natalia/contracts";
import { darkTheme } from "../theme/theme";
import { useDialog } from "../dialog/provider";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { DialogSelect } from "../dialog/DialogSelect";
import { TerminalScreen } from "./TerminalScreen";
import { openExternalTerminal } from "../terminal-attach";

export function DialogPty(props: {
  backend: RuntimeClient;
  onOpenInternal?(id: string): void;
}) {
  const dialog = useDialog();
  const [sessions, setSessions] = createSignal<RuntimePTYSession[]>([]);
  const [error, setError] = createSignal<string>();
  const [loading, setLoading] = createSignal(true);

  const refresh = async () => {
    if (!props.backend.ptyList) {
      setError("Terminal management is unavailable in this runtime.");
      setLoading(false);
      return;
    }
    try {
      setSessions(await props.backend.ptyList());
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => void refresh());

  const select = (session: RuntimePTYSession) =>
    dialog.push(() => (
      <PtyActions
        backend={props.backend}
        session={session}
        onChanged={() => {
          void refresh();
          dialog.pop();
        }}
        onOpenInternal={props.onOpenInternal}
      />
    ));

  return (
    <DialogSelect
      title="Terminal Sessions"
      options={sessions().map((session) => ({
        title: session.id,
        description: `${session.status} · ${session.rows}x${session.cols} · ${session.command}`,
        value: session,
        footer: `${session.inputOwner?.type ?? "model"} control · ${session.viewers?.length ?? 0} viewer(s)`,
      }))}
      emptyView={
        <box paddingLeft={4} paddingRight={4} paddingTop={1}>
          <text fg={darkTheme.muted}>
            {loading()
              ? "Loading terminal sessions..."
              : (error() ?? "No interactive terminal sessions.")}
          </text>
        </box>
      }
      onSelect={(option) => select(option.value)}
      actions={[
        {
          command: "pty.manage.refresh",
          title: "r refresh",
          onTrigger: () => void refresh(),
        },
      ]}
    />
  );
}

function PtyActions(props: {
  backend: RuntimeClient;
  session: RuntimePTYSession;
  onChanged(): void;
  onOpenInternal?(id: string): void;
}) {
  const dialog = useDialog();
  const [error, setError] = createSignal<string>();
  const [detail, setDetail] = createSignal(props.session);
  const inputOwner = () => detail().inputOwner;
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      props.onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const read = async () => {
    if (!props.backend.ptyRead) return;
    try {
      const result = await props.backend.ptyRead({
        id: props.session.id,
        maxChars: 12000,
      });
      setDetail(result);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      dialog.clear();
      props.onOpenInternal?.(props.session.id);
    }
  };
  const promptWrite = (sensitive = false) =>
    dialog.push(() => (
      <DialogPrompt
        title={sensitive ? "Sensitive Terminal Input" : "Terminal Input"}
        placeholder={
          sensitive ? "Input is redacted from transcript" : "Send input"
        }
        onConfirm={(text) => {
          if (!props.backend.ptyWrite) return;
          dialog.pop();
          void run(() =>
            props.backend.ptyWrite!({
              id: props.session.id,
              text,
              sensitive,
            }),
          );
        }}
      />
    ));
  const promptResize = () =>
    dialog.push(() => (
      <DialogPrompt
        title="Resize Terminal"
        placeholder="rows cols, e.g. 32 120"
        onConfirm={(text) => {
          const [rows, cols] = text.trim().split(/\s+/u).map(Number);
          if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
            setError("Enter integer rows and columns.");
            return;
          }
          if (!props.backend.ptyResize) return;
          dialog.pop();
          void run(() =>
            props.backend.ptyResize!({ id: props.session.id, rows, cols }),
          );
        }}
      />
    ));
  const openExternal = (takeControl = false, secureInput = false) => {
    try {
      openExternalTerminal({
        backend: props.backend,
        id: props.session.id,
        takeControl,
        secureInput,
      });
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <box flexDirection="column" paddingLeft={3} paddingRight={3} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
          Terminal {props.session.id}
        </text>
        <text fg={darkTheme.muted} onMouseUp={() => dialog.pop()}>
          esc
        </text>
      </box>
      <text fg={darkTheme.muted} wrapMode="word">
        {props.session.status} ·{" "}
        {props.session.attached ? "attached" : "detached"} ·{" "}
        {props.session.rows}x{props.session.cols}
        {" · "}
        {inputOwner()?.type === "viewer"
          ? `user control (${(inputOwner() as { type: "viewer"; viewerID: string }).viewerID})`
          : "model control"}
        {` · ${detail().viewers?.length ?? 0} viewer(s)`}
        {"\n"}
        {props.session.command}
      </text>
      <scrollbox
        maxHeight={20}
        border={["left"]}
        borderColor={darkTheme.muted}
        paddingLeft={1}
      >
        <TerminalScreen
          screen={detail().screen}
          fallback={detail().transcript || "(no terminal output)"}
          maxRows={20}
        />
      </scrollbox>
      <Show when={error()}>
        <text fg={darkTheme.danger} wrapMode="word">
          {error()}
        </text>
      </Show>
      <DialogSelect
        title="Terminal Actions"
        renderFilter={false}
        options={[
          { title: "Refresh terminal", value: "read" },
          { title: "Open full-screen workspace", value: "internal" },
          { title: "Open external viewer", value: "external-readonly" },
          {
            title: "Open external and take control",
            value: "external-control",
          },
          {
            title: "Open external for secure input",
            value: "external-secure",
          },
          {
            title: props.session.attached ? "Detach session" : "Attach session",
            value: props.session.attached ? "detach" : "attach",
          },
          { title: "Send input", value: "write" },
          { title: "Send sensitive input", value: "sensitive" },
          { title: "Resize", value: "resize" },
          { title: "Send Ctrl-C", value: "ctrl-c" },
          { title: "Send Ctrl-D", value: "ctrl-d" },
          { title: "Stop session", value: "stop" },
        ]}
        onSelect={(option) => {
          if (option.value === "read") void read();
          if (option.value === "write") promptWrite();
          if (option.value === "sensitive") promptWrite(true);
          if (option.value === "resize") promptResize();
          if (option.value === "internal") {
            dialog.clear();
            props.onOpenInternal?.(props.session.id);
          }
          if (option.value === "external-readonly") openExternal();
          if (option.value === "external-control") openExternal(true);
          if (option.value === "external-secure") openExternal(true, true);
          if (option.value === "attach" && props.backend.ptyAttach)
            void run(() => props.backend.ptyAttach!(props.session.id));
          if (option.value === "detach" && props.backend.ptyDetach)
            void run(() => props.backend.ptyDetach!(props.session.id));
          if (option.value === "ctrl-c" && props.backend.ptyKey)
            void run(() =>
              props.backend.ptyKey!({
                id: props.session.id,
                key: "ctrl-c",
              }),
            );
          if (option.value === "ctrl-d" && props.backend.ptyKey)
            void run(() =>
              props.backend.ptyKey!({
                id: props.session.id,
                key: "ctrl-d",
              }),
            );
          if (option.value === "stop" && props.backend.ptyStop)
            void run(() => props.backend.ptyStop!(props.session.id));
        }}
      />
    </box>
  );
}
