"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("governance ledger controller records decisions and seeds constitution rules", function () {
    var controller = (0, src_1.createGovernanceLedgerController)();
    (0, bun_test_1.expect)(controller.recordDecision({ id: "decision:1", decision: "ship" })).toMatchObject({ type: "decision.recorded", status: "accepted" });
    (0, bun_test_1.expect)(controller.seedConstitutionRules([]).length).toBeGreaterThan(0);
});
