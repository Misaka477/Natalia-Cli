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
exports.createRecordValidationTool = createRecordValidationTool;
exports.createRecordCompletionTool = createRecordCompletionTool;
exports.createRecordDecisionTool = createRecordDecisionTool;
exports.createDriftAcknowledgeTool = createDriftAcknowledgeTool;
/**
 * Model-facing journal record tools — runtime/record-tools.ts.
 *
 * EI §8.4: thin model-facing wrappers around the existing intelligence
 * surface writes (`record_decision`, `record_validation`, `record_completion`).
 * They exist so the model can put durable facts into the journal through the
 * same pure builders the surfaces use — the event vocabulary stays the
 * journal-face one and no prompt ever carries the正文.
 */
var work_ledger_1 = require("@natalia/work-ledger");
var governance_ledger_1 = require("@natalia/governance-ledger");
var session_1 = require("@anthelia/session");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var audit_request_1 = require("./audit-request");
var redaction_1 = require("./engineering-intelligence/redaction");
var validation_1 = require("./engineering-intelligence/validation");
var substrate_1 = require("@anthelia/substrate");
function resolveExec(ctx, sessionID) {
    var exec = sessionID
        ? ctx.ports
            .getExecutionBySession()
            .get(sessionID)
        : undefined;
    return exec !== null && exec !== void 0 ? exec : ctx.ports.getActiveExec();
}
function requireWorkLedger(ctx) {
    return ctx.state.serviceDirectory.getOptional(work_ledger_1.workLedgerController);
}
function requireGovernanceLedger(ctx) {
    return ctx.state.serviceDirectory.getOptional(governance_ledger_1.governanceLedgerController);
}
/**
 * `record_validation` — runs a validation command in the workspace and writes
 * an `evidence.recorded` event (EI §3.5: validation is a first-class, cheap,
 * recordable action; evidence is how a claim earns judge-ability).
 */
function createRecordValidationTool(ctx) {
    return {
        name: "record_validation",
        description: "Run a validation command (test runner, typechecker, linter) in the workspace and record the result as durable evidence. Use it after implementing a step so the work has evidence, not claims. Returns passed/failed and a bounded safe summary. The command runs with the same approval boundary as run_shell.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                taskID: {
                    type: "string",
                    description: "The task or plan step this validation covers.",
                },
                objective: {
                    type: "string",
                    description: "What the validation is meant to establish.",
                },
                command: {
                    type: "string",
                    description: "The command to run in the workspace (for example `bun test packages/framework/runtime`).",
                },
                knownGaps: {
                    type: "array",
                    items: { type: "string" },
                    description: "Known gaps or caveats about this validation.",
                },
            },
            required: ["taskID", "objective", "command"],
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, exec, ledger, startedAt, recordedAt, result, safeSummary, artifactRef, run, name_1, relative, absolute, _a, error_1, outcome, repoRefs;
                var _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            args = parsed;
                            exec = resolveExec(ctx, context.sessionID);
                            ledger = requireGovernanceLedger(ctx);
                            if (!exec)
                                return [2 /*return*/, "no session"];
                            if (!ledger)
                                return [2 /*return*/, "governance ledger unavailable"];
                            if (!((_b = args.taskID) === null || _b === void 0 ? void 0 : _b.trim()) ||
                                !((_c = args.objective) === null || _c === void 0 ? void 0 : _c.trim()) ||
                                !((_d = args.command) === null || _d === void 0 ? void 0 : _d.trim()))
                                return [2 /*return*/, "record_validation requires taskID, objective and command"];
                            startedAt = performance.now();
                            recordedAt = new Date().toISOString();
                            result = "failed";
                            safeSummary = "validation command did not run";
                            _e.label = 1;
                        case 1:
                            _e.trys.push([1, 8, , 9]);
                            return [4 /*yield*/, (0, validation_1.runValidationCommand)(args.command, ctx.ports.getWorkspaceRoot(), 120)];
                        case 2:
                            run = _e.sent();
                            result = run.exitCode === 0 ? "passed" : "failed";
                            safeSummary = run.safeSummary;
                            if (!(run.fullOutput.length > run.safeSummary.length)) return [3 /*break*/, 7];
                            name_1 = "validation:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextEvidenceSequence());
                            relative = ".natalia/artifacts/".concat(name_1.replace(/[^a-zA-Z0-9:_-]/gu, "_"), ".log");
                            _e.label = 3;
                        case 3:
                            _e.trys.push([3, 6, , 7]);
                            absolute = (0, node_path_1.join)(ctx.ports.getWorkspaceRoot(), relative);
                            return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(ctx.ports.getWorkspaceRoot(), ".natalia", "artifacts"), {
                                    recursive: true,
                                })];
                        case 4:
                            _e.sent();
                            return [4 /*yield*/, (0, promises_1.writeFile)(absolute, run.fullOutput, "utf8")];
                        case 5:
                            _e.sent();
                            artifactRef = relative;
                            return [3 /*break*/, 7];
                        case 6:
                            _a = _e.sent();
                            // A failed artifact write must not fail the validation record.
                            artifactRef = undefined;
                            return [3 /*break*/, 7];
                        case 7: return [3 /*break*/, 9];
                        case 8:
                            error_1 = _e.sent();
                            safeSummary = "validation runner failed: ".concat(error_1 instanceof Error ? error_1.message : String(error_1));
                            return [3 /*break*/, 9];
                        case 9:
                            outcome = ledger.boundValidationOutcome(__assign(__assign({ command: (0, redaction_1.redactToolOutput)(args.command, true), result: result, safeSummary: safeSummary }, (artifactRef ? { artifactRef: artifactRef } : {})), { durationMs: performance.now() - startedAt }));
                            return [4 /*yield*/, (0, substrate_1.captureRepositoryEvidenceFields)(ctx.ports.getWorkspaceRoot())];
                        case 10:
                            repoRefs = _e.sent();
                            ctx.ports.publishForSession(exec, ledger.buildEvidenceRecorded(__assign(__assign(__assign({ id: "evidence:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextEvidenceSequence()), taskID: args.taskID.trim(), objective: args.objective.trim(), status: result === "passed" ? "validated" : "failed", validations: [outcome] }, (args.knownGaps ? { knownGaps: args.knownGaps } : {})), { recordedAt: recordedAt, environment: "".concat(process.platform, "/").concat(process.arch) }), repoRefs)));
                            return [2 /*return*/, JSON.stringify({
                                    recorded: true,
                                    result: result,
                                    safeSummary: outcome.safeSummary,
                                })];
                    }
                });
            });
        },
    };
}
/**
 * `record_completion` — writes the completion card (EI P2 E4): the fixed
 * report structure that answers "is it really done, what evidence is
 * missing". Safe prose only — never a diff or file content.
 */
