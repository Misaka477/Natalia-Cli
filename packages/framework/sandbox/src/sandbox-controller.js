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
exports.createSandboxController = createSandboxController;
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var snapshot_sandbox_1 = require("./snapshot-sandbox");
var worktree_sandbox_1 = require("./worktree-sandbox");
function createSandboxController(input) {
    var _this = this;
    var manager;
    var initializing;
    var closed = false;
    function init() {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (closed)
                            throw new Error("sandbox controller is closed");
                        if (manager)
                            return [2 /*return*/];
                        // Our own git-free snapshot backend is the default; the worktree backend
                        // (real git, for history integration) is a per-project opt-in that needs a
                        // git repo. Both extend the shared operational surface the sandbox tools
                        // call.
                        if (!initializing)
                            initializing = (function () { return __awaiter(_this, void 0, void 0, function () {
                                var isGitRepo, next;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            isGitRepo = (0, node_fs_1.existsSync)((0, node_path_1.join)(input.workspaceRoot, ".git")) ||
                                                (0, node_fs_1.existsSync)((0, node_path_1.join)(input.workspaceRoot, ".git", "HEAD"));
                                            next = ((_a = input.backend) === null || _a === void 0 ? void 0 : _a.call(input)) === "worktree" && isGitRepo
                                                ? new worktree_sandbox_1.WorktreeSandboxManager(input.workspaceRoot)
                                                : new snapshot_sandbox_1.SnapshotSandboxManager(input.workspaceRoot);
                                            return [4 /*yield*/, next.initialize()];
                                        case 1:
                                            _b.sent();
                                            if (!closed) return [3 /*break*/, 3];
                                            return [4 /*yield*/, next.close()];
                                        case 2:
                                            _b.sent();
                                            return [3 /*break*/, 4];
                                        case 3:
                                            manager = next;
                                            _b.label = 4;
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); })();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, initializing];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        initializing = undefined;
                        return [7 /*endfinally*/];
                    case 4:
                        if (closed)
                            throw new Error("sandbox controller is closed");
                        return [2 /*return*/];
                }
            });
        });
    }
    function requireManager() {
        if (!manager)
            throw new Error("sandbox manager is not initialized");
        return manager;
    }
    return {
        init: init,
        create: function (id) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().create(id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        list: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().list()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        execute: function (id, command, options) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().execute(id, command, options)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        write: function (id, path, content, mode) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().write(id, path, content, mode)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        previewMerge: function (id) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().previewMerge(id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        merge: function (id, hostRoot, authorize) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().merge(id, hostRoot, authorize)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        promoteWithValidation: function (id, promoteInput) { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, requireManager().promoteWithValidation(id, __assign(__assign({}, promoteInput), { hostRoot: (_a = promoteInput.hostRoot) !== null && _a !== void 0 ? _a : input.workspaceRoot }))];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        }); },
        delete: function (id) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().delete(id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        rollback: function (id) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().rollback(id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        startResource: function (id, command, resourceID) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().startResource(id, command, resourceID)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        resourcesFor: function (id) { return requireManager().resourcesFor(id); },
        resourceOutput: function (id, resourceID, maxBytes) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().resourceOutput(id, resourceID, maxBytes)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        stopResource: function (id, resourceID) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().stopResource(id, resourceID)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        validate: function (id, command) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireManager().validate(id, command)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        updateEvent: function (id) { return requireManager().updateEvent(id); },
        diffEvent: function (id) { return requireManager().diffEvent(id); },
        auditEvent: function (id, action, approvalRequired) {
            return requireManager().auditEvent(id, action, approvalRequired);
        },
        close: function () {
            return __awaiter(this, void 0, void 0, function () {
                var current;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (closed)
                                return [2 /*return*/];
                            closed = true;
                            return [4 /*yield*/, initializing];
                        case 1:
                            _a.sent();
                            current = manager;
                            manager = undefined;
                            return [4 /*yield*/, (current === null || current === void 0 ? void 0 : current.close())];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        referencedObjectIDs: function () {
            return __awaiter(this, void 0, void 0, function () {
                var current, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            current = requireManager();
                            if (!(current instanceof snapshot_sandbox_1.SnapshotSandboxManager)) return [3 /*break*/, 2];
                            return [4 /*yield*/, current.referencedObjectIDs()];
                        case 1:
                            _a = _b.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            _a = undefined;
                            _b.label = 3;
                        case 3: return [2 /*return*/, _a];
                    }
                });
            });
        },
        runningResourceCount: function () {
            var _a;
            return (_a = manager === null || manager === void 0 ? void 0 : manager.runningResourceCount()) !== null && _a !== void 0 ? _a : 0;
        },
    };
}
