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
exports.createRuntimeDaemonStore = createRuntimeDaemonStore;
exports.daemonToken = daemonToken;
exports.registerRuntimeDaemon = registerRuntimeDaemon;
exports.readRuntimeDaemonRegistration = readRuntimeDaemonRegistration;
exports.runtimeDaemonStatus = runtimeDaemonStatus;
exports.stopRuntimeDaemon = stopRuntimeDaemon;
exports.spawnRuntimeDaemon = spawnRuntimeDaemon;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_child_process_1 = require("node:child_process");
function createRuntimeDaemonStore(input) {
    var _a;
    var dir = (0, node_path_1.resolve)(input.dir);
    return {
        dir: dir,
        registrationPath: (0, node_path_1.resolve)(dir, "daemon.json"),
        tokenPath: (0, node_path_1.resolve)(dir, "token"),
        version: (_a = input.version) !== null && _a !== void 0 ? _a : "0.0.0-ts7",
    };
}
function daemonToken(store) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1, token;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readFile)(store.tokenPath, "utf8")];
                case 1: return [2 /*return*/, (_a.sent()).trim()];
                case 2:
                    error_1 = _a.sent();
                    if (error_1.code !== "ENOENT")
                        throw error_1;
                    return [3 /*break*/, 3];
                case 3:
                    token = (0, node_crypto_1.randomBytes)(32).toString("base64url");
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(store.tokenPath), { recursive: true, mode: 448 })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)(store.tokenPath, "".concat(token, "\n"), { mode: 384 })];
                case 5:
                    _a.sent();
                    return [2 /*return*/, token];
            }
        });
    });
}
function registerRuntimeDaemon(store, input) {
    return __awaiter(this, void 0, void 0, function () {
        var registration;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    registration = __assign(__assign({}, input), { version: store.version, tokenFile: store.tokenPath, createdAt: new Date().toISOString() });
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(store.registrationPath), {
                            recursive: true,
                            mode: 448,
                        })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)(store.registrationPath, "".concat(JSON.stringify(registration, null, 2), "\n"), {
                            mode: 384,
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, registration];
            }
        });
    });
}
function readRuntimeDaemonRegistration(store) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, error_2;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(store.registrationPath, "utf8")];
                case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                case 2:
                    error_2 = _c.sent();
                    if (error_2.code === "ENOENT")
                        return [2 /*return*/, undefined];
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function runtimeDaemonStatus(store) {
    return __awaiter(this, void 0, void 0, function () {
        var registration;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readRuntimeDaemonRegistration(store)];
                case 1:
                    registration = _a.sent();
                    if (!registration)
                        return [2 /*return*/, { state: "missing" }];
                    if (registration.version !== store.version)
                        return [2 /*return*/, { state: "incompatible", registration: registration }];
                    if (!!isProcessRunning(registration.pid)) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, promises_1.rm)(store.registrationPath, { force: true })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, { state: "stale", registration: registration }];
                case 3: return [2 /*return*/, { state: "running", registration: registration }];
            }
        });
    });
}
function stopRuntimeDaemon(store) {
    return __awaiter(this, void 0, void 0, function () {
        var registration;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readRuntimeDaemonRegistration(store)];
                case 1:
                    registration = _a.sent();
                    if (!registration)
                        return [2 /*return*/, { stopped: false, reason: "missing" }];
                    if (isProcessRunning(registration.pid))
                        process.kill(registration.pid, "SIGTERM");
                    return [4 /*yield*/, (0, promises_1.rm)(store.registrationPath, { force: true })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, { stopped: true, pid: registration.pid }];
            }
        });
    });
}
function spawnRuntimeDaemon(input) {
    var _a;
    if (input.command.length === 0)
        throw new Error("daemon command is empty");
    var child = (0, node_child_process_1.spawn)(input.command[0], input.command.slice(1), {
        cwd: input.cwd,
        detached: true,
        stdio: "ignore",
        env: cleanEnv((_a = input.env) !== null && _a !== void 0 ? _a : process.env),
    });
    child.unref();
    if (!child.pid)
        throw new Error("daemon process did not expose a pid");
    return child.pid;
}
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (_a) {
        return false;
    }
}
function cleanEnv(env) {
    return Object.fromEntries(Object.entries(env).filter(function (entry) { return typeof entry[1] === "string"; }));
}
