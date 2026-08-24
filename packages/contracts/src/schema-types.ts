import { z } from "zod";
import * as foundation from "./schema-foundation";
import * as workflow from "./schema-workflow";
import * as config from "./schema-config";
import * as governance from "./schema-governance";
export type SandboxBackend = z.infer<
  typeof foundation.sandboxConfigSchema
>["backend"];

export type ConfigV3 = z.infer<typeof config.configV3Schema>;
export type PluginPackageSource = z.infer<
  typeof config.pluginPackageSourceSchema
>;
export type PluginPackageConfig = z.infer<
  typeof config.pluginPackageConfigSchema
>;
export type NataliaLock = z.infer<typeof config.nataliaLockSchema>;
export type ModelRef = z.infer<typeof foundation.modelRefSchema>;
export type ModelCapabilities = z.infer<
  typeof foundation.modelCapabilitiesSchema
>;
export type ModelLimits = z.infer<typeof foundation.modelLimitsSchema>;
export type CatalogModel = z.infer<typeof foundation.catalogModelSchema>;
export type ModelCatalog = z.infer<typeof foundation.modelCatalogSchema>;
export type ProviderConfig = z.infer<typeof foundation.providerConfigSchema>;
export type ProviderConnection = z.infer<
  typeof foundation.providerConnectionSchema
>;
export type ProviderRequestDefaults = z.infer<
  typeof foundation.providerRequestDefaultsSchema
>;
export type ModelOverride = z.infer<typeof foundation.modelOverrideSchema>;
export type ModelOverrideRequestDefaults = z.infer<
  typeof foundation.modelOverrideRequestDefaultsSchema
>;
export type PermissionProfile = z.infer<
  typeof workflow.permissionProfileSchema
>;
export type IssueTargetConfig = z.infer<
  typeof governance.issueTargetConfigSchema
>;
export type DataSourceConfig = z.infer<
  typeof governance.dataSourceConfigSchema
>;
export type AlertChannelConfig = z.infer<
  typeof governance.alertChannelConfigSchema
>;
export type InteractiveProgramRules = z.infer<
  typeof workflow.interactiveProgramRulesSchema
>;
export type ExtensionRules = z.infer<typeof workflow.extensionRulesSchema>;
export type NataliaFlowDocument = z.infer<
  typeof workflow.nataliaFlowDocumentSchema
>;
export type NataliaTaskDocument = z.infer<
  typeof workflow.nataliaTaskDocumentSchema
>;
export type NataliaFlowDocumentInput = z.input<
  typeof workflow.nataliaFlowDocumentSchema
>;
export type NataliaTaskDocumentInput = z.input<
  typeof workflow.nataliaTaskDocumentSchema
>;
export type FlowConditionDecomposition = z.infer<
  typeof workflow.flowConditionDecompositionSchema
>;
export type EvaluatorResult = z.infer<typeof workflow.evaluatorResultSchema>;
export type ModeConfig = z.infer<typeof foundation.modeConfigSchema>;
export type AgentConfig = z.infer<typeof workflow.agentConfigSchema>;
export type AgentPermissionRules = z.infer<
  typeof workflow.agentPermissionRulesSchema
>;
export type MCPServerConfig = z.infer<typeof config.mcpServerConfigSchema>;
export type PolicyStatement = z.infer<typeof governance.policyStatementSchema>;
export type CapabilityManifest = z.infer<
  typeof governance.capabilityManifestSchema
>;
export type CompletionEvidence = z.infer<
  typeof governance.completionEvidenceSchema
>;
export type DriftFinding = z.infer<typeof governance.driftFindingSchema>;
export type WorkGraphNode = z.infer<typeof governance.workGraphNodeSchema>;
export type WorkGraphEdge = z.infer<typeof governance.workGraphEdgeSchema>;
export type SessionIntelligenceSnapshot = z.infer<
  typeof governance.sessionIntelligenceSnapshotSchema
>;
export type ToolCanonicalRegistration = z.infer<
  typeof governance.toolCanonicalRegistrationSchema
>;
export type ConstitutionRule = z.infer<
  typeof governance.constitutionRuleSchema
>;
export type DecisionRecord = z.infer<typeof governance.decisionRecordSchema>;
export type ScopedOverride = z.infer<typeof governance.scopedOverrideSchema>;
/**
 * Task and flow overview shapes.
 *
 * These live in contracts rather than in the client because they are wire types:
 * they cross the RPC boundary so an external integration can list and inspect
 * unattended work without running the CLI. The runtime computes them; nobody
 * else may invent them.
 */
export type ScheduledTaskRow = {
  taskID: string;
  displayName: string;
  path: string;
  /** The task's own human-readable cadence. The real schedule belongs to the scheduler. */
  schedule: string;
  permissionProfile: string;
  flowID: string;
  enabledModules: number;
  retry: NataliaTaskDocument["retry"];
  alertChannels: string[];
  /** Channel and event pairs the task subscribed to, for the detail surfaces. */
  alertEvents: string[];
  issueTarget?: string;
  dataSource?: string;
  systemd?: {
    calendar: string;
    scope: "user" | "system";
    timerUnit?: string;
    nextRun?: string;
    generatedCalendar?: string;
  };
  lastRun?: {
    invocationID: string;
    status: string;
    startedAt: string;
    endedAt?: string;
    skipReason?: string;
  };
  consecutiveFailures: number;
  pendingAlertDeliveries: number;
  /** Reasons this task would refuse to run right now, empty when it is ready. */
  problems: string[];
};

export type FlowStageRow = {
  moduleID: string;
  moduleType: string;
  displayName: string;
  enabled: boolean;
  minimumConditions: number;
  idealConditions: number;
  hasInstructions: boolean;
  commandRules?: { mode: string; commands: number };
  interactivePrograms: number | "any";
};

export type FlowRow = {
  flowID: string;
  displayName: string;
  path: string;
  stages: FlowStageRow[];
  enabledStages: number;
  /** Tasks in this workspace that run this flow. */
  usedBy: string[];
  problems: string[];
};

export type FlowOverview = {
  flows: FlowRow[];
  unreadable: Array<{ path: string; reason: string }>;
};

export type ScheduledTaskOverview = {
  tasks: ScheduledTaskRow[];
  /** Task documents that could not be read at all. */
  unreadable: Array<{ path: string; reason: string }>;
};

/** A managed task or flow document and whether its definition is ready to launch. */
export type WorkflowDocumentChoice = {
  kind: "task" | "flow";
  path: string;
  id: string;
  displayName: string;
  source: { kind: "workspace" } | { kind: "capability"; capabilityID: string };
  launch: { ready: true } | { ready: false; reason: string };
};

/**
 * The Work Graph vocabulary as types, so a writer cannot invent its own spelling.
 * `workgraph.node_added` / `workgraph.edge_added` declared `kind: string`, which
 * is how a parallel CamelCase vocabulary once reached the journal unnoticed.
 */
export type WorkGraphNodeKind = WorkGraphNode["kind"];
export type WorkGraphEdgeKind = WorkGraphEdge["kind"];
