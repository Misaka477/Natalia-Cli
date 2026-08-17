import { readdir } from "node:fs/promises";
import type { ConfigV3 } from "@natalia/contracts";
import {
  isKnownModuleTool,
  knownModuleTools,
  NataliaDocumentStore,
} from "@natalia/workflow";

export type PermissionProfileUsage = Record<string, string[]>;

/**
 * Which scheduled tasks depend on each permission profile.
 *
 * Reading task documents is enough here: a profile is referenced by name, and
 * this only needs to answer "would deleting this break a task", so it does not
 * open the durable execution stores. Unreadable documents are skipped; they are
 * already reported as broken by the task overview.
 */
export async function permissionProfileUsage(input: {
  workspaceRoot: string;
}): Promise<PermissionProfileUsage> {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  let entries: string[] = [];
  try {
    entries = (await readdir(documents.tasksDir)).filter((entry) =>
      /\.ya?ml$/iu.test(entry),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {};
  }
  const usage: PermissionProfileUsage = {};
  for (const entry of entries.sort()) {
    const task = await documents.loadTaskDocument(entry).catch(() => undefined);
    if (!task) continue;
    usage[task.permissionProfile] = [
      ...(usage[task.permissionProfile] ?? []),
      task.taskID,
    ];
  }
  return usage;
}

/**
 * A profile is the outer security boundary of every run that selects it, so
 * deleting one is refused whenever that would silently move a run onto a
 * different boundary: while a task still names it, while it is the default, or
 * when it is the last profile left.
 */
export function permissionProfileRemovalProblem(input: {
  config: ConfigV3;
  name: string;
  usage?: PermissionProfileUsage;
}): string | undefined {
  if (!input.config.permissionProfiles[input.name])
    return `permission profile not found: ${input.name}`;
  if (Object.keys(input.config.permissionProfiles).length <= 1)
    return "the last permission profile cannot be deleted";
  if (input.config.defaultPermission === input.name)
    return "this is the default profile; select another profile first";
  const tasks = input.usage?.[input.name] ?? [];
  if (tasks.length)
    return `still used by ${tasks.length} task${tasks.length === 1 ? "" : "s"}: ${tasks.join(", ")}`;
  return undefined;
}

export function configWithoutPermissionProfile(input: {
  config: ConfigV3;
  name: string;
  usage?: PermissionProfileUsage;
}): ConfigV3 {
  const problem = permissionProfileRemovalProblem(input);
  if (problem) throw new Error(problem);
  const profiles = { ...input.config.permissionProfiles };
  delete profiles[input.name];
  return { ...input.config, permissionProfiles: profiles };
}

export type ToolAllowListEdit = {
  tools: string[];
  rejected: Array<{ tool: string; reason: string }>;
};

export function grantablePermissionTools(): string[] {
  return knownModuleTools();
}

/**
 * Parses a pasted tool allow-list. Capability bundles decide which tool names
 * can ever be granted, so a name outside them is rejected here rather than
 * saved into a profile that would deny the tool at run time.
 */
export function parseToolAllowList(
  input: string,
  existing: string[] = [],
): ToolAllowListEdit {
  const rejected: Array<{ tool: string; reason: string }> = [];
  const tools = [...existing];
  // Comments are stripped per line before splitting: treating "#" as one token
  // would let the words after it be read as tool names.
  const named = input
    .split("\n")
    .map((line) => line.split("#")[0] ?? "")
    .flatMap((line) => line.split(/[\s,]+/u));
  for (const raw of named) {
    const tool = raw.trim();
    if (!tool) continue;
    if (!isKnownModuleTool(tool)) {
      rejected.push({
        tool,
        reason: "no capability bundle can grant this tool",
      });
      continue;
    }
    if (tools.includes(tool)) continue;
    tools.push(tool);
  }
  return { tools, rejected };
}