function createRecordCompletionTool(ctx) {
    return {
        name: "record_completion",
        description: "Record a completion card for a finished task: what changed (a summary, never a diff), behavior impact, the validations that back it, known gaps, rollback state, and the evidence IDs it relies on. Use it when a task is done and the claim needs a judge-able record.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                taskID: { type: "string" },
                objective: { type: "string" },
                changeSummary: {
                    type: "string",
                    description: "A summary of what changed (never a diff or file content).",
                },
                behaviorImpact: { type: "string" },
                validations: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            command: { type: "string" },
                            result: {
                                type: "string",
                                enum: ["passed", "failed", "skipped"],
                            },
                            safeSummary: { type: "string" },
                        },
                        required: ["command", "result", "safeSummary"],
                        additionalProperties: false,
                    },
                },
                humanValidation: { type: "string" },
                knownGaps: { type: "array", items: { type: "string" } },
                externalSideEffects: { type: "array", items: { type: "string" } },
                rollbackState: {
                    type: "string",
                    enum: ["clean", "available", "none", "needs_promotion"],
                },
                evidenceIDs: { type: "array", items: { type: "string" } },
                changePaths: { type: "array", items: { type: "string" } },
            },
            required: ["taskID", "objective", "changeSummary"],
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, exec, ledger, recordedAt, completionID, completionEvent, workLedger, _i, _a, path, card;
                var _b, _c, _d, _e, _f, _g, _h, _j;
                return __generator(this, function (_k) {
                    args = parsed;
                    exec = resolveExec(ctx, context.sessionID);
                    ledger = requireGovernanceLedger(ctx);
                    if (!exec)
                        return [2 /*return*/, "no session"];
                    if (!ledger)
                        return [2 /*return*/, "governance ledger unavailable"];
                    if (!((_b = args.taskID) === null || _b === void 0 ? void 0 : _b.trim()) ||
                        !((_c = args.objective) === null || _c === void 0 ? void 0 : _c.trim()) ||
                        !((_d = args.changeSummary) === null || _d === void 0 ? void 0 : _d.trim()))
                        return [2 /*return*/, "record_completion requires taskID, objective and changeSummary"];
                    recordedAt = new Date().toISOString();
                    completionID = "completion:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextCompletionSequence());
                    completionEvent = ledger.buildCompletionRecorded(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ id: completionID, taskID: args.taskID.trim(), objective: args.objective.trim(), changeSummary: (0, redaction_1.redactToolOutput)(args.changeSummary, true) }, (args.behaviorImpact
                        ? { behaviorImpact: (0, redaction_1.redactToolOutput)(args.behaviorImpact, true) }
                        : {})), { validations: ((_e = args.validations) !== null && _e !== void 0 ? _e : []).map(function (validation) {
                            return ledger.boundValidationOutcome({
                                command: (0, redaction_1.redactToolOutput)(validation.command, true),
                                result: validation.result,
                                safeSummary: validation.safeSummary,
                            });
                        }) }), (args.humanValidation
                        ? { humanValidation: (0, redaction_1.redactToolOutput)(args.humanValidation, true) }
                        : {})), (args.knownGaps ? { knownGaps: args.knownGaps } : {})), (args.externalSideEffects
                        ? { externalSideEffects: args.externalSideEffects }
                        : {})), (args.rollbackState ? { rollbackState: args.rollbackState } : {})), (args.evidenceIDs ? { evidenceIDs: args.evidenceIDs } : {})), { recordedAt: recordedAt }));
                    ctx.ports.publishForSession(exec, completionEvent);
                    (0, audit_request_1.requestAuditAfterCompletion)(ctx, exec, completionEvent);
                    workLedger = requireWorkLedger(ctx);
                    if (workLedger) {
                        // E4: the completion is itself a validation-class node; the
                        // validated_by edges connect the changed files to it. Without the
                        // node first, the edge would point at an absent graph target.
                        ctx.ports.publishForSession(exec, workLedger.completionNode(__assign({ completionID: completionID, taskID: args.taskID.trim(), sessionID: exec.session.id }, (exec.activeTurnID ? { turnID: exec.activeTurnID } : {}))));
                        for (_i = 0, _a = (_f = args.changePaths) !== null && _f !== void 0 ? _f : []; _i < _a.length; _i++) {
                            path = _a[_i];
                            ctx.ports.publishForSession(exec, workLedger.completionValidationEdge({
                                changeID: args.taskID.trim(),
                                path: path,
                                completionID: completionID,
                            }));
                        }
                    }
                    card = requireWorkLedger(ctx).evaluateCompletionCard(__assign(__assign({ objective: args.objective.trim() }, (((_g = args.changePaths) === null || _g === void 0 ? void 0 : _g.length) ? { changes: args.changePaths } : {})), { evidenceRefs: (_h = args.evidenceIDs) !== null && _h !== void 0 ? _h : [], validations: (_j = args.validations) !== null && _j !== void 0 ? _j : [] }));
                    return [2 /*return*/, JSON.stringify(__assign({ recorded: true, completionID: completionID, card: card }, (card.missing.length
                            ? {
                                missingEvidence: card.missing,
                                hint: "".concat(card.note, "; record the missing validation with record_validation before claiming done"),
                            }
                            : {})))];
                });
            });
        },
    };
}
/**
 * `record_decision` — writes a `decision.recorded` event: the durable fact of
 * a choice with its rationale, alternatives and consequences. Safe prose only;
 * never tool output, file content or secrets.
 */
