"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertChannelConfigSchema = exports.dataSourceConfigSchema = exports.issueTargetConfigSchema = exports.experimentalConfigSchema = exports.policyStatementSchema = exports.scopedOverrideSchema = exports.workGraphEdgeSchema = exports.capabilityManifestSchema = exports.toolCanonicalRegistrationSchema = exports.driftFindingSchema = exports.sessionIntelligenceSnapshotSchema = exports.workGraphNodeSchema = exports.completionEvidenceSchema = exports.validationRunSchema = exports.decisionScopeSchema = exports.decisionRecordSchema = exports.constitutionRuleSchema = void 0;
var zod_1 = require("zod");
exports.constitutionRuleSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    statement: zod_1.z.string().min(1),
    scope: zod_1.z.enum(["project", "package", "sandbox", "task", "release"]),
    priority: zod_1.z.enum(["critical", "high", "medium", "low"]),
    /** `agent_proposed` marks a model-authored rule approved by the user (EI §3.8 P-1.c). */
    source: zod_1.z.enum(["user", "master_plan", "policy", "agent_proposed"]),
    enforcement: zod_1.z.enum(["deny", "approval", "warn"]),
    overridePolicy: zod_1.z.enum(["forbidden", "user_scoped", "user_explicit"]),
    evidenceRefs: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.decisionRecordSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    decision: zod_1.z.string().min(1),
    rationale: zod_1.z.array(zod_1.z.string()).default([]),
    alternatives: zod_1.z
        .array(zod_1.z.object({
        option: zod_1.z.string(),
        rejectedReason: zod_1.z.string().optional(),
    }))
        .default([]),
    consequences: zod_1.z.array(zod_1.z.string()).default([]),
    status: zod_1.z.enum(["proposed", "accepted", "superseded"]),
    scope: zod_1.z.array(zod_1.z.string()).default([]),
    linkedPlans: zod_1.z.array(zod_1.z.string()).default([]),
    linkedConstraints: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.decisionScopeSchema = zod_1.z.enum(["session", "workspace"]);
