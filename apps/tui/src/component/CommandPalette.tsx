import { createMemo } from "solid-js";
import { useKeymap, useKeymapSelector } from "@opentui/keymap/solid";
import { stringifyKeySequence } from "@opentui/keymap";
import { commands } from "../keymap";
import { getPluginCommands } from "@natalia/plugin";
import { useDialog, type DialogContext } from "../dialog/provider";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";

export function CommandPalette(props: { onRun(command: string): void }) {
  const dialog = useDialog();
  const keymap = useKeymap();
  const definitions = commands;
  const entries = useKeymapSelector((current) => {
    const commands_ = current.getCommandEntries({
      namespace: "palette",
      visibility: "registered",
      filter: (command) =>
        command.name !== "palette.toggle" && !definitions[command.name]?.scope,
    });
    const bindings = current.getCommandBindings({
      commands: commands_.map((entry) => entry.command.name),
      visibility: "registered",
    });
    return commands_.map((entry) => ({
      entry,
      bindings: bindings.get(entry.command.name) ?? entry.bindings,
    }));
  });

  const options = createMemo(
    () =>
      [
        ...entries().map(({ entry, bindings }) => ({
          title:
            typeof entry.command.title === "string"
              ? entry.command.title
              : entry.command.name,
          description:
            typeof entry.command.desc === "string"
              ? entry.command.desc
              : undefined,
          value: entry.command.name,
          category:
            typeof entry.command.category === "string"
              ? entry.command.category
              : undefined,
          footer: bindings
            .map((binding) =>
              stringifyKeySequence(binding.sequence, {
                preferDisplay: true,
              }),
            )
            .join(" / "),
          onSelect: (dialog: DialogContext) => {
            dialog.clear();
            props.onRun(entry.command.name);
          },
        })),
        {
          title: "Runtime diagnostics",
          description: "View and copy runtime diagnostics",
          value: "diagnostics",
          category: "runtime",
          onSelect: (dialog: DialogContext) => {
            dialog.clear();
            props.onRun("diagnostics");
          },
        },
        ...getPluginCommands().map((cmd) => ({
          title: cmd.title,
          description: cmd.category ? `plugin · ${cmd.category}` : "plugin",
          value: cmd.name,
          category: cmd.category ?? "plugin",
          onSelect: (dialog: DialogContext) => {
            dialog.clear();
            cmd.run();
          },
        })),
      ] as DialogSelectOption<string>[],
  );

  return <DialogSelect title="Commands" options={options()} />;
}
