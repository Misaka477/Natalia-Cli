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
exports.createSubagentTools = createSubagentTools;
var runtime_services_1 = require("@natalia/runtime-services");
var runtime_1 = require("./runtime");
var repeat_guard_1 = require("../tool-execution/repeat-guard");
function createSubagentTools(ctx, _options, support) {
    return __awaiter(this, void 0, void 0, function () {
        function executeSubagentToolCall(input) {
            return __awaiter(this, void 0, void 0, function () {
                var call, runner, displayCallID, toolID, tool, message, dedupKey, repeat, message, hookEvent, preResult, refusal, parsed, paramErrors, parentSessionID, startedAt, completeResult, finalizedResult, result, projectedRender, error_1, message;
                var _this = this;
                var _a, _b, _c, _d, _e, _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0:
                            call = input.call, runner = input.runner;
                            displayCallID = "step:".concat(input.step, ":").concat(call.id);
                            toolID = "".concat(subagentTurnID(runner), ":").concat(displayCallID);
                            tool = input.visibleTools.find(function (candidate) { return candidate.name === call.name; });
                            if (!tool) {
                                message = "subagent requested unavailable or denied tool: ".concat(call.name || "<missing name>");
                                publishSubagentEvent(runner, {
                                    type: "tool.update",
                                    id: toolID,
                                    name: call.name || "invalid_tool_call",
                                    callID: displayCallID,
                                    status: "failed",
                                    summary: message,
                                    argumentsDelta: call.arguments,
                                    result: message,
                                    endedAt: Date.now(),
                                });
                                return [2 /*return*/, "ERROR: ".concat(message)];
                            }
                            dedupKey = (0, repeat_guard_1.repeatKey)(tool.name, call.arguments, input.childWorkspaceRoot);
                            repeat = (0, repeat_guard_1.recordRepeat)(input.repeatedCalls, dedupKey);
                            if (repeat.blocked && !scope.WAITING_TOOLS.has(tool.name)) {
                                message = "blocked repeated tool call after ".concat(repeat.count, " identical attempts within ").concat(Math.round(repeat_guard_1.REPEAT_WINDOW_MS / 1000), "s (max ").concat(repeat_guard_1.REPEAT_MAX, "): ").concat(tool.name);
                                publishSubagentEvent(runner, {
                                    type: "tool.update",
                                    id: toolID,
                                    name: tool.name,
                                    callID: displayCallID,
                                    status: "failed",
                                    summary: message,
                                    argumentsDelta: call.arguments,
                                    result: message,
                                    endedAt: Date.now(),
                                });
                                return [2 /*return*/, "ERROR: ".concat(message)];
                            }
                            hookEvent = {
                                turnID: subagentTurnID(runner),
                                toolName: tool.name,
                                toolCallID: call.id,
                                arguments: call.arguments,
                            };
                            _j.label = 1;
                        case 1:
                            _j.trys.push([1, 7, , 9]);
                            publishSubagentEvent(runner, {
                                type: "tool.update",
                                id: toolID,
                                name: tool.name,
                                callID: displayCallID,
                                status: tool.requiresApproval ? "awaiting_approval" : "queued",
                                summary: tool.requiresApproval ? "awaiting approval" : "queued",
                                argumentsDelta: call.arguments,
                            });
                            return [4 /*yield*/, scope
                                    .createToolPolicyLayer(input.exec)
                                    .preExecute(hookEvent)];
                        case 2:
                            preResult = _j.sent();
                            if (!preResult.allowed)
                                throw new Error("subagent tool denied by policy: ".concat(preResult.diagnostics.join("; ")));
                            if (input.exec.permissionMode === "read_only" && tool.requiresApproval)
                                throw new Error(scope.readOnlyToolMessage(tool.name));
                            if (!tool.requiresApproval) return [3 /*break*/, 4];
                            return [4 /*yield*/, scope.interactive.requireApproval(toolID, tool, call, hookEvent.turnID)];
                        case 3:
                            refusal = _j.sent();
                            if (refusal)
                                throw new Error(refusal.reason);
                            _j.label = 4;
                        case 4:
                            parsed = scope.parseToolArguments(call.arguments);
                            paramErrors = scope.validateToolParameters(tool.parameters, parsed);
                            if (paramErrors.length)
                                throw new Error("tool \"".concat(tool.name, "\" parameter validation failed: ").concat(paramErrors.map(function (error) { return "".concat(error.path, ": ").concat(error.message); }).join("; ")));
                            parentSessionID = (_a = subagents === null || subagents === void 0 ? void 0 : subagents.get(runner.agentId)) === null || _a === void 0 ? void 0 : _a.parentSessionID;
                            startedAt = Date.now();
                            publishSubagentEvent(runner, {
                                type: "tool.update",
                                id: toolID,
                                name: tool.name,
                                callID: displayCallID,
                                status: "running",
                                summary: "running",
                                startedAt: startedAt,
                                metadata: ((_b = tool.output) === null || _b === void 0 ? void 0 : _b.presentCall)
                                    ? { call: tool.output.presentCall(parsed) }
                                    : undefined,
                            });
                            return [4 /*yield*/, tool.execute(parsed, __assign(__assign(__assign(__assign({ workspaceRoot: input.childWorkspaceRoot, signal: runner.signal, sessionID: input.exec.session.id, askQuestion: function (question) { return __awaiter(_this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0: return [4 /*yield*/, scope.interactive.requireQuestion("".concat(toolID, ":question"), hookEvent.turnID, question)];
                                                case 1: return [2 /*return*/, _a.sent()];
                                            }
                                        });
                                    }); }, subagents: subagents !== null && subagents !== void 0 ? subagents : undefined, terminal: terminal !== null && terminal !== void 0 ? terminal : undefined }, (input.exposeSandboxes ? { sandboxes: sandbox !== null && sandbox !== void 0 ? sandbox : undefined } : {})), { workspaceReadAuthorize: function (request) {
                                        return scope.authorizeWorkspaceRead(request, input.exec);
                                    } }), (input.writeAuthorize
                                    ? { workspaceWriteAuthorize: input.writeAuthorize }
                                    : {})), { sandboxMergeAuthorize: function (request) {
                                        return scope.authorizeSandboxMerge(request, input.exec);
                                    }, settings: scope.toolSettings(input.exec), parentSessionID: parentSessionID !== null && parentSessionID !== void 0 ? parentSessionID : input.exec.session.id, parentAgentID: runner.agentId, maxSubagentDepth: (_c = scope.tsRuntimeConfig) === null || _c === void 0 ? void 0 : _c.runtime.subagentDepth }))];
                        case 5:
                            completeResult = _j.sent();
                            finalizedResult = (_f = (_e = (_d = tool.output) === null || _d === void 0 ? void 0 : _d.finalizeContent) === null || _e === void 0 ? void 0 : _e.call(_d, completeResult)) !== null && _f !== void 0 ? _f : completeResult;
                            result = scope.redactToolOutput(finalizedResult, scope.redactToolOutputEnabled(input.exec));
                            projectedRender = (_h = (_g = tool.output) === null || _g === void 0 ? void 0 : _g.presentResult) === null || _h === void 0 ? void 0 : _h.call(_g, parsed, result);
                            return [4 /*yield*/, scope
                                    .createToolPolicyLayer(input.exec)
                                    .postExecute(__assign(__assign({}, hookEvent), { result: result }))];
                        case 6:
                            _j.sent();
                            (0, repeat_guard_1.clearRepeat)(input.repeatedCalls, dedupKey);
                            publishSubagentEvent(runner, {
                                type: "tool.update",
                                id: toolID,
                                name: tool.name,
                                callID: displayCallID,
                                status: "succeeded",
                                summary: result.slice(0, 200),
                                result: result,
                                metadata: projectedRender ? { render: projectedRender } : undefined,
                                endedAt: Date.now(),
                            });
                            runner.log("tool ".concat(tool.name, ": ").concat(result.slice(0, 240)));
                            return [2 /*return*/, result];
                        case 7:
                            error_1 = _j.sent();
                            if (runner.signal.aborted)
                                throw error_1;
                            message = error_1 instanceof Error ? error_1.message : String(error_1);
                            return [4 /*yield*/, scope
                                    .createToolPolicyLayer(input.exec)
                                    .postExecute(__assign(__assign({}, hookEvent), { error: message }))];
                        case 8:
                            _j.sent();
                            publishSubagentEvent(runner, {
                                type: "tool.update",
                                id: toolID,
                                name: call.name || "invalid_tool_call",
                                callID: call.id,
                                status: "failed",
                                summary: message,
                                result: message,
                                endedAt: Date.now(),
                            });
                            runner.log("tool ".concat(tool.name, ": ERROR: ").concat(message.slice(0, 240)));
                            return [2 /*return*/, "ERROR: ".concat(message)];
                        case 9: return [2 /*return*/];
                    }
                });
            });
        }
        var scope, subagents, terminal, sandbox, publishSubagentEvent, subagentTurnID;
        return __generator(this, function (_a) {
            scope = (0, runtime_1.createInitializeRuntime)(ctx);
            subagents = scope.serviceDirectory.getOptional(runtime_services_1.subagentsService);
            terminal = scope.serviceDirectory.getOptional(runtime_services_1.terminalController);
            sandbox = scope.serviceDirectory.getOptional(runtime_services_1.sandboxService);
            publishSubagentEvent = support.publishSubagentEvent, subagentTurnID = support.subagentTurnID;
            return [2 /*return*/, { executeSubagentToolCall: executeSubagentToolCall }];
        });
    });
}
