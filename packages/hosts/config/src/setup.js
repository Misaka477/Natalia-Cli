"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSetupSnapshot = createSetupSnapshot;
var contracts_1 = require("@natalia/contracts");
var catalog_1 = require("./catalog");
function createSetupSnapshot(config, ref, resolution) {
    var _a;
    var modelRef = typeof ref === "string" ? (0, contracts_1.parseModelRef)(ref) : ref;
    var effective = (0, catalog_1.resolveEffectiveModel)(config, modelRef);
    if (!effective)
        throw new Error("unknown model config: ".concat((0, contracts_1.modelRefKey)(modelRef)));
    return {
        provider: effective.providerID,
        model: modelRef.model,
        contextWindow: {
            tokens: resolution.tokens,
            source: resolution.source,
            confidence: resolution.confidence,
            diagnostic: resolution.diagnostic,
            manualOverrideAllowed: true,
        },
        outputLimit: {
            value: (_a = effective.limits.maxOutputTokens) !== null && _a !== void 0 ? _a : null,
            semantics: effective.limits.maxOutputTokens
                ? "explicit-positive"
                : "omitted",
        },
        secretFields: ["providers.*.connection.apiKey"],
    };
}
