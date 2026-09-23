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
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeTranscriptCursor = encodeTranscriptCursor;
exports.decodeTranscriptCursor = decodeTranscriptCursor;
exports.paginateTranscript = paginateTranscript;
function encodeTranscriptCursor(prefix, direction, index) {
    return "".concat(prefix, "-").concat(direction, ":").concat(index);
}
function decodeTranscriptCursor(prefix, cursor) {
    if (!cursor)
        return undefined;
    var match = new RegExp("^".concat(prefix, "-(older|newer):(\\d+)$"), "u").exec(cursor);
    if (!match)
        return undefined;
    var index = Number(match[2]);
    if (!Number.isSafeInteger(index) || index < 0)
        return undefined;
    return {
        direction: match[1],
        index: index,
    };
}
/** Slice one page from an already ordered (oldest-first) item list. */
function paginateTranscript(items, cursor, limitInput, prefix) {
    var limit = Math.min(500, Math.max(1, limitInput !== null && limitInput !== void 0 ? limitInput : 100));
    var decoded = decodeTranscriptCursor(prefix, cursor);
    var start;
    var end;
    if (!decoded) {
        end = items.length;
        start = Math.max(0, end - limit);
    }
    else if (decoded.direction === "older") {
        end = Math.min(items.length, decoded.index);
        start = Math.max(0, end - limit);
    }
    else {
        start = Math.min(items.length, decoded.index);
        end = Math.min(items.length, start + limit);
    }
    return {
        data: items.slice(start, end),
        cursor: __assign(__assign({}, (start > 0
            ? { previous: encodeTranscriptCursor(prefix, "older", start) }
            : {})), (end < items.length
            ? { next: encodeTranscriptCursor(prefix, "newer", end) }
            : {})),
    };
}
