import { createSignal, onMount, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type {
  RuntimeClient,
  RuntimeNativeTerminalSession,
} from "@natalia/contracts";
import { darkTheme } from "../theme/theme";
import { useDialog } from "../dialog/provider";
import { DialogSelect } from "../dialog/DialogSelect";

export function DialogTerminal(props: { backend: RuntimeClient }) {
  const dialog = useDialog();
  const [sessions, setSessions] = createSignal<RuntimeNativeTerminalSession[]>(
    [],
  );
  const [error, setError] = createSignal<string>();
  const [loading, setLoading] = createSignal(true);

  const refresh = async () => {
    if (!props.backend.nativeTerminalList) {
      setError("Terminal management is unavailable in this runtime.");
      setLoading(false);
      return;
    }
    try {
      setSessions(await props.backend.nativeTerminalList());
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => void refresh());

  const select = (session: RuntimeNativeTerminalSession) =>
    dialog.push(() => (
      <TerminalActions
        backend={props.backend}
        session={session}
        onChanged={() => {
          void refresh();
          dialog.pop();
        }}
      />
    ));

  return (
    <DialogSelect
      title="Terminal Sessions"
      options={sessions().map((session) => ({
        title: session.id,
        description: `${session.status} · WezTerm pane ${session.paneID} · ${session.command}`,
        value: session,
        footer: `${session.inputOwner} control · ${
          session.mayWaitForHuman ? "may wait for human · " : ""
        }${session.rows ?? "?"}x${session.cols ?? "?"} human geometry · native window ${session.windowID}`,
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
    />
  );
}

function TerminalActions(props: {
  backend: RuntimeClient;
  session: RuntimeNativeTerminalSession;
  onChanged(): void;
}) {
  const dialog = useDialog();
  const [error, setError] = createSignal<string>();
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      props.onChanged();
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
        {props.session.status} · native WezTerm pane {props.session.paneID}
        {props.session.secureInput ? " · secure input active" : ""}
        {"\n"}
        {props.session.command}
      </text>
      <text
        fg={
          props.session.inputOwner === "human"
            ? darkTheme.warning
            : darkTheme.success
        }
        wrapMode="word"
      >
        {props.session.inputOwner === "human"
          ? "You currently control terminal input. Select Give input to model below to return writing to the model."
          : "The model can write to this terminal until your first keyboard, IME, or paste input."}
      </text>
      <Show when={error()}>
        <text fg={darkTheme.danger} wrapMode="word">
          {error()}
        </text>
      </Show>
      <DialogSelect
        title="Terminal Actions"
        renderFilter={false}
        options={[
          {
            title: "Revoke low-risk approval",
            value: "revoke-approval",
            disabled: !props.backend.nativeTerminalRevokeApprovalScope,
          },
          {
            title: "Give input to model",
            value: "give-model-control",
            disabled:
              props.session.inputOwner === "model" ||
              !props.backend.nativeTerminalReleaseHumanControl,
          },
          { title: "Stop terminal", value: "stop" },
        ]}
        onSelect={(option) => {
          if (
            option.value === "revoke-approval" &&
            props.backend.nativeTerminalRevokeApprovalScope
          )
            void run(() =>
              props.backend.nativeTerminalRevokeApprovalScope!(
                props.session.id,
              ),
            );
          if (
            option.value === "give-model-control" &&
            props.backend.nativeTerminalReleaseHumanControl
          )
            void run(() =>
              props.backend.nativeTerminalReleaseHumanControl!(
                props.session.id,
              ),
            );
          if (option.value === "stop" && props.backend.nativeTerminalStop)
            void run(() => props.backend.nativeTerminalStop!(props.session.id));
        }}
      />
    </box>
  );
}
