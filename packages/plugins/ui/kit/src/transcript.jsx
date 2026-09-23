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
exports.Transcript = Transcript;
exports.estimateMessageHeight = estimateMessageHeight;
exports.fixedRowHeight = fixedRowHeight;
exports.MessageRow = MessageRow;
exports.formatBashBlocks = formatBashBlocks;
var solid_js_1 = require("solid-js");
var solid_virtual_1 = require("@tanstack/solid-virtual");
var marked_1 = require("marked");
var scroll_controller_1 = require("./scroll-controller");
var tail_scroll_machine_1 = require("./tail-scroll-machine");
var virtual_items_1 = require("./virtual-items");
var VIRTUALIZE_THRESHOLD = 80;
var BOTTOM_FOLLOW_THRESHOLD_PX = 2;
var VIRTUAL_OVERSCAN = 24;
var VIRTUAL_ROW_GAP = 6;
var VIRTUAL_INITIAL_VIEWPORT_HEIGHT_PX = 600;
var TOOL_OUTPUT_COLLAPSE_LINES = 14;
var TOOL_OUTPUT_PREVIEW_LINES = 10;
function uiDebugEnabled() {
    var _a, _b;
    try {
        if (((_a = globalThis.localStorage) === null || _a === void 0 ? void 0 : _a.getItem("natalia.debug.ui")) === "1")
            return true;
        var href = (_b = globalThis.location) === null || _b === void 0 ? void 0 : _b.href;
        if (!href)
            return false;
        return new URL(href).searchParams.get("nataliaDebugUi") === "1";
    }
    catch (_c) {
        return false;
    }
}
function Transcript(props) {
    var _a, _b;
    var _c = (0, solid_js_1.createSignal)(), scrollEl = _c[0], setScrollEl = _c[1];
    var _d = (0, solid_js_1.createSignal)(false), scrollReady = _d[0], setScrollReady = _d[1];
    var virtualize = function () { return props.messages.length > VIRTUALIZE_THRESHOLD; };
    var controller;
    // dsh's useStableVirtualRowStructure keeps row identity/height stable across
    // renders. Message heights are dynamic, so cache by a content signature: a
    // measurement callback must not see a different estimate for the same row.
    var estimateCache = new Map();
    var messageSignature = function (message) {
        var _a, _b, _c;
        return [
            message.id,
            message.role,
            message.content.length,
            message.thinking === true,
            (_b = (_a = message.attachments) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
            ((_c = message.toolCalls) !== null && _c !== void 0 ? _c : [])
                .map(function (call) { var _a, _b; return "".concat(call.name, ":").concat((_b = (_a = call.output) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0); })
                .join(","),
        ].join("|");
    };
    var estimateStable = function (index) {
        var message = props.messages[index];
        if (message === undefined)
            return 40;
        var signature = messageSignature(message);
        var cached = estimateCache.get(message.id);
        if (cached !== undefined && cached.signature === signature)
            return cached.height;
        // The virtualizer uses the deterministic fixed-height row model, so the
        // estimate is the rendered height and no DOM measurement is needed.
        var height = fixedRowHeight(message);
        estimateCache.set(message.id, { signature: signature, height: height });
        if (estimateCache.size > 4096) {
            var oldest = estimateCache.keys().next().value;
            if (oldest !== undefined)
                estimateCache.delete(oldest);
        }
        return height;
    };
    var virtualizer = (0, solid_virtual_1.createVirtualizer)({
        get count() {
            return props.messages.length;
        },
        getScrollElement: function () { var _a; return (_a = scrollEl()) !== null && _a !== void 0 ? _a : null; },
        estimateSize: function (index) { return estimateStable(index); },
        getItemKey: function (index) { var _a, _b; return (_b = (_a = props.messages[index]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : index; },
        anchorTo: "end",
        // Match deepseek-harness TrajectoryTable: anchorTo:"end" plus the same
        // 2px follow threshold lets TanStack compensate dynamic estimate→measure
        // deltas while the reader is pinned. Follow *ownership* still lives in
        // TailScrollController; without this end compensation a late measurement
        // of a large row above the fold silently leaves the scrollport above the
        // true bottom with no scroll event to correct it.
        scrollEndThreshold: BOTTOM_FOLLOW_THRESHOLD_PX,
        initialRect: {
            width: 0,
            height: VIRTUAL_INITIAL_VIEWPORT_HEIGHT_PX,
        },
        get useCachedMeasurements() {
            return props.suspendVirtualization === true;
        },
        gap: VIRTUAL_ROW_GAP,
        overscan: VIRTUAL_OVERSCAN,
        onChange: function () {
            // Tail-follow is owned by the transcript state machine below; a
            // measurement callback must not scroll on its own.
        },
    });
    var pendingScrollEl;
    var setScrollRef = function (el) {
        var _a;
        if (!el) {
            pendingScrollEl = undefined;
            setScrollEl(undefined);
            (_a = props.scrollRef) === null || _a === void 0 ? void 0 : _a.call(props, undefined);
            return;
        }
        pendingScrollEl = el;
        var commit = function () {
            var _a;
            if (pendingScrollEl !== el || !el.isConnected)
                return;
            pendingScrollEl = undefined;
            setScrollEl(el);
            (_a = props.scrollRef) === null || _a === void 0 ? void 0 : _a.call(props, el);
        };
        // Solid's compiled ref callback runs before the cloned node is inserted.
        // At that point a template clone can still have an ownerDocument whose
        // defaultView is null, so TanStack cannot attach its scroll observers.
        // Commit after insertion (microtask when possible, rAF as fallback).
        if (el.isConnected) {
            commit();
            return;
        }
        queueMicrotask(function () {
            if (el.isConnected)
                commit();
            else
                requestAnimationFrame(commit);
        });
    };
    var liveVirtualItems = function () { return virtualizer.getVirtualItems(); };
    var liveTotalSize = function () { return virtualizer.getTotalSize(); };
    // deepseek-harness TrajectoryTable state machine (pure, tested in
    // tail-scroll-machine.test.ts).
    var tailState = (0, tail_scroll_machine_1.initialTailScrollState)();
    /**
     * The same near-top notification used by native scroll, exposed so a short
     * transcript with older pages can fill itself without a manual button.
     */
    var notifyNearTop = function () {
        var _a, _b, _c, _d, _e;
        if (props.onNearTop === undefined ||
            !tailState.initialized ||
            props.olderHistoryLoading === true)
            return;
        var el = scrollEl();
        if (el !== undefined) {
            var firstVirtual = (_b = (_a = liveVirtualItems()[0]) === null || _a === void 0 ? void 0 : _a.index) !== null && _b !== void 0 ? _b : 0;
            var visibleIndex = virtualize() && liveVirtualItems().length > 0 ? firstVirtual : 0;
            var visibleKey = (_d = (_c = props.messages[visibleIndex]) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null;
            var visibleRow = visibleKey === null
                ? null
                : el.querySelector("[data-message-id=\"".concat(CSS.escape(visibleKey), "\"]"));
            var containerRect = el.getBoundingClientRect();
            tailState = __assign(__assign({}, tailState), { olderAnchor: {
                    startKey: tailState.lastStartKey,
                    scrollHeight: el.scrollHeight,
                    scrollTop: el.scrollTop,
                    visibleKey: visibleKey,
                    visibleTop: visibleRow === null
                        ? 0
                        : visibleRow.getBoundingClientRect().top - containerRect.top,
                } });
        }
        props.onNearTop((_e = el === null || el === void 0 ? void 0 : el.scrollTop) !== null && _e !== void 0 ? _e : 0);
    };
    var frozenVirtualItems = [];
    var frozenTotalSize = 0;
    (0, solid_js_1.createEffect)(function () {
        if (props.suspendVirtualization)
            return;
        frozenVirtualItems = liveVirtualItems();
        frozenTotalSize = liveTotalSize();
    });
    var virtualItems = function () {
        return (0, virtual_items_1.dedupeVirtualItems)(props.suspendVirtualization ? frozenVirtualItems : liveVirtualItems());
    };
    var totalSize = function () {
        return props.suspendVirtualization ? frozenTotalSize : liveTotalSize();
    };
    // TanStack needs one paint to observe the scroll element. Until it has
    // produced a valid window, render the ordinary list so long histories are
    // never blank and switching sessions cannot leave stale indexes on screen.
    var useVirtual = function () {
        if (!virtualize())
            return false;
        var items = virtualItems();
        if (items.length === 0)
            return false;
        if (!items.every(function (item) {
            return item !== undefined && props.messages[item.index] !== undefined;
        }))
            return false;
        // A data change from a one-row live projection to a full hydrated history
        // can leave the cached virtual window covering only that one row even
        // though every index is technically valid. Treat an absurdly small window
        // as not-ready so the fallback list renders the real history while the
        // remeasure below rebuilds the virtualizer.
        var first = items[0].index;
        var last = items.at(-1).index;
        if (last - first + 1 < Math.min(props.messages.length, 2))
            return false;
        return true;
    };
    var lastMessageCount = -1;
    (0, solid_js_1.createEffect)(function () {
        var count = props.messages.length;
        if (count === lastMessageCount)
            return;
        var previous = lastMessageCount;
        lastMessageCount = count;
        if (previous < 0)
            return;
        // Count changes invalidate the cached window. Rebuild after the DOM has
        // taken the new count; otherwise the transcript can stay pinned to the
        // previous (possibly single-row) end window.
        requestAnimationFrame(function () {
            virtualizer.measure();
            controller === null || controller === void 0 ? void 0 : controller.notifyDataChanged();
        });
    });
    var topSpacer = function () {
        var first = virtualItems()[0];
        return first ? Math.max(0, first.start) : 0;
    };
    var bottomSpacer = function () {
        var items = virtualItems();
        var last = items.at(-1);
        return last ? Math.max(0, totalSize() - last.end) : 0;
    };
    controller = new scroll_controller_1.TailScrollController({
        getScrollElement: function () { return scrollEl(); },
        scrollToEnd: function (options) {
            var _a;
            if (virtualize() && liveVirtualItems().length > 0) {
                virtualizer.scrollToEnd({ behavior: (_a = options === null || options === void 0 ? void 0 : options.behavior) !== null && _a !== void 0 ? _a : "auto" });
            }
            else {
                var el = scrollEl();
                if (el)
                    el.scrollTop = el.scrollHeight;
            }
        },
        scrollToIndex: function (index, options) {
            var _a, _b, _c, _d;
            if (props.messages.length === 0)
                return;
            var target = Math.max(0, Math.min(index, props.messages.length - 1));
            var el = scrollEl();
            if (el && virtualize() && liveVirtualItems().length > 0) {
                virtualizer.scrollToIndex(target, {
                    align: (_a = options === null || options === void 0 ? void 0 : options.align) !== null && _a !== void 0 ? _a : "auto",
                    behavior: (_b = options === null || options === void 0 ? void 0 : options.behavior) !== null && _b !== void 0 ? _b : "auto",
                });
                return;
            }
            var row = el === null || el === void 0 ? void 0 : el.querySelector("[data-message-id=\"".concat(CSS.escape((_d = (_c = props.messages[target]) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : ""), "\"]"));
            if (el && row) {
                el.scrollTop +=
                    row.getBoundingClientRect().top - el.getBoundingClientRect().top;
            }
        },
        distanceThreshold: 2,
        nearTopThreshold: 80,
        isPaused: function () { return props.suspendVirtualization === true; },
        onFollowChange: function (following) { var _a; return (_a = props.onFollowChange) === null || _a === void 0 ? void 0 : _a.call(props, following); },
        onNearTop: function () { return notifyNearTop(); },
    });
    var scrollToBottom = function (options) {
        controller === null || controller === void 0 ? void 0 : controller.scrollToBottom(options);
    };
    var scrollToIndex = function (index, options) {
        controller === null || controller === void 0 ? void 0 : controller.scrollToIndex(index, options);
    };
    var api = {
        scrollToBottom: scrollToBottom,
        scrollToIndex: scrollToIndex,
        measure: function () { return virtualizer.measure(); },
        isFollowing: function () { var _a; return (_a = controller === null || controller === void 0 ? void 0 : controller.isFollowing()) !== null && _a !== void 0 ? _a : true; },
        breakFollow: function () { return controller === null || controller === void 0 ? void 0 : controller.breakFollow(); },
    };
    // deepseek-harness TrajectoryTable layout contract:
    // - historyLoading gates first initialization
    // - the first measured window owns one scroll-to-end
    // - later growth follows only while the reader is pinned
    // - a pending older anchor owns prepend restoration
    (0, solid_js_1.createEffect)(function () {
        var _a, _b;
        var el = scrollEl();
        if (el === undefined)
            return;
        var result = (0, tail_scroll_machine_1.evaluateTailScroll)(tailState, {
            count: props.messages.length,
            firstKey: (_b = (_a = props.messages[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null,
            historyLoading: props.historyLoading === true,
            virtualize: virtualize(),
            virtualReady: useVirtual(),
        });
        tailState = result.state;
        if (!result.state.initialized)
            setScrollReady(false);
        var effect = result.effect;
        if (effect.type === "none")
            return;
        if (effect.type === "restore-anchor") {
            var anchor_1 = effect.anchor;
            controller === null || controller === void 0 ? void 0 : controller.breakFollow();
            var visibleIndex = anchor_1.visibleKey === null
                ? -1
                : props.messages.findIndex(function (message) { return message.id === anchor_1.visibleKey; });
            if (virtualize() && visibleIndex >= 0 && liveVirtualItems().length > 0) {
                virtualizer.scrollToIndex(visibleIndex, { align: "start" });
                if (anchor_1.visibleKey !== null) {
                    requestAnimationFrame(function () {
                        var row = el.querySelector("[data-message-id=\"".concat(CSS.escape(anchor_1.visibleKey), "\"]"));
                        if (row !== null) {
                            el.scrollTop +=
                                row.getBoundingClientRect().top -
                                    el.getBoundingClientRect().top -
                                    anchor_1.visibleTop;
                        }
                    });
                }
            }
            else {
                el.scrollTop =
                    anchor_1.scrollTop + (el.scrollHeight - anchor_1.scrollHeight);
            }
            return;
        }
        if (effect.type === "measure-and-scroll-end") {
            virtualizer.measure();
            requestAnimationFrame(function () {
                controller === null || controller === void 0 ? void 0 : controller.scrollToBottom({ behavior: "auto" });
                setScrollReady(true);
            });
            return;
        }
        requestAnimationFrame(function () {
            controller === null || controller === void 0 ? void 0 : controller.scrollToBottom({ behavior: "auto" });
        });
    });
    (0, solid_js_1.createEffect)(function () {
        var el = scrollEl();
        if (el === undefined)
            return;
        // Short transcripts never fire a scroll event, so a manual button used to
        // be the only path to older history. Match Natalia's scroll path and
        // auto-fill one page when the pane is not yet scrollable.
        void scrollReady();
        if (props.hasOlder !== true ||
            props.olderHistoryLoading === true ||
            !scrollReady() ||
            !tailState.initialized)
            return;
        var count = props.messages.length;
        if (count === 0)
            return;
        if (el.scrollHeight <= el.clientHeight + 80) {
            requestAnimationFrame(function () { return notifyNearTop(); });
        }
    });
    (0, solid_js_1.onMount)(function () {
        var _a;
        (_a = props.apiRef) === null || _a === void 0 ? void 0 : _a.call(props, api);
        console.log("[natalia-ui] transcript mounted", JSON.stringify({
            messages: props.messages.length,
            debug: uiDebugEnabled(),
            virtualizeThreshold: VIRTUALIZE_THRESHOLD,
        }));
    });
    (0, solid_js_1.onCleanup)(function () {
        var _a;
        controller === null || controller === void 0 ? void 0 : controller.dispose();
        (_a = props.apiRef) === null || _a === void 0 ? void 0 : _a.call(props, undefined);
    });
    var lastVirtualScrollEl;
    var lastVirtualEnabled = false;
    (0, solid_js_1.createEffect)(function () {
        var el = scrollEl();
        var enabled = props.messages.length > VIRTUALIZE_THRESHOLD;
        if (el === lastVirtualScrollEl && enabled === lastVirtualEnabled)
            return;
        lastVirtualScrollEl = el;
        lastVirtualEnabled = enabled;
        if (!el || !enabled)
            return;
        // Force the virtualizer to pick up the element even if the Solid option
        // proxy did not observe the ref signal, then rebuild measurements once.
        virtualizer._willUpdate();
        requestAnimationFrame(function () {
            if (enabled)
                virtualizer.measure();
        });
    });
    var handleScroll = function (event) {
        var _a, _b, _c, _d;
        var startedAt = performance.now();
        controller === null || controller === void 0 ? void 0 : controller.onScroll(event);
        tailState = __assign(__assign({}, tailState), { following: (_a = controller === null || controller === void 0 ? void 0 : controller.isFollowing()) !== null && _a !== void 0 ? _a : true });
        (_b = props.onScroll) === null || _b === void 0 ? void 0 : _b.call(props, event);
        if (!uiDebugEnabled())
            return;
        var el = scrollEl();
        var mounted = useVirtual() ? virtualItems() : [];
        console.log("[natalia-ui] transcript scroll", {
            elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
            scrollTop: el === null || el === void 0 ? void 0 : el.scrollTop,
            clientHeight: el === null || el === void 0 ? void 0 : el.clientHeight,
            scrollHeight: el === null || el === void 0 ? void 0 : el.scrollHeight,
            mounted: mounted.length,
            firstMounted: (_c = mounted[0]) === null || _c === void 0 ? void 0 : _c.index,
            lastMounted: (_d = mounted.at(-1)) === null || _d === void 0 ? void 0 : _d.index,
        });
    };
    var handleWheel = function (event) {
        if (Math.abs(event.deltaY) < 1)
            return;
        var el = scrollEl();
        if (el) {
            var atBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= 2;
            // Scrolling further down at the physical bottom is not a reason to
            // leave follow mode.
            if (atBottom && event.deltaY > 0)
                return;
        }
        controller === null || controller === void 0 ? void 0 : controller.onUserIntent();
    };
    var handleUserIntentStart = function () {
        controller === null || controller === void 0 ? void 0 : controller.onUserIntent();
    };
    var handlePointerDown = function (event) {
        if (event.button !== 0)
            return;
        controller === null || controller === void 0 ? void 0 : controller.onUserIntent();
    };
    var handleUserIntentEnd = function () {
        controller === null || controller === void 0 ? void 0 : controller.reconcile();
    };
    (0, solid_js_1.createEffect)(function () {
        var _a, _b;
        if (!uiDebugEnabled())
            return;
        var mounted = useVirtual() ? virtualItems() : [];
        console.log("[natalia-ui] transcript window", JSON.stringify({
            messages: props.messages.length,
            virtualized: virtualize(),
            virtualReady: useVirtual(),
            mounted: mounted.length,
            firstMounted: (_a = mounted[0]) === null || _a === void 0 ? void 0 : _a.index,
            lastMounted: (_b = mounted.at(-1)) === null || _b === void 0 ? void 0 : _b.index,
            totalSize: useVirtual() ? totalSize() : null,
        }));
    });
    var lastVirtualReady;
    var lastVirtualMessages = -1;
    (0, solid_js_1.createEffect)(function () {
        var _a, _b;
        var ready = useVirtual();
        var messages = props.messages.length;
        if (ready === lastVirtualReady && messages === lastVirtualMessages)
            return;
        lastVirtualReady = ready;
        lastVirtualMessages = messages;
        var items = ready ? virtualItems() : [];
        console.log("[natalia-ui] transcript virtualization", JSON.stringify({
            messages: messages,
            virtualReady: ready,
            mounted: items.length,
            firstMounted: (_a = items[0]) === null || _a === void 0 ? void 0 : _a.index,
            lastMounted: (_b = items.at(-1)) === null || _b === void 0 ? void 0 : _b.index,
            totalSize: ready ? totalSize() : null,
        }));
    });
    var lastDuplicateSignature = "";
    (0, solid_js_1.createEffect)(function () {
        if (!uiDebugEnabled())
            return;
        var duplicateMessageIDs = (0, virtual_items_1.duplicateValues)(props.messages.map(function (message) { return message.id; }));
        var duplicateIndexes = (0, virtual_items_1.duplicateVirtualIndexes)(virtualItems());
        if (duplicateMessageIDs.length === 0 && duplicateIndexes.length === 0) {
            lastDuplicateSignature = "";
            return;
        }
        var signature = JSON.stringify({
            duplicateMessageIDs: duplicateMessageIDs,
            duplicateIndexes: duplicateIndexes,
        });
        if (signature === lastDuplicateSignature)
            return;
        lastDuplicateSignature = signature;
        console.warn("[natalia-ui] duplicate transcript rows", signature);
    });
    var lastSuspended = false;
    (0, solid_js_1.createEffect)(function () {
        var suspended = props.suspendVirtualization === true;
        if (lastSuspended && !suspended) {
            requestAnimationFrame(function () {
                if (props.suspendVirtualization)
                    return;
                virtualizer.measure();
                controller === null || controller === void 0 ? void 0 : controller.notifyDataChanged();
            });
        }
        lastSuspended = suspended;
    });
    var lastLayoutSignature = "";
    (0, solid_js_1.createEffect)(function () {
        var _a, _b;
        var items = useVirtual() ? virtualItems() : [];
        if (!items.length)
            return;
        var signature = "".concat(props.messages.length, ":").concat((_a = items[0]) === null || _a === void 0 ? void 0 : _a.index, ":").concat((_b = items.at(-1)) === null || _b === void 0 ? void 0 : _b.index);
        if (signature === lastLayoutSignature)
            return;
        lastLayoutSignature = signature;
        requestAnimationFrame(function () {
            var _a, _b, _c, _d;
            var el = scrollEl();
            if (!el)
                return;
            var rows = __spreadArray([], el.querySelectorAll("[data-message-id]"), true);
            var container = el.getBoundingClientRect();
            var first = rows[0];
            var last = rows.at(-1);
            var rectOf = function (row) {
                if (!row)
                    return null;
                var rect = row.getBoundingClientRect();
                return {
                    id: row.dataset.messageId,
                    top: Math.round(rect.top - container.top),
                    height: Math.round(rect.height),
                };
            };
            console.log("[natalia-ui] transcript layout", {
                scrollTop: el.scrollTop,
                clientHeight: el.clientHeight,
                scrollHeight: el.scrollHeight,
                mounted: rows.length,
                topSpacer: (_b = (_a = el
                    .querySelector('[data-virtual-spacer="top"]')) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect().height) !== null && _b !== void 0 ? _b : 0,
                bottomSpacer: (_d = (_c = el
                    .querySelector('[data-virtual-spacer="bottom"]')) === null || _c === void 0 ? void 0 : _c.getBoundingClientRect().height) !== null && _d !== void 0 ? _d : 0,
                first: rectOf(first),
                last: rectOf(last),
            });
        });
    });
    return (<div class="natalia-transcript" data-scroll-ready={scrollReady() ? "true" : props.messages.length === 0 ? "empty" : "false"} ref={setScrollRef} onScroll={handleScroll} onWheel={handleWheel} onTouchStart={handleUserIntentStart} onPointerDown={handlePointerDown} onPointerUp={handleUserIntentEnd} onPointerCancel={handleUserIntentEnd} onTouchEnd={handleUserIntentEnd} onTouchCancel={handleUserIntentEnd}>
      <div class="natalia-transcript-content">
        <solid_js_1.Show when={props.messages.length > 0} fallback={<div class="natalia-transcript-empty">
              <div class="natalia-transcript-empty-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <path d="M20 5C14.4772 5 10 9.47715 10 15V22C10 24.2091 8.20914 26 6 26H5C3.89543 26 3 26.8954 3 28V30C3 31.1046 3.89543 32 5 32H35C36.1046 32 37 31.1046 37 30V28C37 26.8954 36.1046 26 35 26H34C31.7909 26 30 24.2091 30 22V15C30 9.47715 25.5225 5 20 5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="natalia-transcript-empty-title">
                {(_a = props.emptyTitle) !== null && _a !== void 0 ? _a : ""}
              </div>
              <div class="natalia-transcript-empty-hint">
                {(_b = props.emptyHint) !== null && _b !== void 0 ? _b : ""}
              </div>
            </div>}>
          <solid_js_1.Show when={useVirtual()} fallback={<solid_js_1.For each={props.messages}>
                {function (message) { return (<MessageGroup message={message} assistantName={props.assistantName} assistantInitial={props.assistantInitial} loadAttachmentUrl={props.loadAttachmentUrl} onFork={props.onFork} onRollback={props.onRollback}/>); }}
              </solid_js_1.For>}>
            <solid_js_1.Show when={topSpacer() > 0}>
              <div aria-hidden="true" data-virtual-spacer="top" style={{ height: "".concat(topSpacer(), "px") }}/>
            </solid_js_1.Show>
            <solid_js_1.For each={virtualItems()}>
              {function (item) {
            return item === undefined ||
                props.messages[item.index] === undefined ? null : (<MessageGroup message={props.messages[item.index]} virtualIndex={item.index} assistantName={props.assistantName} assistantInitial={props.assistantInitial} loadAttachmentUrl={props.loadAttachmentUrl} onFork={props.onFork} onRollback={props.onRollback}/>);
        }}
            </solid_js_1.For>
            <solid_js_1.Show when={bottomSpacer() > 0}>
              <div aria-hidden="true" data-virtual-spacer="bottom" style={{ height: "".concat(bottomSpacer(), "px") }}/>
            </solid_js_1.Show>
          </solid_js_1.Show>
        </solid_js_1.Show>
      </div>
    </div>);
}
var MESSAGE_BASE_HEIGHT = 66;
var MESSAGE_LINE_HEIGHT = 21.5;
var THINKING_BLOCK_HEIGHT = 46;
var TOOL_CARD_BASE_HEIGHT = 48;
var TOOL_OUTPUT_LINE_HEIGHT = 19;
var ATTACHMENT_GAP = 8;
function wrappedLineCount(text, charsPerLine) {
    if (text === "")
        return 0;
    var lines = 0;
    for (var _i = 0, _a = text.split("\n"); _i < _a.length; _i++) {
        var rawLine = _a[_i];
        lines += Math.max(1, Math.ceil(rawLine.length / charsPerLine));
    }
    return lines;
}
function estimatedTextHeight(text, charsPerLine, lineHeight) {
    if (text === "")
        return 0;
    return wrappedLineCount(text, charsPerLine) * lineHeight;
}
function estimateMarkdownBodyHeight(text) {
    var height = 0;
    var inFence = false;
    for (var _i = 0, _a = text.split("\n"); _i < _a.length; _i++) {
        var line = _a[_i];
        if (/^\s*```/u.test(line)) {
            height += 22;
            inFence = !inFence;
            continue;
        }
        // Fenced code has horizontal scrolling (`overflow-x: auto`) instead of
        // wrapping long lines, so do not inflate an unbroken 2000-character line
        // into dozens of estimated rows.
        height += inFence
            ? 19
            : Math.max(1, Math.ceil(line.length / 96)) * MESSAGE_LINE_HEIGHT;
    }
    return height;
}
function estimateAttachmentHeight(attachment) {
    var _a, _b;
    var width = (_a = attachment.width) !== null && _a !== void 0 ? _a : 160;
    var height = (_b = attachment.height) !== null && _b !== void 0 ? _b : 120;
    var scale = Math.min(1, 240 / Math.max(width, height));
    return Math.max(48, Math.round(height * scale));
}
/**
 * Estimate a rich message group closely enough that the virtualizer does not
 * first discover a 5000px tool output while the reader is scrolling upward.
 * Measurements still refine the exact height, but the initial estimate must
 * account for tool output, thinking, markdown/code lines, and attachments.
 */
function estimateMessageHeight(message) {
    var _a, _b, _c, _d;
    var height = MESSAGE_BASE_HEIGHT;
    // Thinking replaces the ordinary body in MessageRow, so use its own block
    // metrics plus the thought text line count.
    if (message.thinking) {
        height +=
            THINKING_BLOCK_HEIGHT + estimateMarkdownBodyHeight(message.content);
    }
    else if (message.content !== "") {
        height += estimateMarkdownBodyHeight(message.content);
    }
    for (var _i = 0, _e = (_a = message.toolCalls) !== null && _a !== void 0 ? _a : []; _i < _e.length; _i++) {
        var toolCall = _e[_i];
        var output = (_c = (_b = toolCall.output) !== null && _b !== void 0 ? _b : toolCall.summary) !== null && _c !== void 0 ? _c : "";
        var outputLines = wrappedLineCount(output, 110);
        var collapsible = outputLines > TOOL_OUTPUT_COLLAPSE_LINES || output.length > 2000;
        height +=
            TOOL_CARD_BASE_HEIGHT +
                (collapsible
                    ? 16 + TOOL_OUTPUT_PREVIEW_LINES * TOOL_OUTPUT_LINE_HEIGHT + 28
                    : estimatedTextHeight(output, 110, TOOL_OUTPUT_LINE_HEIGHT));
    }
    for (var _f = 0, _g = (_d = message.attachments) !== null && _d !== void 0 ? _d : []; _f < _g.length; _f++) {
        var attachment = _g[_f];
        height += estimateAttachmentHeight(attachment) + ATTACHMENT_GAP;
    }
    return Math.max(MESSAGE_BASE_HEIGHT, Math.ceil(height));
}
/**
 * DSH-style fixed-height row model (scroll Phase 5). Unlike the refining
 * `estimateMessageHeight`, this computes a deterministic, *bounded* height: the
 * markdown/code body is clamped to a fixed line budget and the total to a hard
 * ceiling, and large tool output is always collapsed to its preview. Because
 * the height depends only on clamped content, the rendered row matches it
 * exactly, so the virtualizer no longer needs to measure the DOM
 * (`measureElement`) to stay anchored.
 */
var MAX_MARKDOWN_BODY_LINES = 40;
var MAX_ROW_HEIGHT = 1200;
/** Wrapped line count of a body, capped at a fixed line budget. */
function clampedBodyLines(text, maxLines) {
    var lines = 0;
    var inFence = false;
    for (var _i = 0, _a = text.split("\n"); _i < _a.length; _i++) {
        var line = _a[_i];
        if (/^\s*```/u.test(line)) {
            lines += 1;
            inFence = !inFence;
            if (lines >= maxLines)
                return maxLines;
            continue;
        }
        lines += inFence ? 1 : Math.max(1, Math.ceil(line.length / 96));
        if (lines >= maxLines)
            return maxLines;
    }
    return lines;
}
function fixedRowHeight(message) {
    var _a, _b, _c, _d;
    var height = MESSAGE_BASE_HEIGHT;
    var bodyLines = clampedBodyLines(message.content, MAX_MARKDOWN_BODY_LINES);
    if (message.thinking)
        height += THINKING_BLOCK_HEIGHT + bodyLines * MESSAGE_LINE_HEIGHT;
    else if (message.content !== "")
        height += bodyLines * MESSAGE_LINE_HEIGHT;
    for (var _i = 0, _e = (_a = message.toolCalls) !== null && _a !== void 0 ? _a : []; _i < _e.length; _i++) {
        var toolCall = _e[_i];
        var output = (_c = (_b = toolCall.output) !== null && _b !== void 0 ? _b : toolCall.summary) !== null && _c !== void 0 ? _c : "";
        var outputLines = wrappedLineCount(output, 110);
        var collapsible = outputLines > TOOL_OUTPUT_COLLAPSE_LINES || output.length > 2000;
        height +=
            TOOL_CARD_BASE_HEIGHT +
                (collapsible
                    ? 16 + TOOL_OUTPUT_PREVIEW_LINES * TOOL_OUTPUT_LINE_HEIGHT + 28
                    : outputLines * TOOL_OUTPUT_LINE_HEIGHT);
    }
    for (var _f = 0, _g = (_d = message.attachments) !== null && _d !== void 0 ? _d : []; _f < _g.length; _f++) {
        var attachment = _g[_f];
        height += estimateAttachmentHeight(attachment) + ATTACHMENT_GAP;
    }
    return Math.max(MESSAGE_BASE_HEIGHT, Math.min(MAX_ROW_HEIGHT, Math.ceil(height)));
}
function MessageGroup(props) {
    var setRowRef = function (el) {
        var _a;
        // Solid can call the ref before dynamic data-* attributes are patched.
        // data-index is kept for diagnostics and tests; rows are no longer
        // DOM-measured (the fixed-height row model is the rendered height).
        if (props.virtualIndex !== undefined) {
            el.setAttribute("data-index", String(props.virtualIndex));
        }
        (_a = props.rowRef) === null || _a === void 0 ? void 0 : _a.call(props, el);
    };
    return (<div class="natalia-message-group" data-role={props.message.role} data-message-id={props.message.id} data-index={props.virtualIndex} ref={setRowRef} style={props.style}>
      <MessageRow message={props.message} assistantName={props.assistantName} assistantInitial={props.assistantInitial} loadAttachmentUrl={props.loadAttachmentUrl}/>
      <solid_js_1.Show when={props.message.role !== "system"}>
        <div class="natalia-message-group-actions">
          <button type="button" class="natalia-message-icon-btn" title="复制内容" onClick={function () { var _a; return (_a = navigator.clipboard) === null || _a === void 0 ? void 0 : _a.writeText(props.message.content); }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="5.5" y="5.5" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M10.5 4.5H11.5A1.5 1.5 0 0 1 13 6V11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <span>复制</span>
          </button>
          <solid_js_1.Show when={props.onFork && sessionTurnID(props.message.id)}>
            <button type="button" class="natalia-message-icon-btn" title="从此消息 Fork 会话" onClick={function () { var _a; return (_a = props.onFork) === null || _a === void 0 ? void 0 : _a.call(props, sessionTurnID(props.message.id)); }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="5" cy="4" r="1.6" stroke="currentColor" stroke-width="1.2"/>
                <circle cx="5" cy="12" r="1.6" stroke="currentColor" stroke-width="1.2"/>
                <circle cx="11" cy="12" r="1.6" stroke="currentColor" stroke-width="1.2"/>
                <path d="M5 5.6V10.4M5 10.4H11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              <span>Fork</span>
            </button>
          </solid_js_1.Show>
          <solid_js_1.Show when={props.onRollback}>
            <button type="button" class="natalia-message-icon-btn" title="回滚到此处" onClick={function () { var _a; return (_a = props.onRollback) === null || _a === void 0 ? void 0 : _a.call(props, props.message); }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6.5 3.5L3 7L6.5 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 7H13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                <path d="M11 4.5L13 7L11 9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>回滚</span>
            </button>
          </solid_js_1.Show>
        </div>
      </solid_js_1.Show>
    </div>);
}
function imageBox(attachment) {
    var _a, _b;
    var width = (_a = attachment.width) !== null && _a !== void 0 ? _a : 160;
    var height = (_b = attachment.height) !== null && _b !== void 0 ? _b : 120;
    var scale = Math.min(1, 240 / Math.max(width, height));
    return {
        width: Math.max(48, Math.round(width * scale)),
        height: Math.max(48, Math.round(height * scale)),
    };
}
function AttachmentImage(props) {
    var _a = (0, solid_js_1.createSignal)(""), src = _a[0], setSrc = _a[1];
    var _b = (0, solid_js_1.createSignal)("idle"), status = _b[0], setStatus = _b[1];
    var _c = (0, solid_js_1.createSignal)(false), lightbox = _c[0], setLightbox = _c[1];
    var box = imageBox(props.attachment);
    var load = function () {
        var _a;
        var type = (_a = props.attachment.mediaType) !== null && _a !== void 0 ? _a : "";
        if (!type.startsWith("image/") || !props.load) {
            setStatus("idle");
            return;
        }
        setStatus("loading");
        void props
            .load(props.attachment)
            .then(function (value) {
            setSrc(value);
            setStatus("loaded");
        })
            .catch(function () { return setStatus("error"); });
    };
    (0, solid_js_1.onMount)(load);
    var placeholder = function () { return (<button type="button" class="natalia-message-attachment-placeholder" style={{
            width: "".concat(box.width, "px"),
            height: "".concat(box.height, "px"),
        }} title={status() === "error" ? "加载失败，点击重试" : props.attachment.name} onClick={function () {
            if (status() === "error")
                load();
        }}>
      <solid_js_1.Show when={status() === "loading"}>加载中…</solid_js_1.Show>
      <solid_js_1.Show when={status() === "error"}>加载失败 · 重试</solid_js_1.Show>
      <solid_js_1.Show when={status() === "idle"}>
        <svg viewBox="0 0 16 16" fill="none" class="natalia-message-attachment-icon">
          <path d="M8.5 3.5L11.5 6.5L8.5 9.5M4.5 6.5H11.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>{props.attachment.name}</span>
      </solid_js_1.Show>
    </button>); };
    return (<>
      <solid_js_1.Show when={status() === "loaded" && src()} fallback={placeholder()}>
        <button type="button" class="natalia-message-image-button" onClick={function () { return setLightbox(true); }}>
          <img class="natalia-message-image" src={src()} alt={props.attachment.name} width={box.width} height={box.height} loading="lazy"/>
        </button>
      </solid_js_1.Show>
      <solid_js_1.Show when={lightbox()}>
        <div class="natalia-message-lightbox" style={{
            position: "fixed",
            inset: "0",
            "z-index": "80",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            padding: "24px",
            background: "rgba(0,0,0,0.78)",
            cursor: "zoom-out",
        }} onClick={function () { return setLightbox(false); }}>
          <img src={src()} alt={props.attachment.name} style={{
            "max-width": "min(92vw, 1200px)",
            "max-height": "92vh",
            "object-fit": "contain",
        }}/>
        </div>
      </solid_js_1.Show>
    </>);
}
function sessionTurnID(messageID) {
    if (!messageID.startsWith("turn_"))
        return undefined;
    return messageID.replace(/:(?:user|assistant|thinking|system)$/u, "");
}
function ToolCallCard(props) {
    var _a;
    var _b = (0, solid_js_1.createSignal)(false), expanded = _b[0], setExpanded = _b[1];
    var output = function () { var _a; return (_a = props.toolCall.output) !== null && _a !== void 0 ? _a : ""; };
    var outputLines = function () { return output().split("\n"); };
    var collapsible = function () {
        return outputLines().length > TOOL_OUTPUT_COLLAPSE_LINES ||
            output().length > 2000;
    };
    var shownOutput = function () {
        if (!collapsible() || expanded())
            return output();
        return outputLines().slice(0, TOOL_OUTPUT_PREVIEW_LINES).join("\n");
    };
    return (<div class="natalia-tool-card">
      <div class="natalia-tool-header">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="color: var(--accent-primary); flex-shrink: 0;">
          <path d="M7 1L3 5L7 9L11 5L7 1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
        <span class="natalia-tool-name">{props.toolCall.name}</span>
        <solid_js_1.Show when={props.toolCall.summary}>
          <span class="natalia-tool-summary">{props.toolCall.summary}</span>
        </solid_js_1.Show>
        <span class="natalia-badge natalia-badge-default">
          {(_a = props.toolCall.status) !== null && _a !== void 0 ? _a : "tool"}
        </span>
      </div>
      <solid_js_1.Show when={output()}>
        <div class="natalia-tool-output" data-collapsed={collapsible() && !expanded() ? "true" : undefined}>
          <pre>{shownOutput()}</pre>
          <solid_js_1.Show when={collapsible()}>
            <button type="button" class="natalia-tool-output-toggle" onClick={function () { return setExpanded(!expanded()); }}>
              {expanded() ? "收起" : "\u5C55\u5F00\u5168\u90E8\uFF08".concat(outputLines().length, " \u884C\uFF09")}
            </button>
          </solid_js_1.Show>
        </div>
      </solid_js_1.Show>
    </div>);
}
/**
 * Compact row for a `<goal_round>` internal turn: the round number and the
 * objective at a glance, with the full injected prompt behind a disclosure.
 */
function GoalRoundBody(props) {
    var _a = (0, solid_js_1.createSignal)(false), expanded = _a[0], setExpanded = _a[1];
    var capLabel = function () {
        return props.goalRound.maxGoalRounds === 0
            ? "∞"
            : String(props.goalRound.maxGoalRounds);
    };
    return (<div class="natalia-goal-round" data-expanded={expanded() || undefined}>
      <button type="button" class="natalia-goal-round-header" title={props.goalRound.objective} onClick={function () { return setExpanded(!expanded()); }}>
        <span class="natalia-goal-round-badge">Goal</span>
        <span class="natalia-goal-round-title">
          Round {props.goalRound.round}/{capLabel()}
        </span>
        <solid_js_1.Show when={props.goalRound.objective}>
          <span class="natalia-goal-round-objective">
            {props.goalRound.objective}
          </span>
        </solid_js_1.Show>
        <span class="natalia-goal-round-toggle">
          {expanded() ? "收起" : "展开"}
        </span>
      </button>
      <solid_js_1.Show when={expanded()}>
        <pre class="natalia-goal-round-detail">{props.goalRound.detail}</pre>
      </solid_js_1.Show>
    </div>);
}
function MessageRow(props) {
    var _a, _b, _c, _d, _e;
    var isUser = function () { return props.message.role === "user"; };
    var isSystem = function () { return props.message.role === "system"; };
    return (<article class="natalia-message" data-role={props.message.role} data-message-id={props.message.id}>
      <div class="natalia-message-header">
        <div class="natalia-message-avatar" data-role={props.message.role}>
          {isUser()
            ? "U"
            : props.message.goalRound
                ? "G"
                : isSystem()
                    ? "S"
                    : ((_a = props.assistantInitial) !== null && _a !== void 0 ? _a : "N")}
        </div>
        <div class="natalia-message-meta">
          <span class="natalia-message-author">
            {isUser()
            ? "You"
            : props.message.goalRound
                ? "Goal"
                : isSystem()
                    ? "System"
                    : ((_b = props.assistantName) !== null && _b !== void 0 ? _b : "Natalia")}
          </span>
          <span class="natalia-message-time">
            {(_c = props.message.timestamp) !== null && _c !== void 0 ? _c : ""}
          </span>
        </div>
        <solid_js_1.Show when={props.message.steering}>
          <span class="natalia-badge natalia-badge-steering" title="运行中注入当前轮">
            已注入
          </span>
        </solid_js_1.Show>
        <solid_js_1.Show when={props.message.status}>
          <span class="natalia-badge" classList={{
            "natalia-badge-running": props.message.status === "running",
            "natalia-badge-success": props.message.status === "completed" ||
                props.message.status === "done",
            "natalia-badge-error": props.message.status === "error" ||
                props.message.status === "failed",
        }}>
            {props.message.status}
          </span>
        </solid_js_1.Show>
      </div>

      <div class="natalia-message-body">
        <solid_js_1.Show when={props.message.goalRound} fallback={<solid_js_1.Show when={props.message.thinking} fallback={<solid_js_1.Show when={props.message.content || !((_d = props.message.toolCalls) === null || _d === void 0 ? void 0 : _d.length)}>
                  <solid_js_1.Show when={props.message.streaming} fallback={<div class="natalia-message-text" innerHTML={formatContent(props.message.content)}/>}>
                    <div class="natalia-message-text" innerHTML={formatContent(props.message.content)}/>
                    <div class="natalia-streaming-indicator">
                      <div class="natalia-streaming-dot"/>
                      <div class="natalia-streaming-dot"/>
                      <div class="natalia-streaming-dot"/>
                      <span class="natalia-streaming-label">正在思考...</span>
                    </div>
                  </solid_js_1.Show>
                </solid_js_1.Show>}>
              <div class="natalia-thinking-block">
                <span class="natalia-thinking-label">Thinking</span>
                <div class="natalia-thinking-text" innerHTML={formatContent(props.message.content)}/>
              </div>
            </solid_js_1.Show>}>
          {function (goalRound) { return <GoalRoundBody goalRound={goalRound()}/>; }}
        </solid_js_1.Show>
      </div>

      <solid_js_1.Show when={props.message.attachments && props.message.attachments.length > 0}>
        <div class="natalia-message-attachments">
          <solid_js_1.For each={(_e = props.message.attachments) !== null && _e !== void 0 ? _e : []}>
            {function (attachment) { return (<AttachmentImage attachment={attachment} load={props.loadAttachmentUrl}/>); }}
          </solid_js_1.For>
        </div>
      </solid_js_1.Show>

      <solid_js_1.Show when={props.message.toolCalls && props.message.toolCalls.length > 0}>
        <div class="natalia-tool-calls">
          <solid_js_1.For each={props.message.toolCalls}>
            {function (toolCall) { return <ToolCallCard toolCall={toolCall}/>; }}
          </solid_js_1.For>
        </div>
      </solid_js_1.Show>

      <solid_js_1.Show when={props.message.actions && props.message.actions.length > 0}>
        <div class="natalia-message-actions">
          <solid_js_1.For each={props.message.actions}>
            {function (action) { return (<button type="button" class="natalia-action-btn" classList={{
                "natalia-action-btn-primary": action.primary,
                "natalia-action-btn-secondary": !action.primary,
            }} onClick={function () { return action.onClick(); }}>
                {action.label}
              </button>); }}
          </solid_js_1.For>
        </div>
      </solid_js_1.Show>
    </article>);
}
var markdownCache = new Map();
var MARKDOWN_CACHE_LIMIT = 512;
function formatContent(text) {
    var cached = markdownCache.get(text);
    if (cached !== undefined)
        return cached;
    var html = marked_1.marked.parse(text, {
        gfm: true,
        breaks: true,
    });
    if (markdownCache.size >= MARKDOWN_CACHE_LIMIT) {
        var oldest = markdownCache.keys().next().value;
        if (oldest !== undefined)
            markdownCache.delete(oldest);
    }
    markdownCache.set(text, html);
    return html;
}
function formatBashBlocks(text) {
    var blocks = [];
    var regex = /Bash\s*\n```[\w]*\n([\s\S]*?)\n```/g;
    var match;
    while ((match = regex.exec(text)) !== null) {
        blocks.push({ type: "bash", content: match[1].trim() });
    }
    var resultRegex = /结果:\s*\n```[\w]*\n([\s\S]*?)\n```/;
    var resultMatch = resultRegex.exec(text);
    if (resultMatch) {
        blocks.push({ type: "result", content: resultMatch[1].trim() });
    }
    return blocks;
}
