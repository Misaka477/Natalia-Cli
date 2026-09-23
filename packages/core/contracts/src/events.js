"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markRuntimeEventSessionSeq = markRuntimeEventSessionSeq;
exports.runtimeEventSessionSeq = runtimeEventSessionSeq;
exports.runtimeEventDurability = runtimeEventDurability;
/**
 * Hidden per-session durable order carried alongside a runtime event.
 *
 * This is deliberately non-enumerable: it must survive the process boundary
 * for windowed delivery, but it is transport metadata rather than a business
 * event field. Exact event comparisons and persisted JSON stay unchanged.
 */
var RUNTIME_EVENT_SESSION_SEQ = "__nataliaSessionSeq";
/** Attach the per-session durable order without changing the event's shape. */
function markRuntimeEventSessionSeq(event, sessionSeq) {
    Object.defineProperty(event, RUNTIME_EVENT_SESSION_SEQ, {
        value: sessionSeq,
        enumerable: false,
        configurable: true,
        writable: false,
    });
    return event;
}
/** Read the per-session durable order when one was attached. */
function runtimeEventSessionSeq(event) {
    var value = event[RUNTIME_EVENT_SESSION_SEQ];
    return typeof value === "number" ? value : undefined;
}
/** Streaming fragments are transport-live; their completed settlements are durable. */
function runtimeEventDurability(event) {
    switch (event.type) {
        case "content.delta":
        case "thinking.delta":
        case "context.status":
        case "status.update":
        case "terminal.update":
        case "navi.chat.turn.started":
        case "navi.chat.turn.phase":
        case "navi.chat.turn.finished":
        case "nia.chat.turn.started":
        case "nia.chat.turn.phase":
        case "nia.chat.turn.finished":
        // Session intelligence snapshots are reconstructible from the journal and
        // are published on every work-state boundary. Persisting each one bloats
        // long sessions and makes every full-session clone larger; keep them live
        // and derive the latest snapshot on demand.
        // A live re-seed of the current goal; the durable record is `goal.changed`.
        case "goal.status":
        case "session.snapshot":
        // Rollback previews are a transient dry-run response. The Markdown/change
        // data can be large, and the UI can re-request a preview instead of loading
        // every historical preview back from the journal.
        case "rollback.previewed":
        case "navi.chat.message.delta":
        case "navi.chat.thinking.delta":
        case "nia.chat.message.delta":
        case "nia.chat.thinking.delta":
        // Legacy chat lifecycle records are accepted only for existing journals.
        case "chat.turn.started":
        case "chat.turn.phase":
        case "chat.turn.finished":
        case "projections.updated":
        // Synthetic runtime declarations are re-published on every boot. Storing
        // them in the session DB only multiplies startup writes and bloats the
        // session history; they are reconstructible and do not need durability.
        case "capability.loaded":
        case "capability.unloaded":
        case "tool.registered":
        case "plugin.update":
        case "resource.read":
            return "live";
        case "tool.update":
            return ["succeeded", "failed", "rejected", "cancelled"].includes(event.status)
                ? "durable"
                : "live";
        default:
            return "durable";
    }
}
