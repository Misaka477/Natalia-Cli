import { z } from "zod";
import * as foundation from "./schema-foundation";
import * as workflow from "./schema-workflow";
import * as config from "./schema-config";
import * as governance from "./schema-governance";
export type SandboxBackend = z.infer<
  typeof foundation.sandboxConfigSchema
>["backend"];

/** The goal completion check, straight from the config schema. */
export type GoalConfig = z.infer<typeof foundation.goalConfigSchema>;

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
export type AgentMode = z.infer<typeof workflow.agentModeSchema>;
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
 * The Work Graph vocabulary as types, so a writer cannot invent its own spelling.
 * `workgraph.node_added` / `workgraph.edge_added` declared `kind: string`, which
 * is how a parallel CamelCase vocabulary once reached the journal unnoticed.
 */
export type WorkGraphNodeKind = WorkGraphNode["kind"];
export type WorkGraphEdgeKind = WorkGraphEdge["kind"];
