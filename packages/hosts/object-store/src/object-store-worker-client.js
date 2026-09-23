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
exports.runObjectStoreMaintenance = runObjectStoreMaintenance;
var nextID = 1;
var pending = new Map();
var workers = [];
var nextWorker = 0;
function poolWorker() {
    var _a, _b;
    var hardwareConcurrency = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0;
    var cpus = hardwareConcurrency || 2;
    var size = Math.max(2, Math.min(4, cpus));
    while (workers.length < size) {
        var instance = new Worker(new URL("./maintenance.worker.ts", import.meta.url), { type: "module" });
        instance.addEventListener("message", function (event) {
            var response = event.data;
            var entry = pending.get(response.id);
            if (!entry)
                return;
            pending.delete(response.id);
            if (response.ok)
                entry.resolve(response.result);
            else
                entry.reject(new Error(response.error));
        });
        instance.addEventListener("error", function () {
            for (var _i = 0, _a = pending.values(); _i < _a.length; _i++) {
                var reject = _a[_i].reject;
                reject(new Error("object-store worker failed"));
            }
            pending.clear();
        });
        // Idle workers must not pin the process; the host owns liveness.
        (_b = (_a = instance).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
        workers.push(instance);
    }
    return workers[nextWorker++ % workers.length];
}
function runObjectStoreMaintenance(request) {
    var id = nextID++;
    var instance = poolWorker();
    return new Promise(function (resolve, reject) {
        pending.set(id, {
            resolve: function (result) { return resolve(result); },
            reject: reject,
        });
        instance.postMessage(__assign(__assign({}, request), { id: id }));
    });
}
