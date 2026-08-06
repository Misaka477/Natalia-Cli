import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseNataliaDocumentYAML } from "@natalia/workflow";

const EXAMPLE_FLOWS = [
  "code-quality.yaml",
  "log-triage.yaml",
  "release-notes.yaml",
];
const EXAMPLE_TASKS = [
  "nightly-code-quality.yaml",
  "nightly-log-triage.yaml",
  "release-notes.yaml",
];

export type ExampleDocumentInstallResult = {
  installed: string[];
  alreadyInstalled: string[];
};

export async function installExampleDocuments(input: {
  workspaceRoot: string;
  includeTasks?: boolean;
}): Promise<ExampleDocumentInstallResult> {
  const examplesRoot = join(
    import.meta.dir,
    "..",
    "..",
    "..",
    "deploy",
    "examples",
  );
  const requested = [
    ...EXAMPLE_FLOWS.map((name) => ({ kind: "flows", name })),
    ...(input.includeTasks
      ? EXAMPLE_TASKS.map((name) => ({ kind: "tasks", name }))
      : []),
  ];
  const documents = await Promise.all(
    requested.map(async ({ kind, name }) => {
      const sourcePath = join(examplesRoot, kind, name);
      const source = await readFile(sourcePath, "utf8");
      const document = parseNataliaDocumentYAML(source);
      if (
        (kind === "flows" && document.kind !== "natalia-flow") ||
        (kind === "tasks" && document.kind !== "natalia-task")
      )
        throw new Error(`example ${kind}/${name} has the wrong document kind`);
      return {
        source,
        relativePath: `.natalia/${kind}/${name}`,
        target: join(input.workspaceRoot, ".natalia", kind, name),
      };
    }),
  );
  const alreadyInstalled: string[] = [];
  const conflicts: string[] = [];
  for (const document of documents) {
    try {
      const existing = await readFile(document.target, "utf8");
      if (existing === document.source)
        alreadyInstalled.push(document.relativePath);
      else conflicts.push(document.relativePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (conflicts.length)
    throw new Error(
      `example installation would overwrite existing documents: ${conflicts.join(", ")}`,
    );
  const installed: string[] = [];
  try {
    for (const document of documents) {
      if (alreadyInstalled.includes(document.relativePath)) continue;
      await mkdir(dirname(document.target), { recursive: true });
      await writeFile(document.target, document.source, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      installed.push(document.relativePath);
    }
  } catch (error) {
    await Promise.all(
      installed.map((relativePath) =>
        rm(join(input.workspaceRoot, relativePath), { force: true }),
      ),
    );
    throw error;
  }
  return { installed, alreadyInstalled };
}
