"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workLedgerInvariants = void 0;
/**
 * The work-ledger domain's declared data relations (Discovery D1): the
 * contract state machine and the evidence requirement — both as existence
 * checks across every window, because a contract drafted in one session
 * may be accepted in another and windows arrive in runtime-map order
 * (cross-session strict ordering needs D1b's global view; existence is
 * the honest check today).
 */
exports.workLedgerInvariants = [
    {
        id: "work-ledger.contract-machine",
        statement: "every accepted contract has a drafted contract for exactly its plan and version (none -> drafted -> accepted, nothing skips the draft)",
        check: function (input) {
            var violations = [];
            var drafted = new Set();
            var accepted = [];
            for (var _i = 0, _a = input.sessions; _i < _a.length; _i++) {
                var window_1 = _a[_i];
                for (var _b = 0, _c = window_1.events; _b < _c.length; _b++) {
                    var event_1 = _c[_b];
                    if (event_1.type === "work_contract.drafted")
                        drafted.add("".concat(event_1.planID, "#").concat(event_1.planVersion));
                    else if (event_1.type === "work_contract.accepted")
                        accepted.push({
                            planID: event_1.planID,
                            planVersion: event_1.planVersion,
                        });
                }
            }
            for (var _d = 0, accepted_1 = accepted; _d < accepted_1.length; _d++) {
                var contract = accepted_1[_d];
                if (!drafted.has("".concat(contract.planID, "#").concat(contract.planVersion)))
                    violations.push({
                        code: "work_contract.accepted_without_draft",
                        detail: "accepted contract ".concat(contract.planID, " v").concat(contract.planVersion, " has no matching draft in any window"),
                    });
            }
            return violations;
        },
    },
    {
        id: "work-ledger.accepted-has-evidence",
        statement: "every accepted contract ends with completion/evidence for its plan (the EI acceptance check, run live)",
        check: function (input) {
            var violations = [];
            var evidenced = new Set();
            var accepted = [];
            for (var _i = 0, _a = input.sessions; _i < _a.length; _i++) {
                var window_2 = _a[_i];
                for (var _b = 0, _c = window_2.events; _b < _c.length; _b++) {
                    var event_2 = _c[_b];
                    if (event_2.type === "completion.recorded" ||
                        event_2.type === "evidence.recorded")
                        evidenced.add(event_2.taskID);
                    else if (event_2.type === "work_contract.accepted")
                        accepted.push(event_2.planID);
                }
            }
            for (var _d = 0, accepted_2 = accepted; _d < accepted_2.length; _d++) {
                var planID = accepted_2[_d];
                if (!evidenced.has(planID))
                    violations.push({
                        code: "work_contract.accepted_without_evidence",
                        detail: "accepted contract for ".concat(planID, " has no completion/evidence record in any window"),
                    });
            }
            return violations;
        },
    },
];
