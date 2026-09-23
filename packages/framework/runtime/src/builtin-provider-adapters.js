"use strict";
/**
 * The built-in wire-format adapters.
 *
 * Registration is lazy rather than an import side effect: importing this
 * package's index must not install adapters, or a test that wants an empty
 * registry would have to know which module to avoid.
 * {@link ensureBuiltinProviderAdapters} fills whatever is missing on first use,
 * so every caller — production and test alike — gets a working registry without
 * arranging an import order, and a suite that cleared the registry heals on its
 * next call.
 *
 * A custom adapter reaches the same registry through `registerProviderAdapter`
 * with its own format string, so adding one does not require editing this file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_PROVIDER_FORMATS = exports.BUILTIN_PROVIDER_ADAPTERS = void 0;
exports.ensureBuiltinProviderAdapters = ensureBuiltinProviderAdapters;
var provider_1 = require("./provider");
var provider_adapters_1 = require("./provider-adapters");
var openAIChatAdapter = {
    format: "openai-chat",
    create: function (options) { return new provider_1.OpenAICompatibleProvider(options); },
};
var anthropicMessagesAdapter = {
    format: "anthropic-messages",
    create: function (options) { return new provider_1.AnthropicProvider(options); },
};
var openAIResponsesAdapter = {
    format: "openai-responses",
    create: function (options) { return new provider_1.OpenAIResponsesProvider(options); },
};
/**
 * Gemini is registered only because the adapter exists and its tests exercise
 * it. It is not a supported target: the product's families are OpenAI chat,
 * OpenAI responses and Anthropic messages.
 */
var geminiAdapter = {
    format: "google-generative-ai",
    create: function (options) { return new provider_1.GeminiProvider(options); },
};
/**
 * Every built-in adapter, in the order they register.
 *
 * Method-syntax bivariance lets each specific adapter sit in a list typed by
 * the common base without a cast at every entry.
 */
exports.BUILTIN_PROVIDER_ADAPTERS = [
    openAIChatAdapter,
    openAIResponsesAdapter,
    anthropicMessagesAdapter,
    geminiAdapter,
];
/** Every format a built-in adapter covers, for validation and diagnostics. */
exports.BUILTIN_PROVIDER_FORMATS = exports.BUILTIN_PROVIDER_ADAPTERS.map(function (adapter) { return adapter.format; });
/**
 * Register whatever built-in adapter is missing.
 *
 * Checking the registry instead of remembering whether it ran keeps this
 * idempotent and self-healing: a test that cleared the registry does not need
 * to reset a flag to get the built-ins back.
 */
function ensureBuiltinProviderAdapters() {
    for (var _i = 0, BUILTIN_PROVIDER_ADAPTERS_1 = exports.BUILTIN_PROVIDER_ADAPTERS; _i < BUILTIN_PROVIDER_ADAPTERS_1.length; _i++) {
        var adapter = BUILTIN_PROVIDER_ADAPTERS_1[_i];
        if (!(0, provider_adapters_1.getProviderAdapter)(adapter.format))
            (0, provider_adapters_1.registerProviderAdapter)(adapter, "builtin");
    }
}
