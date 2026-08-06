import { createMemo, createSignal } from "solid-js";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";

const SAVE = "$save";
const SELECT_ALL = "$select-all";
const INVERT = "$invert";

export function selectAllTools(tools: string[]): Set<string> {
  return new Set(tools);
}

export function invertToolSelection(
  tools: string[],
  selected: ReadonlySet<string>,
): Set<string> {
  return new Set(tools.filter((tool) => !selected.has(tool)));
}

export function DialogToolMultiSelect(props: {
  title: string;
  tools: Array<{ name: string; description?: string }>;
  selected: string[];
  onSave(tools: string[]): void;
}) {
  const dialog = useDialog();
  const [selected, setSelected] = createSignal(new Set(props.selected));

  const options = createMemo<DialogSelectOption<string>[]>(() => [
    {
      title: `Save (${selected().size} selected)`,
      value: SAVE,
      description: "Apply this allow-list",
    },
    {
      title: "Select all",
      value: SELECT_ALL,
      description: `${props.tools.length} tools`,
    },
    {
      title: "Invert selection",
      value: INVERT,
      description: "Select unselected tools and clear selected tools",
    },
    ...props.tools.map((tool) => ({
      title: `${selected().has(tool.name) ? "[x]" : "[ ]"} ${tool.name}`,
      value: tool.name,
      description: tool.description,
      category: "Tools",
    })),
  ]);

  function toggle(value: string) {
    if (value.startsWith("$")) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function activate(option: DialogSelectOption<string>) {
    if (option.value === SAVE) {
      props.onSave(
        props.tools
          .map((tool) => tool.name)
          .filter((tool) => selected().has(tool)),
      );
      dialog.pop();
      return;
    }
    if (option.value === SELECT_ALL) {
      setSelected(selectAllTools(props.tools.map((tool) => tool.name)));
      return;
    }
    if (option.value === INVERT) {
      setSelected(
        invertToolSelection(
          props.tools.map((tool) => tool.name),
          selected(),
        ),
      );
      return;
    }
    toggle(option.value);
  }

  return (
    <DialogSelect
      title={props.title}
      renderFilter={false}
      preserveSelection
      options={options()}
      actions={[
        {
          command: "permission.tools.toggle",
          title: "toggle",
          disabled: (option) => !option || option.value.startsWith("$"),
          onTrigger: (option) => toggle(option.value),
        },
      ]}
      onSelect={activate}
    />
  );
}
