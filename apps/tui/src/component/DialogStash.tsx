import { createMemo, createSignal } from "solid-js";
import { DialogSelect } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";
import { useLocal } from "../context/local";

function relativeTime(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function DialogStash(props: { select(input: string): void }) {
  const dialog = useDialog();
  const local = useLocal();
  const [deleting, setDeleting] = createSignal<number>();
  const options = createMemo(() =>
    local.state.promptStash
      .map((entry, index) => ({
        title:
          deleting() === index
            ? "Press D again to delete"
            : entry.input.split("\n")[0]?.trim() || "(empty draft)",
        value: index,
        description: relativeTime(entry.timestamp),
        footer: entry.input.includes("\n")
          ? `~${entry.input.split("\n").length} lines`
          : undefined,
      }))
      .toReversed(),
  );
  return (
    <DialogSelect
      title="Stash"
      options={options()}
      emptyView={<text>No stashed prompts.</text>}
      onMove={() => setDeleting(undefined)}
      onSelect={(option) => {
        const index = option.value;
        const entry = local.state.promptStash[index];
        if (!entry) return;
        local.removeStash(index);
        props.select(entry.input);
        dialog.pop();
      }}
      actions={[
        {
          command: "prompt.stash.delete",
          title: "Delete",
          onTrigger: (option) => {
            if (deleting() !== option.value) {
              setDeleting(option.value);
              return;
            }
            local.removeStash(option.value);
            setDeleting(undefined);
          },
        },
      ]}
    />
  );
}
