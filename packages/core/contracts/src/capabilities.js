"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNIMPLEMENTED_QUERIES = exports.RUNTIME_CAPABILITY_GROUPS = exports.DEPRECATED_RUNTIME_MEMBERS = exports.REQUIRED_RUNTIME_MEMBERS = exports.API_STABLE_SURFACE = exports.API_VERSION = void 0;
exports.capabilityGroupOf = capabilityGroupOf;
exports.describeRuntimeCapabilities = describeRuntimeCapabilities;
/**
 * The API version of this contract, as a single integer. It appears in
 * `runtime.availability` and in `/healthz`, and it is bound to the stable
 * surface below: a change to the required members is a breaking change and
 * must bump this number. A consumer reads it and refuses to guess when it
 * meets a version it does not know.
 */
exports.API_VERSION = 1;
/**
 * The stable surface: the required members and the version they are promised
 * under. This is the one place a breaking change is declared — moving a member
 * out of the required set (or changing its meaning) without bumping
 * `apiVersion` here is exactly the silent breakage this module exists to
 * prevent. `REQUIRED_RUNTIME_MEMBERS` is derived from it, so the promise and
 * the code cannot disagree.
 */
exports.API_STABLE_SURFACE = {
    apiVersion: exports.API_VERSION,
    requiredMembers: [
        "start",
        "submit",
        "cancel",
        "snapshot",
        "diagnostic",
        "lastSubmission",
        "respondApproval",
        "respondQuestion",
    ],
};
/**
 * The minimum a runtime must implement to be usable at all: open a session, take a
 * turn, stop it, read the current state, report a problem, and answer the two
 * prompts a turn can block on.
 */
exports.REQUIRED_RUNTIME_MEMBERS = exports.API_STABLE_SURFACE.requiredMembers;
/**
 * Members marked deprecated, with the replacement a consumer should move to.
 * Empty today; the mechanism exists so a future deprecation shows up in the
 * availability report (`deprecated` on the channel member) instead of being
 * learned from a changelog. Removing a member's meaning is a breaking change:
 * it requires the version machinery, not just this table.
 */
exports.DEPRECATED_RUNTIME_MEMBERS = {};
/**
 * Optional members grouped by the capability they belong to. A consumer checks a
 * group, not 87 individual members, and an implementer reads a group as a unit of
 * work rather than a list of methods to guess at.
 */
