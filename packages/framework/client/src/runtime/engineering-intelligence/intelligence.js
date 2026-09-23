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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
exports.createIntelligenceSurface = createIntelligenceSurface;
var session_store_1 = require("@anthelia/session-store");
var work_ledger_1 = require("@natalia/work-ledger");
var governance_ledger_1 = require("@natalia/governance-ledger");
var project_docs_1 = require("../project-docs");
var constitution_doc_1 = require("../constitution-doc");
var platform_1 = require("@natalia/platform");
var session_1 = require("@anthelia/session");
var contracts_1 = require("@natalia/contracts");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var governance_ledger_2 = require("@natalia/governance-ledger");
var work_ledger_2 = require("@natalia/work-ledger");
var audit_request_1 = require("../audit-request");
var substrate_1 = require("@anthelia/substrate");
var collab_1 = require("@natalia/collab");
var substrate_2 = require("@anthelia/substrate");
var redaction_1 = require("./redaction");
var validation_1 = require("./validation");
var substrate_3 = require("@anthelia/substrate");
function projectedCanonicalToolsWithFallback(events) {
    return __awaiter(this, void 0, void 0, function () {
        var projectedCanonicalToolsInWorker, result, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@anthelia/substrate"); })];
                case 1:
                    projectedCanonicalToolsInWorker = (_b.sent()).projectedCanonicalToolsInWorker;
                    return [4 /*yield*/, projectedCanonicalToolsInWorker(events)];
                case 2:
                    result = (_b.sent());
                    return [2 /*return*/, result];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, (0, session_1.projectedCanonicalTools)(events)];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function runSessionProjectionWithFallback(name, events) {
    return __awaiter(this, void 0, void 0, function () {
        var runSessionProjectionInWorker, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@anthelia/substrate"); })];
                case 1:
                    runSessionProjectionInWorker = (_b.sent()).runSessionProjectionInWorker;
                    return [4 /*yield*/, runSessionProjectionInWorker(name, events)];
                case 2: return [2 /*return*/, _b.sent()];
                case 3:
                    _a = _b.sent();
                    switch (name) {
                        case "planDocs":
                            return [2 /*return*/, (0, session_1.projectedPlanDocs)(events)];
                        case "evidenceRecords":
                            return [2 /*return*/, (0, session_1.projectedEvidenceRecords)(events)];
                        case "constitutionRules":
                            return [2 /*return*/, (0, session_1.projectedConstitutionRules)(events)];
                        case "decisionRecords":
                            return [2 /*return*/, (0, session_1.projectedDecisionRecords)(events)];
                        case "workGraphNodes":
                            return [2 /*return*/, (0, session_1.projectedWorkGraphNodes)(events)];
                        case "workGraphEdges":
                            return [2 /*return*/, (0, session_1.projectedWorkGraphEdges)(events)];
                        case "mailboxMessages":
                            return [2 /*return*/, (0, session_1.projectedMailboxMessages)(events)];
                        case "collabMessages":
                            return [2 /*return*/, (0, session_1.projectedCollabMessages)(events)];
                        case "notices":
                            return [2 /*return*/, (0, session_1.projectedRuntimeNotices)(events)];
                    }
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * B6 read-surface helper: fold the session's hot fact state (O(1) over the
 * live window) instead of rescanning the full journal when it is complete;
 * fall back to the projected-events path for a tail-only attach. Returns the
 * fact-state slice and whether it was used.
 */
/**
 * EI Phase 1 "降档": when the bounded hot state evicted terminal facts, a read
 * that needs the complete set reconstructs it by paging the durable log (降档≠
 * 丢失). Falls back to the live events when no store can page.
 */
function readCompleteFacts(ctx, exec, project) {
    return __awaiter(this, void 0, void 0, function () {
        var store, events, offset, page, _i, _a, entry;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    store = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                    if (!store)
                        return [2 /*return*/, project(exec.session.events)];
                    events = [];
                    offset = 0;
                    _b.label = 1;
                case 1: return [4 /*yield*/, store.history(exec.session.id, exec.session.events, {
                        offset: offset,
                        limit: 2000,
                    })];
                case 2:
                    page = _b.sent();
                    for (_i = 0, _a = page.events; _i < _a.length; _i++) {
                        entry = _a[_i];
                        events.push(entry.event);
                    }
                    if (!page.hasMore || page.events.length === 0)
                        return [3 /*break*/, 4];
                    offset += page.events.length;
                    _b.label = 3;
                case 3: return [3 /*break*/, 1];
                case 4: return [2 /*return*/, project(events)];
            }
        });
    });
}
function readFactSlice(exec, select, fallback) {
    if (exec.factStateComplete === true && exec.factState)
        return select(exec.factState);
    return fallback();
}
/** Pagination for a read surface: cursor is an offset, limit bounded. */
/**
 * The governance list page shape (EI Phase 1, mailbox_status parity): the same
 * `{ items, returned, total, truncated, nextCursor }` envelope for decisions /
 * evidence / completions / drift, so every list surface paginates identically.
 * Called with no limit/cursor it returns the whole set as one page
 * (`truncated: false`), preserving the pre-pagination read for callers that
 * want everything.
 */
function paginate(items, limit, cursor) {
    var total = items.length;
    var parsed = cursor ? Number(cursor) : 0;
    var offset = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
    var size = limit !== null && limit !== void 0 ? limit : total;
    var page = items.slice(offset, offset + Math.max(size, 1));
    var returned = page.length;
    var truncated = offset + returned < total;
    return __assign({ items: page, returned: returned, total: total, truncated: truncated }, (truncated ? { nextCursor: String(offset + returned) } : {}));
}
/** The external decision view: the journal fact plus its data scope. */
function decisionView(record, scope) {
    var _a, _b, _c, _d, _e;
    return {
        id: record.id,
        scope: scope,
        decision: record.decision,
        rationale: (_a = record.rationale) !== null && _a !== void 0 ? _a : [],
        alternatives: (_b = record.alternatives) !== null && _b !== void 0 ? _b : [],
        consequences: (_c = record.consequences) !== null && _c !== void 0 ? _c : [],
        status: record.status,
        linkedPlans: (_d = record.linkedPlans) !== null && _d !== void 0 ? _d : [],
        linkedConstraints: (_e = record.linkedConstraints) !== null && _e !== void 0 ? _e : [],
    };
}
/**
 * True when the rule is release-scope runtime self-protection (EI §3.8 P-1.c):
 * it cannot be edited or removed by any UI action, only bypassed through the
 * explicit override path.
 */
/**
 * EI §3.8 P-1.c, per the user's decision (硬保护不能删，其余用户可删改): only the
 * rules backed by the tool-execution `SELF_PROTECTION_PATTERNS` are locked from
 * UI edits; release-scope runtime-policy rules (C-REL-*) and user rules are
 * editable/disableable/deletable. The shared set lives in @natalia/contracts so
 * the runtime and the governance UI agree on exactly which rules are protected.
 */
function isHardProtectedRule(ruleID) {
    return (0, contracts_1.isHardProtectedConstitutionRule)(ruleID);
}
function createIntelligenceSurface(ctx, options) {
    function requireGovernanceLedger() {
        var ledger = ctx.state.serviceDirectory.getOptional(governance_ledger_1.governanceLedgerController);
        if (!ledger)
            throw new Error("governance ledger unavailable (natalia-governance-ledger)");
        return ledger;
    }
    function requireWorkLedger() {
        var ledger = ctx.state.serviceDirectory.get(work_ledger_1.workLedgerController);
        return ledger;
    }
    function intelligenceExecWindow(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var exec, _a, _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: 
                    // `start()` only kicks composition off in the background. Intelligence
                    // reads may be the first routed calls on a workspace proxy, so every
                    // surface must wait for the session-store before ensureExecution runs.
                    return [4 /*yield*/, ctx.ports.getReady()];
                    case 1:
                        // `start()` only kicks composition off in the background. Intelligence
                        // reads may be the first routed calls on a workspace proxy, so every
                        // surface must wait for the session-store before ensureExecution runs.
                        _d.sent();
                        if (!sessionID) return [3 /*break*/, 5];
                        if (!((_c = ctx.ports
                            .getExecutionBySession()
                            .get(sessionID)) !== null && _c !== void 0)) return [3 /*break*/, 2];
                        _b = _c;
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, ctx.ports.ensureExecution(sessionID)];
                    case 3:
                        _b = (_d.sent());
                        _d.label = 4;
                    case 4:
                        _a = (_b);
                        return [3 /*break*/, 6];
                    case 5:
                        _a = ctx.ports.getActiveExec();
                        _d.label = 6;
                    case 6:
                        exec = _a;
                        return [2 /*return*/, exec];
                }
            });
        });
    }
    /**
     * Read surfaces must see the same history the writer saw. Fast attach keeps
     * only a tail; complete the fact state before reading so a finding opened
     * outside the current window is still returned after it is updated.
     */
    function completeIntelligenceExec(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var exec;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                    case 1:
                        exec = _a.sent();
                        if (!(exec === null || exec === void 0 ? void 0 : exec.session)) return [3 /*break*/, 3];
                        return [4 /*yield*/, (0, substrate_1.ensureCompleteSessionFactState)(ctx, exec)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/, exec];
                }
            });
        });
    }
    return {
        confirmedWorkspaceChanges: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, reconciled, _a, logPath, rows, _b, _c, seen, merged, _i, rows_1, row, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _e.sent();
                            return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 2:
                            exec = _e.sent();
                            if (!exec) return [3 /*break*/, 4];
                            return [4 /*yield*/, ctx.ports.reconcileWorkspaceObservation(exec)];
                        case 3:
                            _a = _e.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            _a = [];
                            _e.label = 5;
                        case 5:
                            reconciled = _a;
                            _e.label = 6;
                        case 6:
                            _e.trys.push([6, 8, , 9]);
                            logPath = (0, node_path_1.resolve)(ctx.ports.getWorkspaceRoot(), ".natalia", "workspace-mutations.json");
                            _c = (_b = JSON).parse;
                            return [4 /*yield*/, (0, promises_1.readFile)(logPath, "utf8")];
                        case 7:
                            rows = _c.apply(_b, [_e.sent()]);
                            seen = new Set(reconciled.map(function (change) { return change.path; }));
                            merged = __spreadArray([], reconciled, true);
                            for (_i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                                row = rows_1[_i];
                                if (sessionID && row.sessionID !== sessionID)
                                    continue;
                                if (seen.has(row.path))
                                    continue;
                                seen.add(row.path);
                                merged.push({
                                    id: "mutation:".concat(row.path),
                                    workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                    path: row.path,
                                    operation: row.operation === "add"
                                        ? "added"
                                        : row.operation === "delete"
                                            ? "deleted"
                                            : row.operation === "rename"
                                                ? "renamed"
                                                : "modified",
                                    origin: "tool",
                                    attribution: row.sessionID ? "attributed" : "unattributed",
                                    correlation: row.sessionID ? { sessionID: row.sessionID } : {},
                                    health: "healthy",
                                    at: new Date().toISOString(),
                                });
                            }
                            return [2 /*return*/, merged];
                        case 8:
                            _d = _e.sent();
                            return [2 /*return*/, reconciled];
                        case 9: return [2 /*return*/];
                    }
                });
            });
        },
        constitutionRules: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, instance, rules;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, completeIntelligenceExec(sessionID)];
                        case 1:
                            exec = _a.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, []];
                            instance = (0, governance_ledger_2.loadInstanceGovernance)((0, governance_ledger_2.resolveGovernanceRoot)(ctx.ports.getWorkspaceRoot()));
                            return [4 /*yield*/, runSessionProjectionWithFallback("constitutionRules", __spreadArray(__spreadArray([], instance.events, true), exec.session.events, true))];
                        case 2:
                            rules = (_a.sent());
                            return [2 /*return*/, rules.map(function (r) { return (__assign(__assign(__assign({ ruleID: r.ruleID, statement: r.statement, scope: r.scope, priority: r.priority, source: r.source, enforcement: r.enforcement, overridePolicy: r.overridePolicy }, (r.appliesTo ? { appliesTo: r.appliesTo } : {})), (r.proposedBy ? { proposedBy: r.proposedBy } : {})), (r.approvedBy ? { approvedBy: r.approvedBy } : {}))); })];
                    }
                });
            });
        },
        decisionRecords: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var params, sessionID, scope, exec, sessionDecisionRecords, _a, sessionRecords, instance, workspaceRecords, seen, merged, _i, _b, record;
                var _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            params = typeof input === "string" ? {} : (input !== null && input !== void 0 ? input : {});
                            sessionID = typeof input === "string" ? input : input === null || input === void 0 ? void 0 : input.sessionID;
                            scope = typeof input === "string" ? "session" : ((_c = input === null || input === void 0 ? void 0 : input.scope) !== null && _c !== void 0 ? _c : "session");
                            return [4 /*yield*/, completeIntelligenceExec(sessionID)];
                        case 1:
                            exec = _d.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, paginate([], params.limit, params.cursor)];
                            if (!exec.factStateTerminalEvicted) return [3 /*break*/, 3];
                            return [4 /*yield*/, readCompleteFacts(ctx, exec, session_1.projectedDecisionRecords)];
                        case 2:
                            _a = _d.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            _a = readFactSlice(exec, session_1.sessionFactDecisionRecords, function () {
                                return (0, session_1.projectedDecisionRecords)(exec.session.events);
                            });
                            _d.label = 4;
                        case 4:
                            sessionDecisionRecords = _a;
                            sessionRecords = sessionDecisionRecords
                                .filter(function (record) { return record.scope !== "workspace"; })
                                .map(function (record) { return decisionView(record, "session"); });
                            if (scope === "session")
                                return [2 /*return*/, paginate(sessionRecords, params.limit, params.cursor)];
                            instance = (0, governance_ledger_2.loadInstanceGovernance)((0, governance_ledger_2.resolveGovernanceRoot)(ctx.ports.getWorkspaceRoot()));
                            workspaceRecords = (0, session_1.projectedDecisionRecords)(instance.events)
                                .filter(function (record) { return record.scope !== "session"; })
                                .map(function (record) { return decisionView(record, "workspace"); });
                            if (scope === "workspace")
                                return [2 /*return*/, paginate(workspaceRecords, params.limit, params.cursor)];
                            seen = new Set();
                            merged = [];
                            for (_i = 0, _b = __spreadArray(__spreadArray([], workspaceRecords, true), sessionRecords, true); _i < _b.length; _i++) {
                                record = _b[_i];
                                if (seen.has(record.id))
                                    continue;
                                seen.add(record.id);
                                merged.push(record);
                            }
                            return [2 /*return*/, paginate(merged, params.limit, params.cursor)];
                    }
                });
            });
        },
        /**
         * The `decision.recorded` production writer. Decisions are durable facts —
         * a decision text and rationale may reach the journal — so this is the
         * surface the Chat/override loop (CST3) records through. The event
         * constructor in `constitution-ledger.ts` keeps the secret-safe boundary:
         * decision text and rationale are prose, never tool output or file content.
         */
        recordDecision: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, requestedScope, decisionInput, scope, event;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            exec = _a.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, { recorded: false }];
                            requestedScope = input.scope, decisionInput = __rest(input, ["scope"]);
                            scope = requestedScope === "workspace" ? "workspace" : "session";
                            event = requireGovernanceLedger().recordDecision(__assign(__assign({ id: "decision:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextDecisionSequence()) }, decisionInput), (scope === "workspace" ? { scope: scope } : {})));
                            // Workspace promotion is explicit opt-in; the default session decision
                            // never reaches the shared instance file and therefore cannot leak into
                            // another session's governance panel.
                            if (scope === "workspace" && event.status === "accepted")
                                (0, governance_ledger_2.appendInstanceEvent)((0, governance_ledger_2.resolveGovernanceRoot)(ctx.ports.getWorkspaceRoot()), "decisions.jsonl", event);
                            ctx.ports.publishForSession(exec, event);
                            // CST4 Work Graph linkage: the decision is a `decision` node in the graph.
                            ctx.ports.publishForSession(exec, requireWorkLedger().decisionNode({
                                decisionID: event.id,
                                decision: event.decision,
                                sessionID: exec.session.id,
                            }));
                            return [2 /*return*/, { recorded: true }];
                    }
                });
            });
        },
        evidenceRecords: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var resolvedSessionID, exec, plans, planStateForTask, _i, plans_1, plan, evidence, _a;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            resolvedSessionID = (_b = input === null || input === void 0 ? void 0 : input.sessionID) !== null && _b !== void 0 ? _b : sessionID;
                            return [4 /*yield*/, completeIntelligenceExec(resolvedSessionID)];
                        case 1:
                            exec = _c.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, paginate([], input === null || input === void 0 ? void 0 : input.limit, input === null || input === void 0 ? void 0 : input.cursor)];
                            plans = ctx.ports.planDocRuntime.planDocSnapshot();
                            planStateForTask = new Map();
                            for (_i = 0, plans_1 = plans; _i < plans_1.length; _i++) {
                                plan = plans_1[_i];
                                planStateForTask.set(plan.planID, plan.status);
                            }
                            if (!exec.factStateTerminalEvicted) return [3 /*break*/, 3];
                            return [4 /*yield*/, readCompleteFacts(ctx, exec, session_1.projectedEvidenceRecords)];
                        case 2:
                            _a = _c.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            _a = readFactSlice(exec, session_1.sessionFactEvidenceRecords, function () {
                                return (0, session_1.projectedEvidenceRecords)(exec.session.events);
                            });
                            _c.label = 4;
                        case 4:
                            evidence = (_a);
                            return [2 /*return*/, paginate(evidence.map(function (r) {
                                    var _a, _b, _c;
                                    return (__assign(__assign(__assign(__assign(__assign({ taskID: r.taskID, objective: r.objective, status: r.status, effectiveStatus: r.taskID && planStateForTask.has(r.taskID)
                                            ? requireGovernanceLedger().evidenceStatusForPlanState(planStateForTask.get(r.taskID), r.status)
                                            : r.status, changes: (_a = r.changes) !== null && _a !== void 0 ? _a : [], validations: (_b = r.validations) !== null && _b !== void 0 ? _b : [], knownGaps: (_c = r.knownGaps) !== null && _c !== void 0 ? _c : [] }, (r.recordedAt ? { recordedAt: r.recordedAt } : {})), (r.environment ? { environment: r.environment } : {})), (r.repositoryVersion
                                        ? { repositoryVersion: r.repositoryVersion }
                                        : {})), (r.commit ? { commit: r.commit } : {})), (r.manifestRef ? { manifestRef: r.manifestRef } : {})));
                                }), input === null || input === void 0 ? void 0 : input.limit, input === null || input === void 0 ? void 0 : input.cursor)];
                    }
                });
            });
        },
        completions: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var resolvedSessionID, exec, completions, _a, humanValidation;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            resolvedSessionID = (_b = input === null || input === void 0 ? void 0 : input.sessionID) !== null && _b !== void 0 ? _b : sessionID;
                            return [4 /*yield*/, completeIntelligenceExec(resolvedSessionID)];
                        case 1:
                            exec = _c.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, paginate([], input === null || input === void 0 ? void 0 : input.limit, input === null || input === void 0 ? void 0 : input.cursor)];
                            if (!exec.factStateTerminalEvicted) return [3 /*break*/, 3];
                            return [4 /*yield*/, readCompleteFacts(ctx, exec, session_1.projectedCompletions)];
                        case 2:
                            _a = _c.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            _a = readFactSlice(exec, session_1.sessionFactCompletions, function () {
                                return (0, session_1.projectedCompletions)(exec.session.events);
                            });
                            _c.label = 4;
                        case 4:
                            completions = _a;
                            humanValidation = exec.factStateComplete === true && exec.factState
                                ? (0, session_1.sessionFactHumanValidation)(exec.factState)
                                : new Map();
                            return [2 /*return*/, paginate(completions.map(function (c) {
                                    var _a, _b, _c, _d;
                                    var validated = (_a = humanValidation.get(c.taskID)) !== null && _a !== void 0 ? _a : c.humanValidation;
                                    return __assign(__assign(__assign(__assign(__assign(__assign({ completionID: c.id, taskID: c.taskID, objective: c.objective, changeSummary: c.changeSummary }, (c.behaviorImpact ? { behaviorImpact: c.behaviorImpact } : {})), { validations: c.validations }), (validated ? { humanValidation: validated } : {})), { knownGaps: (_b = c.knownGaps) !== null && _b !== void 0 ? _b : [], externalSideEffects: (_c = c.externalSideEffects) !== null && _c !== void 0 ? _c : [] }), (c.rollbackState ? { rollbackState: c.rollbackState } : {})), { evidenceIDs: (_d = c.evidenceIDs) !== null && _d !== void 0 ? _d : [], recordedAt: c.recordedAt });
                                }), input === null || input === void 0 ? void 0 : input.limit, input === null || input === void 0 ? void 0 : input.cursor)];
                    }
                });
            });
        },
        /**
         * EI Phase 0: the user records a human validation note on a completion card
         * ("用户走 UI 补 humanValidation"). Durable; `completions` merges the latest
         * note per task onto the card.
         */
        recordHumanValidation: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, taskID, validation, governanceLedger;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            exec = _c.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, { recorded: false, reason: "no session" }];
                            taskID = (_a = input.taskID) === null || _a === void 0 ? void 0 : _a.trim();
                            validation = (_b = input.validation) === null || _b === void 0 ? void 0 : _b.trim();
                            if (!taskID || !validation)
                                return [2 /*return*/, {
                                        recorded: false,
                                        reason: "recordHumanValidation requires taskID and validation",
                                    }];
                            governanceLedger = requireGovernanceLedger();
                            if (!governanceLedger)
                                return [2 /*return*/, {
                                        recorded: false,
                                        reason: "governance ledger unavailable",
                                    }];
                            ctx.ports.publishForSession(exec, governanceLedger.buildHumanValidation({
                                id: "human_validation:".concat(taskID, ":").concat(Date.now().toString(36), ":").concat(ctx.ports.nextDecisionSequence()),
                                taskID: taskID,
                                validation: (0, redaction_1.redactToolOutput)(validation, true),
                                recordedAt: new Date().toISOString(),
                            }));
                            return [2 /*return*/, { recorded: true }];
                    }
                });
            });
        },
        /**
         * The plan task state machine (EI §4 Phase 4): reads the plan document's
         * markdown checkboxes (the declaration source) and projects each against
         * the session's recorded evidence (the fact source), evidence-first. A
         * checked box with no backing evidence is a `gap`, never `verified`; a
         * skipped box stays visible. The planID defaults to the active plan.
         */
        planTaskStates: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var resolvedSessionID, exec, planID, _a, content, doc, _b, evidence;
                var _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            resolvedSessionID = (input === null || input === void 0 ? void 0 : input.planID) ? sessionID : sessionID;
                            return [4 /*yield*/, completeIntelligenceExec(resolvedSessionID)];
                        case 1:
                            exec = _e.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, []];
                            _a = ((_c = input === null || input === void 0 ? void 0 : input.planID) === null || _c === void 0 ? void 0 : _c.trim());
                            if (_a) return [3 /*break*/, 3];
                            return [4 /*yield*/, ctx.ports.planDocRuntime.planDocActive(exec.session.id)];
                        case 2:
                            _a = ((_d = (_e.sent())) === null || _d === void 0 ? void 0 : _d.planID);
                            _e.label = 3;
                        case 3:
                            planID = _a;
                            if (!planID)
                                return [2 /*return*/, []];
                            _e.label = 4;
                        case 4:
                            _e.trys.push([4, 6, , 7]);
                            return [4 /*yield*/, ctx.ports.planDocRuntime.planDocRead({
                                    planID: planID,
                                    sessionID: exec.session.id,
                                })];
                        case 5:
                            doc = _e.sent();
                            content = doc.content;
                            return [3 /*break*/, 7];
                        case 6:
                            _b = _e.sent();
                            return [2 /*return*/, []];
                        case 7:
                            evidence = __spreadArray(__spreadArray([], readFactSlice(exec, session_1.sessionFactEvidenceRecords, function () {
                                return (0, session_1.projectedEvidenceRecords)(exec.session.events);
                            }).map(function (record) { return ({
                                taskID: record.taskID,
                                objective: record.objective,
                            }); }), true), readFactSlice(exec, session_1.sessionFactCompletions, function () {
                                return (0, session_1.projectedCompletions)(exec.session.events);
                            }).map(function (record) { return ({
                                taskID: record.taskID,
                                objective: record.objective,
                            }); }), true);
                            return [2 /*return*/, (0, work_ledger_2.projectPlanTaskStates)((0, work_ledger_2.parsePlanTasks)(content), evidence)];
                    }
                });
            });
        },
        /**
         * Work Graph integrity (EI WG4 / Phase 3 D): rebuilds the graph from the
         * session's complete event history and verifies the causal chain is not
         * faked — no dangling edges, no silently-attributed (session-less) nodes,
         * no duplicate ids. A headless consumer can assert `stable` before trusting
         * the graph.
         */
        workGraphIntegrity: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, completeIntelligenceExec(sessionID)];
                        case 1:
                            exec = _a.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, {
                                        nodeCount: 0,
                                        edgeCount: 0,
                                        danglingEdges: [],
                                        incompleteNodes: [],
                                        duplicateNodeIDs: [],
                                        stable: true,
                                    }];
                            return [2 /*return*/, (0, work_ledger_2.verifyWorkGraphIntegrity)(exec.session.events)];
                    }
                });
            });
        },
        /**
         * The unattributed workspace changes (EI WG4 / Phase 3 D): the
         * `workspace_change` nodes an external reconcile produced with no reliable
         * turn identity. These are the changes the runtime could not attribute to a
         * tool call — surfaced for diagnosis, never silently folded into the
         * causal chain (EI §2 principle 5).
         */
        unattributedChanges: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, completeIntelligenceExec(sessionID)];
                        case 1:
                            exec = _a.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, []];
                            return [2 /*return*/, (0, work_ledger_2.unattributedChangeNodes)(exec.session.events).map(function (node) {
                                    var _a;
                                    return ({
                                        nodeID: node.nodeID,
                                        path: (_a = node.target) !== null && _a !== void 0 ? _a : "",
                                        sessionID: node.sessionID,
                                    });
                                })];
                    }
                });
            });
        },
        /**
         * The `evidence.recorded` production writer (E2 起步): runs a validation
         * command against the workspace, redacts secrets and truncates the summary,
         * then records the outcome as a durable evidence fact. This is the
         * validation-runner adapter — the command runs with the workspace as cwd,
         * bounded output and a timeout, and only the command, outcome, bounded safe
         * summary and duration reach the journal. Raw output never does.
         */
        recordValidation: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var owner, startedAt, result, safeSummary, run, error_1, outcome, repoRefs, event;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            owner = _b.sent();
                            if (!owner)
                                return [2 /*return*/, { recorded: false }];
                            if (typeof input.taskID !== "string" ||
                                input.taskID.trim().length === 0 ||
                                typeof input.objective !== "string" ||
                                input.objective.trim().length === 0 ||
                                typeof input.command !== "string" ||
                                input.command.trim().length === 0)
                                return [2 /*return*/, { recorded: false }];
                            startedAt = performance.now();
                            result = "failed";
                            safeSummary = "validation command did not run";
                            _b.label = 2;
                        case 2:
                            _b.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, (0, validation_1.runValidationCommand)(input.command, ctx.ports.getWorkspaceRoot(), (_a = input.timeoutSec) !== null && _a !== void 0 ? _a : 120)];
                        case 3:
                            run = _b.sent();
                            result = run.exitCode === 0 ? "passed" : "failed";
                            safeSummary = run.safeSummary;
                            return [3 /*break*/, 5];
                        case 4:
                            error_1 = _b.sent();
                            safeSummary = "validation runner failed: ".concat(error_1 instanceof Error ? error_1.message : String(error_1));
                            return [3 /*break*/, 5];
                        case 5:
                            outcome = requireGovernanceLedger().boundValidationOutcome({
                                command: (0, redaction_1.redactToolOutput)(input.command, true),
                                result: result,
                                safeSummary: safeSummary,
                                durationMs: performance.now() - startedAt,
                            });
                            return [4 /*yield*/, (0, substrate_3.captureRepositoryEvidenceFields)(ctx.ports.getWorkspaceRoot())];
                        case 6:
                            repoRefs = _b.sent();
                            event = requireGovernanceLedger().buildEvidenceRecorded(__assign({ id: "evidence:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextEvidenceSequence()), taskID: input.taskID, objective: input.objective, status: result === "passed" ? "validated" : "failed", validations: [outcome], knownGaps: input.knownGaps }, repoRefs));
                            ctx.ports.publishForSession(owner, event);
                            return [2 /*return*/, {
                                    recorded: true,
                                    result: result,
                                    safeSummary: outcome.safeSummary,
                                }];
                    }
                });
            });
        },
        /**
         * Record a completion card (P2 E4): the fixed report structure (§5) that
         * answers "is it really done, what evidence is missing". The card is safe
         * prose — changeSummary is a summary, never a diff or file content — and a
         * `validated_by` Work Graph edge connects each completed change to the card.
         */
        recordCompletion: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, recordedAt, completionID, event, _i, _a, path;
                var _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            exec = _d.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, { recorded: false }];
                            if (!input.taskID.trim() ||
                                !input.objective.trim() ||
                                !input.changeSummary.trim())
                                return [2 /*return*/, { recorded: false }];
                            recordedAt = new Date().toISOString();
                            completionID = "completion:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextCompletionSequence());
                            event = requireGovernanceLedger().buildCompletionRecorded(__assign(__assign(__assign(__assign({ id: completionID, taskID: input.taskID, objective: input.objective, changeSummary: (0, redaction_1.redactToolOutput)(input.changeSummary, true) }, (input.behaviorImpact
                                ? { behaviorImpact: (0, redaction_1.redactToolOutput)(input.behaviorImpact, true) }
                                : {})), { validations: ((_b = input.validations) !== null && _b !== void 0 ? _b : []).map(function (validation) {
                                    return requireGovernanceLedger().boundValidationOutcome({
                                        command: (0, redaction_1.redactToolOutput)(validation.command, true),
                                        result: validation.result,
                                        safeSummary: validation.safeSummary,
                                    });
                                }) }), (input.humanValidation
                                ? { humanValidation: (0, redaction_1.redactToolOutput)(input.humanValidation, true) }
                                : {})), { knownGaps: input.knownGaps, externalSideEffects: input.externalSideEffects, rollbackState: input.rollbackState, evidenceIDs: input.evidenceIDs, recordedAt: recordedAt }));
                            ctx.ports.publishForSession(exec, event);
                            // EI §3.9: completion.recorded is one of the two explicit audit triggers
                            // (the other is awaiting_audit/auditing).
                            (0, audit_request_1.requestAuditAfterCompletion)(ctx, exec, event);
                            // P2 E4 Work Graph integration: each completed change is validated by the
                            // card through a `validated_by` edge.
                            for (_i = 0, _a = (_c = input.changePaths) !== null && _c !== void 0 ? _c : []; _i < _a.length; _i++) {
                                path = _a[_i];
                                ctx.ports.publishForSession(exec, requireWorkLedger().completionValidationEdge({
                                    changeID: event.taskID,
                                    path: path,
                                    completionID: completionID,
                                }));
                            }
                            return [2 /*return*/, { recorded: true, completionID: completionID }];
                    }
                });
            });
        },
        driftFindings: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var resolvedSessionID, exec, findings, _a;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            resolvedSessionID = (_b = input === null || input === void 0 ? void 0 : input.sessionID) !== null && _b !== void 0 ? _b : sessionID;
                            return [4 /*yield*/, completeIntelligenceExec(resolvedSessionID)];
                        case 1:
                            exec = _c.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, paginate([], input === null || input === void 0 ? void 0 : input.limit, input === null || input === void 0 ? void 0 : input.cursor)];
                            if (!exec.factStateTerminalEvicted) return [3 /*break*/, 3];
                            return [4 /*yield*/, readCompleteFacts(ctx, exec, session_1.projectedDriftFindings)];
                        case 2:
                            _a = _c.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            _a = readFactSlice(exec, session_1.sessionFactDriftFindings, function () {
                                return (0, session_1.projectedDriftFindings)(exec.session.events);
                            });
                            _c.label = 4;
                        case 4:
                            findings = _a;
                            return [2 /*return*/, paginate(findings.map(function (f) { return (__assign(__assign({ findingID: f.findingID, severity: f.severity, confidence: f.confidence, originalObjective: f.originalObjective, currentActivity: f.currentActivity, evidence: f.evidence, applicableConstraints: f.applicableConstraints, status: f.status, reopenedCount: f.reopenedCount, contractVersion: f.contractVersion, ruleHits: f.ruleHits }, (f.planID ? { planID: f.planID } : {})), (f.rationale ? { rationale: f.rationale } : {}))); }), input === null || input === void 0 ? void 0 : input.limit, input === null || input === void 0 ? void 0 : input.cursor)];
                    }
                });
            });
        },
        /**
         * Run the DriftEvaluator against safe signals and publish any findings it
         * opens. The evaluator is the only production writer of
         * `drift.finding_opened` (§56.9); it has no write power — a finding only
         * escalates to an approval/Chat/mailbox prompt, never a cancellation.
         * Already-open findings are not reopened.
         */
        evaluateDrift: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, contract, findings, _i, findings_1, finding;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            exec = _d.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, { opened: 0 }];
                            if (!input.objective.trim() || !input.currentActivity.trim())
                                return [2 /*return*/, { opened: 0 }];
                            contract = (0, session_1.projectedWorkContracts)(exec.session.events).find(function (candidate) { return candidate.status === "current"; });
                            findings = requireWorkLedger().evaluateDrift(__assign(__assign(__assign({ sessionID: exec.session.id, turnID: exec.activeTurnID, objective: input.objective, currentActivity: input.currentActivity, applicableConstraints: (_a = input.applicableConstraints) !== null && _a !== void 0 ? _a : [], changes: (_b = input.changes) !== null && _b !== void 0 ? _b : [], evidenceRefs: (_c = input.evidenceRefs) !== null && _c !== void 0 ? _c : [] }, (input.recentActions ? { recentActions: input.recentActions } : {})), (input.recentFailures
                                ? { recentFailures: input.recentFailures }
                                : {})), (contract
                                ? {
                                    contract: __assign(__assign(__assign({ planID: contract.planID }, (contract.scope ? { scope: contract.scope } : {})), (contract.verification
                                        ? { verification: contract.verification }
                                        : {})), (contract.constraints
                                        ? { constraints: contract.constraints }
                                        : {})),
                                }
                                : {})));
                            for (_i = 0, findings_1 = findings; _i < findings_1.length; _i++) {
                                finding = findings_1[_i];
                                ctx.ports.publishForSession(exec, finding);
                                // EI §3.5 / Phase 2 B3: a warning/high finding is auto-injected into
                                // the Main Agent's next step; advisory findings are not.
                                (0, collab_1.injectFindingIntoMainAgent)(ctx, exec, finding);
                            }
                            return [2 /*return*/, { opened: findings.length }];
                    }
                });
            });
        },
        /**
         * Acknowledge a drift finding (P7 D3 / EI §8.6): the Main Agent explains
         * it, disputes it, or declares a sanctioned detour; the user dismisses it
         * or the work corrects it. Only an open finding can transition.
         */
        acknowledgeDriftFinding: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, findings, finding;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            exec = _a.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, { acknowledged: false }];
                            if (!input.findingID.trim())
                                return [2 /*return*/, { acknowledged: false }];
                            // A finding may have been opened long before the current window, so use
                            // the hot state when it is complete; a fast-attach tail completes it from
                            // paged history before we look.
                            return [4 /*yield*/, (0, substrate_1.ensureCompleteSessionFactState)(ctx, exec)];
                        case 2:
                            // A finding may have been opened long before the current window, so use
                            // the hot state when it is complete; a fast-attach tail completes it from
                            // paged history before we look.
                            _a.sent();
                            findings = exec.factStateComplete === true && exec.factState
                                ? (0, session_1.sessionFactDriftFindings)(exec.factState)
                                : (0, session_1.projectedDriftFindings)(exec.session.events);
                            finding = findings.find(function (candidate) {
                                return candidate.findingID === input.findingID &&
                                    candidate.status === "open";
                            });
                            if (!finding)
                                return [2 /*return*/, { acknowledged: false }];
                            ctx.ports.publishForSession(exec, requireWorkLedger().buildDriftFindingUpdate({
                                id: "drift:".concat(Date.now().toString(36), ":").concat(input.findingID),
                                findingID: input.findingID,
                                status: input.status,
                                rationale: input.rationale,
                            }));
                            return [2 /*return*/, { acknowledged: true }];
                    }
                });
            });
        },
        /**
         * Reopen a terminal drift finding (翻案, EI §3.5) — a user-only action that
         * lifts a dismissed/explained finding back to open so it is reviewed again.
         * The findingID is unchanged (it is the same suspicion, re-examined); the
         * reopen is a new `drift.finding_updated(status:"open")` and the projection
         * counts it as `reopenedCount`. A corrected finding is not reopenable — its
         * premise (the contract revision) is gone. The Main Agent cannot reopen:
         * self-correction goes through a fresh finding or the chat flow.
         */
        reopenDriftFinding: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, findings, finding, reopenedCount;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            exec = _a.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session) || !input.findingID.trim())
                                return [2 /*return*/, { reopened: false, reason: "no finding" }];
                            return [4 /*yield*/, (0, substrate_1.ensureCompleteSessionFactState)(ctx, exec)];
                        case 2:
                            _a.sent();
                            findings = exec.factStateComplete === true && exec.factState
                                ? (0, session_1.sessionFactDriftFindings)(exec.factState)
                                : (0, session_1.projectedDriftFindings)(exec.session.events);
                            finding = findings.find(function (candidate) { return candidate.findingID === input.findingID; });
                            if (!finding)
                                return [2 /*return*/, { reopened: false, reason: "unknown finding" }];
                            if (finding.status !== "dismissed" && finding.status !== "explained")
                                return [2 /*return*/, {
                                        reopened: false,
                                        reason: "only a dismissed or explained finding can be reopened (this one is ".concat(finding.status, ")"),
                                    }];
                            ctx.ports.publishForSession(exec, requireWorkLedger().buildDriftFindingUpdate({
                                id: "drift:reopen:".concat(Date.now().toString(36), ":").concat(input.findingID),
                                findingID: input.findingID,
                                status: "open",
                            }));
                            reopenedCount = finding.reopenedCount + 1;
                            (0, collab_1.injectFindingIntoMainAgent)(ctx, exec, finding, {
                                reviewNote: "This is reopen #".concat(reopenedCount, "; do not repeat the rationale you ") +
                                    "gave last time.",
                                idSuffix: "reopen_".concat(reopenedCount),
                            });
                            return [2 /*return*/, { reopened: true, reopenedCount: reopenedCount }];
                    }
                });
            });
        },
        requestOverride: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, session, rules, rule, requestID, response, granted;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 2:
                            exec = _b.sent();
                            session = exec === null || exec === void 0 ? void 0 : exec.session;
                            if (!session || !input.ruleID.trim() || !input.reason.trim())
                                return [2 /*return*/, {
                                        requested: false,
                                        reason: "invalid override request",
                                    }];
                            // A rule may predate the current window, so use the hot state when it is
                            // complete; a fast-attach tail completes it from paged history first.
                            return [4 /*yield*/, (0, substrate_1.ensureCompleteSessionFactState)(ctx, exec)];
                        case 3:
                            // A rule may predate the current window, so use the hot state when it is
                            // complete; a fast-attach tail completes it from paged history first.
                            _b.sent();
                            rules = exec.factStateComplete === true && exec.factState
                                ? (0, session_1.sessionFactConstitutionRules)(exec.factState)
                                : (0, session_1.projectedConstitutionRules)(session.events);
                            rule = rules.find(function (candidate) { return candidate.ruleID === input.ruleID; });
                            if (!rule)
                                return [2 /*return*/, { requested: false, reason: "unknown rule" }];
                            if (rule.overridePolicy === "forbidden")
                                return [2 /*return*/, { requested: false, reason: "override forbidden" }];
                            requestID = "override:".concat(input.ruleID, ":").concat(ctx.ports.nextDecisionSequence());
                            return [4 /*yield*/, ctx.ports.getInteractive().requirePlanAcceptance({
                                    approvalID: requestID,
                                    planID: input.ruleID,
                                    title: "Override ".concat(input.ruleID),
                                    preview: "Allow ".concat(input.ruleID, " (").concat(input.reason, ")"),
                                    detail: input.reason,
                                    scope: "constitution_override",
                                })];
                        case 4:
                            response = _b.sent();
                            if (!response || response.decision === "reject")
                                return [2 /*return*/, { requested: false, requestID: requestID, reason: "rejected" }];
                            granted = __assign(__assign(__assign({ type: "constitution.override_granted", id: requestID, ruleID: input.ruleID, reason: input.reason, approvedBy: "user" }, (((_a = input.paths) === null || _a === void 0 ? void 0 : _a.length) ? { paths: input.paths } : {})), (input.taskID ? { taskID: input.taskID } : {})), (input.expiresAt ? { expiresAt: input.expiresAt } : {}));
                            (0, governance_ledger_2.appendInstanceEvent)((0, governance_ledger_2.resolveGovernanceRoot)(ctx.ports.getWorkspaceRoot()), "decisions.jsonl", granted);
                            ctx.ports.publishForSession(exec, granted);
                            return [2 /*return*/, { requested: true, requestID: requestID }];
                    }
                });
            });
        },
        approveOverride: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var outcome;
                return __generator(this, function (_a) {
                    outcome = ctx.ports.getInteractive().respondApproval({
                        requestID: input.requestID,
                        decision: input.decision,
                    });
                    return [2 /*return*/, { approved: outcome.accepted && input.decision === "once" }];
                });
            });
        },
        /**
         * Update a constitution rule (EI §3.8 P-1.c, user-owned): disable or
         * re-enable a hard rule. `enabled:false` is a reversible update; the
         * durable tombstone is removeConstitutionRule.
         */
        updateConstitutionRule: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, governanceLedger, enforcement, anchor;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            exec = _c.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session) || !input.ruleID.trim())
                                return [2 /*return*/, { updated: false }];
                            // Hard-coded runtime self-protection (C-TERM-*): the guarantee survives
                            // a journal edit, so the panel must not pretend it can be changed. Every
                            // other rule (C-REL-*, user rules) is user-editable (EI §3.8 P-1.c).
                            if (isHardProtectedRule(input.ruleID))
                                return [2 /*return*/, { updated: false }];
                            governanceLedger = requireGovernanceLedger();
                            if (!governanceLedger)
                                return [2 /*return*/, { updated: false }];
                            enforcement = input.enforcement;
                            anchor = input.appliesTo;
                            if ((enforcement === "deny" || enforcement === "approval") &&
                                !(anchor &&
                                    (((_a = anchor.tools) === null || _a === void 0 ? void 0 : _a.length) ||
                                        ((_b = anchor.paths) === null || _b === void 0 ? void 0 : _b.length) ||
                                        anchor.commandPattern)))
                                return [2 /*return*/, {
                                        updated: false,
                                        reason: "".concat(enforcement, " requires a non-empty appliesTo anchor"),
                                    }];
                            ctx.ports.publishForSession(exec, governanceLedger.buildConstitutionRuleUpdate(__assign(__assign(__assign(__assign(__assign({ id: "constitution:update:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextDecisionSequence()), ruleID: input.ruleID }, (input.enabled !== undefined ? { enabled: input.enabled } : {})), (input.statement ? { statement: input.statement } : {})), (enforcement ? { enforcement: enforcement } : {})), (input.priority ? { priority: input.priority } : {})), (anchor ? { appliesTo: anchor } : {}))));
                            return [2 /*return*/, { updated: true }];
                    }
                });
            });
        },
        /**
         * Remove a constitution rule (EI §3.8 P-1.c, user-owned): an append-only
         * tombstone — the journal keeps the rule's full history, the effective
         * set drops it. The caller confirms before this is invoked.
         */
        removeConstitutionRule: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, governanceLedger;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            exec = _a.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session) || !input.ruleID.trim())
                                return [2 /*return*/, { removed: false }];
                            // Hard-coded runtime self-protection (C-TERM-*): the guarantee cannot
                            // be removed by deleting the journal row, so deletion is refused. Every
                            // other rule (C-REL-*, user rules) is user-removable.
                            if (isHardProtectedRule(input.ruleID))
                                return [2 /*return*/, { removed: false }];
                            governanceLedger = requireGovernanceLedger();
                            if (!governanceLedger)
                                return [2 /*return*/, { removed: false }];
                            ctx.ports.publishForSession(exec, governanceLedger.buildConstitutionRuleRemoved({
                                id: "constitution:removed:".concat(Date.now().toString(36), ":").concat(ctx.ports.nextDecisionSequence()),
                                ruleID: input.ruleID,
                                removedAt: new Date().toISOString(),
                            }));
                            return [2 /*return*/, { removed: true }];
                    }
                });
            });
        },
        /**
         * Add a user-owned constitution rule (EI §3.8 P-1.c): the user creates a
         * rule directly from the Constitution tab (no model proposal, no gate).
         * Provenance is `source: "user"`. Release scope is rejected — the runtime's
         * self-protection rules are not the user's to add. A deny/approval rule
         * requires a non-empty appliesTo anchor so the matcher can execute it.
         */
        createConstitutionRule: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, anchor, governanceLedger, ruleID;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            exec = _d.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session) || !((_a = input.statement) === null || _a === void 0 ? void 0 : _a.trim()))
                                return [2 /*return*/, {
                                        created: false,
                                        reason: "a rule requires a statement",
                                    }];
                            anchor = input.appliesTo;
                            if ((input.enforcement === "deny" || input.enforcement === "approval") &&
                                !(anchor &&
                                    (((_b = anchor.tools) === null || _b === void 0 ? void 0 : _b.length) ||
                                        ((_c = anchor.paths) === null || _c === void 0 ? void 0 : _c.length) ||
                                        anchor.commandPattern)))
                                return [2 /*return*/, {
                                        created: false,
                                        reason: "".concat(input.enforcement, " requires a non-empty appliesTo anchor"),
                                    }];
                            governanceLedger = requireGovernanceLedger();
                            if (!governanceLedger)
                                return [2 /*return*/, {
                                        created: false,
                                        reason: "governance ledger unavailable",
                                    }];
                            ruleID = "P-USER-".concat(Date.now().toString(36).toUpperCase());
                            ctx.ports.publishForSession(exec, governanceLedger.buildUserConstitutionRule(__assign(__assign(__assign({ id: "constitution:created:".concat(ruleID, ":").concat(ctx.ports.nextDecisionSequence()), ruleID: ruleID, statement: input.statement, enforcement: input.enforcement }, (input.scope ? { scope: input.scope } : {})), (anchor ? { appliesTo: anchor } : {})), (input.priority ? { priority: input.priority } : {}))));
                            return [2 /*return*/, { created: true, ruleID: ruleID }];
                    }
                });
            });
        },
        /**
         * The constitution/AGENTS document rules (EI §3.8 P-1.c): the sections
         * parsed from the workspace documents, each tagged with its enforcement
         * (prose → warn, `<!-- enforcement -->` → hard with appliesTo). These are
         * the soft rules the governance panel can promote into journal rules.
         */
        constitutionDocRules: function (_sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var snapshot;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, project_docs_1.loadProjectDocuments)(ctx.ports.getWorkspaceRoot())];
                        case 2:
                            snapshot = _a.sent();
                            return [2 /*return*/, snapshot.documents.flatMap(function (document) { return document.rules; })];
                    }
                });
            });
        },
        /**
         * Promote a parsed document rule into the executable journal (EI §3.8
         * P-1.c): a user lifts a soft section into a hard `constitution.rule_added`
         * (source "user", no gate). A deny/approval rule must already carry a
         * non-empty appliesTo anchor — the same hard-rule invariant the proposal
         * path enforces; a promote without one is refused so the model cannot be
         * handed an unenforceable hard rule.
         */
        promoteConstitutionDocRule: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, snapshot, rule, anchored, governanceLedger, ruleID;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 1:
                            exec = _c.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session) || !input.id.trim())
                                return [2 /*return*/, { promoted: false, reason: "no rule id" }];
                            return [4 /*yield*/, ctx.ports.getReady()];
                        case 2:
                            _c.sent();
                            return [4 /*yield*/, (0, project_docs_1.loadProjectDocuments)(ctx.ports.getWorkspaceRoot())];
                        case 3:
                            snapshot = _c.sent();
                            rule = snapshot.documents
                                .flatMap(function (document) { return document.rules; })
                                .find(function (candidate) { return candidate.id === input.id; });
                            if (!rule)
                                return [2 /*return*/, { promoted: false, reason: "unknown document rule id" }];
                            anchored = Boolean(rule.appliesTo &&
                                (((_a = rule.appliesTo.tools) === null || _a === void 0 ? void 0 : _a.length) ||
                                    ((_b = rule.appliesTo.paths) === null || _b === void 0 ? void 0 : _b.length) ||
                                    rule.appliesTo.commandPattern));
                            if (rule.enforcement !== "warn" && !anchored)
                                return [2 /*return*/, {
                                        promoted: false,
                                        reason: "a deny/approval rule requires a non-empty appliesTo anchor; annotate the section first",
                                    }];
                            governanceLedger = requireGovernanceLedger();
                            if (!governanceLedger)
                                return [2 /*return*/, {
                                        promoted: false,
                                        reason: "governance ledger unavailable",
                                    }];
                            ruleID = "P-DOC-".concat(rule.id.replace(/[^a-zA-Z0-9]+/gu, "-"));
                            ctx.ports.publishForSession(exec, governanceLedger.buildPromotedConstitutionRule(__assign({ id: "constitution:promoted:".concat(rule.id, ":").concat(ctx.ports.nextDecisionSequence()), ruleID: ruleID, statement: rule.statement, enforcement: rule.enforcement }, (rule.appliesTo ? { appliesTo: rule.appliesTo } : {}))));
                            return [2 /*return*/, { promoted: true, ruleID: ruleID }];
                    }
                });
            });
        },
        /**
         * Edit a soft (document) rule in place and write it back (EI §3.8 P-1.c
         * 软规则编辑): the user rewrites a section's prose and syncs its
         * enforcement / appliesTo HTML-comment annotations. The document is the
         * source of truth for soft rules — there is no journal event; the change
         * is picked up by the hash-based runtime-context re-derivation. The model
         * never calls this (§3.6): only the user, through the governance panel.
         */
        updateConstitutionDocRule: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var statement, workspaceRoot, snapshot, document, current, next, edited;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (!input.id.trim())
                                return [2 /*return*/, { updated: false, reason: "no rule id" }];
                            statement = (_a = input.statement) === null || _a === void 0 ? void 0 : _a.trim();
                            if (input.statement !== undefined && !statement)
                                return [2 /*return*/, {
                                        updated: false,
                                        reason: "statement must not be empty",
                                    }];
                            return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _c.sent();
                            workspaceRoot = ctx.ports.getWorkspaceRoot();
                            return [4 /*yield*/, (0, project_docs_1.loadProjectDocuments)(workspaceRoot)];
                        case 2:
                            snapshot = _c.sent();
                            document = snapshot.documents.find(function (candidate) {
                                return candidate.rules.some(function (rule) { return rule.id === input.id; });
                            });
                            if (!document)
                                return [2 /*return*/, { updated: false, reason: "unknown document rule id" }];
                            current = document.rules.find(function (rule) { return rule.id === input.id; });
                            next = __assign({ statement: statement !== null && statement !== void 0 ? statement : current.statement, enforcement: (_b = input.enforcement) !== null && _b !== void 0 ? _b : current.enforcement }, (input.appliesTo !== undefined
                                ? { appliesTo: input.appliesTo }
                                : current.appliesTo
                                    ? { appliesTo: current.appliesTo }
                                    : {}));
                            edited = (0, constitution_doc_1.applyConstitutionDocEdit)(document.content, document.source, input.id, next);
                            if (!edited.ok)
                                return [2 /*return*/, { updated: false, reason: edited.reason }];
                            return [4 /*yield*/, (0, platform_1.writeWorkspaceFile)({
                                    workspaceRoot: workspaceRoot,
                                    path: document.path,
                                    content: edited.content,
                                })];
                        case 3:
                            _c.sent();
                            return [2 /*return*/, { updated: true }];
                    }
                });
            });
        },
        registeredTools: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, window, _a, events, projected, _b, live, merged, _i, _c, tool;
                var _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _e.sent();
                            return [4 /*yield*/, intelligenceExecWindow(sessionID)];
                        case 2:
                            exec = _e.sent();
                            if (!exec) return [3 /*break*/, 4];
                            return [4 /*yield*/, (0, substrate_2.ensureSessionEventWindow)(ctx, exec)];
                        case 3:
                            _a = _e.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            _a = undefined;
                            _e.label = 5;
                        case 5:
                            window = _a;
                            events = window
                                ? (0, substrate_2.sessionWindowEvents)(exec, window)
                                : ((_d = exec === null || exec === void 0 ? void 0 : exec.session.events) !== null && _d !== void 0 ? _d : []);
                            if (!events.length) return [3 /*break*/, 7];
                            return [4 /*yield*/, projectedCanonicalToolsWithFallback(events)];
                        case 6:
                            _b = (_e.sent()).map(function (t) { return ({
                                name: t.name,
                                owner: t.owner,
                                scope: t.scope,
                                recovery: t.recovery,
                                precedence: t.precedence,
                                requiresApproval: t.requiresApproval,
                            }); });
                            return [3 /*break*/, 8];
                        case 7:
                            _b = [];
                            _e.label = 8;
                        case 8:
                            projected = _b;
                            live = __spreadArray([], ctx.state.tools.values(), true).map(function (tool) {
                                var _a;
                                return ({
                                    name: tool.name,
                                    owner: (_a = ctx.state.capabilityRegistry.ownerOf("tools", tool.name)) !== null && _a !== void 0 ? _a : "kernel",
                                    scope: "session",
                                    recovery: "none",
                                    precedence: 0,
                                    requiresApproval: tool.requiresApproval,
                                });
                            });
                            merged = new Map();
                            for (_i = 0, _c = __spreadArray(__spreadArray([], live, true), projected, true); _i < _c.length; _i++) {
                                tool = _c[_i];
                                merged.set(tool.name, tool);
                            }
                            return [2 /*return*/, __spreadArray([], merged.values(), true)];
                    }
                });
            });
        },
        notices: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, completeIntelligenceExec(sessionID)];
                        case 1:
                            exec = _a.sent();
                            if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                                return [2 /*return*/, []];
                            return [4 /*yield*/, runSessionProjectionWithFallback("notices", exec.session.events)];
                        case 2: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
    };
}
