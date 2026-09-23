"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebWorkerPool = createWebWorkerPool;
exports.defaultWorkerPoolSize = defaultWorkerPoolSize;
function createWebWorkerPool(factory, size) {
    var workers = [];
    var next = 0;
    function ensureWorkers() {
        var _a, _b;
        while (workers.length < size) {
            var worker = factory();
            // In the browser `unref` is absent; in the Bun runtime an idle worker
            // must not keep the process alive past a graceful shutdown.
            (_b = (_a = worker).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
            workers.push(worker);
        }
    }
    return {
        worker: function () {
            if (!workers.length)
                ensureWorkers();
            var worker = workers[next++ % workers.length];
            return worker;
        },
        all: function () {
            if (!workers.length)
                ensureWorkers();
            return workers;
        },
        size: function () {
            return workers.length || size;
        },
    };
}
function defaultWorkerPoolSize() {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
        return Math.max(2, Math.min(4, navigator.hardwareConcurrency));
    }
    return 2;
}
