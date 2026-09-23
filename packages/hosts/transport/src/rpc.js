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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RPC_WRITE_METHODS = exports.RPC_ROUTED_MEMBERS = exports.RPC_INTENTIONALLY_LOCAL = exports.RPC_ROUTE_MEMBERS = void 0;
exports.stringParam = stringParam;
exports.arrayParam = arrayParam;
exports.credentialSessions = credentialSessions;
exports.isAuthorized = isAuthorized;
exports.authorizationRefusalReason = authorizationRefusalReason;
exports.cullAvailabilityReport = cullAvailabilityReport;
exports.handleRPCMessage = handleRPCMessage;
/**
 * Server side of the runtime RPC protocol: it decides what a failure *is*.
 *
 * Every failure here used to collapse into `-32602` with a message, which told a
 * remote consumer nothing it could act on. Now each failure leaves as one of five
 * kinds (`@natalia/contracts` `failures.ts`), classified from typed errors rather
 * than from message text:
 *
 *   - a name with no route            -> `-32601`, with the method
 *   - a route whose member is absent  -> `-32000`, with the member and its capability
 *   - bad arguments                   -> `-32602`, and only that
 *   - policy or state says no         -> `-32001`, with a reason
 *   - anything else                   -> `-32603`, with an ID and no detail
 *
 * The last one is deliberate: an unclassified error's message can contain an
 * absolute path, a command line or a secret, so it is replaced with an ID and the
 * detail is published as a durable diagnostic. A caller authorized to read
 * diagnostics can still get it from `diagnostics.list`; the RPC reply cannot leak
 * it to a caller who is not.
 */
var contracts_1 = require("@natalia/contracts");
/**
 * Every param check in this file goes through here, so "the caller sent the wrong
 * thing" can never again be indistinguishable from "the runtime broke".
 */
function invalidParams(message) {
    return new contracts_1.RuntimeInvalidParams(message);
}
function stringParam(params, name) {
    var value = params === null || params === void 0 ? void 0 : params[name];
    if (typeof value !== "string")
        throw invalidParams("".concat(name, " must be a string"));
    return value;
}
function optionalStringParam(params, name) {
    var value = params === null || params === void 0 ? void 0 : params[name];
    if (value === undefined)
        return undefined;
    if (typeof value !== "string")
        throw invalidParams("".concat(name, " must be a string"));
    return value;
}
function arrayParam(params, name) {
    var value = params === null || params === void 0 ? void 0 : params[name];
    if (!Array.isArray(value) || !value.every(function (item) { return Array.isArray(item); }))
        throw invalidParams("".concat(name, " must be an array of arrays"));
    return value.map(function (item) { return item.map(function (entry) { return String(entry); }); });
}
/**
 * The route exists but this runtime does not implement the member behind it.
 * That is `-32000 not supported`, never `-32602`: the caller's arguments were
 * fine and changing them will not help. The capability group travels with it so
 * a consumer can hide the whole group in one step.
 */
function requireMember(client, member) {
    var value = client[member];
    if (typeof value !== "function")
        throw new contracts_1.RuntimeNotSupported(member, (0, contracts_1.capabilityGroupOf)(member));
    return value;
}
/** `requireMember` as a narrowing assertion, for the routes that call `client.x()`. */
function optionsGuard(client, member) {
    requireMember(client, member);
}
/**
 * The route table: every JSON-RPC method this transport serves, and the
 * `RuntimeClient` member behind it. This is the single fact source for
 * per-channel reachability — the availability report intersects what the
 * runtime implements with this table, so "I can call it" is computed from the
 * dispatch code itself and cannot drift from it. A test scans this file and
 * fails when a route block appears without a row here, or a row has no block.
 */
exports.RPC_ROUTE_MEMBERS = {
    prompt: "submit",
    "submit.andWait": "submitAndWait",
    cancel: "cancel",
    snapshot: "snapshot",
    "approval.respond": "respondApproval",
    "question.respond": "respondQuestion",
    "interactive.pending": "pendingInteractive",
    "interactive.respond": "respondInteractive",
    "session.history": "history",
    "session.eventWindow": "eventWindow",
    "session.messages": "messages",
    pause: "pause",
    resume: "resume",
    "config.canReload": "canReloadConfig",
    "config.reload": "reloadConfig",
    "config.update": "updateConfig",
    "config.get": "configGet",
    "settings.get": "settingsGet",
    "settings.set": "settingsSet",
    "agent.list": "agents",
    "agent.select": "selectAgent",
    "model.catalog": "modelCatalog",
    "model.selection": "modelSelection",
    "model.select": "selectModel",
    "model.setDefault": "setDefaultModel",
    "model.reasoning": "reasoningEffort",
    "model.reasoning.set": "setReasoningEffort",
    "skills.list": "skills",
    "workspace.files": "workspaceFiles",
    "workspace.search": "workspaceSearch",
    "workspace.list": "workspaceList",
    "workspace.read": "workspaceRead",
    "resource.read": "resourceRead",
    "workspace.write": "workspaceWrite",
    "workspace.create": "workspaceCreate",
    "workspace.rename": "workspaceRename",
    "workspace.delete": "workspaceDelete",
    "workspace.writeConflicts": "workspaceWriteConflicts",
    "workspace.glob": "workspaceGlob",
    "workspace.roots": "workspaceRoots",
    "workspace.add": "workspaceAdd",
    "workspace.remove": "workspaceRemove",
    "workspace.activate": "workspaceActivate",
    "workspace.permission.get": "workspacePermissionGet",
    "workspace.permission.set": "workspacePermissionSet",
    "workspace.tool.get": "workspaceToolGet",
    "workspace.tool.set": "workspaceToolSet",
    "checkpoint.list": "checkpointList",
    "checkpoint.preview": "checkpointPreview",
    "checkpoint.rollback": "checkpointRollback",
    "checkpoint.rename": "checkpointRename",
    "checkpoint.listByKind": "checkpointListByKind",
    "audit.rounds": "auditRounds",
    "workspace.round.diff": "roundDiff",
    "sandbox.list": "sandboxList",
    "sandbox.diff": "sandboxDiff",
    "sandbox.resources": "sandboxResources",
    "sandbox.resource.output": "sandboxResourceOutput",
    "sandbox.merge": "sandboxMerge",
    "sandbox.delete": "sandboxDelete",
    "sandbox.rollback": "sandboxRollback",
    "sandbox.resource.stop": "sandboxResourceStop",
    "session.list": "sessionList",
    "session.touch": "sessionTouch",
    "session.rename": "sessionRename",
    "session.pin": "sessionPin",
    "session.duplicate": "sessionDuplicate",
    "session.fork": "sessionFork",
    "session.rollback.messages": "sessionRollbackMessages",
    "session.delete": "sessionDelete",
    "session.new": "sessionNew",
    "session.archive": "sessionArchive",
    "session.restore": "sessionRestore",
    "session.export": "sessionExport",
    "session.attach": "sessionAttach",
    "mcp.catalog": "mcpCatalog",
    "mcp.prompt": "getMcpPrompt",
    "mcp.resource": "readMcpResource",
    "mcp.server.add": "mcpServerAdd",
    "mcp.server.remove": "mcpServerRemove",
    "permission.list": "permissionList",
    "permission.save": "permissionSave",
    "permission.delete": "permissionDelete",
    "agent.create": "agentCreate",
    "agent.update": "agentUpdate",
    "agent.delete": "agentDelete",
    "provider.discover": "providerDiscover",
    "provider.add": "providerAdd",
    "provider.remove": "providerRemove",
    "plugin.unload": "pluginUnload",
    "plugin.reload": "pluginReload",
    "plugin.install": "pluginInstall",
    "plugin.uninstall": "pluginUninstall",
    "plugin.set-enabled": "pluginSetEnabled",
    "plugin.catalog": "pluginCatalog",
    "tools.reload": "toolFamilyReload",
    "plugin.list": "plugins",
    "command.catalog": "commandCatalog",
    "command.execute": "commandExecute",
    "runtime.availability": null,
    "runtime.status": "runtimeStatus",
    "diagnostics.list": "diagnostics",
    "workgraph.nodes": "workGraphNodes",
    "workgraph.edges": "workGraphEdges",
    // --- P0-C: the reachability gap closed (audit list in the API plan §8.10) ---
    "nativeTerminal.list": "nativeTerminalList",
    "nativeTerminal.read": "nativeTerminalRead",
    "nativeTerminal.stop": "nativeTerminalStop",
    "nativeTerminal.openHub": "nativeTerminalOpenHub",
    "nativeTerminal.claimHumanInput": "nativeTerminalClaimHumanInput",
    "nativeTerminal.revokeApprovalScope": "nativeTerminalRevokeApprovalScope",
    "nativeTerminal.releaseHumanControl": "nativeTerminalReleaseHumanControl",
    "nativeTerminal.beginSecureInput": "nativeTerminalBeginSecureInput",
    "nativeTerminal.endSecureInput": "nativeTerminalEndSecureInput",
    "nativeTerminal.start": "nativeTerminalStart",
    "nativeTerminal.write": "nativeTerminalWrite",
    "nativeTerminal.resize": "nativeTerminalResize",
    "constitution.rules": "constitutionRules",
    "constitution.rule.update": "updateConstitutionRule",
    "constitution.rule.create": "createConstitutionRule",
    "constitution.rule.remove": "removeConstitutionRule",
    "constitution.docRules": "constitutionDocRules",
    "constitution.docRule.promote": "promoteConstitutionDocRule",
    "constitution.docRule.update": "updateConstitutionDocRule",
    "context.notices": "notices",
    "decision.records": "decisionRecords",
    "decision.record": "recordDecision",
    "evidence.records": "evidenceRecords",
    "evidence.record": "recordValidation",
    "completion.records": "completions",
    "completion.human_validation": "recordHumanValidation",
    "plan.task.states": "planTaskStates",
    "workgraph.integrity": "workGraphIntegrity",
    "workgraph.unattributed": "unattributedChanges",
    "completion.record": "recordCompletion",
    "drift.findings": "driftFindings",
    "drift.evaluate": "evaluateDrift",
    "drift.acknowledge": "acknowledgeDriftFinding",
    "drift.reopen": "reopenDriftFinding",
    "observation.confirmed": "confirmedWorkspaceChanges",
    "workspace.diff": "workspaceDiff",
    "workspace.git.diff": "workspaceGitDiff",
    "ast.diff": "astDiff",
    "ast.diff.batch": "astDiffBatch",
    "ast.refactor.preview": "astRefactorPreview",
    "ast.service": "astService",
    "ast.refactor.plan": "astRefactorPlan",
    "ast.refactor.apply": "astApplyRefactor",
    "git.refs": "gitRefs",
    "team.pr.list": "teamPRList",
    "tools.registered": "registeredTools",
    "constitution.override.request": "requestOverride",
    "constitution.override.approve": "approveOverride",
    "projections.list": "projectionContributions",
    // P8 C3: durable Live Work Chat mailbox.
    "mailbox.list": "mailboxList",
    "mailbox.send": "mailboxSend",
    "mailbox.deliver": "mailboxDeliver",
    "mailbox.acknowledge": "mailboxAcknowledge",
    "mailbox.defer": "mailboxDefer",
    "mailbox.supersede": "mailboxSupersede",
    // Lightweight Markdown plan document registry (replaces P8 C4).
    "planDoc.list": "planDocList",
    "planDoc.read": "planDocRead",
    "planDoc.write": "planDocWrite",
    "planDoc.mark": "planDocMark",
    "planDoc.delete": "planDocDelete",
    "planDoc.status": "planDocStatus",
    "planDoc.updateStatus": "planDocUpdateStatus",
    "planDoc.active": "planDocActive",
    "planDoc.activate": "planDocActivate",
    "planDoc.deactivate": "planDocDeactivate",
    "goal.control": "goalControl",
    "goal.edit": "goalEdit",
    capabilities: "capabilities",
    "session.snapshot": "sessionSnapshot",
    "session.subagents": "subagents",
    "subagent.history": "subagentHistory",
    "subagent.history.page": "subagentHistoryPage",
    "attachment.upload": "uploadAttachment",
    "attachment.dataUrl": "attachmentDataUrl",
    "submit.input": "submitInput",
    "input.remove": "removeInput",
    "input.replace": "replaceInput",
    "input.promote": "promoteInput",
    // P8 C2: the always-available Live Work Chat conversation (read + rollback).
    "navi.chat.submit": "naviChat",
    "navi.chat.abort": "naviChat",
    "navi.chat.messages": "naviChat",
    "navi.chat.messages.page": "naviChat",
    "navi.chat.rollback": "naviChat",
    "navi.chat.model.profile": "naviChat",
    "navi.chat.model.profile.set": "naviChat",
    "nia.chat.submit": "niaChat",
    "nia.chat.abort": "niaChat",
    "nia.chat.messages": "niaChat",
    "nia.chat.messages.page": "niaChat",
    "nia.chat.rollback": "niaChat",
    "nia.chat.model.profile": "niaChat",
    "nia.chat.model.profile.set": "niaChat",
    // P0-G: the flow write surface, previously CLI-only.
};
/**
 * Members a remote caller must not reach, and why. These are routed *away* on
 * purpose: a member here is reported as `implemented_unreachable` with this
 * reason, so the availability report distinguishes "forgotten" from
 * "intentionally local" — the P0-C invariant is that every unreachable member
 * has a row in this table or does not exist on the runtime.
 */
exports.RPC_INTENTIONALLY_LOCAL = {
    dispose: "intentionally local: a remote caller must not dispose another party's runtime",
    start: "intentionally local: remote consumers subscribe to /events instead of calling start",
    lastSubmission: "intentionally local: a local read of the most recent submission",
    diagnostic: "intentionally local: one-way publishing from a local caller, not a query",
};
/** The member names this transport routes. `null` rows (availability itself) excluded. */
exports.RPC_ROUTED_MEMBERS = new Set(Object.values(exports.RPC_ROUTE_MEMBERS).filter(function (member) { return typeof member === "string"; }));
/**
 * The write surface, as route names. A credential without the `write`
 * dimension may call anything not on this list and nothing on it. The list is
 * code and is pinned by a test: removing an entry makes a write reachable by a
 * read-only credential, which fails.
 *
 * The xterm-era terminal writes are gone with the line that hosted them; the
 * live write surface is submissions, turn control, approvals, config,
 * checkpoints, sandboxes, session management and the native terminal controls
 * (whose security note from P0-C still stands: ending a human's secure input
 * remotely is a write of the strongest kind).
 */
exports.RPC_WRITE_METHODS = new Set([
    "prompt",
    "submit.andWait",
    "cancel",
    "submit.input",
    "input.remove",
    "input.replace",
    "input.promote",
    "approval.respond",
    "question.respond",
    "interactive.respond",
    "pause",
    "resume",
    "agent.select",
    "model.select",
    "model.setDefault",
    "model.reasoning.set",
    "config.reload",
    "config.update",
    "settings.set",
    "checkpoint.rollback",
    "checkpoint.rename",
    "sandbox.merge",
    "sandbox.delete",
    "sandbox.rollback",
    "sandbox.resource.stop",
    "session.touch",
    "session.rename",
    "session.pin",
    "session.duplicate",
    "session.fork",
    "session.rollback.messages",
    "session.delete",
    "session.new",
    "session.archive",
    "session.restore",
    "session.attach",
    "mcp.server.add",
    "mcp.server.remove",
    "permission.save",
    "permission.delete",
    "agent.create",
    "agent.update",
    "agent.delete",
    "provider.add",
    "provider.remove",
    "plugin.unload",
    "plugin.reload",
    "command.execute",
    "nativeTerminal.stop",
    "nativeTerminal.revokeApprovalScope",
    "nativeTerminal.releaseHumanControl",
    "nativeTerminal.beginSecureInput",
    "nativeTerminal.endSecureInput",
    "nativeTerminal.openHub",
    "nativeTerminal.start",
    "nativeTerminal.write",
    "nativeTerminal.resize",
    "flow.save",
    "flow.delete",
    "task.save",
    "task.delete",
    "task.schedule",
    "task.unschedule",
    "flow.install-examples",
    "ast.refactor.apply",
    "planDoc.activate",
    "planDoc.deactivate",
    "goal.control",
    "goal.edit",
]);
/**
 * The sessions a credential may see events for. Undefined means unrestricted.
 */
function credentialSessions(context) {
    return context === null || context === void 0 ? void 0 : context.sessions;
}
/**
 * Whether a route is inside the caller's grant. Checked before the route
 * table, so a credential that cannot call a method gets `-32001 refused`
 * whether or not the method exists — an authorization error must not double
 * as an existence probe.
 */
function isAuthorized(context, method) {
    if (!context)
        return true;
    if (!context.write && exports.RPC_WRITE_METHODS.has(method))
        return false;
    if (context.groups) {
        var member = exports.RPC_ROUTE_MEMBERS[method];
        var group = typeof member === "string" ? (0, contracts_1.capabilityGroupOf)(member) : undefined;
        if (group && !context.groups.has(group))
            return false;
    }
    return true;
}
/**
 * The reason a granted-but-denied call should carry. Kept separate from
 * `isAuthorized` so the refusal path can name the rule that fired.
 */
function authorizationRefusalReason(context, method) {
    if (!context.write && exports.RPC_WRITE_METHODS.has(method))
        return "authorization refused: this credential has no write scope";
    var member = exports.RPC_ROUTE_MEMBERS[method];
    var group = typeof member === "string" ? (0, contracts_1.capabilityGroupOf)(member) : undefined;
    if (group && context.groups && !context.groups.has(group))
        return "authorization refused: this credential has no access to the ".concat(group, " group");
    return "authorization refused";
}
/**
 * A report the caller can act on: reachable members outside the credential's
 * grant are marked unreachable with an authorization reason, never with "not
 * implemented". The report must not over-promise to a read-only integration —
 * the same mistake G2 made, at a different layer.
 */
