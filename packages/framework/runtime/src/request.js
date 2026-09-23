"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOutputLimit = resolveOutputLimit;
exports.buildProviderRequest = buildProviderRequest;
function resolveOutputLimit(input) {
    if (typeof input.maxOutputTokens === "number") {
        if (input.maxOutputTokens <= 0)
            return {
                kind: "omitted",
                diagnostic: "non-positive output limit treated as omitted",
            };
        return {
            kind: "explicit",
            tokens: input.maxOutputTokens,
            diagnostic: "explicit positive config",
        };
    }
    if (input.providerRequiresOutputLimit) {
        var tokens = input.providerDefaultOutputLimit;
        if (!tokens || tokens <= 0)
            throw new Error("provider requires output limit but adapter did not provide a safe default");
        return {
            kind: "provider-required",
            tokens: tokens,
            diagnostic: "provider adapter required output limit",
        };
    }
    return { kind: "omitted", diagnostic: "max output omitted by config" };
}
function buildProviderRequest(input) {
    var _a;
    var request = {
        model: input.model,
        messages: input.messages,
    };
    var decision = resolveOutputLimit(input);
    if (decision.kind !== "omitted") {
        request[(_a = input.fieldName) !== null && _a !== void 0 ? _a : "max_tokens"] = decision.tokens;
    }
    return { request: request, outputLimit: decision };
}
