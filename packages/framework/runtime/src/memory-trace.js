"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryTrace = memoryTrace;
exports.startMemoryTraceSampler = startMemoryTraceSampler;
exports.stopMemoryTraceSampler = stopMemoryTraceSampler;
function memoryTrace(label, extra) {
    if (process.env.NATALIA_MEMORY_TRACE !== "1")
        return;
    var usage = process.memoryUsage();
    console.warn("[mem-trace] ".concat(label), __assign({ rssMB: Math.round(usage.rss / 1048576), heapMB: Math.round(usage.heapUsed / 1048576), externalMB: Math.round(usage.external / 1048576), arrayBuffersMB: Math.round(usage.arrayBuffers / 1048576) }, extra));
}
var sampler;
/**
 * Periodic RSS/heap sample under `NATALIA_MEMORY_TRACE=1`, so a soak can tell a
 * one-off spike from a per-session/per-turn leak. Interval is configurable via
 * `NATALIA_MEMORY_TRACE_INTERVAL_MS` (default 15s); the timer is unref'd so it
 * never keeps the process alive.
 */
function startMemoryTraceSampler() {
    var _a, _b;
    if (process.env.NATALIA_MEMORY_TRACE !== "1")
        return;
    if (sampler)
        return;
    var configured = Number((_a = process.env.NATALIA_MEMORY_TRACE_INTERVAL_MS) !== null && _a !== void 0 ? _a : "");
    var intervalMs = Number.isFinite(configured) && configured >= 1000 ? configured : 15000;
    sampler = setInterval(function () { return memoryTrace("rss.sample"); }, intervalMs);
    (_b = sampler.unref) === null || _b === void 0 ? void 0 : _b.call(sampler);
}
function stopMemoryTraceSampler() {
    if (sampler)
        clearInterval(sampler);
    sampler = undefined;
}
