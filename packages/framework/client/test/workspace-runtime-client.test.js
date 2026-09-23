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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_crypto_1 = require("node:crypto");
var session_1 = require("@anthelia/session");
var workspace_manager_1 = require("../src/workspace-manager");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
function emptyManager() {
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, []];
                });
            });
        },
        listSessions: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, []];
                });
            });
        },
        findWorkspaceForSession: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, undefined];
                });
            });
        },
        invalidateSessionCache: function () { },
        add: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw new Error("unused");
                });
            });
        },
        remove: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, { removed: true }];
                });
            });
        },
        activate: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw new Error("unused");
                });
            });
        },
        load: function () {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/];
            }); });
        },
        workspaceRoots: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, []];
                });
            });
        },
        workspaceAdd: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw new Error("unused");
                });
            });
        },
        workspaceRemove: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, { removed: true }];
                });
            });
        },
        workspaceActivate: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw new Error("unused");
                });
            });
        },
        get: function () {
            return undefined;
        },
        getActive: function () {
            return undefined;
        },
        summaryFor: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw new Error("unused");
                });
            });
        },
        workspacePermissionGet: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw new Error("unused");
                });
            });
        },
        workspacePermissionSet: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw new Error("unused");
                });
            });
        },
        workspaceToolGet: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw new Error("unused");
                });
            });
        },
        workspaceSessionGet: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, undefined];
                });
            });
        },
        workspaceSessionSet: function () {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/];
            }); });
        },
        workspaceToolSet: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw new Error("unused");
                });
            });
        },
        dispose: function () {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/];
            }); });
        },
    };
}
(0, bun_test_1.test)("workspace proxy throws when native terminal is used without an active workspace", function () { return __awaiter(void 0, void 0, void 0, function () {
    var client;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                client = (0, workspace_manager_1.createWorkspaceRuntimeClient)(emptyManager());
                return [4 /*yield*/, (0, bun_test_1.expect)((_a = client.nativeTerminalStart) === null || _a === void 0 ? void 0 : _a.call(client, { command: "bash" })).rejects.toThrow("no active workspace")];
            case 1:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
var _loop_1 = function (useSqliteStore) {
    (0, bun_test_1.test)("workspace restores selected session and preserves selection on settings updates (".concat(useSqliteStore ? "sqlite" : "json", ")"), function () { return __awaiter(void 0, void 0, void 0, function () {
        var root, previousRegistry, options, manager, store, old, recent, settingsPath, workspace, client, _a, _b, _c, _d, restored, _e, _f, _g, _h, _j, _k, _l;
        var _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
        return __generator(this, function (_1) {
            switch (_1.label) {
                case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-restore")];
                case 1:
                    root = _1.sent();
                    previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                    process.env.NATALIA_WORKSPACES_FILE = (0, node_path_1.join)(root, "workspaces.json");
                    options = {
                        pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(root),
                        globalConfigPath: (0, node_path_1.join)(root, "global-config.json"),
                        useSqliteStore: useSqliteStore,
                    };
                    manager = (0, workspace_manager_1.createWorkspaceManager)(options);
                    _1.label = 2;
                case 2:
                    _1.trys.push([2, , 19, 21]);
                    store = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                    old = (0, session_1.createSessionRecord)("ses_old", "Old pinned");
                    old.metadata = { pinned: true, lastAccessedAt: "2026-01-01T00:00:00Z" };
                    recent = (0, session_1.createSessionRecord)("ses_recent", "Recent");
                    recent.metadata = { lastAccessedAt: "2026-08-01T00:00:00Z" };
                    recent.events.push({
                        type: "navi.chat.message.added",
                        id: "navi_added",
                        messageID: "navi_saved",
                        role: "chat",
                        text: "Navi restored",
                        at: "2026-08-01T00:00:00Z",
                    }, {
                        type: "nia.chat.message.added",
                        id: "nia_added",
                        messageID: "nia_saved",
                        role: "chat",
                        text: "Nia restored",
                        at: "2026-08-01T00:00:00Z",
                    });
                    return [4 /*yield*/, store.save(old)];
                case 3:
                    _1.sent();
                    return [4 /*yield*/, store.save(recent)];
                case 4:
                    _1.sent();
                    settingsPath = (0, node_path_1.join)(root, ".natalia", "workspace-settings.json");
                    return [4 /*yield*/, (0, promises_1.writeFile)(settingsPath, JSON.stringify({ activeSessionID: old.id }))];
                case 5:
                    _1.sent();
                    return [4 /*yield*/, manager.add({ path: root })];
                case 6:
                    workspace = _1.sent();
                    client = (0, workspace_manager_1.createWorkspaceRuntimeClient)(manager);
                    _a = bun_test_1.expect;
                    return [4 /*yield*/, ((_m = client.runtimeStatus) === null || _m === void 0 ? void 0 : _m.call(client))];
                case 7:
                    _a.apply(void 0, [(_o = (_1.sent())) === null || _o === void 0 ? void 0 : _o.sessionID]).toBe(old.id);
                    return [4 /*yield*/, ((_p = client.sessionAttach) === null || _p === void 0 ? void 0 : _p.call(client, recent.id))];
                case 8:
                    _1.sent();
                    return [4 /*yield*/, Promise.all([
                            manager.workspacePermissionSet(workspace.workspaceID, {
                                permissionProfile: "default",
                                approval: "ask",
                            }),
                            manager.workspaceToolSet(workspace.workspaceID, {
                                enabledTools: [],
                                disabledTools: ["bash"],
                            }),
                            manager.workspaceSessionSet(workspace.workspaceID, recent.id),
                        ])];
                case 9:
                    _1.sent();
                    _b = bun_test_1.expect;
                    _d = (_c = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(settingsPath, "utf8")];
                case 10:
                    _b.apply(void 0, [_d.apply(_c, [_1.sent()]).activeSessionID]).toBe(recent.id);
                    restored = manager.get(workspace.workspaceID).client;
                    _e = bun_test_1.expect;
                    return [4 /*yield*/, ((_r = (_q = restored.naviChat) === null || _q === void 0 ? void 0 : _q.messages) === null || _r === void 0 ? void 0 : _r.call(_q))];
                case 11:
                    _e.apply(void 0, [(_s = (_1.sent())) === null || _s === void 0 ? void 0 : _s.map(function (row) { return row.text; })]).toEqual(["Navi restored"]);
                    _f = bun_test_1.expect;
                    return [4 /*yield*/, ((_u = (_t = restored.niaChat) === null || _t === void 0 ? void 0 : _t.messages) === null || _u === void 0 ? void 0 : _u.call(_t))];
                case 12:
                    _f.apply(void 0, [(_v = (_1.sent())) === null || _v === void 0 ? void 0 : _v.map(function (row) { return row.text; })]).toEqual(["Nia restored"]);
                    _g = bun_test_1.expect;
                    _j = (_h = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(settingsPath, "utf8")];
                case 13:
                    _g.apply(void 0, [_j.apply(_h, [_1.sent()]).toolSettings
                            .disabledTools]).toEqual(["bash"]);
                    return [4 /*yield*/, (0, bun_test_1.expect)((_w = client.sessionAttach) === null || _w === void 0 ? void 0 : _w.call(client, "ses_missing")).rejects.toThrow()];
                case 14:
                    _1.sent();
                    _k = bun_test_1.expect;
                    return [4 /*yield*/, manager.workspaceSessionGet(workspace.workspaceID)];
                case 15:
                    _k.apply(void 0, [_1.sent()]).toBe(recent.id);
                    return [4 /*yield*/, manager.dispose()];
                case 16:
                    _1.sent();
                    manager = (0, workspace_manager_1.createWorkspaceManager)(options);
                    return [4 /*yield*/, manager.add({ path: root })];
                case 17:
                    workspace = _1.sent();
                    _l = bun_test_1.expect;
                    return [4 /*yield*/, ((_z = (_x = manager.get(workspace.workspaceID)) === null || _x === void 0 ? void 0 : (_y = _x.client).runtimeStatus) === null || _z === void 0 ? void 0 : _z.call(_y))];
                case 18:
                    _l.apply(void 0, [(_0 = (_1.sent())) === null || _0 === void 0 ? void 0 : _0.sessionID]).toBe(recent.id);
                    return [3 /*break*/, 21];
                case 19: return [4 /*yield*/, manager.dispose()];
                case 20:
                    _1.sent();
                    if (previousRegistry === undefined)
                        delete process.env.NATALIA_WORKSPACES_FILE;
                    else
                        process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                    return [7 /*endfinally*/];
                case 21: return [2 /*return*/];
            }
        });
    }); });
};
for (var _i = 0, _a = [false, true]; _i < _a.length; _i++) {
    var useSqliteStore = _a[_i];
    _loop_1(useSqliteStore);
}
(0, bun_test_1.test)("workspace proxy chat messages await lazy runtime initialization", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, previousRegistry, options, manager, store, session, client, _a, _b;
    var _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-chat-ready")];
            case 1:
                root = _j.sent();
                previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                process.env.NATALIA_WORKSPACES_FILE = (0, node_path_1.join)(root, "workspaces.json");
                options = {
                    pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(root),
                    globalConfigPath: (0, node_path_1.join)(root, "global-config.json"),
                };
                manager = (0, workspace_manager_1.createWorkspaceManager)(options);
                _j.label = 2;
            case 2:
                _j.trys.push([2, , 7, 9]);
                store = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                session = (0, session_1.createSessionRecord)("ses_chat_ready", "Chat ready");
                session.events.push({
                    type: "navi.chat.message.added",
                    id: "navi_ready",
                    messageID: "navi_ready_msg",
                    role: "chat",
                    text: "Navi ready",
                    at: "2026-08-01T00:00:00Z",
                }, {
                    type: "nia.chat.message.added",
                    id: "nia_ready",
                    messageID: "nia_ready_msg",
                    role: "chat",
                    text: "Nia ready",
                    at: "2026-08-01T00:00:00Z",
                });
                return [4 /*yield*/, store.save(session)];
            case 3:
                _j.sent();
                return [4 /*yield*/, manager.add({ path: root })];
            case 4:
                _j.sent();
                client = (0, workspace_manager_1.createWorkspaceRuntimeClient)(manager);
                // This is the first routed call on a freshly added workspace: start() has
                // only kicked initialization off in the background, so chatMessages must
                // wait for ready instead of racing `ensureExecution`.
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_d = (_c = client.naviChat) === null || _c === void 0 ? void 0 : _c.messages) === null || _d === void 0 ? void 0 : _d.call(_c, session.id))];
            case 5:
                // This is the first routed call on a freshly added workspace: start() has
                // only kicked initialization off in the background, so chatMessages must
                // wait for ready instead of racing `ensureExecution`.
                _a.apply(void 0, [(_e = (_j.sent())) === null || _e === void 0 ? void 0 : _e.map(function (row) { return row.text; })]).toEqual(["Navi ready"]);
                _b = bun_test_1.expect;
                return [4 /*yield*/, ((_g = (_f = client.niaChat) === null || _f === void 0 ? void 0 : _f.messages) === null || _g === void 0 ? void 0 : _g.call(_f, session.id))];
            case 6:
                _b.apply(void 0, [(_h = (_j.sent())) === null || _h === void 0 ? void 0 : _h.map(function (row) { return row.text; })]).toEqual(["Nia ready"]);
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, manager.dispose()];
            case 8:
                _j.sent();
                if (previousRegistry === undefined)
                    delete process.env.NATALIA_WORKSPACES_FILE;
                else
                    process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace proxy intelligence reads await lazy initialization", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, previousRegistry, options, manager, store, session, client;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-intelligence-ready")];
            case 1:
                root = _c.sent();
                previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                process.env.NATALIA_WORKSPACES_FILE = (0, node_path_1.join)(root, "workspaces.json");
                options = {
                    pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(root),
                    globalConfigPath: (0, node_path_1.join)(root, "global-config.json"),
                };
                manager = (0, workspace_manager_1.createWorkspaceManager)(options);
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 7, 9]);
                store = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                session = (0, session_1.createSessionRecord)("ses_intelligence_ready", "Intelligence ready");
                return [4 /*yield*/, store.save(session)];
            case 3:
                _c.sent();
                return [4 /*yield*/, manager.add({ path: root })];
            case 4:
                _c.sent();
                client = (0, workspace_manager_1.createWorkspaceRuntimeClient)(manager);
                // These read surfaces may be the first routed call on a fresh workspace.
                return [4 /*yield*/, (0, bun_test_1.expect)((_a = client.driftFindings) === null || _a === void 0 ? void 0 : _a.call(client, { sessionID: session.id })).resolves.toMatchObject({
                        items: [],
                        returned: 0,
                        total: 0,
                        truncated: false,
                    })];
            case 5:
                // These read surfaces may be the first routed call on a fresh workspace.
                _c.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((_b = client.notices) === null || _b === void 0 ? void 0 : _b.call(client, session.id)).resolves.toEqual([])];
            case 6:
                _c.sent();
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, manager.dispose()];
            case 8:
                _c.sent();
                if (previousRegistry === undefined)
                    delete process.env.NATALIA_WORKSPACES_FILE;
                else
                    process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("chat history survives after the newest event window", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, previousRegistry, options, manager, store, session, index, client, _a, page, older;
    var _b, _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-chat-tail")];
            case 1:
                root = _j.sent();
                previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                process.env.NATALIA_WORKSPACES_FILE = (0, node_path_1.join)(root, "workspaces.json");
                options = {
                    pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(root),
                    globalConfigPath: (0, node_path_1.join)(root, "global-config.json"),
                };
                manager = (0, workspace_manager_1.createWorkspaceManager)(options);
                _j.label = 2;
            case 2:
                _j.trys.push([2, , 8, 10]);
                store = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                session = (0, session_1.createSessionRecord)("ses_chat_tail", "Chat tail");
                session.events.push({
                    type: "navi.chat.message.added",
                    id: "navi_old_1",
                    messageID: "navi_old_1_msg",
                    role: "chat",
                    text: "old navi 1",
                    at: "2026-08-01T00:00:00Z",
                }, {
                    type: "navi.chat.message.added",
                    id: "navi_old_2",
                    messageID: "navi_old_2_msg",
                    role: "chat",
                    text: "old navi 2",
                    at: "2026-08-01T00:00:01Z",
                });
                // The shared window keeps only the newest 2000 events. Put the chat rows
                // behind that page so a window-only projection silently drops them.
                for (index = 0; index < 2100; index += 1)
                    session.events.push({
                        type: "tool.update",
                        id: "fill:".concat(index),
                        name: "noop",
                        status: "succeeded",
                        summary: "noop",
                    });
                return [4 /*yield*/, store.save(session)];
            case 3:
                _j.sent();
                return [4 /*yield*/, manager.add({ path: root })];
            case 4:
                _j.sent();
                client = (0, workspace_manager_1.createWorkspaceRuntimeClient)(manager);
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_c = (_b = client.naviChat) === null || _b === void 0 ? void 0 : _b.messages) === null || _c === void 0 ? void 0 : _c.call(_b, session.id))];
            case 5:
                _a.apply(void 0, [(_d = (_j.sent())) === null || _d === void 0 ? void 0 : _d.map(function (row) { return row.text; })]).toEqual(["old navi 1", "old navi 2"]);
                return [4 /*yield*/, ((_f = (_e = client.naviChat) === null || _e === void 0 ? void 0 : _e.messagesPage) === null || _f === void 0 ? void 0 : _f.call(_e, {
                        sessionID: session.id,
                        limit: 1,
                    }))];
            case 6:
                page = _j.sent();
                (0, bun_test_1.expect)(page === null || page === void 0 ? void 0 : page.data.map(function (row) { return row.text; })).toEqual(["old navi 2"]);
                (0, bun_test_1.expect)(page === null || page === void 0 ? void 0 : page.cursor.previous).toBeDefined();
                return [4 /*yield*/, ((_h = (_g = client.naviChat) === null || _g === void 0 ? void 0 : _g.messagesPage) === null || _h === void 0 ? void 0 : _h.call(_g, {
                        sessionID: session.id,
                        cursor: page === null || page === void 0 ? void 0 : page.cursor.previous,
                        limit: 1,
                    }))];
            case 7:
                older = _j.sent();
                (0, bun_test_1.expect)(older === null || older === void 0 ? void 0 : older.data.map(function (row) { return row.text; })).toEqual(["old navi 1"]);
                return [3 /*break*/, 10];
            case 8: return [4 /*yield*/, manager.dispose()];
            case 9:
                _j.sent();
                if (previousRegistry === undefined)
                    delete process.env.NATALIA_WORKSPACES_FILE;
                else
                    process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                return [7 /*endfinally*/];
            case 10: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("subagent history pages are filtered per subagent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, previousRegistry, options, manager, store, session, index, client, latest, older;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-subagent-page")];
            case 1:
                root = _c.sent();
                previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                process.env.NATALIA_WORKSPACES_FILE = (0, node_path_1.join)(root, "workspaces.json");
                options = {
                    pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(root),
                    globalConfigPath: (0, node_path_1.join)(root, "global-config.json"),
                };
                manager = (0, workspace_manager_1.createWorkspaceManager)(options);
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 7, 9]);
                store = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                session = (0, session_1.createSessionRecord)("ses_subagent_page", "Subagent page");
                for (index = 0; index < 150; index += 1)
                    session.events.push({
                        type: "subagent.update",
                        id: "sub-1",
                        status: "running",
                        attached: false,
                        event: "status",
                        continuation: index,
                    });
                session.events.push({
                    type: "subagent.update",
                    id: "sub-2",
                    status: "completed",
                    attached: false,
                    event: "done",
                });
                return [4 /*yield*/, store.save(session)];
            case 3:
                _c.sent();
                return [4 /*yield*/, manager.add({ path: root })];
            case 4:
                _c.sent();
                client = (0, workspace_manager_1.createWorkspaceRuntimeClient)(manager);
                return [4 /*yield*/, ((_a = client.subagentHistoryPage) === null || _a === void 0 ? void 0 : _a.call(client, {
                        sessionID: session.id,
                        subagentID: "sub-1",
                        limit: 100,
                    }))];
            case 5:
                latest = _c.sent();
                (0, bun_test_1.expect)(latest === null || latest === void 0 ? void 0 : latest.data).toHaveLength(100);
                (0, bun_test_1.expect)(latest === null || latest === void 0 ? void 0 : latest.data.every(function (event) { return event.id === "sub-1"; })).toBe(true);
                (0, bun_test_1.expect)(latest === null || latest === void 0 ? void 0 : latest.cursor.previous).toBeDefined();
                return [4 /*yield*/, ((_b = client.subagentHistoryPage) === null || _b === void 0 ? void 0 : _b.call(client, {
                        sessionID: session.id,
                        subagentID: "sub-1",
                        cursor: latest === null || latest === void 0 ? void 0 : latest.cursor.previous,
                        limit: 100,
                    }))];
            case 6:
                older = _c.sent();
                (0, bun_test_1.expect)(older === null || older === void 0 ? void 0 : older.data).toHaveLength(50);
                (0, bun_test_1.expect)(older === null || older === void 0 ? void 0 : older.data.every(function (event) { return event.id === "sub-1"; })).toBe(true);
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, manager.dispose()];
            case 8:
                _c.sent();
                if (previousRegistry === undefined)
                    delete process.env.NATALIA_WORKSPACES_FILE;
                else
                    process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session-scoped runtime calls route to the owning workspace", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, firstClient, secondClient, first, second, manager, client, sessionID;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                firstClient = {
                    start: function () { },
                    subagents: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("first:subagents");
                                return [2 /*return*/, []];
                            });
                        });
                    },
                    submit: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("first:submit");
                                return [2 /*return*/, {}];
                            });
                        });
                    },
                    history: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("first:history");
                                return [2 /*return*/, { events: [], next: undefined }];
                            });
                        });
                    },
                };
                secondClient = {
                    start: function () { },
                    subagents: function (sessionID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:subagents:".concat(sessionID));
                                return [2 /*return*/, []];
                            });
                        });
                    },
                    submit: function (_text, sessionID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:submit:".concat(sessionID));
                                return [2 /*return*/, {}];
                            });
                        });
                    },
                    history: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:history:".concat(input.sessionID));
                                return [2 /*return*/, { events: [], next: undefined }];
                            });
                        });
                    },
                    selectModel: function (_model, _variant, sessionID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:selectModel:".concat(sessionID));
                                return [2 /*return*/, undefined];
                            });
                        });
                    },
                    workspaceRead: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:workspaceRead:".concat(input.workspaceID, ":").concat(input.path));
                                return [2 /*return*/, { path: input.path, content: "", encoding: "utf8" }];
                            });
                        });
                    },
                    agents: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:agents:".concat(input.workspaceID));
                                return [2 /*return*/, []];
                            });
                        });
                    },
                    snapshot: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:snapshot:".concat(input === null || input === void 0 ? void 0 : input.workspaceID));
                                return [2 /*return*/, { type: "snapshot.created", id: "s1", files: [] }];
                            });
                        });
                    },
                    pendingInteractive: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:pendingInteractive:".concat(input === null || input === void 0 ? void 0 : input.workspaceID, ":").concat(input === null || input === void 0 ? void 0 : input.sessionID));
                                return [2 /*return*/, { approvals: [], questions: [] }];
                            });
                        });
                    },
                    checkpointListByKind: function (kind, sessionID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:checkpointListByKind:".concat(kind, ":").concat(sessionID));
                                return [2 /*return*/, []];
                            });
                        });
                    },
                    mailboxDeliver: function (messageID, sessionID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:mailboxDeliver:".concat(messageID, ":").concat(sessionID));
                                return [2 /*return*/, { delivered: true }];
                            });
                        });
                    },
                    mailboxDefer: function (messageID, reason, sessionID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:mailboxDefer:".concat(messageID, ":").concat(reason, ":").concat(sessionID));
                                return [2 /*return*/, { deferred: true }];
                            });
                        });
                    },
                    planDocDelete: function (planID, sessionID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:planDocDelete:".concat(planID, ":").concat(sessionID));
                                return [2 /*return*/, { deleted: true }];
                            });
                        });
                    },
                    planDocStatus: function (planID, sessionID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:planDocStatus:".concat(planID, ":").concat(sessionID));
                                return [2 /*return*/, { status: "marked" }];
                            });
                        });
                    },
                    auditRounds: function (planID, workspaceID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:auditRounds:".concat(planID, ":").concat(workspaceID));
                                return [2 /*return*/, []];
                            });
                        });
                    },
                    readMcpResource: function (server, uri, workspaceID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:readMcpResource:".concat(server, ":").concat(uri, ":").concat(workspaceID));
                                return [2 /*return*/, null];
                            });
                        });
                    },
                    getMcpPrompt: function (server, name, _args, workspaceID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:getMcpPrompt:".concat(server, ":").concat(name, ":").concat(workspaceID));
                                return [2 /*return*/, null];
                            });
                        });
                    },
                    agentDelete: function (name, workspaceID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:agentDelete:".concat(name, ":").concat(workspaceID));
                                return [2 /*return*/, { deleted: true }];
                            });
                        });
                    },
                    respondApproval: function (response) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push("second:respondApproval:".concat(response.requestID, ":").concat(response.sessionID, ":").concat(response.workspaceID));
                                return [2 /*return*/, { accepted: true }];
                            });
                        });
                    },
                };
                first = {
                    workspaceID: "ws_first",
                    root: "/tmp/first",
                    title: "First",
                    client: firstClient,
                    status: "active",
                    permissionSettings: { permissionProfile: "default", approval: "ask" },
                    toolSettings: { enabledTools: [], disabledTools: [] },
                };
                second = {
                    workspaceID: "ws_second",
                    root: "/tmp/second",
                    title: "Second",
                    client: secondClient,
                    status: "idle",
                    permissionSettings: { permissionProfile: "default", approval: "ask" },
                    toolSettings: { enabledTools: [], disabledTools: [] },
                };
                manager = __assign(__assign({}, emptyManager()), { getActive: function () { return first; }, get: function (workspaceID) {
                        return workspaceID === first.workspaceID
                            ? first
                            : workspaceID === second.workspaceID
                                ? second
                                : undefined;
                    }, findWorkspaceForSession: function (sessionID) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, sessionID.startsWith("ses_second") ? second : first];
                    }); }); } });
                client = (0, workspace_manager_1.createWorkspaceRuntimeClient)(manager);
                sessionID = "ses_second";
                return [4 /*yield*/, client.subagents(sessionID)];
            case 1:
                _a.sent();
                return [4 /*yield*/, client.submit("hello", sessionID)];
            case 2:
                _a.sent();
                return [4 /*yield*/, client.history({ sessionID: sessionID })];
            case 3:
                _a.sent();
                return [4 /*yield*/, client.selectModel("model", "default", sessionID)];
            case 4:
                _a.sent();
                return [4 /*yield*/, client.workspaceRead({
                        workspaceID: second.workspaceID,
                        path: "src/index.ts",
                    })];
            case 5:
                _a.sent();
                return [4 /*yield*/, client.agents({ workspaceID: second.workspaceID })];
            case 6:
                _a.sent();
                return [4 /*yield*/, client.snapshot({ workspaceID: second.workspaceID })];
            case 7:
                _a.sent();
                return [4 /*yield*/, client.pendingInteractive({
                        sessionID: sessionID,
                        workspaceID: second.workspaceID,
                    })];
            case 8:
                _a.sent();
                return [4 /*yield*/, client.checkpointListByKind("manual", sessionID)];
            case 9:
                _a.sent();
                return [4 /*yield*/, client.mailboxDeliver("msg_1", sessionID)];
            case 10:
                _a.sent();
                return [4 /*yield*/, client.mailboxDefer("msg_1", "later", sessionID)];
            case 11:
                _a.sent();
                return [4 /*yield*/, client.planDocDelete("plan_1", sessionID)];
            case 12:
                _a.sent();
                return [4 /*yield*/, client.planDocStatus("plan_1", sessionID)];
            case 13:
                _a.sent();
                return [4 /*yield*/, client.auditRounds("plan_1", second.workspaceID)];
            case 14:
                _a.sent();
                return [4 /*yield*/, client.readMcpResource("demo", "demo://resource", second.workspaceID)];
            case 15:
                _a.sent();
                return [4 /*yield*/, client.getMcpPrompt("demo", "lookup", undefined, second.workspaceID)];
            case 16:
                _a.sent();
                return [4 /*yield*/, client.agentDelete("build", second.workspaceID)];
            case 17:
                _a.sent();
                return [4 /*yield*/, client.respondApproval({
                        requestID: "apr_1",
                        decision: "once",
                        sessionID: sessionID,
                        workspaceID: second.workspaceID,
                    })];
            case 18:
                _a.sent();
                (0, bun_test_1.expect)(calls).toEqual([
                    "second:subagents:".concat(sessionID),
                    "second:submit:".concat(sessionID),
                    "second:history:".concat(sessionID),
                    "second:selectModel:".concat(sessionID),
                    "second:workspaceRead:".concat(second.workspaceID, ":src/index.ts"),
                    "second:agents:".concat(second.workspaceID),
                    "second:snapshot:".concat(second.workspaceID),
                    "second:pendingInteractive:".concat(second.workspaceID, ":").concat(sessionID),
                    "second:checkpointListByKind:manual:".concat(sessionID),
                    "second:mailboxDeliver:msg_1:".concat(sessionID),
                    "second:mailboxDefer:msg_1:later:".concat(sessionID),
                    "second:planDocDelete:plan_1:".concat(sessionID),
                    "second:planDocStatus:plan_1:".concat(sessionID),
                    "second:auditRounds:plan_1:".concat(second.workspaceID),
                    "second:readMcpResource:demo:demo://resource:".concat(second.workspaceID),
                    "second:getMcpPrompt:demo:lookup:".concat(second.workspaceID),
                    "second:agentDelete:build:".concat(second.workspaceID),
                    "second:respondApproval:apr_1:".concat(sessionID, ":").concat(second.workspaceID),
                ]);
                return [4 /*yield*/, (0, bun_test_1.expect)(client.pendingInteractive({
                        sessionID: sessionID,
                        workspaceID: first.workspaceID,
                    })).rejects.toThrow("does not belong to workspace")];
            case 19:
                _a.sent();
                (0, bun_test_1.expect)(calls).toEqual([
                    "second:subagents:".concat(sessionID),
                    "second:submit:".concat(sessionID),
                    "second:history:".concat(sessionID),
                    "second:selectModel:".concat(sessionID),
                    "second:workspaceRead:".concat(second.workspaceID, ":src/index.ts"),
                    "second:agents:".concat(second.workspaceID),
                    "second:snapshot:".concat(second.workspaceID),
                    "second:pendingInteractive:".concat(second.workspaceID, ":").concat(sessionID),
                    "second:checkpointListByKind:manual:".concat(sessionID),
                    "second:mailboxDeliver:msg_1:".concat(sessionID),
                    "second:mailboxDefer:msg_1:later:".concat(sessionID),
                    "second:planDocDelete:plan_1:".concat(sessionID),
                    "second:planDocStatus:plan_1:".concat(sessionID),
                    "second:auditRounds:plan_1:".concat(second.workspaceID),
                    "second:readMcpResource:demo:demo://resource:".concat(second.workspaceID),
                    "second:getMcpPrompt:demo:lookup:".concat(second.workspaceID),
                    "second:agentDelete:build:".concat(second.workspaceID),
                    "second:respondApproval:apr_1:".concat(sessionID, ":").concat(second.workspaceID),
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace falls back to last access, ignores pins/archive/stale selection, then uses seed for an empty workspace", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, previousRegistry, options, manager, store, seed, workspace, _a, old, recent, archived, _i, _b, settings, _c;
    var _d, _e, _f, _g, _h, _j, _k, _l;
    return __generator(this, function (_m) {
        switch (_m.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-recent")];
            case 1:
                root = _m.sent();
                previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                process.env.NATALIA_WORKSPACES_FILE = (0, node_path_1.join)(root, "workspaces.json");
                options = {
                    pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(root),
                    globalConfigPath: (0, node_path_1.join)(root, "global-config.json"),
                };
                manager = (0, workspace_manager_1.createWorkspaceManager)(options);
                _m.label = 2;
            case 2:
                _m.trys.push([2, , 17, 19]);
                store = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                seed = "ses_".concat((0, node_crypto_1.createHash)("sha256").update(root).digest("hex").slice(0, 12));
                return [4 /*yield*/, manager.add({ path: root })];
            case 3:
                workspace = _m.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_f = (_d = manager.get(workspace.workspaceID)) === null || _d === void 0 ? void 0 : (_e = _d.client).runtimeStatus) === null || _f === void 0 ? void 0 : _f.call(_e))];
            case 4:
                _a.apply(void 0, [(_g = (_m.sent())) === null || _g === void 0 ? void 0 : _g.sessionID]).toBe(seed);
                return [4 /*yield*/, manager.dispose()];
            case 5:
                _m.sent();
                return [4 /*yield*/, store.delete(seed)];
            case 6:
                _m.sent();
                old = (0, session_1.createSessionRecord)("ses_old", "Pinned");
                old.metadata = { pinned: true, lastAccessedAt: "2026-01-01T00:00:00Z" };
                recent = (0, session_1.createSessionRecord)("ses_recent", "Recent");
                recent.metadata = { lastAccessedAt: "2026-08-01T00:00:00Z" };
                archived = (0, session_1.createSessionRecord)("ses_archived", "Archived");
                archived.metadata = {
                    archived: true,
                    lastAccessedAt: "2026-09-01T00:00:00Z",
                };
                return [4 /*yield*/, store.save(old)];
            case 7:
                _m.sent();
                return [4 /*yield*/, store.save(recent)];
            case 8:
                _m.sent();
                return [4 /*yield*/, store.save(archived)];
            case 9:
                _m.sent();
                _i = 0, _b = [{}, { activeSessionID: "ses_deleted" }];
                _m.label = 10;
            case 10:
                if (!(_i < _b.length)) return [3 /*break*/, 16];
                settings = _b[_i];
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "workspace-settings.json"), JSON.stringify(settings))];
            case 11:
                _m.sent();
                manager = (0, workspace_manager_1.createWorkspaceManager)(options);
                return [4 /*yield*/, manager.add({ path: root })];
            case 12:
                workspace = _m.sent();
                _c = bun_test_1.expect;
                return [4 /*yield*/, ((_k = (_h = manager.get(workspace.workspaceID)) === null || _h === void 0 ? void 0 : (_j = _h.client).runtimeStatus) === null || _k === void 0 ? void 0 : _k.call(_j))];
            case 13:
                _c.apply(void 0, [(_l = (_m.sent())) === null || _l === void 0 ? void 0 : _l.sessionID]).toBe(recent.id);
                return [4 /*yield*/, manager.dispose()];
            case 14:
                _m.sent();
                _m.label = 15;
            case 15:
                _i++;
                return [3 /*break*/, 10];
            case 16: return [3 /*break*/, 19];
            case 17: return [4 /*yield*/, manager.dispose()];
            case 18:
                _m.sent();
                if (previousRegistry === undefined)
                    delete process.env.NATALIA_WORKSPACES_FILE;
                else
                    process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                return [7 /*endfinally*/];
            case 19: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SQLite restore uses last access instead of pins or deleted legacy JSON", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, previousRegistry, manager, database, legacy_1, workspace, client, _a, _b;
    var _c, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-sqlite-recent")];
            case 1:
                root = _g.sent();
                previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                process.env.NATALIA_WORKSPACES_FILE = (0, node_path_1.join)(root, "workspaces.json");
                manager = (0, workspace_manager_1.createWorkspaceManager)({
                    pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(root),
                    globalConfigPath: (0, node_path_1.join)(root, "global-config.json"),
                    useSqliteStore: true,
                });
                _g.label = 2;
            case 2:
                _g.trys.push([2, , 8, 10]);
                database = new session_1.SqliteSessionStore((0, node_path_1.join)(root, ".natalia", "sessions.db"));
                database.create("ses_pinned", "Pinned");
                database.updateMetadata("ses_pinned", {
                    pinned: true,
                    lastAccessedAt: "2026-01-01T00:00:00Z",
                });
                database.create("ses_recent", "Recent");
                database.updateMetadata("ses_recent", {
                    lastAccessedAt: "2026-08-01T00:00:00Z",
                });
                database.close();
                legacy_1 = (0, session_1.createSessionRecord)("ses_deleted", "Deleted JSON leftover");
                legacy_1.metadata = { lastAccessedAt: "2026-09-01T00:00:00Z" };
                return [4 /*yield*/, new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions")).save(legacy_1)];
            case 3:
                _g.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "workspace-settings.json"), JSON.stringify({ activeSessionID: legacy_1.id }))];
            case 4:
                _g.sent();
                return [4 /*yield*/, manager.add({ path: root })];
            case 5:
                workspace = _g.sent();
                client = manager.get(workspace.workspaceID).client;
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_c = client.runtimeStatus) === null || _c === void 0 ? void 0 : _c.call(client))];
            case 6:
                _a.apply(void 0, [(_d = (_g.sent())) === null || _d === void 0 ? void 0 : _d.sessionID]).toBe("ses_recent");
                _b = bun_test_1.expect;
                return [4 /*yield*/, ((_e = client.sessionList) === null || _e === void 0 ? void 0 : _e.call(client))];
            case 7:
                _b.apply(void 0, [(_f = (_g.sent())) === null || _f === void 0 ? void 0 : _f.some(function (row) { return row.id === legacy_1.id; })]).toBe(false);
                return [3 /*break*/, 10];
            case 8: return [4 /*yield*/, manager.dispose()];
            case 9:
                _g.sent();
                if (previousRegistry === undefined)
                    delete process.env.NATALIA_WORKSPACES_FILE;
                else
                    process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                return [7 /*endfinally*/];
            case 10: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspaceAdd updates the title for an already-registered root", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, previousRegistry, registryPath, manager, created, renamed, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-title-update")];
            case 1:
                root = _d.sent();
                previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                registryPath = (0, node_path_1.join)(root, "workspaces.json");
                process.env.NATALIA_WORKSPACES_FILE = registryPath;
                manager = (0, workspace_manager_1.createWorkspaceManager)({
                    pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(root),
                    globalConfigPath: (0, node_path_1.join)(root, "global-config.json"),
                });
                _d.label = 2;
            case 2:
                _d.trys.push([2, , 6, 8]);
                return [4 /*yield*/, manager.workspaceAdd({ path: root })];
            case 3:
                created = _d.sent();
                (0, bun_test_1.expect)(created.title).toBe(root.split("/").pop());
                return [4 /*yield*/, manager.workspaceAdd({
                        path: root,
                        title: "Renamed workspace",
                    })];
            case 4:
                renamed = _d.sent();
                (0, bun_test_1.expect)(renamed.workspaceID).toBe(created.workspaceID);
                (0, bun_test_1.expect)(renamed.title).toBe("Renamed workspace");
                _a = bun_test_1.expect;
                _c = (_b = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)(registryPath, "utf8")];
            case 5:
                _a.apply(void 0, [_c.apply(_b, [_d.sent()])]).toEqual([
                    { path: root, title: "Renamed workspace", active: true },
                ]);
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, manager.dispose()];
            case 7:
                _d.sent();
                if (previousRegistry === undefined)
                    delete process.env.NATALIA_WORKSPACES_FILE;
                else
                    process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sessions aggregate across workspaces and attach routes to the owner", function () { return __awaiter(void 0, void 0, void 0, function () {
    var firstRoot, secondRoot, previousRegistry, registryPath, firstStore, secondStore, firstSession, secondSession, manager, first_1, second_1, client, sessions, attempt, _a;
    var _b, _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-routing-a")];
            case 1:
                firstRoot = _j.sent();
                return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-routing-b")];
            case 2:
                secondRoot = _j.sent();
                previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                registryPath = (0, node_path_1.join)(firstRoot, "workspaces.json");
                process.env.NATALIA_WORKSPACES_FILE = registryPath;
                firstStore = new session_1.JsonSessionStore((0, node_path_1.join)(firstRoot, ".natalia", "sessions"));
                secondStore = new session_1.JsonSessionStore((0, node_path_1.join)(secondRoot, ".natalia", "sessions"));
                firstSession = (0, session_1.createSessionRecord)("ses_first_workspace", "First workspace session");
                secondSession = (0, session_1.createSessionRecord)("ses_second_workspace", "Second workspace session");
                return [4 /*yield*/, firstStore.save(firstSession)];
            case 3:
                _j.sent();
                return [4 /*yield*/, secondStore.save(secondSession)];
            case 4:
                _j.sent();
                manager = (0, workspace_manager_1.createWorkspaceManager)({
                    pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(firstRoot),
                    globalConfigPath: (0, node_path_1.join)(firstRoot, "global-config.json"),
                });
                _j.label = 5;
            case 5:
                _j.trys.push([5, , 16, 18]);
                return [4 /*yield*/, manager.workspaceAdd({ path: firstRoot })];
            case 6:
                first_1 = _j.sent();
                return [4 /*yield*/, manager.workspaceAdd({ path: secondRoot })];
            case 7:
                second_1 = _j.sent();
                client = (0, workspace_manager_1.createWorkspaceRuntimeClient)(manager);
                (_b = client.start) === null || _b === void 0 ? void 0 : _b.call(client, function () { return undefined; });
                return [4 /*yield*/, ((_c = client.sessionList) === null || _c === void 0 ? void 0 : _c.call(client))];
            case 8:
                sessions = (_d = (_j.sent())) !== null && _d !== void 0 ? _d : [];
                attempt = 0;
                _j.label = 9;
            case 9:
                if (!(attempt < 50 &&
                    !(sessions.some(function (session) { return session.workspaceID === first_1.workspaceID; }) &&
                        sessions.some(function (session) { return session.workspaceID === second_1.workspaceID; })))) return [3 /*break*/, 13];
                return [4 /*yield*/, Bun.sleep(20)];
            case 10:
                _j.sent();
                return [4 /*yield*/, ((_e = client.sessionList) === null || _e === void 0 ? void 0 : _e.call(client))];
            case 11:
                sessions = (_f = (_j.sent())) !== null && _f !== void 0 ? _f : [];
                _j.label = 12;
            case 12:
                attempt++;
                return [3 /*break*/, 9];
            case 13:
                (0, bun_test_1.expect)(sessions.map(function (session) { return session.workspaceID; })).toEqual(bun_test_1.expect.arrayContaining([first_1.workspaceID, second_1.workspaceID]));
                return [4 /*yield*/, ((_g = client.sessionAttach) === null || _g === void 0 ? void 0 : _g.call(client, secondSession.id))];
            case 14:
                _j.sent();
                (0, bun_test_1.expect)((_h = manager.getActive()) === null || _h === void 0 ? void 0 : _h.workspaceID).toBe(second_1.workspaceID);
                _a = bun_test_1.expect;
                return [4 /*yield*/, manager.workspaceSessionGet(second_1.workspaceID)];
            case 15:
                _a.apply(void 0, [_j.sent()]).toBe(secondSession.id);
                return [3 /*break*/, 18];
            case 16: return [4 /*yield*/, manager.dispose()];
            case 17:
                _j.sent();
                if (previousRegistry === undefined)
                    delete process.env.NATALIA_WORKSPACES_FILE;
                else
                    process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                return [7 /*endfinally*/];
            case 18: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace delete replaces an inactive workspace's active session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var firstRoot, secondRoot, previousRegistry, registryPath, firstStore, secondStore, firstSession, secondSession, manager, first, second, client, _a, remaining, _b;
    var _c, _d, _e, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-delete-active-a")];
            case 1:
                firstRoot = _k.sent();
                return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-delete-active-b")];
            case 2:
                secondRoot = _k.sent();
                previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                registryPath = (0, node_path_1.join)(firstRoot, "workspaces.json");
                process.env.NATALIA_WORKSPACES_FILE = registryPath;
                firstStore = new session_1.JsonSessionStore((0, node_path_1.join)(firstRoot, ".natalia", "sessions"));
                secondStore = new session_1.JsonSessionStore((0, node_path_1.join)(secondRoot, ".natalia", "sessions"));
                firstSession = (0, session_1.createSessionRecord)("ses_delete_a", "First");
                secondSession = (0, session_1.createSessionRecord)("ses_delete_b", "Second");
                return [4 /*yield*/, firstStore.save(firstSession)];
            case 3:
                _k.sent();
                return [4 /*yield*/, secondStore.save(secondSession)];
            case 4:
                _k.sent();
                manager = (0, workspace_manager_1.createWorkspaceManager)({
                    pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(firstRoot),
                    globalConfigPath: (0, node_path_1.join)(firstRoot, "global-config.json"),
                });
                _k.label = 5;
            case 5:
                _k.trys.push([5, , 14, 16]);
                return [4 /*yield*/, manager.workspaceAdd({ path: firstRoot })];
            case 6:
                first = _k.sent();
                return [4 /*yield*/, manager.workspaceAdd({ path: secondRoot })];
            case 7:
                second = _k.sent();
                client = (0, workspace_manager_1.createWorkspaceRuntimeClient)(manager);
                (_c = client.start) === null || _c === void 0 ? void 0 : _c.call(client, function () { return undefined; });
                return [4 /*yield*/, ((_d = client.sessionAttach) === null || _d === void 0 ? void 0 : _d.call(client, firstSession.id))];
            case 8:
                _k.sent();
                return [4 /*yield*/, ((_e = client.sessionAttach) === null || _e === void 0 ? void 0 : _e.call(client, secondSession.id))];
            case 9:
                _k.sent();
                (0, bun_test_1.expect)((_f = manager.getActive()) === null || _f === void 0 ? void 0 : _f.workspaceID).toBe(second.workspaceID);
                // `firstSession` is no longer globally active, but its own workspace
                // runtime still has it attached. The facade must replace that attachment
                // before retrying the delete, otherwise the active-session guard wins.
                return [4 /*yield*/, (0, bun_test_1.expect)((_g = client.sessionDelete) === null || _g === void 0 ? void 0 : _g.call(client, firstSession.id)).resolves.toMatchObject({ id: firstSession.id })];
            case 10:
                // `firstSession` is no longer globally active, but its own workspace
                // runtime still has it attached. The facade must replace that attachment
                // before retrying the delete, otherwise the active-session guard wins.
                _k.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, firstStore.load(firstSession.id)];
            case 11:
                _a.apply(void 0, [_k.sent()]).toBeUndefined();
                return [4 /*yield*/, firstStore.list()];
            case 12:
                remaining = _k.sent();
                (0, bun_test_1.expect)(remaining).toHaveLength(1);
                (0, bun_test_1.expect)((_h = remaining[0]) === null || _h === void 0 ? void 0 : _h.id).not.toBe(firstSession.id);
                _b = bun_test_1.expect;
                return [4 /*yield*/, manager.workspaceSessionGet(first.workspaceID)];
            case 13:
                _b.apply(void 0, [_k.sent()]).toBe((_j = remaining[0]) === null || _j === void 0 ? void 0 : _j.id);
                return [3 /*break*/, 16];
            case 14: return [4 /*yield*/, manager.dispose()];
            case 15:
                _k.sent();
                if (previousRegistry === undefined)
                    delete process.env.NATALIA_WORKSPACES_FILE;
                else
                    process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                return [7 /*endfinally*/];
            case 16: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("load restores the persisted active workspace", function () { return __awaiter(void 0, void 0, void 0, function () {
    var firstRoot, secondRoot, previousRegistry, registryPath, manager;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-active-a")];
            case 1:
                firstRoot = _b.sent();
                return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workspace-active-b")];
            case 2:
                secondRoot = _b.sent();
                previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
                registryPath = (0, node_path_1.join)(firstRoot, "workspaces.json");
                process.env.NATALIA_WORKSPACES_FILE = registryPath;
                return [4 /*yield*/, (0, promises_1.writeFile)(registryPath, JSON.stringify([
                        { path: firstRoot, title: "A", active: false },
                        { path: secondRoot, title: "B", active: true },
                    ]))];
            case 3:
                _b.sent();
                manager = (0, workspace_manager_1.createWorkspaceManager)({
                    pluginStoreRoot: (0, plugin_test_helpers_1.officialPluginStoreRoot)(firstRoot),
                    globalConfigPath: (0, node_path_1.join)(firstRoot, "global-config.json"),
                });
                _b.label = 4;
            case 4:
                _b.trys.push([4, , 6, 8]);
                return [4 /*yield*/, manager.load()];
            case 5:
                _b.sent();
                (0, bun_test_1.expect)((_a = manager.getActive()) === null || _a === void 0 ? void 0 : _a.root).toBe(secondRoot);
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, manager.dispose()];
            case 7:
                _b.sent();
                if (previousRegistry === undefined)
                    delete process.env.NATALIA_WORKSPACES_FILE;
                else
                    process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
