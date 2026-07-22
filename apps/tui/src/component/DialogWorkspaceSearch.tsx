import type { RuntimeWorkspaceMatch } from "@natalia/contracts";
import { createMemo } from "solid-js";
import { DialogSelect } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";

export function workspaceSearchOptions(matches: RuntimeWorkspaceMatch[]) {
  return matches.map((match) => ({
    title: `${match.path}:${match.line}`,
    value: match,
    description: match.text,
  }));
}

export function DialogWorkspaceSearch(props: {
  query: string;
  matches: RuntimeWorkspaceMatch[];
  select(match: RuntimeWorkspaceMatch): void;
}) {
  const dialog = useDialog();
  const options = createMemo(() => workspaceSearchOptions(props.matches));
  return (
    <DialogSelect
      title={`Search: ${props.query}`}
      renderFilter={false}
      options={options()}
      emptyView={<text>No workspace matches.</text>}
      onSelect={(option) => {
        props.select(option.value);
        dialog.pop();
      }}
    />
  );
}
