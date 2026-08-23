import type { AgentRegistry } from "@natalia/agent";
import type { ConfigV3 } from "@natalia/contracts";
import type { ProviderConcurrencyLimiter } from "@natalia/runtime";
import type {
  AttachmentService,
  CompactionService,
  ContextLedgerFactory,
  GovernanceLedgerController,
  InteractiveWaiter,
  RuntimeContextLedger,
  StatusSnapshotController,
  TurnController,
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
  getToolCalls: () => Map<string, number>;
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
    | ConfigV3["permissionProfiles"][string]
    | undefined;
  getAgentRegistry: () => AgentRegistry | undefined;
  getAttachmentService: () => AttachmentService;
  getCompactionService: () => CompactionService | undefined;
  getContextLedgerFactory: () => ContextLedgerFactory;
  getGovernanceLedgerController: () => GovernanceLedgerController;
  getRuntimeContext: () => RuntimeContextLedger;
  getStatusController: () => StatusSnapshotController;
  getTurnController: () => TurnController;
  getTaskWorkflowController: () =>
    | import("@natalia/runtime-services").TaskWorkflowController
    | undefined;
  getProviderConcurrencyLimiter: () => ProviderConcurrencyLimiter;
  getRetryPolicy: () => import("@natalia/runtime").RetryRunnerOptions["policy"];
  setBuildBuiltinPluginCatalog: (
    build: (
      config: ConfigV3,
    ) => import("./initialize-types").BuiltinPluginCatalog,
  ) => void;
  setGovernanceLedgerController: (
    controller: GovernanceLedgerController,
  ) => void;
};
