import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type MigrationDiagnosticLevel = "info" | "warning" | "error";

export type MigrationDiagnostic = {
  level: MigrationDiagnosticLevel;
  code: string;
  message: string;
  path?: string;
  supported: boolean;
};

export type LegacyWorkspaceMigrationReceipt = {
  id: string;
  bundlePath: string;
  targetRoot?: string;
  artifactCount: number;
  appliedAt: string;
};

export type VersionedMigrationStep<T> = {
  id: string;
  fromVersion: number | "legacy";
  toVersion: number;
  apply(input: T): Promise<T> | T;
};

export type VersionedMigrationResult<T> = {
  value: T;
  fromVersion: number | "legacy";
  toVersion: number;
  applied: string[];
  diagnostics: MigrationDiagnostic[];
};

export class VersionedMigrationRegistry<T> {
  private steps: VersionedMigrationStep<T>[] = [];

  constructor(private readonly currentVersion: number) {}

  register(step: VersionedMigrationStep<T>) {
    if (this.steps.some((item) => item.id === step.id))
      throw new Error(`duplicate migration step: ${step.id}`);
    this.steps.push(step);
  }

  async migrate(input: {
    value: T;
    fromVersion: number | "legacy";
    diagnostics?: MigrationDiagnostic[];
  }): Promise<VersionedMigrationResult<T>> {
    let value = input.value;
    let version = input.fromVersion;
    const applied: string[] = [];
    while (version !== this.currentVersion) {
      const step = this.steps.find((item) => item.fromVersion === version);
      if (!step)
        return {
          value,
          fromVersion: input.fromVersion,
          toVersion: this.currentVersion,
          applied,
          diagnostics: [
            ...(input.diagnostics ?? []),
            {
              level: "error",
              code: "migration.unsupported_version",
              message: `No TS migration step from ${version} to ${this.currentVersion}`,
              supported: false,
            },
          ],
        };
      value = await step.apply(value);
      applied.push(step.id);
      version = step.toVersion;
    }
    return {
      value,
      fromVersion: input.fromVersion,
      toVersion: this.currentVersion,
      applied,
      diagnostics: input.diagnostics ?? [],
    };
  }
}

export async function diagnoseLegacyGoWorkspace(root: string) {
  const diagnostics: MigrationDiagnostic[] = [];
  await diagnosePath(diagnostics, root, "config.yaml", {
    code: "legacy.config_yaml",
    message: "legacy config.yaml can be migrated to Config v2",
    supported: true,
  });
  await diagnosePath(diagnostics, root, "sessions", {
    code: "legacy.sessions",
    message:
      "legacy session meta/context import is supported; state/wire remain diagnostic-only",
    supported: true,
  });
  await diagnosePath(diagnostics, root, "checkpoints", {
    code: "legacy.checkpoints_manifest",
    message:
      "legacy Go checkpoint artifacts can be exported into a TS migration bundle for audit; direct replay remains unsupported",
    supported: true,
    level: "warning",
  });
  await diagnosePath(diagnostics, root, "skills", {
    code: "legacy.skills_partial",
    message:
      "legacy skills can be copied into a TS migration bundle and validated as native SKILL.md before activation",
    supported: true,
    level: "warning",
  });
  await diagnosePath(diagnostics, root, "workflows", {
    code: "legacy.workflows_bundle",
    message:
      "legacy workflow files can be exported into a TS migration bundle for parser validation",
    supported: true,
    level: "warning",
  });
  return diagnostics;
}

export async function exportLegacyGoWorkspaceBundle(input: {
  legacyRoot: string;
  outputPath: string;
}) {
  const diagnostics = await diagnoseLegacyGoWorkspace(input.legacyRoot);
  const bundle = {
    format: "natalia-ts7-legacy-workspace-bundle",
    version: 1,
    exportedAt: new Date().toISOString(),
    legacyRoot: resolve(input.legacyRoot),
    diagnostics,
    artifacts: await listArtifacts(input.legacyRoot, [
      "config.yaml",
      "sessions",
      "checkpoints",
      "skills",
      "workflows",
    ]),
  };
  await mkdir(dirname(resolve(input.outputPath)), { recursive: true });
  await writeFile(input.outputPath, `${JSON.stringify(bundle, null, 2)}\n`, {
    mode: 0o600,
  });
  return bundle;
}

