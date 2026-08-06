import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { nataliaTaskDocumentSchema } from "@natalia/contracts";
import {
  configureTaskSystemd,
  deleteTaskDocument,
  generateTaskUnits,
  installUserTaskUnits,
  nextSystemdRun,
  previewSystemdCalendar,
  removeTaskSystemd,
} from "../src";
import { NataliaDocumentStore } from "@natalia/workflow";

function task(overrides: Record<string, unknown> = {}) {
  return nataliaTaskDocumentSchema.parse({
    kind: "natalia-task",
    version: 1,
    taskID: "task_review",
    displayName: "Review",
    schedule: "daily 02:15",
    prompt: "secret prompt that must not enter a unit",
    permissionProfile: "unattended",
    flow: { flowID: "flow_review" },
    systemd: { calendar: "*-*-* 02:15:00", scope: "user" },
    ...overrides,
  });
}

function units(overrides: Record<string, unknown> = {}) {
  return generateTaskUnits({
    task: task(overrides),
    workspaceRoot: "/srv/review workspace",
    executable: "/usr/bin/bun",
    cliEntry: "/opt/natalia/apps/cli/src/main.ts",
  });
}

test("generated units name only the task and carry verifiable ownership", () => {
  const generated = units();
  expect(generated.timerUnit).toBe("natalia-task-task_review.timer");
  expect(generated.service).toContain("# X-Natalia-Task=task_review");
  expect(generated.service).toContain("# X-Natalia-Schema=1");
  expect(generated.service).toMatch(/X-Natalia-Content-SHA256=[a-f0-9]{64}/u);
  expect(generated.service).toContain(
    '"task" "run-id" "task_review" "--workspace" "/srv/review workspace" "--json"',
  );
  expect(generated.service).not.toContain("secret prompt");
  expect(generated.service).not.toMatch(/token|apiKey|password/iu);
  expect(generated.timer).toContain("OnCalendar=*-*-* 02:15:00");
  expect(generated.timer).toContain("Persistent=true");
  expect(generated.timer).toContain("Unit=natalia-task-task_review.service");
});

test("unit generation rejects ambiguous identities, paths, and injected lines", () => {
  expect(() => units({ taskID: "task/review" })).toThrow(
    "cannot be used in a systemd unit name",
  );
  expect(() => units({ displayName: "Review\nExecStart=/bin/false" })).toThrow(
    "forbidden control character",
  );
  expect(() => units({ systemd: undefined })).toThrow(
    "has no explicit systemd calendar",
  );
});

test("calendar preview is delegated to systemd and requires three results", async () => {
  const args: string[][] = [];
  const preview = await previewSystemdCalendar(
    "*-*-* 02:15:00",
    async (call) => {
      args.push(call);
      return {
        exitCode: 0,
        stderr: "",
        stdout: [
          "Normalized form: *-*-* 02:15:00",
          "    Next elapse: Fri 2026-08-07 02:15:00 CST",
          "   Iteration #2: Sat 2026-08-08 02:15:00 CST",
          "   Iteration #3: Sun 2026-08-09 02:15:00 CST",
        ].join("\n"),
      };
    },
  );
  expect(args).toEqual([["calendar", "--iterations=3", "*-*-* 02:15:00"]]);
  expect(preview).toEqual({
    normalized: "*-*-* 02:15:00",
    next: [
      "Fri 2026-08-07 02:15:00 CST",
      "Sat 2026-08-08 02:15:00 CST",
      "Sun 2026-08-09 02:15:00 CST",
    ],
  });
  await expect(
    previewSystemdCalendar("bad", async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "Failed to parse calendar specification",
    })),
  ).rejects.toThrow("invalid systemd calendar");
});

test("user unit install is atomic, enables first install, and preserves disabled updates", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-systemd-install-"));
  const calls: string[][] = [];
  const run = async (args: string[]) => {
    calls.push(args);
    return {
      exitCode: args.includes("is-enabled") ? 1 : 0,
      stdout: "",
      stderr: "",
    };
  };
  await installUserTaskUnits({ units: units(), unitDirectory: root, run });
  expect(calls).toEqual([
    ["--user", "daemon-reload"],
    ["--user", "enable", "--now", "natalia-task-task_review.timer"],
  ]);
  calls.length = 0;
  await installUserTaskUnits({ units: units(), unitDirectory: root, run });
  expect(calls).toEqual([
    ["--user", "is-enabled", "natalia-task-task_review.timer"],
    ["--user", "daemon-reload"],
  ]);
  const service = join(root, "natalia-task-task_review.service");
  await writeFile(service, `${await readFile(service, "utf8")}# manual edit\n`);
  await expect(
    installUserTaskUnits({ units: units(), unitDirectory: root, run }),
  ).rejects.toThrow("not owned by this task");
});