function createRecordDecisionTool(ctx) {
    return {
        name: "record_decision",
        description: "Record a durable engineering decision: the choice, why it was made, what alternatives were rejected and why, and the consequences. Use it when the session made (or should remember) a non-obvious choice — future drift judgment and audits read this record.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                decision: { type: "string" },
                rationale: { type: "array", items: { type: "string" } },
                alternatives: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            option: { type: "string" },
                            rejectedReason: { type: "string" },
                        },
                        required: ["option"],
                        additionalProperties: false,
                    },
                },
                consequences: { type: "array", items: { type: "string" } },
                linkedPlans: { type: "array", items: { type: "string" } },
                linkedConstraints: { type: "array", items: { type: "string" } },
            },
            required: ["decision"],
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, exec, ledger, decisionEvent, workLedger;
                var _a;
                return __generator(this, function (_b) {
                    args = parsed;
                    exec = resolveExec(ctx, context.sessionID);
                    ledger = requireGovernanceLedger(ctx);
                    if (!exec)
                        return [2 /*return*/, "no session"];
                    if (!ledger)
                        return [2 /*return*/, "governance ledger unavailable"];
                    if (!((_a = args.decision) === null || _a === void 0 ? void 0 : _a.trim()))
                        return [2 /*return*/, "record_decision requires decision"];
                    decisionEvent = ledger.recordDecision(__assign(__assign(__assign(__assign(__assign({ id: "decision:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextDecisionSequence()), decision: (0, redaction_1.redactToolOutput)(args.decision, true) }, (args.rationale
                        ? {
                            rationale: args.rationale.map(function (entry) {
                                return (0, redaction_1.redactToolOutput)(entry, true);
                            }),
                        }
                        : {})), (args.alternatives ? { alternatives: args.alternatives } : {})), (args.consequences
                        ? {
                            consequences: args.consequences.map(function (entry) {
                                return (0, redaction_1.redactToolOutput)(entry, true);
                            }),
                        }
                        : {})), (args.linkedPlans ? { linkedPlans: args.linkedPlans } : {})), (args.linkedConstraints
                        ? { linkedConstraints: args.linkedConstraints }
                        : {})));
                    ctx.ports.publishForSession(exec, decisionEvent);
                    workLedger = requireWorkLedger(ctx);
                    if (workLedger && decisionEvent.type === "decision.recorded")
                        ctx.ports.publishForSession(exec, workLedger.decisionNode({
                            decisionID: decisionEvent.id,
                            decision: decisionEvent.decision,
                            sessionID: exec.session.id,
                        }));
                    return [2 /*return*/, JSON.stringify({ recorded: true })];
                });
            });
        },
    };
}
/**
 * `drift_acknowledge` — the model's side of the status matrix (EI §8.6): the
 * Main Agent acknowledges an open drift finding with a rationale (explained),
 * disputes it (disputed), or declares a sanctioned detour
 * (detour_declared). Only an open finding can transition; the rationale is
 * safe prose, redacted before the journal.
 */
