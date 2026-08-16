/**
 * Tools that spawn and supervise subagents.
 */
/**
 * Tools that spawn and supervise subagents.
 *
 * A subagent is another turn-taking runtime with its own budget, so spawning,
 * stopping and retrying all require approval while observing does not. Depth is
 * bounded by the execution context rather than by these tools, because the limit
 * has to hold across a chain of agents, not per call.
 */
import {
  numberOr,
  optionalString,
  requireObject,
  requireString,
} from "@natalia/tools";
import type { SubagentRegistry } from "@natalia/subagent";
import type {
  RuntimeTool,
  ToolExecutionContext,
  ToolFamily,
} from "@natalia/tools";

function requireSubagents(context: ToolExecutionContext) {
  if (!context.subagents) throw new Error("subagent runtime unavailable");
  return context.subagents;
}

function agentSpawnTool(): RuntimeTool {
  return {
    name: "agent_spawn",
    description: "Spawn an isolated TS/Bun subagent task.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        task: { type: "string" },
        mode: { type: "string" },
        modelProfile: { type: "string" },
        allowedTools: { type: "array" },
        excludeTools: { type: "array" },
        writePaths: { type: "array" },
      },
      required: ["task"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: { taskID: { type: "string" } },
        required: ["taskID"],
        additionalProperties: false,
      },
      presentCall(args) {
        return {
          kind: "generic",
          title: requireObject(args).task as string,
          summary: "spawn",
        };
      },
      presentResult(_args, value) {
        const taskID = JSON.parse(value)?.taskID as string | undefined;
        return {
          kind: "generic",
          title: "subagent",
          summary: taskID ? `spawned ${taskID}` : "spawned",
          meta: taskID ? [["taskID", taskID]] : [],
        };
      },
    },
    async execute(input, context) {
      const args = requireObject(input);
      const array = (value: unknown) =>
        Array.isArray(value) ? value.map((item) => String(item)) : undefined;
      const record = await requireSubagents(context).spawn(
        requireString(args.task, "task"),
        {
          mode: optionalString(args.mode),
          modelProfile: optionalString(args.modelProfile),
          allowedTools: array(args.allowedTools),
          excludeTools: array(args.excludeTools),
          writePaths: array(args.writePaths),
          signal: context.signal,
          parentSessionID: context.parentSessionID,
          parentAgentID: context.parentAgentID,
          maxDepth: context.maxSubagentDepth,
        },
      );
      return JSON.stringify(record, null, 2);
    },
  };
}

function agentListTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_list",
    "List TS/Bun subagents.",
    false,
    async (registry) => await registry.formatList(),
  );
}

function agentStatusTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_status",
    "Show TS/Bun subagent status.",
    false,
    async (registry, args) =>
      await registry.formatStatus(requireString(args.id, "id")),
    true,
  );
}

function agentOutputTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_output",
    "Show the concise final result of a TS/Bun subagent. Set verbose=true only when the full audit log is required.",
    false,
    async (registry, args) =>
      await registry.formatOutput(
        requireString(args.id, "id"),
        args.verbose === true,
      ),
    true,
    { verbose: { type: "boolean" } },
  );
}

function agentStopTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_stop",
    "Stop a running TS/Bun subagent.",
    true,
    async (registry, args) =>
      registry.stop(requireString(args.id, "id"))
        ? "stopped"
        : "subagent is not running",
    true,
  );
}

function agentResumeTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_resume",
    "Resume a paused subagent only while its owning runtime remains active.",
    false,
    async (registry, args) =>
      (await registry.resume(requireString(args.id, "id")))
        ? "resumed"
        : "subagent is not paused",
    true,
  );
}

function agentRetryTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_retry",
    "Retry a stopped or failed subagent as an explicit new continuation.",
    true,
    async (registry, args) => {
      const record = await registry.retry(requireString(args.id, "id"));
      return record
        ? `started continuation ${record.continuation}`
        : "subagent is not stopped or failed";
    },
    true,
  );
}

function agentAttachTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_attach",
    "Attach subagent output to the current session.",
    false,
    async (registry, args) =>
      registry.attach(requireString(args.id, "id"))
        ? "attached"
        : "subagent not found",
    true,
  );
}

function agentDetachTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_detach",
    "Detach subagent output from the current session.",
    false,
    async (registry, args) =>
      registry.detach(requireString(args.id, "id"))
        ? "detached"
        : "subagent not found",
    true,
  );
}

function agentCleanupTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_cleanup",
    "Remove stopped, failed, and completed subagent records.",
    true,
    async (registry, args) =>
      JSON.stringify({ removed: registry.cleanup(args.dryRun === true) }),
  );
}

function agentAuditTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_audit",
    "Return the TS/Bun subagent audit trail.",
    false,
    async (registry, args) =>
      registry.audit(
        numberOr(args.tail, 0) || undefined,
        optionalString(args.format),
      ),
  );
}

function agentRegistryTool(
  name: string,
  description: string,
  requiresApproval: boolean,
  action: (
    registry: SubagentRegistry,
    args: Record<string, unknown>,
  ) => Promise<string>,
  requiresID = false,
  extraProperties: Record<string, unknown> = {},
): RuntimeTool {
  return {
    name,
    description,
    requiresApproval,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        dryRun: { type: "boolean" },
        tail: { type: "number" },
        format: { type: "string" },
        ...extraProperties,
      },
      required: requiresID ? ["id"] : undefined,
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return await action(requireSubagents(context), args);
    },
  };
}

/** Every subagent tool. */
export function agentTools(): RuntimeTool[] {
  return [
    agentSpawnTool(),
    agentListTool(),
    agentStatusTool(),
    agentOutputTool(),
    agentStopTool(),
    agentResumeTool(),
    agentRetryTool(),
    agentAttachTool(),
    agentDetachTool(),
    agentCleanupTool(),
    agentAuditTool(),
  ];
}

/**
 * Session scope: a subagent belongs to the session that spawned it.
 */
export function agentToolFamily(): ToolFamily {
  return {
    id: "agent",
    name: "Subagent Tools",
    version: "1.0.0",
    description: "Delegating work to a subagent.",
    scope: "session",
    tools: [...agentTools()],
  };
}
