import { parseBashCommandRule, type BashCommandRule } from "@natalia/client";

export type CommandRulePreview = {
  line: number;
  command: string;
  status: "accepted" | "duplicate" | "comment" | "empty" | "rejected";
  detail: string;
};

export type CommandRuleImport = {
  previews: CommandRulePreview[];
  rules: BashCommandRule[];
  rejected: boolean;
};

export async function previewCommandRuleImport(
  input: string,
  existing: BashCommandRule[] = [],
): Promise<CommandRuleImport> {
  const previews: CommandRulePreview[] = [];
  const rules: BashCommandRule[] = [];
  const seen = new Set(existing.map((rule) => rule.command));
  for (const [index, raw] of input.split(/\r?\n/gu).entries()) {
    const command = raw.trim();
    const line = index + 1;
    if (!command) {
      previews.push({ line, command, status: "empty", detail: "ignored" });
      continue;
    }
    if (command.startsWith("#")) {
      previews.push({ line, command, status: "comment", detail: "ignored" });
      continue;
    }
    if (seen.has(command)) {
      previews.push({ line, command, status: "duplicate", detail: "ignored" });
      continue;
    }
    seen.add(command);
    const parsed = await parseBashCommandRule({ command });
    if (!parsed.ok) {
      previews.push({
        line,
        command,
        status: "rejected",
        detail: parsed.reason,
      });
      continue;
    }
    rules.push({ command });
    previews.push({
      line,
      command,
      status: "accepted",
      detail: "will be saved",
    });
  }
  return {
    previews,
    rules,
    rejected: previews.some((preview) => preview.status === "rejected"),
  };
}
