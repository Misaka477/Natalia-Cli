"use strict";
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
var token_meter_1 = require("../src/token-meter");
(0, bun_test_1.test)("token meter estimates messages with a stable fixed heuristic", function () {
    var meter = new token_meter_1.TokenMeter();
    (0, bun_test_1.expect)((0, token_meter_1.estimateMeterMessage)({ role: "user", content: "hello world" })).toBe(4 + 3);
    (0, bun_test_1.expect)(meter.estimateRequest({
        system: "system",
        tools: [{ name: "shell" }],
        messages: [{ role: "user", content: "hello" }],
    })).toBeGreaterThan(0);
});
(0, bun_test_1.test)("provider usage is reused only when the canonical header still matches", function () {
    var meter = new token_meter_1.TokenMeter();
    var messages = [{ role: "user", content: "hello" }];
    meter.observeSurface("main", messages);
    meter.recordUsage("main", { inputTokens: 10000, outputTokens: 200 }, {
        headerKey: JSON.stringify({ system: "sys", tools: [] }),
        surfaceTokens: meter.estimateMessages(messages),
    });
    var matching = meter.measureRequest("main", {
        system: "sys",
        tools: [],
        messages: messages,
        contextWindow: 100000,
    });
    (0, bun_test_1.expect)(matching.source).toBe("provider_usage");
    (0, bun_test_1.expect)(matching.totalTokens).toBe(10200);
    var changedHeader = meter.measureRequest("main", {
        system: "different system",
        tools: [],
        messages: messages,
        contextWindow: 100000,
    });
    (0, bun_test_1.expect)(changedHeader.source).toBe("estimate");
    (0, bun_test_1.expect)(changedHeader.totalTokens).toBeLessThan(10200);
    (0, bun_test_1.expect)(changedHeader.totalTokens).toBeGreaterThan(0);
});
(0, bun_test_1.test)("projected tokens carry the provider sample across surface growth", function () {
    var meter = new token_meter_1.TokenMeter();
    var base = [{ role: "user", content: "a".repeat(400) }];
    meter.observeSurface("navi", base);
    meter.recordUsage("navi", { inputTokens: 500, outputTokens: 50 }, { headerKey: "header", surfaceTokens: meter.estimateMessages(base) });
    meter.observeSurface("navi", __spreadArray(__spreadArray([], base, true), [
        { role: "assistant", content: "b".repeat(4000) },
    ], false));
    var projected = meter.project("navi");
    (0, bun_test_1.expect)(projected.pressureTokens).toBe(500);
    (0, bun_test_1.expect)(projected.projectedTokens).toBeGreaterThan(1000);
    (0, bun_test_1.expect)(projected.contextWindow).toBeUndefined();
    meter.setContextWindow("navi", 8000);
    (0, bun_test_1.expect)(meter.project("navi").contextWindow).toBe(8000);
});
(0, bun_test_1.test)("a smaller provider sample never hides a larger current request", function () {
    var meter = new token_meter_1.TokenMeter();
    var messages = [{ role: "user", content: "x".repeat(4000) }];
    meter.observeSurface("main", messages);
    meter.recordUsage("main", { inputTokens: 10, outputTokens: 1 }, { headerKey: "same", surfaceTokens: meter.estimateMessages(messages) });
    var measured = meter.measureRequest("main", {
        system: "",
        tools: [],
        messages: messages,
    });
    (0, bun_test_1.expect)(measured.source).toBe("estimate");
    (0, bun_test_1.expect)(measured.totalTokens).toBeGreaterThanOrEqual(measured.messageTokens);
});
(0, bun_test_1.test)("three-bucket measurement keeps system, tools and messages additive", function () {
    var meter = new token_meter_1.TokenMeter();
    var messages = [
        { role: "user", content: "a".repeat(400) },
        { role: "assistant", content: "b".repeat(400) },
    ];
    var withTools = meter.measureRequest("main", {
        system: "s".repeat(200),
        tools: [{ name: "shell", parameters: { type: "object" } }],
        messages: messages,
    });
    (0, bun_test_1.expect)(withTools.systemTokens).toBe((0, token_meter_1.estimateTokenText)("s".repeat(200)));
    (0, bun_test_1.expect)(withTools.toolsTokens).toBeGreaterThan(0);
    (0, bun_test_1.expect)(withTools.messageTokens).toBeGreaterThan(0);
    (0, bun_test_1.expect)(withTools.headerTokens).toBe(withTools.systemTokens + withTools.toolsTokens);
    (0, bun_test_1.expect)(withTools.totalTokens).toBe(withTools.headerTokens + withTools.messageTokens);
    // The system prompt is never also counted inside the message surface.
    (0, bun_test_1.expect)(withTools.messageTokens).toBe(meter.estimateMessages(messages));
});
(0, bun_test_1.test)("recordUsage and measureRequest share one header key per envelope", function () {
    var meter = new token_meter_1.TokenMeter();
    var messages = [{ role: "user", content: "hello" }];
    var tools = [{ name: "shell", parameters: { type: "object" } }];
    meter.recordUsage("main", { inputTokens: 10000, outputTokens: 200 }, {
        headerKey: (0, token_meter_1.requestHeaderKey)({ system: "sys", tools: tools }),
        surfaceTokens: meter.estimateMessages(messages),
    });
    // Same system + tools header reuses the provider anchor.
    var reused = meter.measureRequest("main", {
        system: "sys",
        tools: tools,
        messages: messages,
        contextWindow: 100000,
    });
    (0, bun_test_1.expect)(reused.source).toBe("provider_usage");
    (0, bun_test_1.expect)(reused.totalTokens).toBe(10200);
    (0, bun_test_1.expect)(reused.toolsTokens).toBeGreaterThan(0);
    // A different tool set invalidates the anchor even with the same system.
    var changedTools = meter.measureRequest("main", {
        system: "sys",
        tools: [{ name: "other", parameters: { type: "object" } }],
        messages: messages,
        contextWindow: 100000,
    });
    (0, bun_test_1.expect)(changedTools.source).toBe("estimate");
});
(0, bun_test_1.test)("estimateVisualInput prices an image by its dimensions, not its bytes", function () {
    // 1568x882 is the post-scaling maximum for the default long-edge limit, and
    // is worth ~1.8k tokens. A meter that read only `content` would price this
    // message at its text alone.
    var withImage = (0, token_meter_1.estimateMeterMessage)({
        role: "user",
        content: "看看这张截图",
        images: [{ width: 1568, height: 882 }],
    });
    var textOnly = (0, token_meter_1.estimateMeterMessage)({
        role: "user",
        content: "看看这张截图",
    });
    (0, bun_test_1.expect)(withImage).toBeGreaterThan(textOnly + 1000);
    (0, bun_test_1.expect)(withImage - textOnly).toBe(Math.ceil((1568 * 882) / token_meter_1.TOKEN_METER_IMAGE_PIXELS_PER_TOKEN) +
        token_meter_1.TOKEN_METER_BLOCK_OVERHEAD);
});
(0, bun_test_1.test)("estimateVisualInput never under-counts a large image", function () {
    // A 40 MP image — the admission pixel ceiling — must not collapse to a small
    // number. Under-counting is what stops compaction from firing at all.
    var huge = (0, token_meter_1.estimateMeterMessage)({
        role: "user",
        content: "",
        images: [{ width: 8000, height: 5000 }],
    });
    (0, bun_test_1.expect)(huge).toBeGreaterThan(50000);
});
(0, bun_test_1.test)("estimateVisualInput prices an image with unknown dimensions conservatively", function () {
    var unknown = (0, token_meter_1.estimateMeterMessage)({
        role: "user",
        content: "",
        images: [{}],
    });
    var known = (0, token_meter_1.estimateMeterMessage)({
        role: "user",
        content: "",
        images: [{ width: 1568, height: 882 }],
    });
    (0, bun_test_1.expect)(unknown).toBeGreaterThan(known);
    (0, bun_test_1.expect)(unknown - known).toBe(token_meter_1.TOKEN_METER_IMAGE_UNKNOWN_TOKENS -
        Math.ceil((1568 * 882) / token_meter_1.TOKEN_METER_IMAGE_PIXELS_PER_TOKEN));
});
(0, bun_test_1.test)("estimateVisualInput prices videos the same way as images", function () {
    var video = (0, token_meter_1.estimateMeterMessage)({
        role: "user",
        content: "",
        videos: [{ width: 1920, height: 1080 }],
    });
    var image = (0, token_meter_1.estimateMeterMessage)({
        role: "user",
        content: "",
        images: [{ width: 1920, height: 1080 }],
    });
    (0, bun_test_1.expect)(video).toBe(image);
});
(0, bun_test_1.test)("a message with no attachments is priced exactly as before", function () {
    (0, bun_test_1.expect)((0, token_meter_1.estimateMeterMessage)({ role: "user", content: "plain text" })).toBe(token_meter_1.TOKEN_METER_ROLE_OVERHEAD + (0, token_meter_1.estimateTokenText)("plain text"));
});
(0, bun_test_1.test)("measureRequest counts attachment pressure that content alone would miss", function () {
    var meter = new token_meter_1.TokenMeter();
    var messages = [
        { role: "user", content: "第一张", images: [{ width: 1568, height: 882 }] },
        { role: "assistant", content: "看到了" },
        { role: "user", content: "第二张", images: [{ width: 1568, height: 882 }] },
    ];
    var textOnly = [
        { role: "user", content: "第一张" },
        { role: "assistant", content: "看到了" },
        { role: "user", content: "第二张" },
    ];
    var withImages = meter.measureRequest("with", {
        messages: messages,
        contextWindow: 200000,
    });
    var withoutImages = meter.measureRequest("without", {
        messages: textOnly,
        contextWindow: 200000,
    });
    // Two screenshots must move the request total by thousands of tokens, or the
    // compaction trigger below never fires for an image-heavy session.
    (0, bun_test_1.expect)(withImages.messageTokens).toBeGreaterThan(withoutImages.messageTokens + 3000);
});
(0, bun_test_1.test)("recordUsage keeps the cache read instead of dropping it at the boundary", function () {
    // The token meter's usage view once spelled these fields `cacheReadTokens` /
    // `cacheWriteTokens` while every other layer used `cacheReadInputTokens` /
    // `cacheCreationInputTokens`. TypeScript allowed the mismatch — the required
    // fields agree and these are optional — so the cache read silently vanished
    // and the meter under-counted every cached request, on Anthropic as much as
    // on OpenAI. This pins the two vocabularies together.
    var meter = new token_meter_1.TokenMeter();
    meter.recordUsage("anthropic", {
        inputTokens: 12000,
        outputTokens: 4,
        cacheReadInputTokens: 11000,
        cacheCreationInputTokens: 20000,
    }, { headerKey: "h" });
    (0, bun_test_1.expect)(meter.project("anthropic").pressureTokens).toBe(12000 + 11000 + 20000);
});
(0, bun_test_1.test)("recordUsage prices an OpenAI sample, which reports a read but no write", function () {
    var meter = new token_meter_1.TokenMeter();
    meter.recordUsage("openai", { inputTokens: 900, outputTokens: 2, cacheReadInputTokens: 800 }, { headerKey: "h" });
    (0, bun_test_1.expect)(meter.project("openai").pressureTokens).toBe(900 + 800);
});
(0, bun_test_1.test)("measureRequest prefers the provider sample once the cache read is counted", function () {
    // A cached request's true total includes the read, so the sample must beat
    // the heuristic estimate before it is trusted as the compaction anchor.
    var meter = new token_meter_1.TokenMeter();
    var envelope = {
        messages: [{ role: "user", content: "short" }],
        system: "s",
        tools: undefined,
        contextWindow: 200000,
    };
    // The sample is only reused while the header it priced is still current, so
    // record it against the same key measureRequest will derive.
    meter.recordUsage("cached", { inputTokens: 2000, outputTokens: 10, cacheReadInputTokens: 100000 }, { headerKey: (0, token_meter_1.requestHeaderKey)(envelope) });
    var measured = meter.measureRequest("cached", envelope);
    (0, bun_test_1.expect)(measured.source).toBe("provider_usage");
    (0, bun_test_1.expect)(measured.totalTokens).toBe(2000 + 10 + 100000);
});
