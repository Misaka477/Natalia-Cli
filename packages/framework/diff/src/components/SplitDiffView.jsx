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
exports.buildSplitRows = buildSplitRows;
exports.SplitDiffView = SplitDiffView;
var solid_js_1 = require("solid-js");
var syntax_1 = require("./syntax");
var syntax_client_1 = require("./syntax-client");
var ROW_HEIGHT = 22;
var OVERSCAN = 12;
function renderSegments(text, highlights, syntax, language) {
    if (!(highlights === null || highlights === void 0 ? void 0 : highlights.length))
        return (syntax !== null && syntax !== void 0 ? syntax : (0, syntax_1.highlightLine)(text, language)).map(function (part) { return (__assign(__assign({}, part), { highlight: false })); });
    var parts = [];
    var cursor = 0;
    var sorted = __spreadArray([], highlights, true).sort(function (a, b) { return a.start - b.start; });
    for (var _i = 0, sorted_1 = sorted; _i < sorted_1.length; _i++) {
        var range = sorted_1[_i];
        if (range.start > cursor)
            parts.push({
                text: text.slice(cursor, range.start),
                highlight: false,
                cls: "",
            });
        if (range.end > range.start)
            parts.push({
                text: text.slice(range.start, range.end),
                highlight: true,
                cls: "",
            });
        cursor = Math.max(cursor, range.end);
    }
    if (cursor < text.length)
        parts.push({ text: text.slice(cursor), highlight: false, cls: "" });
    if (!parts.length)
        parts.push({ text: "", highlight: false, cls: "" });
    return parts;
}
function buildSplitRows(result) {
    var _a, _b, _c, _d, _e, _f;
    if (!result || !Array.isArray(result.hunks))
        return [];
    try {
        var rows = [];
        for (var _i = 0, _g = result.hunks; _i < _g.length; _i++) {
            var hunk = _g[_i];
            if (!hunk || !Array.isArray(hunk.lines))
                continue;
            var lines = hunk.lines;
            var i = 0;
            while (i < lines.length) {
                var line = lines[i];
                if (line.type === "context") {
                    var end = i;
                    while (end < lines.length && lines[end].type === "context")
                        end++;
                    var count_1 = end - i;
                    if (count_1 > 6) {
                        // Keep split mode light for patches with large unchanged regions,
                        // matching the unified view's context collapsing behavior.
                        var summary = "\u00B7\u00B7\u00B7 ".concat(count_1, " unchanged lines \u00B7\u00B7\u00B7");
                        rows.push({
                            type: "context",
                            oldText: summary,
                            newText: summary,
                            oldNo: "",
                            newNo: "",
                        });
                        i = end;
                        continue;
                    }
                    for (; i < end; i++) {
                        var current = lines[i];
                        var wordRanges = Array.isArray(current.wordRanges)
                            ? current.wordRanges
                            : undefined;
                        var syntaxParts = Array.isArray(current.syntaxParts)
                            ? current.syntaxParts
                            : undefined;
                        rows.push({
                            type: "context",
                            oldText: current.text,
                            newText: current.text,
                            oldNo: (_a = current.oldLineNumber) !== null && _a !== void 0 ? _a : "",
                            newNo: (_b = current.newLineNumber) !== null && _b !== void 0 ? _b : "",
                            oldHighlights: wordRanges === null || wordRanges === void 0 ? void 0 : wordRanges.map(function (r) { return ({
                                start: r.start,
                                end: r.end,
                            }); }),
                            newHighlights: wordRanges === null || wordRanges === void 0 ? void 0 : wordRanges.map(function (r) { return ({
                                start: r.start,
                                end: r.end,
                            }); }),
                            oldSyntax: syntaxParts,
                            newSyntax: syntaxParts,
                        });
                    }
                    continue;
                }
                if (line.type !== "delete" && line.type !== "add") {
                    i++;
                    continue;
                }
                var deletes = [];
                var adds = [];
                while (i < lines.length && lines[i].type === "delete") {
                    deletes.push(lines[i]);
                    i++;
                }
                while (i < lines.length && lines[i].type === "add") {
                    adds.push(lines[i]);
                    i++;
                }
                var count = Math.max(deletes.length, adds.length);
                for (var k = 0; k < count; k++) {
                    var del = deletes[k];
                    var add = adds[k];
                    rows.push({
                        type: del && add ? "modify" : del ? "delete" : "add",
                        oldText: (_c = del === null || del === void 0 ? void 0 : del.text) !== null && _c !== void 0 ? _c : "",
                        newText: (_d = add === null || add === void 0 ? void 0 : add.text) !== null && _d !== void 0 ? _d : "",
                        oldNo: (_e = del === null || del === void 0 ? void 0 : del.oldLineNumber) !== null && _e !== void 0 ? _e : "",
                        newNo: (_f = add === null || add === void 0 ? void 0 : add.newLineNumber) !== null && _f !== void 0 ? _f : "",
                        oldHighlights: Array.isArray(del === null || del === void 0 ? void 0 : del.wordRanges)
                            ? del.wordRanges.map(function (r) { return ({ start: r.start, end: r.end }); })
                            : undefined,
                        newHighlights: Array.isArray(add === null || add === void 0 ? void 0 : add.wordRanges)
                            ? add.wordRanges.map(function (r) { return ({ start: r.start, end: r.end }); })
                            : undefined,
                        oldSyntax: Array.isArray(del === null || del === void 0 ? void 0 : del.syntaxParts)
                            ? del.syntaxParts
                            : undefined,
                        newSyntax: Array.isArray(add === null || add === void 0 ? void 0 : add.syntaxParts)
                            ? add.syntaxParts
                            : undefined,
                    });
                }
            }
        }
        return rows;
    }
    catch (_h) {
        return [];
    }
}
function SplitDiffView(props) {
    var container;
    var _a = (0, solid_js_1.createSignal)(0), scrollTop = _a[0], setScrollTop = _a[1];
    var _b = (0, solid_js_1.createSignal)(0), viewportHeight = _b[0], setViewportHeight = _b[1];
    var _c = (0, solid_js_1.createSignal)(new Map()), syntaxCache = _c[0], setSyntaxCache = _c[1];
    var rowKey = function (row) { var _a, _b; return "".concat((_a = row.oldNo) !== null && _a !== void 0 ? _a : "", ":").concat((_b = row.newNo) !== null && _b !== void 0 ? _b : "", ":").concat(row.oldText, ":").concat(row.newText); };
    (0, solid_js_1.createEffect)(function () {
        var rows = visible();
        var cache = syntaxCache();
        var missing = rows
            .filter(function (row) { return !row.oldSyntax && !row.newSyntax; })
            .map(function (row) { return ({ row: row, key: rowKey(row) }); })
            .filter(function (_a) {
            var row = _a.row, key = _a.key;
            return !cache.has(key) && row.oldText.length > 0;
        });
        if (!missing.length)
            return;
        void Promise.all(missing.map(function (_a) {
            var row = _a.row, key = _a.key;
            return Promise.all([
                (0, syntax_client_1.highlightInWorker)(row.oldText, props.language),
                row.newText === row.oldText
                    ? Promise.resolve(undefined)
                    : (0, syntax_client_1.highlightInWorker)(row.newText, props.language),
            ]).then(function (_a) {
                var oldSyntax = _a[0], newSyntax = _a[1];
                setSyntaxCache(function (prev) {
                    var next = new Map(prev);
                    next.set(key, {
                        oldSyntax: oldSyntax,
                        newSyntax: newSyntax !== null && newSyntax !== void 0 ? newSyntax : oldSyntax,
                    });
                    return next;
                });
            });
        }));
    });
    var total = function () { return props.rows.length; };
    var start = function () {
        return Math.max(0, Math.floor(scrollTop() / ROW_HEIGHT) - OVERSCAN);
    };
    var end = function () {
        return Math.min(total(), Math.ceil((scrollTop() + viewportHeight()) / ROW_HEIGHT) + OVERSCAN);
    };
    var visible = (0, solid_js_1.createMemo)(function () { return props.rows.slice(start(), end()); });
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
    return (<div ref={container} class="review-diff-content diff-virtual diff-split" onScroll={function (event) { return setScrollTop(event.currentTarget.scrollTop); }}>
      <div style={{ height: "".concat(start() * ROW_HEIGHT, "px") }}/>
      <solid_js_1.For each={visible()}>
        {function (row) {
            var _a, _b, _c, _d;
            return (<div class={"review-diff-split-row ".concat(row.type)} style={{ height: "".concat(ROW_HEIGHT, "px") }}>
            <span class="review-diff-pos">{row.oldNo}</span>
            <span class="review-diff-split-cell">
              <solid_js_1.For each={renderSegments(row.oldText, row.oldHighlights, (_a = row.oldSyntax) !== null && _a !== void 0 ? _a : (_b = syntaxCache().get(rowKey(row))) === null || _b === void 0 ? void 0 : _b.oldSyntax, props.language)}>
                {function (part) {
                    return part.highlight ? (<span class="diff-word-deleted">{part.text}</span>) : (<>{part.text}</>);
                }}
              </solid_js_1.For>
            </span>
            <span class="review-diff-pos">{row.newNo}</span>
            <span class="review-diff-split-cell">
              <solid_js_1.For each={renderSegments(row.newText, row.newHighlights, (_c = row.newSyntax) !== null && _c !== void 0 ? _c : (_d = syntaxCache().get(rowKey(row))) === null || _d === void 0 ? void 0 : _d.newSyntax, props.language)}>
                {function (part) {
                    return part.highlight ? (<span class="diff-word-added">{part.text}</span>) : (<>{part.text}</>);
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
