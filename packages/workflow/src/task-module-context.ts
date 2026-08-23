import type {
  AgentPermissionRules,
  ExtensionRules,
  InteractiveProgramRules,
  PermissionProfile,
} from "@natalia/contracts";
import type { NataliaFlowModuleType } from "./natalia-module-policy";
import type { NataliaTaskStateStore } from "./natalia-task-state-store";

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
