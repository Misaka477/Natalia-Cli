"use strict";
/**
 * The conversation a forked subagent inherits from its parent.
 *
 * A fresh subagent starts with nothing but its task. A forked one starts with
 * its parent's conversation, which is what lets it continue work in progress
 * rather than re-deriving it from a one-line description.
 *
 * The seed is a **balanced completed-turn prefix**, which is the invariant that
 * makes it replayable: contiguous from the start of the conversation, with every
 * tool call still paired with its result, and stopping before the turn the parent
 * is in the middle of. A seed that began mid-exchange would hand the child an
 * orphaned tool result, and one that ran into the in-flight turn would show it a
 * request the parent has not answered yet.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSeedRole = isSeedRole;
exports.forkSeedEntries = forkSeedEntries;
/**
 * Roles that carry into a fork.
 *
 * `system` is excluded because the child has its own instructions and inheriting
 * the parent's would overwrite them. `resource` is excluded because the child
 * resolves its own. `dynamic` is excluded because those are the parent's runtime
 * notices — what the parent was told, not what was said.
 */
var SEED_ROLES = new Set([
    "user",
    "assistant",
    "tool_call",
    "tool_result",
    "summary",
]);
/** Whether a role survives into a fork seed. */
function isSeedRole(role) {
    return SEED_ROLES.has(role);
}
/** Index of the entry a forked child's own conversation starts after. */
function lastUserIndex(entries) {
    for (var index = entries.length - 1; index >= 0; index -= 1) {
        if (entries[index].role === "user")
            return index;
    }
    // No user message at all: the whole conversation is the parent's own runtime
    // scaffolding, and there is nothing completed to hand a child.
    return -1;
}
/**
 * The balanced completed-turn prefix of a parent's conversation.
 *
 * Everything before the parent's last user message — that message starts the turn
 * the parent may still be inside — with unpaired exchanges trimmed from both
 * ends so the seed is replayable on its own.
 */
function forkSeedEntries(entries) {
    var boundary = lastUserIndex(entries);
    if (boundary < 0)
        return [];
    // Drop non-seed roles first, so the trims below see the conversation as the
    // child will. Trimming against a leading system entry instead would leave an
    // orphaned tool result at the front, because the system head is not a seed
    // role and so is not something the trim loop stops on.
    var seed = entries
        .slice(0, boundary)
        .filter(function (entry) { return isSeedRole(entry.role); });
    // Trim a leading orphaned tool result: its call was compacted away or never
    // existed, and a provider rejects a conversation that opens with one.
    while (seed.length > 0 && seed[0].role === "tool_result")
        seed = seed.slice(1);
    var _loop_1 = function () {
        var candidate = seed[seed.length - 1];
        if (candidate.role !== "tool_call")
            return "break";
        var hasResult = candidate.pairID !== undefined &&
            seed
                .slice(0, -1)
                .some(function (entry) {
                return entry.role === "tool_result" && entry.pairID === candidate.pairID;
            });
        if (hasResult)
            return "break";
        seed = seed.slice(0, -1);
    };
    // Trim a trailing unpaired tool call: its result has not been produced yet, so
    // carrying it would ask the child to answer for work it never did.
    while (seed.length > 0) {
        var state_1 = _loop_1();
        if (state_1 === "break")
            break;
    }
    // Re-key so a parent entry id cannot collide with the child's own `system`,
    // `task` or step entries: the ledger rejects a duplicate id, and a fork that
    // failed to seed would silently start the child with nothing.
    return seed.map(function (entry) { return (__assign(__assign({}, entry), { id: entry.id.startsWith("fork:") ? entry.id : "fork:".concat(entry.id) })); });
}
