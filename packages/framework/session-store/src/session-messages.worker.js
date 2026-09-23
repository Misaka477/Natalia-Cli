"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var node_worker_threads_1 = require("node:worker_threads");
var session_1 = require("@anthelia/session");
var port = node_worker_threads_1.parentPort;
if (!port)
    throw new Error("session-messages worker requires parentPort");
port.on("message", function (request) {
    try {
        var page = (0, session_1.projectSessionMessages)(request.session, request.options);
        var response = {
            id: request.id,
            ok: true,
            page: page,
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