test("next run reads only the recorded timer unit", async () => {
  const calls: string[][] = [];
  const next = await nextSystemdRun({
    timerUnit: "natalia-task-task_review.timer",
    scope: "user",
    run: async (args) => {
      calls.push(args);
      return {
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify([
          {
            unit: "natalia-task-other.timer",
            next: 1_786_060_000_000_000,
          },
          {
            unit: "natalia-task-task_review.timer",
            next: 1_786_063_500_000_000,
          },
        ]),
      };
    },
  });
  expect(calls[0]).toContain("natalia-task-task_review.timer");
  expect(next).toBe(new Date(1_786_063_500_000).toISOString());
});

test("configure and remove write the timer identity but keep task audit documents", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-systemd-task-"));
  const unitDirectory = join(root, "units");
  const documents = new NataliaDocumentStore(root);
  await documents.saveTask(task({ systemd: undefined }), "review.yaml");
  const run = async (args: string[]) => ({
    exitCode: args.includes("is-enabled") ? 1 : 0,
    stdout: "",
    stderr: "",
  });
  await configureTaskSystemd({
    workspaceRoot: root,
    path: "review.yaml",
    calendar: "*-*-* 02:15:00",
    scope: "user",
    executable: "natalia-ts",
    userUnitDirectory: unitDirectory,
    run,
    validateCalendar: async () => ({ normalized: "", next: ["1", "2", "3"] }),
  });
  expect(await documents.loadTaskDocument("review.yaml")).toMatchObject({
    systemd: {
      calendar: "*-*-* 02:15:00",
      scope: "user",
      timerUnit: "natalia-task-task_review.timer",
    },
  });
  await expect(
    deleteTaskDocument({ workspaceRoot: root, path: "review.yaml" }),
  ).rejects.toThrow("remove timer");
  await removeTaskSystemd({
    workspaceRoot: root,
    path: "review.yaml",
    userUnitDirectory: unitDirectory,
    run,
  });
  expect(await documents.loadTaskDocument("review.yaml")).toMatchObject({
    systemd: { calendar: "*-*-* 02:15:00", scope: "user" },
  });
  await expect(
    readFile(join(unitDirectory, "natalia-task-task_review.timer")),
  ).rejects.toThrow();
});

test("system scope only generates reviewable sudo commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-systemd-system-"));
  const generatedDirectory = join(root, "generated");
  const documents = new NataliaDocumentStore(root);
  await documents.saveTask(task({ systemd: undefined }), "review.yaml");
  const result = await configureTaskSystemd({
    workspaceRoot: root,
    path: "review.yaml",
    calendar: "Mon *-*-* 03:00:00",
    scope: "system",
    executable: "natalia-ts",
    generatedDirectory,
    validateCalendar: async () => ({ normalized: "", next: ["1", "2", "3"] }),
  });
  expect(result.commands).toEqual([
    expect.stringContaining("sudo install -m 0644"),
    expect.stringContaining("sudo install -m 0644"),
    "sudo systemctl daemon-reload",
    "sudo systemctl enable --now natalia-task-task_review.timer",
  ]);
  expect(await documents.loadTaskDocument("review.yaml")).toMatchObject({
    systemd: {
      scope: "system",
      timerUnit: "natalia-task-task_review.timer",
      generatedCalendar: "Mon *-*-* 03:00:00",
    },
  });
  await expect(
    readFile(
      join(generatedDirectory, "natalia-task-task_review.timer"),
      "utf8",
    ),
  ).resolves.toContain("OnCalendar=Mon *-*-* 03:00:00");
});

test("system timer inspection fails closed instead of forgetting an unknown live timer", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-systemd-remove-fail-"));
  const documents = new NataliaDocumentStore(root);
  await documents.saveTask(
    task({
      systemd: {
        calendar: "*-*-* 02:15:00",
        scope: "system",
        timerUnit: "natalia-task-task_review.timer",
        generatedCalendar: "*-*-* 02:15:00",
      },
    }),
    "review.yaml",
  );
  await expect(
    removeTaskSystemd({
      workspaceRoot: root,
      path: "review.yaml",
      run: async () => ({ exitCode: 1, stdout: "", stderr: "bus unavailable" }),
    }),
  ).rejects.toThrow("cannot inspect system timer");
  expect(await documents.loadTaskDocument("review.yaml")).toMatchObject({
    systemd: { timerUnit: "natalia-task-task_review.timer" },
  });
});