exports.validationRunSchema = zod_1.z.object({
    command: zod_1.z.string(),
    target: zod_1.z.string(),
    result: zod_1.z.enum(["passed", "failed", "skipped"]),
    durationMs: zod_1.z.number().int().positive().optional(),
    outputArtifact: zod_1.z.string().optional(),
    safeSummary: zod_1.z.string(),
});
exports.completionEvidenceSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    taskID: zod_1.z.string().min(1),
    objective: zod_1.z.string().min(1),
    status: zod_1.z.enum([
        "planned",
        "implemented",
        "validated",
        "accepted",
        "promoted",
        "blocked",
        "failed",
        "partial",
    ]),
    changes: zod_1.z
        .array(zod_1.z.object({
        path: zod_1.z.string(),
        changeType: zod_1.z.enum(["added", "modified", "deleted"]),
        summary: zod_1.z.string(),
    }))
        .default([]),
    validations: zod_1.z.array(exports.validationRunSchema).default([]),
    knownGaps: zod_1.z.array(zod_1.z.string()).default([]),
    rollback: zod_1.z
        .object({
        checkpointID: zod_1.z.string().optional(),
        sandboxID: zod_1.z.string().optional(),
    })
        .optional(),
    workGraphRefs: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.workGraphNodeSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    kind: zod_1.z.enum([
        "goal",
        "constraint",
        "decision",
        "plan",
        "plan_step",
        "agent_action",
        "tool_call",
        "approval",
        "checkpoint",
        "validation",
        "workspace_change",
    ]),
    summary: zod_1.z.string(),
    actor: zod_1.z.string().optional(),
    target: zod_1.z.string().optional(),
    journalOffset: zod_1.z.number().int().nonnegative().optional(),
    sessionID: zod_1.z.string().optional(),
    turnID: zod_1.z.string().optional(),
    stepID: zod_1.z.string().optional(),
    /** The plan this node belongs to (B7 provenance: which plan's commitment). */
    planID: zod_1.z.string().optional(),
});
exports.sessionIntelligenceSnapshotSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    agentStatus: zod_1.z.string(),
    currentStep: zod_1.z.string().optional(),
    activeTool: zod_1.z.string().optional(),
    changedFiles: zod_1.z.number().int().nonnegative().default(0),
    unvalidatedChanges: zod_1.z.number().int().nonnegative().default(0),
    recentOutput: zod_1.z.string().max(2000).optional(),
    hasPTY: zod_1.z.boolean().default(false),
    hasSandbox: zod_1.z.boolean().default(false),
});
exports.driftFindingSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    severity: zod_1.z.enum(["advisory", "warning", "high"]),
    confidence: zod_1.z.number().min(0).max(1),
    originalObjective: zod_1.z.string().min(1),
    currentActivity: zod_1.z.string().min(1),
    evidence: zod_1.z.array(zod_1.z.string()).default([]),
    applicableConstraints: zod_1.z.array(zod_1.z.string()).default([]),
    status: zod_1.z.enum([
        "open",
        "explained",
        "disputed",
        "dismissed",
        "corrected",
        "detour_declared",
    ]),
    options: zod_1.z
        .array(zod_1.z.object({
        label: zod_1.z.string(),
        action: zod_1.z.string(),
    }))
        .default([]),
});
exports.toolCanonicalRegistrationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    owner: zod_1.z.string().min(1),
    scope: zod_1.z.enum(["process", "workspace", "session"]),
    recovery: zod_1.z
        .enum(["none", "retry", "restart", "fail_closed"])
        .default("retry"),
    precedence: zod_1.z.number().int().default(0),
    grants: zod_1.z.array(zod_1.z.string()).default([]),
    requiresApproval: zod_1.z.boolean().default(false),
});
exports.capabilityManifestSchema = zod_1.z.object({
    apiVersion: zod_1.z.literal(1),
    id: zod_1.z.string().min(1),
    version: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    scope: zod_1.z.enum(["process", "workspace", "session"]),
    dependencies: zod_1.z.array(zod_1.z.string()).default([]),
    grants: zod_1.z
        .array(zod_1.z.enum([
        "tools",
        "commands",
        "settings",
        "settingsSchema",
        "workflows",
        "projection",
        "projections",
        "resources",
        "adapters",
        "schedulerJobs",
        "listeners",
        "services",
    ]))
        .default([]),
});
exports.workGraphEdgeSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    sourceID: zod_1.z.string().min(1),
    targetID: zod_1.z.string().min(1),
    kind: zod_1.z.enum([
        "requested_by",
        "constrained_by",
        "planned_by",
        "executed_by",
        "caused",
        "modified",
        "validated_by",
        "approved_by",
        // A refusal is a fact too. Recording one as `approved_by` would make the
        // graph answer "who authorized this side effect" with someone who refused it.
        "rejected_by",
        "checkpointed_by",
        "superseded_by",
        "rolled_back_by",
    ]),
    reason: zod_1.z.string().optional(),
});
exports.scopedOverrideSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    ruleID: zod_1.z.string().min(1),
    reason: zod_1.z.string().min(1),
    scope: zod_1.z.object({
        paths: zod_1.z.array(zod_1.z.string()).optional(),
        taskID: zod_1.z.string().optional(),
        expiresAt: zod_1.z.string().optional(),
    }),
    approvedBy: zod_1.z.literal("user"),
});
exports.policyStatementSchema = zod_1.z.object({
    effect: zod_1.z.enum(["allow", "deny"]),
    action: zod_1.z.string().min(1),
    resource: zod_1.z.string().min(1),
});
exports.experimentalConfigSchema = zod_1.z.object({
    policies: zod_1.z.array(exports.policyStatementSchema).default([]),
});
exports.issueTargetConfigSchema = zod_1.z.object({
    kind: zod_1.z.enum(["gitea", "github"]),
    baseURL: zod_1.z.string().min(1),
    owner: zod_1.z.string().min(1),
    repo: zod_1.z.string().min(1),
    /** Bot credential. It stays in configuration and never enters a task, a flow, a prompt or the model context. */
    token: zod_1.z.string().default(""),
    label: zod_1.z.string().default(""),
    enabled: zod_1.z.boolean().default(true),
});
/**
 * Append-only source a task consumes incrementally: an application log, an
 * exported report, an audit trail, or anything else that only grows. The path is
 * deployment specific, so it lives in configuration rather than in the
 * version-controlled task document, and the model never chooses it.
 */
exports.dataSourceConfigSchema = zod_1.z.object({
    path: zod_1.z.string().min(1),
    kind: zod_1.z.enum(["offset", "timestamp"]).default("offset"),
    /**
     * Required by `kind: "timestamp"`: the JSON field each line carries its own
     * time in. The operator names it, because guessing at log formats would mean
     * shipping a vendor adapter per source. Ignored by `kind: "offset"`.
     */
    timestampField: zod_1.z.string().default(""),
    maxBytes: zod_1.z.number().int().positive().default(65536),
    enabled: zod_1.z.boolean().default(true),
});
/**
 * Where a task alert is delivered. The journal channel is the durable queue and
 * the process output itself; a webhook is an external endpoint. Credentials stay
 * here and never enter a task document, a prompt, a systemd unit or the queue.
 */
exports.alertChannelConfigSchema = zod_1.z.object({
    kind: zod_1.z.enum(["journal", "webhook"]),
    url: zod_1.z.string().default(""),
    token: zod_1.z.string().default(""),
    timeoutMs: zod_1.z.number().int().positive().default(10000),
    enabled: zod_1.z.boolean().default(true),
});
