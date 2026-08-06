import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  configV2Schema,
  nataliaFlowDocumentSchema,
  permissionProfileSchema,
  type NataliaFlowDocument,
  type PermissionProfile,
} from "@natalia/contracts";
import { NataliaDocumentStore } from "@natalia/workflow";
import {
  effectiveFlowPermissions,
  effectiveModulePermissions,
  taskPermissionPreviewForDocument,
} from "../src";

function flow(
  modules: Array<Record<string, unknown>>,
  flowID = "flow_x",
): NataliaFlowDocument {
  return nataliaFlowDocumentSchema.parse({
    kind: "natalia-flow",
    version: 1,
    flowID,
    displayName: "Flow",
    modules,
  });
}

function profile(overrides: Record<string, unknown>): PermissionProfile {
  return permissionProfileSchema.parse({
    approval: "auto",
    description: "Task profile",
    ...overrides,
  });
}

const READ_MODULE = {
  id: "read",
  type: "read_search",
  displayName: "Read",
};

test("a read stage under a read-only profile keeps its own bundle", () => {
  const preview = effectiveModulePermissions({
    profile: profile({
      permissions: { tools: { allow: ["read_file", "glob", "grep"] } },
    }),
    module: flow([READ_MODULE]).modules[0]!,
    toolNames: [
      "read_file",
      "glob",
      "grep",
      "write_file",
      "run_shell",
      "flow_module_complete",
    ],
  });
  expect(preview.tools.allowed.sort()).toEqual([
    "flow_module_complete",
    "glob",
    "grep",
    "read_file",
  ]);
  // Tools outside the module bundle are simply not part of this stage.
  expect(preview.tools.denied).toEqual([]);
  expect(preview.blocked).toBeUndefined();
});

test("a stage whose whole bundle is denied is reported as blocked", () => {
  const preview = effectiveModulePermissions({
    profile: profile({
      permissions: { tools: { allow: ["read_file", "glob", "grep"] } },
    }),
    module: flow([{ id: "term", type: "terminal", displayName: "Terminal" }])
      .modules[0]!,
    toolNames: [
      "read_file",
      "interactive_terminal_start",
      "interactive_terminal_send_line",
      "terminal_observe",
      "flow_module_complete",
    ],
  });
  expect(preview.tools.allowed).toEqual(["flow_module_complete"]);
  expect(preview.blocked).toContain("terminal module has no usable tool");
  expect(preview.blocked).toContain("interactive_terminal_start");
});

test("a disabled extension blocks the stage that depends on it", () => {
  const preview = effectiveModulePermissions({
    profile: profile({ extensions: { mcp: false } }),
    module: flow([{ id: "mcp", type: "mcp", displayName: "MCP" }]).modules[0]!,
    toolNames: ["mcp_files_read", "read_file", "flow_module_complete"],
  });
  expect(preview.extensions).toMatchObject({ mcp: false });
  expect(preview.tools.denied).toEqual(["mcp_files_read"]);
  expect(preview.blocked).toContain("permission profile denies mcp_files_read");
});

test("a module extension switch narrows but cannot widen the profile", () => {
  const moduleDisabled = effectiveModulePermissions({
    profile: profile({ extensions: { mcp: true } }),
    module: flow([
      {
        id: "mcp",
        type: "mcp",
        displayName: "MCP",
        extensions: { mcp: false },
      },
    ]).modules[0]!,
    toolNames: ["mcp_docs_read", "flow_module_complete"],
  });
  expect(moduleDisabled.extensions.mcp).toBe(false);
  expect(moduleDisabled.tools.denied).toEqual(["mcp_docs_read"]);
  expect(moduleDisabled.blocked).toContain(
    "active module disables mcp_docs_read",
  );

  const profileDisabled = effectiveModulePermissions({
    profile: profile({ extensions: { mcp: false } }),
    module: flow([
      {
        id: "mcp",
        type: "mcp",
        displayName: "MCP",
        extensions: { mcp: true },
      },
    ]).modules[0]!,
    toolNames: ["mcp_docs_read", "flow_module_complete"],
  });
  expect(profileDisabled.extensions.mcp).toBe(false);
  expect(profileDisabled.tools.denied).toEqual(["mcp_docs_read"]);
});

test("a reporting stage is blocked when the task configures no issue target", () => {
  const withTarget = effectiveFlowPermissions({
    flow: flow([
      { id: "report", type: "report_output", displayName: "Report" },
    ]),
    taskCapabilities: { reportIssue: true },
  });
  expect(withTarget.blocked).toEqual([]);
  expect(withTarget.modules[0]!.tools.allowed).toContain("report_issue");
  const withoutTarget = effectiveFlowPermissions({
    flow: flow([
      { id: "report", type: "report_output", displayName: "Report" },
    ]),
  });
  expect(withoutTarget.blocked).toEqual([
    {
      moduleID: "report",
      reason: expect.stringContaining("nothing matching report_issue exists"),
    },
  ]);
});

test("a disabled stage is previewed but never reported as blocking the flow", () => {
  const preview = effectiveFlowPermissions({
    profile: profile({
      permissions: { tools: { allow: ["read_file", "glob", "grep"] } },
    }),
    flow: flow([
      READ_MODULE,
      {
        id: "term",
        type: "terminal",
        displayName: "Terminal",
        enabled: false,
      },
    ]),
  });
  expect(preview.modules).toHaveLength(2);
  expect(preview.modules[1]!.blocked).toBeDefined();
  expect(preview.blocked).toEqual([]);
});

