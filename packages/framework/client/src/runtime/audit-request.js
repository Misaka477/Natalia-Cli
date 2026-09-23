"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestAuditAfterCompletion = requestAuditAfterCompletion;
var work_ledger_1 = require("@natalia/work-ledger");
/**
 * EI §3.9: completion.recorded is a durable audit trigger. The request is
 * written before waking Nia so restart/dedup have a journal shadow, and both
 * the model tool and the SDK surface go through this one path.
 */
function requestAuditAfterCompletion(ctx, exec, completion) {
    var alreadyRequested = exec.session.events.some(function (candidate) {
        return candidate.type === "audit.requested" &&
            candidate.triggerEventID === completion.id;
    });
    if (alreadyRequested)
        return;
    var ledger = ctx.state.serviceDirectory.getOptional(work_ledger_1.workLedgerController);
    if (!ledger)
        return;
    var planID = completion.taskID;
    var round = exec.session.events.filter(function (candidate) {
        return candidate.type === "audit.requested" && candidate.planID === planID;
    }).length + 1;
    ctx.ports.publishForSession(exec, ledger.buildAuditRequested({
        id: "audit:".concat(planID, ":").concat(ctx.ports.nextPlanSequence()),
        planID: planID,
        planVersion: 1,
        triggerEventID: completion.id,
        round: round,
        scope: "completion_recorded",
        at: completion.recordedAt,
    }));
    ctx.ports.requestNiaWake(exec);
}
