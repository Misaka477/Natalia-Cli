/**
 * The Advanced Sandbox foundation (P9): a worktree-based sandbox.
 *
 * The workspace-isolation manager copies a directory; this one gives a sandbox
 * real git semantics. A sandbox is a worktree at a candidate branch
 * (`candidate/<id>`), so the agent's changes are commits the host can diff,
 * preview and promote — and the system slot keeps a last-known-good commit to
 * roll back to. This is the mechanism the self-iteration vision (半自迭代)
 * requires: agent edits happen in the candidate worktree, a human approves the
 * preview, promotion lands them in the system branch atomically, and a failed
 * activation rolls back to last-known-good.
 *
 * The manager runs `git` in the host repo. It does not invent container/VM
 * isolation — that is a later, threat-model-driven step.
 */
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { SandboxDiffKind } from "@natalia/contracts";
import type { SandboxChange } from "./index";
import {
  requiresApproval,
  riskTierForChanges,
  type SandboxRiskTier,
} from "./governance";

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
async function git(
  cwd: string,
  args: string[],
  input?: string,
): Promise<string> {
  const process = Bun.spawn(["git", ...args], {
    cwd,
    stdin: input === undefined ? "ignore" : "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (input !== undefined && process.stdin) {
    process.stdin.write(input);
    process.stdin.end();
  }
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

export class WorktreeSandboxManager {
  private readonly sandboxRoot: string;
  private lastKnownGood: string | undefined;

  constructor(private readonly hostRoot: string) {
    this.sandboxRoot = resolve(hostRoot, ".natalia", "sandboxes");
  }

  /** The commit the host system branch is on. */
  async systemHead(): Promise<string> {
    return git(this.hostRoot, ["rev-parse", "HEAD"]);
  }

  /** Creates a sandbox as a worktree on a candidate branch off the system head. */
  async create(id: string) {
    const branch = `candidate/${id}`;
    const root = resolve(this.sandboxRoot, id);
    const base = await this.systemHead();
    await git(this.hostRoot, ["worktree", "add", "-b", branch, root, base]);
    return { id, root, base, branch };
  }

  async delete(id: string) {
    const branch = `candidate/${id}`;
    const root = resolve(this.sandboxRoot, id);
    await git(this.hostRoot, ["worktree", "remove", "--force", root]).catch(
      () => undefined,
    );
    await git(this.hostRoot, ["branch", "-D", branch]).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }

  /** The worktree root a sandbox's tools execute in. */
  target(id: string) {
    return {
      kind: "sandbox" as const,
      sandboxID: id,
      root: resolve(this.sandboxRoot, id),
    };
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
   * the preview a human approves before promotion.
   */
  async previewMerge(id: string): Promise<SandboxChange[]> {
    const base = await this.baseFor(id);
    const names = await git(this.hostRoot, [
      "diff",
      "--name-status",
      `${base}..candidate/${id}`,
    ]);
    const changes: SandboxChange[] = [];
    for (const line of names.split("\n").filter(Boolean)) {
      const [kind, path, oldPath] = line.split("\t");
      if (kind === "D") {
        changes.push({ kind: "delete" as SandboxDiffKind, path });
        continue;
      }
      if (kind === "R") {
        changes.push({ kind: "renamed" as SandboxDiffKind, path, oldPath });
        continue;
      }
      changes.push({
        kind: (kind === "M" ? "modify" : "add") as SandboxDiffKind,
        path,
      });
    }
    return changes;
  }

  /**
   * Promotes a candidate into the system slot. The changed paths are authorized
   * first (the human approval step of 半自迭代), then the candidate branch is
   * merged into the system branch. The commit before the merge is recorded as
   * last-known-good, so a failed activation can roll back.
   */
  async merge(
    id: string,
    _hostRoot?: string,
    authorize?: (paths: string[]) => Promise<void>,
  ): Promise<WorktreePromotion> {
    const branch = `candidate/${id}`;
    const base = await this.baseFor(id);
    const lastKnownGood = await this.systemHead();
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
    const promoted = await this.systemHead();
    this.lastKnownGood = lastKnownGood;
    return { sandboxID: id, base, promoted, lastKnownGood, changedFiles };
  }

  /**
   * Runs a validation command in the candidate worktree — the build evidence a
   * candidate must produce before promotion. The command runs in the worktree's
   * own directory, so it checks exactly the candidate's state.
   */
  async validate(
    id: string,
    command: string,
  ): Promise<{ ok: boolean; exitCode: number; output: string }> {
    const root = resolve(this.sandboxRoot, id);
    const process = Bun.spawn(["bash", "-c", command], {
      cwd: root,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    return { ok: exitCode === 0, exitCode, output: `${stdout}${stderr}` };
  }

  /**
   * Validates the candidate and, when it passes, promotes it. The build
   * evidence is part of the promotion contract: a candidate that does not
   * build must not reach the system slot, and the failing output is the reason.
   *
   * When `requireApprovalTier` is set, the candidate's change set is classified
   * into a governance risk tier and the authorization hook (the human approval
   * of 半自迭代) runs only when the candidate clears the gate — a low-risk
   * config edit promotes without a human in the loop, a contract change never
   * does.
   */
  async promoteWithValidation(
    id: string,
    input: {
      command: string;
      authorize?: (paths: string[]) => Promise<void>;
      requireApprovalTier?: SandboxRiskTier;
    },
  ): Promise<WorktreePromotion> {
    const evidence = await this.validate(id, input.command);
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
    return await this.merge(id, this.hostRoot, authorize);
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
