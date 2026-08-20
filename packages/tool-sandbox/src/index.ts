/**
 * Tools that work inside a workspace sandbox.
 */
/**
 * Tools that work inside a workspace sandbox.
 *
 * A sandbox is a copy of the workspace the model may change freely; merging is the
 * only way changes reach the real tree, and it is the only action here that asks
 * for authorization on the paths involved. Every tool refuses to run without a
 * sandbox manager rather than silently falling back to the workspace, because
 * "isolation was unavailable" must never be indistinguishable from "isolation
 * happened".
 */
import {
  numberOr,
  optionalString,
  requireObject,
  requireString,
} from "@natalia/tools";
import type { WorkspaceSandboxManager } from "@natalia/sandbox";
import type { Plugin } from "@natalia/plugin";
import type {
  RuntimeTool,
  ToolExecutionContext,
  ToolFamily,
} from "@natalia/tools";

function requireSandboxes(context: ToolExecutionContext) {
  if (!context.sandboxes) throw new Error("sandbox runtime unavailable");
  return context.sandboxes;
}

function sandboxCreateTool(): RuntimeTool {
  return {
    name: "sandbox_create",
    description: "Create a TS workspace-isolated sandbox.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, maxLines: { type: "number" } },
      required: ["id"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      presentCall(args) {
        return {
          kind: "generic",
          title: requireObject(args).id as string,
          summary: "create",
        };
      },
      presentResult(args, value) {
        return {
          kind: "generic",
          title: requireObject(args).id as string,
          summary: value,
        };
      },
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const sandbox = await requireSandboxes(context).create(id);
      context.onSandboxEvent?.(requireSandboxes(context).updateEvent(id));
      context.onSandboxEvent?.(
        requireSandboxes(context).auditEvent(id, "create"),
      );
      // The resolved config by name (the D2 runtime.config service): the tool
      // says which backend actually created the sandbox.
      const backend =
        (
          context.runtimeConfig?.() as
            | { sandbox?: { backend?: string } }
            | undefined
        )?.sandbox?.backend ?? "snapshot";
      return JSON.stringify({ ...sandbox, backend }, null, 2);
    },
  };
}

function sandboxExecuteTool(): RuntimeTool {
  return {
    name: "sandbox_execute",
    description: "Execute a shell command inside a TS workspace sandbox.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, command: { type: "string" } },
      required: ["id", "command"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const manager = requireSandboxes(context);
      const id = requireString(args.id, "id");
      const result = await manager.execute(
        id,
        requireString(args.command, "command"),
        {
          signal: context.signal,
        },
      );
      context.onSandboxEvent?.(manager.updateEvent(id));
      context.onSandboxEvent?.(manager.auditEvent(id, "execute"));
      return [`exit=${result.exitCode}`, result.output].join("\n");
    },
  };
}

function sandboxWriteTool(): RuntimeTool {
  return {
    name: "sandbox_write",
    description: "Write a file inside a TS workspace sandbox manifest.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["id", "path", "content"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const manager = requireSandboxes(context);
      const id = requireString(args.id, "id");
      await manager.write(
        id,
        requireString(args.path, "path"),
        requireString(args.content, "content"),
      );
      context.onSandboxEvent?.(manager.updateEvent(id));
      context.onSandboxEvent?.(manager.diffEvent(id));
      return `wrote ${requireString(args.path, "path")} in sandbox ${id}`;
    },
  };
}

function sandboxDiffTool(): RuntimeTool {
  return sandboxReadTool(
    "sandbox_diff",
    "Show pending sandbox changes.",
    async (manager, id) => {
      const changes = await manager.previewMerge(id);
      return JSON.stringify(changes, null, 2);
    },
  );
}

function sandboxMergeTool(): RuntimeTool {
  return {
    name: "sandbox_merge",
    description: "Merge a sandbox manifest into the current workspace.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, maxLines: { type: "number" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const manager = requireSandboxes(context);
      const changes = await manager.merge(
        id,
        context.workspaceRoot,
        async (paths) =>
          await context.sandboxMergeAuthorize?.({
            id,
            paths,
          }),
      );
      context.onWorkspaceChange?.(changes);
      context.onSandboxEvent?.(manager.updateEvent(id));
      context.onSandboxEvent?.(manager.auditEvent(id, "merge"));
      return JSON.stringify(changes, null, 2);
    },
  };
}

