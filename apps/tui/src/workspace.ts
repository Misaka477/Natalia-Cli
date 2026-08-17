import { statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

export function resolveWorkspaceInput(value: string, currentRoot?: string) {
  const input = value.trim();
  const expanded =
    input === "~"
      ? homedir()
      : input.startsWith("~/")
        ? resolve(homedir(), input.slice(2))
        : input;
  return resolve(currentRoot ?? process.cwd(), expanded);
}

export function validateWorkspaceInput(value: string, currentRoot?: string) {
  if (!value.trim()) return "Enter a workspace path";
  try {
    if (!statSync(resolveWorkspaceInput(value, currentRoot)).isDirectory())
      return "Workspace path must be a directory";
  } catch {
    return "Workspace directory does not exist";
  }
}

export async function resolveTuiWorkspaceRoot(
  input: {
    cwd?: string;
    override?: string;
  } = {},
) {
  if (input.override) return resolve(input.override);
  let current = resolve(input.cwd ?? process.cwd());
  while (true) {
    if (await exists(resolve(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(input.cwd ?? process.cwd());
    current = parent;
  }
}

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
