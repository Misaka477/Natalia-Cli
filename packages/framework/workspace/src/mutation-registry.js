"use strict";
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
exports.createMutationRegistry = createMutationRegistry;
function createMutationRegistry() {
    var expected = new Map();
    /**
     * Register an expected mutation before the tool runs. The key is the call or
     * operation identity, so a settle can find it back.
     */
    function register(input) {
        var _a;
        var key = (_a = input.callID) !== null && _a !== void 0 ? _a : input.operationID;
        if (!key)
            throw new Error("expected mutation requires callID or operationID");
        expected.set(key, __assign(__assign({}, input), { settled: false }));
        return key;
    }
    /**
     * Match a hint against the open (unsettled) expected mutations. Returns the
     * correlated identity when an authorized path within scope and an expected
     * operation both line up; undefined otherwise.
     */
    function match(input) {
        for (var _i = 0, _a = expected.values(); _i < _a.length; _i++) {
            var mutation = _a[_i];
            if (mutation.settled)
                continue;
            if (!mutation.expectedOperations.includes(input.operation))
                continue;
            var inScope = mutation.authorizedPaths.some(function (scope) {
                return scope === "." ||
                    scope === "" ||
                    input.path === scope ||
                    input.path.startsWith("".concat(scope, "/"));
            });
            if (!inScope)
                continue;
            return {
                turnID: mutation.turnID,
                callID: mutation.callID,
                operationID: mutation.operationID,
                sessionID: mutation.sessionID,
                episodeID: mutation.episodeID,
                toolName: mutation.toolName,
            };
        }
        return undefined;
    }
    /**
     * Mark a call/operation settled after success. The record stops matching
     * (later unrelated hints are not attributed to it) but keeps its identity so
     * attribution of the change it caused remains possible.
     */
    function settle(key) {
        var mutation = expected.get(key);
        if (mutation)
            mutation.settled = true;
    }
    /** Forget an expected mutation that never ran or was cancelled. */
    function forget(key) {
        expected.delete(key);
    }
    function pendingCount() {
        return __spreadArray([], expected.values(), true).filter(function (mutation) { return !mutation.settled; })
            .length;
    }
    return { register: register, match: match, settle: settle, forget: forget, pendingCount: pendingCount };
}