export async function importLegacyGoWorkspaceBundle(input: {
  bundlePath: string;
  targetRoot?: string;
}) {
  const bundle = JSON.parse(await readFile(input.bundlePath, "utf8")) as {
    format?: string;
    version?: number;
    artifacts?: unknown[];
  };
  if (bundle.format !== "natalia-ts7-legacy-workspace-bundle")
    throw new Error("unsupported legacy workspace bundle format");
  if (bundle.version !== 1)
    throw new Error(
      `unsupported legacy workspace bundle version: ${bundle.version}`,
    );
  const resolvedBundlePath = resolve(input.bundlePath);
  const targetRoot = input.targetRoot ? resolve(input.targetRoot) : undefined;
  const receiptPath = targetRoot
    ? resolve(targetRoot, ".natalia", "migration-receipt.json")
    : undefined;
  if (receiptPath) {
    try {
      const prior = JSON.parse(
        await readFile(receiptPath, "utf8"),
      ) as LegacyWorkspaceMigrationReceipt;
      if (prior.bundlePath === resolvedBundlePath)
        return {
          receipt: prior,
          artifactCount: Array.isArray(bundle.artifacts)
            ? bundle.artifacts.length
            : 0,
          alreadyApplied: true,
          diagnostics: [
            {
              level: "info" as const,
              code: "legacy.bundle.already_applied",
              message:
                "the same legacy audit bundle is already recorded for this TS target; no files were changed",
              supported: true,
            },
          ],
        };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const receipt = {
    id: `mig_${Date.now().toString(36)}`,
    bundlePath: resolvedBundlePath,
    targetRoot,
    artifactCount: Array.isArray(bundle.artifacts)
      ? bundle.artifacts.length
      : 0,
    appliedAt: new Date().toISOString(),
  };
  if (receiptPath) {
    await mkdir(dirname(receiptPath), { recursive: true, mode: 0o700 });
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      mode: 0o600,
    });
  }
  return {
    receipt,
    artifactCount: Array.isArray(bundle.artifacts)
      ? bundle.artifacts.length
      : 0,
    diagnostics: [
      {
        level: "info" as const,
        code: "legacy.bundle.audit_only",
        message:
          "bundle import completed as audit metadata; activation still runs through native TS config/session/skill/workflow validators",
        supported: true,
      },
    ],
  };
}

export async function rollbackLegacyGoWorkspaceBundle(input: {
  targetRoot: string;
}) {
  const receiptPath = resolve(
    input.targetRoot,
    ".natalia",
    "migration-receipt.json",
  );
  try {
    const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as {
      id?: string;
    };
    await rm(receiptPath, { force: true });
    return {
      rolledBack: true,
      receiptID: receipt.id,
      diagnostics: [
        {
          level: "info" as const,
          code: "legacy.bundle.rollback_receipt_removed",
          message:
            "TS migration receipt removed; legacy Go files were not modified by the audit import",
          supported: true,
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return {
        rolledBack: false,
        diagnostics: [
          {
            level: "warning" as const,
            code: "legacy.bundle.rollback_missing_receipt",
            message: "no TS migration receipt found to roll back",
            supported: true,
          },
        ],
      };
    throw error;
  }
}

async function diagnosePath(
  diagnostics: MigrationDiagnostic[],
  root: string,
  relativePath: string,
  input: Omit<MigrationDiagnostic, "path" | "level"> & {
    level?: MigrationDiagnosticLevel;
  },
) {
  const path = resolve(root, relativePath);
  if (!(await exists(path))) return;
  diagnostics.push({
    level: input.level ?? "info",
    code: input.code,
    message: input.message,
    path,
    supported: input.supported,
  });
}

async function exists(path: string) {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EISDIR") {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  try {
    await readdir(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function listArtifacts(root: string, names: string[]) {
  const artifacts: Array<{ path: string; kind: "file" | "directory" }> = [];
  for (const name of names) {
    const path = resolve(root, name);
    try {
      const entries = await readdir(path);
      artifacts.push({ path: name, kind: "directory" });
      for (const entry of entries.slice(0, 200))
        artifacts.push({ path: join(name, entry), kind: "file" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOTDIR")
        artifacts.push({ path: name, kind: "file" });
      else if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return artifacts;
}
