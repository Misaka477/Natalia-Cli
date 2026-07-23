import { createSignal, For, onMount, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type {
  RuntimeClient,
  RuntimeSandbox,
  RuntimeSandboxChange,
  RuntimeSandboxResource,
} from "@natalia/contracts";
import { darkTheme } from "../theme/theme";
import { DialogConfirm } from "../dialog/DialogConfirm";
import { useDialog } from "../dialog/provider";
import { DialogSelect } from "../dialog/DialogSelect";

export function DialogSandbox(props: { backend: RuntimeClient }) {
  const dialog = useDialog();
  const [sandboxes, setSandboxes] = createSignal<RuntimeSandbox[]>([]);
  const [error, setError] = createSignal<string>();
  const [loading, setLoading] = createSignal(true);
  const refresh = async () => {
    if (!props.backend.sandboxList) {
      setError("Sandbox management is unavailable in this runtime.");
      setLoading(false);
      return;
    }
    try {
      setSandboxes(await props.backend.sandboxList());
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };
  onMount(() => void refresh());
  return (
    <DialogSelect
      title="Workspace Sandboxes"
      options={sandboxes().map((sandbox) => ({
        title: sandbox.id,
        description: `${sandbox.isolationLevel} · ${sandbox.changedFiles} changes · ${sandbox.runningResources} resources`,
        footer: "workspace isolation",
        value: sandbox,
      }))}
      emptyView={
        <box paddingLeft={4} paddingRight={4} paddingTop={1}>
          <text fg={darkTheme.muted}>
            {loading()
              ? "Loading sandboxes..."
              : (error() ?? "No workspace sandboxes.")}
          </text>
        </box>
      }
      onSelect={(option) =>
        dialog.push(() => (
          <SandboxDetail
            backend={props.backend}
            sandbox={option.value}
            onChanged={() => {
              void refresh();
              dialog.pop();
            }}
          />
        ))
      }
      actions={[
        {
          command: "sandbox.manage.refresh",
          title: "r refresh",
          onTrigger: () => void refresh(),
        },
      ]}
    />
  );
}

function SandboxDetail(props: {
  backend: RuntimeClient;
  sandbox: RuntimeSandbox;
  onChanged(): void;
}) {
  const dialog = useDialog();
  const [changes, setChanges] = createSignal<RuntimeSandboxChange[]>([]);
  const [resources, setResources] = createSignal<RuntimeSandboxResource[]>([]);
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const refresh = async () => {
    if (!props.backend.sandboxDiff || !props.backend.sandboxResources) return;
    setBusy(true);
    try {
      const [nextChanges, nextResources] = await Promise.all([
        props.backend.sandboxDiff(props.sandbox.id),
        props.backend.sandboxResources(props.sandbox.id),
      ]);
      setChanges(nextChanges);
      setResources(nextResources);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const showOutput = async (resource: RuntimeSandboxResource) => {
    if (!props.backend.sandboxResourceOutput) return;
    try {
      const output = await props.backend.sandboxResourceOutput({
        id: props.sandbox.id,
        resourceID: resource.id,
        maxBytes: 12000,
      });
      dialog.push(() => <ResourceOutput resource={resource} output={output} />);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  onMount(() => void refresh());
  return (
    <box flexDirection="column" paddingLeft={3} paddingRight={3} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
          Sandbox {props.sandbox.id}
        </text>
        <text fg={darkTheme.muted} onMouseUp={() => dialog.pop()}>
          esc
        </text>
      </box>
      <text fg={darkTheme.warning} wrapMode="word">
        {props.sandbox.isolationLevel} isolation only. This is not container or
        VM security.
      </text>
      <Show
        when={changes().length > 0}
        fallback={<text fg={darkTheme.muted}>No pending changes.</text>}
      >
        <scrollbox
          maxHeight={7}
          border={["left"]}
          borderColor={darkTheme.muted}
          paddingLeft={1}
        >
          <For each={changes()}>
            {(change) => (
              <text fg={darkTheme.text} wrapMode="word">
                {change.kind}: {change.oldPath ? `${change.oldPath} -> ` : ""}
                {change.path}
              </text>
            )}
          </For>
        </scrollbox>
      </Show>
      <Show when={resources().length > 0}>
        <text fg={darkTheme.muted}>Managed resources</text>
        <For each={resources()}>
          {(resource) => (
            <text
              fg={darkTheme.text}
              onMouseUp={() => void showOutput(resource)}
            >
              {resource.id} · {resource.status} · {resource.command}
            </text>
          )}
        </For>
      </Show>
      <Show when={error()}>
        <text fg={darkTheme.danger} wrapMode="word">
          {error()}
        </text>
      </Show>
      <DialogSelect
        title="Sandbox Actions"
        renderFilter={false}
        options={[
          { title: "Refresh diff and resources", value: "refresh" },
          {
            title: "Merge pending changes",
            value: "merge",
            disabled: changes().length === 0,
          },
          {
            title: "Stop selected resource",
            value: "stop",
            disabled: resources().every((item) => item.status !== "running"),
          },
          { title: "Delete sandbox", value: "delete" },
        ]}
        onSelect={(option) => {
          if (option.value === "refresh") void refresh();
          if (option.value === "merge" && props.backend.sandboxMerge)
            dialog.push(() => (
              <DialogConfirm
                title="Merge Sandbox"
                message={`Merge ${changes().length} pending manifest change(s) into the host workspace?`}
                label="cancel"
                onConfirm={() =>
                  void run(() => props.backend.sandboxMerge!(props.sandbox.id))
                }
              />
            ));
          if (option.value === "stop" && props.backend.sandboxResourceStop) {
            const resource = resources().find(
              (item) => item.status === "running",
            );
            if (resource)
              dialog.push(() => (
                <DialogConfirm
                  title="Stop Sandbox Resource"
                  message={`Stop ${resource.id}?`}
                  label="cancel"
                  onConfirm={() =>
                    void run(() =>
                      props.backend.sandboxResourceStop!({
                        id: props.sandbox.id,
                        resourceID: resource.id,
                      }),
                    )
                  }
                />
              ));
          }
          if (option.value === "delete" && props.backend.sandboxDelete)
            dialog.push(() => (
              <DialogConfirm
                title="Delete Sandbox"
                message={`Delete ${props.sandbox.id} and stop its managed resources?`}
                label="cancel"
                onConfirm={() =>
                  void run(() => props.backend.sandboxDelete!(props.sandbox.id))
                }
              />
            ));
        }}
      />
      <text fg={darkTheme.muted}>
        {busy()
          ? "processing..."
          : "Select a resource to read retained output."}
      </text>
    </box>
  );
}

function ResourceOutput(props: {
  resource: RuntimeSandboxResource;
  output: string;
}) {
  const dialog = useDialog();
  return (
    <box flexDirection="column" paddingLeft={3} paddingRight={3} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
          Resource {props.resource.id}
        </text>
        <text fg={darkTheme.muted} onMouseUp={() => dialog.pop()}>
          esc
        </text>
      </box>
      <scrollbox
        maxHeight={16}
        border={["left"]}
        borderColor={darkTheme.muted}
        paddingLeft={1}
      >
        <text fg={darkTheme.text} wrapMode="word">
          {props.output || "(no retained output)"}
        </text>
      </scrollbox>
    </box>
  );
}
