"use strict";
/**
 * Small pure helpers for transcript virtual-window diagnostics.
 *
 * TanStack Virtual normally returns one entry per logical row, but hydration /
 * measurement / key transitions can leave the same index in the window twice.
 * The transcript row id is the render key, so a duplicated index duplicates the
 * whole message group; dedupe at this boundary.
 */
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
exports.dedupeVirtualItems = dedupeVirtualItems;
exports.duplicateValues = duplicateValues;
exports.duplicateVirtualIndexes = duplicateVirtualIndexes;
function dedupeVirtualItems(items) {
    if (items.length < 2)
        return __spreadArray([], items, true);
    var seen = new Set();
    var out = [];
    for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
        var item = items_1[_i];
        if (item === undefined || seen.has(item.index))
            continue;
        seen.add(item.index);
        out.push(item);
    }
    return out;
}
/** Return each value that occurs more than once, in first-seen order. */
function duplicateValues(values) {
    var _a, _b;
    var counts = new Map();
    for (var _i = 0, values_1 = values; _i < values_1.length; _i++) {
        var value = values_1[_i];
        counts.set(value, ((_a = counts.get(value)) !== null && _a !== void 0 ? _a : 0) + 1);
    }
    var seen = new Set();
    var out = [];
    for (var _c = 0, values_2 = values; _c < values_2.length; _c++) {
        var value = values_2[_c];
        if (((_b = counts.get(value)) !== null && _b !== void 0 ? _b : 0) < 2 || seen.has(value))
            continue;
        seen.add(value);
        out.push(value);
    }
    return out;
}
function duplicateVirtualIndexes(items) {
    return duplicateValues(items.map(function (item) { return item.index; }));
}
