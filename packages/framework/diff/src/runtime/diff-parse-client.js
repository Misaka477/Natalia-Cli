"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePatchInWorker = parsePatchInWorker;
exports.diffChangesInWorker = diffChangesInWorker;
var nextID = 1;
var pending = new Map();
var workers = [];
var nextWorker = 0;
function poolWorker() {
    var _a, _b, _c;
    var size = Math.max(2, Math.min(4, Number((_a = process.env.NATALIA_DIFF_PARSE_WORKERS) !== null && _a !== void 0 ? _a : 2)));
    while (workers.length < size) {
        var instance = new Worker(new URL("./diff-parse.worker.ts", import.meta.url), { type: "module" });
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
                reject(new Error("diff-parse worker failed"));
            }
            pending.clear();
        });
        // Idle workers must not pin the process; the host owns liveness.
        (_c = (_b = instance).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
        workers.push(instance);
    }
    return workers[nextWorker++ % workers.length];
}
function parsePatchInWorker(patch) {
    var id = nextID++;
    var instance = poolWorker();
    return new Promise(function (resolve, reject) {
        pending.set(id, { resolve: function (value) { return resolve(value); }, reject: reject });
        var request = { id: id, op: "patch", patch: patch };
        instance.postMessage(request);
    });
}
function diffChangesInWorker(rawDiff) {
    var id = nextID++;
    var instance = poolWorker();
    return new Promise(function (resolve, reject) {
        pending.set(id, { resolve: function (value) { return resolve(value); }, reject: reject });
        var request = { id: id, op: "diffChanges", rawDiff: rawDiff };
        instance.postMessage(request);
    });
}
