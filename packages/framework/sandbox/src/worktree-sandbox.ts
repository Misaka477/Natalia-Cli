/**
 * The Advanced Sandbox production backend (P9): a worktree-based sandbox.
 *
 * This manager extends `WorkspaceSandboxManager`, so it is a drop-in for the
 * full operational surface the sandbox tools use (execute, resources, file
 * ops, persistence) — and adds real git semantics on top: a sandbox is a
 * worktree on a candidate branch (`candidate/<id>`) off the system head, so
 * the agent's changes are commits the host can diff, preview and promote, and
 * the system slot keeps a last-known-good commit to roll back to. That is the
 * mechanism 半自迭代 requires: agent edits in the candidate worktree, a human
 * approves the preview, promotion lands them in the system branch atomically,
 * and a failed activation rolls back to last-known-good.
 *
 * The manager runs `git` in the host repo. Workspaces that are not git repos
 * fall back to the directory-copy manager; container/VM isolation is a later,
 * threat-model-driven step.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ensureNataliaIgnoreFile,
  isSnapshotIgnored,
  loadNataliaIgnore,
  NATALIA_IGNORE_FILE,
  type SnapshotIgnoreRule,
} from "@natalia/platform";
import type { SandboxDiffKind } from "@natalia/contracts";
import {
  WorkspaceSandboxManager,
  type SandboxChange,
} from "./workspace-manager";
import {
  requiresApproval,
  riskTierForChanges,
  type SandboxRiskTier,
} from "./governance";
import { unifiedPatchToStructured } from "./diff";

export type WorktreePromotion = {
  sandboxID: string;
  /** The system-slot commit the candidate was merged onto. */
  base: string;
  /** The commit the promotion produced. */
  promoted: string;
  /** The commit that was last-known-good before the promotion. */
  lastKnownGood: string;
  changedFiles: SandboxChange[];
};

