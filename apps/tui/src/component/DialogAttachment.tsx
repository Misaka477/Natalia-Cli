import { DialogSelect } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";

export function DialogAttachment(props: {
  paths(): string[];
  remove(path: string): void;
}) {
  const dialog = useDialog();
  return (
    <DialogSelect
      title="Attachments"
      options={props.paths().map((path) => ({
        title: path.split("/").at(-1) ?? path,
        value: path,
        description: path,
      }))}
      emptyView={<text>No queued attachments.</text>}
      actions={[
        {
          command: "prompt.attachment.remove",
          title: "Remove",
          onTrigger: (option) => {
            props.remove(option.value);
            if (props.paths().length === 1) dialog.pop();
          },
        },
      ]}
    />
  );
}
