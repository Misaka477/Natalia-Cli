"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePolicy = evaluatePolicy;
exports.modelSelectionStatus = modelSelectionStatus;
exports.evaluateModelPolicy = evaluateModelPolicy;
var contracts_1 = require("@natalia/contracts");
function evaluatePolicy(statements, action, resource, fallback) {
    for (var index = statements.length - 1; index >= 0; index--) {
        var statement = statements[index];
        if (matches(action, statement.action) &&
            matches(resource, statement.resource)) {
            return statement.effect;
        }
    }
    return fallback;
}
function modelSelectionStatus(config, ref) {
    var _a, _b, _c, _d, _e;
    var modelRef = typeof ref === "string" ? (0, contracts_1.parseModelRef)(ref) : ref;
    var key = (0, contracts_1.modelRefKey)(modelRef);
    var provider = config.providers[modelRef.provider];
    if (!provider)
        return {
            ref: modelRef,
            key: key,
            configured: false,
            usable: false,
            policyAllowed: false,
            selected: false,
            reason: "provider_not_configured",
        };
    var catalogModel = (_d = (_c = (_b = (_a = config.catalog) === null || _a === void 0 ? void 0 : _a.providers) === null || _b === void 0 ? void 0 : _b[modelRef.provider]) === null || _c === void 0 ? void 0 : _c.models) === null || _d === void 0 ? void 0 : _d[modelRef.model];
    var override = config.modelOverrides[key];
    if (!catalogModel && !override)
        return {
            ref: modelRef,
            key: key,
            configured: false,
            usable: false,
            policyAllowed: false,
            selected: false,
            reason: "model_not_configured",
        };
    if ((override === null || override === void 0 ? void 0 : override.enabled) === false)
        return {
            ref: modelRef,
            key: key,
            configured: true,
            usable: false,
            policyAllowed: false,
            selected: false,
            reason: "model_disabled",
        };
    if (!provider.enabled)
        return {
            ref: modelRef,
            key: key,
            configured: true,
            usable: false,
            policyAllowed: false,
            selected: false,
            reason: "provider_disabled",
        };
    if (!((_e = provider.connection) === null || _e === void 0 ? void 0 : _e.apiKey))
        return {
            ref: modelRef,
            key: key,
            configured: true,
            usable: false,
            policyAllowed: false,
            selected: false,
            reason: "provider_credentials_unavailable",
        };
    var policy = evaluateModelPolicy(config.experimental.policies, modelRef.provider, modelRef.model);
    if (policy !== "allow")
        return {
            ref: modelRef,
            key: key,
            configured: true,
            usable: true,
            policyAllowed: false,
            selected: false,
            reason: "provider_policy_denied",
        };
    return {
        ref: modelRef,
        key: key,
        configured: true,
        usable: true,
        policyAllowed: true,
        selected: true,
    };
}
function evaluateModelPolicy(statements, provider, model) {
    var providerPolicy = evaluatePolicy(statements, "provider.use", provider, "allow");
    var modelRules = statements.filter(function (statement) {
        return statement.action === "provider.use" && statement.resource.includes("/");
    });
    return evaluatePolicy(modelRules, "provider.use", "".concat(provider, "/").concat(model), providerPolicy);
}
function matches(value, pattern) {
    var expression = pattern
        .split("*")
        .map(function (part) { return part.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&"); })
        .join(".*");
    return new RegExp("^".concat(expression, "$"), "u").test(value);
}
