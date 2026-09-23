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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
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
exports.createSubagentSupport = createSubagentSupport;
var runtime_1 = require("@natalia/runtime");
var runtime_2 = require("./runtime");
var retry_1 = require("@anthelia/retry");
var context_ledger_1 = require("@natalia/context-ledger");
var compaction_1 = require("@anthelia/compaction");
var runtime_services_1 = require("@natalia/runtime-services");
function createSubagentSupport(ctx, _options) {
    return __awaiter(this, void 0, void 0, function () {
        function acquireSandboxedSubagentSlot(signal) {
            return __awaiter(this, void 0, void 0, function () {
                var limit;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            limit = (_c = (_b = (_a = scope.tsRuntimeConfig) === null || _a === void 0 ? void 0 : _a.team) === null || _b === void 0 ? void 0 : _b.maxConcurrent) !== null && _c !== void 0 ? _c : 4;
                            if (signal.aborted)
                                throw new DOMException("subagent cancelled", "AbortError");
                            if (!(sandboxedSubagentActive >= limit)) return [3 /*break*/, 2];
                            return [4 /*yield*/, new Promise(function (resolve, reject) {
                                    var waiter = {
                                        signal: signal,
                                        resume: function () {
                                            signal.removeEventListener("abort", waiter.abort);
                                            // Transfer the released slot before waking the waiter so a new
                                            // spawn cannot steal it between promise resolution and resume.
                                            sandboxedSubagentActive++;
                                            resolve();
                                        },
                                        abort: function () {
                                            var index = sandboxedSubagentWaiters.indexOf(waiter);
                                            if (index >= 0)
                                                sandboxedSubagentWaiters.splice(index, 1);
                                            reject(new DOMException("subagent cancelled", "AbortError"));
                                        },
                                    };
                                    sandboxedSubagentWaiters.push(waiter);
                                    signal.addEventListener("abort", waiter.abort, { once: true });
                                    // Cover cancellation between the pre-wait check and listener setup.
                                    if (signal.aborted)
                                        waiter.abort();
                                })];
                        case 1:
                            _d.sent();
                            return [2 /*return*/];
                        case 2:
                            sandboxedSubagentActive++;
                            return [2 /*return*/];
                    }
                });
            });
        }
        function releaseSandboxedSubagentSlot() {
            sandboxedSubagentActive--;
            while (sandboxedSubagentWaiters.length) {
                var waiter = sandboxedSubagentWaiters.shift();
                if (waiter.signal.aborted)
                    continue;
                waiter.resume();
                break;
            }
        }
        function publishSubagentEvent(runner, event) {
            var _a;
            var parentSessionID = (_a = subagents === null || subagents === void 0 ? void 0 : subagents.get(runner.agentId)) === null || _a === void 0 ? void 0 : _a.parentSessionID;
            scope.publishForSession(parentSessionID
                ? scope.executionBySession.get(parentSessionID)
                : scope.activeExec, parentSessionID && event.sessionID === undefined
                ? __assign(__assign({}, event), { sessionID: parentSessionID, agentID: runner.agentId }) : __assign(__assign({}, event), { agentID: runner.agentId }));
        }
        function subagentTurnID(runner) {
            var _a, _b;
            var continuation = (_b = (_a = subagents === null || subagents === void 0 ? void 0 : subagents.get(runner.agentId)) === null || _a === void 0 ? void 0 : _a.continuation) !== null && _b !== void 0 ? _b : 0;
            return continuation
                ? "subagent:".concat(runner.agentId, ":continuation:").concat(continuation)
                : "subagent:".concat(runner.agentId);
        }
        function beginSubagentConversation(runner, task) {
            var _a;
            var id = subagentTurnID(runner);
            var parentSessionID = (_a = subagents === null || subagents === void 0 ? void 0 : subagents.get(runner.agentId)) === null || _a === void 0 ? void 0 : _a.parentSessionID;
            if (parentSessionID)
                scope.turnSession.set(id, parentSessionID);
            scope.turnAgent.set(id, runner.agentId);
            publishSubagentEvent(runner, {
                type: "turn.submitted",
                id: id,
                text: task,
                byteLength: new TextEncoder().encode(task).byteLength,
                lineCount: scope.lineCount(task),
                sha256: scope.createHash("sha256").update(task).digest("hex"),
            });
            publishSubagentEvent(runner, { type: "turn.started", id: id });
        }
        function finishSubagentConversation(runner, stopReason) {
            var id = subagentTurnID(runner);
            publishSubagentEvent(runner, {
                type: "turn.finished",
                id: id,
                stopReason: stopReason,
            });
            scope.turnSession.delete(id);
            scope.turnAgent.delete(id);
        }
        function createSubagentContext(system, task, planPointer, forkSeed) {
            var _a;
            var ledger = resolvedContextLedgerFactory.create();
            ledger.add({ id: "system", role: "system", content: system });
            // A forked child inherits the completed turns of its parent's conversation
            // before its own task, so it can continue work in progress rather than
            // re-deriving it from a one-line description.
            for (var _i = 0, _b = (_a = forkSeed === null || forkSeed === void 0 ? void 0 : forkSeed.entries) !== null && _a !== void 0 ? _a : []; _i < _b.length; _i++) {
                var entry = _b[_i];
                ledger.add(entry);
            }
            ledger.add({ id: "task", role: "user", content: task });
            // ADR D4/B2: the plan正文 is never injected — the subagent reads the plan
            // file itself with read_file. Only the low-churn pointer (planID + path +
            // version) travels as a `<runtime_context source="plan_ptr">` user
            // message, so the subagent can find and read the current plan.
            if (planPointer)
                ledger.add({
                    id: "plan_ptr",
                    role: "dynamic",
                    content: "<runtime_context source=\"plan_ptr\" trust=\"runtime\" revision=\"1\">\nThe session has an active plan you must follow:\nplanID: ".concat(planPointer.planID, " \u00B7 version: ").concat(planPointer.version, "\npath: ").concat(planPointer.documentPath, "\nRead the plan file with read_file before acting on it. If the path is missing or the read fails, say so instead of guessing the plan.\n</runtime_context>"),
                });
            return ledger;
        }
        /** First call registers the ledger; later calls return it for steering. */
        function registerSubagentLedger(agentId, ledger) {
            if (!liveSubagentLedgers.has(agentId))
                liveSubagentLedgers.set(agentId, ledger);
            return liveSubagentLedgers.get(agentId);
        }
        function unregisterSubagentLedger(agentId) {
            liveSubagentLedgers.delete(agentId);
        }
        /** Queue a message for a subagent that has no live runner. */
        function queueSubagentMessage(agentId, message) {
            var _a, _b, _c;
            var record = subagents === null || subagents === void 0 ? void 0 : subagents.get(agentId);
            if (!record)
                return false;
            var pending = __spreadArray(__spreadArray([], ((_a = record.pendingMessages) !== null && _a !== void 0 ? _a : []), true), [message], false);
            // The record is persisted by the store, so the message survives the child's
            // next continuation rather than living only in this process.
            return (_c = (_b = subagents === null || subagents === void 0 ? void 0 : subagents.setPendingMessages) === null || _b === void 0 ? void 0 : _b.call(subagents, agentId, pending)) !== null && _c !== void 0 ? _c : false;
        }
        function tokenMeterFor(ledger) {
            var meter = tokenMeters.get(ledger);
            if (meter === undefined) {
                meter = new runtime_1.TokenMeter();
                tokenMeters.set(ledger, meter);
            }
            return meter;
        }
        function subagentProviderMessages(ledger) {
            return scope.contextEntriesToProviderMessages(ledger.snapshot().entries);
        }
        function subagentToolSchemas(tools) {
            return tools.map(function (tool) { return ({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            }); });
        }
        function publishSubagentTokenSnapshot(ledger, runner) {
            var _a, _b;
            var meter = tokenMeterFor(ledger);
            var projection = meter.project("subagent:".concat(runner.agentId));
            publishSubagentEvent(runner, __assign(__assign(__assign(__assign(__assign(__assign(__assign({ type: "context.snapshot", usedTokens: (_b = (_a = projection.projectedTokens) !== null && _a !== void 0 ? _a : projection.pressureTokens) !== null && _b !== void 0 ? _b : ledger.effectiveTokens() }, (projection.pressureTokens === undefined
                ? {}
                : { pressureTokens: projection.pressureTokens })), (projection.projectedTokens === undefined
                ? {}
                : { projectedTokens: projection.projectedTokens })), (projection.contextWindow === undefined
                ? {}
                : { contextWindow: projection.contextWindow })), (projection.systemTokens === undefined
                ? {}
                : { systemTokens: projection.systemTokens })), (projection.toolsTokens === undefined
                ? {}
                : { toolsTokens: projection.toolsTokens })), (projection.messageTokens === undefined
                ? {}
                : { messageTokens: projection.messageTokens })), { source: projection.source, at: new Date().toISOString() }));
        }
        function measureSubagentRequest(ledger, runner, tools, contextConfig) {
            var meter = tokenMeterFor(ledger);
            var measured = meter.measureRequest("subagent:".concat(runner.agentId), {
                tools: subagentToolSchemas(tools),
                messages: subagentProviderMessages(ledger),
                contextWindow: contextConfig.max,
            });
            publishSubagentTokenSnapshot(ledger, runner);
            return Math.max(ledger.effectiveTokens(), measured.totalTokens);
        }
        function runSubagentProviderStep(ledger_1, visibleTools_1, runner_1, step_1, activeProvider_1, activeContextConfig_1) {
            return __awaiter(this, arguments, void 0, function (ledger, visibleTools, runner, step, activeProvider, activeContextConfig, allowToolCalls) {
                var id, runStep, correction, result, meter, scopeKey, providerMessages, toolSchemas;
                var _this = this;
                var _a, _b, _c;
                if (allowToolCalls === void 0) { allowToolCalls = true; }
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            id = subagentTurnID(runner);
                            runStep = function () {
                                return resolvedRetryService.run({ id: id, operation: "llm_step", step: step }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                    var output, thinking, calls, protocolViolation, providerUsage, providerMessages, toolSchemas, stream, normalized, _c, normalized_1, normalized_1_1, chunk, e_1_1, meter, scopeKey, system;
                                    var _d, e_1, _e, _f;
                                    var _g;
                                    var attempt = _b.attempt;
                                    return __generator(this, function (_h) {
                                        switch (_h.label) {
                                            case 0:
                                                output = "";
                                                thinking = "";
                                                calls = [];
                                                protocolViolation = "";
                                                providerMessages = subagentProviderMessages(ledger);
                                                toolSchemas = subagentToolSchemas(visibleTools);
                                                stream = scope.withProviderConcurrency(scope.providerConcurrencyLimiter, activeProvider.provider, function () {
                                                    return activeProvider.stream({
                                                        messages: providerMessages,
                                                        tools: allowToolCalls ? toolSchemas : undefined,
                                                        toolChoice: allowToolCalls ? undefined : "none",
                                                        signal: runner.signal,
                                                    });
                                                }, runner.signal);
                                                normalized = allowToolCalls
                                                    ? scope.requireNativeToolCallProtocol(scope.normalizeRawToolCallProtocol(stream))
                                                    : stream;
                                                _h.label = 1;
                                            case 1:
                                                _h.trys.push([1, 6, 7, 12]);
                                                _c = true, normalized_1 = __asyncValues(normalized);
                                                _h.label = 2;
                                            case 2: return [4 /*yield*/, normalized_1.next()];
                                            case 3:
                                                if (!(normalized_1_1 = _h.sent(), _d = normalized_1_1.done, !_d)) return [3 /*break*/, 5];
                                                _f = normalized_1_1.value;
                                                _c = false;
                                                chunk = _f;
                                                if (chunk.type === "thinking") {
                                                    thinking += chunk.text;
                                                    publishSubagentEvent(runner, {
                                                        type: "thinking.delta",
                                                        id: id,
                                                        text: chunk.text,
                                                        attempt: attempt,
                                                    });
                                                }
                                                if (chunk.type === "content") {
                                                    output += chunk.text;
                                                    publishSubagentEvent(runner, {
                                                        type: "content.delta",
                                                        id: id,
                                                        text: chunk.text,
                                                        attempt: attempt,
                                                    });
                                                }
                                                if (chunk.type === "tool_call")
                                                    calls.push.apply(calls, chunk.calls);
                                                if (chunk.type === "tool_protocol_violation")
                                                    protocolViolation = chunk.text;
                                                if (chunk.type === "usage")
                                                    providerUsage = __assign(__assign({ inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens }, (chunk.cacheCreationInputTokens === undefined
                                                        ? {}
                                                        : {
                                                            cacheCreationInputTokens: chunk.cacheCreationInputTokens,
                                                        })), (chunk.cacheReadInputTokens === undefined
                                                        ? {}
                                                        : { cacheReadInputTokens: chunk.cacheReadInputTokens }));
                                                _h.label = 4;
                                            case 4:
                                                _c = true;
                                                return [3 /*break*/, 2];
                                            case 5: return [3 /*break*/, 12];
                                            case 6:
                                                e_1_1 = _h.sent();
                                                e_1 = { error: e_1_1 };
                                                return [3 /*break*/, 12];
                                            case 7:
                                                _h.trys.push([7, , 10, 11]);
                                                if (!(!_c && !_d && (_e = normalized_1.return))) return [3 /*break*/, 9];
                                                return [4 /*yield*/, _e.call(normalized_1)];
                                            case 8:
                                                _h.sent();
                                                _h.label = 9;
                                            case 9: return [3 /*break*/, 11];
                                            case 10:
                                                if (e_1) throw e_1.error;
                                                return [7 /*endfinally*/];
                                            case 11: return [7 /*endfinally*/];
                                            case 12:
                                                if (providerUsage) {
                                                    meter = tokenMeterFor(ledger);
                                                    scopeKey = "subagent:".concat(runner.agentId);
                                                    system = ((_g = providerMessages[0]) === null || _g === void 0 ? void 0 : _g.role) === "system"
                                                        ? providerMessages[0].content
                                                        : undefined;
                                                    meter.setContextWindow(scopeKey, activeContextConfig.max);
                                                    meter.recordUsage(scopeKey, providerUsage, {
                                                        headerKey: (0, runtime_1.requestHeaderKey)({ system: system, tools: toolSchemas }),
                                                        surfaceTokens: meter.observeSurface(scopeKey, providerMessages),
                                                    });
                                                    publishSubagentTokenSnapshot(ledger, runner);
                                                    // Mirror the main runner's per-step usage event so the subagent
                                                    // pane can show the same token/latency bar as Natalia/Navi/Nia.
                                                    publishSubagentEvent(runner, __assign(__assign({ type: "runtime.step_usage", id: "".concat(id, ":usage:").concat(attempt), inputTokens: providerUsage.inputTokens, outputTokens: providerUsage.outputTokens }, (providerUsage.cacheCreationInputTokens === undefined
                                                        ? {}
                                                        : {
                                                            cacheCreationInputTokens: providerUsage.cacheCreationInputTokens,
                                                        })), (providerUsage.cacheReadInputTokens === undefined
                                                        ? {}
                                                        : {
                                                            cacheReadInputTokens: providerUsage.cacheReadInputTokens,
                                                        })));
                                                }
                                                return [2 /*return*/, { output: output, thinking: thinking, calls: calls, protocolViolation: protocolViolation }];
                                        }
                                    });
                                }); }, {
                                    signal: runner.signal,
                                    onEvent: function (event) {
                                        var _a;
                                        publishSubagentEvent(runner, event);
                                        if (event.type === "step.retry")
                                            runner.log("provider retry ".concat(event.attempt, "/").concat((_a = event.maxAttempts) !== null && _a !== void 0 ? _a : "unlimited", " after ").concat(event.reason, " (").concat(event.waitMs, "ms)"));
                                    },
                                });
                            };
                            correction = 0;
                            _d.label = 1;
                        case 1:
                            if (!true) return [3 /*break*/, 4];
                            runner.signal.throwIfAborted();
                            meter = tokenMeterFor(ledger);
                            scopeKey = "subagent:".concat(runner.agentId);
                            providerMessages = subagentProviderMessages(ledger);
                            toolSchemas = subagentToolSchemas(visibleTools);
                            return [4 /*yield*/, resolvedCompactionService.prepareContextRequest({
                                    id: id,
                                    ledger: ledger,
                                    meter: meter,
                                    scope: scopeKey,
                                    system: ((_a = providerMessages[0]) === null || _a === void 0 ? void 0 : _a.role) === "system"
                                        ? providerMessages[0].content
                                        : undefined,
                                    tools: toolSchemas,
                                    contextWindow: activeContextConfig.max,
                                    // The exec budget carries the preserved tail and prune options; the
                                    // subagent no longer reads raw config for its own copy (plan §2.3).
                                    budget: activeContextConfig,
                                    // Prune once per subagent turn, on its first provider request. A
                                    // per-request prune would rewrite the ledger between requests and
                                    // invalidate the prefix cache each of them just wrote.
                                    prune: step === 1,
                                    outbound: providerMessages,
                                    rebuildOutbound: function (entries) { return (0, runtime_1.contextEntriesToProviderMessages)(entries); },
                                    // Subagents share the model-free prune path with the main runner; the
                                    // prune options and preserved tail come from the exec budget.
                                    provider: activeProvider,
                                    instruction: "Compact before this subagent provider request while preserving the active task.",
                                    compactionEnabled: (_c = (_b = scope.tsRuntimeConfig) === null || _b === void 0 ? void 0 : _b.context.compactionEnabled) !== null && _c !== void 0 ? _c : true,
                                    signal: runner.signal,
                                    publish: function (event) { return publishSubagentEvent(runner, event); },
                                    emitStatus: function () { },
                                    emitSnapshot: function () { return publishSubagentTokenSnapshot(ledger, runner); },
                                })];
                        case 2:
                            _d.sent();
                            // Drop the pre-compaction provider anchor before re-measuring.
                            meter.clear(scopeKey);
                            // Publish the compacted projection before the provider request starts.
                            measureSubagentRequest(ledger, runner, visibleTools, activeContextConfig);
                            return [4 /*yield*/, resolvedCompactionService.runWithContextLimitRecovery({
                                    id: id,
                                    step: step,
                                    compactionID: "".concat(id, ":context-limit:").concat(step),
                                    ledger: ledger,
                                    provider: activeProvider,
                                    budget: activeContextConfig,
                                    preservedRecentMessages: activeContextConfig.preservedRecentMessages,
                                    preservedRecentTokens: activeContextConfig.preservedRecentTokens,
                                    maxOverflowRetries: activeContextConfig.maxOverflowRetries,
                                    instruction: "Recover this subagent from the provider context limit.",
                                    signal: runner.signal,
                                    runStep: runStep,
                                    onEvent: function (event) {
                                        publishSubagentEvent(runner, event);
                                        if (event.type === "compaction.end" && event.success) {
                                            // Context-limit recovery rewrites the ledger in place; drop the
                                            // pre-compaction anchor and publish the post-compaction meter before
                                            // the retried provider request.
                                            tokenMeterFor(ledger).clear("subagent:".concat(runner.agentId));
                                            measureSubagentRequest(ledger, runner, visibleTools, activeContextConfig);
                                        }
                                    },
                                })];
                        case 3:
                            result = _d.sent();
                            if (!result.protocolViolation)
                                return [3 /*break*/, 4];
                            correction += 1;
                            if (correction > scope.MAX_PROTOCOL_CORRECTIONS)
                                throw new Error("model repeatedly emitted malformed textual tool calls instead of the provider's native tool protocol");
                            ledger.add({
                                id: "".concat(runner.agentId, ":").concat(step, ":protocol:").concat(correction, ":assistant"),
                                role: "assistant",
                                content: result.protocolViolation,
                            });
                            ledger.add({
                                id: "".concat(runner.agentId, ":").concat(step, ":protocol:").concat(correction, ":system"),
                                role: "system",
                                content: scope.nativeToolCallCorrection(correction),
                            });
                            runner.log("correcting textual tool call; native tool calling required (attempt ".concat(correction, ")"));
                            return [3 /*break*/, 1];
                        case 4:
                            if (result.thinking)
                                publishSubagentEvent(runner, {
                                    type: "thinking.done",
                                    id: id,
                                    text: result.thinking,
                                });
                            if (result.output)
                                publishSubagentEvent(runner, {
                                    type: "content.done",
                                    id: id,
                                    text: result.output,
                                });
                            return [2 /*return*/, result];
                    }
                });
            });
        }
        function appendSubagentAssistant(ledger, runner, step, output, calls) {
            if (output)
                ledger.add({
                    id: "".concat(runner.agentId, ":").concat(step, ":assistant"),
                    role: "assistant",
                    content: output,
                });
            for (var _i = 0, calls_1 = calls; _i < calls_1.length; _i++) {
                var call = calls_1[_i];
                ledger.add({
                    id: "".concat(runner.agentId, ":").concat(step, ":").concat(call.id, ":call"),
                    role: "tool_call",
                    content: "".concat(call.name, " ").concat(call.arguments),
                    pairID: call.id,
                });
            }
        }
        function appendSubagentToolResult(ledger, runner, step, call, content) {
            ledger.add({
                id: "".concat(runner.agentId, ":").concat(step, ":").concat(call.id, ":result"),
                role: "tool_result",
                content: content,
                pairID: call.id,
            });
        }
        var scope, subagents, ledgerFactory, resolvedContextLedgerFactory, resolvedCompactionService, resolvedRetryService, sandboxedSubagentActive, sandboxedSubagentWaiters, liveSubagentLedgers, tokenMeters;
        return __generator(this, function (_a) {
            scope = (0, runtime_2.createInitializeRuntime)(ctx);
            subagents = scope.serviceDirectory.getOptional(runtime_services_1.subagentsService);
            ledgerFactory = scope.serviceDirectory.get(context_ledger_1.contextLedgerFactory);
            resolvedContextLedgerFactory = ledgerFactory;
            resolvedCompactionService = scope.serviceDirectory.get(compaction_1.compactionService);
            resolvedRetryService = scope.serviceDirectory.get(retry_1.retryService);
            sandboxedSubagentActive = 0;
            sandboxedSubagentWaiters = [];
            liveSubagentLedgers = new Map();
            tokenMeters = new WeakMap();
            return [2 /*return*/, {
                    acquireSandboxedSubagentSlot: acquireSandboxedSubagentSlot,
                    releaseSandboxedSubagentSlot: releaseSandboxedSubagentSlot,
                    publishSubagentEvent: publishSubagentEvent,
                    subagentTurnID: subagentTurnID,
                    beginSubagentConversation: beginSubagentConversation,
                    finishSubagentConversation: finishSubagentConversation,
                    createSubagentContext: createSubagentContext,
                    registerSubagentLedger: registerSubagentLedger,
                    unregisterSubagentLedger: unregisterSubagentLedger,
                    queueSubagentMessage: queueSubagentMessage,
                    liveSubagentLedgerCount: function () { return liveSubagentLedgers.size; },
                    runSubagentProviderStep: runSubagentProviderStep,
                    appendSubagentAssistant: appendSubagentAssistant,
                    appendSubagentToolResult: appendSubagentToolResult,
                }];
        });
    });
}
