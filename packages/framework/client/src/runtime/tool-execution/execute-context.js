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
exports.buildToolExecutionContext = buildToolExecutionContext;
var rina_1 = require("@natalia/rina");
var runtime_services_1 = require("@natalia/runtime-services");
var work_ledger_1 = require("@natalia/work-ledger");
var workspace_1 = require("@anthelia/workspace");
function buildToolExecutionContext(input) {
    var _this = this;
    var _a, _b, _c, _d, _e, _f;
    var exec = input.exec, publish = input.publish, toolID = input.toolID, tool = input.tool, call = input.call, turnID = input.turnID, attachImage = input.attachImage, ctx = input.ctx, sessionID = input.sessionID, workspaceRoot = input.workspaceRoot, signal = input.signal, timeoutSec = input.timeoutSec;
    var _g = ctx.ports, getCapabilityRegistry = _g.getCapabilityRegistry, getTsRuntimeConfig = _g.getTsRuntimeConfig, getInteractive = _g.getInteractive, authorizeWorkspaceRead = _g.authorizeWorkspaceRead, authorizeSandboxMerge = _g.authorizeSandboxMerge, toolSettings = _g.toolSettings, scheduleRuntimeStatusSnapshot = _g.scheduleRuntimeStatusSnapshot;
    var sandboxResourcesByID = ctx.state.sandboxResourcesByID;
    var subagents = ctx.state.serviceDirectory.getOptional(runtime_services_1.subagentsService);
    var terminal = ctx.state.serviceDirectory.getOptional(runtime_services_1.terminalController);
    var sandboxes = ctx.state.serviceDirectory.getOptional(runtime_services_1.sandboxService);
    return __assign(__assign(__assign(__assign({ workspaceRoot: workspaceRoot, signal: signal }, (timeoutSec === undefined ? {} : { timeoutSec: timeoutSec })), { sessionID: (_a = exec === null || exec === void 0 ? void 0 : exec.session.id) !== null && _a !== void 0 ? _a : sessionID, 
        // The file-effect mode for this call: composition default, per-call
        // truth rides down to runShell (sandbox study: policy rides the call).
        confinement: (_d = (_c = (_b = getTsRuntimeConfig()) === null || _b === void 0 ? void 0 : _b.confinement) === null || _c === void 0 ? void 0 : _c.mode) !== null && _d !== void 0 ? _d : "workspace-write", 
        // The escalation channel, closed over this call's identity — the same
        // approval seam tools already use, routed by turn so the permission
        // floors decide (read_only refuses, auto grants, ask prompts).
        sandboxApprover: {
            request: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                var interactive, refusal;
                var requestedMode = _b.requestedMode, justification = _b.justification;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            interactive = getInteractive();
                            if (!interactive)
                                return [2 /*return*/, "unavailable"];
                            return [4 /*yield*/, interactive.requireApproval("".concat(toolID, ":sandbox"), tool, call, turnID, { reason: "escalate sandbox to ".concat(requestedMode, ": ").concat(justification) })];
                        case 1:
                            refusal = _c.sent();
                            return [2 /*return*/, refusal ? "rejected" : "allowed-once"];
                    }
                });
            }); },
        }, askQuestion: function (input) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getInteractive().requireQuestion("".concat(toolID, ":question"), turnID, input)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); }, askInteractive: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, getInteractive().requireInteractive(__assign(__assign(__assign(__assign({ requestID: (_a = input.requestID) !== null && _a !== void 0 ? _a : "".concat(toolID, ":interactive"), turnID: turnID, kind: input.kind, title: input.title, payload: input.payload }, (input.responseSchema
                            ? {
                                responseSchema: input.responseSchema,
                            }
                            : {})), (input.expiresAt ? { expiresAt: input.expiresAt } : {})), (input.priority === undefined ? {} : { priority: input.priority })), (input.validate
                            ? {
                                validate: function (response) { var _a; return (_a = input.validate) === null || _a === void 0 ? void 0 : _a.call(input, response); },
                            }
                            : {})))];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        }); }, subagents: subagents, terminal: terminal, sandboxes: sandboxes }), (attachImage ? { attachImage: attachImage } : {})), { workspaceReadAuthorize: function (request) {
            return authorizeWorkspaceRead(request, exec);
        }, sandboxMergeAuthorize: function (request) {
            return authorizeSandboxMerge(request, exec);
        }, 
        // The resolved config as a service: a tool family reads it by
        // name (e.g. `sandbox.backend`) instead of re-parsing config.
        runtimeConfig: function () { return getCapabilityRegistry().service("runtime.config"); }, settings: toolSettings(exec), 
        // The turn's own session, not the attached one: a background turn's
        // subagents and terminal starts belong to its session (I1/I3).
        parentSessionID: (_e = exec === null || exec === void 0 ? void 0 : exec.session.id) !== null && _e !== void 0 ? _e : sessionID, maxSubagentDepth: (_f = getTsRuntimeConfig()) === null || _f === void 0 ? void 0 : _f.runtime.subagentDepth, onSandboxEvent: function (event) {
            var update = event;
            publish(update);
            if (sandboxResourcesByID.get(update.id) !== update.runningResources) {
                if (update.runningResources === 0)
                    sandboxResourcesByID.delete(update.id);
                else
                    sandboxResourcesByID.set(update.id, update.runningResources);
                scheduleRuntimeStatusSnapshot();
            }
        }, onWorkspaceChange: function (changes) {
            var _a, _b;
            // Invalidate-on-write (RINA law 2): the paths a settled tool changed
            // drop out of the read cache immediately; tree-scoped kinds go with
            // them (any write can move a listing).
            (_a = ctx.state.serviceDirectory
                .getOptional(rina_1.rinaCache)) === null || _a === void 0 ? void 0 : _a.invalidatePaths(changes.map(function (change) { return change.path; }));
            // WG4 Phase 3: the tool settled successfully — the expected
            // mutation stops matching unrelated later hints, but its identity
            // stays available for attributing the change it caused.
            (_b = ctx.state.serviceDirectory
                .getOptional(workspace_1.workspaceMutations)) === null || _b === void 0 ? void 0 : _b.settle(call.id);
            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                return;
            var workLedgerController = ctx.state.serviceDirectory.get(work_ledger_1.workLedgerController);
            if (!workLedgerController)
                throw new Error("work ledger unavailable (natalia-work-ledger)");
            for (var _i = 0, changes_1 = changes; _i < changes_1.length; _i++) {
                var change = changes_1[_i];
                publish(workLedgerController.workspaceChangeNode({
                    turnID: turnID,
                    path: change.path,
                    toolName: tool.name,
                    sessionID: exec.session.id,
                }));
                publish(workLedgerController.workspaceChangeEdge({
                    turnID: turnID,
                    callID: call.id,
                    path: change.path,
                }));
            }
        } });
}
