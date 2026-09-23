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
var node_worker_threads_1 = require("node:worker_threads");
var input = node_worker_threads_1.workerData;
var child = Bun.spawn({
    cmd: __spreadArray([input.executable], input.args, true),
    env: __assign(__assign({}, process.env), input.environment),
    stdin: input.stdin === undefined ? "ignore" : "pipe",
    stdout: "pipe",
    stderr: "pipe",
});
if (input.stdin !== undefined) {
    if (!child.stdin)
        throw new Error("WezTerm stdin pipe was not created");
    child.stdin.write(input.stdin);
    child.stdin.end();
}
try {
    var _a = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
    ]), stdout = _a[0], stderr = _a[1], exitCode = _a[2];
    node_worker_threads_1.parentPort === null || node_worker_threads_1.parentPort === void 0 ? void 0 : node_worker_threads_1.parentPort.postMessage({ stdout: stdout, stderr: stderr, exitCode: exitCode });
}
catch (error) {
    node_worker_threads_1.parentPort === null || node_worker_threads_1.parentPort === void 0 ? void 0 : node_worker_threads_1.parentPort.postMessage({
        error: error instanceof Error ? error.message : String(error),
    });
}
