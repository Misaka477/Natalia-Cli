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
exports.createExecuteOne = createExecuteOne;
/**
 * Single tool call execution — runtime/tool-execution/execute-one.ts.
 *
 * `executeOneTool` runs one provider tool call through the reorderable policy
 * pipeline: the tool-layer preExecute, read-only and constitution pre stages,
 * then the execute stage (approval + execution, split into
 * `execute-run.ts`), then the postExecute-on-success post stage. Reads host
 * state through `RuntimeContext` at call time.
 */
var runtime_services_1 = require("@natalia/runtime-services");
var tool_policy_1 = require("@natalia/tool-policy");
var runtime_services_2 = require("@natalia/runtime-services");
var execute_run_1 = require("./execute-run");
var repeat_guard_1 = require("./repeat-guard");
var WAITING_TOOLS = new Set(["terminal_observe"]);
function createExecuteOne(ctx, options) {
    return {
        executeOneTool: executeOneTool,
    };
    function executeOneTool(turnID, call, tool, attachImage) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getSessionID, publishForSession, publishWorkGraphToolCall, checkConstitutionForTool, createToolPolicyLayer, tryParseToolArguments, _b, executionBySession, turnSession, toolCalls, sessionID, exec, toolLayer, toolPolicy, terminal, publish, toolID, dedupKey, sessionToolCalls, repeat, message, hookEvent, pipeline, run, error_1;
            var _this = this;
            var _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _a = ctx.ports, getSessionID = _a.getSessionID, publishForSession = _a.publishForSession, publishWorkGraphToolCall = _a.publishWorkGraphToolCall, checkConstitutionForTool = _a.checkConstitutionForTool, createToolPolicyLayer = _a.createToolPolicyLayer, tryParseToolArguments = _a.tryParseToolArguments;
                        _b = ctx.state, executionBySession = _b.executionBySession, turnSession = _b.turnSession, toolCalls = _b.toolCalls;
                        sessionID = getSessionID();
                        exec = executionBySession.get((_c = turnSession.get(turnID)) !== null && _c !== void 0 ? _c : sessionID);
                        if (!exec)
                            throw new Error("no execution state for turn ".concat(turnID));
                        toolLayer = createToolPolicyLayer(exec);
                        toolPolicy = ctx.state.serviceDirectory.get(tool_policy_1.toolPolicy);
                        if (!toolPolicy)
                            throw new Error("tool pipeline unavailable (natalia-tool-pipeline)");
                        terminal = ctx.state.serviceDirectory.getOptional(runtime_services_2.terminalController);
                        publish = function (event) { return publishForSession(exec, event); };
                        toolID = "".concat(turnID, ":").concat(call.id);
                        dedupKey = (0, repeat_guard_1.repeatKey)(tool.name, call.arguments, ctx.ports.getWorkspaceRoot());
                        sessionToolCalls = (_d = exec === null || exec === void 0 ? void 0 : exec.toolCalls) !== null && _d !== void 0 ? _d : toolCalls;
                        repeat = (0, repeat_guard_1.recordRepeat)(sessionToolCalls, dedupKey);
                        if (repeat.blocked && !WAITING_TOOLS.has(tool.name)) {
                            message = "blocked repeated tool call after ".concat(repeat.count, " identical attempts within ").concat(Math.round(repeat_guard_1.REPEAT_WINDOW_MS / 1000), "s (max ").concat(repeat_guard_1.REPEAT_MAX, "): ").concat(tool.name);
                            publish({
                                type: "tool.update",
                                id: toolID,
                                name: tool.name,
                                callID: call.id,
                                status: "failed",
                                summary: message,
                                result: message,
                                endedAt: Date.now(),
                            });
                            publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
                            return [2 /*return*/, "ERROR: ".concat(message)];
                        }
                        hookEvent = {
                            turnID: turnID,
                            toolName: tool.name,
                            toolCallID: call.id,
                            arguments: call.arguments,
                        };
                        pipeline = toolPolicy
                            .createExecutionPipeline()
                            .preStage(function () { return __awaiter(_this, void 0, void 0, function () {
                            var preResult, _i, _a, diagnostic, terminalID, error_2, reason;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, toolLayer.preExecute(hookEvent)];
                                    case 1:
                                        preResult = _b.sent();
                                        for (_i = 0, _a = preResult.diagnostics; _i < _a.length; _i++) {
                                            diagnostic = _a[_i];
                                            publishForSession(exec, {
                                                type: "diagnostic",
                                                level: "info",
                                                message: diagnostic,
                                            });
                                        }
                                        if (preResult.allowed)
                                            return [2 /*return*/, { decision: "allow" }];
                                        if (!preResult.clearTerminal) return [3 /*break*/, 5];
                                        terminalID = tryParseToolArguments(call.arguments).id;
                                        if (!(typeof terminalID === "string")) return [3 /*break*/, 5];
                                        _b.label = 2;
                                    case 2:
                                        _b.trys.push([2, 4, , 5]);
                                        return [4 /*yield*/, (terminal === null || terminal === void 0 ? void 0 : terminal.write(terminalID, "\x15"))];
                                    case 3:
                                        _b.sent();
                                        publish({
                                            type: "diagnostic",
                                            level: "warning",
                                            message: "cleared blocked terminal command buffer for ".concat(terminalID),
                                        });
                                        return [3 /*break*/, 5];
                                    case 4:
                                        error_2 = _b.sent();
                                        publish({
                                            type: "diagnostic",
                                            level: "warning",
                                            message: "could not clear blocked terminal command buffer for ".concat(terminalID, ": ").concat(error_2 instanceof Error ? error_2.message : String(error_2)),
                                        });
                                        return [3 /*break*/, 5];
                                    case 5:
                                        reason = preResult.diagnostics.join("; ");
                                        publish({
                                            type: "policy.decision",
                                            turnID: turnID,
                                            toolName: tool.name,
                                            toolCallID: call.id,
                                            decision: "deny",
                                            reason: reason,
                                        });
                                        publish({
                                            type: "tool.update",
                                            id: toolID,
                                            name: tool.name,
                                            callID: call.id,
                                            status: "failed",
                                            summary: reason,
                                            result: reason,
                                            endedAt: Date.now(),
                                        });
                                        publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
                                        return [2 /*return*/, { decision: "deny", reason: reason }];
                                }
                            });
                        }); })
                            .preStage(function () {
                            if (!((exec === null || exec === void 0 ? void 0 : exec.permissionMode) === "read_only" && tool.requiresApproval))
                                return { decision: "allow" };
                            var message = (0, runtime_services_1.readOnlyToolMessage)(tool.name);
                            publish({
                                type: "policy.decision",
                                turnID: turnID,
                                toolName: tool.name,
                                toolCallID: call.id,
                                decision: "deny",
                                reason: message,
                            });
                            publish({
                                type: "tool.update",
                                id: toolID,
                                name: tool.name,
                                callID: call.id,
                                status: "rejected",
                                summary: message,
                                result: message,
                                endedAt: Date.now(),
                            });
                            publishWorkGraphToolCall(turnID, call.id, tool.name, "rejected");
                            return { decision: "deny", reason: message };
                        })
                            .preStage(function () { return __awaiter(_this, void 0, void 0, function () {
                            var blocked;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, checkConstitutionForTool(turnID, call.id, tool.name, tool.name, 
                                        // `apply_edits` reports the whole-workspace scope `"."` because it can
                                        // touch many files; `write_file`/`edit_file` report their single path.
                                        // Anything else has no path scope and falls through to "global".
                                        (_a = toolPolicy.workspaceWritePathForTool(tool.name, tryParseToolArguments(call.arguments))) !== null && _a !== void 0 ? _a : "global", toolPolicy.commandTextForTool(tool.name, tryParseToolArguments(call.arguments)))];
                                    case 1:
                                        blocked = _b.sent();
                                        if (!blocked)
                                            return [2 /*return*/, { decision: "allow" }];
                                        publish(__assign({ type: "tool.update", id: toolID, name: tool.name, callID: call.id, status: "failed", summary: blocked, argumentsDelta: call.arguments }, (call.thoughtSignature
                                            ? { thoughtSignature: call.thoughtSignature }
                                            : {})));
                                        publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
                                        return [2 /*return*/, { decision: "deny", reason: blocked }];
                                }
                            });
                        }); })
                            .execute(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, execute_run_1.runExecuteStage)({
                                            exec: exec,
                                            publish: publish,
                                            toolID: toolID,
                                            tool: tool,
                                            call: call,
                                            turnID: turnID,
                                            attachImage: attachImage,
                                            ctx: ctx,
                                            options: options,
                                            sessionID: sessionID,
                                            workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                        })];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); })
                            .postStage(function (_input, content) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: 
                                    // postExecute-on-success is the post waterfall's accept stage; the
                                    // error-reporting postExecute calls stay in the execute stage where
                                    // they already fire.
                                    return [4 /*yield*/, toolLayer.postExecute(__assign(__assign({}, hookEvent), { result: content }))];
                                    case 1:
                                        // postExecute-on-success is the post waterfall's accept stage; the
                                        // error-reporting postExecute calls stay in the execute stage where
                                        // they already fire.
                                        _a.sent();
                                        return [2 /*return*/, { decision: "accept" }];
                                }
                            });
                        }); });
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, pipeline.run({
                                name: tool.name,
                                args: tryParseToolArguments(call.arguments),
                                context: { workspaceRoot: ctx.ports.getWorkspaceRoot() },
                            })];
                    case 2:
                        run = _g.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _g.sent();
                        // The execute stage throws on refusal and on failure after publishing
                        // its own events; the caller turns the reason into the model-visible
                        // result. A cancellation is not a failure: it propagates so the turn
                        // coordinator settles the turn as cancelled.
                        if ((_e = exec === null || exec === void 0 ? void 0 : exec.activeAbort) === null || _e === void 0 ? void 0 : _e.signal.aborted)
                            throw error_1;
                        return [2 /*return*/, "ERROR: ".concat(error_1 instanceof Error ? error_1.message : String(error_1))];
                    case 4:
                        if (run.status === "denied")
                            return [2 /*return*/, "ERROR: ".concat(run.reason)];
                        if (run.status === "asking")
                            return [2 /*return*/, "ERROR: ".concat((_f = run.decision.reason) !== null && _f !== void 0 ? _f : "approval required")];
                        if (run.status === "blocked")
                            return [2 /*return*/, "ERROR: ".concat(run.feedback)];
                        (0, repeat_guard_1.clearRepeat)(sessionToolCalls, dedupKey);
                        return [2 /*return*/, run.result.content];
                }
            });
        });
    }
}
