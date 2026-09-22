import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync, realpathSync } from "node:fs";
import { cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { mkdirSync } from "node:fs";

/**
 * The life-preserving store's path layer (architecture decisions §1.6).
 *
 * The rescue ring may not be tied to the drowning pool: by default the
 * checkpoint/journal store lives OUTSIDE the workspace at
 * `~/.natalia/stores/<workspace-id>/` (0700), and a workspace-local store is
 * only an explicit opt-in (`checkpointDir`). The workspace id is a hash of
 * the canonical absolute path, so deleting the workspace and restoring it to
 * the same path reconnects the store automatically — disaster recovery never
 * depends on remembering an id.
 *
 * The canonicalization rule follows the roots lesson already recorded in the
 * sandbox work: the native realpath follows the component-by-component
 * lookup a spawn performs (the JS one lexically collapses `..` before a
 * preceding symlink), and a missing root stays as spelled — inventing a
 * fallback would grant a path the caller never named.
 */

/** Canonical absolute spelling of a workspace root (missing paths as-spelled). */
function canonicalRoot(workspaceRoot: string): string {
  try {
    return realpathSync.native(resolve(workspaceRoot));
  } catch {
    return resolve(workspaceRoot);
  }
}

/** The stable id for a workspace's store: sha256 of its canonical path. */
export function workspaceStoreID(workspaceRoot: string): string {
  return createHash("sha256")
    .update(canonicalRoot(workspaceRoot))
    .digest("hex");
}

/** `~/.natalia/stores/<id>` — the store root, outside the workspace. */
export function workspaceStoreRoot(
  workspaceRoot: string,
  home: string = homedir(),
): string {
  return join(home, ".natalia", "stores", workspaceStoreID(workspaceRoot));
}

/** The shared content-addressed object library for a workspace's store. */
export function workspaceObjectsRoot(
  workspaceRoot: string,
  home: string = homedir(),
): string {
  return join(workspaceStoreRoot(workspaceRoot, home), "objects");
}

/** The session tier root: per-session checkpoint/journal live beneath it. */
export function workspaceCheckpointSessionsRoot(
  workspaceRoot: string,
  home: string = homedir(),
): string {
  return join(workspaceStoreRoot(workspaceRoot, home), "sessions");
}

/** The default per-session checkpoint dir (§1.6's `sessions/<id>` level). */
export function defaultCheckpointStoreDir(
  workspaceRoot: string,
  sessionID: string,
  home: string = homedir(),
): string {
  const external = join(
    workspaceCheckpointSessionsRoot(workspaceRoot, home),
    sessionID,
  );
  const workspaceLocal = join(
    resolve(workspaceRoot),
    ".natalia",
    "checkpoints",
    sessionID,
  );
  // Offline consistency: a legacy session dir still on disk reads there
  // until the startup migration moves it; otherwise create the external
  // dir or degrade to workspace-local when the home is unwritable.
  if (existsSync(workspaceLocal) && !existsSync(external))
    return workspaceLocal;
  return externalDirOrLocal(external, workspaceLocal);
}

/** The shared per-session chunk library (kept outside storeDir's footprint). */
export function workspaceChunksRoot(
  workspaceRoot: string,
  home: string = homedir(),
): string {
  return join(workspaceStoreRoot(workspaceRoot, home), "chunks");
}

/**
 * Create a store directory with the §1.6 permissions (0700 — the store is a
 * safety facility, not a shared scratch area). Returns the path so callers
 * can chain.
 */

/**
 * The external-or-degrade rule: an unwritable home (read-only mounts,
 * restricted containers — and the harness's own /home) must not disable the
 * safety facility silently and must not kill the runtime either. Try to
 * create the external path; when the filesystem refuses, fall back to the
 * workspace-local path — the caller reports that degradation, so the state
 * "the rescue ring is tied to this workspace" is always visible.
 */
function externalDirOrLocal(external: string, workspaceLocal: string): string {
  try {
    mkdirSync(external, { recursive: true, mode: 0o700 });
    return external;
  } catch {
    return workspaceLocal;
  }
}

/**
 * The migration-aware object/chunk root: read the legacy workspace-local
 * directory while it still exists and nothing external has been created
 * (pre-migration), otherwise the external store. This one rule serves the
 * startup path (migration has run) and the offline path (it has not), and a
 * fresh workspace simply lands external. Import only `existsSync`-style state
 * through this function so no consumer re-invents the ordering.
 */
function externalIfLegacyMoved(
  workspaceRoot: string,
  external: string,
  legacy: string,
): string {
  const hasLegacy = existsSync(legacy);
  const hasExternal = existsSync(external);
  // Pre-migration: read the legacy dir without even creating the external
  // one — the startup migration moves it, offline readers find it here.
  if (hasLegacy && !hasExternal) return legacy;
  return externalDirOrLocal(external, legacy);
}

export function resolveWorkspaceObjectsRoot(
  workspaceRoot: string,
  home: string = homedir(),
): string {
  return externalIfLegacyMoved(
    workspaceRoot,
    workspaceObjectsRoot(workspaceRoot, home),
    join(resolve(workspaceRoot), ".natalia", "objects"),
  );
}

export function resolveWorkspaceChunksRoot(
  workspaceRoot: string,
  home: string = homedir(),
): string {
  return externalIfLegacyMoved(
    workspaceRoot,
    workspaceChunksRoot(workspaceRoot, home),
    join(resolve(workspaceRoot), ".natalia", "chunks"),
  );
}

export function resolveWorkspaceCheckpointSessionsRoot(
  workspaceRoot: string,
  home: string = homedir(),
): string {
  return externalIfLegacyMoved(
    workspaceRoot,
    workspaceCheckpointSessionsRoot(workspaceRoot, home),
    join(resolve(workspaceRoot), ".natalia", "checkpoints"),
  );
}

export async function ensureStoreDir(path: string): Promise<string> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  return path;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Move one legacy directory into the store without ever destroying content.
 *
 * Whole-directory `rename` when the target is free (atomic on one
 * filesystem); an existing target or an EXDEV boundary falls back to moving
 * entry-by-entry — every entry the target does not already have. An entry
 * the target HAS is left in place: store data is never overwritten with
 * possibly-older workspace data, and nothing is deleted unless it was
 * actually moved (the conservative rule, same reasoning as canonicalPath's).
 * Returns how many entries landed.
 */
async function moveLegacyEntries(from: string, to: string): Promise<number> {
  if (!(await isDirectory(from))) return 0;
  if (await isDirectory(to)) {
    let moved = 0;
    for (const entry of await readdir(from)) {
      const source = join(from, entry);
      const target = join(to, entry);
      // Any existing target — file OR directory — wins: rename would
      // silently replace a file, which is exactly the overwrite the rule
      // forbids.
      if (existsSync(target)) continue;
      try {
        await rename(source, target);
        moved += 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
        await cp(source, target, { recursive: true });
        await rm(source, { recursive: true, force: true });
        moved += 1;
      }
    }
    // Only retire the legacy dir once it is empty; a skipped conflict stays
    // visible for a human instead of being deleted.
    if ((await readdir(from)).length === 0) await rm(from, { recursive: true });
    return moved;
  }
  await ensureStoreDir(join(to, ".."));
  try {
    await rename(from, to);
    return 1;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    await cp(from, to, { recursive: true });
    await rm(from, { recursive: true, force: true });
    return 1;
  }
}

/**
 * Move a workspace's legacy in-workspace store (checkpoints / objects /
 * chunks) to the external store root. Idempotent: with no legacy left it is
 * a no-op, so it may run at every runtime start. Returns a count of what
 * moved, so the caller can record the event honestly.
 */
export async function migrateLegacyWorkspaceStore(
  workspaceRoot: string,
  home: string = homedir(),
): Promise<number> {
  const legacyBase = join(resolve(workspaceRoot), ".natalia");
  const storeRoot = workspaceStoreRoot(workspaceRoot, home);
  const mapping: Array<[string, string]> = [
    ["checkpoints", workspaceCheckpointSessionsRoot(workspaceRoot, home)],
    ["objects", workspaceObjectsRoot(workspaceRoot, home)],
    ["chunks", workspaceChunksRoot(workspaceRoot, home)],
  ];
  let moved = 0;
  await ensureStoreDir(storeRoot);
  for (const [name, target] of mapping) {
    moved += await moveLegacyEntries(join(legacyBase, name), target);
  }
  return moved;
}
