"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUNTIME_MEMBER_REFUSAL_SEMANTICS = void 0;
exports.membersRefusingByValue = membersRefusingByValue;
exports.RUNTIME_MEMBER_REFUSAL_SEMANTICS = {
    // --- required ---
    start: {
        refusal: "none",
        note: "attaches a sink; remote consumers subscribe to /events instead",
    },
    submit: {
        refusal: "error",
        note: "a turn either starts or does not; a rejected submission has no partial value to report",
    },
    submitAndWait: {
        refusal: "error",
        note: "same refusal semantics as submit; the blocking variant waits for the terminal turn event",
    },
    cancel: {
        refusal: "none",
        note: "idempotent; cancelling nothing is not a refusal",
    },
    snapshot: { refusal: "none", note: "pure read" },
    diagnostic: { refusal: "none", note: "records a fact; cannot decline" },
    lastSubmission: { refusal: "none", note: "local accessor" },
    respondApproval: {
        refusal: "value",
        expressedBy: "accepted",
        note: "a response to a request that timed out or was already answered is dropped, and the caller has to be told; it used to answer responded:true either way",
    },
    respondQuestion: {
        refusal: "value",
        expressedBy: "accepted",
        note: "same as respondApproval",
    },
    respondInteractive: {
        refusal: "value",
        expressedBy: "accepted",
        note: "an answer to a generic request that is no longer pending is dropped, and the caller learns from accepted:false",
    },
    // --- transcript ---
    history: { refusal: "none", note: "pure read" },
    eventWindow: { refusal: "none", note: "pure read" },
    messages: { refusal: "none", note: "pure read" },
    pendingInteractive: { refusal: "none", note: "pure read" },
    submitInput: { refusal: "error", note: "as submit" },
    // --- turnControl ---
    pause: {
        refusal: "value",
        expressedBy: "paused",
        note: "nothing running, or already paused, is an ordinary answer",
    },
    resume: {
        refusal: "value",
        expressedBy: "resumed",
        note: "nothing paused is an ordinary answer",
    },
    removeInput: {
        refusal: "value",
        expressedBy: "ok",
        note: "an input that is missing or already claimed cannot be removed; the caller learns that from ok:false",
    },
    replaceInput: {
        refusal: "value",
        expressedBy: "ok",
        note: "as removeInput",
    },
    promoteInput: {
        refusal: "value",
        expressedBy: "ok",
        note: "only a queued next-turn can be promoted; an input already claimed answers ok:false",
    },
    // --- lifecycle ---
    dispose: {
        refusal: "none",
        note: "idempotent teardown; intentionally not routed remotely",
    },
    canReloadConfig: {
        refusal: "value",
        expressedBy: "allowed",
        note: "advisory precheck; the action re-checks for itself",
    },
    reloadConfig: {
        refusal: "value",
        expressedBy: "applied",
        note: "the reference case: applying new policy under a running turn is refused, and refusing is normal",
    },
    updateConfig: {
        refusal: "value",
        expressedBy: "applied",
        note: "the file may be written while a running turn prevents application, and that is an ordinary answer",
    },
    configGet: {
        refusal: "error",
        note: "pure read; an unavailable runtime configuration is an initialization error",
    },
    settingsGet: {
        refusal: "error",
        note: "pure read; an unreadable settings file is a file error",
    },
    settingsSet: {
        refusal: "error",
        note: "an invalid patch or unwritable file leaves no safe partial write",
    },
    // --- selection ---
    agents: { refusal: "none", note: "pure read" },
    selectAgent: {
        refusal: "value",
        expressedBy: "outcome",
        note: "three real outcomes exist in the runtime — applied, deferred until the turn ends, unknown agent — and the caller could see none of them",
    },
    modelCatalog: { refusal: "none", note: "pure read" },
    modelSelection: { refusal: "none", note: "pure read" },
    selectModel: {
        refusal: "error",
        note: "the caller named a model it needs; an unavailable model or unknown variant leaves nothing to proceed with, so there is no partial success to report",
    },
    setDefaultModel: {
        refusal: "value",
        expressedBy: "saved",
        note: "sets the global default model reference",
    },
    reasoningEffort: { refusal: "none", note: "pure read" },
    setReasoningEffort: {
        refusal: "error",
        note: "an unsupported effort or unavailable session leaves no partial state change",
    },
    skills: { refusal: "none", note: "pure read" },
    // --- workspace ---
    workspaceFiles: { refusal: "none", note: "pure read of the catalog" },
    workspaceSearch: {
        refusal: "error",
        note: "path and pattern policy refuse; the reason never names the resolved path",
    },
    workspaceList: { refusal: "error", note: "path policy refuses" },
    workspaceRead: {
        refusal: "error",
        note: "path policy and the size limit refuse",
    },
    resourceRead: {
        refusal: "error",
        note: "resource ownership, reader ACL, path policy and size limits refuse",
    },
    workspaceWrite: {
        refusal: "value",
        expressedBy: "written",
        note: "a file write succeeds or reports a refusal; the value carries the outcome",
    },
    workspaceCreate: {
        refusal: "value",
        expressedBy: "created",
        note: "a file or directory creation succeeds or reports a refusal; the value carries the outcome",
    },
    workspaceRename: {
        refusal: "value",
        expressedBy: "renamed",
        note: "a rename succeeds or reports a refusal; the value carries the outcome",
    },
    workspaceDelete: {
        refusal: "value",
        expressedBy: "deleted",
        note: "a delete moves to the system trash or reports a refusal; the value carries the outcome",
    },
    workspaceWriteConflicts: {
        refusal: "none",
        note: "pure local lock-state read",
    },
    workspaceGlob: {
        refusal: "error",
        note: "path and pattern policy refuse",
    },
    workspaceRoots: { refusal: "none", note: "pure read" },
    workspaceAdd: {
        refusal: "error",
        note: "workspace root policy refuses",
    },
    workspaceRemove: {
        refusal: "error",
        note: "workspace root policy refuses",
    },
    workspaceActivate: {
        refusal: "error",
        note: "workspace root policy refuses",
    },
    workspacePermissionGet: { refusal: "none", note: "pure read" },
    workspacePermissionSet: {
        refusal: "error",
        note: "workspace permission policy refuses",
    },
    workspaceToolGet: { refusal: "none", note: "pure read" },
    workspaceToolSet: {
        refusal: "error",
        note: "workspace tool policy refuses",
    },
    // --- nativeTerminal ---
    // No routes until the API plan's P0-C, which is also when the I2 interlock's
    // refusal stops being an untyped Error.
    nativeTerminalList: { refusal: "none", note: "pure read" },
    nativeTerminalRead: {
        refusal: "error",
        note: "output is withheld while a human is entering a secret",
    },
    nativeTerminalOpenHub: {
        refusal: "error",
        note: "I1 will refuse a background session asking for the human's focus",
    },
    nativeTerminalRevokeApprovalScope: {
        refusal: "error",
        note: "no scope to revoke is an argument error; the interlock refuses",
    },
    nativeTerminalReleaseHumanControl: {
        refusal: "error",
        note: "releasing control mid-secret-input is refused",
    },
    nativeTerminalBeginSecureInput: {
        refusal: "error",
        note: "secure input requires human control, and is refused without it",
    },
    nativeTerminalEndSecureInput: {
        refusal: "error",
        note: "ending somebody else's secure input is refused",
    },
    nativeTerminalStop: {
        refusal: "error",
        note: "the interlock refuses while a human is entering a secret",
    },
    nativeTerminalStart: {
        refusal: "error",
        note: "refused when the host has not enabled terminal writes, or the terminal host is unavailable",
    },
    nativeTerminalWrite: {
        refusal: "error",
        note: "refused while a human holds input or secure input is active; an idempotency key replay answers delivery:duplicate instead",
    },
    nativeTerminalResize: {
        refusal: "error",
        note: "refused by the secure-input interlock, like the model-side resize",
    },
    nativeTerminalClaimHumanInput: {
        refusal: "error",
        note: "claiming human input is refused while another party holds it or secure input is active",
    },
    // --- checkpoint ---
    checkpointList: { refusal: "none", note: "pure read" },
    checkpointPreview: { refusal: "none", note: "pure read" },
    checkpointRollback: {
        refusal: "error",
        note: "a rollback that cannot run leaves the tree untouched and has nothing to report but why",
    },
    checkpointRename: {
        refusal: "error",
        note: "an unknown checkpoint is an argument error",
    },
    // --- sandbox ---
    sandboxList: { refusal: "none", note: "pure read" },
    sandboxDiff: { refusal: "none", note: "pure read" },
    sandboxResources: { refusal: "none", note: "pure read" },
    sandboxResourceOutput: { refusal: "none", note: "pure read" },
    sandboxMerge: {
        refusal: "error",
        note: "a merge that conflicts or is not allowed changes nothing",
    },
    sandboxDelete: {
        refusal: "error",
        note: "running resources block deletion",
    },
    sandboxRollback: {
        refusal: "error",
        note: "an unauthorized or unreachable rollback point refuses and leaves the host unchanged",
    },
    sandboxResourceStop: {
        refusal: "error",
        note: "an unknown resource is an argument error",
    },
    // --- sessions ---
    sessionList: { refusal: "none", note: "pure read" },
    sessionTouch: {
        refusal: "error",
        note: "an unknown session is an argument error",
    },
    sessionRename: {
        refusal: "error",
        note: "an unknown session is an argument error",
    },
    sessionPin: {
        refusal: "error",
        note: "an unknown session is an argument error",
    },
    sessionDuplicate: {
        refusal: "error",
        note: "an unknown session is an argument error",
    },
    sessionFork: {
        refusal: "error",
        note: "an unknown session or turn is an argument error",
    },
    sessionRollbackMessages: {
        refusal: "error",
        note: "an unknown session or turn is an argument error",
    },
    sessionDelete: {
        refusal: "error",
        note: "an unknown session is an argument error",
    },
    sessionNew: {
        refusal: "value",
        expressedBy: "created",
        note: "creating an existing id answers created:false with the existing summary",
    },
    sessionArchive: {
        refusal: "value",
        expressedBy: "archived",
        note: "archiving an archived session answers archived:true; an unknown session is an argument error",
    },
    sessionRestore: {
        refusal: "error",
        note: "an unknown session is an argument error; restoring an unarchived session answers archived:false",
    },
    sessionExport: {
        refusal: "error",
        note: "pure read; an unknown session is an argument error",
    },
    sessionAttach: {
        refusal: "error",
        note: "an unknown session, active turn, or pending interactive request leaves no safe partial attach",
    },
    subagents: { refusal: "none", note: "pure read" },
    subagentHistory: {
        refusal: "none",
        note: "pure read of persisted subagent history",
    },
    subagentHistoryPage: {
        refusal: "none",
        note: "pure paged read of persisted subagent history",
    },
    uploadAttachment: {
        refusal: "error",
        note: "an unknown path or policy refusal is an argument error",
    },
    attachmentDataUrl: { refusal: "none", note: "pure read" },
    // --- mcp ---
    mcpCatalog: { refusal: "none", note: "pure read" },
    permissionList: { refusal: "none", note: "pure read" },
    permissionSave: {
        refusal: "value",
        expressedBy: "saved",
        note: "the config file is written either way; a running turn blocks the reload and answers applied:false",
    },
    permissionDelete: {
        refusal: "value",
        expressedBy: "deleted",
        note: "the default profile refuses deletion; an unknown name is an idempotent success",
    },
    mcpServerAdd: {
        refusal: "value",
        expressedBy: "saved",
        note: "config write and reconnect; connection failures surface as diagnostics",
    },
    mcpServerRemove: {
        refusal: "value",
        expressedBy: "removed",
        note: "an unknown server is an idempotent success",
    },
    agentCreate: {
        refusal: "value",
        expressedBy: "created",
        note: "creating an existing name answers created:false with a reason",
    },
    agentUpdate: {
        refusal: "error",
        note: "an unknown agent name is an argument error",
    },
    agentDelete: {
        refusal: "value",
        expressedBy: "deleted",
        note: "the default agent refuses deletion; an unknown name is an idempotent success",
    },
    providerDiscover: {
        refusal: "error",
        note: "a failed probe is an error; carries the api key only for the probe",
    },
    providerAdd: {
        refusal: "value",
        expressedBy: "saved",
        note: "config write and apply; apply may be blocked by a running turn",
    },
    providerRemove: {
        refusal: "value",
        expressedBy: "removed",
        note: "a provider referenced by a model refuses deletion; an unknown name is an idempotent success",
    },
    pluginUnload: {
        refusal: "value",
        expressedBy: "unloaded",
        note: "an unknown plugin id is an idempotent success",
    },
    pluginReload: {
        refusal: "error",
        note: "an unknown plugin id is an argument error",
    },
    toolFamilyReload: {
        refusal: "error",
        note: "an unknown or disabled tool family id is an argument error",
    },
    getMcpPrompt: {
        refusal: "error",
        note: "a disconnected server refuses; there is no prompt to return",
    },
    readMcpResource: {
        refusal: "error",
        note: "a disconnected server refuses",
    },
    // --- extensions ---
    plugins: { refusal: "none", note: "pure read" },
    pluginInstall: {
        refusal: "value",
        expressedBy: "installed",
        note: "installs a local package spec into the plugin store; may write packages to disk",
    },
    pluginUninstall: {
        refusal: "value",
        expressedBy: "uninstalled",
        note: "removes a plugin from the plugin store",
    },
    pluginSetEnabled: {
        refusal: "value",
        expressedBy: "enabled",
        note: "enables or disables an installed plugin for the workspace",
    },
    pluginCatalog: {
        refusal: "none",
        note: "pure read of the installed plugin catalog",
    },
    commandCatalog: { refusal: "none", note: "pure read" },
    commandExecute: {
        refusal: "error",
        note: "the contributed command either enters the session execution queue or is rejected",
    },
    capabilities: { refusal: "none", note: "pure read" },
    naviChat: {
        refusal: "none",
        note: "Navi-owned stream surface; refusal semantics live on its nested methods",
    },
    niaChat: {
        refusal: "none",
        note: "Nia-owned stream surface; refusal semantics live on its nested methods",
    },
    // --- observability ---
    runtimeStatus: { refusal: "none", note: "pure read" },
    diagnostics: { refusal: "none", note: "pure read" },
    sessionSnapshot: { refusal: "none", note: "pure read" },
    // --- workGraph ---
    workGraphNodes: { refusal: "none", note: "pure read" },
    workGraphEdges: { refusal: "none", note: "pure read" },
    // --- intelligence ---
    // Read surfaces. The rule/decision writers now exist in production; evidence,
    // drift and tool metadata still answer nothing and are named in
    // UNIMPLEMENTED_QUERIES with the reason.
    constitutionRules: { refusal: "none", note: "pure read" },
    notices: {
        refusal: "none",
        note: "pure read of the projected runtime notices",
    },
    decisionRecords: { refusal: "none", note: "pure read" },
    recordDecision: {
        refusal: "value",
        expressedBy: "recorded",
        note: "records a durable decision fact; decision text and rationale are safe prose, never tool output or file content",
    },
    evidenceRecords: { refusal: "none", note: "pure read" },
    completions: { refusal: "none", note: "pure read" },
    planTaskStates: {
        refusal: "none",
        note: "pure read of the plan task state machine",
    },
    workGraphIntegrity: {
        refusal: "none",
        note: "pure read: rebuilds and verifies the work graph",
    },
    unattributedChanges: {
        refusal: "none",
        note: "pure read of unattributed workspace changes",
    },
    recordCompletion: {
        refusal: "value",
        expressedBy: "recorded",
        note: "records a completion card; changeSummary is safe prose, never a diff or file content",
    },
    recordHumanValidation: {
        refusal: "value",
        expressedBy: "recorded",
        note: "records the user's human validation note on a completion card; the note is safe prose, redacted before it reaches the journal",
    },
    recordValidation: {
        refusal: "value",
        expressedBy: "recorded",
        note: "runs a validation command and records the outcome; only the command, outcome, bounded safe summary and duration reach the journal — raw output is redacted",
    },
    driftFindings: { refusal: "none", note: "pure read" },
    evaluateDrift: {
        refusal: "value",
        expressedBy: "opened",
        note: "runs the DriftEvaluator against safe signals and publishes findings; the evaluator has no write power, a finding only escalates to an approval/Chat/mailbox prompt",
    },
    acknowledgeDriftFinding: {
        refusal: "value",
        expressedBy: "acknowledged",
        note: "acknowledges an open drift finding; the rationale is safe prose, never a command, content or secret",
    },
    reopenDriftFinding: {
        refusal: "value",
        expressedBy: "reopened",
        note: "reopens a dismissed/explained drift finding (user-only 翻案); a corrected finding is not reopenable",
    },
    confirmedWorkspaceChanges: {
        refusal: "none",
        note: "reconciles watcher hints and returns the confirmed changes; not written to the Work Graph (Phase 4)",
    },
    workspaceDiff: {
        refusal: "none",
        note: "pure read of the object-store backed workspace diff; may include file content from the shared object library",
    },
    astDiff: {
        refusal: "none",
        note: "pure structural AST diff in runtime; returns node summaries, no writes",
    },
    astDiffBatch: {
        refusal: "none",
        note: "pure batch structural AST diff in runtime; returns node summaries per file, no writes",
    },
    astRefactorPreview: {
        refusal: "none",
        note: "pure structural refactor preview in runtime; returns node summaries, never writes",
    },
    astService: {
        refusal: "none",
        note: "pure AST index/query in runtime; builds structural indexes, never writes",
    },
    astRefactorPlan: {
        refusal: "none",
        note: "pure refactor plan generation in runtime; returns structural targets, never writes",
    },
    astApplyRefactor: {
        refusal: "error",
        note: "an unsupported language or an unsafe plan refuses before any file is written",
    },
    workspaceGitDiff: {
        refusal: "none",
        note: "pure read of git status and git diff; may include file content from the working tree",
    },
    gitRefs: {
        refusal: "none",
        note: "pure read of git branches, tags and worktrees",
    },
    teamPRList: {
        refusal: "none",
        note: "pure read of sandboxed sub-agent PR list; merging remains model-driven team_review",
    },
    registeredTools: { refusal: "none", note: "pure read" },
    requestOverride: {
        refusal: "value",
        expressedBy: "requested",
        note: "requests a user-scoped constitution override through the approval pipeline; forbidden rules answer requested:false",
    },
    approveOverride: {
        refusal: "value",
        expressedBy: "approved",
        note: "records the user's approval response for a pending constitution override",
    },
    updateConstitutionRule: {
        refusal: "value",
        expressedBy: "updated",
        note: "disables or re-enables a hard constitution rule (user-owned; a model never edits rules)",
    },
    removeConstitutionRule: {
        refusal: "value",
        expressedBy: "removed",
        note: "records the append-only tombstone for a removed constitution rule (user-owned, confirmed)",
    },
    createConstitutionRule: {
        refusal: "value",
        expressedBy: "created",
        note: "adds a user-owned constitution rule (release scope rejected; a deny/approval rule needs an appliesTo anchor)",
    },
    constitutionDocRules: { refusal: "none", note: "pure read" },
    promoteConstitutionDocRule: {
        refusal: "value",
        expressedBy: "promoted",
        note: "promotes a parsed constitution/AGENTS document rule into a journal rule (user-owned; a deny/approval rule needs an appliesTo anchor)",
    },
    updateConstitutionDocRule: {
        refusal: "value",
        expressedBy: "updated",
        note: "edits a constitution/AGENTS document section in place and writes it back (user-owned; a deny/approval rule needs an appliesTo anchor)",
    },
    projectionContributions: {
        refusal: "none",
        note: "pure read of sanitized plugin projection contributions",
    },
    // --- Live Work Chat mailbox (P8 C3) ---
    mailboxList: { refusal: "none", note: "pure read" },
    mailboxSend: {
        refusal: "value",
        expressedBy: "queued",
        note: "enqueues a durable mailbox intent; the text is user intent prose that may reach the journal, so secrets must be redacted by the caller",
    },
    mailboxDeliver: {
        refusal: "value",
        expressedBy: "delivered",
        note: "marks a queued mailbox message delivered; unknown messages answer delivered:false",
    },
    mailboxAcknowledge: {
        refusal: "value",
        expressedBy: "acknowledged",
        note: "acknowledges a delivered mailbox message",
    },
    mailboxDefer: {
        refusal: "value",
        expressedBy: "deferred",
        note: "defers a queued mailbox message with a safe reason",
    },
    mailboxSupersede: {
        refusal: "value",
        expressedBy: "superseded",
        note: "supersedes a queued mailbox message with a safe reason",
    },
    // --- Markdown plan document registry (replaces P8 C4) ---
    planDocList: { refusal: "none", note: "pure read of the plan registry" },
    planDocRead: {
        refusal: "none",
        note: "pure read of a Markdown plan document",
    },
    planDocWrite: {
        refusal: "value",
        expressedBy: "written",
        note: "writes a Markdown plan document; only .natalia/plans/ paths are accepted",
    },
    planDocMark: {
        refusal: "value",
        expressedBy: "marked",
        note: "marks a plan document as a formal Plan and returns its stable planID",
    },
    planDocDelete: {
        refusal: "value",
        expressedBy: "deleted",
        note: "deletes a plan registry record; does not delete the Markdown file",
    },
    checkpointListByKind: {
        refusal: "none",
        note: "pure read of categorized checkpoint records",
    },
    auditRounds: {
        refusal: "none",
        note: "pure read of audit round checkpoint metadata",
    },
    roundDiff: {
        refusal: "none",
        note: "pure read of checkpoint/audit-round diff changes",
    },
    planDocStatus: {
        refusal: "none",
        note: "pure read of one plan's lifecycle status",
    },
    planDocUpdateStatus: {
        refusal: "value",
        expressedBy: "updated",
        note: "updates a plan document lifecycle status",
    },
    planDocActive: {
        refusal: "none",
        note: "pure read of a session's active plan pointer",
    },
    planDocActivate: {
        refusal: "value",
        expressedBy: "updated",
        note: "sets a session-scoped active plan pointer without changing lifecycle status",
    },
    planDocDeactivate: {
        refusal: "value",
        expressedBy: "updated",
        note: "clears a session-scoped active plan pointer",
    },
    goalControl: {
        refusal: "value",
        expressedBy: "ok",
        note: "pause/resume/clear the current goal; refusal is expressed by ok:false plus a message",
    },
    goalEdit: {
        refusal: "value",
        expressedBy: "ok",
        note: "edit the current goal (objective/round cap/plan) from the status bar; refusal is expressed by ok:false plus a message",
    },
};
/** The members whose refusal is a value. Consumers read the result, not a catch. */
function membersRefusingByValue() {
    return Object.entries(exports.RUNTIME_MEMBER_REFUSAL_SEMANTICS)
        .filter(function (_a) {
        var semantics = _a[1];
        return semantics.refusal === "value";
    })
        .map(function (_a) {
        var member = _a[0];
        return member;
    })
        .sort();
}
