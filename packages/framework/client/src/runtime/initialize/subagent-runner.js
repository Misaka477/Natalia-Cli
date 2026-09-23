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
exports.installSubagents = installSubagents;
var runtime_1 = require("./runtime");
var subagent_result_gate_1 = require("./subagent-result-gate");
var subagent_fork_seed_1 = require("./subagent-fork-seed");
var subagent_steer_1 = require("./subagent-steer");
var subagent_settled_notice_1 = require("./subagent-settled-notice");
var collab_1 = require("@natalia/collab");
var runtime_services_1 = require("@natalia/runtime-services");
/**
 * The active plan pointer for a subagent (ADR D4/B2): planID + documentPath +
 * version only. The plan正文 is never injected into the subagent's context;
 * the subagent reads the plan file itself with read_file.
 */
function subagentPlanPointer(ctx, exec) {
    var plan = (0, collab_1.activePlanForExec)(ctx, exec);
    if (!plan)
        return undefined;
    return {
        planID: plan.planID,
        // documentPath is relative to the plan dir; the subagent reads the file
        // through the workspace root, so the pointer carries the full
        // workspace-relative path.
        documentPath: ".natalia/plans/".concat(plan.documentPath),
        // The plan document has no persisted version counter; the pointer only
        // needs a stable, honest value, and the plan file read carries the truth.
        version: 1,
    };
}
/**
 * The system prompt for a subagent spawned as a configured agent type.
 *
 * The type's own prompt replaces the generic one rather than being appended to
 * it: a type exists to say "you are this kind of worker", and a generic
 * instruction bolted in front of it dilutes exactly that. `undefined` when the
 * subagent was not spawned as a type, so the generic prompt still applies.
 */
