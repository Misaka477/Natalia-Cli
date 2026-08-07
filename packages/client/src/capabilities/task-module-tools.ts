/**
 * Task-scoped capability: the three tools that only exist while a flow module
 * is the active execution context.
 *
 * This module owns its own context contract (`TaskModuleContext`) rather than
 * deriving it from the runtime options, so the dependency runs one way: the
 * composition root consumes the capability, never the reverse. That is what
 * makes the factories testable without constructing a runtime.
 *
 * Two of these tools carry a credential or a read position that the model must
 * never see. The controller binds them here as closures, so `report_issue`
 * cannot leak a token into arguments, the process list or the journal, and
 * `read_data_source` cannot let the model choose its own offset.
 */
import type { RuntimeTool } from "@natalia/tools";
import type {
  NataliaFlowModuleType,
  NataliaTaskStateStore,
} from "@natalia/workflow";
import type { ExtensionRules } from "@natalia/contracts";
import type {
  InteractiveProgramAuthorization,
  PermissionProfileCommandRules,
  PermissionRules,
} from "../tool-policy";

export type TaskModuleContext = {
  store: NataliaTaskStateStore;
  invocationID: string;
  attempt: number;
  flowID: string;
  moduleID: string;
  moduleType: NataliaFlowModuleType;
  moduleInstructions?: string;
  moduleCommandRules?: PermissionProfileCommandRules;
  /** Interactive programs the active module allows, intersected with the profile. */
  moduleInteractivePrograms?: InteractiveProgramAuthorization;
  /** Module-level extension switches can only further narrow the profile. */
  moduleExtensions?: ExtensionRules;
  /** Module-level file/tool policies can only further narrow the profile. */
  modulePermissions?: PermissionRules;
  /** Controller-owned structured continuation for the active module only. */
  moduleContinuation?: string;
  /**
   * Runtime-side finding reconciliation. The controller binds the credential
   * here so the model can report a finding without ever seeing the token.
   */
  reportIssue?: (finding: {
    fingerprintParts: string[];
    title: string;
    body: string;
    labels?: string[];
  }) => Promise<Record<string, unknown>>;
  /**
   * Runtime-side incremental read of the task's configured append-only source.
   * The controller stages the new position; the model never sees an offset.
   */
  readDataSource?: (input: {
    maxBytes?: number;
  }) => Promise<Record<string, unknown>>;
};

export type TaskReportIssue = NonNullable<TaskModuleContext["reportIssue"]>;
export type TaskReadDataSource = NonNullable<
  TaskModuleContext["readDataSource"]
>;

/**
 * The tools this capability contributes, given a module context. The order is
 * stable so a caller can register them without re-deriving which of the
 * optional controller bindings were supplied.
 */
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
        conditionStatuses: { type: "array" },
        evidenceRefs: { type: "array" },
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

/**
 * The report tool submits a finding to the runtime, which owns the credential
 * and performs the request. The model never sees the token and never runs
 * `curl`, so the credential cannot reach the command line, the process list or
 * the journal.
 */
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

/**
 * The runtime owns the read position of an external log, so the model asks for
 * "what is new" instead of tracking byte offsets itself. The position is staged
 * by the controller and only becomes durable when the whole task succeeds.
 */
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
      throw new Error(`conditionStatuses[${index}].status is invalid`);
    return {
      id,
      status: status as "missing" | "partial" | "satisfied",
    };
  });
}
