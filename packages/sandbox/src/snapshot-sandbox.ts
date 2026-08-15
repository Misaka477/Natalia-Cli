/**
 * The git-free sandbox backend — the "类 git" layer.
 *
 * `WorktreeSandboxManager` needs git because worktrees are git concepts. This
 * backend gives every workspace the same candidate/promotion/rollback surface
 * without git: at create it captures a content-hash snapshot of the host (the
 * base), the candidate works in a copy, `previewMerge` diffs the real
 * candidate against the base by hash, and `merge` promotes the changed files
 * into the host with a last-known-good backup that `rollback` restores. Git,
 * when present, upgrades to the worktree backend's real commit history; here
 * the semantics are the same, the store is ours.
 */
import { resolve } from "node:path";
import {
  WorkspaceSandboxManager,
  type SandboxChange,
} from "./workspace-manager";
import { SnapshotStore } from "./snapshot-store";

export class SnapshotSandboxManager extends WorkspaceSandboxManager {
  private readonly hostRoot: string;
  private readonly store: SnapshotStore;

  constructor(hostRoot: string) {
    super(resolve(hostRoot, ".natalia", "sandboxes"));
    this.hostRoot = hostRoot;
    this.store = new SnapshotStore(resolve(hostRoot, ".natalia", "snapshots"));
  }

  /** Creates the isolated copy and captures the host's base state. */
  override async create(id: string) {
    const manifest = await super.create(id);
    // The base is the host's file state at create time; the sandbox's own
    // machinery (under `.natalia`) is excluded from the index.
    const base = await this.store.capture(
      this.hostRoot,
      (rel) => rel === ".natalia" || rel.startsWith(".natalia/"),
    );
    await this.store.saveIndex(id, base);
    return manifest;
  }

  /** The candidate's real changes against the base, by content hash. */
  override async previewMerge(id: string): Promise<SandboxChange[]> {
    const base = await this.store.loadIndex(id);
    if (!base) return await super.previewMerge(id);
    return await this.store.diff(this.candidateRoot(id), base);
  }

  /**
   * Promotes the candidate's changes into the host with a last-known-good
   * backup. Base-compatible return: the changed files.
   */
  override async merge(
    id: string,
    _hostRoot?: string,
    authorize?: (paths: string[]) => Promise<void>,
  ): Promise<SandboxChange[]> {
    const base = await this.store.loadIndex(id);
    if (!base) return await super.merge(id, this.hostRoot, authorize);
    const changes = await this.store.diff(this.candidateRoot(id), base);
    if (!changes.length)
      throw new Error(`candidate ${id} has no changes to promote`);
    await this.store.promote(
      id,
      this.candidateRoot(id),
      this.hostRoot,
      changes,
      authorize,
    );
    return changes;
  }

  /** Restores the host to the last-known-good state of the last promote. */
  async rollback(id: string): Promise<{ restored: boolean }> {
    return { restored: await this.store.rollback(this.hostRoot, id) };
  }

  /** Whether a last-known-good exists for the sandbox. */
  async hasLastKnownGood(id: string): Promise<boolean> {
    return this.store.hasLastKnownGood(id);
  }

  private candidateRoot(id: string): string {
    return resolve(this["baseRoot"], id);
  }
}
