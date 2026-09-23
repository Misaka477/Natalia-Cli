"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.riskTierForPath = riskTierForPath;
exports.riskTierForChanges = riskTierForChanges;
exports.requiresApproval = requiresApproval;
var HIGH_RISK = [
    /packages\/core\/tools\/src\/types\.ts$/u,
    /packages\/core\/capability\/src\//u,
    /packages\/core\/plugin\/src\//u,
];
/** The risk tier of one changed path. */
function riskTierForPath(path) {
    if (HIGH_RISK.some(function (pattern) { return pattern.test(path); }))
        return "high";
    if (/\.(ts|tsx|js|mjs|cjs)$/u.test(path))
        return "medium";
    return "low";
}
/** The risk tier of a candidate's full change set: the highest change wins. */
function riskTierForChanges(changes) {
    var tier = "low";
    for (var _i = 0, changes_1 = changes; _i < changes_1.length; _i++) {
        var change = changes_1[_i];
        var changeTier = riskTierForPath(change.path);
        if (changeTier === "high")
            return "high";
        if (changeTier === "medium")
            tier = "medium";
    }
    return tier;
}
/**
 * Whether a candidate's tier clears the approval gate: a promotion that
 * requires `"high"` approval must not proceed on a `"medium"` candidate's own
 * say-so. Equal or higher tiers pass; a higher-risk candidate always needs the
 * stricter gate.
 */
function requiresApproval(tier, required) {
    var order = { low: 0, medium: 1, high: 2 };
    return order[tier] >= order[required];
}
