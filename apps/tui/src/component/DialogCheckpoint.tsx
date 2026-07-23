import { createSignal, For, onMount, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import type {
  CheckpointPreview,
  RuntimeCheckpoint,
  RuntimeClient,
} from "@natalia/contracts";
import { darkTheme } from "../theme/theme";
import { DialogConfirm } from "../dialog/DialogConfirm";
import { useDialog } from "../dialog/provider";
import { DialogSelect } from "../dialog/DialogSelect";

export function DialogCheckpoint(props: { backend: RuntimeClient }) {
  const dialog = useDialog();
  const [checkpoints, setCheckpoints] = createSignal<RuntimeCheckpoint[]>([]);
  const [error, setError] = createSignal<string>();
  const [loading, setLoading] = createSignal(true);
  const refresh = async () => {
    if (!props.backend.checkpointList) {
      setError("Checkpoint management is unavailable in this runtime.");
      setLoading(false);
      return;
    }
    try {
      setCheckpoints(await props.backend.checkpointList());
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
      title="Workspace Checkpoints"
      options={[...checkpoints()].reverse().map((checkpoint) => ({
        title: checkpoint.id,
        description: `#${checkpoint.sequence} · ${checkpoint.reason} · ${checkpoint.files} files · ${checkpoint.changes} changes`,
        footer: checkpoint.complete ? "complete" : "incomplete",
        value: checkpoint,
      }))}
      emptyView={
        <box paddingLeft={4} paddingRight={4} paddingTop={1}>
          <text fg={darkTheme.muted}>
            {loading()
              ? "Loading checkpoints..."
              : (error() ?? "No workspace checkpoints.")}
          </text>
        </box>
      }
      onSelect={(option) =>
        dialog.push(() => (
          <CheckpointDetail
            backend={props.backend}
            checkpoint={option.value}
            onChanged={() => {
              void refresh();
              dialog.pop();
            }}
          />
        ))
      }
      actions={[
        {
          command: "checkpoint.manage.refresh",
          title: "r refresh",
          onTrigger: () => void refresh(),
        },
      ]}
    />
  );
}

function CheckpointDetail(props: {
  backend: RuntimeClient;
  checkpoint: RuntimeCheckpoint;
  onChanged(): void;
}) {
  const dialog = useDialog();
  const [preview, setPreview] = createSignal<CheckpointPreview>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const loadPreview = async () => {
    if (!props.backend.checkpointPreview) return;
    setBusy(true);
    try {
      setPreview(await props.backend.checkpointPreview(props.checkpoint.id));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const rollback = async (dryRun: boolean) => {
    if (!props.backend.checkpointRollback) return;
    setBusy(true);
    try {
      setPreview(
        await props.backend.checkpointRollback({
          id: props.checkpoint.id,
          dryRun,
        }),
      );
      setError(undefined);
      if (!dryRun) props.onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  useBindings(() => ({
    mode: "modal",
    bindings: [
      {
        key: "p",
        desc: "Preview rollback",
        group: "Checkpoint",
        cmd: () => void loadPreview(),
      },
      {
        key: "d",
        desc: "Dry-run rollback",
        group: "Checkpoint",
        cmd: () => void rollback(true),
      },
      {
        key: "r",
        desc: "Restore checkpoint",
        group: "Checkpoint",
        cmd: () => {
          if (!props.checkpoint.complete || busy()) return;
          dialog.push(() => (
            <DialogConfirm
              title="Restore Checkpoint"
              message={`Restore ${props.checkpoint.id}? A safety checkpoint will be created first.`}
              label="cancel"
              onConfirm={() => void rollback(false)}
            />
          ));
        },
      },
    ],
  }));
  onMount(() => void loadPreview());
  return (
    <box flexDirection="column" paddingLeft={3} paddingRight={3} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
          Checkpoint {props.checkpoint.id}
        </text>
        <text fg={darkTheme.muted} onMouseUp={() => dialog.pop()}>
          esc
        </text>
      </box>
      <text fg={darkTheme.muted}>
        {props.checkpoint.complete ? "complete" : "incomplete"} · step{" "}
        {props.checkpoint.step} · {props.checkpoint.files} files ·{" "}
        {props.checkpoint.changes} changes
      </text>
      <Show when={preview()}>
        {(value) => <PreviewView preview={value()} />}
      </Show>
      <Show when={error()}>
        <text fg={darkTheme.danger} wrapMode="word">
          {error()}
        </text>
      </Show>
      <text fg={darkTheme.muted}>
        {busy()
          ? "processing..."
          : "p preview · d dry-run · r restore · escape close"}
      </text>
    </box>
  );
}

function PreviewView(props: { preview: CheckpointPreview }) {
  return (
    <box flexDirection="column" gap={1}>
      <text fg={darkTheme.warning}>
        {props.preview.dryRun ? "Dry-run preview" : "Rollback preview"} ·{" "}
        {props.preview.changes.length} file changes · truncate{" "}
        {props.preview.context.truncateMessages} messages
      </text>
      <scrollbox
        maxHeight={10}
        border={["left"]}
        borderColor={darkTheme.muted}
        paddingLeft={1}
      >
        <For each={props.preview.changes}>
          {(change) => (
            <text fg={darkTheme.text} wrapMode="word">
              {change.kind}: {change.oldPath ? `${change.oldPath} -> ` : ""}
              {change.path}
            </text>
          )}
        </For>
        <For each={props.preview.resources}>
          {(resource) => (
            <text fg={darkTheme.muted} wrapMode="word">
              resource {resource.kind}:{resource.id} {resource.action}
            </text>
          )}
        </For>
        <For each={props.preview.warnings}>
          {(warning) => (
            <text fg={darkTheme.warning} wrapMode="word">
              warning: {warning}
            </text>
          )}
        </For>
      </scrollbox>
    </box>
  );
}
