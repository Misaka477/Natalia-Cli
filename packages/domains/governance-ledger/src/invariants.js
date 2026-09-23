"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.constitutionInvariants = void 0;
var protectedNow = function (row) {
    return row !== undefined &&
        (row.priority === "critical" || row.priority === "high") &&
        row.overridePolicy === "forbidden";
};
/**
 * The constitution's non-rollback rule as a live check (Discovery D1's
 * candidate: critical/high rules only ever grow weaker-never — the runtime
 * twin of the gate's constitution face: the gate stops a CANDIDATE from
 * weakening the rules, this stops the RUNNING ledger from drifting).
 *
 * Folded per session: each session seeds its own rule copies
 * (seedConstitutionRules), so a window is its own ledger — cross-session
 * concatenation would re-add the same ids and hide real removals.
 */
exports.constitutionInvariants = [
    {
        id: "constitution.protected-rules-never-weaken",
        statement: "a critical/high rule marked forbidden may not be removed or weakened by the running ledger",
        check: function (input) {
            var _a, _b;
            var violations = [];
            for (var _i = 0, _c = input.sessions; _i < _c.length; _i++) {
                var window_1 = _c[_i];
                var ledger = new Map();
                for (var _d = 0, _e = window_1.events; _d < _e.length; _d++) {
                    var event_1 = _e[_d];
                    if (event_1.type === "constitution.rule_added") {
                        ledger.set(event_1.ruleID, {
                            priority: event_1.priority,
                            overridePolicy: event_1.overridePolicy,
                        });
                        continue;
                    }
                    if (event_1.type === "constitution.rule_removed") {
                        var row = ledger.get(event_1.ruleID);
                        if (protectedNow(row))
                            violations.push({
                                code: "constitution.protected_rule_removed",
                                detail: "rule ".concat(event_1.ruleID, " (").concat(row.priority, "/forbidden) was removed in session ").concat(window_1.sessionID),
                                sessionID: window_1.sessionID,
                            });
                        ledger.delete(event_1.ruleID);
                        continue;
                    }
                    if (event_1.type === "constitution.rule_updated") {
                        var row = ledger.get(event_1.ruleID);
                        if (!row || !protectedNow(row))
                            continue;
                        // Update events mark their changed fields optional — absence
                        // means "unchanged", not "cleared" (a cleared priority would
                        // itself be the weakening, and it must name itself).
                        var next = {
                            priority: (_a = event_1.priority) !== null && _a !== void 0 ? _a : row.priority,
                            overridePolicy: (_b = event_1.overridePolicy) !== null && _b !== void 0 ? _b : row.overridePolicy,
                        };
                        if (!protectedNow(next))
                            violations.push({
                                code: "constitution.protected_rule_weakened",
                                detail: "rule ".concat(event_1.ruleID, " weakened (").concat(row.priority, "/").concat(row.overridePolicy, " -> ").concat(next.priority, "/").concat(next.overridePolicy, ") in session ").concat(window_1.sessionID),
                                sessionID: window_1.sessionID,
                            });
                        ledger.set(event_1.ruleID, next);
                    }
                }
            }
            return violations;
        },
    },
];
