import type { AgentRegistry } from "@natalia/agent";
import type { ProviderConcurrencyLimiter } from "@natalia/runtime";
import type {
  InteractiveWaiter,
  RuntimeContextLedger,
} from "@natalia/runtime-services";
import type { SessionRecord } from "@natalia/session";

export type RuntimeInitializePorts = {
  getSession: () => SessionRecord | undefined;
  getReplayMode: () => "all" | "none";
  getInteractive: () => InteractiveWaiter;
  getAttachmentReferences: () => Map<
    string,
    import("@natalia/contracts").LocalAttachment[]
  >;
  getToolCalls: () => Map<string, number[]>;
  getActiveSkill: () =>
    | import("@natalia/runtime-services").SkillMetadata
    | undefined;
  getRuntimeDiagnosticsBySession: () => Map<
    import("@natalia/contracts").SessionID,
    Array<
      Extract<
        import("@natalia/contracts").RuntimeEvent,
        { type: "diagnostic" }
      > & {
        at: string;
      }
    >
  >;
  getTurnAgent: () => Map<string, string>;
  getSelectedPermissionProfile: () =>
    | import("@natalia/contracts").PermissionProfile
    | undefined;
  getAgentRegistry: () => AgentRegistry | undefined;
  getRuntimeContext: () => RuntimeContextLedger;
  getProviderConcurrencyLimiter: () => ProviderConcurrencyLimiter;
  getRetryPolicy: () => import("@natalia/runtime").RetryRunnerOptions["policy"];
};
