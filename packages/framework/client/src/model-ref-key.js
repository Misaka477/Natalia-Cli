"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveModelRefKey = deriveModelRefKey;
/**
 * Model reference key derivation.
 *
 * The canonical `provider/model` key for an effective model selection: an
 * agent's own model wins, then the session's selected model, then the default
 * model. This is pure config/selection → key, so the precedence rules are
 * testable without the runtime state they read.
 */
var contracts_1 = require("@natalia/contracts");
function deriveModelRefKey(input) {
    var _a, _b, _c, _d, _e;
    var candidate = (_e = (_d = (_b = (_a = input.agent) === null || _a === void 0 ? void 0 : _a.model) !== null && _b !== void 0 ? _b : (_c = input.model) === null || _c === void 0 ? void 0 : _c.modelID) !== null && _d !== void 0 ? _d : input.defaultModel) !== null && _e !== void 0 ? _e : undefined;
    if (!candidate)
        return undefined;
    return typeof candidate === "string" ? candidate : (0, contracts_1.modelRefKey)(candidate);
}