function createDriftAcknowledgeTool(ctx) {
    return {
        name: "drift_acknowledge",
        description: "Acknowledge an open drift finding: explain it with a rationale (explained), disagree with the finding (disputed), or declare a sanctioned detour the user should know about (detour_declared). Use it when a drift finding fires and you have a real answer — a finding left open keeps escalating.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                findingID: {
                    type: "string",
                    description: "The exact findingID from the drift finding.",
                },
                status: {
                    type: "string",
                    enum: ["explained", "disputed", "detour_declared"],
                    description: "explained: the finding is understood and addressed; disputed: you disagree; detour_declared: a sanctioned detour.",
                },
                rationale: {
                    type: "string",
                    description: "Why — safe prose, never content or commands.",
                },
            },
            required: ["findingID", "status"],
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, exec, governanceLedger, openFindings, finding;
                var _a;
                return __generator(this, function (_b) {
                    args = parsed;
                    exec = resolveExec(ctx, context.sessionID);
                    if (!exec)
                        return [2 /*return*/, "no session"];
                    if (!((_a = args.findingID) === null || _a === void 0 ? void 0 : _a.trim()) || !args.status)
                        return [2 /*return*/, "drift_acknowledge requires findingID and status"];
                    governanceLedger = requireGovernanceLedger(ctx);
                    if (!governanceLedger)
                        return [2 /*return*/, "governance ledger unavailable"];
                    openFindings = (0, session_1.projectedDriftFindings)(exec.session.events).filter(function (finding) { return finding.findingID === args.findingID.trim(); });
                    finding = openFindings.at(-1);
                    if (!finding)
                        return [2 /*return*/, "no open drift finding ".concat(args.findingID)];
                    if (finding.status !== "open")
                        return [2 /*return*/, "drift finding ".concat(args.findingID, " is ").concat(finding.status, ", not open")];
                    ctx.ports.publishForSession(exec, requireWorkLedger(ctx).buildDriftFindingUpdate({
                        id: "drift:".concat(Date.now().toString(36), ":").concat(args.findingID),
                        findingID: args.findingID,
                        status: args.status,
                        rationale: args.rationale,
                    }));
                    return [2 /*return*/, JSON.stringify({ acknowledged: true, status: args.status })];
                });
            });
        },
    };
}
