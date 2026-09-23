"use strict";
/**
 * The session's date, snapshotted once and rolled over when the day changes.
 *
 * An agent asked "is this CHANGELOG current?" or "is this dependency version
 * new?" needs to know what day it is. The timestamp scheme that costs nothing
 * else:
 *
 *   - `sessionStartedAt` is fixed when the session's execution state is first
 *     built and never changes, so the model never sees two contradictory dates
 *     for when the session began.
 *   - The date rides in the `<environment_details>` block, which is already
 *     per-request runtime context. Putting it in the static system prompt would
 *     destroy the cross-session sharing of that prompt: Anthropic's prefix cache
 *     is content-addressed, and ten sessions with identical system prompts share
 *     one entry — a per-session date in it forfeits that.
 *   - Only the date, no time. Seconds make the string look volatile, which
 *     misleads anyone later reading a log or a diff.
 *
 * When the day changes under a long-running session, one `role:"dynamic"` entry
 * is appended rather than the earlier context being rewritten. `dynamic` renders
 * as a user message (ADR D2), so the append lands after the already-cached
 * prefix instead of invalidating it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarDate = calendarDate;
exports.today = today;
exports.dateRolloverEntryID = dateRolloverEntryID;
exports.dateRolledOver = dateRolledOver;
exports.dateRolloverContent = dateRolloverContent;
exports.appendDateRollover = appendDateRollover;
/** Calendar date in `YYYY-MM-DD`, local time. */
function calendarDate(at) {
    var year = at.getFullYear();
    var month = "".concat(at.getMonth() + 1).padStart(2, "0");
    var day = "".concat(at.getDate()).padStart(2, "0");
    return "".concat(year, "-").concat(month, "-").concat(day);
}
/** Today's calendar date, from an injectable clock. */
function today(now) {
    if (now === void 0) { now = function () { return new Date(); }; }
    return calendarDate(now());
}
/** Entry id for the rollover notice, stable per date so it cannot duplicate. */
function dateRolloverEntryID(sessionID, date) {
    return "date:".concat(sessionID, ":").concat(date);
}
/** Whether the recorded date is behind today's. */
function dateRolledOver(recorded, todayDate) {
    return recorded !== undefined && recorded !== todayDate;
}
/**
 * The model-visible content of one rollover notice.
 *
 * Names both dates, because "the date changed" alone leaves the model to guess
 * whether it moved forward or the record was wrong.
 */
function dateRolloverContent(from, to) {
    return [
        "<runtime_context source=\"date_rollover\" trust=\"runtime\">",
        "The date changed from ".concat(from, " to ").concat(to, " while this session was running."),
        "Anything you judged as current or new earlier in this session was judged " +
            "against the earlier date.",
        "</runtime_context>",
    ].join("\n");
}
/**
 * Append the rollover notice when the day has changed under a running session.
 *
 * One notice per date, keyed by the session and the date, so a session that
 * crosses several days appends one per crossing rather than one per turn.
 * `dynamic` renders as a user message, so the append lands after the
 * already-cached prefix instead of invalidating it.
 */
function appendDateRollover(input) {
    if (!dateRolledOver(input.recorded, input.todayDate))
        return "unchanged";
    var entryID = dateRolloverEntryID(input.sessionID, input.todayDate);
    // The ledger rejects a duplicate id, so an already-appended notice is left
    // alone rather than rewritten.
    if (input.ledger.snapshot().entries.some(function (entry) { return entry.id === entryID; }))
        return "unchanged";
    input.ledger.add({
        id: entryID,
        role: "dynamic",
        content: dateRolloverContent(input.recorded, input.todayDate),
    });
    return "appended";
}
