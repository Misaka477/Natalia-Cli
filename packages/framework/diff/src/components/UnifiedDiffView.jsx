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
exports.UnifiedDiffView = UnifiedDiffView;
var solid_js_1 = require("solid-js");
var syntax_1 = require("./syntax");
var syntax_client_1 = require("./syntax-client");
function highlightedText(line, language, precomputed) {
    var _a, _b, _c;
    var parts = [];
    if (!((_a = line.highlights) === null || _a === void 0 ? void 0 : _a.length)) {
        for (var _i = 0, _d = (_c = (_b = line.syntax) !== null && _b !== void 0 ? _b : precomputed) !== null && _c !== void 0 ? _c : (0, syntax_1.highlightLine)(line.text, language); _i < _d.length; _i++) {
            var part = _d[_i];
            parts.push(__assign(__assign({}, part), { highlight: false, kind: "" }));
        }
        return parts;
    }
    var cursor = 0;
    var sorted = __spreadArray([], line.highlights, true).sort(function (a, b) { return a.start - b.start; });
    for (var _e = 0, sorted_1 = sorted; _e < sorted_1.length; _e++) {
        var range = sorted_1[_e];
        if (range.start > cursor)
            parts.push({
                text: line.text.slice(cursor, range.start),
                highlight: false,
                kind: "",
                cls: "",
            });
        if (range.end > range.start)
            parts.push({
                text: line.text.slice(range.start, range.end),
                highlight: true,
                kind: range.kind,
                cls: "",
            });
        cursor = Math.max(cursor, range.end);
    }
    if (cursor < line.text.length)
        parts.push({
            text: line.text.slice(cursor),
            highlight: false,
            kind: "",
            cls: "",
        });
    return parts;
}
var ROW_HEIGHT = 22;
var OVERSCAN = 12;
function isContext(row) {
    return row.type === "" && row.sign === " ";
}
/**
 * A lightweight virtualized unified-diff renderer.
 *
 * It only mounts the rows that intersect the current viewport, so a large
 * structured diff (or a fallback patch diff) can scroll without creating tens
 * of thousands of DOM nodes.
 */