function sandboxDeleteTool(): RuntimeTool {
  return {
    name: "sandbox_delete",
    description: "Delete a TS workspace sandbox.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const id = requireString(requireObject(input).id, "id");
      const manager = requireSandboxes(context);
      const result = await manager.delete(id);
      context.onSandboxEvent?.({
        type: "sandbox.update",
        id,
        status: "deleted",
        root: "",
        isolationLevel: "workspace",
        changedFiles: result.pendingChanges.length,
        runningResources: result.runningResources.length,
        target: { kind: "host", cwd: context.workspaceRoot },
        resourcePolicy: "sandbox deleted after resource cleanup",
      });
      context.onSandboxEvent?.({
        type: "sandbox.audit",
        id,
        action: "delete",
        target: { kind: "host", cwd: context.workspaceRoot },
        approvalRequired: true,
        checkpointPolicy: "sandbox_manifest",
        message: "Sandbox workspace directory deleted after resource cleanup.",
      });
      return JSON.stringify(result, null, 2);
    },
  };
}

function sandboxResourceStartTool(): RuntimeTool {
  return {
    name: "sandbox_resource_start",
    description:
      "Start a managed background process inside a TS workspace sandbox.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        command: { type: "string" },
        resourceID: { type: "string" },
      },
      required: ["id", "command"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const manager = requireSandboxes(context);
      const id = requireString(args.id, "id");
      const resource = await manager.startResource(
        id,
        requireString(args.command, "command"),
        optionalString(args.resourceID),
      );
      context.onSandboxEvent?.(manager.updateEvent(id));
      context.onSandboxEvent?.(manager.auditEvent(id, "resource_start"));
      return JSON.stringify(resource, null, 2);
    },
  };
}

function sandboxResourceListTool(): RuntimeTool {
  return sandboxResourceReadTool(
    "sandbox_resource_list",
    "List managed processes running inside a TS workspace sandbox.",
    (manager, id) => JSON.stringify(manager.resourcesFor(id), null, 2),
  );
}

function sandboxResourceOutputTool(): RuntimeTool {
  return {
    name: "sandbox_resource_output",
    description: "Read retained output from a managed sandbox process.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, resourceID: { type: "string" } },
      required: ["id", "resourceID"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return await requireSandboxes(context).resourceOutput(
        requireString(args.id, "id"),
        requireString(args.resourceID, "resourceID"),
      );
    },
  };
}

function sandboxResourceStopTool(): RuntimeTool {
  return {
    name: "sandbox_resource_stop",
    description:
      "Stop a managed process running inside a TS workspace sandbox.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, resourceID: { type: "string" } },
      required: ["id", "resourceID"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const manager = requireSandboxes(context);
      const id = requireString(args.id, "id");
      const resource = await manager.stopResource(
        id,
        requireString(args.resourceID, "resourceID"),
      );
      context.onSandboxEvent?.(manager.updateEvent(id));
      context.onSandboxEvent?.(manager.auditEvent(id, "resource_stop"));
      return JSON.stringify(resource, null, 2);
    },
  };
}

function sandboxResourceReadTool(
  name: string,
  description: string,
  action: (manager: WorkspaceSandboxManager, id: string) => string,
): RuntimeTool {
  return {
    name,
    description,
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      return action(
        requireSandboxes(context),
        requireString(requireObject(input).id, "id"),
      );
    },
  };
}

function sandboxReadTool(
  name: string,
  description: string,
  action: (manager: WorkspaceSandboxManager, id: string) => Promise<string>,
  requiresApproval = false,
): RuntimeTool {
  return {
    name,
    description,
    requiresApproval,
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      return await action(
        requireSandboxes(context),
        requireString(requireObject(input).id, "id"),
      );
    },
  };
}

/** Every sandbox tool. */
export function sandboxTools(): RuntimeTool[] {
  return [
    sandboxCreateTool(),
    sandboxExecuteTool(),
    sandboxWriteTool(),
    sandboxDiffTool(),
    sandboxMergeTool(),
    sandboxDeleteTool(),
    sandboxResourceStartTool(),
    sandboxResourceListTool(),
    sandboxResourceOutputTool(),
    sandboxResourceStopTool(),
  ];
}

/**
 * Workspace scope: a sandbox is a copy of the workspace, and its tools are only
 * meaningful while that workspace is mounted.
 */
export function sandboxToolFamily(): ToolFamily {
  return {
    id: "sandbox",
    name: "Sandbox Tools",
    version: "1.0.0",
    description: "Isolated workspaces and their merge back.",
    scope: "workspace",
    tools: [...sandboxTools()],
  };
}

export const SANDBOX_PLUGIN_ID = "natalia-tool-sandbox";

export function createSandboxPlugin(): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: SANDBOX_PLUGIN_ID,
      version: "1.0.0",
      name: "Sandbox Tools",
      description: "Isolated workspaces and their merge back.",
      entry: "natalia:tool-sandbox",
      scope: "workspace",
      provides: [],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["tools"],
    },
    setup(api) {
      for (const tool of sandboxTools()) api.tools.register(tool);
    },
  };
}
