/**
 * The git-free sandbox backend — the "类 git" layer.
 *
 * `WorktreeSandboxManager` needs git because worktrees are git concepts. This
 * backend gives every workspace the same candidate/promotion/rollback surface
 * without git: at create it captures a content-addressed snapshot of the host
 * and checks it out into the candidate worktree, `previewMerge` diffs the real
 * candidate against the base by content hash, and `merge` promotes the changed
 * files into the host with a last-known-good backup that `rollback` restores.
 * Git, when present, upgrades to the worktree backend's real commit history;
 * here the semantics are the same, the store is ours.
 */
import { resolve } from "node:path";
import {
  WorkspaceSandboxManager,
  type SandboxChange,
} from "./workspace-manager";
import { ObjectStore } from "@natalia/object-store";
import { SnapshotStore, type SnapshotIndex } from "./snapshot-store";

/** Paths under a candidate that must never count as a change. */
const IGNORED_IN_CANDIDATE = (rel: string) =>
  rel === ".git" ||
  rel.startsWith(".git/") ||
  rel === ".natalia" ||
  rel.startsWith(".natalia/") ||
  rel === ".natalia-manifest.json";

export class SnapshotSandboxManager extends WorkspaceSandboxManager {
  private readonly hostRoot: string;
  private readonly store: SnapshotStore;

  constructor(hostRoot: string) {
    super(resolve(hostRoot, ".natalia", "sandboxes"));
    this.hostRoot = hostRoot;
    this.store = new SnapshotStore(
      new ObjectStore(resolve(hostRoot, ".natalia", "objects")),
      resolve(hostRoot, ".natalia", "snapshots"),
    );
  }

  /**
   * Creates the isolated worktree, captures the host as its base, then checks
   * that base out into the candidate. The candidate index records the checkout
   * metadata so later diffs can reuse unchanged objects by size/mtime.
   */
  override async create(id: string) {
    const manifest = await super.create(id);
    const base = await this.store.capture(
      this.hostRoot,
      undefined,
      IGNORED_IN_CANDIDATE,
    );
    await this.store.saveIndex(id, base);
    const candidate = await this.store.materialize(manifest.root, base);
    await this.store.saveCandidateIndex(id, candidate);
    return manifest;
  }

  /** The candidate's real changes against the base, by content hash. */
  override async previewMerge(id: string): Promise<SandboxChange[]> {
    const base = await this.store.loadIndex(id);
    if (!base) return await super.previewMerge(id);
    const candidateIndex = await this.captureCandidate(id);
    // Persist the candidate index so the live worktree's objects count as
    // referenced for the shared library's GC — a reviewed-but-unmerged
    // candidate is still an owner.
    await this.store.saveCandidateIndex(id, candidateIndex);
    return await this.store.diff(this.candidateRoot(id), base, candidateIndex);
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
    const candidateIndex = await this.captureCandidate(id);
    const changes = await this.store.diff(
      this.candidateRoot(id),
      base,
      candidateIndex,
    );
    if (!changes.length)
      throw new Error(`candidate ${id} has no changes to promote`);
    await this.store.promote(
      id,
      this.candidateRoot(id),
      this.hostRoot,
      changes,
      authorize,
    );
    await this.store.saveCandidateIndex(id, candidateIndex);
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

  /**
   * Every object id this manager's snapshot indices reference — for the shared
   * object library's GC, so checkpoint's gc can never prune a live sandbox
   * object.
   */
  async referencedObjectIDs(): Promise<Set<string>> {
    return await this.store.referencedObjectIDs();
  }

  /** The candidate's current index, reusing the previous one by size/mtime. */
  private async captureCandidate(id: string): Promise<SnapshotIndex> {
    return await this.store.capture(
      this.candidateRoot(id),
      await this.store.loadCandidateIndex(id),
      IGNORED_IN_CANDIDATE,
    );
  }

  private candidateRoot(id: string): string {
    return resolve(this["baseRoot"], id);
  }
}
