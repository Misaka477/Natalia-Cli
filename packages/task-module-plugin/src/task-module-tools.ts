import type {
  AgentPermissionRules,
  ExtensionRules,
  InteractiveProgramRules,
  PermissionProfile,
} from "@natalia/contracts";
import type { RuntimeTool } from "@natalia/tools";
import type {
  NataliaFlowModuleType,
  NataliaTaskStateStore,
} from "@natalia/workflow";

export type TaskModuleContext = {
  store: NataliaTaskStateStore;
  invocationID: string;
  attempt: number;
  flowID: string;
  moduleID: string;
  moduleType: NataliaFlowModuleType;
  moduleInstructions?: string;
  moduleCommandRules?: NonNullable<PermissionProfile["commandRules"]>;
  moduleInteractivePrograms?: InteractiveProgramRules;
  moduleExtensions?: ExtensionRules;
  modulePermissions?: AgentPermissionRules;
  moduleConditions?: Array<{
    id: string;
    text: string;
    kind: "minimum" | "ideal";
  }>;
  moduleContinuation?: string;
  reportIssue?: (finding: {
    fingerprintParts: string[];
    title: string;
    body: string;
    labels?: string[];
  }) => Promise<Record<string, unknown>>;
  readDataSource?: (input: {
    maxBytes?: number;
  }) => Promise<Record<string, unknown>>;
};

export type TaskReportIssue = NonNullable<TaskModuleContext["reportIssue"]>;
export type TaskReadDataSource = NonNullable<
  TaskModuleContext["readDataSource"]
>;

export function taskModuleTools(context: TaskModuleContext): RuntimeTool[] {
  const tools = [createFlowModuleCompleteTool(context)];
  if (context.reportIssue)
    tools.push(createReportIssueTool(context.reportIssue));
  if (context.readDataSource)
    tools.push(createReadDataSourceTool(context.readDataSource));
  return tools;
}

export function createFlowModuleCompleteTool(
  context: TaskModuleContext,
): RuntimeTool {
  return {
    name: "flow_module_complete",
    description:
      "Claim completion of the active flow module with condition status and attempt-scoped evidence. This records a claim only; it does not complete the task.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        flowID: { type: "string", minLength: 1 },
        moduleID: { type: "string", minLength: 1 },
        conditionStatuses: {
          type: "array",
          description:
            "One entry per declared completion condition, using the exact condition IDs from the module context.",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "The condition ID from the module context.",
              },
              status: {
                type: "string",
                enum: ["missing", "partial", "satisfied"],
                description:
                  "missing: not met; partial: partly met; satisfied: fully met.",
              },
              reason: {
                type: "string",
                description:
                  "Short justification tied to what happened this attempt.",
              },
              evidenceRefs: {
                type: "array",
                description:
                  "Tool call IDs backing this condition, each formatted exactly as tool:<callID>; empty when no tool call backs it.",
              },
            },
            required: ["id", "status"],
            additionalProperties: false,
          },
        },
        evidenceRefs: {
          type: "array",
          description:
            "Tool call IDs backing the conditions, each formatted exactly as tool:<callID> (for example tool:call_01_xxx). Only reference tool calls you actually made this attempt. Leave empty when a condition is met without tool evidence; file names or paths are never valid refs.",
        },
        gaps: { type: "array" },
        recommendedAction: { type: "string", minLength: 1 },
      },
      required: [
        "flowID",
        "moduleID",
        "conditionStatuses",
        "evidenceRefs",
        "gaps",
        "recommendedAction",
      ],
      additionalProperties: false,
    },
    async execute(input) {
      const args = requireToolObject(input);
      const flowID = requireToolString(args.flowID, "flowID");
      const moduleID = requireToolString(args.moduleID, "moduleID");
      const conditionStatuses = requireConditionStatuses(
        args.conditionStatuses,
      );
      const evidenceRefs = requireStringList(args.evidenceRefs, "evidenceRefs");
      const gaps = requireStringList(args.gaps, "gaps");
      const recommendedAction = requireToolString(
        args.recommendedAction,
        "recommendedAction",
      );
      context.store.claimModule({
        invocationID: context.invocationID,
        attempt: context.attempt,
        claim: {
          flowID,
          moduleID,
          conditionStatuses,
          evidenceRefs,
          gaps,
          recommendedAction,
        },
      });
      return JSON.stringify({
        flowID,
        moduleID,
        status: "claimed",
        message:
          "Module completion claim recorded. The task is not complete until the controller evaluates this claim.",
      });
    },
  };
}

export function createReportIssueTool(
  reportIssue: TaskReportIssue,
): RuntimeTool {
  return {
    name: "report_issue",
    description:
      "Report a finding to the configured issue target. The runtime deduplicates by fingerprint, updates an existing issue instead of creating a second one, and refuses to reopen a finding a human closed.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        fingerprintParts: { type: "array" },
        title: { type: "string", minLength: 1 },
        body: { type: "string", minLength: 1 },
        labels: { type: "array" },
      },
      required: ["fingerprintParts", "title", "body"],
      additionalProperties: false,
    },
    async execute(input) {
      const args = requireToolObject(input);
      const result = await reportIssue({
        fingerprintParts: requireStringList(
          args.fingerprintParts,
          "fingerprintParts",
        ),
        title: requireToolString(args.title, "title"),
        body: requireToolString(args.body, "body"),
        labels:
          args.labels === undefined
            ? undefined
            : requireStringList(args.labels, "labels"),
      });
      return JSON.stringify(result);
    },
  };
}

export function createReadDataSourceTool(
  readDataSource: TaskReadDataSource,
): RuntimeTool {
  return {
    name: "read_data_source",
    description:
      "Read the part of the configured data source that has not been consumed yet. The runtime owns the position: the response reports what it read and the position the next read continues from. Depending on the source, a rotated file is either reread from the beginning or resumed from the last entry time.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { maxBytes: { type: "number" } },
      required: [],
      additionalProperties: false,
    },
    async execute(input) {
      const args =
        input && typeof input === "object" && !Array.isArray(input)
          ? (input as Record<string, unknown>)
          : {};
      const maxBytes = args.maxBytes;
      if (maxBytes !== undefined && typeof maxBytes !== "number")
        throw new Error("maxBytes must be a number");
      return JSON.stringify(await readDataSource({ maxBytes }));
    },
  };
}

function requireToolObject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("flow module completion input must be an object");
  return input as Record<string, unknown>;
}

function requireToolString(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} must be a non-empty string`);
  return value;
}

function requireStringList(value: unknown, name: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`${name} must be an array of strings`);
  return value as string[];
}

function requireConditionStatuses(value: unknown) {
  if (!Array.isArray(value))
    throw new Error("conditionStatuses must be an array");
  return value.map((condition, index) => {
    if (!condition || typeof condition !== "object" || Array.isArray(condition))
      throw new Error(`conditionStatuses[${index}] must be an object`);
    const entry = condition as Record<string, unknown>;
    const id = requireToolString(entry.id, `conditionStatuses[${index}].id`);
    const status = entry.status;
    if (status !== "missing" && status !== "partial" && status !== "satisfied")
      throw new Error(
        `conditionStatuses[${index}].status is invalid; expected one of: missing, partial, satisfied`,
      );
    return {
      id,
      status: status as "missing" | "partial" | "satisfied",
    };
  });
}
