import type { RuntimeSkillCatalogEntry } from "@natalia/contracts";
import { DialogSelect } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";

export function buildSkillOptions(skills: RuntimeSkillCatalogEntry[]) {
  return skills.map((skill) => ({
    title: skill.name,
    value: skill.name,
    category: skill.source,
    description: skill.description.replace(/\s+/gu, " ").trim(),
    footer: skill.requireApproval
      ? "approval required"
      : skill.sandboxRequired
        ? "sandbox"
        : undefined,
  }));
}

export function DialogSkill(props: {
  skills: RuntimeSkillCatalogEntry[];
  select(name: string): void;
}) {
  const dialog = useDialog();
  return (
    <DialogSelect
      title="Skills"
      placeholder="Search skills"
      options={buildSkillOptions(props.skills)}
      emptyView={<text>No local, user, or remote skills discovered.</text>}
      onSelect={(option) => {
        props.select(option.value);
        dialog.pop();
      }}
    />
  );
}