function cullAvailabilityReport(report, authorization) {
    if (!authorization || !report.channel)
        return report;
    var cullMember = function (member) {
        if (member.state !== "implemented_reachable")
            return member;
        var method = Object.keys(exports.RPC_ROUTE_MEMBERS).find(function (name) {
            return exports.RPC_ROUTE_MEMBERS[name] ===
                member.member;
        });
        if (!method)
            return member;
        if (!isAuthorized(authorization, method))
            return __assign(__assign({}, member), { state: "implemented_unreachable", reason: authorizationRefusalReason(authorization, method) });
        return member;
    };
    return __assign(__assign({}, report), { channel: __assign(__assign({}, report.channel), { groups: report.channel.groups.map(function (group) {
                var members = group.members.map(cullMember);
                var reachable = members.every(function (member) { return member.state === "implemented_reachable"; });
                var unreachableCount = members.filter(function (member) { return member.state === "implemented_unreachable"; }).length;
                return __assign(__assign({}, group), { members: members, reachable: reachable, partial: unreachableCount > 0 && unreachableCount < members.length });
            }), requiredMembers: report.channel.requiredMembers.map(cullMember) }) });
}
function handleRPCMessage(raw, client, signal, authorization) {
    return __awaiter(this, void 0, void 0, function () {
        var request, body, text, rawDelivery, delivery, attachments, resources, agents, sessionID, _a, text, sessionID, name_1, workspaceID, workspaceID, modelID, variant, modelID, effort, workspaceID, query, type, limit, query, include, limit, path, offset, limit, offset, limit, resource, rawParams, params, params, path, content, encoding, params, path, content, directory, params, path, newPath, params, path, workspaceID, path, limit, path, title, workspaceID, workspaceID, workspaceID, workspaceID, workspaceID, workspaceID, sessionID, checkpointOptions, includePatch, dryRun, kind, input, sessionID, sandboxOptions, includePatch, maxBytes, requestID, decision, params, record, sessionID, workspaceID, sessionID, after, offset, limit, sessionID, beforeSeq, limit, sessionID, limit, order, cursor, title, title, params, id, title, workspaceID, name_2, raw_1, args, sessionID, workspaceID, sessionID, workspaceID, sessionID, workspaceID, params, command, cwd, id, sessionID, agentID, params, id, input, idempotencyKey, params, id, rows, cols, params, params, params, params, params, params, params, scope, params, result, params, result, params, result, params, result, params, params, includePatch, workspaceID, input, input, input, files, _i, files_1, file, input, _b, _c, file, input, _d, _e, file, input, _f, _g, file, input, _h, _j, file, workspaceID, workspaceID, params, params, sessionID, params, result, params, messageID, params, messageID, params, messageID, params, messageID, sessionID, params, planID, path, params, params, params, planID, params, planID, params, planID, status_1, params, params, planID, params, params, action, params, input, goalID, revision, objective, maxGoalRounds, planID, workspaceID, sessionID, sessionID, params, params, name_3, mediaType, data, path, mediaType, attachmentID, sessionID, stream, operation, surface, params, result, _k, text, input, toMessageID, profile, params, patch, scope, params, patch, scope, params, input, _l, _m, field, value, params, record, target, limit, arguments_, params, name_4, config, params, name_5, profile, managementName, managementObject, member, name_6, config, _o, params, type, baseURL, apiKey, headers, params, name_7, type, apiKey, baseURL, headers, models, label, previousName, member, id, _p, params, params, params, member, id, error_1;
        var _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, _71, _72, _73, _74, _75, _76, _77, _78, _79, _80, _81, _82, _83, _84, _85, _86, _87, _88, _89, _90, _91, _92, _93, _94, _95, _96, _97, _98, _99, _100, _101, _102, _103, _104, _105, _106, _107, _108, _109, _110, _111, _112, _113, _114, _115, _116, _117, _118, _119, _120, _121, _122, _123, _124, _125, _126, _127, _128, _129, _130, _131, _132, _133, _134, _135, _136, _137, _138, _139, _140, _141, _142, _143, _144, _145, _146, _147, _148, _149, _150, _151, _152, _153, _154, _155, _156, _157;
        var _158, _159, _160, _161, _162, _163, _164, _165, _166, _167, _168, _169, _170, _171, _172, _173, _174, _175, _176, _177, _178, _179, _180, _181, _182, _183, _184, _185, _186, _187, _188, _189, _190, _191, _192, _193, _194, _195, _196, _197, _198, _199, _200, _201, _202, _203, _204, _205, _206, _207, _208, _209, _210, _211, _212, _213, _214, _215, _216, _217, _218, _219, _220, _221, _222, _223, _224, _225, _226, _227, _228, _229, _230, _231, _232, _233, _234, _235, _236, _237, _238, _239, _240, _241, _242, _243, _244, _245, _246, _247, _248, _249, _250, _251, _252, _253, _254, _255, _256, _257, _258, _259, _260, _261, _262, _263, _264, _265, _266, _267, _268, _269, _270, _271, _272, _273, _274, _275, _276, _277, _278, _279, _280, _281, _282, _283, _284, _285, _286, _287, _288, _289, _290, _291, _292, _293, _294, _295, _296, _297, _298, _299, _300, _301, _302, _303, _304, _305, _306, _307, _308, _309, _310, _311, _312, _313, _314, _315, _316, _317, _318, _319, _320, _321, _322, _323, _324, _325, _326, _327, _328, _329, _330, _331, _332, _333, _334, _335, _336, _337, _338, _339, _340, _341, _342, _343, _344, _345, _346, _347, _348, _349, _350, _351, _352, _353, _354, _355, _356, _357, _358, _359, _360, _361, _362, _363, _364, _365, _366, _367, _368, _369, _370, _371, _372, _373, _374, _375, _376, _377, _378, _379, _380, _381, _382, _383, _384, _385, _386, _387, _388, _389, _390, _391, _392, _393, _394, _395, _396, _397, _398, _399, _400, _401, _402, _403, _404, _405, _406, _407, _408, _409, _410, _411, _412, _413, _414, _415, _416, _417, _418, _419, _420, _421, _422, _423, _424, _425, _426, _427, _428, _429, _430, _431, _432, _433, _434, _435, _436, _437, _438, _439, _440, _441, _442, _443, _444, _445, _446, _447, _448, _449, _450, _451, _452, _453, _454, _455, _456, _457, _458, _459, _460, _461, _462, _463, _464, _465, _466, _467, _468, _469, _470, _471, _472, _473, _474, _475, _476, _477, _478, _479, _480, _481, _482, _483, _484, _485, _486, _487, _488, _489, _490, _491, _492, _493, _494, _495, _496, _497, _498, _499, _500, _501, _502, _503, _504, _505, _506, _507, _508, _509, _510, _511, _512, _513, _514, _515, _516, _517, _518, _519, _520, _521, _522, _523, _524;
        return __generator(this, function (_525) {
            switch (_525.label) {
                case 0:
                    request = raw && typeof raw === "object" && !Array.isArray(raw)
                        ? raw
                        : undefined;
                    _525.label = 1;
                case 1:
                    _525.trys.push([1, 382, , 383]);
                    if (!request)
                        throw new contracts_1.RuntimeInvalidRequest();
                    body = request;
                    // Authorization before existence: a credential outside its grant gets
                    // `-32001 refused` whether or not the method exists, so an authorization
                    // error can never be used to probe the surface.
                    if (body.method && !isAuthorized(authorization, body.method))
                        throw new contracts_1.RuntimeRefusal(authorizationRefusalReason(authorization, body.method));
                    // The route table is the authority for what a method is: a name with no row
                    // here is `-32601 method not found`, before any dispatch block runs. The
                    // table also feeds the availability report, so reachability is computed from
                    // the same fact.
                    if (!(body.method && body.method in exports.RPC_ROUTE_MEMBERS))
                        throw new contracts_1.RuntimeMethodNotFound((_158 = body.method) !== null && _158 !== void 0 ? _158 : "");
                    if (!(request.method === "prompt")) return [3 /*break*/, 6];
                    text = (_159 = request.params) === null || _159 === void 0 ? void 0 : _159.text;
                    if (typeof text !== "string")
                        throw invalidParams("prompt.params.text must be a string");
                    rawDelivery = (_160 = request.params) === null || _160 === void 0 ? void 0 : _160.delivery;
                    if (rawDelivery !== undefined &&
                        rawDelivery !== "next-turn" &&
                        rawDelivery !== "next-step" &&
                        rawDelivery !== "steer" &&
                        rawDelivery !== "queue")
                        throw invalidParams("prompt.params.delivery must be next-turn or next-step");
                    delivery = rawDelivery === undefined
                        ? undefined
                        : rawDelivery === "next-step"
                            ? "next-step"
                            : "next-turn";
                    attachments = (_161 = request.params) === null || _161 === void 0 ? void 0 : _161.attachments;
                    if (attachments !== undefined &&
                        (!Array.isArray(attachments) ||
                            !attachments.every(function (attachment) { return typeof attachment === "string"; })))
                        throw invalidParams("prompt.params.attachments must be an array of strings");
                    resources = (_162 = request.params) === null || _162 === void 0 ? void 0 : _162.resources;
                    if (resources !== undefined &&
                        (!Array.isArray(resources) ||
                            !resources.every(function (resource) {
                                return resource &&
                                    typeof resource === "object" &&
                                    typeof resource.server ===
                                        "string" &&
                                    typeof resource.uri === "string" &&
                                    typeof resource.name === "string";
                            })))
                        throw invalidParams("prompt.params.resources must be resource mentions");
                    agents = (_163 = request.params) === null || _163 === void 0 ? void 0 : _163.agents;
                    if (agents !== undefined &&
                        (!Array.isArray(agents) ||
                            !agents.every(function (agent) {
                                return agent &&
                                    typeof agent === "object" &&
                                    typeof agent.name === "string";
                            })))
                        throw invalidParams("prompt.params.agents must be agent mentions");
                    sessionID = (_164 = request.params) === null || _164 === void 0 ? void 0 : _164.sessionID;
                    if (sessionID !== undefined && typeof sessionID !== "string")
                        throw invalidParams("prompt.params.sessionID must be a string");
                    _q = {
                        jsonrpc: "2.0",
                        id: (_165 = request.id) !== null && _165 !== void 0 ? _165 : null
                    };
                    if (!client.submitInput) return [3 /*break*/, 3];
                    return [4 /*yield*/, client.submitInput(__assign({ text: text, delivery: delivery, attachments: attachments, resources: resources, agents: agents }, (sessionID ? { sessionID: sessionID } : {})))];
                case 2:
                    _a = _525.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, client.submit(text, sessionID)];
                case 4:
                    _a = _525.sent();
                    _525.label = 5;
                case 5: return [2 /*return*/, (_q.result = _a,
                        _q)];
                case 6:
                    if (!(request.method === "submit.andWait")) return [3 /*break*/, 8];
                    text = (_166 = request.params) === null || _166 === void 0 ? void 0 : _166.text;
                    if (typeof text !== "string")
                        throw invalidParams("submit.andWait.params.text must be a string");
                    sessionID = (_167 = request.params) === null || _167 === void 0 ? void 0 : _167.sessionID;
                    if (sessionID !== undefined && typeof sessionID !== "string")
                        throw invalidParams("submit.andWait.params.sessionID must be a string");
                    optionsGuard(client, "submitAndWait");
                    _r = {
                        jsonrpc: "2.0",
                        id: (_168 = request.id) !== null && _168 !== void 0 ? _168 : null
                    };
                    return [4 /*yield*/, client.submitAndWait(sessionID ? { text: text, sessionID: sessionID } : text)];
                case 7: return [2 /*return*/, (_r.result = _525.sent(),
                        _r)];
                case 8:
                    if (request.method === "cancel") {
                        client.cancel(typeof ((_169 = request.params) === null || _169 === void 0 ? void 0 : _169.reason) === "string"
                            ? request.params.reason
                            : undefined, typeof ((_170 = request.params) === null || _170 === void 0 ? void 0 : _170.sessionID) === "string"
                            ? request.params.sessionID
                            : undefined);
                        return [2 /*return*/, {
                                jsonrpc: "2.0",
                                id: (_171 = request.id) !== null && _171 !== void 0 ? _171 : null,
                                result: { cancelled: true },
                            }];
                    }
                    if (!(body.method === "pause")) return [3 /*break*/, 10];
                    optionsGuard(client, "pause");
                    _s = {
                        jsonrpc: "2.0",
                        id: (_172 = body.id) !== null && _172 !== void 0 ? _172 : null
                    };
                    return [4 /*yield*/, client.pause(typeof ((_173 = body.params) === null || _173 === void 0 ? void 0 : _173.reason) === "string"
                            ? body.params.reason
                            : undefined, optionalStringParam(body.params, "sessionID"))];
                case 9: 
                // The runtime's answer, not an assumption. This route used to reply
                // `paused: true` even when nothing was running and the runtime had done
                // nothing at all.
                return [2 /*return*/, (_s.result = _525.sent(),
                        _s)];
                case 10:
                    if (!(body.method === "resume")) return [3 /*break*/, 12];
                    optionsGuard(client, "resume");
                    _t = {
                        jsonrpc: "2.0",
                        id: (_174 = body.id) !== null && _174 !== void 0 ? _174 : null
                    };
                    return [4 /*yield*/, ((_175 = client.resume) === null || _175 === void 0 ? void 0 : _175.call(client, optionalStringParam(body.params, "sessionID")))];
                case 11: return [2 /*return*/, (_t.result = _525.sent(),
                        _t)];
                case 12:
                    if (!(body.method === "agent.select")) return [3 /*break*/, 14];
                    optionsGuard(client, "selectAgent");
                    name_1 = (_176 = body.params) === null || _176 === void 0 ? void 0 : _176.name;
                    if (name_1 !== undefined && typeof name_1 !== "string")
                        throw invalidParams("agent.select.params.name must be a string");
                    _u = {
                        jsonrpc: "2.0",
                        id: (_177 = body.id) !== null && _177 !== void 0 ? _177 : null
                    };
                    return [4 /*yield*/, client.selectAgent(name_1, optionalStringParam(body.params, "sessionID"))];
                case 13: 
                // Reports whether the selection applied, was deferred to the end of the
                // running turn, or was rejected — all three happen, and the old reply
                // claimed the first one every time.
                return [2 /*return*/, (_u.result = _525.sent(),
                        _u)];
                case 14:
                    if (!(body.method === "agent.list")) return [3 /*break*/, 16];
                    optionsGuard(client, "agents");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _v = {
                        jsonrpc: "2.0",
                        id: (_178 = body.id) !== null && _178 !== void 0 ? _178 : null
                    };
                    return [4 /*yield*/, client.agents(workspaceID ? { workspaceID: workspaceID } : undefined)];
                case 15: return [2 /*return*/, (_v.result = _525.sent(),
                        _v)];
                case 16:
                    if (!(body.method === "model.catalog")) return [3 /*break*/, 18];
                    optionsGuard(client, "modelCatalog");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _w = {
                        jsonrpc: "2.0",
                        id: (_179 = body.id) !== null && _179 !== void 0 ? _179 : null
                    };
                    return [4 /*yield*/, client.modelCatalog(workspaceID ? { workspaceID: workspaceID } : undefined)];
                case 17: return [2 /*return*/, (_w.result = _525.sent(),
                        _w)];
                case 18:
                    if (!(body.method === "model.selection")) return [3 /*break*/, 20];
                    optionsGuard(client, "modelSelection");
                    _x = {
                        jsonrpc: "2.0",
                        id: (_180 = body.id) !== null && _180 !== void 0 ? _180 : null
                    };
                    return [4 /*yield*/, client.modelSelection(optionalStringParam(body.params, "sessionID"))];
                case 19: return [2 /*return*/, (_x.result = _525.sent(),
                        _x)];
                case 20:
                    if (!(body.method === "model.select")) return [3 /*break*/, 22];
                    optionsGuard(client, "selectModel");
                    modelID = (_181 = body.params) === null || _181 === void 0 ? void 0 : _181.modelID;
                    variant = (_182 = body.params) === null || _182 === void 0 ? void 0 : _182.variant;
                    if (modelID !== undefined && typeof modelID !== "string")
                        throw invalidParams("model.select.params.modelID must be a string");
                    if (variant !== undefined && typeof variant !== "string")
                        throw invalidParams("model.select.params.variant must be a string");
                    return [4 /*yield*/, client.selectModel(modelID, variant, optionalStringParam(body.params, "sessionID"))];
                case 21:
                    _525.sent();
                    return [2 /*return*/, {
                            jsonrpc: "2.0",
                            id: (_183 = body.id) !== null && _183 !== void 0 ? _183 : null,
                            result: { modelID: modelID !== null && modelID !== void 0 ? modelID : null, variant: variant !== null && variant !== void 0 ? variant : null },
                        }];
                case 22:
                    if (!(body.method === "model.setDefault")) return [3 /*break*/, 24];
                    optionsGuard(client, "setDefaultModel");
                    modelID = (_184 = body.params) === null || _184 === void 0 ? void 0 : _184.modelID;
                    if (typeof modelID !== "string")
                        throw invalidParams("model.setDefault.params.modelID must be a string");
                    _y = {
                        jsonrpc: "2.0",
                        id: (_185 = body.id) !== null && _185 !== void 0 ? _185 : null
                    };
                    return [4 /*yield*/, ((_186 = client.setDefaultModel) === null || _186 === void 0 ? void 0 : _186.call(client, modelID))];
                case 23: return [2 /*return*/, (_y.result = _525.sent(),
                        _y)];
                case 24:
                    if (!(body.method === "model.reasoning")) return [3 /*break*/, 26];
                    optionsGuard(client, "reasoningEffort");
                    _z = {
                        jsonrpc: "2.0",
                        id: (_187 = body.id) !== null && _187 !== void 0 ? _187 : null
                    };
                    return [4 /*yield*/, client.reasoningEffort(optionalStringParam(body.params, "sessionID"))];
                case 25: return [2 /*return*/, (_z.result = (_188 = (_525.sent())) !== null && _188 !== void 0 ? _188 : null,
                        _z)];
                case 26:
                    if (!(body.method === "model.reasoning.set")) return [3 /*break*/, 28];
                    optionsGuard(client, "setReasoningEffort");
                    effort = (_189 = body.params) === null || _189 === void 0 ? void 0 : _189.effort;
                    if (effort !== undefined &&
                        !["minimal", "low", "medium", "high", "xhigh"].includes(String(effort)))
                        throw invalidParams("model.reasoning.set.params.effort must be minimal, low, medium, high, or xhigh");
                    return [4 /*yield*/, client.setReasoningEffort(effort, optionalStringParam(body.params, "sessionID"))];
                case 27:
                    _525.sent();
                    return [2 /*return*/, {
                            jsonrpc: "2.0",
                            id: (_190 = body.id) !== null && _190 !== void 0 ? _190 : null,
                            result: { effort: effort !== null && effort !== void 0 ? effort : null },
                        }];
                case 28:
                    if (!(body.method === "skills.list")) return [3 /*break*/, 30];
                    optionsGuard(client, "skills");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _0 = {
                        jsonrpc: "2.0",
                        id: (_191 = body.id) !== null && _191 !== void 0 ? _191 : null
                    };
                    return [4 /*yield*/, client.skills(workspaceID ? { workspaceID: workspaceID } : undefined)];
                case 29: return [2 /*return*/, (_0.result = _525.sent(),
                        _0)];
                case 30:
                    if (!(body.method === "workspace.files")) return [3 /*break*/, 32];
                    optionsGuard(client, "workspaceFiles");
                    query = (_192 = body.params) === null || _192 === void 0 ? void 0 : _192.query;
                    type = (_193 = body.params) === null || _193 === void 0 ? void 0 : _193.type;
                    limit = (_194 = body.params) === null || _194 === void 0 ? void 0 : _194.limit;
                    if (query !== undefined && typeof query !== "string")
                        throw invalidParams("workspace.files.params.query must be a string");
                    if (type !== undefined && type !== "file" && type !== "directory")
                        throw invalidParams("workspace.files.params.type must be file or directory");
                    if (limit !== undefined &&
                        (typeof limit !== "number" ||
                            !Number.isInteger(limit) ||
                            limit < 1 ||
                            limit > 200))
                        throw invalidParams("workspace.files.params.limit must be an integer between 1 and 200");
                    _1 = {
                        jsonrpc: "2.0",
                        id: (_195 = body.id) !== null && _195 !== void 0 ? _195 : null
                    };
                    return [4 /*yield*/, client.workspaceFiles({
                            query: typeof query === "string" ? query : undefined,
                            type: type,
                            limit: typeof limit === "number" ? limit : undefined,
                        })];
                case 31: return [2 /*return*/, (_1.result = _525.sent(),
                        _1)];
                case 32:
                    if (!(body.method === "workspace.search")) return [3 /*break*/, 34];
                    optionsGuard(client, "workspaceSearch");
                    query = stringParam(body.params, "query");
                    include = (_196 = body.params) === null || _196 === void 0 ? void 0 : _196.include;
                    limit = (_197 = body.params) === null || _197 === void 0 ? void 0 : _197.limit;
                    if (include !== undefined && typeof include !== "string")
                        throw invalidParams("workspace.search.params.include must be a string");
                    if (limit !== undefined &&
                        (typeof limit !== "number" ||
                            !Number.isInteger(limit) ||
                            limit < 1 ||
                            limit > 200))
                        throw invalidParams("workspace.search.params.limit must be an integer between 1 and 200");
                    _2 = {
                        jsonrpc: "2.0",
                        id: (_198 = body.id) !== null && _198 !== void 0 ? _198 : null
                    };
                    return [4 /*yield*/, client.workspaceSearch({
                            query: query,
                            include: typeof include === "string" ? include : undefined,
                            limit: typeof limit === "number" ? limit : undefined,
                        })];
                case 33: return [2 /*return*/, (_2.result = _525.sent(),
                        _2)];
                case 34:
                    if (!(body.method === "workspace.list")) return [3 /*break*/, 36];
                    optionsGuard(client, "workspaceList");
                    path = (_199 = body.params) === null || _199 === void 0 ? void 0 : _199.path;
                    offset = (_200 = body.params) === null || _200 === void 0 ? void 0 : _200.offset;
                    limit = (_201 = body.params) === null || _201 === void 0 ? void 0 : _201.limit;
                    if (path !== undefined && typeof path !== "string")
                        throw invalidParams("workspace.list.params.path must be a string");
                    if (offset !== undefined &&
                        (typeof offset !== "number" || !Number.isInteger(offset) || offset < 1))
                        throw invalidParams("workspace.list.params.offset must be a positive integer");
                    if (limit !== undefined &&
                        (typeof limit !== "number" ||
                            !Number.isInteger(limit) ||
                            limit < 1 ||
                            limit > 200))
                        throw invalidParams("workspace.list.params.limit must be an integer between 1 and 200");
                    _3 = {
                        jsonrpc: "2.0",
                        id: (_202 = body.id) !== null && _202 !== void 0 ? _202 : null
                    };
                    return [4 /*yield*/, client.workspaceList({
                            path: typeof path === "string" ? path : undefined,
                            offset: typeof offset === "number" ? offset : undefined,
                            limit: typeof limit === "number" ? limit : undefined,
                        })];
                case 35: return [2 /*return*/, (_3.result = _525.sent(),
                        _3)];
                case 36:
                    if (!(body.method === "workspace.read")) return [3 /*break*/, 38];
                    optionsGuard(client, "workspaceRead");
                    offset = (_203 = body.params) === null || _203 === void 0 ? void 0 : _203.offset;
                    limit = (_204 = body.params) === null || _204 === void 0 ? void 0 : _204.limit;
                    if (offset !== undefined &&
                        (typeof offset !== "number" || !Number.isInteger(offset) || offset < 1))
                        throw invalidParams("workspace.read.params.offset must be a positive integer");
                    if (limit !== undefined &&
                        (typeof limit !== "number" ||
                            !Number.isInteger(limit) ||
                            limit < 1 ||
                            limit > 2000))
                        throw invalidParams("workspace.read.params.limit must be an integer between 1 and 2000");
                    _4 = {
                        jsonrpc: "2.0",
                        id: (_205 = body.id) !== null && _205 !== void 0 ? _205 : null
                    };
                    return [4 /*yield*/, client.workspaceRead({
                            path: stringParam(body.params, "path"),
                            offset: typeof offset === "number" ? offset : undefined,
                            limit: typeof limit === "number" ? limit : undefined,
                        })];
                case 37: return [2 /*return*/, (_4.result = _525.sent(),
                        _4)];
                case 38:
                    if (!(body.method === "resource.read")) return [3 /*break*/, 40];
                    optionsGuard(client, "resourceRead");
                    resource = stringParam(body.params, "resource");
                    rawParams = (_206 = body.params) === null || _206 === void 0 ? void 0 : _206.params;
                    if (rawParams !== undefined &&
                        (!rawParams ||
                            typeof rawParams !== "object" ||
                            Array.isArray(rawParams)))
                        throw invalidParams("resource.read.params.params must be an object");
                    params = rawParams
                        ? Object.fromEntries(Object.entries(rawParams).map(function (_a) {
                            var key = _a[0], value = _a[1];
                            if (typeof value !== "string")
                                throw invalidParams("resource.read.params.params values must be strings");
                            return [key, value];
                        }))
                        : undefined;
                    _5 = {
                        jsonrpc: "2.0",
                        id: (_207 = body.id) !== null && _207 !== void 0 ? _207 : null
                    };
                    return [4 /*yield*/, client.resourceRead(__assign(__assign({ resource: resource }, (params ? { params: params } : {})), (optionalStringParam(body.params, "reader")
                            ? { reader: optionalStringParam(body.params, "reader") }
                            : {})))];
                case 39: return [2 /*return*/, (_5.result = _525.sent(),
                        _5)];
                case 40:
                    if (!(body.method === "workspace.write")) return [3 /*break*/, 42];
                    optionsGuard(client, "workspaceWrite");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("workspace.write.params must be an object");
                    path = params.path;
                    content = params.content;
                    if (typeof path !== "string")
                        throw invalidParams("workspace.write.params.path must be a string");
                    if (typeof content !== "string")
                        throw invalidParams("workspace.write.params.content must be a string");
                    encoding = params.encoding;
                    if (encoding !== undefined &&
                        encoding !== "utf8" &&
                        encoding !== "base64")
                        throw invalidParams("workspace.write.params.encoding must be utf8 or base64");
                    _6 = {
                        jsonrpc: "2.0",
                        id: (_208 = body.id) !== null && _208 !== void 0 ? _208 : null
                    };
                    return [4 /*yield*/, ((_209 = client.workspaceWrite) === null || _209 === void 0 ? void 0 : _209.call(client, __assign({ path: path, content: content }, (encoding ? { encoding: encoding } : {}))))];
                case 41: return [2 /*return*/, (_6.result = _525.sent(),
                        _6)];
                case 42:
                    if (!(body.method === "workspace.create")) return [3 /*break*/, 44];
                    optionsGuard(client, "workspaceCreate");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("workspace.create.params must be an object");
                    path = params.path;
                    if (typeof path !== "string")
                        throw invalidParams("workspace.create.params.path must be a string");
                    content = params.content;
                    if (content !== undefined && typeof content !== "string")
                        throw invalidParams("workspace.create.params.content must be a string");
                    directory = params.directory;
                    if (directory !== undefined && typeof directory !== "boolean")
                        throw invalidParams("workspace.create.params.directory must be a boolean");
                    _7 = {
                        jsonrpc: "2.0",
                        id: (_210 = body.id) !== null && _210 !== void 0 ? _210 : null
                    };
                    return [4 /*yield*/, ((_211 = client.workspaceCreate) === null || _211 === void 0 ? void 0 : _211.call(client, __assign(__assign({ path: path }, (typeof content === "string" ? { content: content } : {})), (typeof directory === "boolean" ? { directory: directory } : {}))))];
                case 43: return [2 /*return*/, (_7.result = _525.sent(),
                        _7)];
                case 44:
                    if (!(body.method === "workspace.rename")) return [3 /*break*/, 46];
                    optionsGuard(client, "workspaceRename");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("workspace.rename.params must be an object");
                    path = params.path;
                    newPath = params.newPath;
                    if (typeof path !== "string")
                        throw invalidParams("workspace.rename.params.path must be a string");
                    if (typeof newPath !== "string")
                        throw invalidParams("workspace.rename.params.newPath must be a string");
                    _8 = {
                        jsonrpc: "2.0",
                        id: (_212 = body.id) !== null && _212 !== void 0 ? _212 : null
                    };
                    return [4 /*yield*/, ((_213 = client.workspaceRename) === null || _213 === void 0 ? void 0 : _213.call(client, {
                            path: path,
                            newPath: newPath,
                        }))];
                case 45: return [2 /*return*/, (_8.result = _525.sent(),
                        _8)];
                case 46:
                    if (!(body.method === "workspace.delete")) return [3 /*break*/, 48];
                    optionsGuard(client, "workspaceDelete");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("workspace.delete.params must be an object");
                    path = params.path;
                    if (typeof path !== "string")
                        throw invalidParams("workspace.delete.params.path must be a string");
                    _9 = {
                        jsonrpc: "2.0",
                        id: (_214 = body.id) !== null && _214 !== void 0 ? _214 : null
                    };
                    return [4 /*yield*/, ((_215 = client.workspaceDelete) === null || _215 === void 0 ? void 0 : _215.call(client, {
                            path: path,
                        }))];
                case 47: return [2 /*return*/, (_9.result = _525.sent(),
                        _9)];
                case 48:
                    if (!(body.method === "workspace.writeConflicts")) return [3 /*break*/, 50];
                    optionsGuard(client, "workspaceWriteConflicts");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _10 = {
                        jsonrpc: "2.0",
                        id: (_216 = body.id) !== null && _216 !== void 0 ? _216 : null
                    };
                    return [4 /*yield*/, ((_217 = client.workspaceWriteConflicts) === null || _217 === void 0 ? void 0 : _217.call(client, workspaceID ? { workspaceID: workspaceID } : undefined))];
                case 49: return [2 /*return*/, (_10.result = (_218 = (_525.sent())) !== null && _218 !== void 0 ? _218 : [],
                        _10)];
                case 50:
                    if (!(body.method === "workspace.glob")) return [3 /*break*/, 52];
                    optionsGuard(client, "workspaceGlob");
                    path = (_219 = body.params) === null || _219 === void 0 ? void 0 : _219.path;
                    limit = (_220 = body.params) === null || _220 === void 0 ? void 0 : _220.limit;
                    if (path !== undefined && typeof path !== "string")
                        throw invalidParams("workspace.glob.params.path must be a string");
                    if (limit !== undefined &&
                        (typeof limit !== "number" ||
                            !Number.isInteger(limit) ||
                            limit < 1 ||
                            limit > 200))
                        throw invalidParams("workspace.glob.params.limit must be an integer between 1 and 200");
                    _11 = {
                        jsonrpc: "2.0",
                        id: (_221 = body.id) !== null && _221 !== void 0 ? _221 : null
                    };
                    return [4 /*yield*/, client.workspaceGlob({
                            pattern: stringParam(body.params, "pattern"),
                            path: typeof path === "string" ? path : undefined,
                            limit: typeof limit === "number" ? limit : undefined,
                        })];
                case 51: return [2 /*return*/, (_11.result = _525.sent(),
                        _11)];
                case 52:
                    if (!(body.method === "workspace.roots")) return [3 /*break*/, 54];
                    optionsGuard(client, "workspaceRoots");
                    _12 = {
                        jsonrpc: "2.0",
                        id: (_222 = body.id) !== null && _222 !== void 0 ? _222 : null
                    };
                    return [4 /*yield*/, ((_223 = client.workspaceRoots) === null || _223 === void 0 ? void 0 : _223.call(client))];
                case 53: return [2 /*return*/, (_12.result = _525.sent(),
                        _12)];
                case 54:
                    if (!(body.method === "workspace.add")) return [3 /*break*/, 56];
                    optionsGuard(client, "workspaceAdd");
                    path = stringParam(body.params, "path");
                    title = optionalStringParam(body.params, "title");
                    _13 = {
                        jsonrpc: "2.0",
                        id: (_224 = body.id) !== null && _224 !== void 0 ? _224 : null
                    };
                    return [4 /*yield*/, ((_225 = client.workspaceAdd) === null || _225 === void 0 ? void 0 : _225.call(client, __assign({ path: path }, (title !== undefined ? { title: title } : {}))))];
                case 55: return [2 /*return*/, (_13.result = _525.sent(),
                        _13)];
                case 56:
                    if (!(body.method === "workspace.remove")) return [3 /*break*/, 58];
                    optionsGuard(client, "workspaceRemove");
                    workspaceID = stringParam(body.params, "workspaceID");
                    _14 = {
                        jsonrpc: "2.0",
                        id: (_226 = body.id) !== null && _226 !== void 0 ? _226 : null
                    };
                    return [4 /*yield*/, ((_227 = client.workspaceRemove) === null || _227 === void 0 ? void 0 : _227.call(client, workspaceID))];
                case 57: return [2 /*return*/, (_14.result = _525.sent(),
                        _14)];
                case 58:
                    if (!(body.method === "workspace.activate")) return [3 /*break*/, 60];
                    optionsGuard(client, "workspaceActivate");
                    workspaceID = stringParam(body.params, "workspaceID");
                    _15 = {
                        jsonrpc: "2.0",
                        id: (_228 = body.id) !== null && _228 !== void 0 ? _228 : null
                    };
                    return [4 /*yield*/, ((_229 = client.workspaceActivate) === null || _229 === void 0 ? void 0 : _229.call(client, workspaceID))];
                case 59: return [2 /*return*/, (_15.result = _525.sent(),
                        _15)];
                case 60:
                    if (!(body.method === "workspace.permission.get")) return [3 /*break*/, 62];
                    optionsGuard(client, "workspacePermissionGet");
                    workspaceID = stringParam(body.params, "workspaceID");
                    _16 = {
                        jsonrpc: "2.0",
                        id: (_230 = body.id) !== null && _230 !== void 0 ? _230 : null
                    };
                    return [4 /*yield*/, ((_231 = client.workspacePermissionGet) === null || _231 === void 0 ? void 0 : _231.call(client, workspaceID))];
                case 61: return [2 /*return*/, (_16.result = _525.sent(),
                        _16)];
                case 62:
                    if (!(body.method === "workspace.permission.set")) return [3 /*break*/, 64];
                    optionsGuard(client, "workspacePermissionSet");
                    workspaceID = stringParam(body.params, "workspaceID");
                    if (!body.params ||
                        typeof body.params.settings !== "object" ||
                        body.params.settings === null)
                        throw invalidParams("workspace.permission.set.params.settings must be an object");
                    _17 = {
                        jsonrpc: "2.0",
                        id: (_232 = body.id) !== null && _232 !== void 0 ? _232 : null
                    };
                    return [4 /*yield*/, ((_233 = client.workspacePermissionSet) === null || _233 === void 0 ? void 0 : _233.call(client, workspaceID, body.params.settings))];
                case 63: return [2 /*return*/, (_17.result = _525.sent(),
                        _17)];
                case 64:
                    if (!(body.method === "workspace.tool.get")) return [3 /*break*/, 66];
                    optionsGuard(client, "workspaceToolGet");
                    workspaceID = stringParam(body.params, "workspaceID");
                    _18 = {
                        jsonrpc: "2.0",
                        id: (_234 = body.id) !== null && _234 !== void 0 ? _234 : null
                    };
                    return [4 /*yield*/, ((_235 = client.workspaceToolGet) === null || _235 === void 0 ? void 0 : _235.call(client, workspaceID))];
                case 65: return [2 /*return*/, (_18.result = _525.sent(),
                        _18)];
                case 66:
                    if (!(body.method === "workspace.tool.set")) return [3 /*break*/, 68];
                    optionsGuard(client, "workspaceToolSet");
                    workspaceID = stringParam(body.params, "workspaceID");
                    if (!body.params ||
                        typeof body.params.settings !== "object" ||
                        body.params.settings === null)
                        throw invalidParams("workspace.tool.set.params.settings must be an object");
                    _19 = {
                        jsonrpc: "2.0",
                        id: (_236 = body.id) !== null && _236 !== void 0 ? _236 : null
                    };
                    return [4 /*yield*/, ((_237 = client.workspaceToolSet) === null || _237 === void 0 ? void 0 : _237.call(client, workspaceID, body.params.settings))];
                case 67: return [2 /*return*/, (_19.result = _525.sent(),
                        _19)];
                case 68:
                    if (!(body.method === "checkpoint.list")) return [3 /*break*/, 70];
                    optionsGuard(client, "checkpointList");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    _20 = {
                        jsonrpc: "2.0",
                        id: (_238 = body.id) !== null && _238 !== void 0 ? _238 : null
                    };
                    return [4 /*yield*/, ((_239 = client.checkpointList) === null || _239 === void 0 ? void 0 : _239.call(client, sessionID))];
                case 69: return [2 /*return*/, (_20.result = _525.sent(),
                        _20)];
                case 70:
                    if (!(body.method === "checkpoint.preview")) return [3 /*break*/, 72];
                    optionsGuard(client, "checkpointPreview");
                    checkpointOptions = (_240 = body.params) === null || _240 === void 0 ? void 0 : _240.options;
                    includePatch = checkpointOptions === null || checkpointOptions === void 0 ? void 0 : checkpointOptions.includePatch;
                    if (includePatch !== undefined && typeof includePatch !== "boolean")
                        throw invalidParams("checkpoint.preview.params.options.includePatch must be a boolean");
                    _21 = {
                        jsonrpc: "2.0",
                        id: (_241 = body.id) !== null && _241 !== void 0 ? _241 : null
                    };
                    return [4 /*yield*/, client.checkpointPreview(stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID"), includePatch === undefined ? undefined : { includePatch: includePatch })];
                case 71: return [2 /*return*/, (_21.result = _525.sent(),
                        _21)];
                case 72:
                    if (!(body.method === "checkpoint.rollback")) return [3 /*break*/, 74];
                    optionsGuard(client, "checkpointRollback");
                    dryRun = (_242 = body.params) === null || _242 === void 0 ? void 0 : _242.dryRun;
                    if (dryRun !== undefined && typeof dryRun !== "boolean")
                        throw invalidParams("checkpoint.rollback.params.dryRun must be a boolean");
                    _22 = {
                        jsonrpc: "2.0",
                        id: (_243 = body.id) !== null && _243 !== void 0 ? _243 : null
                    };
                    return [4 /*yield*/, client.checkpointRollback(__assign({ id: stringParam(body.params, "id"), dryRun: typeof dryRun === "boolean" ? dryRun : undefined }, (optionalStringParam(body.params, "sessionID")
                            ? { sessionID: optionalStringParam(body.params, "sessionID") }
                            : {})))];
                case 73: return [2 /*return*/, (_22.result = _525.sent(),
                        _22)];
                case 74:
                    if (!(body.method === "checkpoint.rename")) return [3 /*break*/, 76];
                    optionsGuard(client, "checkpointRename");
                    _23 = {
                        jsonrpc: "2.0",
                        id: (_244 = body.id) !== null && _244 !== void 0 ? _244 : null
                    };
                    return [4 /*yield*/, client.checkpointRename(__assign({ id: stringParam(body.params, "id"), name: stringParam(body.params, "name") }, (optionalStringParam(body.params, "sessionID")
                            ? { sessionID: optionalStringParam(body.params, "sessionID") }
                            : {})))];
                case 75: return [2 /*return*/, (_23.result = _525.sent(),
                        _23)];
                case 76:
                    if (!(body.method === "checkpoint.listByKind")) return [3 /*break*/, 78];
                    optionsGuard(client, "checkpointListByKind");
                    kind = optionalStringParam(body.params, "kind");
                    _24 = {
                        jsonrpc: "2.0",
                        id: (_245 = body.id) !== null && _245 !== void 0 ? _245 : null
                    };
                    return [4 /*yield*/, ((_246 = client.checkpointListByKind) === null || _246 === void 0 ? void 0 : _246.call(client, kind, optionalStringParam(body.params, "sessionID")))];
                case 77: return [2 /*return*/, (_24.result = _525.sent(),
                        _24)];
                case 78:
                    if (!(body.method === "audit.rounds")) return [3 /*break*/, 80];
                    optionsGuard(client, "auditRounds");
                    _25 = {
                        jsonrpc: "2.0",
                        id: (_247 = body.id) !== null && _247 !== void 0 ? _247 : null
                    };
                    return [4 /*yield*/, ((_248 = client.auditRounds) === null || _248 === void 0 ? void 0 : _248.call(client, optionalStringParam(body.params, "planID"), optionalStringParam(body.params, "workspaceID")))];
                case 79: return [2 /*return*/, (_25.result = _525.sent(),
                        _25)];
                case 80:
                    if (!(body.method === "workspace.round.diff")) return [3 /*break*/, 82];
                    optionsGuard(client, "roundDiff");
                    input = body.params;
                    _26 = {
                        jsonrpc: "2.0",
                        id: (_249 = body.id) !== null && _249 !== void 0 ? _249 : null
                    };
                    return [4 /*yield*/, ((_250 = client.roundDiff) === null || _250 === void 0 ? void 0 : _250.call(client, input))];
                case 81: return [2 /*return*/, (_26.result = _525.sent(),
                        _26)];
                case 82:
                    if (!(body.method === "sandbox.list")) return [3 /*break*/, 84];
                    optionsGuard(client, "sandboxList");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    _27 = {
                        jsonrpc: "2.0",
                        id: (_251 = body.id) !== null && _251 !== void 0 ? _251 : null
                    };
                    return [4 /*yield*/, ((_252 = client.sandboxList) === null || _252 === void 0 ? void 0 : _252.call(client, sessionID))];
                case 83: return [2 /*return*/, (_27.result = _525.sent(),
                        _27)];
                case 84:
                    if (!(body.method === "sandbox.diff")) return [3 /*break*/, 86];
                    optionsGuard(client, "sandboxDiff");
                    sandboxOptions = (_253 = body.params) === null || _253 === void 0 ? void 0 : _253.options;
                    includePatch = sandboxOptions === null || sandboxOptions === void 0 ? void 0 : sandboxOptions.includePatch;
                    if (includePatch !== undefined && typeof includePatch !== "boolean")
                        throw invalidParams("sandbox.diff.params.options.includePatch must be a boolean");
                    _28 = {
                        jsonrpc: "2.0",
                        id: (_254 = body.id) !== null && _254 !== void 0 ? _254 : null
                    };
                    return [4 /*yield*/, ((_255 = client.sandboxDiff) === null || _255 === void 0 ? void 0 : _255.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID"), includePatch === undefined ? undefined : { includePatch: includePatch }))];
                case 85: return [2 /*return*/, (_28.result = _525.sent(),
                        _28)];
                case 86:
                    if (!(body.method === "sandbox.resources")) return [3 /*break*/, 88];
                    optionsGuard(client, "sandboxResources");
                    _29 = {
                        jsonrpc: "2.0",
                        id: (_256 = body.id) !== null && _256 !== void 0 ? _256 : null
                    };
                    return [4 /*yield*/, ((_257 = client.sandboxResources) === null || _257 === void 0 ? void 0 : _257.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 87: return [2 /*return*/, (_29.result = _525.sent(),
                        _29)];
                case 88:
                    if (!(body.method === "sandbox.resource.output")) return [3 /*break*/, 90];
                    optionsGuard(client, "sandboxResourceOutput");
                    maxBytes = (_258 = body.params) === null || _258 === void 0 ? void 0 : _258.maxBytes;
                    if (maxBytes !== undefined &&
                        (typeof maxBytes !== "number" ||
                            !Number.isInteger(maxBytes) ||
                            maxBytes < 1 ||
                            maxBytes > 20000))
                        throw invalidParams("sandbox.resource.output.params.maxBytes must be an integer between 1 and 20000");
                    _30 = {
                        jsonrpc: "2.0",
                        id: (_259 = body.id) !== null && _259 !== void 0 ? _259 : null
                    };
                    return [4 /*yield*/, client.sandboxResourceOutput(__assign({ id: stringParam(body.params, "id"), resourceID: stringParam(body.params, "resourceID"), maxBytes: typeof maxBytes === "number" ? maxBytes : undefined }, (optionalStringParam(body.params, "sessionID")
                            ? { sessionID: optionalStringParam(body.params, "sessionID") }
                            : {})))];
                case 89: return [2 /*return*/, (_30.result = _525.sent(),
                        _30)];
                case 90:
                    if (!(body.method === "sandbox.merge")) return [3 /*break*/, 92];
                    optionsGuard(client, "sandboxMerge");
                    _31 = {
                        jsonrpc: "2.0",
                        id: (_260 = body.id) !== null && _260 !== void 0 ? _260 : null
                    };
                    return [4 /*yield*/, ((_261 = client.sandboxMerge) === null || _261 === void 0 ? void 0 : _261.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 91: return [2 /*return*/, (_31.result = _525.sent(),
                        _31)];
                case 92:
                    if (!(body.method === "sandbox.delete")) return [3 /*break*/, 94];
                    optionsGuard(client, "sandboxDelete");
                    _32 = {
                        jsonrpc: "2.0",
                        id: (_262 = body.id) !== null && _262 !== void 0 ? _262 : null
                    };
                    return [4 /*yield*/, ((_263 = client.sandboxDelete) === null || _263 === void 0 ? void 0 : _263.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 93: return [2 /*return*/, (_32.result = _525.sent(),
                        _32)];
                case 94:
                    if (!(body.method === "sandbox.rollback")) return [3 /*break*/, 96];
                    optionsGuard(client, "sandboxRollback");
                    _33 = {
                        jsonrpc: "2.0",
                        id: (_264 = body.id) !== null && _264 !== void 0 ? _264 : null
                    };
                    return [4 /*yield*/, ((_265 = client.sandboxRollback) === null || _265 === void 0 ? void 0 : _265.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 95: return [2 /*return*/, (_33.result = _525.sent(),
                        _33)];
                case 96:
                    if (!(body.method === "sandbox.resource.stop")) return [3 /*break*/, 98];
                    optionsGuard(client, "sandboxResourceStop");
                    _34 = {
                        jsonrpc: "2.0",
                        id: (_266 = body.id) !== null && _266 !== void 0 ? _266 : null
                    };
                    return [4 /*yield*/, client.sandboxResourceStop(__assign({ id: stringParam(body.params, "id"), resourceID: stringParam(body.params, "resourceID") }, (optionalStringParam(body.params, "sessionID")
                            ? { sessionID: optionalStringParam(body.params, "sessionID") }
                            : {})))];
                case 97: return [2 /*return*/, (_34.result = _525.sent(),
                        _34)];
                case 98:
                    if (!(body.method === "approval.respond")) return [3 /*break*/, 100];
                    requestID = stringParam(body.params, "requestID");
                    decision = stringParam(body.params, "decision");
                    if (!["once", "session", "reject"].includes(decision))
                        throw invalidParams("approval.respond.params.decision is invalid");
                    _35 = {
                        jsonrpc: "2.0",
                        id: (_267 = body.id) !== null && _267 !== void 0 ? _267 : null
                    };
                    return [4 /*yield*/, client.respondApproval(__assign(__assign({ requestID: requestID, decision: decision, feedback: typeof ((_268 = body.params) === null || _268 === void 0 ? void 0 : _268.feedback) === "string"
                                ? body.params.feedback
                                : undefined }, (optionalStringParam(body.params, "sessionID")
                            ? { sessionID: optionalStringParam(body.params, "sessionID") }
                            : {})), (optionalStringParam(body.params, "workspaceID")
                            ? { workspaceID: optionalStringParam(body.params, "workspaceID") }
                            : {})))];
                case 99: 
                // An answer to a request that already timed out is dropped by the runtime,
                // and an external UI has to be told: it used to get `responded: true`.
                // Routing hints must survive the hop: without them the runtime falls back
                // to the attached session and can journal the answer to the wrong one.
                return [2 /*return*/, (_35.result = _525.sent(),
                        _35)];
                case 100:
                    if (!(body.method === "interactive.respond")) return [3 /*break*/, 102];
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("interactive.respond.params must be an object");
                    record = params;
                    if (typeof record.requestID !== "string" || !record.requestID)
                        throw invalidParams("interactive.respond.params.requestID must be a non-empty string");
                    if (typeof record.kind !== "string" || !record.kind)
                        throw invalidParams("interactive.respond.params.kind must be a non-empty string");
                    if (record.response === undefined)
                        throw invalidParams("interactive.respond.params.response is required");
                    if (record.sessionID !== undefined &&
                        typeof record.sessionID !== "string")
                        throw invalidParams("interactive.respond.params.sessionID must be a string");
                    optionsGuard(client, "respondInteractive");
                    _36 = {
                        jsonrpc: "2.0",
                        id: (_269 = body.id) !== null && _269 !== void 0 ? _269 : null
                    };
                    return [4 /*yield*/, client.respondInteractive(__assign(__assign({ requestID: record.requestID, kind: record.kind, response: record.response }, (record.rejected === true ? { rejected: true } : {})), (record.sessionID
                            ? { sessionID: record.sessionID }
                            : {})))];
                case 101: return [2 /*return*/, (_36.result = _525.sent(),
                        _36)];
                case 102:
                    if (!(body.method === "question.respond")) return [3 /*break*/, 104];
                    _37 = {
                        jsonrpc: "2.0",
                        id: (_270 = body.id) !== null && _270 !== void 0 ? _270 : null
                    };
                    return [4 /*yield*/, client.respondQuestion(__assign(__assign({ requestID: stringParam(body.params, "requestID"), answers: arrayParam(body.params, "answers"), rejected: Boolean((_271 = body.params) === null || _271 === void 0 ? void 0 : _271.rejected) }, (optionalStringParam(body.params, "sessionID")
                            ? { sessionID: optionalStringParam(body.params, "sessionID") }
                            : {})), (optionalStringParam(body.params, "workspaceID")
                            ? { workspaceID: optionalStringParam(body.params, "workspaceID") }
                            : {})))];
                case 103: return [2 /*return*/, (_37.result = _525.sent(),
                        _37)];
                case 104:
                    if (!(body.method === "interactive.pending")) return [3 /*break*/, 106];
                    optionsGuard(client, "pendingInteractive");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _38 = {
                        jsonrpc: "2.0",
                        id: (_272 = body.id) !== null && _272 !== void 0 ? _272 : null
                    };
                    return [4 /*yield*/, client.pendingInteractive(__assign(__assign({}, (sessionID ? { sessionID: sessionID } : {})), (workspaceID ? { workspaceID: workspaceID } : {})))];
                case 105: return [2 /*return*/, (_38.result = _525.sent(),
                        _38)];
                case 106:
                    if (body.method === "snapshot")
                        return [2 /*return*/, {
                                jsonrpc: "2.0",
                                id: (_273 = body.id) !== null && _273 !== void 0 ? _273 : null,
                                result: client.snapshot(),
                            }];
                    if (!(body.method === "session.history")) return [3 /*break*/, 108];
                    optionsGuard(client, "history");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    after = (_274 = body.params) === null || _274 === void 0 ? void 0 : _274.after;
                    offset = (_275 = body.params) === null || _275 === void 0 ? void 0 : _275.offset;
                    limit = (_276 = body.params) === null || _276 === void 0 ? void 0 : _276.limit;
                    if (after !== undefined &&
                        (typeof after !== "number" || !Number.isInteger(after) || after < 0))
                        throw invalidParams("session.history.params.after must be a non-negative integer");
                    if (offset !== undefined &&
                        (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0))
                        throw invalidParams("session.history.params.offset must be a non-negative integer");
                    if (limit !== undefined &&
                        (typeof limit !== "number" ||
                            !Number.isInteger(limit) ||
                            limit < 1 ||
                            limit > 2000))
                        throw invalidParams("session.history.params.limit must be an integer between 1 and 2000");
                    _39 = {
                        jsonrpc: "2.0",
                        id: (_277 = body.id) !== null && _277 !== void 0 ? _277 : null
                    };
                    return [4 /*yield*/, client.history({
                            sessionID: sessionID,
                            after: typeof after === "number" ? after : undefined,
                            offset: typeof offset === "number" ? offset : undefined,
                            limit: typeof limit === "number" ? limit : undefined,
                        })];
                case 107: return [2 /*return*/, (_39.result = _525.sent(),
                        _39)];
                case 108:
                    if (!(body.method === "session.eventWindow")) return [3 /*break*/, 110];
                    optionsGuard(client, "eventWindow");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    beforeSeq = (_278 = body.params) === null || _278 === void 0 ? void 0 : _278.beforeSeq;
                    limit = (_279 = body.params) === null || _279 === void 0 ? void 0 : _279.limit;
                    if (beforeSeq !== undefined &&
                        (typeof beforeSeq !== "number" ||
                            !Number.isInteger(beforeSeq) ||
                            beforeSeq < 1))
                        throw invalidParams("session.eventWindow.params.beforeSeq must be a positive integer");
                    if (limit !== undefined &&
                        (typeof limit !== "number" ||
                            !Number.isInteger(limit) ||
                            limit < 1 ||
                            limit > 2000))
                        throw invalidParams("session.eventWindow.params.limit must be an integer between 1 and 2000");
                    _40 = {
                        jsonrpc: "2.0",
                        id: (_280 = body.id) !== null && _280 !== void 0 ? _280 : null
                    };
                    return [4 /*yield*/, client.eventWindow({
                            sessionID: sessionID,
                            beforeSeq: typeof beforeSeq === "number" ? beforeSeq : undefined,
                            limit: typeof limit === "number" ? limit : undefined,
                        })];
                case 109: return [2 /*return*/, (_40.result = _525.sent(),
                        _40)];
                case 110:
                    if (!(body.method === "session.messages")) return [3 /*break*/, 112];
                    optionsGuard(client, "messages");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    limit = (_281 = body.params) === null || _281 === void 0 ? void 0 : _281.limit;
                    order = (_282 = body.params) === null || _282 === void 0 ? void 0 : _282.order;
                    cursor = (_283 = body.params) === null || _283 === void 0 ? void 0 : _283.cursor;
                    if (limit !== undefined &&
                        (typeof limit !== "number" ||
                            !Number.isInteger(limit) ||
                            limit < 1 ||
                            limit > 200))
                        throw invalidParams("session.messages.params.limit must be an integer between 1 and 200");
                    if (order !== undefined && order !== "asc" && order !== "desc")
                        throw invalidParams("session.messages.params.order must be asc or desc");
                    if (cursor !== undefined && typeof cursor !== "string")
                        throw invalidParams("session.messages.params.cursor must be a string");
                    if (cursor !== undefined && order !== undefined)
                        throw invalidParams("session.messages.params.cursor cannot be combined with order");
                    _41 = {
                        jsonrpc: "2.0",
                        id: (_284 = body.id) !== null && _284 !== void 0 ? _284 : null
                    };
                    return [4 /*yield*/, client.messages({
                            sessionID: sessionID,
                            limit: typeof limit === "number" ? limit : undefined,
                            order: order,
                            cursor: typeof cursor === "string" ? cursor : undefined,
                        })];
                case 111: return [2 /*return*/, (_41.result = _525.sent(),
                        _41)];
                case 112:
                    if (!(body.method === "session.list")) return [3 /*break*/, 114];
                    optionsGuard(client, "sessionList");
                    _42 = {
                        jsonrpc: "2.0",
                        id: (_285 = body.id) !== null && _285 !== void 0 ? _285 : null
                    };
                    return [4 /*yield*/, client.sessionList()];
                case 113: return [2 /*return*/, (_42.result = _525.sent(),
                        _42)];
                case 114:
                    if (!(body.method === "session.touch")) return [3 /*break*/, 116];
                    optionsGuard(client, "sessionTouch");
                    return [4 /*yield*/, client.sessionTouch(stringParam(body.params, "id"))];
                case 115:
                    _525.sent();
                    return [2 /*return*/, { jsonrpc: "2.0", id: (_286 = body.id) !== null && _286 !== void 0 ? _286 : null, result: { touched: true } }];
                case 116:
                    if (!(body.method === "session.rename")) return [3 /*break*/, 118];
                    optionsGuard(client, "sessionRename");
                    _43 = {
                        jsonrpc: "2.0",
                        id: (_287 = body.id) !== null && _287 !== void 0 ? _287 : null
                    };
                    return [4 /*yield*/, client.sessionRename(stringParam(body.params, "id"), stringParam(body.params, "title"))];
                case 117: return [2 /*return*/, (_43.result = _525.sent(),
                        _43)];
                case 118:
                    if (!(body.method === "session.pin")) return [3 /*break*/, 120];
                    optionsGuard(client, "sessionPin");
                    if (typeof ((_288 = body.params) === null || _288 === void 0 ? void 0 : _288.pinned) !== "boolean")
                        throw invalidParams("session.pin.params.pinned must be a boolean");
                    _44 = {
                        jsonrpc: "2.0",
                        id: (_289 = body.id) !== null && _289 !== void 0 ? _289 : null
                    };
                    return [4 /*yield*/, client.sessionPin(stringParam(body.params, "id"), body.params.pinned)];
                case 119: return [2 /*return*/, (_44.result = _525.sent(),
                        _44)];
                case 120:
                    if (!(body.method === "session.duplicate")) return [3 /*break*/, 122];
                    optionsGuard(client, "sessionDuplicate");
                    title = (_290 = body.params) === null || _290 === void 0 ? void 0 : _290.title;
                    if (title !== undefined && typeof title !== "string")
                        throw invalidParams("session.duplicate.params.title must be a string");
                    _45 = {
                        jsonrpc: "2.0",
                        id: (_291 = body.id) !== null && _291 !== void 0 ? _291 : null
                    };
                    return [4 /*yield*/, client.sessionDuplicate(stringParam(body.params, "id"), typeof title === "string" ? title : undefined)];
                case 121: return [2 /*return*/, (_45.result = _525.sent(),
                        _45)];
                case 122:
                    if (!(body.method === "session.fork")) return [3 /*break*/, 124];
                    optionsGuard(client, "sessionFork");
                    title = (_292 = body.params) === null || _292 === void 0 ? void 0 : _292.title;
                    if (title !== undefined && typeof title !== "string")
                        throw invalidParams("session.fork.params.title must be a string");
                    _46 = {
                        jsonrpc: "2.0",
                        id: (_293 = body.id) !== null && _293 !== void 0 ? _293 : null
                    };
                    return [4 /*yield*/, client.sessionFork(stringParam(body.params, "id"), stringParam(body.params, "turnID"), typeof title === "string" ? title : undefined)];
                case 123: return [2 /*return*/, (_46.result = _525.sent(),
                        _46)];
                case 124:
                    if (!(body.method === "session.rollback.messages")) return [3 /*break*/, 126];
                    optionsGuard(client, "sessionRollbackMessages");
                    _47 = {
                        jsonrpc: "2.0",
                        id: (_294 = body.id) !== null && _294 !== void 0 ? _294 : null
                    };
                    return [4 /*yield*/, ((_295 = client.sessionRollbackMessages) === null || _295 === void 0 ? void 0 : _295.call(client, stringParam(body.params, "id"), stringParam(body.params, "turnID")))];
                case 125: return [2 /*return*/, (_47.result = _525.sent(),
                        _47)];
                case 126:
                    if (!(body.method === "session.delete")) return [3 /*break*/, 128];
                    optionsGuard(client, "sessionDelete");
                    _48 = {
                        jsonrpc: "2.0",
                        id: (_296 = body.id) !== null && _296 !== void 0 ? _296 : null
                    };
                    return [4 /*yield*/, client.sessionDelete(stringParam(body.params, "id"))];
                case 127: return [2 /*return*/, (_48.result = _525.sent(),
                        _48)];
                case 128:
                    if (!(body.method === "session.new")) return [3 /*break*/, 130];
                    optionsGuard(client, "sessionNew");
                    params = body.params;
                    id = params &&
                        typeof params === "object" &&
                        typeof params.id === "string"
                        ? params.id
                        : undefined;
                    title = params &&
                        typeof params === "object" &&
                        typeof params.title === "string"
                        ? params.title
                        : undefined;
                    _49 = {
                        jsonrpc: "2.0",
                        id: (_297 = body.id) !== null && _297 !== void 0 ? _297 : null
                    };
                    return [4 /*yield*/, ((_298 = client.sessionNew) === null || _298 === void 0 ? void 0 : _298.call(client, { id: id, title: title }))];
                case 129: return [2 /*return*/, (_49.result = _525.sent(),
                        _49)];
                case 130:
                    if (!(body.method === "session.archive")) return [3 /*break*/, 132];
                    optionsGuard(client, "sessionArchive");
                    _50 = {
                        jsonrpc: "2.0",
                        id: (_299 = body.id) !== null && _299 !== void 0 ? _299 : null
                    };
                    return [4 /*yield*/, client.sessionArchive(stringParam(body.params, "id"))];
                case 131: return [2 /*return*/, (_50.result = _525.sent(),
                        _50)];
                case 132:
                    if (!(body.method === "session.restore")) return [3 /*break*/, 134];
                    optionsGuard(client, "sessionRestore");
                    _51 = {
                        jsonrpc: "2.0",
                        id: (_300 = body.id) !== null && _300 !== void 0 ? _300 : null
                    };
                    return [4 /*yield*/, client.sessionRestore(stringParam(body.params, "id"))];
                case 133: return [2 /*return*/, (_51.result = _525.sent(),
                        _51)];
                case 134:
                    if (!(body.method === "session.export")) return [3 /*break*/, 136];
                    optionsGuard(client, "sessionExport");
                    _52 = {
                        jsonrpc: "2.0",
                        id: (_301 = body.id) !== null && _301 !== void 0 ? _301 : null
                    };
                    return [4 /*yield*/, client.sessionExport(stringParam(body.params, "id"))];
                case 135: return [2 /*return*/, (_52.result = _525.sent(),
                        _52)];
                case 136:
                    if (!(body.method === "session.attach")) return [3 /*break*/, 138];
                    optionsGuard(client, "sessionAttach");
                    _53 = {
                        jsonrpc: "2.0",
                        id: (_302 = body.id) !== null && _302 !== void 0 ? _302 : null
                    };
                    return [4 /*yield*/, client.sessionAttach(stringParam(body.params, "id"))];
                case 137: return [2 /*return*/, (_53.result = _525.sent(),
                        _53)];
                case 138:
                    if (!(body.method === "mcp.catalog")) return [3 /*break*/, 140];
                    optionsGuard(client, "mcpCatalog");
                    _54 = {
                        jsonrpc: "2.0",
                        id: (_303 = body.id) !== null && _303 !== void 0 ? _303 : null
                    };
                    return [4 /*yield*/, client.mcpCatalog()];
                case 139: return [2 /*return*/, (_54.result = _525.sent(),
                        _54)];
                case 140:
                    if (!(body.method === "plugin.list")) return [3 /*break*/, 142];
                    optionsGuard(client, "plugins");
                    _55 = {
                        jsonrpc: "2.0",
                        id: (_304 = body.id) !== null && _304 !== void 0 ? _304 : null
                    };
                    return [4 /*yield*/, client.plugins()];
                case 141: return [2 /*return*/, (_55.result = _525.sent(),
                        _55)];
                case 142:
                    if (!(body.method === "command.catalog")) return [3 /*break*/, 144];
                    optionsGuard(client, "commandCatalog");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _56 = {
                        jsonrpc: "2.0",
                        id: (_305 = body.id) !== null && _305 !== void 0 ? _305 : null
                    };
                    return [4 /*yield*/, client.commandCatalog(workspaceID ? { workspaceID: workspaceID } : undefined)];
                case 143: return [2 /*return*/, (_56.result = _525.sent(),
                        _56)];
                case 144:
                    if (!(body.method === "command.execute")) return [3 /*break*/, 146];
                    optionsGuard(client, "commandExecute");
                    name_2 = (_306 = body.params) === null || _306 === void 0 ? void 0 : _306.name;
                    raw_1 = (_307 = body.params) === null || _307 === void 0 ? void 0 : _307.raw;
                    args = (_308 = body.params) === null || _308 === void 0 ? void 0 : _308.args;
                    if (typeof name_2 !== "string")
                        throw invalidParams("command.execute.params.name must be a string");
                    if (typeof raw_1 !== "string")
                        throw invalidParams("command.execute.params.raw must be a string");
                    if (!Array.isArray(args) || !args.every(function (arg) { return typeof arg === "string"; }))
                        throw invalidParams("command.execute.params.args must be an array of strings");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    return [4 /*yield*/, client.commandExecute(__assign(__assign({ name: name_2, raw: raw_1, args: args }, (sessionID ? { sessionID: sessionID } : {})), (workspaceID ? { workspaceID: workspaceID } : {})))];
                case 145:
                    _525.sent();
                    return [2 /*return*/, {
                            jsonrpc: "2.0",
                            id: (_309 = body.id) !== null && _309 !== void 0 ? _309 : null,
                            result: null,
                        }];
                case 146:
                    if (!(body.method === "workgraph.nodes")) return [3 /*break*/, 148];
                    optionsGuard(client, "workGraphNodes");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _57 = {
                        jsonrpc: "2.0",
                        id: (_310 = body.id) !== null && _310 !== void 0 ? _310 : null
                    };
                    return [4 /*yield*/, client.workGraphNodes(__assign(__assign({}, (sessionID ? { sessionID: sessionID } : {})), (workspaceID ? { workspaceID: workspaceID } : {})))];
                case 147: return [2 /*return*/, (_57.result = _525.sent(),
                        _57)];
                case 148:
                    if (!(body.method === "workgraph.edges")) return [3 /*break*/, 150];
                    optionsGuard(client, "workGraphEdges");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _58 = {
                        jsonrpc: "2.0",
                        id: (_311 = body.id) !== null && _311 !== void 0 ? _311 : null
                    };
                    return [4 /*yield*/, client.workGraphEdges(__assign(__assign({}, (sessionID ? { sessionID: sessionID } : {})), (workspaceID ? { workspaceID: workspaceID } : {})))];
                case 149: return [2 /*return*/, (_58.result = _525.sent(),
                        _58)];
                case 150:
                    if (!(body.method === "nativeTerminal.list")) return [3 /*break*/, 152];
                    optionsGuard(client, "nativeTerminalList");
                    _59 = {
                        jsonrpc: "2.0",
                        id: (_312 = body.id) !== null && _312 !== void 0 ? _312 : null
                    };
                    return [4 /*yield*/, ((_313 = client.nativeTerminalList) === null || _313 === void 0 ? void 0 : _313.call(client, optionalStringParam(body.params, "sessionID")))];
                case 151: return [2 /*return*/, (_59.result = _525.sent(),
                        _59)];
                case 152:
                    if (!(body.method === "nativeTerminal.read")) return [3 /*break*/, 154];
                    optionsGuard(client, "nativeTerminalRead");
                    _60 = {
                        jsonrpc: "2.0",
                        id: (_314 = body.id) !== null && _314 !== void 0 ? _314 : null
                    };
                    return [4 /*yield*/, ((_315 = client.nativeTerminalRead) === null || _315 === void 0 ? void 0 : _315.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 153: return [2 /*return*/, (_60.result = _525.sent(),
                        _60)];
                case 154:
                    if (!(body.method === "nativeTerminal.stop")) return [3 /*break*/, 156];
                    optionsGuard(client, "nativeTerminalStop");
                    _61 = {
                        jsonrpc: "2.0",
                        id: (_316 = body.id) !== null && _316 !== void 0 ? _316 : null
                    };
                    return [4 /*yield*/, ((_317 = client.nativeTerminalStop) === null || _317 === void 0 ? void 0 : _317.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 155: return [2 /*return*/, (_61.result = _525.sent(),
                        _61)];
                case 156:
                    if (!(body.method === "nativeTerminal.openHub")) return [3 /*break*/, 158];
                    optionsGuard(client, "nativeTerminalOpenHub");
                    _62 = {
                        jsonrpc: "2.0",
                        id: (_318 = body.id) !== null && _318 !== void 0 ? _318 : null
                    };
                    return [4 /*yield*/, client.nativeTerminalOpenHub()];
                case 157: return [2 /*return*/, (_62.result = _525.sent(),
                        _62)];
                case 158:
                    if (!(body.method === "nativeTerminal.claimHumanInput")) return [3 /*break*/, 160];
                    optionsGuard(client, "nativeTerminalClaimHumanInput");
                    _63 = {
                        jsonrpc: "2.0",
                        id: (_319 = body.id) !== null && _319 !== void 0 ? _319 : null
                    };
                    return [4 /*yield*/, ((_320 = client.nativeTerminalClaimHumanInput) === null || _320 === void 0 ? void 0 : _320.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 159: return [2 /*return*/, (_63.result = _525.sent(),
                        _63)];
                case 160:
                    if (!(body.method === "nativeTerminal.revokeApprovalScope")) return [3 /*break*/, 162];
                    optionsGuard(client, "nativeTerminalRevokeApprovalScope");
                    _64 = {
                        jsonrpc: "2.0",
                        id: (_321 = body.id) !== null && _321 !== void 0 ? _321 : null
                    };
                    return [4 /*yield*/, ((_322 = client.nativeTerminalRevokeApprovalScope) === null || _322 === void 0 ? void 0 : _322.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 161: return [2 /*return*/, (_64.result = _525.sent(),
                        _64)];
                case 162:
                    if (!(body.method === "nativeTerminal.releaseHumanControl")) return [3 /*break*/, 164];
                    optionsGuard(client, "nativeTerminalReleaseHumanControl");
                    _65 = {
                        jsonrpc: "2.0",
                        id: (_323 = body.id) !== null && _323 !== void 0 ? _323 : null
                    };
                    return [4 /*yield*/, ((_324 = client.nativeTerminalReleaseHumanControl) === null || _324 === void 0 ? void 0 : _324.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 163: return [2 /*return*/, (_65.result = _525.sent(),
                        _65)];
                case 164:
                    if (!(body.method === "nativeTerminal.beginSecureInput")) return [3 /*break*/, 166];
                    optionsGuard(client, "nativeTerminalBeginSecureInput");
                    _66 = {
                        jsonrpc: "2.0",
                        id: (_325 = body.id) !== null && _325 !== void 0 ? _325 : null
                    };
                    return [4 /*yield*/, ((_326 = client.nativeTerminalBeginSecureInput) === null || _326 === void 0 ? void 0 : _326.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 165: return [2 /*return*/, (_66.result = _525.sent(),
                        _66)];
                case 166:
                    if (!(body.method === "nativeTerminal.endSecureInput")) return [3 /*break*/, 168];
                    optionsGuard(client, "nativeTerminalEndSecureInput");
                    _67 = {
                        jsonrpc: "2.0",
                        id: (_327 = body.id) !== null && _327 !== void 0 ? _327 : null
                    };
                    return [4 /*yield*/, ((_328 = client.nativeTerminalEndSecureInput) === null || _328 === void 0 ? void 0 : _328.call(client, stringParam(body.params, "id"), optionalStringParam(body.params, "sessionID")))];
                case 167: return [2 /*return*/, (_67.result = _525.sent(),
                        _67)];
                case 168:
                    if (!(body.method === "nativeTerminal.start")) return [3 /*break*/, 170];
                    optionsGuard(client, "nativeTerminalStart");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("nativeTerminal.start.params must be an object");
                    command = params.command;
                    if (typeof command !== "string" || !command)
                        throw invalidParams("nativeTerminal.start.params.command must be a non-empty string");
                    cwd = typeof params.cwd === "string"
                        ? params.cwd
                        : undefined;
                    id = typeof params.id === "string"
                        ? params.id
                        : undefined;
                    sessionID = typeof params.sessionID === "string"
                        ? params.sessionID
                        : undefined;
                    agentID = typeof params.agentID === "string"
                        ? params.agentID
                        : undefined;
                    _68 = {
                        jsonrpc: "2.0",
                        id: (_329 = body.id) !== null && _329 !== void 0 ? _329 : null
                    };
                    return [4 /*yield*/, ((_330 = client.nativeTerminalStart) === null || _330 === void 0 ? void 0 : _330.call(client, __assign({ command: command, cwd: cwd, id: id, sessionID: sessionID }, (agentID ? { agentID: agentID } : {}))))];
                case 169: return [2 /*return*/, (_68.result = _525.sent(),
                        _68)];
                case 170:
                    if (!(body.method === "nativeTerminal.write")) return [3 /*break*/, 172];
                    optionsGuard(client, "nativeTerminalWrite");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("nativeTerminal.write.params must be an object");
                    id = params.id;
                    input = params.input;
                    if (typeof id !== "string" || !id)
                        throw invalidParams("nativeTerminal.write.params.id must be a non-empty string");
                    if (typeof input !== "string")
                        throw invalidParams("nativeTerminal.write.params.input must be a string");
                    idempotencyKey = typeof params.idempotencyKey ===
                        "string"
                        ? params.idempotencyKey
                        : undefined;
                    _69 = {
                        jsonrpc: "2.0",
                        id: (_331 = body.id) !== null && _331 !== void 0 ? _331 : null
                    };
                    return [4 /*yield*/, ((_332 = client.nativeTerminalWrite) === null || _332 === void 0 ? void 0 : _332.call(client, __assign({ id: id, input: input, idempotencyKey: idempotencyKey }, (optionalStringParam(body.params, "sessionID")
                            ? { sessionID: optionalStringParam(body.params, "sessionID") }
                            : {}))))];
                case 171: return [2 /*return*/, (_69.result = _525.sent(),
                        _69)];
                case 172:
                    if (!(body.method === "nativeTerminal.resize")) return [3 /*break*/, 174];
                    optionsGuard(client, "nativeTerminalResize");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("nativeTerminal.resize.params must be an object");
                    id = params.id;
                    rows = params.rows;
                    cols = params.cols;
                    if (typeof id !== "string" || !id)
                        throw invalidParams("nativeTerminal.resize.params.id must be a non-empty string");
                    if (typeof rows !== "number" || !Number.isInteger(rows))
                        throw invalidParams("nativeTerminal.resize.params.rows must be an integer");
                    if (typeof cols !== "number" || !Number.isInteger(cols))
                        throw invalidParams("nativeTerminal.resize.params.cols must be an integer");
                    _70 = {
                        jsonrpc: "2.0",
                        id: (_333 = body.id) !== null && _333 !== void 0 ? _333 : null
                    };
                    return [4 /*yield*/, ((_334 = client.nativeTerminalResize) === null || _334 === void 0 ? void 0 : _334.call(client, __assign({ id: id, rows: rows, cols: cols }, (optionalStringParam(body.params, "sessionID")
                            ? { sessionID: optionalStringParam(body.params, "sessionID") }
                            : {}))))];
                case 173: return [2 /*return*/, (_70.result = _525.sent(),
                        _70)];
                case 174:
                    if (!(body.method === "constitution.rules")) return [3 /*break*/, 176];
                    optionsGuard(client, "constitutionRules");
                    _71 = {
                        jsonrpc: "2.0",
                        id: (_335 = body.id) !== null && _335 !== void 0 ? _335 : null
                    };
                    return [4 /*yield*/, ((_336 = client.constitutionRules) === null || _336 === void 0 ? void 0 : _336.call(client, optionalStringParam(body.params, "sessionID")))];
                case 175: return [2 /*return*/, (_71.result = _525.sent(),
                        _71)];
                case 176:
                    if (!(body.method === "constitution.rule.update")) return [3 /*break*/, 178];
                    optionsGuard(client, "updateConstitutionRule");
                    params = body.params;
                    if (!params || typeof params.ruleID !== "string" || !params.ruleID.trim())
                        throw invalidParams("constitution.rule.update requires a ruleID string");
                    if (params.enabled !== undefined && typeof params.enabled !== "boolean")
                        throw invalidParams("constitution.rule.update.enabled must be a boolean when provided");
                    _72 = {
                        jsonrpc: "2.0",
                        id: (_337 = body.id) !== null && _337 !== void 0 ? _337 : null
                    };
                    return [4 /*yield*/, ((_338 = client.updateConstitutionRule) === null || _338 === void 0 ? void 0 : _338.call(client, __assign(__assign(__assign(__assign(__assign({ ruleID: params.ruleID }, (typeof params.enabled === "boolean"
                            ? { enabled: params.enabled }
                            : {})), (typeof params.statement === "string"
                            ? { statement: params.statement }
                            : {})), (params.enforcement === "deny" ||
                            params.enforcement === "approval" ||
                            params.enforcement === "warn"
                            ? { enforcement: params.enforcement }
                            : {})), (params.priority === "critical" ||
                            params.priority === "high" ||
                            params.priority === "medium" ||
                            params.priority === "low"
                            ? { priority: params.priority }
                            : {})), (params.appliesTo &&
                            typeof params.appliesTo === "object" &&
                            !Array.isArray(params.appliesTo)
                            ? {
                                appliesTo: params.appliesTo,
                            }
                            : {})), optionalStringParam(body.params, "sessionID")))];
                case 177: return [2 /*return*/, (_72.result = _525.sent(),
                        _72)];
                case 178:
                    if (!(body.method === "constitution.rule.create")) return [3 /*break*/, 180];
                    optionsGuard(client, "createConstitutionRule");
                    params = body.params;
                    if (!params ||
                        typeof params.statement !== "string" ||
                        !params.statement.trim())
                        throw invalidParams("constitution.rule.create requires a statement string");
                    if (params.enforcement !== "deny" &&
                        params.enforcement !== "approval" &&
                        params.enforcement !== "warn")
                        throw invalidParams("constitution.rule.create requires enforcement deny|approval|warn");
                    _73 = {
                        jsonrpc: "2.0",
                        id: (_339 = body.id) !== null && _339 !== void 0 ? _339 : null
                    };
                    return [4 /*yield*/, ((_340 = client.createConstitutionRule) === null || _340 === void 0 ? void 0 : _340.call(client, __assign(__assign(__assign({ statement: params.statement, enforcement: params.enforcement }, (params.scope === "project" || params.scope === "package"
                            ? { scope: params.scope }
                            : {})), (params.appliesTo &&
                            typeof params.appliesTo === "object" &&
                            !Array.isArray(params.appliesTo)
                            ? {
                                appliesTo: params.appliesTo,
                            }
                            : {})), (params.priority === "critical" ||
                            params.priority === "high" ||
                            params.priority === "medium" ||
                            params.priority === "low"
                            ? { priority: params.priority }
                            : {})), optionalStringParam(body.params, "sessionID")))];
                case 179: return [2 /*return*/, (_73.result = _525.sent(),
                        _73)];
                case 180:
                    if (!(body.method === "constitution.rule.remove")) return [3 /*break*/, 182];
                    optionsGuard(client, "removeConstitutionRule");
                    params = body.params;
                    if (!params || typeof params.ruleID !== "string" || !params.ruleID.trim())
                        throw invalidParams("constitution.rule.remove requires a ruleID string");
                    _74 = {
                        jsonrpc: "2.0",
                        id: (_341 = body.id) !== null && _341 !== void 0 ? _341 : null
                    };
                    return [4 /*yield*/, ((_342 = client.removeConstitutionRule) === null || _342 === void 0 ? void 0 : _342.call(client, { ruleID: params.ruleID }, optionalStringParam(body.params, "sessionID")))];
                case 181: return [2 /*return*/, (_74.result = _525.sent(),
                        _74)];
                case 182:
                    if (!(body.method === "constitution.docRules")) return [3 /*break*/, 184];
                    optionsGuard(client, "constitutionDocRules");
                    _75 = {
                        jsonrpc: "2.0",
                        id: (_343 = body.id) !== null && _343 !== void 0 ? _343 : null
                    };
                    return [4 /*yield*/, ((_344 = client.constitutionDocRules) === null || _344 === void 0 ? void 0 : _344.call(client, optionalStringParam(body.params, "sessionID")))];
                case 183: return [2 /*return*/, (_75.result = _525.sent(),
                        _75)];
                case 184:
                    if (!(body.method === "constitution.docRule.promote")) return [3 /*break*/, 186];
                    optionsGuard(client, "promoteConstitutionDocRule");
                    params = body.params;
                    if (!params || typeof params.id !== "string" || !params.id.trim())
                        throw invalidParams("constitution.docRule.promote requires an id string");
                    _76 = {
                        jsonrpc: "2.0",
                        id: (_345 = body.id) !== null && _345 !== void 0 ? _345 : null
                    };
                    return [4 /*yield*/, ((_346 = client.promoteConstitutionDocRule) === null || _346 === void 0 ? void 0 : _346.call(client, { id: params.id }, optionalStringParam(body.params, "sessionID")))];
                case 185: return [2 /*return*/, (_76.result = _525.sent(),
                        _76)];
                case 186:
                    if (!(body.method === "constitution.docRule.update")) return [3 /*break*/, 188];
                    optionsGuard(client, "updateConstitutionDocRule");
                    params = body.params;
                    if (!params || typeof params.id !== "string" || !params.id.trim())
                        throw invalidParams("constitution.docRule.update requires an id string");
                    if (params.statement !== undefined &&
                        (typeof params.statement !== "string" || !params.statement.trim()))
                        throw invalidParams("constitution.docRule.update statement must be a non-empty string");
                    if (params.enforcement !== undefined &&
                        params.enforcement !== "deny" &&
                        params.enforcement !== "approval" &&
                        params.enforcement !== "warn")
                        throw invalidParams("constitution.docRule.update enforcement must be deny|approval|warn");
                    _77 = {
                        jsonrpc: "2.0",
                        id: (_347 = body.id) !== null && _347 !== void 0 ? _347 : null
                    };
                    return [4 /*yield*/, ((_348 = client.updateConstitutionDocRule) === null || _348 === void 0 ? void 0 : _348.call(client, __assign(__assign(__assign({ id: params.id }, (typeof params.statement === "string"
                            ? { statement: params.statement }
                            : {})), (params.enforcement === "deny" ||
                            params.enforcement === "approval" ||
                            params.enforcement === "warn"
                            ? { enforcement: params.enforcement }
                            : {})), (params.appliesTo &&
                            typeof params.appliesTo === "object" &&
                            !Array.isArray(params.appliesTo)
                            ? {
                                appliesTo: params.appliesTo,
                            }
                            : {})), optionalStringParam(body.params, "sessionID")))];
                case 187: return [2 /*return*/, (_77.result = _525.sent(),
                        _77)];
                case 188:
                    if (!(body.method === "context.notices")) return [3 /*break*/, 190];
                    optionsGuard(client, "notices");
                    _78 = {
                        jsonrpc: "2.0",
                        id: (_349 = body.id) !== null && _349 !== void 0 ? _349 : null
                    };
                    return [4 /*yield*/, ((_350 = client.notices) === null || _350 === void 0 ? void 0 : _350.call(client, optionalStringParam(body.params, "sessionID")))];
                case 189: return [2 /*return*/, (_78.result = _525.sent(),
                        _78)];
                case 190:
                    if (!(body.method === "completion.human_validation")) return [3 /*break*/, 192];
                    optionsGuard(client, "recordHumanValidation");
                    params = body.params;
                    if (!params ||
                        typeof params.taskID !== "string" ||
                        params.taskID.trim().length === 0 ||
                        typeof params.validation !== "string" ||
                        params.validation.trim().length === 0)
                        throw invalidParams("completion.human_validation requires taskID and validation strings");
                    _79 = {
                        jsonrpc: "2.0",
                        id: (_351 = body.id) !== null && _351 !== void 0 ? _351 : null
                    };
                    return [4 /*yield*/, ((_352 = client.recordHumanValidation) === null || _352 === void 0 ? void 0 : _352.call(client, {
                            taskID: params.taskID,
                            validation: params.validation,
                        }, optionalStringParam(body.params, "sessionID")))];
                case 191: return [2 /*return*/, (_79.result = _525.sent(),
                        _79)];
                case 192:
                    if (!(body.method === "decision.records")) return [3 /*break*/, 194];
                    optionsGuard(client, "decisionRecords");
                    params = body.params;
                    scope = params === null || params === void 0 ? void 0 : params.scope;
                    if (scope !== undefined &&
                        scope !== "session" &&
                        scope !== "workspace" &&
                        scope !== "all")
                        throw invalidParams("decision.records.scope must be session, workspace or all");
                    _80 = {
                        jsonrpc: "2.0",
                        id: (_353 = body.id) !== null && _353 !== void 0 ? _353 : null
                    };
                    return [4 /*yield*/, ((_354 = client.decisionRecords) === null || _354 === void 0 ? void 0 : _354.call(client, __assign(__assign({}, (optionalStringParam(body.params, "sessionID")
                            ? { sessionID: optionalStringParam(body.params, "sessionID") }
                            : {})), (scope ? { scope: scope } : {}))))];
                case 193: return [2 /*return*/, (_80.result = _525.sent(),
                        _80)];
                case 194:
                    if (!(body.method === "decision.record")) return [3 /*break*/, 196];
                    optionsGuard(client, "recordDecision");
                    params = body.params;
                    if (!params ||
                        typeof params.decision !== "string" ||
                        params.decision.trim().length === 0)
                        throw invalidParams("decision.record requires a decision string");
                    if (params.scope !== undefined &&
                        params.scope !== "session" &&
                        params.scope !== "workspace")
                        throw invalidParams("decision.record.scope must be session or workspace");
                    return [4 /*yield*/, ((_355 = client.recordDecision) === null || _355 === void 0 ? void 0 : _355.call(client, __assign(__assign(__assign(__assign(__assign(__assign({ decision: params.decision }, (params.scope === "workspace"
                            ? { scope: "workspace" }
                            : {})), (Array.isArray(params.rationale)
                            ? { rationale: params.rationale.map(String) }
                            : {})), (Array.isArray(params.alternatives)
                            ? {
                                alternatives: params.alternatives,
                            }
                            : {})), (Array.isArray(params.consequences)
                            ? { consequences: params.consequences.map(String) }
                            : {})), (Array.isArray(params.linkedPlans)
                            ? { linkedPlans: params.linkedPlans.map(String) }
                            : {})), (Array.isArray(params.linkedConstraints)
                            ? { linkedConstraints: params.linkedConstraints.map(String) }
                            : {})), optionalStringParam(body.params, "sessionID")))];
                case 195:
                    result = _525.sent();
                    if (!result)
                        throw invalidParams("decision.record is not implemented by this runtime");
                    return [2 /*return*/, {
                            jsonrpc: "2.0",
                            id: (_356 = body.id) !== null && _356 !== void 0 ? _356 : null,
                            result: result,
                        }];
                case 196:
                    if (!(body.method === "evidence.records")) return [3 /*break*/, 198];
                    optionsGuard(client, "evidenceRecords");
                    _81 = {
                        jsonrpc: "2.0",
                        id: (_357 = body.id) !== null && _357 !== void 0 ? _357 : null
                    };
                    return [4 /*yield*/, ((_358 = client.evidenceRecords) === null || _358 === void 0 ? void 0 : _358.call(client, body.params))];
                case 197: return [2 /*return*/, (_81.result = _525.sent(),
                        _81)];
                case 198:
                    if (!(body.method === "evidence.record")) return [3 /*break*/, 200];
                    optionsGuard(client, "recordValidation");
                    params = body.params;
                    if (!params ||
                        typeof params.taskID !== "string" ||
                        params.taskID.trim().length === 0 ||
                        typeof params.command !== "string" ||
                        params.command.trim().length === 0)
                        throw invalidParams("evidence.record requires a taskID and a command string");
                    return [4 /*yield*/, ((_359 = client.recordValidation) === null || _359 === void 0 ? void 0 : _359.call(client, __assign(__assign({ taskID: params.taskID, objective: typeof params.objective === "string" ? params.objective : "", command: params.command }, (typeof params.timeoutSec === "number"
                            ? { timeoutSec: params.timeoutSec }
                            : {})), (Array.isArray(params.knownGaps)
                            ? { knownGaps: params.knownGaps.map(String) }
                            : {})), optionalStringParam(body.params, "sessionID")))];
                case 199:
                    result = _525.sent();
                    if (!result)
                        throw invalidParams("evidence.record is not implemented by this runtime");
                    return [2 /*return*/, {
                            jsonrpc: "2.0",
                            id: (_360 = body.id) !== null && _360 !== void 0 ? _360 : null,
                            result: result,
                        }];
                case 200:
                    if (!(body.method === "completion.records")) return [3 /*break*/, 202];
                    optionsGuard(client, "completions");
                    _82 = {
                        jsonrpc: "2.0",
                        id: (_361 = body.id) !== null && _361 !== void 0 ? _361 : null
                    };
                    return [4 /*yield*/, ((_362 = client.completions) === null || _362 === void 0 ? void 0 : _362.call(client, body.params))];
                case 201: return [2 /*return*/, (_82.result = _525.sent(),
                        _82)];
                case 202:
                    if (!(body.method === "plan.task.states")) return [3 /*break*/, 204];
                    optionsGuard(client, "planTaskStates");
                    _83 = {
                        jsonrpc: "2.0",
                        id: (_363 = body.id) !== null && _363 !== void 0 ? _363 : null
                    };
                    return [4 /*yield*/, ((_364 = client.planTaskStates) === null || _364 === void 0 ? void 0 : _364.call(client, body.params))];
                case 203: return [2 /*return*/, (_83.result = _525.sent(),
                        _83)];
                case 204:
                    if (!(body.method === "workgraph.integrity")) return [3 /*break*/, 206];
                    optionsGuard(client, "workGraphIntegrity");
                    _84 = {
                        jsonrpc: "2.0",
                        id: (_365 = body.id) !== null && _365 !== void 0 ? _365 : null
                    };
                    return [4 /*yield*/, ((_366 = client.workGraphIntegrity) === null || _366 === void 0 ? void 0 : _366.call(client, optionalStringParam(body.params, "sessionID")))];
                case 205: return [2 /*return*/, (_84.result = _525.sent(),
                        _84)];
                case 206:
                    if (!(body.method === "workgraph.unattributed")) return [3 /*break*/, 208];
                    optionsGuard(client, "unattributedChanges");
                    _85 = {
                        jsonrpc: "2.0",
                        id: (_367 = body.id) !== null && _367 !== void 0 ? _367 : null
                    };
                    return [4 /*yield*/, ((_368 = client.unattributedChanges) === null || _368 === void 0 ? void 0 : _368.call(client, optionalStringParam(body.params, "sessionID")))];
                case 207: return [2 /*return*/, (_85.result = _525.sent(),
                        _85)];
                case 208:
                    if (!(body.method === "completion.record")) return [3 /*break*/, 210];
                    optionsGuard(client, "recordCompletion");
                    params = body.params;
                    if (!params ||
                        typeof params.taskID !== "string" ||
                        params.taskID.trim().length === 0 ||
                        typeof params.changeSummary !== "string" ||
                        params.changeSummary.trim().length === 0)
                        throw invalidParams("completion.record requires a taskID and a changeSummary string");
                    return [4 /*yield*/, ((_369 = client.recordCompletion) === null || _369 === void 0 ? void 0 : _369.call(client, __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ taskID: params.taskID, objective: typeof params.objective === "string" ? params.objective : "", changeSummary: params.changeSummary }, (typeof params.behaviorImpact === "string"
                            ? { behaviorImpact: params.behaviorImpact }
                            : {})), (Array.isArray(params.validations)
                            ? { validations: params.validations }
                            : {})), (typeof params.humanValidation === "string"
                            ? { humanValidation: params.humanValidation }
                            : {})), (Array.isArray(params.knownGaps)
                            ? { knownGaps: params.knownGaps.map(String) }
                            : {})), (Array.isArray(params.externalSideEffects)
                            ? { externalSideEffects: params.externalSideEffects.map(String) }
                            : {})), (typeof params.rollbackState === "string"
                            ? {
                                rollbackState: params.rollbackState,
                            }
                            : {})), (Array.isArray(params.evidenceIDs)
                            ? { evidenceIDs: params.evidenceIDs.map(String) }
                            : {})), (Array.isArray(params.changePaths)
                            ? { changePaths: params.changePaths.map(String) }
                            : {})), optionalStringParam(body.params, "sessionID")))];
                case 209:
                    result = _525.sent();
                    if (!result)
                        throw invalidParams("completion.record is not implemented by this runtime");
                    return [2 /*return*/, {
                            jsonrpc: "2.0",
                            id: (_370 = body.id) !== null && _370 !== void 0 ? _370 : null,
                            result: result,
                        }];
                case 210:
                    if (!(body.method === "drift.findings")) return [3 /*break*/, 212];
                    optionsGuard(client, "driftFindings");
                    _86 = {
                        jsonrpc: "2.0",
                        id: (_371 = body.id) !== null && _371 !== void 0 ? _371 : null
                    };
                    return [4 /*yield*/, ((_372 = client.driftFindings) === null || _372 === void 0 ? void 0 : _372.call(client, body.params))];
                case 211: return [2 /*return*/, (_86.result = _525.sent(),
                        _86)];
                case 212:
                    if (!(body.method === "drift.evaluate")) return [3 /*break*/, 214];
                    optionsGuard(client, "evaluateDrift");
                    params = body.params;
                    if (!params ||
                        typeof params.objective !== "string" ||
                        params.objective.trim().length === 0 ||
                        typeof params.currentActivity !== "string" ||
                        params.currentActivity.trim().length === 0)
                        throw invalidParams("drift.evaluate requires an objective and a currentActivity string");
                    return [4 /*yield*/, ((_373 = client.evaluateDrift) === null || _373 === void 0 ? void 0 : _373.call(client, __assign(__assign(__assign({ objective: params.objective, currentActivity: params.currentActivity }, (Array.isArray(params.applicableConstraints)
                            ? {
                                applicableConstraints: params.applicableConstraints.map(String),
                            }
                            : {})), (Array.isArray(params.changes) ? { changes: params.changes } : {})), (Array.isArray(params.evidenceRefs)
                            ? { evidenceRefs: params.evidenceRefs.map(String) }
                            : {})), optionalStringParam(body.params, "sessionID")))];
                case 213:
                    result = _525.sent();
                    if (!result)
                        throw invalidParams("drift.evaluate is not implemented by this runtime");
                    return [2 /*return*/, {
                            jsonrpc: "2.0",
                            id: (_374 = body.id) !== null && _374 !== void 0 ? _374 : null,
                            result: result,
                        }];
                case 214:
                    if (!(body.method === "drift.acknowledge")) return [3 /*break*/, 216];
                    optionsGuard(client, "acknowledgeDriftFinding");
                    params = body.params;
                    if (!params ||
                        typeof params.findingID !== "string" ||
                        !params.findingID.trim())
                        throw invalidParams("drift.acknowledge requires a findingID string");
                    _87 = {
                        jsonrpc: "2.0",
                        id: (_375 = body.id) !== null && _375 !== void 0 ? _375 : null
                    };
                    return [4 /*yield*/, ((_376 = client.acknowledgeDriftFinding) === null || _376 === void 0 ? void 0 : _376.call(client, __assign({ findingID: params.findingID, status: params.status }, (typeof params.rationale === "string"
                            ? { rationale: params.rationale }
                            : {})), optionalStringParam(body.params, "sessionID")))];
                case 215: return [2 /*return*/, (_87.result = _525.sent(),
                        _87)];
                case 216:
                    if (!(body.method === "drift.reopen")) return [3 /*break*/, 218];
                    optionsGuard(client, "reopenDriftFinding");
                    params = body.params;
                    if (!params ||
                        typeof params.findingID !== "string" ||
                        !params.findingID.trim())
                        throw invalidParams("drift.reopen requires a findingID string");
                    _88 = {
                        jsonrpc: "2.0",
                        id: (_377 = body.id) !== null && _377 !== void 0 ? _377 : null
                    };
                    return [4 /*yield*/, ((_378 = client.reopenDriftFinding) === null || _378 === void 0 ? void 0 : _378.call(client, { findingID: params.findingID }, optionalStringParam(body.params, "sessionID")))];
                case 217: return [2 /*return*/, (_88.result = _525.sent(),
                        _88)];
                case 218:
                    if (!(body.method === "observation.confirmed")) return [3 /*break*/, 220];
                    optionsGuard(client, "confirmedWorkspaceChanges");
                    _89 = {
                        jsonrpc: "2.0",
                        id: (_379 = body.id) !== null && _379 !== void 0 ? _379 : null
                    };
                    return [4 /*yield*/, ((_380 = client.confirmedWorkspaceChanges) === null || _380 === void 0 ? void 0 : _380.call(client, optionalStringParam(body.params, "sessionID")))];
                case 219: return [2 /*return*/, (_89.result = _525.sent(),
                        _89)];
                case 220:
                    if (!(body.method === "workspace.diff")) return [3 /*break*/, 222];
                    optionsGuard(client, "workspaceDiff");
                    includePatch = (_381 = body.params) === null || _381 === void 0 ? void 0 : _381.includePatch;
                    if (includePatch !== undefined && typeof includePatch !== "boolean")
                        throw invalidParams("workspace.diff.params.includePatch must be a boolean");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _90 = {
                        jsonrpc: "2.0",
                        id: (_382 = body.id) !== null && _382 !== void 0 ? _382 : null
                    };
                    return [4 /*yield*/, ((_383 = client.workspaceDiff) === null || _383 === void 0 ? void 0 : _383.call(client, __assign(__assign({}, (workspaceID ? { workspaceID: workspaceID } : {})), (includePatch === undefined ? {} : { includePatch: includePatch }))))];
                case 221: return [2 /*return*/, (_90.result = _525.sent(),
                        _90)];
                case 222:
                    if (!(body.method === "workspace.git.diff")) return [3 /*break*/, 224];
                    optionsGuard(client, "workspaceGitDiff");
                    input = body.params;
                    _91 = {
                        jsonrpc: "2.0",
                        id: (_384 = body.id) !== null && _384 !== void 0 ? _384 : null
                    };
                    return [4 /*yield*/, ((_385 = client.workspaceGitDiff) === null || _385 === void 0 ? void 0 : _385.call(client, input))];
                case 223: return [2 /*return*/, (_91.result = _525.sent(),
                        _91)];
                case 224:
                    if (!(body.method === "ast.diff")) return [3 /*break*/, 226];
                    optionsGuard(client, "astDiff");
                    input = body.params;
                    if (!input ||
                        typeof input.oldText !== "string" ||
                        typeof input.newText !== "string" ||
                        typeof input.language !== "string")
                        throw invalidParams("ast.diff.params.oldText, newText and language are required strings");
                    _92 = {
                        jsonrpc: "2.0",
                        id: (_386 = body.id) !== null && _386 !== void 0 ? _386 : null
                    };
                    return [4 /*yield*/, ((_387 = client.astDiff) === null || _387 === void 0 ? void 0 : _387.call(client, input))];
                case 225: return [2 /*return*/, (_92.result = _525.sent(),
                        _92)];
                case 226:
                    if (!(body.method === "ast.diff.batch")) return [3 /*break*/, 228];
                    optionsGuard(client, "astDiffBatch");
                    input = body.params;
                    if (!input || !Array.isArray(input.files) || input.files.length === 0)
                        throw invalidParams("ast.diff.batch.params.files must be a non-empty array");
                    files = input.files;
                    for (_i = 0, files_1 = files; _i < files_1.length; _i++) {
                        file = files_1[_i];
                        if (!file ||
                            typeof file.oldText !== "string" ||
                            typeof file.newText !== "string" ||
                            typeof file.language !== "string")
                            throw invalidParams("ast.diff.batch.params.files requires oldText/newText/language strings");
                    }
                    _93 = {
                        jsonrpc: "2.0",
                        id: (_388 = body.id) !== null && _388 !== void 0 ? _388 : null
                    };
                    return [4 /*yield*/, ((_389 = client.astDiffBatch) === null || _389 === void 0 ? void 0 : _389.call(client, __assign({ files: files }, (input.options ? { options: input.options } : {}))))];
                case 227: return [2 /*return*/, (_93.result = _525.sent(),
                        _93)];
                case 228:
                    if (!(body.method === "ast.refactor.preview")) return [3 /*break*/, 230];
                    optionsGuard(client, "astRefactorPreview");
                    input = body.params;
                    if (!input ||
                        typeof input.operation !== "string" ||
                        !Array.isArray(input.files) ||
                        input.files.length === 0)
                        throw invalidParams("ast.refactor.preview.params.operation and files are required");
                    for (_b = 0, _c = input.files; _b < _c.length; _b++) {
                        file = _c[_b];
                        if (!file ||
                            typeof file.oldText !== "string" ||
                            typeof file.newText !== "string" ||
                            typeof file.language !== "string")
                            throw invalidParams("ast.refactor.preview.params.files requires oldText/newText/language strings");
                    }
                    _94 = {
                        jsonrpc: "2.0",
                        id: (_390 = body.id) !== null && _390 !== void 0 ? _390 : null
                    };
                    return [4 /*yield*/, ((_391 = client.astRefactorPreview) === null || _391 === void 0 ? void 0 : _391.call(client, {
                            operation: input.operation,
                            files: input.files,
                        }))];
                case 229: return [2 /*return*/, (_94.result = _525.sent(),
                        _94)];
                case 230:
                    if (!(body.method === "ast.service")) return [3 /*break*/, 232];
                    optionsGuard(client, "astService");
                    input = body.params;
                    if (!input ||
                        (input.operation !== "index" && input.operation !== "query") ||
                        !Array.isArray(input.files) ||
                        input.files.length === 0)
                        throw invalidParams("ast.service.params.operation and files are required");
                    for (_d = 0, _e = input.files; _d < _e.length; _d++) {
                        file = _e[_d];
                        if (!file ||
                            typeof file.source !== "string" ||
                            typeof file.language !== "string")
                            throw invalidParams("ast.service.params.files requires source/language strings");
                    }
                    _95 = {
                        jsonrpc: "2.0",
                        id: (_392 = body.id) !== null && _392 !== void 0 ? _392 : null
                    };
                    return [4 /*yield*/, ((_393 = client.astService) === null || _393 === void 0 ? void 0 : _393.call(client, __assign({ operation: input.operation, files: input.files }, (input.query ? { query: input.query } : {}))))];
                case 231: return [2 /*return*/, (_95.result = _525.sent(),
                        _95)];
                case 232:
                    if (!(body.method === "ast.refactor.plan")) return [3 /*break*/, 234];
                    optionsGuard(client, "astRefactorPlan");
                    input = body.params;
                    if (!input ||
                        typeof input.operation !== "string" ||
                        !Array.isArray(input.files) ||
                        input.files.length === 0)
                        throw invalidParams("ast.refactor.plan.params.operation and files are required");
                    for (_f = 0, _g = input.files; _f < _g.length; _f++) {
                        file = _g[_f];
                        if (!file ||
                            typeof file.source !== "string" ||
                            typeof file.language !== "string")
                            throw invalidParams("ast.refactor.plan.params.files requires source/language strings");
                    }
                    _96 = {
                        jsonrpc: "2.0",
                        id: (_394 = body.id) !== null && _394 !== void 0 ? _394 : null
                    };
                    return [4 /*yield*/, ((_395 = client.astRefactorPlan) === null || _395 === void 0 ? void 0 : _395.call(client, __assign(__assign({ operation: input.operation, files: input.files }, (input.rename ? { rename: input.rename } : {})), (input.query ? { query: input.query } : {}))))];
                case 233: return [2 /*return*/, (_96.result = _525.sent(),
                        _96)];
                case 234:
                    if (!(body.method === "ast.refactor.apply")) return [3 /*break*/, 236];
                    optionsGuard(client, "astApplyRefactor");
                    input = body.params;
                    if (!input ||
                        typeof input.operation !== "string" ||
                        !Array.isArray(input.files) ||
                        input.files.length === 0)
                        throw invalidParams("ast.refactor.apply.params.operation and files are required");
                    for (_h = 0, _j = input.files; _h < _j.length; _h++) {
                        file = _j[_h];
                        if (!file ||
                            typeof file.source !== "string" ||
                            typeof file.language !== "string")
                            throw invalidParams("ast.refactor.apply.params.files requires source/language strings");
                    }
                    _97 = {
                        jsonrpc: "2.0",
                        id: (_396 = body.id) !== null && _396 !== void 0 ? _396 : null
                    };
                    return [4 /*yield*/, ((_397 = client.astApplyRefactor) === null || _397 === void 0 ? void 0 : _397.call(client, __assign(__assign({ operation: input.operation, files: input.files }, (input.rename ? { rename: input.rename } : {})), (input.dryRun ? { dryRun: input.dryRun } : {}))))];
                case 235: return [2 /*return*/, (_97.result = _525.sent(),
                        _97)];
                case 236:
                    if (!(body.method === "git.refs")) return [3 /*break*/, 238];
                    optionsGuard(client, "gitRefs");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _98 = {
                        jsonrpc: "2.0",
                        id: (_398 = body.id) !== null && _398 !== void 0 ? _398 : null
                    };
                    return [4 /*yield*/, ((_399 = client.gitRefs) === null || _399 === void 0 ? void 0 : _399.call(client, workspaceID ? { workspaceID: workspaceID } : undefined))];
                case 237: return [2 /*return*/, (_98.result = _525.sent(),
                        _98)];
                case 238:
                    if (!(body.method === "team.pr.list")) return [3 /*break*/, 240];
                    optionsGuard(client, "teamPRList");
                    _99 = {
                        jsonrpc: "2.0",
                        id: (_400 = body.id) !== null && _400 !== void 0 ? _400 : null
                    };
                    return [4 /*yield*/, ((_401 = client.teamPRList) === null || _401 === void 0 ? void 0 : _401.call(client, optionalStringParam(body.params, "sessionID")))];
                case 239: return [2 /*return*/, (_99.result = _525.sent(),
                        _99)];
                case 240:
                    if (!(body.method === "tools.registered")) return [3 /*break*/, 242];
                    optionsGuard(client, "registeredTools");
                    _100 = {
                        jsonrpc: "2.0",
                        id: (_402 = body.id) !== null && _402 !== void 0 ? _402 : null
                    };
                    return [4 /*yield*/, ((_403 = client.registeredTools) === null || _403 === void 0 ? void 0 : _403.call(client, optionalStringParam(body.params, "sessionID")))];
                case 241: return [2 /*return*/, (_100.result = _525.sent(),
                        _100)];
                case 242:
                    if (!(body.method === "projections.list")) return [3 /*break*/, 244];
                    optionsGuard(client, "projectionContributions");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _101 = {
                        jsonrpc: "2.0",
                        id: (_404 = body.id) !== null && _404 !== void 0 ? _404 : null
                    };
                    return [4 /*yield*/, client.projectionContributions(workspaceID ? { workspaceID: workspaceID } : undefined)];
                case 243: return [2 /*return*/, (_101.result = _525.sent(),
                        _101)];
                case 244:
                    if (!(body.method === "constitution.override.request")) return [3 /*break*/, 246];
                    optionsGuard(client, "requestOverride");
                    params = body.params;
                    if (!params || typeof params.ruleID !== "string" || !params.ruleID.trim())
                        throw invalidParams("ruleID is required");
                    if (typeof params.reason !== "string" || !params.reason.trim())
                        throw invalidParams("reason is required");
                    _102 = {
                        jsonrpc: "2.0",
                        id: (_405 = body.id) !== null && _405 !== void 0 ? _405 : null
                    };
                    return [4 /*yield*/, ((_406 = client.requestOverride) === null || _406 === void 0 ? void 0 : _406.call(client, __assign(__assign(__assign({ ruleID: params.ruleID, reason: params.reason }, (Array.isArray(params.paths)
                            ? {
                                paths: params.paths.filter(function (path) { return typeof path === "string"; }),
                            }
                            : {})), (typeof params.taskID === "string"
                            ? { taskID: params.taskID }
                            : {})), (typeof params.expiresAt === "string"
                            ? { expiresAt: params.expiresAt }
                            : {})), optionalStringParam(body.params, "sessionID")))];
                case 245: return [2 /*return*/, (_102.result = _525.sent(),
                        _102)];
                case 246:
                    if (!(body.method === "constitution.override.approve")) return [3 /*break*/, 248];
                    optionsGuard(client, "approveOverride");
                    params = body.params;
                    if (!params ||
                        typeof params.requestID !== "string" ||
                        !params.requestID.trim())
                        throw invalidParams("requestID is required");
                    if (params.decision !== "once" && params.decision !== "reject")
                        throw invalidParams("decision must be once or reject");
                    _103 = {
                        jsonrpc: "2.0",
                        id: (_407 = body.id) !== null && _407 !== void 0 ? _407 : null
                    };
                    return [4 /*yield*/, client.approveOverride({
                            requestID: params.requestID,
                            decision: params.decision,
                        })];
                case 247: return [2 /*return*/, (_103.result = _525.sent(),
                        _103)];
                case 248:
                    if (!(body.method === "mailbox.list")) return [3 /*break*/, 250];
                    optionsGuard(client, "mailboxList");
                    sessionID = (_408 = body.params) === null || _408 === void 0 ? void 0 : _408.sessionID;
                    _104 = {
                        jsonrpc: "2.0",
                        id: (_409 = body.id) !== null && _409 !== void 0 ? _409 : null
                    };
                    return [4 /*yield*/, ((_410 = client.mailboxList) === null || _410 === void 0 ? void 0 : _410.call(client, sessionID))];
                case 249: return [2 /*return*/, (_104.result = _525.sent(),
                        _104)];
                case 250:
                    if (!(body.method === "mailbox.send")) return [3 /*break*/, 252];
                    optionsGuard(client, "mailboxSend");
                    params = body.params;
                    if (!params ||
                        typeof params.intent !== "string" ||
                        params.intent.trim().length === 0 ||
                        typeof params.text !== "string" ||
                        params.text.trim().length === 0)
                        throw invalidParams("mailbox.send requires an intent and a text string");
                    return [4 /*yield*/, ((_411 = client.mailboxSend) === null || _411 === void 0 ? void 0 : _411.call(client, __assign(__assign(__assign(__assign(__assign(__assign(__assign({}, (typeof params.source === "string"
                            ? {
                                source: params.source,
                            }
                            : {})), (typeof params.priority === "string"
                            ? {
                                priority: params.priority,
                            }
                            : {})), { intent: params.intent, text: params.text }), (typeof params.safeSummary === "string"
                            ? { safeSummary: params.safeSummary }
                            : {})), (typeof params.relatedPlanID === "string"
                            ? { relatedPlanID: params.relatedPlanID }
                            : {})), (typeof params.deliveryPolicy === "string"
                            ? { deliveryPolicy: params.deliveryPolicy }
                            : {})), (typeof params.sessionID === "string"
                            ? { sessionID: params.sessionID }
                            : {}))))];
                case 251:
                    result = _525.sent();
                    if (!result)
                        throw invalidParams("mailbox.send is not implemented by this runtime");
                    return [2 /*return*/, {
                            jsonrpc: "2.0",
                            id: (_412 = body.id) !== null && _412 !== void 0 ? _412 : null,
                            result: result,
                        }];
                case 252:
                    if (!(body.method === "mailbox.deliver")) return [3 /*break*/, 254];
                    optionsGuard(client, "mailboxDeliver");
                    params = body.params;
                    messageID = params === null || params === void 0 ? void 0 : params.messageID;
                    if (typeof messageID !== "string" || !messageID)
                        throw invalidParams("mailbox.deliver requires a messageID string");
                    _105 = {
                        jsonrpc: "2.0",
                        id: (_413 = body.id) !== null && _413 !== void 0 ? _413 : null
                    };
                    return [4 /*yield*/, ((_414 = client.mailboxDeliver) === null || _414 === void 0 ? void 0 : _414.call(client, messageID, typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string" ? params.sessionID : undefined))];
                case 253: return [2 /*return*/, (_105.result = _525.sent(),
                        _105)];
                case 254:
                    if (!(body.method === "mailbox.acknowledge")) return [3 /*break*/, 256];
                    optionsGuard(client, "mailboxAcknowledge");
                    params = body.params;
                    messageID = params === null || params === void 0 ? void 0 : params.messageID;
                    if (typeof messageID !== "string" || !messageID)
                        throw invalidParams("mailbox.acknowledge requires a messageID string");
                    _106 = {
                        jsonrpc: "2.0",
                        id: (_415 = body.id) !== null && _415 !== void 0 ? _415 : null
                    };
                    return [4 /*yield*/, ((_416 = client.mailboxAcknowledge) === null || _416 === void 0 ? void 0 : _416.call(client, messageID, typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string" ? params.sessionID : undefined))];
                case 255: return [2 /*return*/, (_106.result = _525.sent(),
                        _106)];
                case 256:
                    if (!(body.method === "mailbox.defer")) return [3 /*break*/, 258];
                    optionsGuard(client, "mailboxDefer");
                    params = body.params;
                    messageID = params === null || params === void 0 ? void 0 : params.messageID;
                    if (typeof messageID !== "string" || !messageID)
                        throw invalidParams("mailbox.defer requires a messageID string");
                    _107 = {
                        jsonrpc: "2.0",
                        id: (_417 = body.id) !== null && _417 !== void 0 ? _417 : null
                    };
                    return [4 /*yield*/, ((_418 = client.mailboxDefer) === null || _418 === void 0 ? void 0 : _418.call(client, messageID, typeof params.reason === "string" ? params.reason : undefined, typeof params.sessionID === "string" ? params.sessionID : undefined))];
                case 257: return [2 /*return*/, (_107.result = _525.sent(),
                        _107)];
                case 258:
                    if (!(body.method === "mailbox.supersede")) return [3 /*break*/, 260];
                    optionsGuard(client, "mailboxSupersede");
                    params = body.params;
                    messageID = params === null || params === void 0 ? void 0 : params.messageID;
                    if (typeof messageID !== "string" || !messageID)
                        throw invalidParams("mailbox.supersede requires a messageID string");
                    _108 = {
                        jsonrpc: "2.0",
                        id: (_419 = body.id) !== null && _419 !== void 0 ? _419 : null
                    };
                    return [4 /*yield*/, ((_420 = client.mailboxSupersede) === null || _420 === void 0 ? void 0 : _420.call(client, messageID, typeof params.reason === "string" ? params.reason : undefined, typeof params.sessionID === "string" ? params.sessionID : undefined))];
                case 259: return [2 /*return*/, (_108.result = _525.sent(),
                        _108)];
                case 260:
                    if (!(body.method === "planDoc.list")) return [3 /*break*/, 262];
                    optionsGuard(client, "planDocList");
                    sessionID = (_421 = body.params) === null || _421 === void 0 ? void 0 : _421.sessionID;
                    _109 = {
                        jsonrpc: "2.0",
                        id: (_422 = body.id) !== null && _422 !== void 0 ? _422 : null
                    };
                    return [4 /*yield*/, ((_423 = client.planDocList) === null || _423 === void 0 ? void 0 : _423.call(client, sessionID))];
                case 261: return [2 /*return*/, (_109.result = _525.sent(),
                        _109)];
                case 262:
                    if (!(body.method === "planDoc.read")) return [3 /*break*/, 264];
                    optionsGuard(client, "planDocRead");
                    params = body.params;
                    planID = params === null || params === void 0 ? void 0 : params.planID;
                    path = params === null || params === void 0 ? void 0 : params.path;
                    if (typeof planID !== "string" && typeof path !== "string")
                        throw invalidParams("planDoc.read requires planID or path");
                    _110 = {
                        jsonrpc: "2.0",
                        id: (_424 = body.id) !== null && _424 !== void 0 ? _424 : null
                    };
                    return [4 /*yield*/, ((_425 = client.planDocRead) === null || _425 === void 0 ? void 0 : _425.call(client, __assign(__assign(__assign({}, (typeof planID === "string" ? { planID: planID } : {})), (typeof path === "string" ? { path: path } : {})), (typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string"
                            ? { sessionID: params.sessionID }
                            : {}))))];
                case 263: return [2 /*return*/, (_110.result = _525.sent(),
                        _110)];
                case 264:
                    if (!(body.method === "planDoc.write")) return [3 /*break*/, 266];
                    optionsGuard(client, "planDocWrite");
                    params = body.params;
                    if (!params ||
                        typeof params.path !== "string" ||
                        params.path.trim().length === 0 ||
                        typeof params.content !== "string")
                        throw invalidParams("planDoc.write requires path and content");
                    _111 = {
                        jsonrpc: "2.0",
                        id: (_426 = body.id) !== null && _426 !== void 0 ? _426 : null
                    };
                    return [4 /*yield*/, ((_427 = client.planDocWrite) === null || _427 === void 0 ? void 0 : _427.call(client, __assign(__assign(__assign({ path: params.path, content: params.content }, (typeof params.title === "string" ? { title: params.title } : {})), (typeof params.planID === "string"
                            ? { planID: params.planID }
                            : {})), (typeof params.sessionID === "string"
                            ? { sessionID: params.sessionID }
                            : {}))))];
                case 265: return [2 /*return*/, (_111.result = _525.sent(),
                        _111)];
                case 266:
                    if (!(body.method === "planDoc.mark")) return [3 /*break*/, 268];
                    optionsGuard(client, "planDocMark");
                    params = body.params;
                    if (!params ||
                        typeof params.path !== "string" ||
                        params.path.trim().length === 0)
                        throw invalidParams("planDoc.mark requires a path string");
                    _112 = {
                        jsonrpc: "2.0",
                        id: (_428 = body.id) !== null && _428 !== void 0 ? _428 : null
                    };
                    return [4 /*yield*/, ((_429 = client.planDocMark) === null || _429 === void 0 ? void 0 : _429.call(client, __assign(__assign({ path: params.path }, (typeof params.title === "string" ? { title: params.title } : {})), (typeof params.sessionID === "string"
                            ? { sessionID: params.sessionID }
                            : {}))))];
                case 267: return [2 /*return*/, (_112.result = _525.sent(),
                        _112)];
                case 268:
                    if (!(body.method === "planDoc.delete")) return [3 /*break*/, 270];
                    optionsGuard(client, "planDocDelete");
                    params = body.params;
                    planID = params === null || params === void 0 ? void 0 : params.planID;
                    if (typeof planID !== "string" || !planID)
                        throw invalidParams("planDoc.delete requires a planID string");
                    _113 = {
                        jsonrpc: "2.0",
                        id: (_430 = body.id) !== null && _430 !== void 0 ? _430 : null
                    };
                    return [4 /*yield*/, ((_431 = client.planDocDelete) === null || _431 === void 0 ? void 0 : _431.call(client, planID, typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string" ? params.sessionID : undefined))];
                case 269: return [2 /*return*/, (_113.result = _525.sent(),
                        _113)];
                case 270:
                    if (!(body.method === "planDoc.status")) return [3 /*break*/, 272];
                    optionsGuard(client, "planDocStatus");
                    params = body.params;
                    planID = params === null || params === void 0 ? void 0 : params.planID;
                    if (typeof planID !== "string" || !planID)
                        throw invalidParams("planDoc.status requires a planID string");
                    _114 = {
                        jsonrpc: "2.0",
                        id: (_432 = body.id) !== null && _432 !== void 0 ? _432 : null
                    };
                    return [4 /*yield*/, ((_433 = client.planDocStatus) === null || _433 === void 0 ? void 0 : _433.call(client, planID, typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string" ? params.sessionID : undefined))];
                case 271: return [2 /*return*/, (_114.result = _525.sent(),
                        _114)];
                case 272:
                    if (!(body.method === "planDoc.updateStatus")) return [3 /*break*/, 274];
                    optionsGuard(client, "planDocUpdateStatus");
                    params = body.params;
                    planID = params === null || params === void 0 ? void 0 : params.planID;
                    status_1 = params === null || params === void 0 ? void 0 : params.status;
                    if (typeof planID !== "string" || !planID)
                        throw invalidParams("planDoc.updateStatus requires a planID string");
                    if (typeof status_1 !== "string" || !status_1)
                        throw invalidParams("planDoc.updateStatus requires a status string");
                    _115 = {
                        jsonrpc: "2.0",
                        id: (_434 = body.id) !== null && _434 !== void 0 ? _434 : null
                    };
                    return [4 /*yield*/, ((_435 = client.planDocUpdateStatus) === null || _435 === void 0 ? void 0 : _435.call(client, __assign({ planID: planID, status: status_1 }, (typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string"
                            ? { sessionID: params.sessionID }
                            : {}))))];
                case 273: return [2 /*return*/, (_115.result = _525.sent(),
                        _115)];
                case 274:
                    if (!(body.method === "planDoc.active")) return [3 /*break*/, 276];
                    optionsGuard(client, "planDocActive");
                    params = body.params;
                    _116 = {
                        jsonrpc: "2.0",
                        id: (_436 = body.id) !== null && _436 !== void 0 ? _436 : null
                    };
                    return [4 /*yield*/, ((_437 = client.planDocActive) === null || _437 === void 0 ? void 0 : _437.call(client, typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string" ? params.sessionID : undefined))];
                case 275: return [2 /*return*/, (_116.result = _525.sent(),
                        _116)];
                case 276:
                    if (!(body.method === "planDoc.activate")) return [3 /*break*/, 278];
                    optionsGuard(client, "planDocActivate");
                    params = body.params;
                    planID = params === null || params === void 0 ? void 0 : params.planID;
                    if (typeof planID !== "string" || !planID)
                        throw invalidParams("planDoc.activate requires a planID string");
                    _117 = {
                        jsonrpc: "2.0",
                        id: (_438 = body.id) !== null && _438 !== void 0 ? _438 : null
                    };
                    return [4 /*yield*/, ((_439 = client.planDocActivate) === null || _439 === void 0 ? void 0 : _439.call(client, planID, typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string" ? params.sessionID : undefined))];
                case 277: return [2 /*return*/, (_117.result = _525.sent(),
                        _117)];
                case 278:
                    if (!(body.method === "planDoc.deactivate")) return [3 /*break*/, 280];
                    optionsGuard(client, "planDocDeactivate");
                    params = body.params;
                    _118 = {
                        jsonrpc: "2.0",
                        id: (_440 = body.id) !== null && _440 !== void 0 ? _440 : null
                    };
                    return [4 /*yield*/, ((_441 = client.planDocDeactivate) === null || _441 === void 0 ? void 0 : _441.call(client, typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string" ? params.sessionID : undefined))];
                case 279: return [2 /*return*/, (_118.result = _525.sent(),
                        _118)];
                case 280:
                    if (!(body.method === "goal.control")) return [3 /*break*/, 282];
                    optionsGuard(client, "goalControl");
                    params = body.params;
                    action = params === null || params === void 0 ? void 0 : params.action;
                    if (action !== "pause" && action !== "resume" && action !== "clear")
                        throw invalidParams("goal.control requires action: pause | resume | clear");
                    _119 = {
                        jsonrpc: "2.0",
                        id: (_442 = body.id) !== null && _442 !== void 0 ? _442 : null
                    };
                    return [4 /*yield*/, ((_443 = client.goalControl) === null || _443 === void 0 ? void 0 : _443.call(client, action, typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string" ? params.sessionID : undefined))];
                case 281: return [2 /*return*/, (_119.result = _525.sent(),
                        _119)];
                case 282:
                    if (!(body.method === "goal.edit")) return [3 /*break*/, 284];
                    optionsGuard(client, "goalEdit");
                    params = body.params;
                    input = params === null || params === void 0 ? void 0 : params.input;
                    if (typeof input !== "object" || input === null)
                        throw invalidParams("goal.edit requires an input object");
                    goalID = input.goalID;
                    revision = input.revision;
                    if (typeof goalID !== "string" || !goalID.trim())
                        throw invalidParams("goal.edit requires input.goalID");
                    if (typeof revision !== "number" || !Number.isInteger(revision))
                        throw invalidParams("goal.edit requires an integer input.revision");
                    objective = input.objective;
                    maxGoalRounds = input
                        .maxGoalRounds;
                    planID = input.planID;
                    if (objective !== undefined &&
                        (typeof objective !== "string" || !objective.trim()))
                        throw invalidParams("goal.edit input.objective must be a non-empty string");
                    if (maxGoalRounds !== undefined &&
                        (typeof maxGoalRounds !== "number" ||
                            !Number.isInteger(maxGoalRounds) ||
                            maxGoalRounds < 0))
                        throw invalidParams("goal.edit input.maxGoalRounds must be a non-negative integer");
                    if (planID !== undefined && typeof planID !== "string")
                        throw invalidParams("goal.edit input.planID must be a string");
                    if (objective === undefined &&
                        maxGoalRounds === undefined &&
                        planID === undefined)
                        throw invalidParams("goal.edit requires at least one of objective, maxGoalRounds, planID");
                    _120 = {
                        jsonrpc: "2.0",
                        id: (_444 = body.id) !== null && _444 !== void 0 ? _444 : null
                    };
                    return [4 /*yield*/, ((_445 = client.goalEdit) === null || _445 === void 0 ? void 0 : _445.call(client, __assign(__assign(__assign({ goalID: goalID, revision: revision }, (objective !== undefined ? { objective: objective } : {})), (maxGoalRounds !== undefined ? { maxGoalRounds: maxGoalRounds } : {})), (planID !== undefined ? { planID: planID } : {})), typeof (params === null || params === void 0 ? void 0 : params.sessionID) === "string" ? params.sessionID : undefined))];
                case 283: return [2 /*return*/, (_120.result = _525.sent(),
                        _120)];
                case 284:
                    if (!(body.method === "capabilities")) return [3 /*break*/, 286];
                    optionsGuard(client, "capabilities");
                    workspaceID = optionalStringParam(body.params, "workspaceID");
                    _121 = {
                        jsonrpc: "2.0",
                        id: (_446 = body.id) !== null && _446 !== void 0 ? _446 : null
                    };
                    return [4 /*yield*/, client.capabilities(workspaceID ? { workspaceID: workspaceID } : undefined)];
                case 285: return [2 /*return*/, (_121.result = _525.sent(),
                        _121)];
                case 286:
                    if (!(body.method === "session.snapshot")) return [3 /*break*/, 288];
                    optionsGuard(client, "sessionSnapshot");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    _122 = {
                        jsonrpc: "2.0",
                        id: (_447 = body.id) !== null && _447 !== void 0 ? _447 : null
                    };
                    return [4 /*yield*/, ((_448 = client.sessionSnapshot) === null || _448 === void 0 ? void 0 : _448.call(client, sessionID))];
                case 287: return [2 /*return*/, (_122.result = _525.sent(),
                        _122)];
                case 288:
                    if (!(body.method === "session.subagents")) return [3 /*break*/, 290];
                    optionsGuard(client, "subagents");
                    _123 = {
                        jsonrpc: "2.0",
                        id: (_449 = body.id) !== null && _449 !== void 0 ? _449 : null
                    };
                    return [4 /*yield*/, ((_450 = client.subagents) === null || _450 === void 0 ? void 0 : _450.call(client, optionalStringParam(body.params, "sessionID")))];
                case 289: return [2 /*return*/, (_123.result = _525.sent(),
                        _123)];
                case 290:
                    if (!(body.method === "subagent.history")) return [3 /*break*/, 292];
                    optionsGuard(client, "subagentHistory");
                    sessionID = (_451 = body.params) === null || _451 === void 0 ? void 0 : _451.sessionID;
                    _124 = {
                        jsonrpc: "2.0",
                        id: (_452 = body.id) !== null && _452 !== void 0 ? _452 : null
                    };
                    return [4 /*yield*/, ((_453 = client.subagentHistory) === null || _453 === void 0 ? void 0 : _453.call(client, typeof sessionID === "string" ? sessionID : undefined))];
                case 291: return [2 /*return*/, (_124.result = _525.sent(),
                        _124)];
                case 292:
                    if (!(body.method === "subagent.history.page")) return [3 /*break*/, 294];
                    optionsGuard(client, "subagentHistoryPage");
                    params = body.params;
                    if (params !== undefined &&
                        (typeof params !== "object" || Array.isArray(params)))
                        throw invalidParams("subagent.history.page.params must be an object");
                    _125 = {
                        jsonrpc: "2.0",
                        id: (_454 = body.id) !== null && _454 !== void 0 ? _454 : null
                    };
                    return [4 /*yield*/, ((_455 = client.subagentHistoryPage) === null || _455 === void 0 ? void 0 : _455.call(client, (params !== null && params !== void 0 ? params : {})))];
                case 293: return [2 /*return*/, (_125.result = _525.sent(),
                        _125)];
                case 294:
                    if (!(body.method === "attachment.upload")) return [3 /*break*/, 296];
                    optionsGuard(client, "uploadAttachment");
                    params = (_456 = body.params) !== null && _456 !== void 0 ? _456 : {};
                    name_3 = params.name;
                    mediaType = params.mediaType;
                    data = params.data;
                    if (typeof name_3 !== "string" || !name_3)
                        throw invalidParams("attachment.upload.params.name must be a string");
                    if (typeof mediaType !== "string" || !mediaType)
                        throw invalidParams("attachment.upload.params.mediaType must be a string");
                    if (typeof data !== "string" || !data)
                        throw invalidParams("attachment.upload.params.data must be a base64 string");
                    _126 = {
                        jsonrpc: "2.0",
                        id: (_457 = body.id) !== null && _457 !== void 0 ? _457 : null
                    };
                    return [4 /*yield*/, ((_458 = client.uploadAttachment) === null || _458 === void 0 ? void 0 : _458.call(client, __assign({ name: name_3, mediaType: mediaType, data: data }, (optionalStringParam(body.params, "workspaceID")
                            ? { workspaceID: optionalStringParam(body.params, "workspaceID") }
                            : {}))))];
                case 295: return [2 /*return*/, (_126.result = _525.sent(),
                        _126)];
                case 296:
                    if (!(body.method === "attachment.dataUrl")) return [3 /*break*/, 298];
                    optionsGuard(client, "attachmentDataUrl");
                    path = optionalStringParam(body.params, "path");
                    mediaType = optionalStringParam(body.params, "mediaType");
                    attachmentID = optionalStringParam(body.params, "attachmentID");
                    sessionID = optionalStringParam(body.params, "sessionID");
                    if (attachmentID || sessionID) {
                        if (!attachmentID || !sessionID)
                            throw invalidParams("attachment.dataUrl.params requires attachmentID and sessionID together");
                    }
                    else if (!path || !mediaType) {
                        throw invalidParams("attachment.dataUrl.params requires path+mediaType or attachmentID+sessionID");
                    }
                    _127 = {
                        jsonrpc: "2.0",
                        id: (_459 = body.id) !== null && _459 !== void 0 ? _459 : null
                    };
                    return [4 /*yield*/, ((_460 = client.attachmentDataUrl) === null || _460 === void 0 ? void 0 : _460.call(client, __assign(__assign(__assign(__assign(__assign({}, (path ? { path: path } : {})), (mediaType ? { mediaType: mediaType } : {})), (attachmentID ? { attachmentID: attachmentID } : {})), (sessionID ? { sessionID: sessionID } : {})), (optionalStringParam(body.params, "workspaceID")
                            ? { workspaceID: optionalStringParam(body.params, "workspaceID") }
                            : {}))))];
                case 297: return [2 /*return*/, (_127.result = _525.sent(),
                        _127)];
                case 298:
                    if (!(body.method.startsWith("navi.chat.") ||
                        body.method.startsWith("nia.chat."))) return [3 /*break*/, 315];
                    stream = body.method.startsWith("navi.") ? "navi" : "nia";
                    operation = body.method.slice("".concat(stream, ".chat.").length);
                    surface = stream === "navi" ? client.naviChat : client.niaChat;
                    if (!surface)
                        return [2 /*return*/, {
                                jsonrpc: "2.0",
                                id: (_461 = body.id) !== null && _461 !== void 0 ? _461 : null,
                                error: {
                                    code: -32601,
                                    message: "".concat(stream, ".chat surface is not available"),
                                },
                            }];
                    params = body.params;
                    result = void 0;
                    _k = operation;
                    switch (_k) {
                        case "submit": return [3 /*break*/, 299];
                        case "abort": return [3 /*break*/, 301];
                        case "messages": return [3 /*break*/, 303];
                        case "messages.page": return [3 /*break*/, 305];
                        case "rollback": return [3 /*break*/, 307];
                        case "model.profile": return [3 /*break*/, 309];
                        case "model.profile.set": return [3 /*break*/, 311];
                    }
                    return [3 /*break*/, 313];
                case 299:
                    if (!params || typeof params !== "object")
                        throw invalidParams("".concat(body.method, ".params must be an object"));
                    text = params.text;
                    if (typeof text !== "string")
                        throw invalidParams("".concat(body.method, ".params.text must be a string"));
                    return [4 /*yield*/, surface.submit(__assign(__assign(__assign({ text: text }, (typeof params.model === "object"
                            ? {
                                model: params.model,
                            }
                            : {})), (typeof params.reasoningEffort !== "undefined"
                            ? {
                                reasoningEffort: params.reasoningEffort,
                            }
                            : {})), (typeof params.sessionID === "string"
                            ? { sessionID: params.sessionID }
                            : {})))];
                case 300:
                    result = _525.sent();
                    return [3 /*break*/, 314];
                case 301: return [4 /*yield*/, ((_462 = surface.abort) === null || _462 === void 0 ? void 0 : _462.call(surface, params === null || params === void 0 ? void 0 : params.sessionID))];
                case 302:
                    result = _525.sent();
                    return [3 /*break*/, 314];
                case 303: return [4 /*yield*/, ((_463 = surface.messages) === null || _463 === void 0 ? void 0 : _463.call(surface, params === null || params === void 0 ? void 0 : params.sessionID))];
                case 304:
                    result = _525.sent();
                    return [3 /*break*/, 314];
                case 305:
                    if (params !== undefined &&
                        (typeof params !== "object" || Array.isArray(params)))
                        throw invalidParams("".concat(body.method, ".params must be an object"));
                    return [4 /*yield*/, ((_464 = surface.messagesPage) === null || _464 === void 0 ? void 0 : _464.call(surface, (params !== null && params !== void 0 ? params : {})))];
                case 306:
                    result = _525.sent();
                    return [3 /*break*/, 314];
                case 307:
                    if (!params || typeof params !== "object")
                        throw invalidParams("".concat(body.method, ".params must be an object"));
                    input = params.input;
                    toMessageID = input && typeof input === "object"
                        ? input.toMessageID
                        : undefined;
                    if (typeof toMessageID !== "string")
                        throw invalidParams("".concat(body.method, ".params.input.toMessageID must be a string"));
                    return [4 /*yield*/, ((_465 = surface.rollback) === null || _465 === void 0 ? void 0 : _465.call(surface, { toMessageID: toMessageID }, params.sessionID))];
                case 308:
                    result = _525.sent();
                    return [3 /*break*/, 314];
                case 309: return [4 /*yield*/, ((_466 = surface.modelProfile) === null || _466 === void 0 ? void 0 : _466.call(surface, params === null || params === void 0 ? void 0 : params.sessionID))];
                case 310:
                    result = _525.sent();
                    return [3 /*break*/, 314];
                case 311:
                    if (!params || typeof params !== "object")
                        throw invalidParams("".concat(body.method, ".params must be an object"));
                    profile = params.profile;
                    if (!profile || typeof profile !== "object")
                        throw invalidParams("".concat(body.method, ".params.profile must be an object"));
                    return [4 /*yield*/, ((_467 = surface.setModelProfile) === null || _467 === void 0 ? void 0 : _467.call(surface, profile, params.sessionID))];
                case 312:
                    result = _525.sent();
                    return [3 /*break*/, 314];
                case 313: return [2 /*return*/, {
                        jsonrpc: "2.0",
                        id: (_468 = body.id) !== null && _468 !== void 0 ? _468 : null,
                        error: {
                            code: -32601,
                            message: "unknown ".concat(stream, ".chat method: ").concat(operation),
                        },
                    }];
                case 314: return [2 /*return*/, { jsonrpc: "2.0", id: (_469 = body.id) !== null && _469 !== void 0 ? _469 : null, result: result }];
                case 315:
                    if (!(body.method === "config.update")) return [3 /*break*/, 317];
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("config.update.params must be an object");
                    patch = params.patch;
                    if (!patch || typeof patch !== "object" || Array.isArray(patch))
                        throw invalidParams("config.update.params.patch must be an object");
                    scope = params.scope;
                    if (scope !== undefined && scope !== "project" && scope !== "global")
                        throw invalidParams('config.update.params.scope must be "project" or "global"');
                    _128 = {
                        jsonrpc: "2.0",
                        id: (_470 = body.id) !== null && _470 !== void 0 ? _470 : null
                    };
                    return [4 /*yield*/, ((_471 = client.updateConfig) === null || _471 === void 0 ? void 0 : _471.call(client, {
                            patch: patch,
                            scope: scope,
                        }))];
                case 316: return [2 /*return*/, (_128.result = _525.sent(),
                        _128)];
                case 317:
                    if (!(body.method === "config.get")) return [3 /*break*/, 319];
                    optionsGuard(client, "configGet");
                    _129 = {
                        jsonrpc: "2.0",
                        id: (_472 = body.id) !== null && _472 !== void 0 ? _472 : null
                    };
                    return [4 /*yield*/, ((_473 = client.configGet) === null || _473 === void 0 ? void 0 : _473.call(client))];
                case 318: return [2 /*return*/, (_129.result = _525.sent(),
                        _129)];
                case 319:
                    if (!(body.method === "settings.get")) return [3 /*break*/, 321];
                    optionsGuard(client, "settingsGet");
                    _130 = {
                        jsonrpc: "2.0",
                        id: (_474 = body.id) !== null && _474 !== void 0 ? _474 : null
                    };
                    return [4 /*yield*/, ((_475 = client.settingsGet) === null || _475 === void 0 ? void 0 : _475.call(client))];
                case 320: return [2 /*return*/, (_130.result = _525.sent(),
                        _130)];
                case 321:
                    if (!(body.method === "settings.set")) return [3 /*break*/, 323];
                    optionsGuard(client, "settingsSet");
                    params = body.params;
                    patch = params === null || params === void 0 ? void 0 : params.patch;
                    scope = params === null || params === void 0 ? void 0 : params.scope;
                    if (!patch || typeof patch !== "object")
                        throw invalidParams("settings.set.params.patch must be an object");
                    if (scope !== "global" && scope !== "project")
                        throw invalidParams("settings.set.params.scope must be global or project");
                    _131 = {
                        jsonrpc: "2.0",
                        id: (_476 = body.id) !== null && _476 !== void 0 ? _476 : null
                    };
                    return [4 /*yield*/, ((_477 = client.settingsSet) === null || _477 === void 0 ? void 0 : _477.call(client, patch, scope))];
                case 322: return [2 /*return*/, (_131.result = _525.sent(),
                        _131)];
                case 323:
                    if (!(body.method === "submit.input")) return [3 /*break*/, 325];
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("submit.input.params must be an object");
                    if (typeof params.text !== "string")
                        throw invalidParams("submit.input.params.text must be a string");
                    input = params;
                    for (_l = 0, _m = ["attachments", "resources", "agents"]; _l < _m.length; _l++) {
                        field = _m[_l];
                        value = input[field];
                        if (value !== undefined && !Array.isArray(value))
                            throw invalidParams("submit.input.params.".concat(field, " must be an array"));
                    }
                    _132 = {
                        jsonrpc: "2.0",
                        id: (_478 = body.id) !== null && _478 !== void 0 ? _478 : null
                    };
                    return [4 /*yield*/, ((_479 = client.submitInput) === null || _479 === void 0 ? void 0 : _479.call(client, input))];
                case 324: return [2 /*return*/, (_132.result = _525.sent(),
                        _132)];
                case 325:
                    if (!(body.method === "input.remove" ||
                        body.method === "input.replace" ||
                        body.method === "input.promote")) return [3 /*break*/, 331];
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("".concat(body.method, ".params must be an object"));
                    record = params;
                    if (typeof record.id !== "string")
                        throw invalidParams("".concat(body.method, ".params.id must be a string"));
                    if (record.sessionID !== undefined &&
                        typeof record.sessionID !== "string")
                        throw invalidParams("".concat(body.method, ".params.sessionID must be a string"));
                    target = __assign({ id: record.id }, (record.sessionID ? { sessionID: record.sessionID } : {}));
                    if (!(body.method === "input.replace")) return [3 /*break*/, 327];
                    if (typeof record.text !== "string")
                        throw invalidParams("input.replace.params.text must be a string");
                    optionsGuard(client, "replaceInput");
                    _133 = {
                        jsonrpc: "2.0",
                        id: (_480 = body.id) !== null && _480 !== void 0 ? _480 : null
                    };
                    return [4 /*yield*/, client.replaceInput(__assign(__assign({}, target), { text: record.text }))];
                case 326: return [2 /*return*/, (_133.result = _525.sent(),
                        _133)];
                case 327:
                    if (!(body.method === "input.remove")) return [3 /*break*/, 329];
                    optionsGuard(client, "removeInput");
                    _134 = {
                        jsonrpc: "2.0",
                        id: (_481 = body.id) !== null && _481 !== void 0 ? _481 : null
                    };
                    return [4 /*yield*/, client.removeInput(target)];
                case 328: return [2 /*return*/, (_134.result = _525.sent(),
                        _134)];
                case 329:
                    optionsGuard(client, "promoteInput");
                    _135 = {
                        jsonrpc: "2.0",
                        id: (_482 = body.id) !== null && _482 !== void 0 ? _482 : null
                    };
                    return [4 /*yield*/, client.promoteInput(target)];
                case 330: return [2 /*return*/, (_135.result = _525.sent(),
                        _135)];
                case 331:
                    if (!(body.method === "config.reload")) return [3 /*break*/, 333];
                    optionsGuard(client, "reloadConfig");
                    _136 = {
                        jsonrpc: "2.0",
                        id: (_483 = body.id) !== null && _483 !== void 0 ? _483 : null
                    };
                    return [4 /*yield*/, client.reloadConfig()];
                case 332: return [2 /*return*/, (_136.result = _525.sent(),
                        _136)];
                case 333:
                    if (!(body.method === "config.canReload")) return [3 /*break*/, 335];
                    optionsGuard(client, "canReloadConfig");
                    _137 = {
                        jsonrpc: "2.0",
                        id: (_484 = body.id) !== null && _484 !== void 0 ? _484 : null
                    };
                    return [4 /*yield*/, client.canReloadConfig()];
                case 334: return [2 /*return*/, (_137.result = _525.sent(),
                        _137)];
                case 335:
                    if (body.method === "runtime.availability") {
                        // Derived from the client, so there is deliberately no options guard: this
                        // answers "what does this runtime implement", and a runtime that implements
                        // little must still be able to say so. Asking the runtime to declare it
                        // would let the declaration drift from the code.
                        //
                        // The report carries the RPC channel's own reachability: what the runtime
                        // implements intersected with the route table above. A consumer can now
                        // tell "this runtime cannot" from "this connection cannot reach it" — the
                        // `terminal`/`terminalSharing` retirement and the P0-B gap list both show
                        // up here before any code outside this package does.
                        return [2 /*return*/, {
                                jsonrpc: "2.0",
                                id: (_485 = body.id) !== null && _485 !== void 0 ? _485 : null,
                                result: cullAvailabilityReport((0, contracts_1.describeRuntimeCapabilities)(client, {
                                    name: "rpc",
                                    routedMembers: exports.RPC_ROUTED_MEMBERS,
                                    // Members routed away on purpose keep their reason, so the report
                                    // distinguishes "forgotten" from "intentionally local".
                                    unreachableReasons: exports.RPC_INTENTIONALLY_LOCAL,
                                }), authorization),
                            }];
                    }
                    if (!(body.method === "runtime.status")) return [3 /*break*/, 337];
                    optionsGuard(client, "runtimeStatus");
                    _138 = {
                        jsonrpc: "2.0",
                        id: (_486 = body.id) !== null && _486 !== void 0 ? _486 : null
                    };
                    return [4 /*yield*/, ((_487 = client.runtimeStatus) === null || _487 === void 0 ? void 0 : _487.call(client, optionalStringParam(body.params, "sessionID")))];
                case 336: return [2 /*return*/, (_138.result = _525.sent(),
                        _138)];
                case 337:
                    if (!(body.method === "diagnostics.list")) return [3 /*break*/, 339];
                    optionsGuard(client, "diagnostics");
                    limit = (_488 = body.params) === null || _488 === void 0 ? void 0 : _488.limit;
                    if (limit !== undefined &&
                        (typeof limit !== "number" ||
                            !Number.isInteger(limit) ||
                            limit < 1 ||
                            limit > 500))
                        throw invalidParams("diagnostics.list.params.limit must be an integer between 1 and 500");
                    _139 = {
                        jsonrpc: "2.0",
                        id: (_489 = body.id) !== null && _489 !== void 0 ? _489 : null
                    };
                    return [4 /*yield*/, client.diagnostics(typeof limit === "number" ? limit : undefined, optionalStringParam(body.params, "sessionID"))];
                case 338: return [2 /*return*/, (_139.result = _525.sent(),
                        _139)];
                case 339:
                    if (!(body.method === "mcp.prompt")) return [3 /*break*/, 341];
                    optionsGuard(client, "getMcpPrompt");
                    arguments_ = (_490 = body.params) === null || _490 === void 0 ? void 0 : _490.arguments;
                    if (arguments_ !== undefined &&
                        (!arguments_ ||
                            typeof arguments_ !== "object" ||
                            Array.isArray(arguments_)))
                        throw invalidParams("mcp.prompt.params.arguments must be an object");
                    _140 = {
                        jsonrpc: "2.0",
                        id: (_491 = body.id) !== null && _491 !== void 0 ? _491 : null
                    };
                    return [4 /*yield*/, client.getMcpPrompt(stringParam(body.params, "server"), stringParam(body.params, "name"), arguments_, optionalStringParam(body.params, "workspaceID"))];
                case 340: return [2 /*return*/, (_140.result = _525.sent(),
                        _140)];
                case 341:
                    if (!(body.method === "mcp.resource")) return [3 /*break*/, 343];
                    optionsGuard(client, "readMcpResource");
                    _141 = {
                        jsonrpc: "2.0",
                        id: (_492 = body.id) !== null && _492 !== void 0 ? _492 : null
                    };
                    return [4 /*yield*/, client.readMcpResource(stringParam(body.params, "server"), stringParam(body.params, "uri"), optionalStringParam(body.params, "workspaceID"))];
                case 342: return [2 /*return*/, (_141.result = _525.sent(),
                        _141)];
                case 343:
                    if (!(body.method === "mcp.server.add")) return [3 /*break*/, 345];
                    optionsGuard(client, "mcpServerAdd");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("mcp.server.add.params must be an object");
                    name_4 = params.name;
                    config = params.config;
                    if (typeof name_4 !== "string" || !name_4)
                        throw invalidParams("mcp.server.add.params.name must be a non-empty string");
                    if (!config || typeof config !== "object")
                        throw invalidParams("mcp.server.add.params.config must be an object");
                    _142 = {
                        jsonrpc: "2.0",
                        id: (_493 = body.id) !== null && _493 !== void 0 ? _493 : null
                    };
                    return [4 /*yield*/, ((_494 = client.mcpServerAdd) === null || _494 === void 0 ? void 0 : _494.call(client, __assign({ name: name_4, config: config }, (optionalStringParam(body.params, "workspaceID")
                            ? { workspaceID: optionalStringParam(body.params, "workspaceID") }
                            : {}))))];
                case 344: return [2 /*return*/, (_142.result = _525.sent(),
                        _142)];
                case 345:
                    if (!(body.method === "mcp.server.remove")) return [3 /*break*/, 347];
                    optionsGuard(client, "mcpServerRemove");
                    _143 = {
                        jsonrpc: "2.0",
                        id: (_495 = body.id) !== null && _495 !== void 0 ? _495 : null
                    };
                    return [4 /*yield*/, client.mcpServerRemove(stringParam(body.params, "name"), optionalStringParam(body.params, "workspaceID"))];
                case 346: return [2 /*return*/, (_143.result = _525.sent(),
                        _143)];
                case 347:
                    if (!(body.method === "permission.list")) return [3 /*break*/, 349];
                    optionsGuard(client, "permissionList");
                    _144 = {
                        jsonrpc: "2.0",
                        id: (_496 = body.id) !== null && _496 !== void 0 ? _496 : null
                    };
                    return [4 /*yield*/, ((_497 = client.permissionList) === null || _497 === void 0 ? void 0 : _497.call(client))];
                case 348: return [2 /*return*/, (_144.result = _525.sent(),
                        _144)];
                case 349:
                    if (!(body.method === "permission.save")) return [3 /*break*/, 351];
                    optionsGuard(client, "permissionSave");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("permission.save.params must be an object");
                    name_5 = params.name;
                    profile = params.profile;
                    if (typeof name_5 !== "string" || !name_5)
                        throw invalidParams("permission.save.params.name must be a non-empty string");
                    if (!profile || typeof profile !== "object")
                        throw invalidParams("permission.save.params.profile must be an object");
                    _145 = {
                        jsonrpc: "2.0",
                        id: (_498 = body.id) !== null && _498 !== void 0 ? _498 : null
                    };
                    return [4 /*yield*/, ((_499 = client.permissionSave) === null || _499 === void 0 ? void 0 : _499.call(client, {
                            name: name_5,
                            profile: profile,
                        }))];
                case 350: return [2 /*return*/, (_145.result = _525.sent(),
                        _145)];
                case 351:
                    if (!(body.method === "permission.delete")) return [3 /*break*/, 353];
                    optionsGuard(client, "permissionDelete");
                    _146 = {
                        jsonrpc: "2.0",
                        id: (_500 = body.id) !== null && _500 !== void 0 ? _500 : null
                    };
                    return [4 /*yield*/, client.permissionDelete(stringParam(body.params, "name"))];
                case 352: return [2 /*return*/, (_146.result = _525.sent(),
                        _146)];
                case 353:
                    managementName = function (params, method) {
                        var value = params === null || params === void 0 ? void 0 : params.name;
                        if (typeof value !== "string" || !value)
                            throw invalidParams("".concat(method, ".params.name must be a non-empty string"));
                        return value;
                    };
                    managementObject = function (params, method) {
                        var value = params === null || params === void 0 ? void 0 : params.config;
                        if (!value || typeof value !== "object")
                            throw invalidParams("".concat(method, ".params.config must be an object"));
                        return value;
                    };
                    if (!(body.method === "agent.create" || body.method === "agent.update")) return [3 /*break*/, 358];
                    member = body.method === "agent.create" ? "agentCreate" : "agentUpdate";
                    optionsGuard(client, member);
                    name_6 = managementName(body.params, body.method);
                    config = managementObject(body.params, body.method);
                    _147 = {
                        jsonrpc: "2.0",
                        id: (_501 = body.id) !== null && _501 !== void 0 ? _501 : null
                    };
                    if (!(body.method === "agent.create")) return [3 /*break*/, 355];
                    return [4 /*yield*/, ((_502 = client.agentCreate) === null || _502 === void 0 ? void 0 : _502.call(client, __assign({ name: name_6, config: config }, (optionalStringParam(body.params, "workspaceID")
                            ? {
                                workspaceID: optionalStringParam(body.params, "workspaceID"),
                            }
                            : {}))))];
                case 354:
                    _o = _525.sent();
                    return [3 /*break*/, 357];
                case 355: return [4 /*yield*/, ((_503 = client.agentUpdate) === null || _503 === void 0 ? void 0 : _503.call(client, __assign({ name: name_6, config: config }, (optionalStringParam(body.params, "workspaceID")
                        ? {
                            workspaceID: optionalStringParam(body.params, "workspaceID"),
                        }
                        : {}))))];
                case 356:
                    _o = _525.sent();
                    _525.label = 357;
                case 357: return [2 /*return*/, (_147.result = _o,
                        _147)];
                case 358:
                    if (!(body.method === "agent.delete")) return [3 /*break*/, 360];
                    optionsGuard(client, "agentDelete");
                    _148 = {
                        jsonrpc: "2.0",
                        id: (_504 = body.id) !== null && _504 !== void 0 ? _504 : null
                    };
                    return [4 /*yield*/, client.agentDelete(managementName(body.params, "agent.delete"), optionalStringParam(body.params, "workspaceID"))];
                case 359: return [2 /*return*/, (_148.result = _525.sent(),
                        _148)];
                case 360:
                    if (!(body.method === "provider.discover")) return [3 /*break*/, 362];
                    optionsGuard(client, "providerDiscover");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("provider.discover.params must be an object");
                    type = params.type;
                    baseURL = params.baseURL;
                    apiKey = params.apiKey;
                    headers = params.headers;
                    if (typeof type !== "string" || !type)
                        throw invalidParams("provider.discover.params.type must be a non-empty string");
                    if (typeof baseURL !== "string" || !baseURL)
                        throw invalidParams("provider.discover.params.baseURL must be a non-empty string");
                    if (typeof apiKey !== "string")
                        throw invalidParams("provider.discover.params.apiKey must be a string");
                    if (headers !== undefined &&
                        (typeof headers !== "object" ||
                            headers === null ||
                            Array.isArray(headers) ||
                            !Object.values(headers).every(function (value) { return typeof value === "string"; })))
                        throw invalidParams("provider.discover.params.headers must contain only string values");
                    _149 = {
                        jsonrpc: "2.0",
                        id: (_505 = body.id) !== null && _505 !== void 0 ? _505 : null
                    };
                    return [4 /*yield*/, ((_506 = client.providerDiscover) === null || _506 === void 0 ? void 0 : _506.call(client, {
                            type: type,
                            baseURL: baseURL,
                            apiKey: apiKey,
                            headers: headers,
                        }))];
                case 361: return [2 /*return*/, (_149.result = _525.sent(),
                        _149)];
                case 362:
                    if (!(body.method === "provider.add")) return [3 /*break*/, 364];
                    optionsGuard(client, "providerAdd");
                    params = body.params;
                    if (!params || typeof params !== "object")
                        throw invalidParams("provider.add.params must be an object");
                    name_7 = params.name;
                    type = params.type;
                    apiKey = params.apiKey;
                    baseURL = params.baseURL;
                    if (typeof name_7 !== "string" || !name_7)
                        throw invalidParams("provider.add.params.name must be a non-empty string");
                    if (typeof type !== "string" || !type)
                        throw invalidParams("provider.add.params.type must be a non-empty string");
                    if (typeof apiKey !== "string")
                        throw invalidParams("provider.add.params.apiKey must be a string");
                    headers = params.headers;
                    models = params.models;
                    label = params.label;
                    previousName = params.previousName;
                    _150 = {
                        jsonrpc: "2.0",
                        id: (_507 = body.id) !== null && _507 !== void 0 ? _507 : null
                    };
                    return [4 /*yield*/, ((_508 = client.providerAdd) === null || _508 === void 0 ? void 0 : _508.call(client, __assign(__assign(__assign(__assign({ name: name_7, type: type, apiKey: apiKey, baseURL: typeof baseURL === "string" && baseURL ? baseURL : undefined }, (typeof label === "string" && label ? { label: label } : {})), (typeof previousName === "string" && previousName
                            ? { previousName: previousName }
                            : {})), (headers && typeof headers === "object"
                            ? { headers: headers }
                            : {})), (Array.isArray(models)
                            ? {
                                models: models,
                            }
                            : {}))))];
                case 363: return [2 /*return*/, (_150.result = _525.sent(),
                        _150)];
                case 364:
                    if (!(body.method === "provider.remove")) return [3 /*break*/, 366];
                    optionsGuard(client, "providerRemove");
                    _151 = {
                        jsonrpc: "2.0",
                        id: (_509 = body.id) !== null && _509 !== void 0 ? _509 : null
                    };
                    return [4 /*yield*/, client.providerRemove(managementName(body.params, "provider.remove"))];
                case 365: return [2 /*return*/, (_151.result = _525.sent(),
                        _151)];
                case 366:
                    if (!(body.method === "plugin.unload" || body.method === "plugin.reload")) return [3 /*break*/, 371];
                    member = body.method === "plugin.unload" ? "pluginUnload" : "pluginReload";
                    optionsGuard(client, member);
                    id = managementName(body.params, body.method);
                    _152 = {
                        jsonrpc: "2.0",
                        id: (_510 = body.id) !== null && _510 !== void 0 ? _510 : null
                    };
                    if (!(body.method === "plugin.unload")) return [3 /*break*/, 368];
                    return [4 /*yield*/, ((_511 = client.pluginUnload) === null || _511 === void 0 ? void 0 : _511.call(client, id))];
                case 367:
                    _p = _525.sent();
                    return [3 /*break*/, 370];
                case 368: return [4 /*yield*/, ((_512 = client.pluginReload) === null || _512 === void 0 ? void 0 : _512.call(client, id))];
                case 369:
                    _p = _525.sent();
                    _525.label = 370;
                case 370: return [2 /*return*/, (_152.result = _p,
                        _152)];
                case 371:
                    if (!(body.method === "plugin.install")) return [3 /*break*/, 373];
                    optionsGuard(client, "pluginInstall");
                    params = body.params;
                    if (!params || typeof params.spec !== "string")
                        throw invalidParams("plugin.install.params.spec must be a string");
                    _153 = {
                        jsonrpc: "2.0",
                        id: (_513 = body.id) !== null && _513 !== void 0 ? _513 : null
                    };
                    return [4 /*yield*/, ((_514 = client.pluginInstall) === null || _514 === void 0 ? void 0 : _514.call(client, { spec: params.spec }))];
                case 372: return [2 /*return*/, (_153.result = _525.sent(),
                        _153)];
                case 373:
                    if (!(body.method === "plugin.uninstall")) return [3 /*break*/, 375];
                    optionsGuard(client, "pluginUninstall");
                    params = body.params;
                    if (!params || typeof params.pluginID !== "string")
                        throw invalidParams("plugin.uninstall.params.pluginID must be a string");
                    _154 = {
                        jsonrpc: "2.0",
                        id: (_515 = body.id) !== null && _515 !== void 0 ? _515 : null
                    };
                    return [4 /*yield*/, ((_516 = client.pluginUninstall) === null || _516 === void 0 ? void 0 : _516.call(client, { pluginID: params.pluginID }))];
                case 374: return [2 /*return*/, (_154.result = _525.sent(),
                        _154)];
                case 375:
                    if (!(body.method === "plugin.catalog")) return [3 /*break*/, 377];
                    optionsGuard(client, "pluginCatalog");
                    _155 = {
                        jsonrpc: "2.0",
                        id: (_517 = body.id) !== null && _517 !== void 0 ? _517 : null
                    };
                    return [4 /*yield*/, ((_518 = client.pluginCatalog) === null || _518 === void 0 ? void 0 : _518.call(client))];
                case 376: return [2 /*return*/, (_155.result = _525.sent(),
                        _155)];
                case 377:
                    if (!(body.method === "plugin.set-enabled")) return [3 /*break*/, 379];
                    optionsGuard(client, "pluginSetEnabled");
                    params = body.params;
                    if (!params ||
                        typeof params.pluginID !== "string" ||
                        typeof params.enabled !== "boolean")
                        throw invalidParams("plugin.set-enabled.params.pluginID/enabled is required");
                    _156 = {
                        jsonrpc: "2.0",
                        id: (_519 = body.id) !== null && _519 !== void 0 ? _519 : null
                    };
                    return [4 /*yield*/, ((_520 = client.pluginSetEnabled) === null || _520 === void 0 ? void 0 : _520.call(client, {
                            pluginID: params.pluginID,
                            enabled: params.enabled,
                        }))];
                case 378: return [2 /*return*/, (_156.result = _525.sent(),
                        _156)];
                case 379:
                    if (!(body.method === "tools.reload")) return [3 /*break*/, 381];
                    member = "toolFamilyReload";
                    optionsGuard(client, member);
                    id = managementName(body.params, body.method);
                    _157 = {
                        jsonrpc: "2.0",
                        id: (_521 = body.id) !== null && _521 !== void 0 ? _521 : null
                    };
                    return [4 /*yield*/, ((_522 = client.toolFamilyReload) === null || _522 === void 0 ? void 0 : _522.call(client, id))];
                case 380: return [2 /*return*/, (_157.result = _525.sent(),
                        _157)];
                case 381: 
                // A name the route table accepted but no dispatch block serves: the table
                // and the code drifted. `-32601` still, so a consumer gets the same answer
                // it would for a truly unknown name.
                throw new contracts_1.RuntimeMethodNotFound((_523 = body.method) !== null && _523 !== void 0 ? _523 : "");
                case 382:
                    error_1 = _525.sent();
                    return [2 /*return*/, {
                            jsonrpc: "2.0",
                            id: (_524 = request === null || request === void 0 ? void 0 : request.id) !== null && _524 !== void 0 ? _524 : null,
                            error: describeFailure(error_1, client, request === null || request === void 0 ? void 0 : request.method),
                        }];
                case 383: return [2 /*return*/];
            }
        });
    });
}
/**
 * Turns a thrown error into a JSON-RPC error object.
 *
 * Classification comes from the typed failure the thrower attached, never from
 * reading its message: matching on prose is how a refusal quietly becomes a bug
 * report the day someone rewords a string.
 *
 * An error with no classification is internal by definition. Its message is
 * dropped rather than forwarded, because at this point we do not know what is in
 * it — `ENOENT: ... stat '/home/someone/project/secret'` is a real example. The
 * detail is published as a durable diagnostic under an ID that travels with the
 * error, so whoever can read `diagnostics.list` can still find it.
 */
function describeFailure(error, client, method) {
    var classified = (0, contracts_1.runtimeFailureData)(error);
    if (classified)
        return {
            code: contracts_1.RUNTIME_RPC_ERROR_CODES[classified.kind],
            message: error instanceof Error ? error.message : String(error),
            data: classified,
        };
    var message = error instanceof Error ? error.message : String(error);
    var errorID = "err_".concat(Date.now().toString(36)).concat(Math.random().toString(36).slice(2, 8));
    // Reporting a failure must not be able to fail. `diagnostic` is required by the
    // contract, but this path runs for clients that are wrong about that, and a
    // throw here would replace the caller's answer with a broken connection. The
    // reply is the same either way; only the durable copy of the detail is lost.
    try {
        client.diagnostic("rpc ".concat(method !== null && method !== void 0 ? method : "request", " failed [").concat(errorID, "]: ").concat(message), "error");
    }
    catch (_a) {
        /* a runtime that cannot record its own failure still owes the caller a reply */
    }
    return {
        code: contracts_1.RUNTIME_RPC_ERROR_CODES.internal,
        message: "internal runtime failure",
        data: { kind: "internal", errorID: errorID },
    };
}