exports.RUNTIME_CAPABILITY_GROUPS = {
    /** Reading and replaying a session's own history. */
    transcript: [
        "history",
        "eventWindow",
        "messages",
        "pendingInteractive",
        "respondInteractive",
        "submitInput",
        "submitAndWait",
    ],
    /** Pausing and resuming a running turn, plus editing its queued inputs. */
    turnControl: [
        "pause",
        "resume",
        "removeInput",
        "replaceInput",
        "promoteInput",
    ],
    /** Lifecycle beyond a single session. */
    lifecycle: [
        "dispose",
        "canReloadConfig",
        "reloadConfig",
        "updateConfig",
        "configGet",
    ],
    /** The interface-preference settings file served over RPC. */
    settings: ["settingsGet", "settingsSet"],
    /** Choosing the agent and model a turn runs as. */
    selection: [
        "agents",
        "selectAgent",
        "modelCatalog",
        "modelSelection",
        "selectModel",
        "setDefaultModel",
        "reasoningEffort",
        "setReasoningEffort",
        "skills",
        "agentCreate",
        "agentUpdate",
        "agentDelete",
        "providerDiscover",
        "providerAdd",
        "providerRemove",
    ],
    /** Reading and searching the workspace. */
    workspace: [
        "workspaceFiles",
        "workspaceSearch",
        "workspaceList",
        "workspaceRead",
        "resourceRead",
        "workspaceWrite",
        "workspaceCreate",
        "workspaceRename",
        "workspaceDelete",
        "workspaceWriteConflicts",
        "workspaceGlob",
        "workspaceDiff",
        "workspaceGitDiff",
        "gitRefs",
        "astDiff",
        "astDiffBatch",
        "astRefactorPreview",
        "astService",
        "astRefactorPlan",
        "astApplyRefactor",
        "workspaceRoots",
        "workspaceAdd",
        "workspaceRemove",
        "workspaceActivate",
        "workspacePermissionGet",
        "workspacePermissionSet",
        "workspaceToolGet",
        "workspaceToolSet",
    ],
    /** The native terminal host, including secure input and approval scopes. */
    nativeTerminal: [
        "nativeTerminalList",
        "nativeTerminalRead",
        "nativeTerminalClaimHumanInput",
        "nativeTerminalOpenHub",
        "nativeTerminalRevokeApprovalScope",
        "nativeTerminalReleaseHumanControl",
        "nativeTerminalBeginSecureInput",
        "nativeTerminalEndSecureInput",
        "nativeTerminalStop",
        "nativeTerminalStart",
        "nativeTerminalWrite",
        "nativeTerminalResize",
    ],
    /** Snapshotting the workspace and rolling it back. */
    checkpoint: [
        "checkpointList",
        "checkpointListByKind",
        "auditRounds",
        "roundDiff",
        "checkpointPreview",
        "checkpointRollback",
        "checkpointRename",
    ],
    /** Working inside an isolated copy of the workspace. */
    sandbox: [
        "sandboxList",
        "sandboxDiff",
        "sandboxResources",
        "sandboxResourceOutput",
        "sandboxMerge",
        "sandboxDelete",
        "sandboxRollback",
        "sandboxResourceStop",
        "teamPRList",
    ],
    /** Managing sessions as durable records. */
    sessions: [
        "sessionList",
        "sessionTouch",
        "sessionRename",
        "sessionPin",
        "sessionDuplicate",
        "sessionFork",
        "sessionRollbackMessages",
        "sessionDelete",
        "sessionNew",
        "sessionArchive",
        "sessionRestore",
        "sessionExport",
        "sessionAttach",
        "subagents",
        "subagentHistory",
        "subagentHistoryPage",
    ],
    /** Tools and prompts contributed by MCP servers. */
    mcp: [
        "mcpCatalog",
        "getMcpPrompt",
        "readMcpResource",
        "mcpServerAdd",
        "mcpServerRemove",
    ],
    /** What has been loaded into this runtime. */
    extensions: [
        "plugins",
        "commandCatalog",
        "commandExecute",
        "capabilities",
        "pluginUnload",
        "pluginReload",
        "pluginInstall",
        "pluginUninstall",
        "pluginSetEnabled",
        "pluginCatalog",
        "toolFamilyReload",
        "projectionContributions",
    ],
    /** Security and configuration management (permission profiles). */
    management: ["permissionList", "permissionSave", "permissionDelete"],
    /** Durable task and flow documents. */
    observability: ["runtimeStatus", "diagnostics", "sessionSnapshot"],
    /** The Work Graph: what happened and what caused it. */
    workGraph: ["workGraphNodes", "workGraphEdges"],
    /**
     * Engineering-intelligence records. Present end to end and empty in practice —
     * see `UNIMPLEMENTED_QUERIES`.
     */
    intelligence: [
        "constitutionRules",
        "decisionRecords",
        "recordDecision",
        "evidenceRecords",
        "recordValidation",
        "completions",
        "recordCompletion",
        "recordHumanValidation",
        "planTaskStates",
        "workGraphIntegrity",
        "unattributedChanges",
        "driftFindings",
        "evaluateDrift",
        "acknowledgeDriftFinding",
        "reopenDriftFinding",
        "confirmedWorkspaceChanges",
        "registeredTools",
        "requestOverride",
        "approveOverride",
        "updateConstitutionRule",
        "removeConstitutionRule",
        "createConstitutionRule",
        "constitutionDocRules",
        "promoteConstitutionDocRule",
        "updateConstitutionDocRule",
        "notices",
    ],
    /** Live Work Chat durable mailbox (P8 Phase C3). */
    mailbox: [
        "mailboxList",
        "mailboxSend",
        "mailboxDeliver",
        "mailboxAcknowledge",
        "mailboxDefer",
        "mailboxSupersede",
    ],
    /** Lightweight Markdown plan document registry (replaces P8 C4). */
    planDocs: [
        "planDocList",
        "planDocRead",
        "planDocWrite",
        "planDocMark",
        "planDocDelete",
        "planDocStatus",
        "planDocUpdateStatus",
        "planDocActive",
        "planDocActivate",
        "planDocDeactivate",
    ],
    /** Same-session goal control (pause/resume/clear/edit bypassing the model). */
    goals: ["goalControl", "goalEdit"],
    /** Durable attachment upload/storage for pasted or dropped files. */
    attachments: ["uploadAttachment", "attachmentDataUrl"],
    /** The always-available Live Work Chat conversation (P8 Phase C2). */
    chat: ["naviChat", "niaChat"],
};
var GROUP_BY_MEMBER = new Map(Object.keys(exports.RUNTIME_CAPABILITY_GROUPS).flatMap(function (group) {
    return exports.RUNTIME_CAPABILITY_GROUPS[group].map(function (member) { return [member, group]; });
}));
/**
 * Which capability a member belongs to, so a caller told "not supported" can
 * switch off the whole group instead of discovering it one member at a time.
 * Required members belong to no group and answer `undefined`, because a runtime
 * missing one of those is unusable rather than degraded.
 *
 * Derived from `RUNTIME_CAPABILITY_GROUPS`; a second hand-written mapping is
 * exactly the thing that would rot.
 */
