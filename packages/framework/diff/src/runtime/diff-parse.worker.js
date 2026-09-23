"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var node_worker_threads_1 = require("node:worker_threads");
var structured_parse_1 = require("../structured-parse");
var port = node_worker_threads_1.parentPort;
if (!port)
    throw new Error("diff-parse worker requires parentPort");
port.on("message", function (request) {
    try {
        var result = request.op === "patch"
            ? {
                counts: (0, structured_parse_1.countPatch)(request.patch),
                structured: (0, structured_parse_1.patchToStructured)(request.patch),
            }
            : (0, structured_parse_1.diffToChanges)(request.rawDiff);
        var response = {
            id: request.id,
            ok: true,
            result: result,
        };
        port.postMessage(response);
    }
    catch (error) {
        var response = {
            id: request.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
        port.postMessage(response);
    }
});
