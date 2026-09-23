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
exports.createExecuteCalls = createExecuteCalls;
/**
 * Tool call execution orchestration — runtime/tool-execution/execute-calls.ts.
 *
 * `executeToolCalls` runs a provider's tool-call batch for one turn: it
 * materializes image attachments gated by the model's input
 * capabilities, resolves every call against the tool registry, publishes the
 * denial/failure facts, executes each call through `executeOneTool`, and
 * assembles the tool-result provider messages. `toolResultContent` shapes what
 * the model actually reads. Reads host state through `RuntimeContext` at call
 * time.
 */
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var session_1 = require("@anthelia/session");
var runtime_services_1 = require("@natalia/runtime-services");
var work_ledger_1 = require("@natalia/work-ledger");
var tool_policy_1 = require("@natalia/tool-policy");
var runtime_1 = require("@natalia/runtime");
var substrate_1 = require("@anthelia/substrate");
/**
 * The constitution self-protection patterns: shell and terminal input that must
 * never run, regardless of permission profile or approval. The same source the
 * command policy extracts command text from, so every shell surface is judged
 * from one place.
 */
var SELF_PROTECTION_PATTERNS = [
    {
        pattern: /pkill\s+-f\s+wezterm-mux-server/i,
        ruleID: "C-TERM-001",
        statement: "禁止直接杀掉 wezterm-mux-server",
    },
    {
        pattern: /rm\s+-rf\s+\/run\/user\/\d+\/natalia/i,
        ruleID: "C-TERM-002",
        statement: "禁止删除 Natalia 运行时目录",
    },
    {
        pattern: /rm\s+-rf\s+\/tmp\/natalia/i,
        ruleID: "C-TERM-003",
        statement: "禁止删除 Natalia 临时目录",
    },
];
function createExecuteCalls(ctx, options) {
    return {
        executeToolCalls: executeToolCalls,
        toolResultContent: toolResultContent,
        checkConstitutionForTool: checkConstitutionForTool,
    };
    /**
     * Checks constitution rules and the self-protection patterns. Returns the
     * blocked reason or undefined.
     *
     * `commandText` is whatever the call would actually run, extracted by the
     * same function the command policy uses, so shell and terminal input are
     * judged from one source. This check runs before approval, which is what
     * makes it a block rather than a prompt: an approval that is skipped, cached
     * or auto-granted cannot let a self-protection violation through.
     */
    function checkConstitutionForTool(turnID, callID, toolName, toolAction, toolResource, commandText) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, executionForTurn, publishForSession, workLedgerController, sessionID, exec, publish, rules, overrides, blocked, _i, SELF_PROTECTION_PATTERNS_1, entry, _b, rules_1, rule, applies, override, denyWithoutOverride;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = ctx.ports, executionForTurn = _a.executionForTurn, publishForSession = _a.publishForSession;
                        workLedgerController = ctx.state.serviceDirectory.get(work_ledger_1.workLedgerController);
                        sessionID = ctx.ports.getSessionID();
                        exec = (_c = executionForTurn(turnID)) !== null && _c !== void 0 ? _c : ctx.ports.getExecutionBySession().get(sessionID);
                        if (!exec)
                            return [2 /*return*/, undefined];
                        publish = function (event) { return publishForSession(exec, event); };
                        // Constitution is a security boundary: only evaluate it against the complete
                        // fact state. A fast-attach tail is completed from paged history; if no store
                        // can serve the pages this falls back to the explicit full load, and a load
                        // failure aborts the call (fail-closed).
                        return [4 /*yield*/, (0, substrate_1.ensureCompleteSessionFactState)(ctx, exec)];
                    case 1:
                        // Constitution is a security boundary: only evaluate it against the complete
                        // fact state. A fast-attach tail is completed from paged history; if no store
                        // can serve the pages this falls back to the explicit full load, and a load
                        // failure aborts the call (fail-closed).
                        _d.sent();
                        rules = exec.factStateComplete === true && exec.factState
                            ? (0, session_1.sessionFactConstitutionRules)(exec.factState)
                            : (0, session_1.projectedConstitutionRules)(exec.session.events);
                        overrides = exec.factStateComplete === true && exec.factState
                            ? (0, session_1.sessionFactConstitutionOverrides)(exec.factState)
                            : (0, session_1.projectedConstitutionOverrides)(exec.session.events);
                        if (commandText) {
                            for (_i = 0, SELF_PROTECTION_PATTERNS_1 = SELF_PROTECTION_PATTERNS; _i < SELF_PROTECTION_PATTERNS_1.length; _i++) {
                                entry = SELF_PROTECTION_PATTERNS_1[_i];
                                if (entry.pattern.test(commandText)) {
                                    publish({
                                        type: "constitution.check",
                                        id: "".concat(turnID, ":constitution:").concat(entry.ruleID.toLowerCase()),
                                        ruleID: entry.ruleID,
                                        statement: entry.statement,
                                        priority: "critical",
                                        enforcement: "deny",
                                        action: toolAction,
                                        resource: "command:".concat(commandText.slice(0, 120)),
                                        conflict: true,
                                    });
                                    // CST4: the blocked call is constrained by the rule that stopped it.
                                    // The tool-call node for a failed call is published by the caller, so
                                    // the edge's source exists once the call settles; a conflict is the
                                    // only check worth an edge (a pass-through rule is not news).
                                    publish(workLedgerController.constitutionCheckEdge({
                                        turnID: turnID,
                                        callID: callID,
                                        ruleID: entry.ruleID,
                                    }));
                                    blocked = "blocked by constitution: ".concat(entry.statement, ". Use terminal.kill or terminal.close instead.");
                                    break;
                                }
                            }
                        }
                        for (_b = 0, rules_1 = rules; _b < rules_1.length; _b++) {
                            rule = rules_1[_b];
                            if (rule.enforcement !== "deny" && rule.enforcement !== "warn")
                                continue;
                            applies = journalRuleApplies(rule.ruleID, commandText, toolResource);
                            if (!applies)
                                continue;
                            override = matchingOverride(overrides, rule.ruleID, toolResource);
                            denyWithoutOverride = rule.enforcement === "deny" && applies && !override;
                            publish(__assign({ type: "constitution.check", id: "".concat(turnID, ":constitution:").concat(rule.ruleID.toLowerCase()), ruleID: rule.ruleID, statement: rule.statement, priority: rule.priority, enforcement: rule.enforcement, action: toolAction, resource: toolResource, conflict: denyWithoutOverride }, (override
                                ? {
                                    override: {
                                        reason: override.reason,
                                        approvedBy: override.approvedBy,
                                    },
                                }
                                : {})));
                            if (denyWithoutOverride && !blocked) {
                                publish(workLedgerController.constitutionCheckEdge({
                                    turnID: turnID,
                                    callID: callID,
                                    ruleID: rule.ruleID,
                                }));
                                blocked = "blocked by constitution: ".concat(rule.statement);
                            }
                        }
                        return [2 /*return*/, blocked];
                }
            });
        });
    }
    function journalRuleApplies(ruleID, commandText, toolResource) {
        if (ruleID.startsWith("C-TERM-"))
            return false;
        if (ruleID === "C-REL-001")
            return Boolean(commandText && /\bgit\s+(commit|push)\b/iu.test(commandText));
        if (ruleID === "C-REL-002")
            return false;
        return toolResource !== "global";
    }
    function matchingOverride(overrides, ruleID, toolResource) {
        return overrides.find(function (override) {
            var _a;
            if (override.ruleID !== ruleID)
                return false;
            if (!((_a = override.paths) === null || _a === void 0 ? void 0 : _a.length))
                return true;
            return override.paths.some(function (path) { return toolResource === path || toolResource.includes(path); });
        });
    }
    /**
     * The tool result the model actually reads. In an internal module episode the
     * call ID is prepended to the content of text-shaped results, because
     * models reliably read content but routinely ignore the protocol-level
     * tool_call_id — without this the model cannot know its own call ID and
     * guesses evidenceRefs. JSON-shaped results stay untouched: the model
     * consumes them verbatim.
     */
    function toolResultContent(content, callID, moduleContext) {
        if (!moduleContext)
            return content;
        var trimmed = content.trimStart();
        if (trimmed.startsWith("{") || trimmed.startsWith("["))
            return content;
        return "[tool call ID: ".concat(callID, "] ").concat(content);
    }
    function executeToolCalls(turnID, calls, assistant, materialized, reasoning) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getSessionID, getWorkspaceRoot, getRuntimeContext, publishForSession, publishWorkGraphToolCall, currentModelImageInput, mediaTypeForImage, isToolAllowed, extensionToolPermission, executeOneTool, _b, executionBySession, turnSession, tools, sessionID, workspaceRoot, runtimeContext, policy, pendingImages, exec, attachImage, publish, execContext, reservedCallIDs, normalizedCalls, effectiveCalls, assistantMessage, messages, _i, _c, _d, index, call, _e, effectiveCalls_1, call, reason, resolved, reason, registered, result;
            var _this = this;
            var _f, _g, _h, _j, _k, _l, _m;
            return __generator(this, function (_o) {
                switch (_o.label) {
                    case 0:
                        _a = ctx.ports, getSessionID = _a.getSessionID, getWorkspaceRoot = _a.getWorkspaceRoot, getRuntimeContext = _a.getRuntimeContext, publishForSession = _a.publishForSession, publishWorkGraphToolCall = _a.publishWorkGraphToolCall, currentModelImageInput = _a.currentModelImageInput, mediaTypeForImage = _a.mediaTypeForImage, isToolAllowed = _a.isToolAllowed, extensionToolPermission = _a.extensionToolPermission, executeOneTool = _a.executeOneTool;
                        _b = ctx.state, executionBySession = _b.executionBySession, turnSession = _b.turnSession, tools = _b.tools;
                        sessionID = getSessionID();
                        workspaceRoot = getWorkspaceRoot();
                        runtimeContext = getRuntimeContext();
                        policy = ctx.state.serviceDirectory.get(tool_policy_1.toolPolicy);
                        if (!policy)
                            throw new Error("tool pipeline unavailable (natalia-tool-pipeline)");
                        pendingImages = [];
                        exec = executionBySession.get((_f = turnSession.get(turnID)) !== null && _f !== void 0 ? _f : sessionID);
                        if (!exec)
                            throw new Error("no execution state for turn ".concat(turnID));
                        attachImage = currentModelImageInput(exec)
                            ? function (path) { return __awaiter(_this, void 0, void 0, function () {
                                var mediaType, bytes;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            mediaType = mediaTypeForImage(path);
                                            if (!mediaType)
                                                throw new Error("unsupported image attachment type for ".concat(path, "; expected png, jpeg, webp or gif"));
                                            return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.resolve)(workspaceRoot, path))];
                                        case 1:
                                            bytes = _a.sent();
                                            pendingImages.push({
                                                mediaType: mediaType,
                                                dataURL: "data:".concat(mediaType, ";base64,").concat(bytes.toString("base64")),
                                            });
                                            return [2 /*return*/];
                                    }
                                });
                            }); }
                            : undefined;
                        publish = function (event) { return publishForSession(exec, event); };
                        execContext = (_g = exec === null || exec === void 0 ? void 0 : exec.context) !== null && _g !== void 0 ? _g : runtimeContext;
                        reservedCallIDs = new Set(execContext
                            .snapshot()
                            .entries.flatMap(function (entry) { return (entry.pairID ? [entry.pairID] : []); }));
                        normalizedCalls = (0, runtime_1.uniqueProviderToolCallIds)(calls, reservedCallIDs);
                        if (normalizedCalls.duplicates.length)
                            publish({
                                type: "diagnostic",
                                level: "warning",
                                message: "tool batch contained duplicate tool_call_id(s); remapped before execution: ".concat(normalizedCalls.duplicates.join(", ")),
                            });
                        effectiveCalls = normalizedCalls.calls;
                        assistantMessage = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ role: "assistant", content: assistant }, ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.content) !== undefined
                            ? { reasoningContent: reasoning.content }
                            : {})), ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.field) ? { reasoningField: reasoning.field } : {})), ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.signature)
                            ? { reasoningSignature: reasoning.signature }
                            : {})), ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.redacted) ? { reasoningRedacted: true } : {})), (((_h = reasoning === null || reasoning === void 0 ? void 0 : reasoning.blocks) === null || _h === void 0 ? void 0 : _h.length)
                            ? { reasoningBlocks: reasoning.blocks }
                            : {})), (((_j = reasoning === null || reasoning === void 0 ? void 0 : reasoning.parts) === null || _j === void 0 ? void 0 : _j.length) ? { contentParts: reasoning.parts } : {})), ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.providerMetadata)
                            ? { providerMetadata: reasoning.providerMetadata }
                            : {})), ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.textSignature)
                            ? { textSignature: reasoning.textSignature }
                            : {})), { toolCalls: effectiveCalls });
                        messages = [assistantMessage];
                        for (_i = 0, _c = effectiveCalls.entries(); _i < _c.length; _i++) {
                            _d = _c[_i], index = _d[0], call = _d[1];
                            execContext.add(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ id: "".concat(turnID, ":").concat(call.id, ":call"), role: "tool_call", content: "".concat(call.name, " ").concat(call.arguments), pairID: call.id }, (call.thoughtSignature
                                ? { thoughtSignature: call.thoughtSignature }
                                : {})), (index === 0 && (reasoning === null || reasoning === void 0 ? void 0 : reasoning.content) !== undefined
                                ? { reasoningContent: reasoning.content }
                                : {})), (index === 0 && (reasoning === null || reasoning === void 0 ? void 0 : reasoning.field)
                                ? { reasoningField: reasoning.field }
                                : {})), (index === 0 && (reasoning === null || reasoning === void 0 ? void 0 : reasoning.signature)
                                ? { reasoningSignature: reasoning.signature }
                                : {})), (index === 0 && (reasoning === null || reasoning === void 0 ? void 0 : reasoning.redacted)
                                ? { reasoningRedacted: true }
                                : {})), (index === 0 && ((_k = reasoning === null || reasoning === void 0 ? void 0 : reasoning.blocks) === null || _k === void 0 ? void 0 : _k.length)
                                ? { reasoningBlocks: reasoning.blocks }
                                : {})), (index === 0 && ((_l = reasoning === null || reasoning === void 0 ? void 0 : reasoning.parts) === null || _l === void 0 ? void 0 : _l.length)
                                ? { contentParts: reasoning.parts }
                                : {})), (index === 0 && (reasoning === null || reasoning === void 0 ? void 0 : reasoning.providerMetadata)
                                ? { providerMetadata: reasoning.providerMetadata }
                                : {})), (index === 0 && (reasoning === null || reasoning === void 0 ? void 0 : reasoning.textSignature)
                                ? { textSignature: reasoning.textSignature }
                                : {})));
                        }
                        _e = 0, effectiveCalls_1 = effectiveCalls;
                        _o.label = 1;
                    case 1:
                        if (!(_e < effectiveCalls_1.length)) return [3 /*break*/, 4];
                        call = effectiveCalls_1[_e];
                        if (!call.name.trim()) {
                            reason = "provider emitted a tool call without a name; check OpenAI-compatible streaming format";
                            publish({
                                type: "diagnostic",
                                level: "warning",
                                message: reason,
                            });
                            publish({
                                type: "tool.update",
                                id: "".concat(turnID, ":").concat(call.id),
                                name: "invalid_tool_call",
                                callID: call.id,
                                status: "failed",
                                summary: reason,
                                result: reason,
                                endedAt: Date.now(),
                            });
                            publishWorkGraphToolCall(turnID, call.id, "invalid_tool_call", "failed");
                            messages.push({
                                role: "tool",
                                toolCallID: call.id,
                                toolName: "invalid_tool_call",
                                content: toolResultContent("ERROR: ".concat(reason), call.id, undefined),
                            });
                            execContext.add({
                                id: "".concat(turnID, ":").concat(call.id, ":result"),
                                role: "tool_result",
                                content: "ERROR: ".concat(reason),
                                pairID: call.id,
                            });
                            return [3 /*break*/, 3];
                        }
                        resolved = materialized.resolve(call.name);
                        if (resolved.status !== "ready") {
                            reason = resolved.error;
                            registered = tools.get(call.name);
                            if (registered &&
                                (!isToolAllowed(call.name, exec) ||
                                    ((exec === null || exec === void 0 ? void 0 : exec.permissionMode) === "read_only" &&
                                        registered.requiresApproval)))
                                publish({
                                    type: "policy.decision",
                                    turnID: turnID,
                                    toolName: call.name,
                                    toolCallID: call.id,
                                    decision: "deny",
                                    reason: (exec === null || exec === void 0 ? void 0 : exec.permissionMode) === "read_only" &&
                                        registered.requiresApproval
                                        ? (0, runtime_services_1.readOnlyToolMessage)(call.name)
                                        : ((_m = extensionToolPermission(call.name, exec === null || exec === void 0 ? void 0 : exec.permissionProfile)
                                            .diagnostics[0]) !== null && _m !== void 0 ? _m : "tool is excluded from the runtime catalog by policy"),
                                });
                            publish({
                                type: "tool.update",
                                id: "".concat(turnID, ":").concat(call.id),
                                name: call.name,
                                callID: call.id,
                                status: "failed",
                                summary: reason,
                                result: reason,
                                endedAt: Date.now(),
                            });
                            publishWorkGraphToolCall(turnID, call.id, call.name, registered && (exec === null || exec === void 0 ? void 0 : exec.permissionMode) === "read_only"
                                ? "rejected"
                                : "failed");
                            messages.push({
                                role: "tool",
                                toolCallID: call.id,
                                toolName: call.name,
                                content: toolResultContent("ERROR: ".concat(reason), call.id, undefined),
                            });
                            execContext.add({
                                id: "".concat(turnID, ":").concat(call.id, ":result"),
                                role: "tool_result",
                                content: "ERROR: ".concat(reason),
                                pairID: call.id,
                            });
                            return [3 /*break*/, 3];
                        }
                        return [4 /*yield*/, executeOneTool(turnID, call, resolved.tool, attachImage)];
                    case 2:
                        result = _o.sent();
                        messages.push({
                            role: "tool",
                            toolCallID: call.id,
                            toolName: call.name,
                            content: toolResultContent(result, call.id, undefined),
                        });
                        execContext.add({
                            id: "".concat(turnID, ":").concat(call.id, ":result"),
                            role: "tool_result",
                            content: result,
                            pairID: call.id,
                        });
                        _o.label = 3;
                    case 3:
                        _e++;
                        return [3 /*break*/, 1];
                    case 4:
                        if (pendingImages.length)
                            messages.push({
                                role: "user",
                                content: "Rendered page images are attached as the result of the preceding tool call. Read every image in attachment order. A visual attachment means vision was explicitly requested; it does not by itself prove the page is scanned. Do not claim that local OCR was used.",
                                images: pendingImages,
                            });
                        return [2 /*return*/, messages];
                }
            });
        });
    }
}
