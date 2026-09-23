"use strict";
/**
 * The provider adapter seam: a format-keyed registry of wire-format adapters.
 *
 * Why a registry rather than a name match: the adapter used to be chosen by
 * substring-matching a user-authored `driver` string, so `"claude-via-openrouter"`
 * selected the Anthropic adapter and sent `x-api-key` to an OpenAI endpoint. A
 * declared format removes the guess — the endpoint says which wire format it
 * speaks and the registry resolves that to an adapter, loudly when it cannot.
 *
 * An adapter is a factory, not an instance: one endpoint needs one provider
 * instance carrying its own key, base URL and model, so the registry stores
 * `create` and the caller supplies the per-endpoint options.
 */
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
exports.registerProviderAdapter = registerProviderAdapter;
exports.unregisterProviderAdapters = unregisterProviderAdapters;
exports.getProviderAdapter = getProviderAdapter;
exports.providerAdapterFormats = providerAdapterFormats;
exports.clearProviderAdapters = clearProviderAdapters;
exports.providerFormatFromDriver = providerFormatFromDriver;
exports.resolveEndpointProtocol = resolveEndpointProtocol;
var adapters = new Map();
/**
 * Register an adapter under its format.
 *
 * A second adapter for a format already held is a programming error, not a
 * precedence rule: two adapters claiming one format means one of them will
 * never run, and the request it would have served fails somewhere else. The
 * caller must unregister the incumbent first.
 *
 * @returns a disposer that removes this registration, and only this one.
 */
function registerProviderAdapter(adapter, sourceId) {
    var existing = adapters.get(adapter.format);
    if (existing)
        throw new Error("provider adapter format \"".concat(adapter.format, "\" is already registered") +
            "".concat(existing.sourceId ? " by \"".concat(existing.sourceId, "\"") : "", "; ") +
            "unregister it first");
    adapters.set(adapter.format, { adapter: adapter, sourceId: sourceId });
    return function () {
        var _a;
        if (((_a = adapters.get(adapter.format)) === null || _a === void 0 ? void 0 : _a.adapter) === adapter)
            adapters.delete(adapter.format);
    };
}
/**
 * Withdraw every adapter registered under one source id.
 *
 * This is how a plugin unloading, or a hot reload, releases what it installed:
 * without it a reloaded plugin would collide with its own previous
 * registration and fail to start.
 */
function unregisterProviderAdapters(sourceId) {
    for (var _i = 0, adapters_1 = adapters; _i < adapters_1.length; _i++) {
        var _a = adapters_1[_i], format = _a[0], entry = _a[1];
        if (entry.sourceId === sourceId)
            adapters.delete(format);
    }
}
/** The adapter for a format, or `undefined` when none is registered. */
function getProviderAdapter(format) {
    var _a;
    return (_a = adapters.get(format)) === null || _a === void 0 ? void 0 : _a.adapter;
}
/** Every registered format, in registration order. */
function providerAdapterFormats() {
    return __spreadArray([], adapters.keys(), true);
}
/** Test seam: drop every registration so a suite starts from a known state. */
function clearProviderAdapters() {
    adapters.clear();
}
/**
 * Map a `driver` string onto a wire format.
 *
 * This is the only place that infers a format from a name. Every mapping here
 * is a guess about what a human meant to type, which is why the seam it feeds is
 * a registry keyed by declared format: once an endpoint declares
 * `protocol.format`, this runs only for entries that have not been updated yet,
 * and each such run says so out loud through {@link resolveEndpointProtocol}.
 *
 * The known driver vocabulary comes from the config catalog's discovery
 * allowlist, so the two cannot drift into accepting different names.
 */
function providerFormatFromDriver(driver) {
    var kind = (driver !== null && driver !== void 0 ? driver : "").toLowerCase();
    if (kind.includes("anthropic") || kind.includes("claude"))
        return "anthropic-messages";
    if (kind.includes("gemini") || kind.includes("google"))
        return "google-generative-ai";
    // `openai`, `openai-compatible`, and anything unrecognised: the OpenAI
    // families are the default because an unknown name is far more likely to be
    // an OpenAI-compatible endpoint than an Anthropic-shaped one.
    return "openai-chat";
}
/**
 * Normalise an endpoint's protocol declaration into the format to dispatch on.
 *
 * This is the single place that infers a format from a name, and it is the seam
 * between configuration and dispatch: everything downstream receives a
 * {@link ResolvedEndpointProtocol} and never sees the ambiguity. Inferring here
 * rather than making the field mandatory is a data-migration concern, not an
 * incomplete feature — the resolved value is what the rest of the code consumes
 * either way, and the warning names the exact JSON that removes the guess.
 *
 * A declared format always wins. An absent one is inferred and reported, because
 * a silent guess is how `"claude-via-openrouter"` ends up sending Anthropic
 * headers to an OpenAI endpoint.
 */
function resolveEndpointProtocol(input) {
    var _a, _b, _c;
    var declared = (_b = (_a = input.protocol) === null || _a === void 0 ? void 0 : _a.format) === null || _b === void 0 ? void 0 : _b.trim();
    if (declared)
        return { format: declared, declared: true };
    var format = providerFormatFromDriver(input.driver);
    console.warn("[providers] endpoint \"".concat((_c = input.driver) !== null && _c !== void 0 ? _c : "(unnamed)", "\" declares no ") +
        "protocol.format; inferring \"".concat(format, "\" from its driver. Declare it so ") +
        "the adapter is chosen by declaration rather than by a name guess:\n" +
        "  \"protocol\": { \"format\": \"".concat(format, "\" }"));
    return { format: format, declared: false };
}
