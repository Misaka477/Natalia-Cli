"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var src_1 = require("../../src");
var _a = process.argv.slice(2), path = _a[0], id = _a[1];
if (!path || !id)
    throw new Error("expected database path and session id");
var sessionID = id;
var store = new src_1.SqliteSessionStore(path);
store.create(sessionID, "barrier crash worker");
store.enqueueEvent(sessionID, {
    type: "turn.submitted",
    id: "turn_crash_barrier",
    text: "persist before crash",
    byteLength: 20,
    lineCount: 1,
    sha256: "fixture",
});
store.enqueueEvent(sessionID, {
    type: "turn.finished",
    id: "turn_crash_barrier",
    stopReason: "done",
});
await store.flushPendingWrites(sessionID);
// Deliberately omit close(): this is an ungraceful process termination after
// the confirmed settlement barrier, not a clean WAL shutdown.
process.exit(91);
