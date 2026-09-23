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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectSessionInWorker = projectSessionInWorker;
exports.projectSessionMessagesInWorker = projectSessionMessagesInWorker;
exports.projectedCanonicalToolsInWorker = projectedCanonicalToolsInWorker;
exports.prepareSessionRecoveryContextInWorker = prepareSessionRecoveryContextInWorker;
exports.computeCollabSnapshotInWorker = computeCollabSnapshotInWorker;
exports.subagentHistoryInWorker = subagentHistoryInWorker;
exports.modelCatalogInWorker = modelCatalogInWorker;
exports.runSessionProjectionInWorker = runSessionProjectionInWorker;
var worker_pool_1 = require("./worker-pool");
var nextID = 1;
var pending = new Map();
function onMessage(event) {
    var response = event.data;
    var entry = pending.get(response.id);
    if (!entry)
        return;
    pending.delete(response.id);
    if (response.ok)
        entry.resolve(response.result);
    else
        entry.reject(new Error(response.error));
}
function onWorkerError() {
    for (var _i = 0, _a = pending.values(); _i < _a.length; _i++) {
        var reject = _a[_i].reject;
        reject(new Error("session-project worker failed"));
    }
    pending.clear();
}
var pool = (0, worker_pool_1.createRuntimeWorkerPool)(function () {
    var instance = new Worker(new URL("./session-project.worker.ts", import.meta.url), { type: "module" });
    instance.addEventListener("message", onMessage);
    instance.addEventListener("error", onWorkerError);
    return instance;
}, (0, worker_pool_1.defaultRuntimeWorkerPoolSize)());
function run(request) {
    return __awaiter(this, void 0, void 0, function () {
        var id, instance;
        return __generator(this, function (_a) {
            id = nextID++;
            instance = pool.worker();
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    pending.set(id, {
                        resolve: function (value) { return resolve(value); },
                        reject: reject,
                    });
                    instance.postMessage(__assign(__assign({}, request), { id: id }));
                })];
        });
    });
}
function projectSessionInWorker(session) {
    return run({ op: "project", session: session });
}
function projectSessionMessagesInWorker(session, options) {
    return run({ op: "messages", session: session, options: options });
}
function projectedCanonicalToolsInWorker(events) {
    return run({ op: "canonicalTools", events: events });
}
function prepareSessionRecoveryContextInWorker(events) {
    return run({ op: "recoveryPrepare", events: events });
}
function computeCollabSnapshotInWorker(events) {
    return run({
        op: "collabSnapshot",
        events: events,
    });
}
function subagentHistoryInWorker(events) {
    return run({
        op: "subagentHistory",
        events: events,
    });
}
function modelCatalogInWorker(config) {
    return run({
        op: "modelCatalog",
        config: config,
    });
}
function runSessionProjectionInWorker(name, events) {
    return run({ op: "projection", name: name, events: events });
}
