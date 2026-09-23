"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDiffInWorker = computeDiffInWorker;
exports.computeDiffInWorkerStream = computeDiffInWorkerStream;
var worker_pool_1 = require("./worker-pool");
var nextID = 1;
var pending = new Map();
var streaming = new Map();
function handleWorkerMessage(event) {
    var response = event.data;
    var single = pending.get(response.id);
    if (single) {
        pending.delete(response.id);
        if (response.ok && "result" in response) {
            single.resolve(response.result);
        }
        else if (response.ok) {
            single.reject(new Error("unexpected stream response"));
        }
        else {
            single.reject(new Error(response.error));
        }
        return;
    }
    var stream = streaming.get(response.id);
    if (!stream)
        return;
    if (!response.ok) {
        streaming.delete(response.id);
        stream.reject(new Error(response.error));
        return;
    }
    if (!("stream" in response && response.stream))
        return;
    if (response.kind === "start")
        return;
    if (response.kind === "hunk") {
        stream.onHunk(response.hunk);
        return;
    }
    if (response.kind === "done") {
        streaming.delete(response.id);
        stream.resolve(response);
    }
}
function handleWorkerError() {
    for (var _i = 0, _a = pending.values(); _i < _a.length; _i++) {
        var reject = _a[_i].reject;
        reject(new Error("diff worker failed"));
    }
    pending.clear();
    for (var _b = 0, _c = streaming.values(); _b < _c.length; _b++) {
        var reject = _c[_b].reject;
        reject(new Error("diff worker failed"));
    }
    streaming.clear();
}
var diffPool = (0, worker_pool_1.createWebWorkerPool)(function () {
    return new Worker(new URL("./diff-worker.ts", import.meta.url), {
        type: "module",
    });
}, (0, worker_pool_1.defaultWorkerPoolSize)());
function ensureWorkers() {
    for (var _i = 0, _a = diffPool.all(); _i < _a.length; _i++) {
        var worker = _a[_i];
        // Message/error listeners are attached once on first pool creation.
        if (!("__nataliaDiffListener" in worker)) {
            worker.addEventListener("message", handleWorkerMessage);
            worker.addEventListener("error", handleWorkerError);
            worker.__nataliaDiffListener = true;
        }
    }
}
/**
 * Runs a structured diff (`@natalia/diff-wasm` + parseDiffBinary) inside a
 * dedicated Web Worker. The main thread only receives the already-parsed
 * `StructuredDiffResult`.
 */
function computeDiffInWorker(oldText, newText) {
    var id = nextID++;
    ensureWorkers();
    var instance = diffPool.worker();
    return new Promise(function (resolve, reject) {
        pending.set(id, { resolve: resolve, reject: reject });
        var request = {
            id: id,
            oldText: oldText,
            newText: newText,
        };
        instance.postMessage(request);
    });
}
/**
 * Streaming variant: hunks are posted one-by-one from the Worker so a large
 * diff can be rendered incrementally without waiting for the full result.
 */
function computeDiffInWorkerStream(oldText, newText, onHunk) {
    var id = nextID++;
    ensureWorkers();
    var instance = diffPool.worker();
    return new Promise(function (resolve, reject) {
        streaming.set(id, { onHunk: onHunk, resolve: resolve, reject: reject });
        var request = {
            id: id,
            oldText: oldText,
            newText: newText,
            stream: true,
        };
        instance.postMessage(request);
    });
}
