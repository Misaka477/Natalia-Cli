"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.perfLog = perfLog;
/**
 * Performance/log helper.
 *
 * Ordinary startup/rendering timing logs are only emitted when
 * NATALIA_PERF_VERBOSE=1. Error/failure logs should stay unconditional and
 * should not be routed through this helper.
 */
function perfLog() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    if (process.env.NATALIA_PERF_VERBOSE === "1") {
        console.warn.apply(console, args);
    }
}