function UnifiedDiffView(props) {
    var container;
    var _a = (0, solid_js_1.createSignal)(0), scrollTop = _a[0], setScrollTop = _a[1];
    var _b = (0, solid_js_1.createSignal)(0), viewportHeight = _b[0], setViewportHeight = _b[1];
    var _c = (0, solid_js_1.createSignal)(new Set()), collapsedHunks = _c[0], setCollapsedHunks = _c[1];
    var _d = (0, solid_js_1.createSignal)(new Map()), syntaxCache = _d[0], setSyntaxCache = _d[1];
    var rowKey = function (row) { var _a, _b; return "".concat((_a = row.oldNo) !== null && _a !== void 0 ? _a : "", ":").concat((_b = row.newNo) !== null && _b !== void 0 ? _b : "", ":").concat(row.text); };
    (0, solid_js_1.createEffect)(function () {
        var rows = visible();
        var cache = syntaxCache();
        var missing = rows
            .map(function (item) { return ({ item: item, key: rowKey(item.row) }); })
            .filter(function (_a) {
            var item = _a.item, key = _a.key;
            return !item.row.syntax && !cache.has(key) && item.row.text.length > 0;
        });
        if (!missing.length)
            return;
        void Promise.all(missing.map(function (_a) {
            var item = _a.item, key = _a.key;
            return (0, syntax_client_1.highlightInWorker)(item.row.text, props.language)
                .then(function (parts) {
                setSyntaxCache(function (prev) {
                    var next = new Map(prev);
                    next.set(key, parts);
                    return next;
                });
            })
                .catch(function () { return undefined; });
        }));
    });
    var displayRows = (0, solid_js_1.createMemo)(function () {
        var rendered = [];
        var hunkIndex = -1;
        for (var _i = 0, _a = props.rows; _i < _a.length; _i++) {
            var row = _a[_i];
            if (row.type === "is-header" && row.text.startsWith("@@")) {
                hunkIndex++;
                rendered.push({ row: row, hunkIndex: hunkIndex });
                continue;
            }
            if (hunkIndex >= 0 && collapsedHunks().has(hunkIndex))
                continue;
            rendered.push({ row: row, hunkIndex: hunkIndex });
        }
        // Collapse long unchanged context runs, preserving hunkIndex metadata.
        var result = [];
        var i = 0;
        while (i < rendered.length) {
            var item = rendered[i];
            if (item.row.type === "" && item.row.sign === " ") {
                var j = i;
                while (j < rendered.length &&
                    rendered[j].row.type === "" &&
                    rendered[j].row.sign === " ")
                    j++;
                var count = j - i;
                if (count > 6) {
                    result.push({
                        row: {
                            type: "is-header",
                            sign: "",
                            text: "\u00B7\u00B7\u00B7 ".concat(count, " unchanged lines \u00B7\u00B7\u00B7"),
                            oldNo: "",
                            newNo: "",
                        },
                        hunkIndex: item.hunkIndex,
                    });
                    i = j;
                    continue;
                }
            }
            result.push(item);
            i++;
        }
        return result;
    });
    var total = function () { return displayRows().length; };
    var start = function () {
        return Math.max(0, Math.floor(scrollTop() / ROW_HEIGHT) - OVERSCAN);
    };
    var end = function () {
        return Math.min(total(), Math.ceil((scrollTop() + viewportHeight()) / ROW_HEIGHT) + OVERSCAN);
    };
    var visible = (0, solid_js_1.createMemo)(function () { return displayRows().slice(start(), end()); });
    var hunkPositions = (0, solid_js_1.createMemo)(function () {
        return displayRows()
            .map(function (item, index) {
            return item.row.type === "is-header" && item.row.text.startsWith("@@")
                ? index
                : -1;
        })
            .filter(function (index) { return index >= 0; });
    });
    var currentHunk = (0, solid_js_1.createMemo)(function () {
        var positions = hunkPositions();
        if (!positions.length)
            return -1;
        var viewportMid = scrollTop() + ROW_HEIGHT / 2;
        var current = 0;
        for (var _i = 0, positions_1 = positions; _i < positions_1.length; _i++) {
            var position = positions_1[_i];
            if (position * ROW_HEIGHT <= viewportMid)
                current = position;
            else
                break;
        }
        return current;
    });
    function jumpTo(index) {
        if (index < 0 || index >= total())
            return;
        setScrollTop(index * ROW_HEIGHT);
        container === null || container === void 0 ? void 0 : container.scrollTo({ top: index * ROW_HEIGHT, behavior: "smooth" });
    }
    function jumpPrevious() {
        var positions = hunkPositions();
        var current = currentHunk();
        var prev = __spreadArray([], positions, true).reverse().find(function (pos) { return pos < current; });
        if (prev !== undefined)
            jumpTo(prev);
    }
    function jumpNext() {
        var positions = hunkPositions();
        var current = currentHunk();
        var next = positions.find(function (pos) { return pos > current; });
        if (next !== undefined)
            jumpTo(next);
    }
    function measureViewport() {
        if (!container)
            return;
        var max = typeof window === "undefined" ? 800 : window.innerHeight;
        // Never trust a flex-grown content-height as the viewport: if the scroll
        // container expands to its content, this would make the virtual list mount
        // every row. Clamp to the real window height.
        setViewportHeight(Math.min(container.clientHeight || 0, max || 800));
    }
    (0, solid_js_1.onMount)(function () {
        measureViewport();
        var observer = new ResizeObserver(measureViewport);
        if (container)
            observer.observe(container);
        (0, solid_js_1.onCleanup)(function () { return observer.disconnect(); });
    });
    return (<div ref={container} class="review-diff-content diff-virtual" onScroll={function (event) { return setScrollTop(event.currentTarget.scrollTop); }}>
      <div class="diff-hunk-nav">
        <button type="button" class="review-icon-btn" title="上一 hunk" onClick={jumpPrevious}>
          ↑
        </button>
        <button type="button" class="review-icon-btn" title="下一 hunk" onClick={jumpNext}>
          ↓
        </button>
      </div>
      <div style={{ height: "".concat(start() * ROW_HEIGHT, "px") }}/>
      <solid_js_1.For each={visible()}>
        {function (_a) {
            var row = _a.row, hunkIndex = _a.hunkIndex;
            var isHunk = row.type === "is-header" && row.text.startsWith("@@");
            return (<div class={"review-diff-line ".concat(row.type)} style={{ height: "".concat(ROW_HEIGHT, "px") }} onClick={function () {
                    if (isHunk && hunkIndex >= 0) {
                        setCollapsedHunks(function (prev) {
                            var next = new Set(prev);
                            if (next.has(hunkIndex))
                                next.delete(hunkIndex);
                            else
                                next.add(hunkIndex);
                            return next;
                        });
                    }
                }}>
              <span class="review-diff-pos">{row.oldNo}</span>
              <span class="review-diff-pos">{row.newNo}</span>
              <span class="review-diff-sign">
                {isHunk && collapsedHunks().has(hunkIndex) ? "+" : row.sign}
              </span>
              <span class="review-diff-text">
                <solid_js_1.For each={highlightedText(row, props.language, syntaxCache().get(rowKey(row)))}>
                  {function (part) {
                    return part.highlight ? (<span class={part.kind === "added"
                            ? "diff-word-added"
                            : "diff-word-deleted"}>
                        {part.text}
                      </span>) : (<span class={part.cls}>{part.text}</span>);
                }}
                </solid_js_1.For>
              </span>
            </div>);
        }}
      </solid_js_1.For>
      <div style={{ height: "".concat((total() - end()) * ROW_HEIGHT, "px") }}/>
      <solid_js_1.Show when={!total()}>
        <div class="review-empty">
          <div class="review-empty-title">暂无内容级 diff</div>
        </div>
      </solid_js_1.Show>
    </div>);
}
