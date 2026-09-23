"use strict";
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
exports.finalizeInitialize = finalizeInitialize;
var governance_ledger_1 = require("@natalia/governance-ledger");
var runtime_1 = require("./runtime");
var runtime_services_1 = require("@natalia/runtime-services");
var work_ledger_1 = require("@natalia/work-ledger");
var governance_ledger_2 = require("@natalia/governance-ledger");
var operation_log_1 = require("@natalia/operation-log");
function finalizeInitialize(ctx_1, _options_1, _a) {
    return __awaiter(this, arguments, void 0, function (ctx, _options, _b) {
        var scope, start, mark, governanceLedgerController, workLedgerController, session, _i, _c, event_1, pending, _d, _e, request, _f, _g, request, governanceRoot, instance, _loop_1, _h, _j, event_2, _k, _l, rule, _m, _o, override, _p, _q, closedPlans, _r, _s, event_3, unclosed, _t, _u, event_4, _v, unclosed_1, planID;
        var _w, _x, _y, _z, _0;
        var interrupted = _b.interrupted, sqliteRecovery = _b.sqliteRecovery;
        return __generator(this, function (_1) {
            switch (_1.label) {
                case 0:
                    scope = (0, runtime_1.createInitializeRuntime)(ctx);
                    start = performance.now();
                    mark = function (name) {
                        return (0, runtime_services_1.perfLog)("[perf] finalizeInitialize.".concat(name, " +").concat((performance.now() - start).toFixed(1), "ms"));
                    };
                    governanceLedgerController = scope.serviceDirectory.get(governance_ledger_2.governanceLedgerController);
                    workLedgerController = scope.serviceDirectory.get(work_ledger_1.workLedgerController);
                    session = scope.session;
                    if (!session)
                        throw new Error("session initialization did not complete");
                    // Warm the collaboration snapshot in the background so the first
                    // providerRunnerInput/chat-prompt read does not run the full event
                    // projection synchronously on the runtime thread.
                    if (scope.activeExec)
                        (_x = (_w = ctx.ports).scheduleCollabSnapshot) === null || _x === void 0 ? void 0 : _x.call(_w, scope.activeExec);
                    mark("pre");
                    scope.publish({
                        type: "session.created",
                        sessionID: scope.sessionID,
                        title: session.title,
                    });
                    if (scope.replayMode === "all")
                        for (_i = 0, _c = session.events; _i < _c.length; _i++) {
                            event_1 = _c[_i];
                            (_y = scope.sink) === null || _y === void 0 ? void 0 : _y.call(scope, event_1);
                        }
                    mark("replay");
                    if (sqliteRecovery)
                        scope.interactive.restoreRecoveredInteractiveState(sqliteRecovery.approvals.filter(function (request) {
                            return !interrupted.some(function (event) {
                                return event.type === "approval.response" && event.id === request.id;
                            });
                        }), sqliteRecovery.questions.filter(function (request) {
                            return !interrupted.some(function (event) {
                                return event.type === "question.response" && event.id === request.id;
                            });
                        }), sqliteRecovery.interactives.filter(function (request) {
                            return !interrupted.some(function (event) {
                                return event.type === "interactive.response" && event.id === request.id;
                            });
                        }));
                    else
                        scope.interactive.restoreInteractiveState(session.events);
                    mark("interactive");
                    if (scope.replayMode === "none") {
                        pending = sqliteRecovery
                            ? {
                                approvals: sqliteRecovery.approvals.filter(function (request) {
                                    return !interrupted.some(function (event) {
                                        return event.type === "approval.response" && event.id === request.id;
                                    });
                                }),
                                questions: sqliteRecovery.questions.filter(function (request) {
                                    return !interrupted.some(function (event) {
                                        return event.type === "question.response" && event.id === request.id;
                                    });
                                }),
                            }
                            : scope.projectInteractiveRequests(session.events);
                        for (_d = 0, _e = pending.approvals; _d < _e.length; _d++) {
                            request = _e[_d];
                            (_z = scope.sink) === null || _z === void 0 ? void 0 : _z.call(scope, request);
                        }
                        for (_f = 0, _g = pending.questions; _f < _g.length; _f++) {
                            request = _g[_f];
                            (_0 = scope.sink) === null || _0 === void 0 ? void 0 : _0.call(scope, request);
                        }
                    }
                    mark("pendingInteractive");
                    if (!scope.activeExec) return [3 /*break*/, 2];
                    return [4 /*yield*/, scope.initializeCheckpointController(scope.activeExec)];
                case 1:
                    _1.sent();
                    _1.label = 2;
                case 2:
                    mark("checkpoint");
                    // The exec is the turn's view of agent/model state; the closures were the
                    // source of truth during init, so mirror them before any turn can run.
                    if (scope.activeExec) {
                        scope.activeExec.selectedAgent = scope.selectedAgent;
                        scope.activeExec.selectedModel = scope.selectedModel;
                        scope.activeExec.activeSkill = scope.activeSkill;
                        scope.activeExec.permissionMode = scope.permissionMode;
                        scope.activeExec.permissionProfile = scope.selectedPermissionProfile;
                        scope.applyAgentProvider(scope.activeExec);
                    }
                    mark("exec");
                    scope.publish({ type: "session.ready", sessionID: scope.sessionID });
                    mark("ready");
                    governanceRoot = (0, governance_ledger_1.resolveGovernanceRoot)(ctx.ports.getWorkspaceRoot());
                    instance = (0, governance_ledger_1.loadInstanceGovernance)(governanceRoot);
                    if (instance.degraded)
                        scope.publish({
                            type: "diagnostic",
                            level: "warning",
                            message: "governance_store_unavailable",
                        });
                    _loop_1 = function (event_2) {
                        if (session.events.some(function (existing) {
                            return existing.type === event_2.type &&
                                "id" in existing &&
                                "id" in event_2 &&
                                existing.id === event_2.id;
                        }))
                            return "continue";
                        scope.publish(event_2);
                        if (event_2.type === "constitution.rule_added")
                            scope.publish(workLedgerController.constitutionRuleNode({
                                ruleID: event_2.ruleID,
                                statement: event_2.statement,
                                scope: event_2.scope,
                                sessionID: scope.sessionID,
                            }));
                    };
                    for (_h = 0, _j = instance.events; _h < _j.length; _h++) {
                        event_2 = _j[_h];
                        _loop_1(event_2);
                    }
                    // The self-protection rules are the first constitution facts: migrate them
                    // into the durable journal on every boot (idempotent — replay already holds
                    // them) so `constitutionRules()` and the /constitution UI answer real rules,
                    // not the empty projection CST1 shipped.
                    for (_k = 0, _l = governanceLedgerController.seedConstitutionRules(__spreadArray(__spreadArray([], instance.events, true), session.events, true)); _k < _l.length; _k++) {
                        rule = _l[_k];
                        (0, governance_ledger_1.appendInstanceEvent)(governanceRoot, "constitution.jsonl", rule);
                        scope.publish(rule);
                        // CST4 Work Graph linkage: each seeded rule is a `constraint` node, so
                        // tool calls and drift findings can relate to it in the graph.
                        scope.publish(workLedgerController.constitutionRuleNode({
                            ruleID: rule.ruleID,
                            statement: rule.statement,
                            scope: rule.scope,
                            sessionID: scope.sessionID,
                        }));
                    }
                    mark("governance");
                    // Overrides are visible, not silent: a plugin that replaced a built-in
                    // tool shows up in diagnostics so nobody discovers it by surprise.
                    for (_m = 0, _o = scope.capabilityRegistry.overrides(); _m < _o.length; _m++) {
                        override = _o[_m];
                        scope.publish({
                            type: "diagnostic",
                            level: "warning",
                            message: "capability \"".concat(override.winner, "\" (precedence ").concat(override.winnerPrecedence, ") replaced \"").concat(override.loser, "\" (precedence ").concat(override.loserPrecedence, ") for ").concat(override.kind, " \"").concat(override.name, "\""),
                        });
                    }
                    mark("overrides");
                    scope.publishRuntimeCapabilities();
                    scope.publishRegisteredTools();
                    scope.publish(scope.contextStatusEvent(scope.runtimeContext.status(scope.runtimeContextConfig)));
                    mark("tools");
                    _q = (_p = scope).publish;
                    return [4 /*yield*/, scope.runtimeStatusSnapshot()];
                case 3:
                    _q.apply(_p, [_1.sent()]);
                    mark("statusSnapshot");
                    // EI §3.9 重启恢复: the Nia audit wake is in-memory, so a restart would drop
                    // an in-flight audit. Scan for audit.requested events whose plan never closed
                    // (no audit_passed / audit_gaps / completed status) and re-wake Nia so the
                    // audit is not lost across a restart.
                    if (scope.activeExec && ctx.ports.requestNiaWake) {
                        closedPlans = new Set();
                        for (_r = 0, _s = session.events; _r < _s.length; _r++) {
                            event_3 = _s[_r];
                            if (event_3.type === "plan.doc.status" &&
                                (event_3.status === "audit_passed" ||
                                    event_3.status === "audit_gaps" ||
                                    event_3.status === "completed"))
                                closedPlans.add(event_3.planID);
                        }
                        unclosed = new Set();
                        for (_t = 0, _u = session.events; _t < _u.length; _t++) {
                            event_4 = _u[_t];
                            if (event_4.type === "audit.requested" && !closedPlans.has(event_4.planID))
                                unclosed.add(event_4.planID);
                        }
                        for (_v = 0, unclosed_1 = unclosed; _v < unclosed_1.length; _v++) {
                            planID = unclosed_1[_v];
                            (0, operation_log_1.logOf)(ctx.state.serviceDirectory).info("audit-recovery", "re-waking Nia for an unclosed audit", {
                                planID: planID,
                            });
                            ctx.ports.requestNiaWake(scope.activeExec);
                        }
                    }
                    return [2 /*return*/];
            }
        });
    });
}
