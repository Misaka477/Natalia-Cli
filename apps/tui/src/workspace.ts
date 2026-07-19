import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

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
