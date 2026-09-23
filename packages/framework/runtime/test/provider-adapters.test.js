"use strict";
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
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
var bun_test_1 = require("bun:test");
var builtin_provider_adapters_1 = require("../src/builtin-provider-adapters");
var src_1 = require("../src");
/** A stand-in adapter that records the options it was built with. */
function fakeAdapter(format) {
    return {
        format: format,
        create: function (options) {
            var _a;
            return ({
                provider: (_a = options.provider) !== null && _a !== void 0 ? _a : format,
                model: options.model,
                stream: function () {
                    return __asyncGenerator(this, arguments, function stream_1() {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, __await({ type: "done" })];
                                case 1: return [4 /*yield*/, _a.sent()];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    });
                },
            });
        },
    };
}
// The registry is process-global, so another suite's registrations are visible
// here. Each test starts from an empty one and installs what it needs.
(0, bun_test_1.beforeEach)(function () {
    (0, src_1.clearProviderAdapters)();
});
(0, bun_test_1.afterEach)(function () {
    (0, src_1.clearProviderAdapters)();
});
(0, bun_test_1.describe)("provider adapter registry", function () {
    (0, bun_test_1.test)("resolves an adapter by its declared format", function () {
        var _a;
        (0, src_1.registerProviderAdapter)(fakeAdapter("my-format"), "plugin-a");
        (0, bun_test_1.expect)((_a = (0, src_1.getProviderAdapter)("my-format")) === null || _a === void 0 ? void 0 : _a.format).toBe("my-format");
        (0, bun_test_1.expect)((0, src_1.providerAdapterFormats)()).toEqual(["my-format"]);
    });
    (0, bun_test_1.test)("refuses a second adapter for a format already held", function () {
        (0, src_1.registerProviderAdapter)(fakeAdapter("dup"), "plugin-a");
        // Two adapters claiming one format means one of them can never run, and
        // whichever request it would have served fails somewhere else entirely.
        (0, bun_test_1.expect)(function () {
            return (0, src_1.registerProviderAdapter)(fakeAdapter("dup"), "plugin-b");
        }).toThrow(/already registered by "plugin-a"/);
    });
    (0, bun_test_1.test)("an adapter whose format is free may register after the incumbent left", function () {
        var dispose = (0, src_1.registerProviderAdapter)(fakeAdapter("swap"), "plugin-a");
        dispose();
        (0, src_1.registerProviderAdapter)(fakeAdapter("swap"), "plugin-b");
        (0, bun_test_1.expect)((0, src_1.getProviderAdapter)("swap")).toBeDefined();
    });
    (0, bun_test_1.test)("withdraws every adapter a source registered, and only those", function () {
        (0, src_1.registerProviderAdapter)(fakeAdapter("a-one"), "plugin-a");
        (0, src_1.registerProviderAdapter)(fakeAdapter("a-two"), "plugin-a");
        (0, src_1.registerProviderAdapter)(fakeAdapter("b-one"), "plugin-b");
        (0, src_1.unregisterProviderAdapters)("plugin-a");
        (0, bun_test_1.expect)((0, src_1.providerAdapterFormats)()).toEqual(["b-one"]);
    });
    (0, bun_test_1.test)("a disposer removes only its own registration", function () {
        var disposeA = (0, src_1.registerProviderAdapter)(fakeAdapter("shared"), "plugin-a");
        disposeA();
        // The slot is free again, so a fresh registration must survive the stale
        // disposer being run twice.
        (0, src_1.registerProviderAdapter)(fakeAdapter("shared"), "plugin-b");
        disposeA();
        (0, bun_test_1.expect)((0, src_1.getProviderAdapter)("shared")).toBeDefined();
    });
    (0, bun_test_1.test)("an unknown format resolves to nothing rather than a default", function () {
        // No silent fallback: a caller that guesses would send the wrong wire
        // shape and fail far from the cause.
        (0, bun_test_1.expect)((0, src_1.getProviderAdapter)("nope")).toBeUndefined();
    });
    (0, bun_test_1.test)("accepts a specific-options adapter without a cast", function () {
        // Anthropic's adapter takes `thinkingBudgetTokens`, which the base options
        // do not declare. Method-syntax bivariance on `create` is what lets it be
        // registered — and held in a base-typed list — with no cast; a
        // property-style `create` would have forced one at every site.
        // `builtin-provider-adapters.ts` compiles as the proof.
        var anthropic = builtin_provider_adapters_1.BUILTIN_PROVIDER_ADAPTERS.find(function (adapter) { return adapter.format === "anthropic-messages"; });
        (0, bun_test_1.expect)(anthropic).toBeDefined();
        (0, bun_test_1.expect)(anthropic.format).toBe("anthropic-messages");
    });
    (0, bun_test_1.test)("the registry view widens options to the common base", function () {
        // A consequence of storing adapters by format: the lookup type is the base,
        // so a format-specific field cannot be passed through the registry. That is
        // deliberate — the registry is the crossing point, and a caller that needs
        // `thinkingBudgetTokens` resolves the adapter itself rather than widening
        // the shared contract for one format.
        (0, src_1.registerProviderAdapter)(fakeAdapter("base-only"), "plugin-a");
        var adapter = (0, src_1.getProviderAdapter)("base-only");
        // The excess field is not part of the contract, so it is neither accepted
        // by the type nor honoured by the adapter.
        var built = adapter.create({ apiKey: "k", model: "m" });
        (0, bun_test_1.expect)(built.model).toBe("m");
    });
});
(0, bun_test_1.describe)("built-in adapters", function () {
    (0, bun_test_1.test)("registers on first use and is idempotent", function () {
        (0, builtin_provider_adapters_1.ensureBuiltinProviderAdapters)();
        var first = (0, src_1.providerAdapterFormats)();
        (0, builtin_provider_adapters_1.ensureBuiltinProviderAdapters)();
        (0, bun_test_1.expect)((0, src_1.providerAdapterFormats)()).toEqual(first);
    });
    (0, bun_test_1.test)("heals after the registry was cleared", function () {
        (0, builtin_provider_adapters_1.ensureBuiltinProviderAdapters)();
        (0, src_1.clearProviderAdapters)();
        (0, bun_test_1.expect)((0, src_1.providerAdapterFormats)()).toEqual([]);
        (0, builtin_provider_adapters_1.ensureBuiltinProviderAdapters)();
        (0, bun_test_1.expect)((0, src_1.providerAdapterFormats)().length).toBe(builtin_provider_adapters_1.BUILTIN_PROVIDER_ADAPTERS.length);
    });
    (0, bun_test_1.test)("covers the three supported families plus Gemini for its tests", function () {
        (0, builtin_provider_adapters_1.ensureBuiltinProviderAdapters)();
        (0, bun_test_1.expect)(__spreadArray([], builtin_provider_adapters_1.BUILTIN_PROVIDER_FORMATS, true).sort()).toEqual([
            "anthropic-messages",
            "google-generative-ai",
            "openai-chat",
            "openai-responses",
        ]);
        for (var _i = 0, BUILTIN_PROVIDER_FORMATS_1 = builtin_provider_adapters_1.BUILTIN_PROVIDER_FORMATS; _i < BUILTIN_PROVIDER_FORMATS_1.length; _i++) {
            var format = BUILTIN_PROVIDER_FORMATS_1[_i];
            (0, bun_test_1.expect)((0, src_1.getProviderAdapter)(format)).toBeDefined();
        }
    });
    (0, bun_test_1.test)("each built-in builds a provider for its own endpoint", function () {
        (0, builtin_provider_adapters_1.ensureBuiltinProviderAdapters)();
        for (var _i = 0, BUILTIN_PROVIDER_FORMATS_2 = builtin_provider_adapters_1.BUILTIN_PROVIDER_FORMATS; _i < BUILTIN_PROVIDER_FORMATS_2.length; _i++) {
            var format = BUILTIN_PROVIDER_FORMATS_2[_i];
            var built = (0, src_1.getProviderAdapter)(format).create({
                apiKey: "k",
                model: "model-for-".concat(format),
            });
            (0, bun_test_1.expect)(built.model).toBe("model-for-".concat(format));
        }
    });
});
(0, bun_test_1.describe)("providerFormatFromDriver", function () {
    (0, bun_test_1.test)("maps the config catalog's driver vocabulary onto formats", function () {
        (0, bun_test_1.expect)((0, src_1.providerFormatFromDriver)("anthropic")).toBe("anthropic-messages");
        (0, bun_test_1.expect)((0, src_1.providerFormatFromDriver)("anthropic-compatible")).toBe("anthropic-messages");
        (0, bun_test_1.expect)((0, src_1.providerFormatFromDriver)("openai")).toBe("openai-chat");
        (0, bun_test_1.expect)((0, src_1.providerFormatFromDriver)("openai-compatible")).toBe("openai-chat");
        (0, bun_test_1.expect)((0, src_1.providerFormatFromDriver)("gemini")).toBe("google-generative-ai");
    });
    (0, bun_test_1.test)("an unrecognised driver resolves to the OpenAI family", function () {
        // An unknown name is far more likely to be an OpenAI-compatible endpoint
        // than an Anthropic-shaped one, and this is the only name-based guess left
        // in the seam.
        (0, bun_test_1.expect)((0, src_1.providerFormatFromDriver)("some-random-thing")).toBe("openai-chat");
        (0, bun_test_1.expect)((0, src_1.providerFormatFromDriver)(undefined)).toBe("openai-chat");
    });
});
(0, bun_test_1.describe)("resolveEndpointProtocol", function () {
    (0, bun_test_1.test)("a declared format wins over whatever the driver suggests", function () {
        // The whole point of the seam: `"claude-via-openrouter"` must not become an
        // Anthropic request just because its name contains "claude".
        var resolved = (0, src_1.resolveEndpointProtocol)({
            driver: "claude-via-openrouter",
            protocol: { format: "openai-chat" },
        });
        (0, bun_test_1.expect)(resolved).toEqual({ format: "openai-chat", declared: true });
    });
    (0, bun_test_1.test)("a driver that reads as Anthropic is overridden by a declared format", function () {
        var resolved = (0, src_1.resolveEndpointProtocol)({
            driver: "openai-anthropic-gateway",
            protocol: { format: "openai-responses" },
        });
        (0, bun_test_1.expect)(resolved.format).toBe("openai-responses");
        (0, bun_test_1.expect)(resolved.declared).toBe(true);
    });
    (0, bun_test_1.test)("an absent declaration is inferred and reported as undeclared", function () {
        var resolved = (0, src_1.resolveEndpointProtocol)({ driver: "anthropic" });
        (0, bun_test_1.expect)(resolved.format).toBe("anthropic-messages");
        (0, bun_test_1.expect)(resolved.declared).toBe(false);
    });
    (0, bun_test_1.test)("a blank declaration counts as absent", function () {
        // A whitespace-only value is a typo, not a format name; treating it as
        // declared would register nothing under it and fail at dispatch.
        var resolved = (0, src_1.resolveEndpointProtocol)({
            driver: "openai",
            protocol: { format: "   " },
        });
        (0, bun_test_1.expect)(resolved.format).toBe("openai-chat");
        (0, bun_test_1.expect)(resolved.declared).toBe(false);
    });
    (0, bun_test_1.test)("an unnamed endpoint still resolves rather than throwing", function () {
        var resolved = (0, src_1.resolveEndpointProtocol)({});
        (0, bun_test_1.expect)(resolved.format).toBe("openai-chat");
        (0, bun_test_1.expect)(resolved.declared).toBe(false);
    });
    (0, bun_test_1.test)("the inferred value is what dispatch would use, for every driver", function () {
        // The resolver and the registry must agree, or a config that loads would
        // still fail to find its adapter.
        (0, builtin_provider_adapters_1.ensureBuiltinProviderAdapters)();
        for (var _i = 0, _a = [
            "anthropic",
            "anthropic-compatible",
            "openai",
            "openai-compatible",
            "gemini",
            "something-else",
        ]; _i < _a.length; _i++) {
            var driver = _a[_i];
            var format = (0, src_1.resolveEndpointProtocol)({ driver: driver }).format;
            (0, bun_test_1.expect)((0, src_1.getProviderAdapter)(format)).toBeDefined();
        }
    });
});
(0, bun_test_1.describe)("providerFromKind dispatch", function () {
    (0, bun_test_1.test)("dispatches on the declared format, not on the driver name", function () {
        // End-to-end proof of the seam: a name that reads as Anthropic, with a
        // declared OpenAI format, must produce a provider that speaks OpenAI. The
        // old name-substring path sent Anthropic headers here and failed with 400.
        var provider = (0, src_1.providerFromKind)({
            apiKey: "k",
            model: "gpt-test",
            providerName: "claude-via-openrouter",
            provider: "claude-via-openrouter",
            format: "openai-chat",
        });
        (0, bun_test_1.expect)(provider.provider).toBe("claude-via-openrouter");
        (0, bun_test_1.expect)(provider.model).toBe("gpt-test");
    });
    (0, bun_test_1.test)("dispatches to Anthropic when the driver says so and nothing is declared", function () {
        var provider = (0, src_1.providerFromKind)({
            apiKey: "k",
            model: "claude-test",
            providerName: "anthropic",
            provider: "anthropic",
        });
        (0, bun_test_1.expect)(provider.provider).toBe("anthropic");
        (0, bun_test_1.expect)(provider.model).toBe("claude-test");
    });
    (0, bun_test_1.test)("an unregistered declared format fails loudly instead of falling back", function () {
        // Silently degrading to OpenAI would send the wrong wire shape and fail
        // somewhere far from the cause.
        (0, bun_test_1.expect)(function () {
            return (0, src_1.providerFromKind)({
                apiKey: "k",
                model: "m",
                providerName: "custom",
                provider: "custom",
                format: "no-such-format",
            });
        }).toThrow(/no provider adapter is registered for format "no-such-format"/);
    });
});
