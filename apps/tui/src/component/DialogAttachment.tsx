import { DialogSelect } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";

export function DialogAttachment(props: {
  paths(): string[];
  remove(path: string): void;
  add(): void;
  pasteImage(): void;
}) {
  const dialog = useDialog();
  type AttachmentOption =
    | { kind: "add" | "paste" }
    | { kind: "path"; path: string };
  return (
    <DialogSelect<AttachmentOption>
      title="Attachments"
      renderFilter={false}
      submitLabel="open"
      options={[
        {
          title: "Add workspace path",
          value: { kind: "add" },
          description: "Queue a file using a workspace-relative path",
          onSelect: props.add,
        },
        {
          title: "Paste clipboard image",
          value: { kind: "paste" },
          description: "Save and queue the image currently on the clipboard",
          onSelect: props.pasteImage,
        },
        ...props.paths().map((path) => ({
          title: path.split("/").at(-1) ?? path,
          value: { kind: "path" as const, path },
          description: path,
        })),
      ]}
      emptyView={<text>No queued attachments.</text>}
      actions={[
        {
          command: "prompt.attachment.remove",
          title: "Remove",
          disabled: (option) => option?.value.kind !== "path",
          onTrigger: (option) => {
            if (option.value.kind !== "path") return;
            props.remove(option.value.path);
            if (props.paths().length === 0) dialog.pop();
          },
        },
      ]}
    />
  );
}
