"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePluginConfig = resolvePluginConfig;
function formatConfigIssue(issue) {
    var _a;
    var path = ((_a = issue.path) !== null && _a !== void 0 ? _a : [])
        .map(function (segment) {
        return typeof segment === "object" && segment !== null && "key" in segment
            ? String(segment.key)
            : String(segment);
    })
        .join(".");
    return path ? "  - ".concat(issue.message, " (at ").concat(path, ")") : "  - ".concat(issue.message);
}
function resolvePluginConfig(plugin, config) {
    var _a;
    var schema = plugin.configSchema;
    if (!schema)
        return config;
    var result = schema["~standard"].validate(config);
    if (result !== null && typeof result === "object" && "then" in result)
        throw new Error("plugin config validation must be synchronous: ".concat(plugin.manifest.id));
    var settled = result;
    if ((_a = settled.issues) === null || _a === void 0 ? void 0 : _a.length)
        throw new Error("plugin config invalid: ".concat(plugin.manifest.id, "\n").concat(settled.issues
            .map(formatConfigIssue)
            .join("\n")));
    return settled.value;
}
