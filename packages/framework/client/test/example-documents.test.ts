import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installExampleDocuments, scheduledTaskOverview } from "../src";
import { configV3Schema } from "@natalia/contracts";

test("example installation creates validated flows and tasks without overwriting", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-examples-"));
  const flows = await installExampleDocuments({ workspaceRoot });
  expect(flows.installed).toEqual([
    ".natalia/flows/code-quality.yaml",
    ".natalia/flows/log-triage.yaml",
    ".natalia/flows/release-notes.yaml",
  ]);
  const all = await installExampleDocuments({
    workspaceRoot,
    includeTasks: true,
  });
  expect(all.alreadyInstalled).toEqual(flows.installed);
  expect(all.installed).toEqual([
    ".natalia/tasks/nightly-code-quality.yaml",
    ".natalia/tasks/nightly-log-triage.yaml",
    ".natalia/tasks/release-notes.yaml",
  ]);
  const overview = await scheduledTaskOverview({
    workspaceRoot,
    config: configV3Schema.parse({ version: 3 }),
  });
  expect(overview.tasks).toHaveLength(3);
  expect(overview.tasks.every((task) => task.problems.length > 0)).toBe(true);

  await writeFile(
    join(workspaceRoot, ".natalia", "flows", "log-triage.yaml"),
    "user content\n",
  );
  await expect(installExampleDocuments({ workspaceRoot })).rejects.toThrow(
    "would overwrite existing documents: .natalia/flows/log-triage.yaml",
  );
  expect(
    await readFile(
      join(workspaceRoot, ".natalia", "flows", "log-triage.yaml"),
      "utf8",
    ),
  ).toBe("user content\n");
});
