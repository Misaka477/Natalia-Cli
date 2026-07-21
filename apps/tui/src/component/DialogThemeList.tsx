import { DialogSelect } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";
import { onCleanup } from "solid-js";
import { useTheme } from "../context/theme";

export function DialogThemeList(props: { onCommit?: (name: string) => void } = {}) {
  const dialog = useDialog();
  const theme = useTheme();
  const initial = theme.theme.name;
  let confirmed = false;

  onCleanup(() => {
    if (!confirmed) theme.preview(initial);
  });

  const options = () => theme.themes.map((value) => ({
    title: value.name,
    value: value.name,
    description: value.name === initial ? "current" : undefined,
  }));

  return (
    <DialogSelect
      title="Themes"
      options={options()}
      current={initial}
      onMove={(option) => theme.preview(option.value)}
      onSelect={(opt) => {
        theme.commit(opt.value);
        confirmed = true;
        props.onCommit?.(opt.value);
        dialog.clear();
      }}
    />
  );
}
