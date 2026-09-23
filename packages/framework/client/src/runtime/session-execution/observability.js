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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createObservabilitySurface = createObservabilitySurface;
var runtime_status_1 = require("@natalia/runtime-status");
function observabilityExec(ctx, sessionID) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: 
                // Session snapshots may be the first routed call on a workspace proxy.
                return [4 /*yield*/, ctx.ports.ensureReady()];
                case 1:
                    // Session snapshots may be the first routed call on a workspace proxy.
                    _c.sent();
                    if (!sessionID) return [3 /*break*/, 5];
                    if (!((_b = ctx.ports
                        .getExecutionBySession()
                        .get(sessionID)) !== null && _b !== void 0)) return [3 /*break*/, 2];
                    _a = _b;
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, ctx.ports.ensureExecution(sessionID)];
                case 3:
                    _a = (_c.sent());
                    _c.label = 4;
                case 4: return [2 /*return*/, (_a)];
                case 5: return [2 /*return*/, ctx.ports.getActiveExec()];
            }
        });
    });
}
function createObservabilitySurface(ctx, options) {
    return {
        runtimeStatus: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, status, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.ensureReady()];
                        case 1:
                            _b.sent();
                            return [4 /*yield*/, observabilityExec(ctx, sessionID)];
                        case 2:
                            exec = _b.sent();
                            if (!!exec) return [3 /*break*/, 4];
                            return [4 /*yield*/, ctx.ports.runtimeStatusSnapshot()];
                        case 3: return [2 /*return*/, _b.sent()];
                        case 4:
                            status = ctx.state.serviceDirectory.get(runtime_status_1.statusSnapshotController);
                            _a = [{}];
                            return [4 /*yield*/, status.snapshotFor({
                                    provider: exec.provider,
                                    context: exec.context,
                                    permissionMode: exec.permissionMode,
                                })];
                        case 5: return [2 /*return*/, __assign.apply(void 0, [__assign.apply(void 0, _a.concat([(_b.sent())])), { sessionID: exec.session.id }])];
                    }
                });
            });
        },
        diagnostics: function () {
            return __awaiter(this, arguments, void 0, function (limit, sessionID) {
                var exec, entries;
                var _a;
                if (limit === void 0) { limit = 100; }
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            return [4 /*yield*/, observabilityExec(ctx, sessionID)];
                        case 2:
                            exec = _b.sent();
                            entries = exec
                                ? __spreadArray(__spreadArray([], ctx.ports.getRuntimeDiagnostics(), true), ((_a = ctx.ports
                                    .getRuntimeDiagnosticsBySession()
                                    .get(exec.session.id)) !== null && _a !== void 0 ? _a : []), true) : ctx.ports.getRuntimeDiagnostics();
                            return [2 /*return*/, entries.slice(-Math.min(500, Math.max(1, limit)))];
                    }
                });
            });
        },
        sessionSnapshot: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, observabilityExec(ctx, sessionID)];
                        case 1:
                            exec = _a.sent();
                            if (!exec)
                                return [2 /*return*/, undefined];
                            return [2 /*return*/, ctx.ports.currentSessionSnapshot(exec, "snapshot:live:".concat(exec.session.id))];
                    }
                });
            });
        },
    };
}
