"use strict";
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
var bun_test_1 = require("bun:test");
var index_1 = require("../src/index");
(0, bun_test_1.describe)("normalizeLinkTarget", function () {
    (0, bun_test_1.test)("leaves a POSIX target untouched", function () {
        (0, bun_test_1.expect)((0, index_1.normalizeLinkTarget)("dir/target.txt", "linux")).toBe("dir/target.txt");
        (0, bun_test_1.expect)((0, index_1.normalizeLinkTarget)("../outside", "linux")).toBe("../outside");
        (0, bun_test_1.expect)((0, index_1.normalizeLinkTarget)("C:\\literal\\posix\\name", "linux")).toBe("C:\\literal\\posix\\name");
    });
    (0, bun_test_1.test)("strips the Windows extended-length prefix and normalises separators", function () {
        (0, bun_test_1.expect)((0, index_1.normalizeLinkTarget)("\\\\?\\C:\\work\\dir\\target.txt", "win32")).toBe("C:/work/dir/target.txt");
        (0, bun_test_1.expect)((0, index_1.normalizeLinkTarget)("dir\\target.txt", "win32")).toBe("dir/target.txt");
    });
});
(0, bun_test_1.describe)("createSymlink", function () {
    (0, bun_test_1.test)("POSIX passes no link type, preserving the previous call", function () { return __awaiter(void 0, void 0, void 0, function () {
        var calls;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    calls = [];
                    return [4 /*yield*/, (0, index_1.createSymlink)("dir/target.txt", "/work/link.txt", {
                            os: "linux",
                            targetIsDirectory: true,
                            symlink: function (target, path, type) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    calls.push([target, path, type]);
                                    return [2 /*return*/];
                                });
                            }); },
                        })];
                case 1:
                    _a.sent();
                    (0, bun_test_1.expect)(calls).toEqual([["dir/target.txt", "/work/link.txt", undefined]]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)("Windows requests a junction for a directory target", function () { return __awaiter(void 0, void 0, void 0, function () {
        var calls;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    calls = [];
                    return [4 /*yield*/, (0, index_1.createSymlink)("dir", "C:\\work\\link", {
                            os: "win32",
                            targetIsDirectory: true,
                            symlink: function (target, path, type) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    calls.push([target, path, type]);
                                    return [2 /*return*/];
                                });
                            }); },
                        })];
                case 1:
                    _a.sent();
                    // A junction is the only directory link an unelevated Windows process can
                    // create, and it also keeps the link a directory rather than a broken file.
                    (0, bun_test_1.expect)(calls).toEqual([["dir", "C:\\work\\link", "junction"]]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)("Windows requests a file link for a file target", function () { return __awaiter(void 0, void 0, void 0, function () {
        var calls;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    calls = [];
                    return [4 /*yield*/, (0, index_1.createSymlink)("dir\\target.txt", "C:\\work\\link.txt", {
                            os: "win32",
                            targetIsDirectory: false,
                            symlink: function (target, path, type) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    calls.push([target, path, type]);
                                    return [2 /*return*/];
                                });
                            }); },
                        })];
                case 1:
                    _a.sent();
                    (0, bun_test_1.expect)(calls).toEqual([["dir\\target.txt", "C:\\work\\link.txt", "file"]]);
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, bun_test_1.describe)("forceRemove", function () {
    (0, bun_test_1.test)("POSIX removes once and never clears a mode", function () { return __awaiter(void 0, void 0, void 0, function () {
        var removals, chmodCalls;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    removals = [];
                    chmodCalls = 0;
                    return [4 /*yield*/, (0, index_1.forceRemove)("/work/file.txt", {
                            os: "linux",
                            recursive: true,
                            rm: function (path, options) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    removals.push({ path: path, recursive: options.recursive });
                                    return [2 /*return*/];
                                });
                            }); },
                            chmod: function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    chmodCalls += 1;
                                    return [2 /*return*/];
                                });
                            }); },
                        })];
                case 1:
                    _a.sent();
                    (0, bun_test_1.expect)(removals).toEqual([{ path: "/work/file.txt", recursive: true }]);
                    (0, bun_test_1.expect)(chmodCalls).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)("POSIX propagates EPERM without retrying", function () { return __awaiter(void 0, void 0, void 0, function () {
        var attempts, failure;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    attempts = 0;
                    failure = Object.assign(new Error("denied"), { code: "EPERM" });
                    return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.forceRemove)("/work/file.txt", {
                            os: "linux",
                            rm: function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    attempts += 1;
                                    throw failure;
                                });
                            }); },
                        })).rejects.toThrow("denied")];
                case 1:
                    _a.sent();
                    (0, bun_test_1.expect)(attempts).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)("Windows clears the read-only attribute and retries once", function () { return __awaiter(void 0, void 0, void 0, function () {
        var attempts, chmods;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    attempts = 0;
                    chmods = [];
                    return [4 /*yield*/, (0, index_1.forceRemove)("C:\\work\\file.txt", {
                            os: "win32",
                            rm: function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    attempts += 1;
                                    if (attempts === 1)
                                        throw Object.assign(new Error("denied"), { code: "EPERM" });
                                    return [2 /*return*/];
                                });
                            }); },
                            chmod: function (path, mode) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    chmods.push([path, mode]);
                                    return [2 /*return*/];
                                });
                            }); },
                        })];
                case 1:
                    _a.sent();
                    (0, bun_test_1.expect)(attempts).toBe(2);
                    (0, bun_test_1.expect)(chmods).toEqual([["C:\\work\\file.txt", 438]]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)("Windows retries transient lock failures then rethrows", function () { return __awaiter(void 0, void 0, void 0, function () {
        var attempts;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    attempts = 0;
                    return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.forceRemove)("C:\\work\\file.txt", {
                            os: "win32",
                            rm: function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    attempts += 1;
                                    throw Object.assign(new Error("busy"), { code: "EBUSY" });
                                });
                            }); },
                        })).rejects.toThrow("busy")];
                case 1:
                    _a.sent();
                    // EBUSY/EACCES are transient locks (a just-exited child or an in-flight
                    // reader), so removal is retried with a backoff before giving up.
                    (0, bun_test_1.expect)(attempts).toBe(10);
                    return [2 /*return*/];
            }
        });
    }); });
});
