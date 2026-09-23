"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertConfigApplied = assertConfigApplied;
/** Refuse configuration files the loader rejected instead of using fallbacks. */
function assertConfigApplied(resolved) {
    var rejected = resolved.sources.filter(function (source) { var _a; return !source.applied && ((_a = source.diagnostic) === null || _a === void 0 ? void 0 : _a.startsWith("invalid_config")); });
    if (rejected.length)
        throw new Error("configuration was rejected and is not in effect: ".concat(rejected
            .map(function (source) { var _a; return "".concat((_a = source.path) !== null && _a !== void 0 ? _a : source.scope, " (").concat(source.diagnostic, ")"); })
            .join(", ")));
    return resolved.config;
}
