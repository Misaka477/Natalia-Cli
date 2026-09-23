"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("the endpoint protocol declares an optional module and capabilities", function () {
    var _a;
    // The extension seam: a custom format names a local module, and its optional
    // cache extensions are declared rather than guessed.
    var parsed = src_1.endpointProtocolSchema.parse({
        format: "my-format",
        module: "./adapters/mine.ts",
        capabilities: { supportsCacheControlOnTools: true },
    });
    (0, bun_test_1.expect)(parsed.format).toBe("my-format");
    (0, bun_test_1.expect)(parsed.module).toBe("./adapters/mine.ts");
    (0, bun_test_1.expect)((_a = parsed.capabilities) === null || _a === void 0 ? void 0 : _a.supportsCacheControlOnTools).toBe(true);
    // Absent is the safe case: nothing declared, nothing sent.
    (0, bun_test_1.expect)(src_1.endpointProtocolSchema.parse({})).toEqual({});
});
(0, bun_test_1.test)("the endpoint capabilities are all optional and default to off", function () {
    // Every field absent means off, because an assumed capability makes every
    // request fail against a parameter the deployment never accepted.
    (0, bun_test_1.expect)(src_1.endpointCapabilitiesSchema.parse({})).toEqual({});
    (0, bun_test_1.expect)(src_1.endpointCapabilitiesSchema.parse({ supportsLongCacheRetention: true })
        .supportsLongCacheRetention).toBe(true);
});
(0, bun_test_1.test)("unknown capability fields are rejected, not ignored", function () {
    // A silently ignored typo would read as "the capability is declared and off".
    (0, bun_test_1.expect)(function () {
        return src_1.endpointCapabilitiesSchema.parse({ supportsCacheControlOnTool: true });
    }).toThrow();
});
(0, bun_test_1.test)("the context budget defaults the preserved tail to a token floor", function () {
    // A count alone cannot say how much context a turn holds: ten short exchanges
    // and ten file reads are the same count and an order of magnitude apart.
    var parsed = src_1.contextConfigSchema.parse({});
    (0, bun_test_1.expect)(parsed.preservedRecentMessages).toBe(10);
    (0, bun_test_1.expect)(parsed.preservedRecentTokens).toBe(20000);
});
(0, bun_test_1.test)("the runtime config bounds a subagent's wall clock and gates its result", function () {
    var parsed = src_1.runtimeConfigSchema.parse({});
    (0, bun_test_1.expect)(parsed.subagentWallClockMs).toBe(900000);
    (0, bun_test_1.expect)(parsed.subagentMinResultChars).toBe(200);
    (0, bun_test_1.expect)(parsed.subagentSettledNotices).toBe(20);
});
(0, bun_test_1.test)("the goal config carries an optional completion command", function () {
    // Absent by default: a workspace without the config behaves exactly as before,
    // and an invented default would fail every workspace with no test suite.
    var empty = src_1.goalConfigSchema.parse({});
    (0, bun_test_1.expect)(empty.completionCommand).toBeUndefined();
    var configured = src_1.goalConfigSchema.parse({
        completionCommand: "bun run verify",
    });
    (0, bun_test_1.expect)(configured.completionCommand).toBe("bun run verify");
});
(0, bun_test_1.test)("the goal config rejects unknown fields and blank commands", function () {
    (0, bun_test_1.expect)(function () { return src_1.goalConfigSchema.parse({ nope: 1 }); }).toThrow();
    (0, bun_test_1.expect)(function () { return src_1.goalConfigSchema.parse({ completionCommand: "   " }); }).toThrow();
});
(0, bun_test_1.test)("a provider config carries the endpoint protocol and its connection", function () {
    var _a;
    var parsed = src_1.providerConfigSchema.parse({
        name: "primary",
        driver: "openai",
        connection: { apiKey: "k" },
        requestDefaults: {},
        protocol: { format: "openai-chat" },
    });
    (0, bun_test_1.expect)((_a = parsed.protocol) === null || _a === void 0 ? void 0 : _a.format).toBe("openai-chat");
});
