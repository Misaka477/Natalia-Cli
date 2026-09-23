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
exports.createSandboxRuntime = createSandboxRuntime;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var runtime_services_1 = require("@natalia/runtime-services");
var work_ledger_1 = require("@natalia/work-ledger");
var governance_ledger_1 = require("@natalia/governance-ledger");
var workspace_1 = require("@anthelia/workspace");
var substrate_1 = require("@anthelia/substrate");
var sandbox_1 = require("@anthelia/sandbox");
var substrate_2 = require("@anthelia/substrate");
function appendSandboxMutation(ctx, sessionID, path, operation) {
    return __awaiter(this, void 0, void 0, function () {
        var logPath, rows, _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 7, , 8]);
                    logPath = (0, node_path_1.resolve)(ctx.ports.getWorkspaceRoot(), ".natalia", "workspace-mutations.json");
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(logPath), { recursive: true })];
                case 1:
                    _e.sent();
                    rows = [];
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 4, , 5]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(logPath, "utf8")];
                case 3:
                    rows = _b.apply(_a, [_e.sent()]);
                    return [3 /*break*/, 5];
                case 4:
                    _c = _e.sent();
                    rows = [];
                    return [3 /*break*/, 5];
                case 5:
                    rows.push({
                        id: "mut_".concat(Date.now().toString(36)),
                        at: new Date().toISOString(),
                        workspaceRoot: ctx.ports.getWorkspaceRoot(),
                        sessionID: sessionID,
                        path: path,
                        operation: operation,
                        origin: "sandbox_merge",
                    });
                    return [4 /*yield*/, (0, promises_1.writeFile)(logPath, JSON.stringify(rows, null, 2))];
                case 6:
                    _e.sent();
                    return [3 /*break*/, 8];
                case 7:
                    _d = _e.sent();
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function createSandboxRuntime(ctx, episodeID) {
    function requireSandboxes() {
        var sandboxes = ctx.state.serviceDirectory.get(runtime_services_1.sandboxService);
        if (!sandboxes)
            throw new Error("sandbox controller unavailable");
        return sandboxes;
    }
    function requireWorkLedger() {
        return ctx.state.serviceDirectory.get(work_ledger_1.workLedgerController);
    }
    function mutationRegistry() {
        return ctx.state.serviceDirectory.getOptional(workspace_1.workspaceMutations);
    }
    function sessionOwner(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var owner, _a, _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!sessionID) return [3 /*break*/, 4];
                        if (!((_c = ctx.ports.getExecutionBySession().get(sessionID)) !== null && _c !== void 0)) return [3 /*break*/, 1];
                        _b = _c;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, ctx.ports.ensureExecution(sessionID)];
                    case 2:
                        _b = (_d.sent());
                        _d.label = 3;
                    case 3:
                        _a = (_b);
                        return [3 /*break*/, 5];
                    case 4:
                        _a = ctx.ports.getActiveExec();
                        _d.label = 5;
                    case 5:
                        owner = _a;
                        if (!owner)
                            throw new Error("session is not initialized");
                        return [2 /*return*/, owner];
                }
            });
        });
    }
    function sandboxIDsFor(owner) {
        return __awaiter(this, void 0, void 0, function () {
            var window, events;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(owner === null || owner === void 0 ? void 0 : owner.session))
                            return [2 /*return*/, new Set()];
                        return [4 /*yield*/, (0, substrate_1.ensureSessionEventWindow)(ctx, owner)];
                    case 1:
                        window = _a.sent();
                        events = window
                            ? (0, substrate_1.sessionWindowEvents)(owner, window)
                            : owner.session.events;
                        return [2 /*return*/, new Set(events
                                .filter(function (event) { return event.type === "sandbox.update"; })
                                .map(function (event) { return event.id; }))];
                }
            });
        });
    }
    function assertSandboxOwned(ctx, owner, id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, sandboxIDsFor(owner)];
                    case 1:
                        if (!(_a.sent()).has(id))
                            throw new Error("sandbox ".concat(id, " does not belong to session ").concat(owner.session.id));
                        return [2 /*return*/];
                }
            });
        });
    }
    function requireGovernanceLedger() {
        var ledger = ctx.state.serviceDirectory.get(governance_ledger_1.governanceLedgerController);
        if (!ledger)
            throw new Error("governance ledger unavailable (natalia-governance-ledger)");
        return ledger;
    }
    function promoteCommand() {
        var _a;
        var configured = (_a = ctx.ports.getTsRuntimeConfig()) === null || _a === void 0 ? void 0 : _a.sandbox.promoteCommand;
        var command = (configured === null || configured === void 0 ? void 0 : configured.trim()) || "npm run typecheck";
        if (!command)
            throw new Error("sandbox promote command must not be empty");
        return command;
    }
    return {
        sandboxList: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var owner, _a, owned;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            if (!sessionID) return [3 /*break*/, 3];
                            return [4 /*yield*/, sessionOwner(sessionID)];
                        case 2:
                            _a = _b.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            _a = ctx.ports.getActiveExec();
                            _b.label = 4;
                        case 4:
                            owner = _a;
                            return [4 /*yield*/, sandboxIDsFor(owner)];
                        case 5:
                            owned = _b.sent();
                            return [4 /*yield*/, requireSandboxes().list()];
                        case 6: return [2 /*return*/, (_b.sent())
                                .filter(function (sandbox) { return owned.has(sandbox.id); })
                                .map(function (sandbox) { return ({
                                id: sandbox.id,
                                root: sandbox.root,
                                isolationLevel: sandbox.isolationLevel,
                                changedFiles: sandbox.changedFiles.length,
                                runningResources: sandbox.runningResources.length,
                                envAllowlist: sandbox.envAllowlist,
                            }); })];
                    }
                });
            });
        },
        sandboxDiff: function (id, sessionID, options) {
            return __awaiter(this, void 0, void 0, function () {
                var owner, changes;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, sessionOwner(sessionID)];
                        case 2:
                            owner = _a.sent();
                            return [4 /*yield*/, assertSandboxOwned(ctx, owner, id)];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, requireSandboxes().previewMerge(id)];
                        case 4:
                            changes = _a.sent();
                            if ((options === null || options === void 0 ? void 0 : options.includePatch) === false) {
                                return [2 /*return*/, changes.map(function (change) { return (__assign(__assign(__assign(__assign({ kind: change.kind, path: change.path }, (change.oldPath ? { oldPath: change.oldPath } : {})), (change.mode ? { mode: change.mode } : {})), { additions: 0, deletions: 0 }), (change.structured ? { structured: change.structured } : {}))); })];
                            }
                            return [2 /*return*/, changes];
                    }
                });
            });
        },
        sandboxResources: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var owner;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, sessionOwner(sessionID)];
                        case 2:
                            owner = _a.sent();
                            return [4 /*yield*/, assertSandboxOwned(ctx, owner, id)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, requireSandboxes().resourcesFor(id)];
                    }
                });
            });
        },
        sandboxResourceOutput: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var owner;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, sessionOwner(input.sessionID)];
                        case 2:
                            owner = _a.sent();
                            return [4 /*yield*/, assertSandboxOwned(ctx, owner, input.id)];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, requireSandboxes().resourceOutput(input.id, input.resourceID, input.maxBytes)];
                        case 4: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        sandboxMerge: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var owner, sandboxes, command, ledger, startedAt, taskID, objective, redact, publishPromotionEvidence, validation, error_1, durationMs, preview, tier, highRiskPaths, response, promotion, changes, _i, changes_1, change, operationID, _a, changes_2, change, _b, evidence, outcome, error_2;
                var _this = this;
                var _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _e.sent();
                            return [4 /*yield*/, sessionOwner(sessionID)];
                        case 2:
                            owner = _e.sent();
                            return [4 /*yield*/, assertSandboxOwned(ctx, owner, id)];
                        case 3:
                            _e.sent();
                            sandboxes = requireSandboxes();
                            return [4 /*yield*/, ctx.ports.authorizeSandboxManagement("sandbox_merge", { id: id }, owner)];
                        case 4:
                            _e.sent();
                            command = promoteCommand();
                            ledger = requireGovernanceLedger();
                            startedAt = performance.now();
                            taskID = "sandbox:".concat(id);
                            objective = "promote sandbox ".concat(id);
                            redact = function (text) { return ctx.ports.redactToolOutput(text, true); };
                            publishPromotionEvidence = function (input) { return __awaiter(_this, void 0, void 0, function () {
                                var outcome, repoRefs, evidence;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            outcome = ledger.boundValidationOutcome({
                                                command: redact(command),
                                                result: input.result,
                                                safeSummary: redact(input.output),
                                                durationMs: input.durationMs,
                                            });
                                            return [4 /*yield*/, (0, substrate_2.captureRepositoryEvidenceFields)(ctx.ports.getWorkspaceRoot())];
                                        case 1:
                                            repoRefs = _b.sent();
                                            evidence = ledger.buildEvidenceRecorded(__assign({ id: "evidence:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextEvidenceSequence()), taskID: taskID, objective: objective, status: input.status, changes: ((_a = input.changes) !== null && _a !== void 0 ? _a : []).map(function (change) { return ({
                                                    path: change.path,
                                                    changeType: evidenceChangeType(change.kind),
                                                    summary: change.path,
                                                }); }), validations: [outcome], knownGaps: input.knownGaps }, repoRefs));
                                            ctx.ports.publishForSession(owner, evidence);
                                            return [2 /*return*/, { evidence: evidence, outcome: outcome }];
                                    }
                                });
                            }); };
                            _e.label = 5;
                        case 5:
                            _e.trys.push([5, 7, , 9]);
                            return [4 /*yield*/, sandboxes.validate(id, command)];
                        case 6:
                            validation = _e.sent();
                            return [3 /*break*/, 9];
                        case 7:
                            error_1 = _e.sent();
                            return [4 /*yield*/, publishPromotionEvidence({
                                    status: "failed",
                                    result: "failed",
                                    output: error_1 instanceof Error ? error_1.message : String(error_1),
                                    durationMs: performance.now() - startedAt,
                                    knownGaps: ["candidate failed validation; host unchanged"],
                                })];
                        case 8:
                            _e.sent();
                            throw error_1;
                        case 9:
                            durationMs = performance.now() - startedAt;
                            if (!!validation.ok) return [3 /*break*/, 11];
                            return [4 /*yield*/, publishPromotionEvidence({
                                    status: "failed",
                                    result: "failed",
                                    output: validation.output,
                                    durationMs: durationMs,
                                    knownGaps: ["candidate failed validation; host unchanged"],
                                })];
                        case 10:
                            _e.sent();
                            throw new Error("candidate ".concat(id, " failed validation (exit ").concat(validation.exitCode, "):\n").concat(validation.output.slice(0, 2000)));
                        case 11:
                            _e.trys.push([11, 19, , 21]);
                            return [4 /*yield*/, sandboxes.previewMerge(id)];
                        case 12:
                            preview = _e.sent();
                            tier = (0, sandbox_1.riskTierForChanges)(preview);
                            // Naming the transition: the manifest can only say "has changes", so the
                            // merge lifecycle is unreportable without an explicit status.
                            ctx.ports.publishForSession(owner, sandboxes.updateEvent(id, "merge_previewed"));
                            ctx.ports.publishForSession(owner, sandboxes.auditEvent(id, "merge", tier === "high"));
                            if (!(tier === "high")) return [3 /*break*/, 15];
                            highRiskPaths = preview
                                .filter(function (change) { return (0, sandbox_1.riskTierForPath)(change.path) === "high"; })
                                .map(function (change) { return change.path; });
                            return [4 /*yield*/, ctx.ports
                                    .getInteractive()
                                    .requirePlanAcceptance({
                                    approvalID: "sandbox_promotion:".concat(id, ":").concat(Date.now().toString(36)),
                                    planID: id,
                                    title: "High-risk promotion: sandbox ".concat(id),
                                    preview: highRiskPaths.join("\n"),
                                    detail: "This promotion touches ".concat(highRiskPaths.length, " high-risk path(s) ") +
                                        "(the tool contract, capability kernel or plugin registry):\n" +
                                        "".concat(highRiskPaths.join("\n"), "\n\nConfirm to proceed, or reject to leave the host unchanged."),
                                    scope: "sandbox_promotion",
                                    sessionID: owner.session.id,
                                })];
                        case 13:
                            response = _e.sent();
                            if (!(!response || response.decision === "reject")) return [3 /*break*/, 15];
                            return [4 /*yield*/, publishPromotionEvidence({
                                    status: "failed",
                                    result: "failed",
                                    output: "high-risk promotion rejected by the user",
                                    durationMs: performance.now() - startedAt,
                                    knownGaps: ["high-risk promotion not confirmed; host unchanged"],
                                })];
                        case 14:
                            _e.sent();
                            throw new Error("high-risk promotion of sandbox ".concat(id, " was rejected by the user"));
                        case 15: return [4 /*yield*/, sandboxes.promoteWithValidation(id, {
                                command: command,
                                hostRoot: ctx.ports.getWorkspaceRoot(),
                                authorize: function (paths) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, ctx.ports.authorizeSandboxMerge({ id: id, paths: paths }, owner)];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                }); }); },
                            })];
                        case 16:
                            promotion = _e.sent();
                            changes = promotion.changedFiles;
                            for (_i = 0, changes_1 = changes; _i < changes_1.length; _i++) {
                                change = changes_1[_i];
                                void appendSandboxMutation(ctx, owner.session.id, change.path, change.kind === "add"
                                    ? "add"
                                    : change.kind === "delete"
                                        ? "delete"
                                        : change.kind === "rename"
                                            ? "rename"
                                            : "modify");
                            }
                            operationID = "sandbox_merge:".concat(id, ":").concat((0, node_crypto_1.randomUUID)());
                            (_c = mutationRegistry()) === null || _c === void 0 ? void 0 : _c.register({
                                sessionID: owner.session.id,
                                episodeID: episodeID,
                                operationID: operationID,
                                toolName: "sandbox_merge",
                                authorizedPaths: ["."],
                                expectedOperations: ["added", "modified", "deleted"],
                            });
                            for (_a = 0, changes_2 = changes; _a < changes_2.length; _a++) {
                                change = changes_2[_a];
                                ctx.ports.publishForSession(owner, requireWorkLedger().workspaceChangeNode({
                                    operationID: operationID,
                                    path: change.path,
                                    toolName: "sandbox_merge",
                                    sessionID: owner.session.id,
                                }));
                            }
                            (_d = mutationRegistry()) === null || _d === void 0 ? void 0 : _d.settle(operationID);
                            ctx.ports.publishForSession(owner, sandboxes.updateEvent(id, "merged"));
                            ctx.ports.publishForSession(owner, sandboxes.auditEvent(id, "merge"));
                            return [4 /*yield*/, publishPromotionEvidence({
                                    status: "promoted",
                                    result: "passed",
                                    output: validation.output,
                                    durationMs: durationMs,
                                    changes: changes,
                                })];
                        case 17:
                            _b = _e.sent(), evidence = _b.evidence, outcome = _b.outcome;
                            ctx.ports.publishForSession(owner, ledger.buildCompletionRecorded({
                                id: "completion:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextCompletionSequence()),
                                taskID: taskID,
                                objective: objective,
                                changeSummary: "".concat(changes.length, " files promoted from sandbox ").concat(id),
                                validations: [outcome],
                                // Derived from what the promotion actually left behind. Claiming
                                // "available" as a constant described a rollback point nobody had
                                // checked for, and there is no entry point that could act on one.
                                rollbackState: promotion.lastKnownGood ? "available" : "none",
                                evidenceIDs: [evidence.id],
                                recordedAt: new Date().toISOString(),
                            }));
                            return [4 /*yield*/, announcePromotionFollowUp(ctx, changes.map(function (change) { return change.path; }))];
                        case 18:
                            _e.sent();
                            return [2 /*return*/, changes];
                        case 19:
                            error_2 = _e.sent();
                            // A conflict is a state, not just a failure: the candidate needs
                            // rebasing, and the sandbox itself is what says so. Reported before the
                            // evidence record so a consumer watching status sees it either way.
                            if (error_2 instanceof sandbox_1.SandboxPromotionConflict)
                                ctx.ports.publishForSession(owner, sandboxes.updateEvent(id, "conflicted"));
                            return [4 /*yield*/, publishPromotionEvidence({
                                    status: "failed",
                                    result: "failed",
                                    output: error_2 instanceof Error ? error_2.message : String(error_2),
                                    durationMs: performance.now() - startedAt,
                                    knownGaps: [
                                        error_2 instanceof sandbox_1.SandboxPromotionConflict
                                            ? "promotion refused; host unchanged, candidate must be rebased " +
                                                "(".concat(error_2.paths.length, " conflicting path(s))")
                                            : "promotion did not land; host unchanged",
                                    ],
                                })];
                        case 20:
                            _e.sent();
                            throw error_2;
                        case 21: return [2 /*return*/];
                    }
                });
            });
        },
        sandboxRollback: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var owner, sandboxes, preview, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, sessionOwner(sessionID)];
                        case 2:
                            owner = _a.sent();
                            return [4 /*yield*/, assertSandboxOwned(ctx, owner, id)];
                        case 3:
                            _a.sent();
                            sandboxes = requireSandboxes();
                            return [4 /*yield*/, sandboxes.previewMerge(id)];
                        case 4:
                            preview = _a.sent();
                            return [4 /*yield*/, ctx.ports.authorizeSandboxMerge({ id: id, paths: preview.map(function (change) { return change.path; }) }, owner)];
                        case 5:
                            _a.sent();
                            return [4 /*yield*/, sandboxes.rollback(id)];
                        case 6:
                            result = _a.sent();
                            if (result.restored) {
                                ctx.ports.publishForSession(owner, sandboxes.updateEvent(id));
                                ctx.ports.publishForSession(owner, sandboxes.auditEvent(id, "rollback"));
                            }
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        sandboxDelete: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var owner, sandboxes, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, sessionOwner(sessionID)];
                        case 2:
                            owner = _a.sent();
                            return [4 /*yield*/, assertSandboxOwned(ctx, owner, id)];
                        case 3:
                            _a.sent();
                            sandboxes = requireSandboxes();
                            return [4 /*yield*/, ctx.ports.authorizeSandboxManagement("sandbox_delete", { id: id }, owner)];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, sandboxes.delete(id)];
                        case 5:
                            result = _a.sent();
                            ctx.ports.publishForSession(owner, {
                                type: "sandbox.update",
                                id: id,
                                status: "deleted",
                                root: "",
                                isolationLevel: "workspace",
                                changedFiles: result.pendingChanges.length,
                                runningResources: result.runningResources.length,
                                target: { kind: "host", cwd: ctx.ports.getWorkspaceRoot() },
                                resourcePolicy: "sandbox deleted after resource cleanup",
                            });
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        sandboxResourceStop: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var owner, sandboxes, resource;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, sessionOwner(input.sessionID)];
                        case 2:
                            owner = _a.sent();
                            return [4 /*yield*/, assertSandboxOwned(ctx, owner, input.id)];
                        case 3:
                            _a.sent();
                            sandboxes = requireSandboxes();
                            return [4 /*yield*/, ctx.ports.authorizeSandboxManagement("sandbox_resource_stop", input, owner)];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, sandboxes.stopResource(input.id, input.resourceID)];
                        case 5:
                            resource = _a.sent();
                            ctx.ports.publishForSession(owner, sandboxes.updateEvent(input.id));
                            ctx.ports.publishForSession(owner, sandboxes.auditEvent(input.id, "resource_stop"));
                            return [2 /*return*/, resource];
                    }
                });
            });
        },
    };
}
function evidenceChangeType(kind) {
    if (kind === "add")
        return "added";
    if (kind === "delete")
        return "deleted";
    return "modified";
}
function announcePromotionFollowUp(ctx, paths) {
    return __awaiter(this, void 0, void 0, function () {
        var frameworkTouched, families, _i, families_1, family, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    frameworkTouched = paths.some(function (path) {
                        return path.startsWith("packages/framework/") || path.startsWith("apps/cli/");
                    });
                    if (frameworkTouched) {
                        ctx.ports.publish({
                            type: "diagnostic",
                            level: "warning",
                            message: "restart_required",
                        });
                        return [2 /*return*/];
                    }
                    families = new Set(paths
                        .map(function (path) {
                        var match = /^packages\/plugins\/tools\/([^/]+)\//u.exec(path);
                        return match === null || match === void 0 ? void 0 : match[1];
                    })
                        .filter(function (family) { return Boolean(family); }));
                    _i = 0, families_1 = families;
                    _b.label = 1;
                case 1:
                    if (!(_i < families_1.length)) return [3 /*break*/, 6];
                    family = families_1[_i];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, ctx.ports.hotReloadToolFamily(family)];
                case 3:
                    _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    ctx.ports.publish({
                        type: "diagnostic",
                        level: "warning",
                        message: "tool family reload failed: ".concat(family),
                    });
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
