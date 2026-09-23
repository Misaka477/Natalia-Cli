"use strict";
/**
 * Pure tail-scroll state machine, aligned with deepseek-harness
 * TrajectoryTable's `tableScrollInitialized` / `followsTableTail` /
 * `olderLoadAnchor` model.
 *
 * The host owns DOM/effects; this module owns only the decisions:
 * when to initialize the tail, when new content may follow it, and when a
 * prepend must restore a saved anchor instead.
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
exports.initialTailScrollState = initialTailScrollState;
exports.evaluateTailScroll = evaluateTailScroll;
function initialTailScrollState() {
    return {
        initialized: false,
        following: true,
        lastStartKey: null,
        olderAnchor: null,
    };
}
function evaluateTailScroll(state, input) {
    var next = __assign({}, state);
    // A prepend changes the head while an older-page anchor is pending.
    if (next.olderAnchor !== null &&
        next.olderAnchor.startKey !== input.firstKey) {
        var anchor = next.olderAnchor;
        next.olderAnchor = null;
        next.following = false;
        next.lastStartKey = input.firstKey;
        return { state: next, effect: { type: "restore-anchor", anchor: anchor } };
    }
    // Whole transcript/session replacement: run first-load initialization again.
    if (next.initialized &&
        next.lastStartKey !== null &&
        next.lastStartKey !== input.firstKey) {
        next.initialized = false;
        next.following = true;
    }
    next.lastStartKey = input.firstKey;
    if (input.historyLoading || input.count === 0)
        return { state: next, effect: { type: "none" } };
    if (!next.initialized) {
        // Dynamic message heights need a measured virtual window before the one
        // initial scroll-to-end can own the tail.
        if (input.virtualize && !input.virtualReady)
            return { state: next, effect: { type: "none" } };
        next.initialized = true;
        next.following = true;
        return { state: next, effect: { type: "measure-and-scroll-end" } };
    }
    if (!next.following)
        return { state: next, effect: { type: "none" } };
    return { state: next, effect: { type: "scroll-end" } };
}
