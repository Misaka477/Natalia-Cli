"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmedWorkspaceChangeSchema = exports.workspaceObservationSchema = exports.workspaceCorrelationSchema = exports.workspaceChangeAttributionSchema = exports.workspaceChangeOriginSchema = exports.workspaceOperationSchema = exports.workspaceObservationHealthReasonSchema = exports.workspaceObservationHealthSchema = void 0;
var zod_1 = require("zod");
/**
 * WG4 workspace observation / confirmed change contract (§56.9, Phase 1).
 *
 * Phase 1 defines the secret-safe contract before any watcher hint is promoted
 * to a confirmed fact. Three rules shape it:
 *
 * 1. **A watcher event is only a hint.** A `WorkspaceObservation` records what
 *    was seen and the health it was seen under; it never claims a path,
 *    operation type or actor by itself. Only a reconciled
 *    `ConfirmedWorkspaceChange` is a fact that can reach the Work Graph.
 * 2. **No secrets.** The contract carries workspace-relative paths, operation
 *    types, correlation metadata and health — never file content, diffs,
 *    patches, command text, tool arguments or results, context snapshots or
 *    raw errors. `assertSecretSafeObservation` in `@natalia/client` enforces
 *    the boundary at a single point.
 * 3. **Attribution is constrained, not free text.** `origin` and `attribution`
 *    are enums, and a change with no reliable identity stays unattributed or
 *    indeterminate instead of being force-attributed.
 */
exports.workspaceObservationHealthSchema = zod_1.z.enum([
    "healthy",
    "degraded",
    "unavailable",
]);
exports.workspaceObservationHealthReasonSchema = zod_1.z.enum([
    "watcher_error",
    "inotify_limit",
    "directory_replaced",
    "permission_changed",
    "event_integrity_uncertain",
    "reconciliation_timeout",
]);
exports.workspaceOperationSchema = zod_1.z.enum([
    "added",
    "modified",
    "deleted",
    "renamed",
]);
exports.workspaceChangeOriginSchema = zod_1.z.enum([
    "tool",
    "sandbox_merge",
    "checkpoint_rollback",
    "external",
    "unknown",
]);
exports.workspaceChangeAttributionSchema = zod_1.z.enum([
    "attributed",
    "unattributed",
    "indeterminate",
]);
/**
 * Which execution a change correlates with. A turn identity is
 * `turnID`+`callID` together; a non-turn operation uses `operationID`
 * (sandbox merge, checkpoint rollback, a direct runtime side-effect API).
 * Both are optional: a confirmed external change carries neither, and that is
 * exactly the "confirmed but source unknown" case.
 */
exports.workspaceCorrelationSchema = zod_1.z
    .object({
    sessionID: zod_1.z.string().optional(),
    episodeID: zod_1.z.string().optional(),
    turnID: zod_1.z.string().optional(),
    callID: zod_1.z.string().optional(),
    operationID: zod_1.z.string().optional(),
})
    .refine(function (correlation) { return !(correlation.operationID && correlation.turnID); }, "a change correlates with either a turn identity (turnID+callID) or a non-turn operation identity, never both")
    .refine(function (correlation) { return !correlation.turnID || Boolean(correlation.callID); }, "a turn identity requires callID");
/**
 * A watcher-level hint, before reconciliation. `health` says how much the
 * observation is worth: a degraded watcher's hint must not become a confirmed
 * fact without a full reconciliation.
 */
exports.workspaceObservationSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    /** Workspace identity, not part of the changed path. */
    workspaceRoot: zod_1.z.string().min(1),
    /** Workspace-relative; never an absolute path. */
    path: zod_1.z.string().min(1),
    operation: exports.workspaceOperationSchema,
    health: exports.workspaceObservationHealthSchema,
    healthReason: exports.workspaceObservationHealthReasonSchema.optional(),
    correlation: exports.workspaceCorrelationSchema.optional(),
    /** Event-integrity is uncertain for the window this observation sits in. */
    indeterminate: zod_1.z.boolean().default(false),
    at: zod_1.z.string(),
});
/**
 * A change that survived reconciliation. This is the fact that may become a
 * `workspace_change` Work Graph node (Phase 4), never a raw observation.
 */
exports.confirmedWorkspaceChangeSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    workspaceRoot: zod_1.z.string().min(1),
    path: zod_1.z.string().min(1),
    operation: exports.workspaceOperationSchema,
    origin: exports.workspaceChangeOriginSchema,
    attribution: exports.workspaceChangeAttributionSchema,
    correlation: exports.workspaceCorrelationSchema,
    health: exports.workspaceObservationHealthSchema,
    healthReason: exports.workspaceObservationHealthReasonSchema.optional(),
    at: zod_1.z.string(),
});
