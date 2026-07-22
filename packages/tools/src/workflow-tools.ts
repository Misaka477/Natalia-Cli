import { resolve } from "node:path";
import type { ToolRegistry, RuntimeTool, ToolExecutionContext } from "./index";

let wfPromise: Promise<typeof import("@natalia/workflow")> | undefined;

async function loadWorkflow(): Promise<typeof import("@natalia/workflow")> {
  if (!wfPromise) {
    wfPromise = import("@natalia/workflow");
  }
  return wfPromise;
}

type WorkflowModule = typeof import("@natalia/workflow") & {
  createWorkflowRuntime(
    tools: {
      get(
        name: string,
      ): { execute(input: unknown): Promise<string> } | undefined;
    },
    store: InstanceType<
      (typeof import("@natalia/workflow"))["JsonlWorkflowStore"]
    >,
    onEvent: (
      event: import("@natalia/workflow").WorkflowEvent,
      run: import("@natalia/workflow").WorkflowRun,
    ) => void,
  ): {
    run(
      document: import("@natalia/workflow").WorkflowDocument,
      context: { workspaceRoot: string; signal?: AbortSignal },
      runID?: string,
    ): Promise<import("@natalia/workflow").WorkflowRun>;
  };
};

function detectAndParse(
  input: string,
  mod: typeof import("@natalia/workflow"),
): ReturnType<typeof mod.parseWorkflowJSON> {
  const trimmed = input.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return mod.parseWorkflowJSON(input);
  }
  return mod.parseWorkflowYAML(input);
}

function requireObject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("tool arguments must be an object");
  return input as Record<string, unknown>;
}

function requireString(value: unknown, name: string) {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function optionalString(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    throw new Error("optional value must be a string");
  return value;
}

function storeDir(workspaceRoot: string) {
  return resolve(workspaceRoot, ".natalia", "workflow-runs");
}

export function createWorkflowTools(
  getRegistry: () => ToolRegistry,
): RuntimeTool[] {
  return [
    workflowRunTool(getRegistry),
    workflowStatusTool(),
    workflowEventsTool(),
  ];
}

function workflowRunTool(getRegistry: () => ToolRegistry): RuntimeTool {
  return {
    name: "workflow_run",
    description:
      "Execute a workflow document (JSON or YAML) and report the resulting status, values, and event journal.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        workflow: {
          type: "string",
          description: "JSON or YAML workflow document",
        },
        runID: {
          type: "string",
          description:
            "Optional run ID for resuming an existing workflow run (defaults to auto-generated)",
        },
      },
      required: ["workflow"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const workflowStr = requireString(args.workflow, "workflow");
      const mod = await loadWorkflow();
      let document: ReturnType<typeof mod.parseWorkflowJSON>;
      try {
        document = detectAndParse(workflowStr, mod);
      } catch (error) {
        throw new Error(
          `Invalid workflow: ${error instanceof Error ? error.message : String(error)}\nMinimal JSON example: {"version":1,"name":"write-note","steps":[{"id":"write","kind":"tool","tool":"write_file","arguments":{"path":"note.txt","content":"hello"}}]}`,
        );
      }
      const store = new mod.JsonlWorkflowStore(storeDir(context.workspaceRoot));
      const runtime = (mod as WorkflowModule).createWorkflowRuntime(
        {
          get(name) {
            const tool = getRegistry().get(name);
            return tool
              ? {
                  execute: async (toolInput) =>
                    await tool.execute(toolInput, context),
                }
              : undefined;
          },
        },
        store,
        (event, run) =>
          context.onWorkflowEvent?.({
            runID: run.id,
            workflow: run.workflow,
            status: run.status as
              | "running"
              | "completed"
              | "failed"
              | "cancelled",
            event: event.type as
              | "run_started"
              | "run_completed"
              | "run_cancelled"
              | "step_started"
              | "step_completed"
              | "step_failed",
            stepID: event.stepID,
            result: event.result,
            error: event.error,
          }),
      );
      const runID = optionalString(args.runID);
      const run = await runtime.run(document, context, runID);
      return JSON.stringify(
        {
          id: run.id,
          workflow: run.workflow,
          status: run.status,
          values: run.values,
          completedStepIDs: run.completedStepIDs,
          events: run.events,
        },
        null,
        2,
      );
    },
  };
}

function workflowStatusTool(): RuntimeTool {
  return {
    name: "workflow_status",
    description:
      "Introspect a durable workflow run by ID and return its status, completed steps, and event summary.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        runID: {
          type: "string",
          description: "The workflow run ID to inspect",
        },
      },
      required: ["runID"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const runID = requireString(args.runID, "runID");
      const mod = await loadWorkflow();
      const store = new mod.JsonlWorkflowStore(storeDir(context.workspaceRoot));
      const events = await store.events(runID);
      if (events.length === 0) {
        return JSON.stringify(
          { id: runID, status: "unknown", events: [] },
          null,
          2,
        );
      }
      const lastEvent = events[events.length - 1]!;
      const status = determineStatus(events);
      const completedStepIDs = events
        .filter((e) => e.type === "step_completed" && e.stepID)
        .map((e) => e.stepID!);
      return JSON.stringify(
        {
          id: runID,
          status,
          completedStepIDs,
          eventCount: events.length,
          lastEvent: lastEvent.type,
          lastEventAt: lastEvent.at,
        },
        null,
        2,
      );
    },
  };
}

function workflowEventsTool(): RuntimeTool {
  return {
    name: "workflow_events",
    description:
      "Return the full event journal for a durable workflow run by ID.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        runID: {
          type: "string",
          description: "The workflow run ID",
        },
      },
      required: ["runID"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const runID = requireString(args.runID, "runID");
      const mod = await loadWorkflow();
      const store = new mod.JsonlWorkflowStore(storeDir(context.workspaceRoot));
      const events = await store.events(runID);
      return JSON.stringify(events, null, 2);
    },
  };
}

function determineStatus(
  events: Array<{ type: string }>,
): "running" | "completed" | "failed" | "cancelled" | "unknown" {
  if (events.length === 0) return "unknown";
  const last = events[events.length - 1]!.type;
  switch (last) {
    case "run_completed":
      return "completed";
    case "run_cancelled":
      return "cancelled";
    case "step_failed":
      return "failed";
    case "run_started":
    case "step_started":
    case "step_completed":
      return "running";
    default:
      return "unknown";
  }
}