/** Runs `git` and returns stdout trimmed; throws with stderr on failure. */
async function git(cwd: string, args: string[]): Promise<string> {
  const process = Bun.spawn(["git", ...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0)
    throw new Error(
      `git ${args.join(" ")} failed: ${stderr.trim() || stdout.trim()}`,
    );
  return stdout.trim();
}

/** Like `git`, but returns the raw output untrimmed (for `-z` porcelain). */
async function gitRaw(cwd: string, args: string[]): Promise<string> {
  const process = Bun.spawn(["git", ...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0)
    throw new Error(
      `git ${args.join(" ")} failed: ${stderr.trim() || stdout.trim()}`,
    );
  return stdout;
}

function extractPatchForPath(
  rawDiff: string,
  path: string,
): string | undefined {
  const sections = rawDiff.split(/(?=^diff --git )/m);
  for (const section of sections) {
    if (section.includes(`b/${path}`) || section.includes(`a/${path}`))
      return section.trimEnd() + "\n";
  }
  return undefined;
}

function patchCounts(patch: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }
  return { additions, deletions };
}

export class WorktreeSandboxManager extends WorkspaceSandboxManager {
  private lastKnownGood: string | undefined;
  private readonly hostRoot: string;

  constructor(hostRoot: string) {
    super(resolve(hostRoot, ".natalia", "sandboxes"));
    this.hostRoot = hostRoot;
  }

  /** The commit the host system branch is on. */
  async systemHead(): Promise<string> {
    return git(this.hostRoot, ["rev-parse", "HEAD"]);
  }

  /** The name of the host system branch. */
  async systemBranch(): Promise<string> {
    return git(this.hostRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  }

  private async snapshotIgnoreRules(): Promise<readonly SnapshotIgnoreRule[]> {
    await ensureNataliaIgnoreFile(this.hostRoot);
    return (await loadNataliaIgnore(this.hostRoot)).rules;
  }

  private isInternalCandidatePath(rel: string): boolean {
    return (
      rel === NATALIA_IGNORE_FILE ||
      rel === ".gitignore" ||
      rel === ".natalia-manifest.json" ||
      rel === ".git" ||
      rel.startsWith(".git/") ||
      rel === ".natalia" ||
      rel.startsWith(".natalia/")
    );
  }

  /**
   * Git normally hides ignored untracked files from `status`. The sandbox's
   * ignore contract is .nataliaignore, not .gitignore, so forced-add every
   * changed path that .nataliaignore did not exclude.
   */
  private async commitPendingChanges(id: string): Promise<void> {
    const root = resolve(this["baseRoot"], id);
    const rules = await this.snapshotIgnoreRules();
    const paths = new Set<string>();
    const status = await gitRaw(root, [
      "status",
      "--porcelain",
      "-z",
      "--untracked-files=all",
      "--",
      ".",
      ":(exclude).gitignore",
      ":(exclude).natalia-manifest.json",
    ]).catch(() => "");
    for (const record of status.split("\0").filter(Boolean)) {
      const path = record.slice(3);
      if (path) paths.add(path);
    }
    const ignored = await gitRaw(root, [
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "-z",
      "--",
      ".",
      ":(exclude).gitignore",
      ":(exclude).natalia-manifest.json",
    ]).catch(() => "");
    for (const path of ignored.split("\0").filter(Boolean)) paths.add(path);
    const changed = [...paths].filter(
      (path) =>
        path &&
        !this.isInternalCandidatePath(path) &&
        !isSnapshotIgnored(path, false, rules),
    );
    if (!changed.length) return;
    await git(root, ["add", "-f", "--", ...changed]);
    await git(root, ["commit", "-m", `sandbox ${id} changes`]);
  }

  /** Creates a sandbox as a worktree on a candidate branch off the system head. */
  override async create(id: string) {
    const branch = `candidate/${id}`;
    const root = resolve(this["baseRoot"], id);
    const base = await this.systemHead();
    await git(this.hostRoot, ["worktree", "add", "-b", branch, root, base]);
    // The manifest record must never enter a candidate diff, even when the
    // agent runs `git add .` in the worktree.
    await writeFile(resolve(root, ".gitignore"), ".natalia-manifest.json\n", {
      flag: "a",
    });
    // The base records the manifest (resources, env allowlist, changed files)
    // at the worktree root; the record is ignored, so it never enters a diff.
    return await super.create(id);
  }

  override async delete(id: string) {
    const branch = `candidate/${id}`;
    const root = resolve(this["baseRoot"], id);
    await git(this.hostRoot, ["worktree", "remove", "--force", root]).catch(
      () => undefined,
    );
    await git(this.hostRoot, ["branch", "-D", branch]).catch(() => undefined);
    return await super.delete(id);
  }

  /** Whether a candidate branch exists for the sandbox. */
  async exists(id: string): Promise<boolean> {
    try {
      await git(this.hostRoot, ["rev-parse", "--verify", `candidate/${id}`]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * The changes the candidate made against its base, as a diff summary. This is
   * the preview a human approves before promotion — the real worktree diff, not
   * the manifest's change list.
   */
  override async previewMerge(id: string): Promise<SandboxChange[]> {
    const base = await this.baseFor(id);
    const root = resolve(this["baseRoot"], id);
    await this.commitPendingChanges(id);
    const names = await git(root, ["diff", "--name-status", base]);
    const rawDiff = await gitRaw(root, [
      "diff",
      "--unified=3",
      "--no-color",
      base,
    ]).catch(() => "");
    const changes: SandboxChange[] = [];
    const readBase = async (path: string): Promise<string | undefined> => {
      try {
        return await gitRaw(root, ["show", `${base}:${path}`]);
      } catch {
        return undefined;
      }
    };
    const readWorktree = async (path: string): Promise<string | undefined> => {
      try {
        return await readFile(resolve(root, path), "utf8");
      } catch {
        return undefined;
      }
    };
    for (const line of names.split("\n").filter(Boolean)) {
      const [kind, path, oldPath] = line.split("\t");
      const patch = extractPatchForPath(rawDiff, path);
      if (kind === "D") {
        const before = await readBase(path);
        changes.push({
          kind: "delete" as SandboxDiffKind,
          path,
          ...(before ? { before } : {}),
          ...(patch ? { patch } : {}),
          ...(patch ? { structured: unifiedPatchToStructured(patch) } : {}),
          ...patchCounts(patch ?? ""),
        });
        continue;
      }
      if (kind === "R") {
        const before = oldPath ? await readBase(oldPath) : await readBase(path);
        const after = await readWorktree(path);
        changes.push({
          kind: "rename" as SandboxDiffKind,
          path,
          oldPath,
          ...(before ? { before } : {}),
          ...(after ? { after } : {}),
          ...(patch ? { patch } : {}),
          ...(patch ? { structured: unifiedPatchToStructured(patch) } : {}),
          ...patchCounts(patch ?? ""),
        });
        continue;
      }
      const before = kind === "A" ? undefined : await readBase(path);
      const after = await readWorktree(path);
      changes.push({
        kind: (kind === "M" ? "modify" : "add") as SandboxDiffKind,
        path,
        ...(before ? { before } : {}),
        ...(after ? { after } : {}),
        ...(patch ? { patch } : {}),
        ...(patch ? { structured: unifiedPatchToStructured(patch) } : {}),
        ...patchCounts(patch ?? ""),
      });
    }
    return changes;
  }

  /**
   * Promotes a candidate into the system slot: the candidate branch is merged
   * into the system branch after the changed paths are authorized. The commit
   * before the merge is recorded as last-known-good, so a failed activation can
   * roll back. Base-compatible return: the changed files, as the copy-based
   * merge reports them.
   */
  override async merge(
    id: string,
    _hostRoot?: string,
    authorize?: (paths: string[]) => Promise<void>,
  ): Promise<SandboxChange[]> {
    const branch = `candidate/${id}`;
    const root = resolve(this["baseRoot"], id);
    const base = await this.baseFor(id);
    const lastKnownGood = await this.systemHead();
    // Promotion works on commits. Commit pending worktree changes first,
    // forcing in files .gitignore hides but .nataliaignore allows.
    await this.commitPendingChanges(id);
    const ahead = await git(this.hostRoot, [
      "rev-list",
      "--count",
      `${base}..${branch}`,
    ]);
    if (Number(ahead) === 0)
      throw new Error(`candidate ${id} has no changes to promote`);
    const changedFiles = await this.previewMerge(id);
    const paths = changedFiles.map((change) => change.path);
    if (paths.length) await authorize?.(paths);
    await git(this.hostRoot, ["merge", "--no-ff", "--no-edit", branch]);
    this.lastKnownGood = lastKnownGood;
    return changedFiles;
  }

  /** Promotes and reports the full promotion record, including the commits. */
  async promote(
    id: string,
    authorize?: (paths: string[]) => Promise<void>,
  ): Promise<WorktreePromotion> {
    const base = await this.baseFor(id);
    const lastKnownGood = await this.systemHead();
    const changedFiles = await this.merge(id, this.hostRoot, authorize);
    return {
      sandboxID: id,
      base,
      promoted: await this.systemHead(),
      lastKnownGood,
      changedFiles,
    };
  }

  /**
   * Validates the candidate and, when it passes, promotes it. When
   * `requireApprovalTier` is set, the human-approval hook runs only when the
   * candidate's governance risk tier clears the gate.
   */
  override async promoteWithValidation(
    id: string,
    input: {
      command: string;
      authorize?: (paths: string[]) => Promise<void>;
      requireApprovalTier?: SandboxRiskTier;
      hostRoot?: string;
    },
  ): Promise<WorktreePromotion> {
    const command = input.command.trim();
    if (!command) throw new Error("sandbox promote command must not be empty");
    const evidence = await this.validate(id, command);
    if (!evidence.ok)
      throw new Error(
        `candidate ${id} failed validation (exit ${evidence.exitCode}):\n${evidence.output.slice(0, 2000)}`,
      );
    const authorize =
      input.authorize && input.requireApprovalTier
        ? async (paths: string[]) => {
            const tier = riskTierForChanges(await this.previewMerge(id));
            if (requiresApproval(tier, input.requireApprovalTier!))
              await input.authorize!(paths);
          }
        : input.authorize;
    return await this.promote(id, authorize);
  }

  /** The recorded last-known-good commit, if any. */
  async lastKnownGoodCommit(): Promise<string | undefined> {
    return this.lastKnownGood;
  }

  /**
   * Rolls the system slot back to the last-known-good commit — the rollback a
   * failed activation after promotion triggers.
   */
  async rollback(): Promise<{ restored: string | undefined }> {
    if (!this.lastKnownGood) return { restored: undefined };
    await git(this.hostRoot, ["reset", "--hard", this.lastKnownGood]);
    return { restored: this.lastKnownGood };
  }

  private async baseFor(id: string): Promise<string> {
    return git(this.hostRoot, ["merge-base", `candidate/${id}`, "HEAD"]);
  }
}
