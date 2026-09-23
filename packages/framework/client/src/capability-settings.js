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
exports.mergeContributedToolSettings = mergeContributedToolSettings;
/**
 * The host consumer for the `settings` capability grant.
 *
 * A capability holding the grant contributes settings through the kernel; the
 * runtime merges the effective contributions into the tool settings it hands to
 * every tool. The merge is deliberately one-directional: contributions provide
 * defaults, and an explicitly configured or permission-derived value always
 * wins. A contribution can therefore fill an unset browser or endpoint option,
 * but it can never widen network or security settings the operator configured.
 */
function mergeContributedToolSettings(base, contributions) {
    var defaults = {};
    for (var _i = 0, contributions_1 = contributions; _i < contributions_1.length; _i++) {
        var entry = contributions_1[_i];
        if (!entry.payload || typeof entry.payload !== "object")
            continue;
        Object.assign(defaults, entry.payload);
    }
    // `undefined` means "not configured": a contributed default must be allowed
    // through in that case, so undefined base values are dropped before the base
    // spreads over the defaults.
    var defined = Object.fromEntries(Object.entries(base).filter(function (_a) {
        var value = _a[1];
        return value !== undefined;
    }));
    return __assign(__assign({}, defaults), defined);
}
