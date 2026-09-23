"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatStatusCounts = formatStatusCounts;
exports.truncate = truncate;
function formatStatusCounts(records) {
    var _a;
    var counts = {};
    for (var _i = 0, records_1 = records; _i < records_1.length; _i++) {
        var rec = records_1[_i];
        counts[rec.status] = ((_a = counts[rec.status]) !== null && _a !== void 0 ? _a : 0) + 1;
    }
    var total = records.length;
    return "remaining_resources: resource_type=subagent total=".concat(total).concat(formatCount("running", counts)).concat(formatCount("completed", counts)).concat(formatCount("stopped", counts)).concat(formatCount("failed", counts)).concat(formatCount("paused", counts)).concat(formatCount("idle", counts));
}
function formatCount(status, counts) {
    var _a;
    var v = (_a = counts[status]) !== null && _a !== void 0 ? _a : 0;
    return v > 0 || status === "running" ? " ".concat(status, "=").concat(v) : "";
}
function truncate(s, n) {
    if (s.length <= n)
        return s;
    return s.slice(0, n - 1) + "…";
}
