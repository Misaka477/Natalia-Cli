"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.highlightInWorker = highlightInWorker;
exports.highlightInWorkerBatch = highlightInWorkerBatch;
var worker_pool_1 = require("./worker-pool");
var nextID = 1;
var pending = new Map();
var pool = (0, worker_pool_1.createWebWorkerPool)(function () {
    var instance = new Worker(new URL("./syntax-worker.ts", import.meta.url), {
        type: "module",
    });
    instance.addEventListener("message", function (event) {
        var response = event.data;
        var entry = pending.get(response.id);
        if (!entry)
            return;
        pending.delete(response.id);
        if (response.ok)
            entry.resolve(response.parts);
        else
            entry.reject(new Error(response.error));
    });
    instance.addEventListener("error", function () {
        for (var _i = 0, _a = pending.values(); _i < _a.length; _i++) {
            var reject = _a[_i].reject;
            reject(new Error("syntax worker failed"));
        }
        pending.clear();
    });
    return instance;
}, (0, worker_pool_1.defaultWorkerPoolSize)());
function highlightInWorker(text, language) {
    var id = nextID++;
    var instance = pool.worker();
    return new Promise(function (resolve, reject) {
        pending.set(id, { resolve: resolve, reject: reject });
        var request = { id: id, text: text, language: language };
        instance.postMessage(request);
    });
}
function highlightInWorkerBatch(lines) {
    return Promise.all(lines.map(function (_a) {
        var text = _a.text, language = _a.language;
        return highlightInWorker(text, language);
    }));
}
