import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configV2Schema, type ConfigV2 } from "@natalia/contracts";
import {
  configWithoutPermissionProfile,
  parseToolAllowList,
  permissionProfileRemovalProblem,
  permissionProfileUsage,
} from "../src";

function config(overrides: Record<string, unknown> = {}): ConfigV2 {
  return configV2Schema.parse({
    version: 2,
    permissionProfiles: {
      ask: { approval: "ask", description: "Ask first" },
      unattended_read: { approval: "auto", description: "Nightly read" },
    },
    defaultPermission: "ask",
    ...overrides,
  });
}

test("a profile still selected by a task cannot be deleted", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-profile-usage-"));
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Do it.\npermissionProfile: unattended_read\nflow:\n  flowID: flow_review\n",
  );
  const usage = await permissionProfileUsage({ workspaceRoot: root });
  expect(usage).toEqual({ unattended_read: ["task_nightly"] });
  // Deleting the boundary a task selected would move that task onto a different
  // boundary at its next run, which nobody asked for.
  expect(
    permissionProfileRemovalProblem({
      config: config(),
      name: "unattended_read",
      usage,
    }),
  ).toBe("still used by 1 task: task_nightly");
  expect(() =>
    configWithoutPermissionProfile({
      config: config(),
      name: "unattended_read",
      usage,
    }),
  ).toThrow("still used by 1 task");
});

test("the default and the last profile are protected, an unused one is removable", () => {
  expect(
    permissionProfileRemovalProblem({ config: config(), name: "ask" }),
  ).toBe("this is the default profile; select another profile first");
  expect(
    permissionProfileRemovalProblem({
      config: config({
        permissionProfiles: { ask: { approval: "ask", description: "" } },
      }),
      name: "ask",
    }),
  ).toBe("the last permission profile cannot be deleted");
  expect(
    permissionProfileRemovalProblem({ config: config(), name: "missing" }),
  ).toBe("permission profile not found: missing");
  expect(
    permissionProfileRemovalProblem({
      config: config(),
      name: "unattended_read",
      usage: {},
    }),
  ).toBeUndefined();
  const next = configWithoutPermissionProfile({
    config: config(),
    name: "unattended_read",
    usage: {},
  });
  expect(Object.keys(next.permissionProfiles)).toEqual(["ask"]);
  expect(next.defaultPermission).toBe("ask");
});

test("an allow-list only accepts tools a capability bundle can grant", () => {
  expect(parseToolAllowList("read_file, grep\nreport_issue")).toEqual({
    tools: ["read_file", "grep", "report_issue"],
    rejected: [],
  });
  // Wildcard bundles still grant their family, and duplicates are not stacked.
  expect(parseToolAllowList("mcp_call\nread_file", ["read_file"])).toEqual({
    tools: ["read_file", "mcp_call"],
    rejected: [],
  });
  // A renamed or invented tool would be denied at run time, so the profile is
  // never allowed to promise it.
  expect(parseToolAllowList("read_log_source\n# comment\nread_file")).toEqual({
    tools: ["read_file"],
    rejected: [
      {
        tool: "read_log_source",
        reason: "no capability bundle can grant this tool",
      },
    ],
  });
});
