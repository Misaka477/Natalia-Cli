import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Safe, best-effort capture of the repository refs stamped onto an evidence
 * record (EI E2). Nothing here may leak a secret: the commit is accepted only
 * when it is a bare git object hash, the version is a build-injected
 * identifier, and the manifest ref is a content hash of the public model
 * catalog — never a path, token, or config value.
 */
export type RepositoryRefs = {
  repositoryVersion?: string;
  commit?: string;
  manifestRef?: string;
};

const GIT_HASH = /^[0-9a-f]{7,64}$/iu;

/** Captures the refs synchronously where possible; the manifest ref is async. */
export function captureRepositoryRefsSync(
  workspaceRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): RepositoryRefs {
  const refs: RepositoryRefs = {};
  const version = env.NATALIA_VERSION?.trim();
  if (version) refs.repositoryVersion = version;
  try {
    const result = Bun.spawnSync(
      ["git", "-C", workspaceRoot, "rev-parse", "HEAD"],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (result.success) {
      const commit = result.stdout.toString().trim();
      // Only a bare object hash is secret-safe; anything else is discarded.
      if (GIT_HASH.test(commit)) refs.commit = commit;
    }
  } catch {
    // A missing git binary or non-repo workspace must never fail evidence.
  }
  return refs;
}

/**
 * Stamps a safe manifest ref: a short content hash of the public model catalog,
 * so two evidence records recorded against different catalogs are
 * distinguishable without exposing the catalog path or contents.
 */
export async function captureManifestRef(
  workspaceRoot: string,
): Promise<string | undefined> {
  try {
    const content = await readFile(
      join(workspaceRoot, ".natalia", "models-dev-catalog.json"),
      "utf8",
    );
    return `models-dev-catalog:${Bun.hash(content).toString(16)}`;
  } catch {
    return undefined;
  }
}
