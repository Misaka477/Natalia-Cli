import {
  findWorkspaceFiles,
  globWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
  writeWorkspaceFile,
} from "@natalia/platform";
import type { RuntimeServiceClient } from "@natalia/runtime-services";
import type { RuntimeGitRef, RuntimeWorkspaceDiffChange } from "@natalia/contracts";
import type { RuntimeContext } from "./context";

type WorkspaceRuntime = Pick<
  RuntimeServiceClient,
  | "workspaceFiles"
  | "workspaceSearch"
  | "workspaceList"
  | "workspaceRead"
  | "workspaceGlob"
  | "workspaceWrite"
  | "workspaceGitDiff"
  | "gitRefs"
>;

export function createWorkspaceRuntime(ctx: RuntimeContext): WorkspaceRuntime {
  return {
    async workspaceFiles(input) {
      await ctx.ports.getReady();
      return await findWorkspaceFiles({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
    async workspaceSearch(input) {
      await ctx.ports.getReady();
      return await searchWorkspaceFiles({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
    async workspaceList(input) {
      await ctx.ports.getReady();
      return await listWorkspaceFiles({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
    async workspaceRead(input) {
      await ctx.ports.getReady();
      return await readWorkspaceFile({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
    async workspaceGlob(input) {
      await ctx.ports.getReady();
      return await globWorkspaceFiles({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
    async workspaceWrite(input) {
      await ctx.ports.getReady();
      return await writeWorkspaceFile({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
    async workspaceGitDiff(input?: {
      from?: string;
      to?: string;
      path?: string;
    }) {
      await ctx.ports.getReady();
      return await collectWorkspaceGitDiff(ctx.ports.getWorkspaceRoot(), input);
    },
    async gitRefs() {
      await ctx.ports.getReady();
      const workspaceRoot = ctx.ports.getWorkspaceRoot();
      const [branches, tags, worktrees] = await Promise.all([
        gitCapture(workspaceRoot, ["branch", "--format=%(refname:short)"]),
        gitCapture(workspaceRoot, ["tag", "--list"]),
        gitCapture(workspaceRoot, ["worktree", "list", "--porcelain"]),
      ]);
      const refs: RuntimeGitRef[] = [];
      const seen = new Set<string>();
      const currentBranchRaw = await gitCapture(workspaceRoot, [
        "rev-parse",
        "--abbrev-ref",
        "HEAD",
      ]);
      const currentBranch = currentBranchRaw.stdout.trim();
      for (const name of branches.stdout.split("\n").map((line) => line.trim()).filter(Boolean)) {
        if (seen.has(name)) continue;
        seen.add(name);
        refs.push({
          name,
          kind: "branch",
          current: name === currentBranch,
        });
      }
      for (const name of tags.stdout.split("\n").map((line) => line.trim()).filter(Boolean)) {
        if (seen.has(name)) continue;
        seen.add(name);
        refs.push({ name, kind: "tag" });
      }
      for (const record of worktrees.stdout.split("\n\n")) {
        const pathLine = record.split("\n").find((line) => line.startsWith("worktree "));
        if (!pathLine) continue;
        const path = pathLine.slice("worktree ".length).trim();
        const branchLine = record
          .split("\n")
          .find((line) => line.startsWith("branch "));
        const name = branchLine
          ? branchLine.slice("branch ".length).replace("refs/heads/", "")
          : path;
        if (seen.has(name)) continue;
        seen.add(name);
        refs.push({
          name,
          kind: "worktree",
          path,
          current: path === workspaceRoot,
        });
      }
      return refs;
    },
  };
}

export async function collectWorkspaceGitDiff(
  workspaceRoot: string,
  input?: { from?: string; to?: string; path?: string },
): Promise<RuntimeWorkspaceDiffChange[]> {
  const from = input?.from ?? "HEAD";
  const to = input?.to ?? "WORKTREE";
  if (to === "WORKTREE") {
    const status = await gitCapture(workspaceRoot, [
      "status",
      "--porcelain=v1",
      "-uall",
    ]);
    if (status.exitCode !== 0) return [];
    const changes: RuntimeWorkspaceDiffChange[] = [];
    const lines = status.stdout.split("\n").filter(Boolean);
    for (const line of lines) {
      const parsed = parseStatusLine(line);
      if (!parsed) continue;
      if (input?.path && parsed.path !== input.path) continue;
      const path = parsed.path;
      const operation = parsed.operation;
      const oldPath = parsed.oldPath;
      let patch = "";
      try {
        patch =
          operation === "added" && parsed.untracked
            ? await gitDiffUntracked(workspaceRoot, path)
            : await gitDiffTracked(workspaceRoot, from, path, oldPath);
      } catch {
        patch = "";
      }
      const counts = countPatch(patch);
      changes.push({
        path,
        operation,
        ...(oldPath ? { oldPath } : {}),
        additions: counts.additions,
        deletions: counts.deletions,
        ...(patch ? { patch } : {}),
      });
    }
    return changes;
  }
  const rawDiff = await gitCapture(workspaceRoot, [
    "diff",
    "--unified=3",
    "--no-color",
    `${from}..${to}`,
    ...(input?.path ? ["--", input.path] : []),
  ]);
  if (rawDiff.exitCode !== 0 && !rawDiff.stdout.trim()) return [];
  return diffToChanges(rawDiff.stdout);
}

function unquoteGitPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
  try {
    return JSON.parse(trimmed) as string;
  } catch {
    return trimmed.slice(1, -1);
  }
}

export function parseStatusLine(line: string): {
  path: string;
  operation: "added" | "modified" | "deleted" | "renamed";
  oldPath?: string;
  untracked: boolean;
} | undefined {
  if (line.startsWith("?? ")) {
    return {
      path: unquoteGitPath(line.slice(3)),
      operation: "added",
      untracked: true,
    };
  }
  const code = line.slice(0, 2);
  const rest = line.slice(3);
  if (!rest) return undefined;
  const rename = rest.includes(" -> ");
  if (rename) {
    const [oldPath, path] = rest.split(" -> ");
    return {
      path: unquoteGitPath(path!),
      operation: "renamed",
      oldPath: unquoteGitPath(oldPath ?? ""),
      untracked: false,
    };
  }
  const operation = code.includes("D")
    ? "deleted"
    : code.includes("A") || code.includes("?")
      ? "added"
      : "modified";
  return { path: unquoteGitPath(rest), operation, untracked: false };
}

async function gitCapture(
  cwd: string,
  args: string[],
): Promise<{ stdout: string; exitCode: number }> {
  try {
    const process = Bun.spawn(["git", ...args], {
      cwd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(process.stdout).text();
    await new Response(process.stderr).text();
    const exitCode = await process.exited;
    return { stdout, exitCode };
  } catch {
    return { stdout: "", exitCode: 127 };
  }
}

async function gitDiffTracked(
  cwd: string,
  from: string,
  path: string,
  oldPath?: string,
): Promise<string> {
  const args = oldPath
    ? ["diff", "--unified=3", "--no-color", from, "--", oldPath, path]
    : ["diff", "--unified=3", "--no-color", from, "--", path];
  const result = await gitCapture(cwd, args);
  return result.stdout;
}

async function gitDiffUntracked(
  cwd: string,
  path: string,
): Promise<string> {
  const result = await gitCapture(cwd, [
    "diff",
    "--no-index",
    "--unified=3",
    "--no-color",
    "--",
    "/dev/null",
    path,
  ]);
  return result.exitCode === 0 || result.exitCode === 1 ? result.stdout : "";
}

function diffToChanges(rawDiff: string): RuntimeWorkspaceDiffChange[] {
  const changes: RuntimeWorkspaceDiffChange[] = [];
  const sections = rawDiff.split(/(?=^diff --git )/m);
  for (const section of sections) {
    if (!section.trim()) continue;
    const header = section.split("\n")[0] ?? "";
    const match = header.match(/^diff --git a\/(.+) b\/(.+)$/u);
    if (!match) continue;
    const path = match[2]!;
    const counts = countPatch(section);
    changes.push({
      path,
      operation: "modified",
      additions: counts.additions,
      deletions: counts.deletions,
      ...(section.trim() ? { patch: section.trimEnd() + "\n" } : {}),
    });
  }
  return changes;
}

function countPatch(patch: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }
  return { additions, deletions };
}
