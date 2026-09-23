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
exports.runExecuteStage = runExecuteStage;
var tools_1 = require("@anthelia/tools");
var work_ledger_1 = require("@natalia/work-ledger");
var tool_policy_1 = require("@natalia/tool-policy");
var workspace_1 = require("@anthelia/workspace");
var execute_context_1 = require("./execute-context");
var collab_1 = require("@natalia/collab");
var rina_1 = require("@natalia/rina");
var read_cache_1 = require("./read-cache");
function runExecuteStage(input) {
    return __awaiter(this, void 0, void 0, function () {
        var exec, publish, toolID, tool, call, turnID, attachImage, ctx, sessionID, workspaceRoot, _a, publishWorkGraphToolCall, waitIfPaused, setInFlightOperationFor, getTerminalCommandBuffer, setEndTurnWaitingHuman, getInteractive, scheduleRuntimeStatusSnapshot, toolLayer, toolPolicy, writeLock, terminalCommandBuffer, interactive, mutationRegistry, workLedgerController, redactToolOutput, redactToolOutputEnabled, waitForToolExecution, boundToolOutput, isManagedResourceTool, tryParseToolArguments, parseToolArguments, validateToolParameters, parsedForApproval, commandTextForApproval, forcedApproval, approvalRequired, refusal, executionAudited, releaseWriteLock, parsed_1, paramErrors, detail, parsedRecord, requestedTimeoutSec, effectiveTimeoutSec_1, executionController_1, cancelExecution_1, execSignal, timeoutTimer_1, signal_1, writePathForLock, _b, checkpointPath, command, checkpointController, created, workLedger, activePlan, error_1, writePath, rina_2, completeResult, outputErrors, finalizedContent, bounded, result, projectedRender, terminalID, changedPath, requestArgs, marker, error_2, message;
        var _c, _d, _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    exec = input.exec, publish = input.publish, toolID = input.toolID, tool = input.tool, call = input.call, turnID = input.turnID, attachImage = input.attachImage, ctx = input.ctx, sessionID = input.sessionID, workspaceRoot = input.workspaceRoot;
                    _a = ctx.ports, publishWorkGraphToolCall = _a.publishWorkGraphToolCall, waitIfPaused = _a.waitIfPaused, setInFlightOperationFor = _a.setInFlightOperationFor, getTerminalCommandBuffer = _a.getTerminalCommandBuffer, setEndTurnWaitingHuman = _a.setEndTurnWaitingHuman, getInteractive = _a.getInteractive, scheduleRuntimeStatusSnapshot = _a.scheduleRuntimeStatusSnapshot;
                    toolLayer = ctx.ports.createToolPolicyLayer(exec);
                    toolPolicy = ctx.state.serviceDirectory.get(tool_policy_1.toolPolicy);
                    if (!toolPolicy)
                        throw new Error("tool pipeline unavailable (natalia-tool-pipeline)");
                    writeLock = ctx.state.serviceDirectory.get(workspace_1.workspaceWriteLock);
                    terminalCommandBuffer = getTerminalCommandBuffer();
                    interactive = getInteractive();
                    mutationRegistry = ctx.state.serviceDirectory.getOptional(workspace_1.workspaceMutations);
                    workLedgerController = ctx.state.serviceDirectory.get(work_ledger_1.workLedgerController);
                    redactToolOutput = ctx.ports.redactToolOutput;
                    redactToolOutputEnabled = ctx.ports.redactToolOutputEnabled;
                    waitForToolExecution = ctx.ports.waitForToolExecution;
                    boundToolOutput = ctx.ports.boundToolOutput;
                    isManagedResourceTool = ctx.ports.isManagedResourceTool;
                    tryParseToolArguments = ctx.ports.tryParseToolArguments;
                    parseToolArguments = ctx.ports.parseToolArguments;
                    validateToolParameters = ctx.ports.validateToolParameters;
                    parsedForApproval = tryParseToolArguments(call.arguments);
                    commandTextForApproval = toolPolicy.commandTextForTool(tool.name, (typeof parsedForApproval === "object" && parsedForApproval !== null
                        ? parsedForApproval
                        : {}));
                    return [4 /*yield*/, (0, tools_1.requiresForcedGitApprovalAst)(commandTextForApproval)];
                case 1:
                    forcedApproval = _l.sent();
                    approvalRequired = tool.requiresApproval || Boolean(forcedApproval);
                    publish(__assign({ type: "tool.update", id: toolID, name: tool.name, callID: call.id, status: approvalRequired ? "awaiting_approval" : "queued", summary: approvalRequired ? "awaiting approval" : "queued", argumentsDelta: call.arguments }, (call.thoughtSignature
                        ? { thoughtSignature: call.thoughtSignature }
                        : {})));
                    publish({
                        type: "policy.decision",
                        turnID: turnID,
                        toolName: tool.name,
                        toolCallID: call.id,
                        decision: approvalRequired ? "approval_required" : "allow",
                    });
                    if (!approvalRequired) return [3 /*break*/, 4];
                    return [4 /*yield*/, interactive.requireApproval(toolID, tool, call, turnID, forcedApproval
                            ? { force: true, reason: forcedApproval.reason }
                            : undefined)];
                case 2:
                    refusal = _l.sent();
                    if (!refusal) return [3 /*break*/, 4];
                    // Reported like a policy denial: the call did not run, the turn keeps
                    // going, and the model receives the reason as this call's result.
                    publish(__assign(__assign({ type: "tool.update", id: toolID, name: tool.name, callID: call.id, status: "rejected", summary: refusal.reason, result: refusal.reason, argumentsDelta: call.arguments }, (call.thoughtSignature
                        ? { thoughtSignature: call.thoughtSignature }
                        : {})), { endedAt: Date.now() }));
                    publishWorkGraphToolCall(turnID, call.id, tool.name, "rejected");
                    return [4 /*yield*/, toolLayer.postExecute(__assign({
                            turnID: turnID,
                            toolName: tool.name,
                            toolCallID: call.id,
                            arguments: call.arguments,
                        }, { error: refusal.reason }))];
                case 3:
                    _l.sent();
                    throw new Error(refusal.reason);
                case 4: return [4 /*yield*/, waitIfPaused(exec)];
                case 5:
                    _l.sent();
                    publish({
                        type: "tool.update",
                        id: toolID,
                        name: tool.name,
                        callID: call.id,
                        status: "running",
                        summary: "running",
                        startedAt: Date.now(),
                        metadata: ((_c = tool.output) === null || _c === void 0 ? void 0 : _c.presentCall)
                            ? {
                                call: tool.output.presentCall(tryParseToolArguments(call.arguments)),
                            }
                            : undefined,
                    });
                    executionAudited = false;
                    _l.label = 6;
                case 6:
                    _l.trys.push([6, 19, 21, 24]);
                    parsed_1 = parseToolArguments(call.arguments);
                    paramErrors = validateToolParameters(tool.parameters, parsed_1);
                    if (paramErrors.length) {
                        detail = paramErrors
                            .map(function (e) { return "".concat(e.path, ": ").concat(e.message); })
                            .join("; ");
                        throw new Error("tool \"".concat(tool.name, "\" parameter validation failed: ").concat(detail));
                    }
                    parsedRecord = parsed_1 && typeof parsed_1 === "object"
                        ? parsed_1
                        : {};
                    requestedTimeoutSec = parsedRecord.timeoutSec;
                    effectiveTimeoutSec_1 = tool.timeoutSec !== undefined && tool.maxTimeoutSec !== undefined
                        ? (0, tools_1.timeoutSecOr)(requestedTimeoutSec, tool.timeoutSec, tool.maxTimeoutSec)
                        : tool.timeoutSec;
                    if (!exec)
                        throw new Error("session execution state unavailable");
                    return [4 /*yield*/, setInFlightOperationFor(exec, {
                            kind: "tool_execution",
                            turnID: turnID,
                            toolName: tool.name,
                            toolCallID: call.id,
                            startedAt: new Date().toISOString(),
                        })];
                case 7:
                    _l.sent();
                    executionAudited = true;
                    executionController_1 = new AbortController();
                    cancelExecution_1 = function () {
                        var _a, _b;
                        return executionController_1.abort((_b = (_a = exec === null || exec === void 0 ? void 0 : exec.activeAbort) === null || _a === void 0 ? void 0 : _a.signal.reason) !== null && _b !== void 0 ? _b : new Error("tool cancelled"));
                    };
                    execSignal = (_d = exec === null || exec === void 0 ? void 0 : exec.activeAbort) === null || _d === void 0 ? void 0 : _d.signal;
                    if (execSignal === null || execSignal === void 0 ? void 0 : execSignal.aborted)
                        cancelExecution_1();
                    else
                        execSignal === null || execSignal === void 0 ? void 0 : execSignal.addEventListener("abort", cancelExecution_1, { once: true });
                    timeoutTimer_1 = effectiveTimeoutSec_1
                        ? setTimeout(function () {
                            return executionController_1.abort(new Error("tool ".concat(tool.name, " timed out after ").concat(effectiveTimeoutSec_1, "s")));
                        }, effectiveTimeoutSec_1 * 1000)
                        : undefined;
                    signal_1 = executionController_1.signal;
                    writePathForLock = toolPolicy.workspaceWritePathForTool(tool.name, parsed_1);
                    if (!writePathForLock) return [3 /*break*/, 9];
                    return [4 /*yield*/, writeLock.acquire(exec.session.id, [writePathForLock])];
                case 8:
                    _b = _l.sent();
                    return [3 /*break*/, 10];
                case 9:
                    _b = undefined;
                    _l.label = 10;
                case 10:
                    releaseWriteLock = _b;
                    _l.label = 11;
                case 11:
                    _l.trys.push([11, 15, , 16]);
                    checkpointPath = toolPolicy.workspaceWritePathForTool(tool.name, parsed_1);
                    command = toolPolicy.commandTextForTool(tool.name, parsed_1);
                    if (!(exec && (checkpointPath || command))) return [3 /*break*/, 14];
                    return [4 /*yield*/, ctx.ports.initializeCheckpointController(exec)];
                case 12:
                    checkpointController = _l.sent();
                    if (!(checkpointController === null || checkpointController === void 0 ? void 0 : checkpointController.isEnabled())) return [3 /*break*/, 14];
                    return [4 /*yield*/, checkpointController.createCheckpoint({
                            reason: "pre_tool",
                            context: exec.context,
                            step: exec.context.journalStatus().messageCount,
                            turnID: turnID,
                            stepID: toolID,
                            model: (_e = exec.provider) === null || _e === void 0 ? void 0 : _e.model,
                            status: tool.name,
                        })];
                case 13:
                    created = _l.sent();
                    // B7: the checkpoint carries its plan provenance so the Work Graph
                    // can answer "which plan's commitment does this rollback point
                    // belong to". Best-effort — a failed node never blocks the side
                    // effect.
                    try {
                        workLedger = ctx.ports.resolveService(work_ledger_1.workLedgerController.id);
                        activePlan = (0, collab_1.activePlanForExec)(ctx, exec);
                        if (workLedger && created && activePlan)
                            ctx.ports.publishForSession(exec, workLedger.checkpointNode({
                                checkpointID: created.id,
                                planID: activePlan.planID,
                                sessionID: exec.session.id,
                                turnID: turnID,
                                reason: "pre_tool",
                            }));
                    }
                    catch (_m) {
                        // pre-tool status publish is best-effort
                    }
                    _l.label = 14;
                case 14: return [3 /*break*/, 16];
                case 15:
                    error_1 = _l.sent();
                    ctx.ports.publishForSession(exec, {
                        type: "diagnostic",
                        level: "warning",
                        message: "pre-tool checkpoint failed for ".concat(tool.name, ": ").concat(error_1 instanceof Error ? error_1.message : String(error_1)),
                    });
                    return [3 /*break*/, 16];
                case 16:
                    writePath = toolPolicy.workspaceWritePathForTool(tool.name, parsed_1);
                    if (writePath) {
                        mutationRegistry === null || mutationRegistry === void 0 ? void 0 : mutationRegistry.register({
                            sessionID: exec.session.id,
                            turnID: turnID,
                            callID: call.id,
                            toolName: tool.name,
                            authorizedPaths: [writePath],
                            expectedOperations: ["modified", "added", "deleted", "renamed"],
                        });
                    }
                    rina_2 = ctx.state.serviceDirectory.getOptional(rina_1.rinaCache);
                    return [4 /*yield*/, waitForToolExecution((0, read_cache_1.executeWithReadCache)({
                            fabric: rina_2,
                            toolName: tool.name,
                            parsed: parsed_1,
                            execute: function () {
                                return tool.execute(parsed_1, (0, execute_context_1.buildToolExecutionContext)({
                                    exec: exec,
                                    publish: publish,
                                    toolID: toolID,
                                    tool: tool,
                                    call: call,
                                    turnID: turnID,
                                    attachImage: attachImage,
                                    ctx: ctx,
                                    sessionID: sessionID,
                                    workspaceRoot: workspaceRoot,
                                    signal: signal_1,
                                    timeoutSec: effectiveTimeoutSec_1,
                                    parsed: parsed_1,
                                }));
                            },
                        }), signal_1).finally(function () {
                            var _a;
                            if (timeoutTimer_1)
                                clearTimeout(timeoutTimer_1);
                            (_a = exec === null || exec === void 0 ? void 0 : exec.activeAbort) === null || _a === void 0 ? void 0 : _a.signal.removeEventListener("abort", cancelExecution_1);
                            // An opaque workspace writer just finished — or failed after writing
                            // — so tree-scoped results (glob/grep listings) can no longer be
                            // trusted: the study's invalidate-on-write for the writer the
                            // mutation declarations cannot see into.
                            if (rina_1.OPAQUE_WORKSPACE_WRITERS.has(tool.name))
                                rina_2 === null || rina_2 === void 0 ? void 0 : rina_2.markTreeChanged();
                        })];
                case 17:
                    completeResult = _l.sent();
                    outputErrors = tool.output
                        ? (0, tools_1.validateToolOutput)(tool.output.schema, completeResult)
                        : [];
                    if (outputErrors.length > 0) {
                        throw new Error("tool \"".concat(tool.name, "\" returned output that does not match its ") +
                            "declared schema: ".concat(outputErrors
                                .map(function (error) { return "".concat(error.path, ": ").concat(error.message); })
                                .join("; ")));
                    }
                    finalizedContent = (_h = (_g = (_f = tool.output) === null || _f === void 0 ? void 0 : _f.finalizeContent) === null || _g === void 0 ? void 0 : _g.call(_f, completeResult)) !== null && _h !== void 0 ? _h : completeResult;
                    return [4 /*yield*/, boundToolOutput(workspaceRoot, redactToolOutput(finalizedContent, redactToolOutputEnabled(exec)))];
                case 18:
                    bounded = _l.sent();
                    result = bounded.text;
                    projectedRender = (_k = (_j = tool.output) === null || _j === void 0 ? void 0 : _j.presentResult) === null || _k === void 0 ? void 0 : _k.call(_j, tryParseToolArguments(call.arguments), result);
                    if (tool.name === "interactive_terminal_start" ||
                        tool.name === "interactive_terminal_stop") {
                        terminalID = parsed_1.id;
                        if (typeof terminalID === "string")
                            terminalCommandBuffer.clear(terminalID);
                    }
                    publish(__assign(__assign({ type: "tool.update", id: toolID, name: tool.name, callID: call.id, status: "succeeded", summary: result.slice(0, 200), result: result, argumentsDelta: call.arguments }, (call.thoughtSignature
                        ? { thoughtSignature: call.thoughtSignature }
                        : {})), { metadata: __assign(__assign({}, (bounded.outputPath
                            ? __assign({ outputPath: bounded.outputPath }, (bounded.truncated
                                ? __assign(__assign({ truncated: true, page: bounded.page, totalPages: bounded.totalPages }, (bounded.nextPagePath
                                    ? { nextPagePath: bounded.nextPagePath }
                                    : {})), (bounded.totalBytes === undefined
                                    ? {}
                                    : { totalBytes: bounded.totalBytes })) : {})) : {})), (projectedRender ? { render: projectedRender } : {})), endedAt: Date.now() }));
                    publishWorkGraphToolCall(turnID, call.id, tool.name, "succeeded");
                    changedPath = toolPolicy.workspaceWritePathForTool(tool.name, tryParseToolArguments(call.arguments));
                    if (changedPath) {
                        publish(workLedgerController.workspaceChangeNode({
                            turnID: turnID,
                            path: changedPath,
                            toolName: tool.name,
                            sessionID: exec.session.id,
                        }));
                        publish(workLedgerController.workspaceChangeEdge({
                            turnID: turnID,
                            callID: call.id,
                            path: changedPath,
                        }));
                    }
                    if (isManagedResourceTool(tool.name))
                        scheduleRuntimeStatusSnapshot();
                    // TERM-M.3 (c): request_human with endTurn=true ends the current turn as
                    // waiting_human; the runtime resumes with a new turn once the human
                    // releases the pane.
                    if (tool.name === "interactive_terminal_request_human") {
                        requestArgs = tryParseToolArguments(call.arguments);
                        if ((requestArgs === null || requestArgs === void 0 ? void 0 : requestArgs.endTurn) === true &&
                            typeof requestArgs.id === "string" &&
                            typeof requestArgs.reason === "string") {
                            marker = {
                                terminalID: requestArgs.id,
                                reason: requestArgs.reason,
                            };
                            if (exec)
                                exec.endTurnWaitingHuman = marker;
                            else
                                setEndTurnWaitingHuman(marker);
                        }
                    }
                    return [2 /*return*/, result];
                case 19:
                    error_2 = _l.sent();
                    // WG4 Phase 3: a failed write did not change the workspace — drop the
                    // expected mutation so it cannot attribute a later unrelated hint.
                    if (toolPolicy.workspaceWritePathForTool(tool.name, tryParseToolArguments(call.arguments)))
                        mutationRegistry === null || mutationRegistry === void 0 ? void 0 : mutationRegistry.forget(call.id);
                    message = error_2 instanceof Error ? error_2.message : String(error_2);
                    publish(__assign(__assign({ type: "tool.update", id: toolID, name: tool.name, callID: call.id, status: "failed", summary: message, result: message, argumentsDelta: call.arguments }, (call.thoughtSignature
                        ? { thoughtSignature: call.thoughtSignature }
                        : {})), { endedAt: Date.now() }));
                    // A failed call is as much a fact as a successful one; the error text stays
                    // out of the graph.
                    publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
                    return [4 /*yield*/, toolLayer.postExecute(__assign({
                            turnID: turnID,
                            toolName: tool.name,
                            toolCallID: call.id,
                            arguments: call.arguments,
                        }, { error: message }))];
                case 20:
                    _l.sent();
                    throw new Error(message);
                case 21:
                    releaseWriteLock === null || releaseWriteLock === void 0 ? void 0 : releaseWriteLock();
                    if (!(executionAudited && exec)) return [3 /*break*/, 23];
                    return [4 /*yield*/, setInFlightOperationFor(exec, undefined)];
                case 22:
                    _l.sent();
                    _l.label = 23;
                case 23: return [7 /*endfinally*/];
                case 24: return [2 /*return*/];
            }
        });
    });
}
