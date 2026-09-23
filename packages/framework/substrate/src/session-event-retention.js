"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRuntimeRetainedEvent = isRuntimeRetainedEvent;
exports.filterRuntimeRetainedEvents = filterRuntimeRetainedEvents;
exports.windowRuntimeEvents = windowRuntimeEvents;
exports.maxLiveSessionEvents = maxLiveSessionEvents;
/**
 * Events that are safe to keep in the live execution state.
 *
 * `session.snapshot` and `rollback.previewed` are live-only projections now:
 * they can be rebuilt/re-requested, and persisting them only bloats long
 * sessions and every full-session clone. `context.checkpoint` is retained only
 * when the store has no epoch baseline to recover from; SQLite stores the full
 * checkpoint in `context_epochs`, so the event payload is redundant there.
 */
function isRuntimeRetainedEvent(event, mode, hasContextEpoch) {
    if (event.type === "session.snapshot" || event.type === "rollback.previewed")
        return false;
    if (event.type === "context.checkpoint" &&
        mode === "sqlite" &&
        hasContextEpoch)
        return false;
    return true;
}
function filterRuntimeRetainedEvents(events, mode, hasContextEpoch) {
    return events.filter(function (event) {
        return isRuntimeRetainedEvent(event, mode, hasContextEpoch);
    });
}
/**
 * Bounds how much durable history a live execution keeps resident. `0` (the
 * default) keeps everything. A positive cap keeps the newest events aligned
 * forward to a `turn.submitted`, so no turn is half-included; if the cap cannot
 * reach a turn boundary it aligns backward to the previous one, and if there is
 * no boundary at all it keeps everything rather than risk a broken projection.
 *
 * Older history stays in the store and is served by the message index, so this
 * is a deliberate memory/history trade-off and is opt-in.
 */
function windowRuntimeEvents(events, maxEvents) {
    if (maxEvents <= 0 || events.length <= maxEvents)
        return events;
    var start = events.length - maxEvents;
    for (var index = start; index < events.length; index++)
        if (events[index].type === "turn.submitted")
            return events.slice(index);
    for (var index = start - 1; index >= 0; index--)
        if (events[index].type === "turn.submitted")
            return events.slice(index);
    return events;
}
/** `NATALIA_MAX_LIVE_SESSION_EVENTS`; 0 or invalid means unlimited. */
function maxLiveSessionEvents() {
    var _a;
    var raw = Number((_a = process.env.NATALIA_MAX_LIVE_SESSION_EVENTS) !== null && _a !== void 0 ? _a : "");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}
