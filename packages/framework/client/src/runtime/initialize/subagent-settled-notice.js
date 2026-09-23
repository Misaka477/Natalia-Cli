"use strict";
/**
 * The runtime's own account of a subagent finishing.
 *
 * A subagent settles whenever it likes, and the parent turn that spawned it is
 * usually somewhere else by then — mid-provider-stream, or finished entirely.
 * Without a notice the parent only learns the outcome by polling with
 * `agent_wait`, which it cannot do while it is the one running.
 *
 * The notice rides in the ledger as a `dynamic` entry, which renders as a user
 * message rather than a system one: providers hoist system messages to the top
 * of the request, which would move this runtime state out of the position it was
 * appended at and reset the stable prefix on every turn (ADR D2).
 *
 * The attribution is deliberately separate from an agent-authored message. A
 * settled notice is the runtime stating what became of the child, not the child's
 * words; a transcript that merged the two would credit the child with phrasing
 * it never produced.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTLED_NOTICE_BUDGET = void 0;
exports.settledNoticeEntryID = settledNoticeEntryID;
exports.subagentSettledNoticeContent = subagentSettledNoticeContent;
exports.settledNoticeAllowed = settledNoticeAllowed;
/** How many settled notices one parent ledger will carry before the budget stops. */
exports.DEFAULT_SETTLED_NOTICE_BUDGET = 20;
/** How much of a subagent's final output the notice may quote. */
var NOTICE_RESULT_CHARS = 400;
/** Entry id for one subagent's settled notice, stable across retries. */
function settledNoticeEntryID(agentId, continuation) {
    return "subagent_settled:".concat(agentId, ":").concat(continuation);
}
/** The model-visible content of one settled notice. */
function subagentSettledNoticeContent(input) {
    var ending = input.stopReason
        ? "".concat(input.status, " (").concat(input.stopReason, ")")
        : input.status;
    var quote = input.finalResult && input.finalResult.trim()
        ? "Its final result: ".concat(input.finalResult.trim().slice(0, NOTICE_RESULT_CHARS)).concat(input.finalResult.trim().length > NOTICE_RESULT_CHARS ? "…" : "", "\n")
        : "";
    return [
        "<runtime_context source=\"subagent_settled\" trust=\"runtime\" agent_id=\"".concat(input.agentId, "\" continuation=\"").concat(input.continuation, "\">"),
        "Subagent ".concat(input.agentId, " has finished: ").concat(ending, "."),
        quote,
        "This is the runtime reporting the outcome, not the subagent's own account. " +
            "Read its full result with agent_output if you need it, and decide whether " +
            "to act on it, delegate again, or move on.",
        "</runtime_context>",
    ]
        .filter(Boolean)
        .join("\n");
}
/** Whether a settled notice fits inside the parent ledger's remaining budget. */
function settledNoticeAllowed(existingNoticeCount, budget) {
    // A budget of 0 or less means no notices at all; `Infinity` is the unbounded
    // escape hatch, so the comparison has to be explicit rather than `> 0`.
    if (budget <= 0)
        return false;
    if (!Number.isFinite(budget))
        return true;
    return existingNoticeCount < budget;
}
