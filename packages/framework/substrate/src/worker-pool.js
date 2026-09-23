"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRuntimeWorkerPool = createRuntimeWorkerPool;
exports.defaultRuntimeWorkerPoolSize = defaultRuntimeWorkerPoolSize;
function createRuntimeWorkerPool(factory, size) {
    var workers = [];
    var next = 0;
    function ensureWorkers() {
        var _a, _b;
        while (workers.length < size) {
            var worker = factory();
            // An idle worker must not keep the runtime process alive: the server/
            // host handle owns liveness, and graceful shutdown closes those. Without
            // this the process hangs after dispose until the shutdown watchdog.
            (_b = (_a = worker).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
            workers.push(worker);
        }
    }
    return {
        worker: function () {
            if (!workers.length)
                ensureWorkers();
            return workers[next++ % workers.length];
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
function defaultRuntimeWorkerPoolSize() {
    var cpus = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0;
    var cpuCount = cpus || 2;
    return Math.max(2, Math.min(4, cpuCount));
}
