"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectSessionMessagesInWorker = projectSessionMessagesInWorker;
var nextID = 1;
var pending = new Map();
var workers = [];
var nextWorker = 0;
function poolWorker() {
    var _a, _b, _c;
    var size = Math.max(2, Math.min(4, Number((_a = process.env.NATALIA_SESSION_MESSAGES_WORKERS) !== null && _a !== void 0 ? _a : 2)));
    while (workers.length < size) {
        var instance = new Worker(new URL("./session-messages.worker.ts", import.meta.url), { type: "module" });
        instance.addEventListener("message", function (event) {
            var response = event.data;
            var entry = pending.get(response.id);
            if (!entry)
                return;
            pending.delete(response.id);
            if (response.ok)
                entry.resolve(response.page);
            else
                entry.reject(new Error(response.error));
        });
        instance.addEventListener("error", function () {
            for (var _i = 0, _a = pending.values(); _i < _a.length; _i++) {
                var reject = _a[_i].reject;
                reject(new Error("session-messages worker failed"));
            }
            pending.clear();
        });
        // Idle workers must not pin the process; the host owns liveness.
        (_c = (_b = instance).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
        workers.push(instance);
    }
    return workers[nextWorker++ % workers.length];
}
function projectSessionMessagesInWorker(session, options) {
    var id = nextID++;
    var instance = poolWorker();
    return new Promise(function (resolve, reject) {
        pending.set(id, { resolve: resolve, reject: reject });
        var request = { id: id, session: session, options: options };
        instance.postMessage(request);
    });
}