function agentTypeSystemPrompt(scope, agentType) {
    var _a;
    if (!agentType)
        return undefined;
    var definition = (_a = scope.agentRegistry) === null || _a === void 0 ? void 0 : _a.get(agentType);
    return (definition === null || definition === void 0 ? void 0 : definition.systemPrompt) || undefined;
}
function installSubagents(ctx, _options, support) {
    return __awaiter(this, void 0, void 0, function () {
        /**
         * Adopt the ledger this subagent's run writes to, so a parent can steer it.
         *
         * The ledger is registered before the run begins and dropped when it ends,
         * which is what makes "is there a live runner" a fact rather than a guess from
         * the recorded status. Messages the parent queued while no runner was live are
         * drained here, before the first step, so nothing sent during a gap is lost.
         */
        /**
         * Drop a subagent's live ledger and steer hook when its run ends.
         *
         * Until this runs the child is steerable; after it a message queues instead.
         * Leaving either in place would let a parent steer a subagent whose ledger no
         * longer exists, which would look like a delivery that went nowhere.
         */
        function releaseSubagentSteering(runner) {
            var _a;
            unregisterSubagentLedger(runner.agentId);
            (_a = subagentsController.setSteerHook) === null || _a === void 0 ? void 0 : _a.call(subagentsController, runner.agentId, undefined);
        }
        function adoptSubagentLedger(runner, record, create) {
            var _a, _b, _c, _d;
            var ledger = create();
            registerSubagentLedger(runner.agentId, ledger);
            // Live-delivery hook: a message appended here is in front of the child at its
            // nearest step, because its provider messages are rebuilt from this ledger
            // every step. Registered for the run and dropped with it.
            (_a = subagentsController.setSteerHook) === null || _a === void 0 ? void 0 : _a.call(subagentsController, runner.agentId, function (message) {
                var _a;
                ledger.add({
                    id: "steer:".concat(runner.agentId, ":").concat(ledger.snapshot().entries.length + 1),
                    role: "dynamic",
                    content: (0, subagent_steer_1.parentMessageContent)((_a = record === null || record === void 0 ? void 0 : record.parentAgentID) !== null && _a !== void 0 ? _a : "parent", runner.agentId, message),
                });
                return "delivered";
            });
            for (var _i = 0, _e = (_b = record === null || record === void 0 ? void 0 : record.pendingMessages) !== null && _b !== void 0 ? _b : []; _i < _e.length; _i++) {
                var message = _e[_i];
                ledger.add({
                    id: "pending:".concat(runner.agentId, ":").concat(ledger.snapshot().entries.length + 1),
                    role: "dynamic",
                    content: (0, subagent_steer_1.parentMessageContent)((_c = record === null || record === void 0 ? void 0 : record.id) !== null && _c !== void 0 ? _c : "parent", runner.agentId, message),
                });
            }
            if ((_d = record === null || record === void 0 ? void 0 : record.pendingMessages) === null || _d === void 0 ? void 0 : _d.length)
                subagentsController.setPendingMessages(runner.agentId, []);
            return ledger;
        }
        function runSandboxedSubagent(task, runner, exec, activeProvider) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, acquireSandboxedSubagentSlot(runner.signal)];
                        case 1:
                            _a.sent();
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, , 4, 5]);
                            return [4 /*yield*/, runSandboxedSubagentInner(task, runner, exec, activeProvider)];
                        case 3:
                            _a.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            releaseSandboxedSubagentSlot();
                            releaseSubagentSteering(runner);
                            return [7 /*endfinally*/];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        }
        function runSandboxedSubagentInner(task, runner, exec, activeProvider) {
            return __awaiter(this, void 0, void 0, function () {
                var record, allowed, excluded, manifest, sandboxRoot, writePaths, writeAuthorize, ledger, repeatedCalls, maxSubagentSteps, activeContextConfig, step, isLastStep, visibleTools, _a, output, calls, usable, finalOutput, _i, calls_1, call, result;
                var _this = this;
                var _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            record = subagentsController.get(runner.agentId);
                            if (!record)
                                throw new Error("subagent record not found: ".concat(runner.agentId));
                            allowed = (_b = record.allowedTools) !== null && _b !== void 0 ? _b : [];
                            excluded = new Set((_c = record.excludeTools) !== null && _c !== void 0 ? _c : []);
                            return [4 /*yield*/, (sandbox === null || sandbox === void 0 ? void 0 : sandbox.create(runner.agentId))];
                        case 1:
                            manifest = _f.sent();
                            if (!manifest)
                                throw new Error("sandbox controller unavailable for subagent worktree");
                            sandboxRoot = manifest.root;
                            writePaths = record.writePaths;
                            writeAuthorize = (writePaths === null || writePaths === void 0 ? void 0 : writePaths.length)
                                ? function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                    var relative, inDomain;
                                    var toolName = _b.toolName, path = _b.path;
                                    return __generator(this, function (_c) {
                                        relative = path.startsWith(sandboxRoot + "/")
                                            ? path.slice(sandboxRoot.length + 1)
                                            : path;
                                        inDomain = writePaths.some(function (domain) {
                                            return relative === domain ||
                                                relative.startsWith(domain.endsWith("/") ? domain : "".concat(domain, "/"));
                                        });
                                        if (!inDomain)
                                            throw new Error("subagent write outside file domain (".concat(toolName, "): ").concat(relative));
                                        return [2 /*return*/];
                                    });
                                }); }
                                : undefined;
                            runner.log("accepted (sandboxed): ".concat(task));
                            runner.setStatus("running");
                            beginSubagentConversation(runner, task);
                            ledger = adoptSubagentLedger(runner, record, function () {
                                var _a, _b, _c;
                                return createSubagentContext((_c = (_b = (_a = scope.teamBehavior()) === null || _a === void 0 ? void 0 : _a.sandboxedSubagentSystemPrompt(writePaths)) !== null && _b !== void 0 ? _b : agentTypeSystemPrompt(scope, record.agentType)) !== null && _c !== void 0 ? _c : "You are a focused Natalia TS/Bun subagent. Use the provided native tools to inspect, edit, and validate the workspace. Return a concise factual final result. Never claim a tool action you did not run. Do not reveal private reasoning.", task, subagentPlanPointer(ctx, exec), 
                                // A fork inherits the parent's completed turns; a fresh subagent gets
                                // nothing but its task. The seed comes from the *parent's* ledger — the
                                // `exec` this runner resolves — so it is the conversation the child is
                                // meant to continue.
                                (record === null || record === void 0 ? void 0 : record.context) === "fork"
                                    ? { entries: (0, subagent_fork_seed_1.forkSeedEntries)(exec.context.snapshot().entries) }
                                    : undefined);
                            });
                            repeatedCalls = new Map();
                            maxSubagentSteps = scope.effectiveMaxSteps(exec);
                            activeContextConfig = __assign({}, exec.runtimeContextConfig);
                            step = 1;
                            _f.label = 2;
                        case 2:
                            if (!(step <= maxSubagentSteps)) return [3 /*break*/, 10];
                            isLastStep = Number.isFinite(maxSubagentSteps) && step >= maxSubagentSteps;
                            visibleTools = __spreadArray([], scope.tools.values(), true).filter(function (tool) {
                                return scope.isToolAllowed(tool.name, exec) &&
                                    (exec.permissionMode !== "read_only" || !tool.requiresApproval) &&
                                    !excluded.has(tool.name) &&
                                    (!allowed.length || allowed.includes(tool.name));
                            });
                            if (isLastStep)
                                ledger.add({
                                    id: "".concat(runner.agentId, ":").concat(step, ":max-steps"),
                                    role: "assistant",
                                    content: scope.MAX_STEPS_PROMPT,
                                });
                            return [4 /*yield*/, runSubagentProviderStep(ledger, visibleTools, runner, step, activeProvider, activeContextConfig, !isLastStep)];
                        case 3:
                            _a = _f.sent(), output = _a.output, calls = _a.calls;
                            if (!(!calls.length || isLastStep)) return [3 /*break*/, 5];
                            return [4 /*yield*/, (0, subagent_result_gate_1.ensureUsableResult)({
                                    ledger: ledger,
                                    setStatus: runner.setStatus,
                                    step: step,
                                    output: output,
                                    minChars: (_e = (_d = scope.tsRuntimeConfig) === null || _d === void 0 ? void 0 : _d.runtime.subagentMinResultChars) !== null && _e !== void 0 ? _e : 0,
                                    // No tools: a follow-up that could start new work would spend the
                                    // budget again instead of reporting what it already did.
                                    runStep: function (extraStep) {
                                        return runSubagentProviderStep(ledger, [], runner, extraStep, activeProvider, activeContextConfig, false);
                                    },
                                })];
                        case 4:
                            usable = _f.sent();
                            finalOutput = usable.trim() ||
                                (isLastStep || step > 1
                                    ? scope.MISSING_FINAL_RESPONSE_FALLBACK
                                    : usable);
                            appendSubagentAssistant(ledger, runner, step, finalOutput, []);
                            if (isLastStep && calls.length)
                                publishSubagentEvent(runner, {
                                    type: "diagnostic",
                                    level: "warning",
                                    message: "Provider emitted a subagent tool call after tools were disabled; ignored the call and finalized with text",
                                });
                            if (!output.trim() && (isLastStep || step > 1)) {
                                publishSubagentEvent(runner, {
                                    type: "content.delta",
                                    id: subagentTurnID(runner),
                                    text: finalOutput,
                                });
                                publishSubagentEvent(runner, {
                                    type: "content.done",
                                    id: subagentTurnID(runner),
                                    text: finalOutput,
                                });
                            }
                            runner.log(finalOutput.trim() || "completed without text output");
                            finishSubagentConversation(runner, "done");
                            releaseSubagentSteering(runner);
                            return [2 /*return*/];
                        case 5:
                            appendSubagentAssistant(ledger, runner, step, output, calls);
                            _i = 0, calls_1 = calls;
                            _f.label = 6;
                        case 6:
                            if (!(_i < calls_1.length)) return [3 /*break*/, 9];
                            call = calls_1[_i];
                            return [4 /*yield*/, executeSubagentToolCall({
                                    call: call,
                                    step: step,
                                    runner: runner,
                                    visibleTools: visibleTools,
                                    childWorkspaceRoot: sandboxRoot,
                                    repeatedCalls: repeatedCalls,
                                    exec: exec,
                                    writeAuthorize: writeAuthorize,
                                })];
                        case 7:
                            result = _f.sent();
                            appendSubagentToolResult(ledger, runner, step, call, result);
                            _f.label = 8;
                        case 8:
                            _i++;
                            return [3 /*break*/, 6];
                        case 9:
                            step++;
                            return [3 /*break*/, 2];
                        case 10: throw new Error("subagent step limit reached");
                    }
                });
            });
        }
        /**
         * Write one terminal outcome into the spawning session's ledger.
         *
         * The entry id is stable per subagent and continuation, so a re-settled
         * continuation replaces its earlier notice instead of stacking duplicates, and
         * the budget caps how much of a session's context the notices may consume.
         */
        function reportSubagentSettled(event) {
            var _a, _b, _c, _d;
            if (!event.parentSessionID)
                return;
            var exec = scope.executionBySession.get(event.parentSessionID);
            if (!exec)
                return;
            var continuation = (_a = event.continuation) !== null && _a !== void 0 ? _a : 0;
            var entryID = (0, subagent_settled_notice_1.settledNoticeEntryID)(event.agentId, continuation);
            // The ledger rejects a duplicate id, so an already-reported continuation is
            // skipped rather than rewritten: the outcome has not changed.
            if (exec.context.snapshot().entries.some(function (entry) { return entry.id === entryID; }))
                return;
            var existing = exec.context
                .snapshot()
                .entries.filter(function (entry) {
                return entry.id.startsWith("subagent_settled:");
            }).length;
            if (!(0, subagent_settled_notice_1.settledNoticeAllowed)(existing, (_c = (_b = scope.tsRuntimeConfig) === null || _b === void 0 ? void 0 : _b.runtime.subagentSettledNotices) !== null && _c !== void 0 ? _c : subagent_settled_notice_1.DEFAULT_SETTLED_NOTICE_BUDGET))
                return;
            var record = subagentsController.get(event.agentId);
            exec.context.add({
                id: entryID,
                role: "dynamic",
                content: (0, subagent_settled_notice_1.subagentSettledNoticeContent)(__assign(__assign({ agentId: event.agentId, status: event.status, continuation: continuation }, (event.stopReason ? { stopReason: event.stopReason } : {})), { 
                    // The subagent's own last output, so the parent does not have to make a
                    // second call to learn what it got.
                    finalResult: (_d = record === null || record === void 0 ? void 0 : record.outputs.at(-1)) === null || _d === void 0 ? void 0 : _d.text })),
            });
        }
        var scope, subagents, subagentsController, sandbox, acquireSandboxedSubagentSlot, releaseSandboxedSubagentSlot, publishSubagentEvent, subagentTurnID, beginSubagentConversation, finishSubagentConversation, createSubagentContext, registerSubagentLedger, unregisterSubagentLedger, runSubagentProviderStep, appendSubagentAssistant, appendSubagentToolResult, executeSubagentToolCall;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    scope = (0, runtime_1.createInitializeRuntime)(ctx);
                    subagents = scope.serviceDirectory.get(runtime_services_1.subagentsService);
                    subagentsController = subagents;
                    sandbox = scope.serviceDirectory.getOptional(runtime_services_1.sandboxService);
                    acquireSandboxedSubagentSlot = support.acquireSandboxedSubagentSlot, releaseSandboxedSubagentSlot = support.releaseSandboxedSubagentSlot, publishSubagentEvent = support.publishSubagentEvent, subagentTurnID = support.subagentTurnID, beginSubagentConversation = support.beginSubagentConversation, finishSubagentConversation = support.finishSubagentConversation, createSubagentContext = support.createSubagentContext, registerSubagentLedger = support.registerSubagentLedger, unregisterSubagentLedger = support.unregisterSubagentLedger, runSubagentProviderStep = support.runSubagentProviderStep, appendSubagentAssistant = support.appendSubagentAssistant, appendSubagentToolResult = support.appendSubagentToolResult, executeSubagentToolCall = support.executeSubagentToolCall;
                    return [4 /*yield*/, subagentsController.init(function (task, runner) { return __awaiter(_this, void 0, void 0, function () {
                            var record_1, parentSessionID, exec_1, activeProvider_1, allowed_1, excluded_1, ledger_1, repeatedCalls, maxSubagentSteps, activeContextConfig_1, step, isLastStep, visibleTools, _a, output, calls, usable, finalOutput, _i, calls_2, call, result, error_1;
                            var _b, _c, _d, _e;
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        _f.trys.push([0, 13, , 14]);
                                        record_1 = subagentsController.get(runner.agentId);
                                        parentSessionID = record_1 === null || record_1 === void 0 ? void 0 : record_1.parentSessionID;
                                        if (!parentSessionID)
                                            throw new Error("subagent has no parent session");
                                        return [4 /*yield*/, scope.ensureExecution(parentSessionID)];
                                    case 1:
                                        exec_1 = _f.sent();
                                        activeProvider_1 = exec_1.provider;
                                        if (!activeProvider_1)
                                            throw new Error("provider unavailable for subagent");
                                        if (!((record_1 === null || record_1 === void 0 ? void 0 : record_1.mode) === "sandbox")) return [3 /*break*/, 3];
                                        return [4 /*yield*/, runSandboxedSubagent(task, runner, exec_1, activeProvider_1)];
                                    case 2: return [2 /*return*/, _f.sent()];
                                    case 3:
                                        allowed_1 = (_b = record_1 === null || record_1 === void 0 ? void 0 : record_1.allowedTools) !== null && _b !== void 0 ? _b : [];
                                        excluded_1 = new Set((_c = record_1 === null || record_1 === void 0 ? void 0 : record_1.excludeTools) !== null && _c !== void 0 ? _c : []);
                                        ledger_1 = adoptSubagentLedger(runner, record_1, function () {
                                            var _a;
                                            return createSubagentContext((_a = agentTypeSystemPrompt(scope, record_1.agentType)) !== null && _a !== void 0 ? _a : "You are a focused Natalia TS/Bun subagent. Use the provided native tools for filesystem work. When a tool is needed, call it through the provider's native structured tool-calling interface; never write XML, JSON, Markdown, or prose that imitates a tool call in assistant content. Return a concise factual final result. Never claim a tool action you did not run. Do not reveal private reasoning.", task, subagentPlanPointer(ctx, exec_1), 
                                            // A fork inherits the parent's completed turns; a fresh subagent gets
                                            // nothing but its task. The seed comes from the *parent's* ledger —
                                            // the `exec` this runner resolves — so it is the conversation the
                                            // child is meant to continue.
                                            (record_1 === null || record_1 === void 0 ? void 0 : record_1.context) === "fork"
                                                ? { entries: (0, subagent_fork_seed_1.forkSeedEntries)(exec_1.context.snapshot().entries) }
                                                : undefined);
                                        });
                                        repeatedCalls = new Map();
                                        runner.log("accepted: ".concat(task));
                                        beginSubagentConversation(runner, task);
                                        maxSubagentSteps = scope.effectiveMaxSteps(exec_1);
                                        activeContextConfig_1 = __assign({}, exec_1.runtimeContextConfig);
                                        step = 1;
                                        _f.label = 4;
                                    case 4:
                                        if (!(step <= maxSubagentSteps)) return [3 /*break*/, 12];
                                        isLastStep = Number.isFinite(maxSubagentSteps) && step >= maxSubagentSteps;
                                        visibleTools = __spreadArray([], scope.tools.values(), true).filter(function (tool) {
                                            return scope.isToolAllowed(tool.name, exec_1) &&
                                                (exec_1.permissionMode !== "read_only" || !tool.requiresApproval) &&
                                                !excluded_1.has(tool.name) &&
                                                (!allowed_1.length || allowed_1.includes(tool.name));
                                        });
                                        if (isLastStep)
                                            ledger_1.add({
                                                id: "".concat(runner.agentId, ":").concat(step, ":max-steps"),
                                                role: "assistant",
                                                content: scope.MAX_STEPS_PROMPT,
                                            });
                                        return [4 /*yield*/, runSubagentProviderStep(ledger_1, visibleTools, runner, step, activeProvider_1, activeContextConfig_1, !isLastStep)];
                                    case 5:
                                        _a = _f.sent(), output = _a.output, calls = _a.calls;
                                        if (!(!calls.length || isLastStep)) return [3 /*break*/, 7];
                                        return [4 /*yield*/, (0, subagent_result_gate_1.ensureUsableResult)({
                                                ledger: ledger_1,
                                                setStatus: runner.setStatus,
                                                step: step,
                                                output: output,
                                                minChars: (_e = (_d = scope.tsRuntimeConfig) === null || _d === void 0 ? void 0 : _d.runtime.subagentMinResultChars) !== null && _e !== void 0 ? _e : 0,
                                                runStep: function (extraStep) {
                                                    return runSubagentProviderStep(ledger_1, [], runner, extraStep, activeProvider_1, activeContextConfig_1, false);
                                                },
                                            })];
                                    case 6:
                                        usable = _f.sent();
                                        finalOutput = usable.trim() ||
                                            (isLastStep || step > 1
                                                ? scope.MISSING_FINAL_RESPONSE_FALLBACK
                                                : usable);
                                        appendSubagentAssistant(ledger_1, runner, step, finalOutput, []);
                                        if (isLastStep && calls.length)
                                            publishSubagentEvent(runner, {
                                                type: "diagnostic",
                                                level: "warning",
                                                message: "Provider emitted a subagent tool call after tools were disabled; ignored the call and finalized with text",
                                            });
                                        if (!output.trim() && (isLastStep || step > 1)) {
                                            publishSubagentEvent(runner, {
                                                type: "content.delta",
                                                id: subagentTurnID(runner),
                                                text: finalOutput,
                                            });
                                            publishSubagentEvent(runner, {
                                                type: "content.done",
                                                id: subagentTurnID(runner),
                                                text: finalOutput,
                                            });
                                        }
                                        runner.log(finalOutput.trim() || "completed without text output");
                                        finishSubagentConversation(runner, "done");
                                        releaseSubagentSteering(runner);
                                        return [2 /*return*/];
                                    case 7:
                                        appendSubagentAssistant(ledger_1, runner, step, output, calls);
                                        _i = 0, calls_2 = calls;
                                        _f.label = 8;
                                    case 8:
                                        if (!(_i < calls_2.length)) return [3 /*break*/, 11];
                                        call = calls_2[_i];
                                        return [4 /*yield*/, executeSubagentToolCall({
                                                call: call,
                                                step: step,
                                                runner: runner,
                                                visibleTools: visibleTools,
                                                childWorkspaceRoot: scope.workspaceRoot,
                                                repeatedCalls: repeatedCalls,
                                                exec: exec_1,
                                                exposeSandboxes: true,
                                            })];
                                    case 9:
                                        result = _f.sent();
                                        appendSubagentToolResult(ledger_1, runner, step, call, result);
                                        _f.label = 10;
                                    case 10:
                                        _i++;
                                        return [3 /*break*/, 8];
                                    case 11:
                                        step++;
                                        return [3 /*break*/, 4];
                                    case 12: throw new Error("subagent step limit reached");
                                    case 13:
                                        error_1 = _f.sent();
                                        finishSubagentConversation(runner, runner.signal.aborted ? "cancelled" : "error");
                                        releaseSubagentSteering(runner);
                                        throw error_1;
                                    case 14: return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    subagentsController.subscribe(function (event) {
                        var _a, _b;
                        var record = subagentsController.get(event.agentId);
                        var update = {
                            type: "subagent.update",
                            id: event.agentId,
                            event: event.event,
                            status: event.status,
                            attached: event.attached,
                            task: record === null || record === void 0 ? void 0 : record.task,
                            text: event.text,
                            parentSessionID: event.parentSessionID,
                            parentAgentID: event.parentAgentID,
                            continuation: event.continuation,
                            phase: (_a = event.phase) !== null && _a !== void 0 ? _a : record === null || record === void 0 ? void 0 : record.phase,
                            activityDetail: (_b = event.activityDetail) !== null && _b !== void 0 ? _b : record === null || record === void 0 ? void 0 : record.activityDetail,
                            health: subagentsController.health(event.agentId),
                            lastActivityAt: record === null || record === void 0 ? void 0 : record.lastActivityAt,
                            startedAt: record === null || record === void 0 ? void 0 : record.startedAt,
                            endedAt: record === null || record === void 0 ? void 0 : record.endedAt,
                            stopReason: event.stopReason,
                            requestedBy: event.requestedBy,
                            force: event.force,
                        };
                        // Registry events can arrive after the UI attaches to another scope.session.
                        // Persist them with the spawning scope.session, rather than whichever scope.session
                        // happens to be active when the asynchronous subagent reports progress.
                        scope.publishForSession(scope.executionBySession.get(event.parentSessionID), update);
                        if (event.event === "created" || event.event === "done")
                            scope.scheduleRuntimeStatusSnapshot();
                        // A subagent settles whenever it likes, and the turn that spawned it is
                        // usually elsewhere by then — so the outcome is written into the parent's
                        // ledger as runtime context rather than left for it to poll for.
                        if (event.event === "done" || event.event === "stopped")
                            reportSubagentSettled(event);
                    });
                    return [2 /*return*/];
            }
        });
    });
}