function capabilityGroupOf(member) {
    return GROUP_BY_MEMBER.get(member);
}
/**
 * Queries that are implemented, reachable, and answer with nothing because no
 * production code writes the facts they read yet. Stated here so an integrator can
 * tell that apart from "there is nothing to report", which is the one thing an
 * empty array cannot say for itself.
 *
 * Each is a first slice whose writer is scheduled work, not an abandoned surface.
 */
exports.UNIMPLEMENTED_QUERIES = {};
function withDeprecation(member, entry, deprecated) {
    var annotation = deprecated[member];
    if (!annotation)
        return entry;
    return __assign(__assign({}, entry), { deprecated: annotation });
}
/**
 * Describes what a specific runtime can do, by looking at what it actually
 * implements rather than what it claims.
 */
function describeRuntimeCapabilities(client, channel, deprecated) {
    if (deprecated === void 0) { deprecated = exports.DEPRECATED_RUNTIME_MEMBERS; }
    var has = function (member) {
        return typeof client[member] ===
            "function";
    };
    var missingRequired = exports.REQUIRED_RUNTIME_MEMBERS.filter(function (member) { return !has(member); });
    var groups = Object.keys(exports.RUNTIME_CAPABILITY_GROUPS).map(function (name) {
        var members = exports.RUNTIME_CAPABILITY_GROUPS[name];
        var missing = members.filter(function (member) { return !has(member); });
        return {
            name: name,
            available: missing.length === 0,
            partial: missing.length > 0 && missing.length < members.length,
            missing: missing,
        };
    });
    var channelReport = channel
        ? {
            name: channel.name,
            requiredMembers: exports.REQUIRED_RUNTIME_MEMBERS.map(function (member) {
                var _a, _b;
                if (!has(member))
                    return withDeprecation(member, {
                        member: member,
                        state: "not_implemented",
                        reason: "this runtime does not implement it",
                    }, deprecated);
                if (channel.routedMembers.has(member))
                    return withDeprecation(member, {
                        member: member,
                        state: "implemented_reachable",
                    }, deprecated);
                return withDeprecation(member, {
                    member: member,
                    state: "implemented_unreachable",
                    reason: (_b = (_a = channel.unreachableReasons) === null || _a === void 0 ? void 0 : _a[member]) !== null && _b !== void 0 ? _b : "this transport does not route it",
                }, deprecated);
            }),
            groups: Object.keys(exports.RUNTIME_CAPABILITY_GROUPS).map(function (name) {
                var members = exports.RUNTIME_CAPABILITY_GROUPS[name];
                var memberStates = members.map(function (member) {
                    var _a, _b;
                    if (!has(member))
                        return withDeprecation(member, {
                            member: member,
                            state: "not_implemented",
                            reason: "this runtime does not implement it",
                        }, deprecated);
                    if (channel.routedMembers.has(member))
                        return withDeprecation(member, {
                            member: member,
                            state: "implemented_reachable",
                        }, deprecated);
                    return withDeprecation(member, {
                        member: member,
                        state: "implemented_unreachable",
                        reason: (_b = (_a = channel.unreachableReasons) === null || _a === void 0 ? void 0 : _a[member]) !== null && _b !== void 0 ? _b : "this transport does not route it",
                    }, deprecated);
                });
                var reachable = memberStates.every(function (member) { return member.state === "implemented_reachable"; });
                var unreachableCount = memberStates.filter(function (member) { return member.state === "implemented_unreachable"; }).length;
                return {
                    name: name,
                    reachable: reachable,
                    partial: unreachableCount > 0 && unreachableCount < memberStates.length,
                    members: memberStates,
                };
            }),
        }
        : undefined;
    return {
        apiVersion: exports.API_STABLE_SURFACE.apiVersion,
        usable: missingRequired.length === 0,
        missingRequired: __spreadArray([], missingRequired, true),
        groups: groups,
        channel: channelReport,
        unimplemented: Object.keys(exports.UNIMPLEMENTED_QUERIES)
            .filter(function (member) { return has(member); })
            .map(function (member) { return ({ member: member, reason: exports.UNIMPLEMENTED_QUERIES[member] }); }),
    };
}
