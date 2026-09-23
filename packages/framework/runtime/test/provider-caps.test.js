"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var provider_caps_1 = require("../src/provider-caps");
(0, bun_test_1.test)("an undeclared capability set resolves every flag to off", function () {
    // The rule: a capability is on only when declared. An assumed one makes every
    // request fail against a parameter the deployment never accepted.
    (0, bun_test_1.expect)((0, provider_caps_1.resolveEndpointCapabilities)(undefined)).toEqual({
        supportsLongCacheRetention: false,
        supportsCacheControlOnTools: false,
        sendSessionAffinityHeaders: false,
        sessionAffinityFormat: undefined,
        supportsPromptCacheKey: false,
        promptCacheKeyField: undefined,
        supportsExplicitPromptCacheMode: false,
    });
});
(0, bun_test_1.test)("an empty declaration is the same as no declaration", function () {
    (0, bun_test_1.expect)((0, provider_caps_1.resolveEndpointCapabilities)({})).toEqual((0, provider_caps_1.resolveEndpointCapabilities)(undefined));
});
(0, bun_test_1.test)("a declared flag survives, and its neighbours stay off", function () {
    var caps = (0, provider_caps_1.resolveEndpointCapabilities)({
        supportsCacheControlOnTools: true,
    });
    (0, bun_test_1.expect)(caps.supportsCacheControlOnTools).toBe(true);
    (0, bun_test_1.expect)(caps.supportsLongCacheRetention).toBe(false);
    (0, bun_test_1.expect)(caps.sendSessionAffinityHeaders).toBe(false);
});
(0, bun_test_1.test)("a string field stays absent until declared, so no spelling is invented", function () {
    var caps = (0, provider_caps_1.resolveEndpointCapabilities)({ supportsPromptCacheKey: true });
    // A key is on but no spelling is named: the caller must fall back to the
    // wire default rather than assume one.
    (0, bun_test_1.expect)(caps.supportsPromptCacheKey).toBe(true);
    (0, bun_test_1.expect)(caps.promptCacheKeyField).toBeUndefined();
});
(0, bun_test_1.test)("declaring a spelling does not turn the capability on by itself", function () {
    // The two gates are independent: a spelling without the flag sends nothing.
    var caps = (0, provider_caps_1.resolveEndpointCapabilities)({
        promptCacheKeyField: "prompt_cache_key",
    });
    (0, bun_test_1.expect)(caps.supportsPromptCacheKey).toBe(false);
    (0, bun_test_1.expect)(caps.promptCacheKeyField).toBe("prompt_cache_key");
});
