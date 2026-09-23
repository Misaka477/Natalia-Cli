"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitMarkdownAtSafeBoundary = splitMarkdownAtSafeBoundary;
exports.flushMarkdown = flushMarkdown;
exports.appendWithRetrySkip = appendWithRetrySkip;
function splitMarkdownAtSafeBoundary(input) {
    var boundary = safeBoundaryIndex(input);
    if (boundary <= 0)
        return { committed: "", tail: input };
    return {
        committed: input.slice(0, boundary),
        tail: input.slice(boundary),
    };
}
function flushMarkdown(input) {
    return { committed: input, tail: "" };
}
function appendWithRetrySkip(chunk, retrySkip) {
    if (!retrySkip)
        return { text: chunk, retrySkip: retrySkip };
    if (retrySkip.startsWith(chunk)) {
        return { text: "", retrySkip: retrySkip.slice(chunk.length) };
    }
    if (chunk.startsWith(retrySkip)) {
        return { text: chunk.slice(retrySkip.length), retrySkip: "" };
    }
    var overlap = longestOverlap(retrySkip, chunk);
    if (overlap > 0)
        return { text: chunk.slice(overlap), retrySkip: "" };
    return { text: chunk, retrySkip: "" };
}
function safeBoundaryIndex(input) {
    var _a;
    var lines = input.split(/(?<=\n)/u);
    var offset = 0;
    var boundary = 0;
    var fence;
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        var marker = (_a = line.match(/^\s*(```+|~~~+)/u)) === null || _a === void 0 ? void 0 : _a[1];
        if (marker) {
            if (!fence) {
                fence = marker.slice(0, 3);
            }
            else if (marker.startsWith(fence)) {
                fence = undefined;
                offset += line.length;
                boundary = offset;
                continue;
            }
        }
        offset += line.length;
        if (fence)
            continue;
        if (line.trim() === "")
            boundary = offset;
        if (isCompleteListLine(line))
            boundary = offset;
        if (isHeadingBoundary(line))
            boundary = offset;
    }
    return boundary;
}
function isCompleteListLine(line) {
    if (!line.endsWith("\n"))
        return false;
    return /^\s*(?:[-*+] |\d+[.)] |[-*+] \[[ xX]\] ).+\n$/u.test(line);
}
function isHeadingBoundary(line) {
    if (!line.endsWith("\n"))
        return false;
    return /^#{1,6}\s+\S.+\n$/u.test(line);
}
function longestOverlap(left, right) {
    var max = Math.min(left.length, right.length);
    for (var size = max; size > 0; size--) {
        if (left.endsWith(right.slice(0, size)))
            return size;
    }
    return 0;
}
