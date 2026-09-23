"use strict";
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
exports.defaultConfigV3 = defaultConfigV3;
exports.migrateConfig = migrateConfig;
exports.migrationSummaryText = migrationSummaryText;
var contracts_1 = require("@natalia/contracts");
function defaultConfigV3() {
    return contracts_1.configV3Schema.parse({ version: 3 });
}
function migrateConfig(input) {
    var parsed = contracts_1.configV3Schema.safeParse(input);
    if (parsed.success) {
        return {
            config: parsed.data,
            summary: {
                fromVersion: 3,
                toVersion: 3,
                changed: [],
                warnings: [],
            },
        };
    }
    throw new Error("only Config v3 JSON configuration is supported");
}
function migrationSummaryText(summary) {
    var lines = __spreadArray(__spreadArray(__spreadArray([
        "config migration: ".concat(summary.fromVersion, " -> v").concat(summary.toVersion)
    ], summary.changed.map(function (item) { return "changed: ".concat(item); }), true), summary.warnings.map(function (item) { return "warning: ".concat(item); }), true), [
        summary.backupPath ? "backup: ".concat(summary.backupPath) : undefined,
    ], false).filter(Boolean);
    return lines.join("\n");
}
