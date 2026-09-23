"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wireWorkLedger = wireWorkLedger;
/**
 * Framework subsystem composition — initialize/framework-work-ledger.ts.
 *
 * The work ledger (plan, drift and work graph event writers) is a
 * framework-internal subsystem, not a plugin: this module constructs the
 * controller directly and contributes it as the `work-ledger.controller`
 * service so engineering-intelligence and tool-execution members resolve it
 * unchanged.
 */
var work_ledger_1 = require("@natalia/work-ledger");
var work_ledger_2 = require("@natalia/work-ledger");
function wireWorkLedger(ctx) {
    var registry = ctx.state.capabilityRegistry;
    var owner = registry.registerOwner({
        id: "natalia-work-ledger",
        name: "Work Ledger",
        version: "1.0.0",
        scope: "workspace",
        grants: ["services"],
    });
    var controller = (0, work_ledger_1.createWorkLedgerController)({
        openFindingIDs: function () {
            var _a, _b;
            return new Set(((_b = (_a = ctx.ports.getSession()) === null || _a === void 0 ? void 0 : _a.events) !== null && _b !== void 0 ? _b : [])
                .filter(function (event) { return event.type === "drift.finding_opened"; })
                .map(function (event) { return event.findingID; }));
        },
    });
    ctx.state.serviceDirectory.provide(work_ledger_2.workLedgerController, controller);
    return controller;
}
