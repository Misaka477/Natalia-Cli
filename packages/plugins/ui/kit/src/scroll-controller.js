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
exports.TailScrollController = void 0;
var DEFAULT_DISTANCE_THRESHOLD = 2;
var DEFAULT_NEAR_TOP_THRESHOLD = 80;
var DEFAULT_ANCHOR_SELECTOR = "[data-message-id]";
function asHtmlElement(value) {
    if (value === null)
        return undefined;
    if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement)
        return value;
    // Tests and non-browser environments can pass a structurally compatible
    // element. The controller only reads geometry/scroll properties.
    if (typeof value === "object" &&
        value !== null &&
        "scrollTop" in value &&
        "scrollHeight" in value &&
        "clientHeight" in value) {
        return value;
    }
    return undefined;
}
function attributeSelector(selector, value) {
    var escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(value)
        : value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return "".concat(selector, "[data-message-id=\"").concat(escaped, "\"]");
}
/**
 * DSH-aligned tail follower.
 *
 * There is exactly one follow state. The controller never watches content
 * height; it only follows after explicit data updates, an explicit
 * scroll-to-bottom, or while the reader is already within the bottom
 * threshold. User intent always wins and immediately breaks follow.
 */
var TailScrollController = /** @class */ (function () {
    function TailScrollController(options) {
        var _a, _b, _c;
        this.followTail = true;
        this.disposed = false;
        this.restoreAttempts = 0;
        this.notifyingDataChanged = false;
        this.ignoreNextProgrammaticScroll = false;
        this.options = options;
        this.distanceThreshold =
            (_a = options.distanceThreshold) !== null && _a !== void 0 ? _a : DEFAULT_DISTANCE_THRESHOLD;
        this.nearTopThreshold =
            (_b = options.nearTopThreshold) !== null && _b !== void 0 ? _b : DEFAULT_NEAR_TOP_THRESHOLD;
        this.anchorSelector = (_c = options.anchorSelector) !== null && _c !== void 0 ? _c : DEFAULT_ANCHOR_SELECTOR;
    }
    TailScrollController.prototype.getScrollElement = function () {
        return this.options.getScrollElement();
    };
    TailScrollController.prototype.isFollowing = function () {
        return this.followTail;
    };
    TailScrollController.prototype.breakFollow = function () {
        this.ignoreNextProgrammaticScroll = false;
        this.setFollowing(false);
        this.cancelPendingFollow();
        this.cancelPendingRestore();
    };
    TailScrollController.prototype.onUserIntent = function () {
        var element = this.getScrollElement();
        // A pane with no scrollable overflow cannot meaningfully break follow.
        // This covers empty/short Natalia, Navi, Nia, and Subagent panes.
        if (element === undefined ||
            element.scrollHeight - element.clientHeight <= this.distanceThreshold) {
            return;
        }
        this.ignoreNextProgrammaticScroll = false;
        this.setFollowing(false);
        this.cancelPendingFollow();
        this.cancelPendingRestore();
        this.viewportAnchor = this.readViewportAnchor();
    };
    /**
     * Re-evaluate follow after a gesture ends. Touch/pointer-down must break
     * follow immediately to win against any in-flight streaming frame, but a
     * tap (or a drag that never leaves the bottom) should not leave a stray
     * jump button visible.
     */
    TailScrollController.prototype.reconcile = function () {
        if (this.disposed)
            return;
        var element = this.getScrollElement();
        if (!element)
            return;
        this.setFollowing(this.isAtBottom(element));
    };
    TailScrollController.prototype.onScroll = function (event) {
        var _a, _b, _c;
        if (this.disposed || this.isPaused())
            return;
        var element = (_a = asHtmlElement(event.currentTarget)) !== null && _a !== void 0 ? _a : this.getScrollElement();
        if (!element)
            return;
        if (this.ignoreNextProgrammaticScroll) {
            this.ignoreNextProgrammaticScroll = false;
            this.setFollowing(true);
            return;
        }
        this.setFollowing(this.isAtBottom(element));
        // Older-history paging is a reader action, not an initial-layout side
        // effect. A pinned transcript at scrollTop 0 (short content) must not pull
        // the oldest page before the first tail initialization.
        if (!this.followTail && element.scrollTop <= this.nearTopThreshold) {
            (_c = (_b = this.options).onNearTop) === null || _c === void 0 ? void 0 : _c.call(_b, element.scrollTop);
        }
    };
    TailScrollController.prototype.notifyDataChanged = function () {
        if (this.notifyingDataChanged ||
            !this.followTail ||
            this.disposed ||
            this.isPaused())
            return;
        // DSH aligns the tail synchronously in the layout effect that observes
        // the data/structure change. Do the same here so a large block inserted
        // above the viewport cannot race a scroll event into dropping follow
        // before the deferred rAF runs. The follow-up rAF still catches late
        // measurement growth.
        this.notifyingDataChanged = true;
        try {
            this.performScrollToEnd("auto");
            this.scheduleFollowToEnd();
        }
        finally {
            this.notifyingDataChanged = false;
        }
    };
    TailScrollController.prototype.captureOlderAnchor = function () {
        var _a;
        var element = this.getScrollElement();
        if (!element)
            return undefined;
        var viewportAnchor = (_a = this.readViewportAnchor()) !== null && _a !== void 0 ? _a : this.viewportAnchor;
        var anchor = __assign({ scrollHeight: element.scrollHeight, scrollTop: element.scrollTop }, (viewportAnchor === undefined
            ? {}
            : { key: viewportAnchor.key, top: viewportAnchor.top }));
        this.olderAnchor = anchor;
        // If the content is shorter than the viewport, the reader is physically
        // at the bottom even though scrollTop is 0. Do not break follow just
        // because a host offered an older-history hook.
        if (!this.isAtBottom(element)) {
            this.setFollowing(false);
            this.cancelPendingFollow();
        }
        this.cancelPendingRestore();
        return anchor;
    };
    TailScrollController.prototype.restoreOlderAnchor = function () {
        var _a;
        if (this.disposed)
            return;
        var anchor = (_a = this.olderAnchor) !== null && _a !== void 0 ? _a : this.buildAnchorFromViewport();
        this.olderAnchor = undefined;
        this.restoreAttempts = 0;
        this.setFollowing(false);
        this.cancelPendingFollow();
        if (!anchor)
            return;
        this.applyOlderAnchor(anchor);
        this.scheduleRestoreRetry(anchor);
    };
    TailScrollController.prototype.scrollToBottom = function (options) {
        var _a;
        if (this.disposed)
            return;
        this.setFollowing(true);
        this.cancelPendingRestore();
        this.performScrollToEnd((_a = options === null || options === void 0 ? void 0 : options.behavior) !== null && _a !== void 0 ? _a : "auto");
        this.scheduleFollowToEnd();
    };
    TailScrollController.prototype.scrollToIndex = function (index, options) {
        var _a, _b;
        if (this.disposed)
            return;
        this.ignoreNextProgrammaticScroll = false;
        this.setFollowing(false);
        this.cancelPendingFollow();
        this.cancelPendingRestore();
        (_b = (_a = this.options).scrollToIndex) === null || _b === void 0 ? void 0 : _b.call(_a, index, options);
    };
    TailScrollController.prototype.dispose = function () {
        this.disposed = true;
        this.ignoreNextProgrammaticScroll = false;
        this.cancelPendingFollow();
        this.cancelPendingRestore();
        this.olderAnchor = undefined;
        this.viewportAnchor = undefined;
    };
    TailScrollController.prototype.isPaused = function () {
        var _a, _b;
        return ((_b = (_a = this.options).isPaused) === null || _b === void 0 ? void 0 : _b.call(_a)) === true;
    };
    TailScrollController.prototype.isAtBottom = function (element) {
        return (element.scrollHeight - element.clientHeight - element.scrollTop <=
            this.distanceThreshold);
    };
    TailScrollController.prototype.setFollowing = function (next) {
        var _a, _b;
        if (this.followTail === next || this.disposed)
            return;
        this.followTail = next;
        (_b = (_a = this.options).onFollowChange) === null || _b === void 0 ? void 0 : _b.call(_a, next);
    };
    TailScrollController.prototype.performScrollToEnd = function (behavior) {
        var _a, _b;
        var element = this.getScrollElement();
        if (!element)
            return;
        this.ignoreNextProgrammaticScroll = true;
        if (this.options.scrollToEnd !== undefined) {
            this.options.scrollToEnd({ behavior: behavior });
        }
        else {
            element.scrollTop = element.scrollHeight;
        }
        (_b = (_a = this.options).onAfterFollow) === null || _b === void 0 ? void 0 : _b.call(_a, element.scrollTop);
    };
    TailScrollController.prototype.scheduleFollowToEnd = function () {
        var _this = this;
        if (this.cancelFollowSchedule !== undefined ||
            !this.followTail ||
            this.disposed ||
            this.isPaused())
            return;
        var run = function () {
            _this.cancelFollowSchedule = undefined;
            if (!_this.followTail || _this.disposed || _this.isPaused())
                return;
            _this.performScrollToEnd("auto");
        };
        if (typeof requestAnimationFrame === "function") {
            var frame_1 = requestAnimationFrame(run);
            this.cancelFollowSchedule = function () { return cancelAnimationFrame(frame_1); };
        }
        else {
            var timer_1 = setTimeout(run, 0);
            this.cancelFollowSchedule = function () { return clearTimeout(timer_1); };
        }
    };
    TailScrollController.prototype.cancelPendingFollow = function () {
        var _a;
        (_a = this.cancelFollowSchedule) === null || _a === void 0 ? void 0 : _a.call(this);
        this.cancelFollowSchedule = undefined;
    };
    TailScrollController.prototype.cancelPendingRestore = function () {
        var _a;
        (_a = this.cancelRestoreSchedule) === null || _a === void 0 ? void 0 : _a.call(this);
        this.cancelRestoreSchedule = undefined;
        this.restoreAttempts = 0;
    };
    TailScrollController.prototype.scheduleRestoreRetry = function (anchor) {
        var _this = this;
        if (anchor.key === undefined || this.restoreAttempts >= 3)
            return;
        var retry = function () {
            _this.cancelRestoreSchedule = undefined;
            if (_this.disposed || _this.followTail)
                return;
            _this.restoreAttempts += 1;
            _this.applyOlderAnchor(anchor);
            _this.scheduleRestoreRetry(anchor);
        };
        if (typeof requestAnimationFrame === "function") {
            var frame_2 = requestAnimationFrame(retry);
            this.cancelRestoreSchedule = function () { return cancelAnimationFrame(frame_2); };
        }
        else {
            var timer_2 = setTimeout(retry, 0);
            this.cancelRestoreSchedule = function () { return clearTimeout(timer_2); };
        }
    };
    TailScrollController.prototype.buildAnchorFromViewport = function () {
        var _a, _b;
        var anchor = this.viewportAnchor;
        if (anchor === undefined)
            return undefined;
        var element = this.getScrollElement();
        return {
            scrollHeight: (_a = element === null || element === void 0 ? void 0 : element.scrollHeight) !== null && _a !== void 0 ? _a : 0,
            scrollTop: (_b = element === null || element === void 0 ? void 0 : element.scrollTop) !== null && _b !== void 0 ? _b : 0,
            key: anchor.key,
            top: anchor.top,
        };
    };
    TailScrollController.prototype.applyOlderAnchor = function (anchor) {
        var _a, _b;
        var element = this.getScrollElement();
        if (!element)
            return;
        if (anchor.key !== undefined) {
            var row = this.findAnchorRow(anchor.key);
            if (row !== null) {
                var containerRect = element.getBoundingClientRect();
                var rowRect = row.getBoundingClientRect();
                element.scrollTop +=
                    rowRect.top - containerRect.top - ((_a = anchor.top) !== null && _a !== void 0 ? _a : 0);
                this.viewportAnchor = { key: anchor.key, top: (_b = anchor.top) !== null && _b !== void 0 ? _b : 0 };
                return;
            }
        }
        element.scrollTop =
            anchor.scrollTop + (element.scrollHeight - anchor.scrollHeight);
    };
    TailScrollController.prototype.readViewportAnchor = function () {
        var element = this.getScrollElement();
        if (!element)
            return undefined;
        var anchorSelector = this.anchorSelector;
        var rows = [];
        try {
            rows = __spreadArray([], element.querySelectorAll(anchorSelector), true);
        }
        catch (_a) {
            rows = [];
        }
        var containerRect = element.getBoundingClientRect();
        for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
            var row = rows_1[_i];
            var rect = row.getBoundingClientRect();
            if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom)
                continue;
            var key = row.dataset.messageId;
            if (key)
                return { key: key, top: rect.top - containerRect.top };
        }
        return undefined;
    };
    TailScrollController.prototype.findAnchorRow = function (key) {
        var element = this.getScrollElement();
        if (!element)
            return null;
        try {
            return element.querySelector(attributeSelector(this.anchorSelector, key));
        }
        catch (_a) {
            return null;
        }
    };
    return TailScrollController;
}());
exports.TailScrollController = TailScrollController;