test("command rules and interactive programs surface both layers", () => {
  const preview = effectiveModulePermissions({
    profile: profile({
      commandRules: {
        mode: "whitelist",
        rules: [{ command: "git diff" }, { command: "vim" }],
      },
      interactivePrograms: { allow: [{ command: "vim" }, { command: "psql" }] },
    }),
    module: flow([
      {
        id: "term",
        type: "terminal",
        displayName: "Terminal",
        commandRules: { mode: "blacklist", rules: [{ command: "git push" }] },
        interactivePrograms: { allow: [{ command: "vim" }] },
      },
    ]).modules[0]!,
    toolNames: ["interactive_terminal_start", "flow_module_complete"],
  });
  expect(preview.commandRules).toEqual({
    profile: { mode: "whitelist", commands: ["git diff", "vim"] },
    module: { mode: "blacklist", commands: ["git push"] },
  });
  // The module can only narrow the profile's interactive programs.
  expect(preview.interactivePrograms).toEqual(["vim"]);
});

test("file path preview surfaces profile and module restrictions separately", () => {
  const preview = effectiveModulePermissions({
    profile: profile({
      permissions: {
        files: {
          readPaths: [{ pattern: "**", allow: true }],
          writePaths: [{ pattern: "secrets/**", allow: false }],
        },
      },
    }),
    module: flow([
      {
        id: "write",
        type: "workspace_changes",
        displayName: "Write",
        permissions: {
          files: {
            writePaths: [
              { pattern: "docs/**", allow: true },
              { pattern: "docs/private/**", allow: false },
            ],
          },
        },
      },
    ]).modules[0]!,
    toolNames: ["write_file", "flow_module_complete"],
  });
  expect(preview.profilePathRules).toEqual({
    read: ["allow **"],
    write: ["deny secrets/**"],
  });
  expect(preview.pathRules).toEqual({
    read: [],
    write: ["allow docs/**", "deny docs/private/**"],
  });
});

test("interactive program preview preserves allowAny and module narrowing", () => {
  const unrestricted = effectiveModulePermissions({
    profile: profile({ interactivePrograms: { allowAny: true, allow: [] } }),
    module: flow([{ id: "term", type: "terminal", displayName: "Terminal" }])
      .modules[0]!,
    toolNames: ["interactive_terminal_start", "flow_module_complete"],
  });
  expect(unrestricted.interactivePrograms).toBe("any");

  const narrowed = effectiveModulePermissions({
    profile: profile({ interactivePrograms: { allowAny: true, allow: [] } }),
    module: flow([
      {
        id: "term",
        type: "terminal",
        displayName: "Terminal",
        interactivePrograms: { allow: [{ command: "vim" }] },
      },
    ]).modules[0]!,
    toolNames: ["interactive_terminal_start", "flow_module_complete"],
  });
  expect(narrowed.interactivePrograms).toEqual(["vim"]);
});

test("legacy interactive program allowlists default allowAny to false", () => {
  expect(
    profile({ interactivePrograms: { allow: [{ command: "vim" }] } })
      .interactivePrograms,
  ).toEqual({ allowAny: false, allow: [{ command: "vim" }] });
});

test("the preview uses the real runtime tool catalog by default", () => {
  const preview = effectiveFlowPermissions({ flow: flow([READ_MODULE]) });
  // No profile restriction, so the read bundle resolves against real tools.
  expect(preview.modules[0]!.tools.allowed).toContain("read_file");
  expect(preview.modules[0]!.tools.allowed).toContain("grep");
  expect(preview.modules[0]!.tools.allowed).not.toContain("run_shell");
  expect(preview.blocked).toEqual([]);
});

test("a document preview includes task-scoped issue and data-source tools", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-task-preview-"));
  const documents = new NataliaDocumentStore(workspaceRoot);
  await documents.saveFlow({
    kind: "natalia-flow",
    version: 1,
    flowID: "flow_context",
    displayName: "Context",
    modules: [
      { id: "read", type: "read_search", displayName: "Read" },
      { id: "report", type: "report_output", displayName: "Report" },
    ],
  });
  await documents.saveTask({
    kind: "natalia-task",
    version: 1,
    taskID: "task_context",
    displayName: "Context task",
    schedule: "daily",
    prompt: "Run",
    permissionProfile: "unattended",
    flow: { flowID: "flow_context" },
    dataSource: "source",
    issueTarget: "issues",
  });
  const config = configV2Schema.parse({
    version: 2,
    permissionProfiles: {
      unattended: {
        approval: "auto",
        permissions: {
          tools: {
            allow: [
              "read_data_source",
              "read_file",
              "report_issue",
              "flow_module_complete",
            ],
          },
        },
      },
    },
  });
  const preview = await taskPermissionPreviewForDocument({
    workspaceRoot,
    path: "task_context.yaml",
    config,
  });
  expect(preview.taskID).toBe("task_context");
  expect(preview.modules[0]!.tools.allowed).toContain("read_data_source");
  expect(preview.modules[1]!.tools.allowed).toContain("report_issue");
  expect(preview.blocked).toEqual([]);
});
