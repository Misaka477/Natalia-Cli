"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForToolExecution = waitForToolExecution;
exports.isManagedResourceTool = isManagedResourceTool;
exports.lineCount = lineCount;
function waitForToolExecution(execution, signal) {
    if (!signal)
        return execution;
    if (signal.aborted)
        return Promise.reject(signal.reason);
    return new Promise(function (resolve, reject) {
        var abort = function () { var _a; return reject((_a = signal.reason) !== null && _a !== void 0 ? _a : new Error("tool cancelled")); };
        signal.addEventListener("abort", abort, { once: true });
        execution.then(function (result) {
            signal.removeEventListener("abort", abort);
            resolve(result);
        }, function (error) {
            signal.removeEventListener("abort", abort);
            reject(error);
        });
    });
}
function isManagedResourceTool(toolName) {
    return [
        "process_start",
        "process_stop",
        "process_restart",
        "background_start",
        "background_stop",
        "background_restart",
    ].includes(toolName);
}
function lineCount(text) {
    return text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length;
}
