"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var provider_caps_1 = require("../src/provider-caps");
(0, bun_test_1.test)("short retention is the default marker", function () {
    (0, bun_test_1.expect)((0, provider_caps_1.anthropicCacheControl)({
        retention: "short",
        supportsLongCacheRetention: false,
    })).toEqual({ type: "ephemeral" });
});
(0, bun_test_1.test)("long retention adds the ttl only when the endpoint declared it", function () {
    (0, bun_test_1.expect)((0, provider_caps_1.anthropicCacheControl)({
        retention: "long",
        supportsLongCacheRetention: true,
    })).toEqual({ type: "ephemeral", ttl: "1h" });
});
(0, bun_test_1.test)("long retention degrades to short rather than sending an unsupported ttl", function () {
    // The request still has to go out, and a `ttl` the deployment rejects fails
    // every request — so asking for more than is supported gives what is.
    (0, bun_test_1.expect)((0, provider_caps_1.anthropicCacheControl)({
        retention: "long",
        supportsLongCacheRetention: false,
    })).toEqual({ type: "ephemeral" });
});
(0, bun_test_1.test)("none opts out of the cache entirely", function () {
    (0, bun_test_1.expect)((0, provider_caps_1.anthropicCacheControl)({
        retention: "none",
        supportsLongCacheRetention: true,
    })).toBeUndefined();
});
