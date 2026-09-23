"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Every declared contract member must be produced, or be listed with a reason.
 *
 * Roughly forty declarations in one stretch of work could never occur: an event
 * type no writer emitted, an enum member no branch compared against, a status a
 * capability reported that nothing could reach. None were caught by anything,
 * because "something is declared and nothing produces it" is invisible to a
 * type checker and to every behavioural test — the consumer tests all passed.
 *
 * A member that nothing produces is worse than an absent one: it tells every
 * later reader that a path exists. This check makes the choice explicit — wire
 * it, delete it, or say in `ALLOWED` why it stays.
 */
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var ROOT = process.cwd();
var CONTRACTS = "packages/core/contracts/src/events.ts";
/**
 * Members that nothing produces, kept deliberately.
 *
 * Every entry needs a reason: this list is the record of a decision, and a
 * decision without a reason is indistinguishable from an oversight.
 */
var ALLOWED = {
    // Namespaced collaboration messages. The journal split each agent stream into
    // its own namespace and the shared `collab.*` types were kept so journals
    // written before the split still replay — the contract says so in a comment on
    // `NamespacedCollabMessageEventData`.
    "collab.answer": "legacy journal replay: shared collab.* predates the stream split",
    "collab.chat": "legacy journal replay: shared collab.* predates the stream split",
    "collab.message": "legacy journal replay: shared collab.* predates the stream split",
    "collab.notice": "legacy journal replay: shared collab.* predates the stream split",
    "collab.question": "legacy journal replay: shared collab.* predates the stream split",
    "collab.response": "legacy journal replay: shared collab.* predates the stream split",
    "collab.suggestion": "legacy journal replay: shared collab.* predates the stream split",
    // Emitted by the renderer, not the runtime, and consumed by view-store. The
    // api-reference carries them with a "UI-only" trigger description.
    "dialog.open": "UI-only: emitted by the renderer, consumed by view-store",
    "dialog.close": "UI-only: emitted by the renderer, consumed by view-store",
    "terminal.pane.select": "UI-only: emitted by the renderer, consumed by view-store",
};
function walk(dir, out) {
    if (out === void 0) { out = []; }
    for (var _i = 0, _a = (0, node_fs_1.readdirSync)(dir, { withFileTypes: true }); _i < _a.length; _i++) {
        var entry = _a[_i];
        var path = (0, node_path_1.join)(dir, entry.name);
        if (entry.isDirectory()) {
            if (!/node_modules|dist/.test(path))
                walk(path, out);
        }
        else if (/\.tsx?$/.test(entry.name))
            out.push(path);
    }
    return out;
}
function eventTypes(text) {
    var from = text.indexOf("type RuntimeEventData =");
    var to = text.indexOf("export type RuntimeEvent =");
    if (from === -1 || to === -1 || to < from)
        throw new Error("".concat(CONTRACTS, ": RuntimeEventData union not found"));
    var union = text.slice(from, to);
    return __spreadArray([], new Set(__spreadArray([], union.matchAll(/type:\s*"([a-z][a-z0-9_.]*)"/gu), true).map(function (m) { return m[1]; })), true);
}
/** Enum members declared in the contract, excluding the event union. */
function enumMembers(text) {
    var unionFrom = text.indexOf("type RuntimeEventData =");
    var unionTo = text.indexOf("export type RuntimeEvent =");
    var outside = text.slice(0, unionFrom) + text.slice(unionTo);
    var members = [];
    for (var _i = 0, _a = outside.matchAll(/export type \w+ =([^;]+);/gs); _i < _a.length; _i++) {
        var match = _a[_i];
        for (var _b = 0, _c = match[1].matchAll(/"([a-z][a-z0-9_]*)"/gu); _b < _c.length; _b++) {
            var value = _c[_b];
            members.push(value[1]);
        }
    }
    return __spreadArray([], new Set(members), true);
}
var contract = (0, node_fs_1.readFileSync)((0, node_path_1.join)(ROOT, CONTRACTS), "utf8");
// The contract file itself declares the members, so counting it as a producer
// would make every check pass.
var sources = walk((0, node_path_1.join)(ROOT, "packages"))
    .filter(function (path) {
    return path.includes("/src/") &&
        !path.includes("/test/") &&
        !path.endsWith(CONTRACTS);
})
    .map(function (path) { return (0, node_fs_1.readFileSync)(path, "utf8"); })
    .join("\n");
var inApps = walk((0, node_path_1.join)(ROOT, "apps"))
    .filter(function (path) { return !path.includes("/test/"); })
    .map(function (path) { return (0, node_fs_1.readFileSync)(path, "utf8"); })
    .join("\n");
var producers = "".concat(sources, "\n").concat(inApps);
// Everything declared with no producer, before the allowlist is consulted, so an
// allowlisted member can be told apart from one that was resolved.
var unproduced = __spreadArray(__spreadArray([], eventTypes(contract)
    .filter(function (type) { return !producers.includes("type: \"".concat(type, "\"")); })
    .map(function (type) { return "event ".concat(type); }), true), enumMembers(contract)
    .filter(function (member) { return !producers.includes("\"".concat(member, "\"")); })
    .map(function (member) { return "enum member ".concat(member); }), true);
var unproducedKeys = new Set(unproduced.map(function (entry) { return entry.slice(entry.lastIndexOf(" ") + 1); }));
var missing = unproduced.filter(function (entry) { return !(entry.slice(entry.lastIndexOf(" ") + 1) in ALLOWED); });
// An allowlist entry that stopped being needed hides the next real case, so
// entries are pruned as they resolve.
var stale = Object.keys(ALLOWED).filter(function (key) { return !unproducedKeys.has(key); });
if (stale.length) {
    console.error(__spreadArray(__spreadArray([
        "contract producer guard: allowlist entries that are no longer needed",
        ""
    ], stale.map(function (key) { return "  ".concat(key); }), true), [
        "",
        "The member is produced now (or gone). Remove the entry so the list keeps",
        "describing only what is deliberately unproduced.",
    ], false).join("\n"));
    process.exit(1);
}
if (missing.length) {
    console.error(__spreadArray(__spreadArray([
        "contract producer guard: declared with nothing that produces it",
        ""
    ], missing.map(function (entry) { return "  ".concat(entry); }), true), [
        "",
        "For each: give it a producer, remove it, or add it to ALLOWED in",
        "packages/tooling/testing/bin/contract-producer-guard.ts with the reason it",
        "stays. A member nothing can produce reads to every later reader as a path",
        "that exists.",
    ], false).join("\n"));
    process.exit(1);
}
console.log("contract producer guard passed");
