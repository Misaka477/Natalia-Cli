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
exports.snapshotProjectionContributions = snapshotProjectionContributions;
var placements = new Set(["tool-card", "sidebar"]);
function snapshotProjectionContributions(registry) {
    if (!registry)
        return [];
    var seen = new Set();
    var contributions = [];
    for (var _i = 0, _a = registry.contributions("projections"); _i < _a.length; _i++) {
        var entry = _a[_i];
        var payload = entry.payload;
        var name_1 = typeof (payload === null || payload === void 0 ? void 0 : payload.name) === "string" && payload.name.trim()
            ? payload.name.trim()
            : entry.name;
        var title = typeof (payload === null || payload === void 0 ? void 0 : payload.title) === "string" ? payload.title.trim() : "";
        if (!name_1 || !title || seen.has(name_1))
            continue;
        var placement = typeof (payload === null || payload === void 0 ? void 0 : payload.placement) === "string" &&
            placements.has(payload.placement)
            ? payload.placement
            : "sidebar";
        var text = typeof (payload === null || payload === void 0 ? void 0 : payload.text) === "string"
            ? payload.text.slice(0, 500)
            : undefined;
        seen.add(name_1);
        contributions.push(__assign({ name: name_1, title: title, placement: placement }, (text ? { text: text } : {})));
    }
    return contributions;
}
