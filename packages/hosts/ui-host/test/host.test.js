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
var src_1 = require("../src");
function fakeRoot() {
    var node = {
        tagName: "DIV",
        children: [],
        innerHTML: "",
        textContent: "",
        replaceChildren: function () {
            node.children = [];
            node.innerHTML = "";
            node.textContent = "";
        },
        appendChild: function (child) {
            node.children.push(child);
            return child;
        },
    };
    return node;
}
function runtimeFixture() {
    var sink;
    var submissions = [];
    var chat = [];
    var runtime = {
        start: function (next) {
            sink = next;
            next({
                type: "session.created",
                sessionID: "ses_fixture",
                title: "Fixture",
            });
            next({
                type: "session.ready",
                sessionID: "ses_fixture",
            });
        },
        submit: function (text) {
            return __awaiter(this, void 0, void 0, function () {
                var id;
                return __generator(this, function (_a) {
                    submissions.push(text);
                    id = "turn_".concat(submissions.length);
                    sink === null || sink === void 0 ? void 0 : sink({
                        type: "turn.submitted",
                        id: id,
                        text: text,
                        byteLength: text.length,
                        lineCount: 1,
                        sha256: "x",
                    });
                    sink === null || sink === void 0 ? void 0 : sink({ type: "content.done", id: id, text: "echo:".concat(text) });
                    return [2 /*return*/, {
                            type: "turn.submitted",
                            id: id,
                            text: text,
                            byteLength: text.length,
                            lineCount: 1,
                            sha256: "x",
                        }];
                });
            });
        },
        naviChat: {
            submit: function (input) {
                return __awaiter(this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        chat.push(input.text);
                        sink === null || sink === void 0 ? void 0 : sink({
                            type: "navi.chat.message.added",
                            id: "chat_1",
                            messageID: "msg_1",
                            role: "user",
                            text: input.text,
                            at: "now",
                        });
                        return [2 /*return*/, { messageID: "msg_1" }];
                    });
                });
            },
        },
        cancel: function () { },
    };
    return {
        runtime: runtime,
        submissions: function () { return submissions; },
        chat: function () { return chat; },
        emit: function (event) {
            sink === null || sink === void 0 ? void 0 : sink(event);
        },
    };
}
(0, bun_test_1.test)("the host loads a UI plugin, forwards events, and unloads it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, fixture, seen, plugin, host, loaded, _a;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                root = fakeRoot();
                fixture = runtimeFixture();
                seen = [];
                plugin = (0, src_1.defineUiPlugin)({
                    id: "example.web",
                    name: "Example",
                    version: "1.0.0",
                    events: ["runtime.*"],
                    panels: [
                        { id: "main", title: "Main", region: "main" },
                        { id: "chat", title: "Chat", region: "side" },
                    ],
                    commands: [
                        {
                            id: "example.ping",
                            title: "Ping",
                            run: function () { return "pong"; },
                        },
                    ],
                    mount: function (ctx) {
                        seen.push("mount");
                        ctx.root.textContent = "plugin-root";
                        var off = ctx.events.subscribe(function (event) { return seen.push(event.type); });
                        return {
                            dispose: function () {
                                off();
                                seen.push("dispose");
                                ctx.root.textContent = "";
                            },
                        };
                    },
                });
                return [4 /*yield*/, (0, src_1.createUiPluginHost)({ root: root, runtime: fixture.runtime })];
            case 1:
                host = _d.sent();
                return [4 /*yield*/, host.load(plugin)];
            case 2:
                loaded = _d.sent();
                (_c = (_b = host.projection).activateSession) === null || _c === void 0 ? void 0 : _c.call(_b, "ses_fixture");
                (0, bun_test_1.expect)(loaded.panels.map(function (panel) { return panel.id; })).toEqual(["main", "chat"]);
                (0, bun_test_1.expect)(host.loaded()).toHaveLength(1);
                (0, bun_test_1.expect)(host.projection.getState().sessionID).toBe("ses_fixture");
                (0, bun_test_1.expect)(host.projection.getState().title).toBe("Fixture");
                _a = bun_test_1.expect;
                return [4 /*yield*/, host.executeCommand("example.ping")];
            case 3:
                _a.apply(void 0, [_d.sent()]).toBe("pong");
                return [4 /*yield*/, host.executeCommand("runtime.submit", "hello")];
            case 4:
                _d.sent();
                (0, bun_test_1.expect)(fixture.submissions()).toEqual(["hello"]);
                (0, bun_test_1.expect)(host.projection.getState().messages.length).toBeGreaterThan(0);
                return [4 /*yield*/, host.executeCommand("runtime.chatSubmit", { text: "navi" })];
            case 5:
                _d.sent();
                (0, bun_test_1.expect)(fixture.chat()).toEqual(["navi"]);
                (0, bun_test_1.expect)(host.projection.getState().navi.messages).toHaveLength(1);
                return [4 /*yield*/, host.unload("example.web")];
            case 6:
                _d.sent();
                (0, bun_test_1.expect)(host.loaded()).toHaveLength(0);
                (0, bun_test_1.expect)(root.textContent).toBe("");
                (0, bun_test_1.expect)(seen).toEqual([
                    "mount",
                    "session.created",
                    "session.ready",
                    "turn.submitted",
                    "content.done",
                    "navi.chat.message.added",
                    "dispose",
                ]);
                return [4 /*yield*/, host.close()];
            case 7:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("loading the same UI plugin twice is rejected", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, fixture, plugin, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                root = fakeRoot();
                fixture = runtimeFixture();
                plugin = (0, src_1.defineUiPlugin)({
                    id: "example.web",
                    name: "Example",
                    version: "1.0.0",
                    mount: function () { },
                });
                return [4 /*yield*/, (0, src_1.createUiPluginHost)({ root: root, runtime: fixture.runtime })];
            case 1:
                host = _a.sent();
                return [4 /*yield*/, host.load(plugin)];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(host.load(plugin)).rejects.toThrow("ui plugin already loaded: example.web")];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(host.executeCommand("missing")).rejects.toThrow("command unavailable: missing")];
            case 4:
                _a.sent();
                return [4 /*yield*/, host.close()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the host does not paint business panels itself", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, fixture, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                root = fakeRoot();
                fixture = runtimeFixture();
                return [4 /*yield*/, (0, src_1.createUiPluginHost)({ root: root, runtime: fixture.runtime })];
            case 1:
                host = _a.sent();
                (0, bun_test_1.expect)(root.textContent).toBe("");
                (0, bun_test_1.expect)(root.innerHTML).toBe("");
                return [4 /*yield*/, host.close()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("unloading stops event delivery and a closed host refuses new plugins", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, fixture, seen, plugin, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                root = fakeRoot();
                fixture = runtimeFixture();
                seen = [];
                plugin = (0, src_1.defineUiPlugin)({
                    id: "example.web",
                    name: "Example",
                    version: "1.0.0",
                    mount: function (ctx) {
                        var off = ctx.events.subscribe(function (event) { return seen.push(event.type); });
                        return { dispose: off };
                    },
                });
                return [4 /*yield*/, (0, src_1.createUiPluginHost)({ root: root, runtime: fixture.runtime })];
            case 1:
                host = _a.sent();
                return [4 /*yield*/, host.load(plugin)];
            case 2:
                _a.sent();
                return [4 /*yield*/, host.unload("example.web")];
            case 3:
                _a.sent();
                fixture.emit({
                    type: "turn.started",
                    id: "t-late",
                });
                (0, bun_test_1.expect)(seen).toEqual(["session.created", "session.ready"]);
                return [4 /*yield*/, host.close()];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(host.load((0, src_1.defineUiPlugin)({
                        id: "late",
                        name: "Late",
                        version: "1.0.0",
                        mount: function () { },
                    }))).rejects.toThrow("ui plugin host is closed")];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("background session events stay cached across A to B to A activation", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fixture, host;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                fixture = runtimeFixture();
                return [4 /*yield*/, (0, src_1.createUiPluginHost)({
                        root: fakeRoot(),
                        runtime: fixture.runtime,
                    })];
            case 1:
                host = _e.sent();
                return [4 /*yield*/, host.load((0, src_1.defineUiPlugin)({ id: "cache", name: "Cache", version: "1", mount: function () { } }))];
            case 2:
                _e.sent();
                fixture.emit({
                    type: "session.created",
                    sessionID: "ses_a",
                    title: "A",
                });
                fixture.emit({
                    type: "turn.submitted",
                    id: "a1",
                    text: "first",
                    byteLength: 5,
                    lineCount: 1,
                    sha256: "x",
                    sessionID: "ses_a",
                });
                (_b = (_a = host.projection).activateSession) === null || _b === void 0 ? void 0 : _b.call(_a, "ses_b");
                fixture.emit({
                    type: "content.delta",
                    id: "a1",
                    text: "background",
                    sessionID: "ses_a",
                });
                fixture.emit({
                    type: "session.created",
                    sessionID: "ses_b",
                    title: "B",
                });
                fixture.emit({
                    type: "turn.submitted",
                    id: "b1",
                    text: "other",
                    byteLength: 5,
                    lineCount: 1,
                    sha256: "x",
                    sessionID: "ses_b",
                });
                (_d = (_c = host.projection).activateSession) === null || _d === void 0 ? void 0 : _d.call(_c, "ses_a");
                (0, bun_test_1.expect)(host.projection
                    .getState()
                    .messages.map(function (message) { return message.text + message.pendingText; })).toContain("background");
                (0, bun_test_1.expect)(host.projection.getState().messages.map(function (message) { return message.text; })).not.toContain("other");
                return [4 /*yield*/, host.close()];
            case 3:
                _e.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace keys isolate identical session IDs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fixture, host;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                fixture = runtimeFixture();
                return [4 /*yield*/, (0, src_1.createUiPluginHost)({
                        root: fakeRoot(),
                        runtime: fixture.runtime,
                    })];
            case 1:
                host = _e.sent();
                return [4 /*yield*/, host.load((0, src_1.defineUiPlugin)({
                        id: "workspace-cache",
                        name: "Workspace cache",
                        version: "1",
                        mount: function () { },
                    }))];
            case 2:
                _e.sent();
                fixture.emit({
                    type: "turn.submitted",
                    id: "one",
                    text: "workspace one",
                    byteLength: 13,
                    lineCount: 1,
                    sha256: "x",
                    sessionID: "ses_shared",
                    workspaceID: "one",
                });
                fixture.emit({
                    type: "turn.submitted",
                    id: "two",
                    text: "workspace two",
                    byteLength: 13,
                    lineCount: 1,
                    sha256: "x",
                    sessionID: "ses_shared",
                    workspaceID: "two",
                });
                (_b = (_a = host.projection).activateSession) === null || _b === void 0 ? void 0 : _b.call(_a, "ses_shared", "one");
                (0, bun_test_1.expect)(host.projection.getState().messages.map(function (message) { return message.text; })).toContain("workspace one");
                (0, bun_test_1.expect)(host.projection.getState().messages.map(function (message) { return message.text; })).not.toContain("workspace two");
                (_d = (_c = host.projection).activateSession) === null || _d === void 0 ? void 0 : _d.call(_c, "ses_shared", "two");
                (0, bun_test_1.expect)(host.projection.getState().messages.map(function (message) { return message.text; })).toContain("workspace two");
                return [4 /*yield*/, host.close()];
            case 3:
                _e.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("unloading a plugin disposes the panels it mounted", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, fixture, seen, plugin, host, container;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                root = fakeRoot();
                fixture = runtimeFixture();
                seen = [];
                plugin = (0, src_1.defineUiPlugin)({
                    id: "panels.web",
                    name: "Panels",
                    version: "1.0.0",
                    panels: [
                        { id: "main", title: "Main", region: "main" },
                        {
                            id: "chat",
                            title: "Chat",
                            region: "side",
                            mount: function () { return function () {
                                seen.push("panel-chat-disposed");
                            }; },
                        },
                    ],
                    mount: function () { return ({
                        dispose: function () {
                            seen.push("plugin-disposed");
                        },
                    }); },
                });
                return [4 /*yield*/, (0, src_1.createUiPluginHost)({ root: root, runtime: fixture.runtime })];
            case 1:
                host = _a.sent();
                return [4 /*yield*/, host.load(plugin)];
            case 2:
                _a.sent();
                container = fakeRoot();
                return [4 /*yield*/, host.mountPanel("panels.web", "chat", container)];
            case 3:
                _a.sent();
                return [4 /*yield*/, host.unload("panels.web")];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(seen).toEqual(["panel-chat-disposed", "plugin-disposed"]);
                // Removed as well as disposed: a listener reading the mount set must not see a
                // panel belonging to a plugin that is gone.
                return [4 /*yield*/, (0, bun_test_1.expect)(host.mountPanel("panels.web", "chat", fakeRoot())).rejects.toThrow(/ui plugin not loaded/)];
            case 5:
                // Removed as well as disposed: a listener reading the mount set must not see a
                // panel belonging to a plugin that is gone.
                _a.sent();
                return [4 /*yield*/, host.close()];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("remounting the same panel key disposes the previous panel first", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, fixture, seen, plugin, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                root = fakeRoot();
                fixture = runtimeFixture();
                seen = [];
                plugin = (0, src_1.defineUiPlugin)({
                    id: "panels.web",
                    name: "Panels",
                    version: "1.0.0",
                    panels: [
                        {
                            id: "chat",
                            title: "Chat",
                            region: "side",
                            mount: function () {
                                seen.push("mount");
                                return function () {
                                    seen.push("dispose");
                                };
                            },
                        },
                    ],
                    mount: function () { return undefined; },
                });
                return [4 /*yield*/, (0, src_1.createUiPluginHost)({ root: root, runtime: fixture.runtime })];
            case 1:
                host = _a.sent();
                return [4 /*yield*/, host.load(plugin)];
            case 2:
                _a.sent();
                return [4 /*yield*/, host.mountPanel("panels.web", "chat", fakeRoot())];
            case 3:
                _a.sent();
                return [4 /*yield*/, host.mountPanel("panels.web", "chat", fakeRoot())];
            case 4:
                _a.sent();
                // Each re-mount tears down the panel it replaces before mounting the next.
                (0, bun_test_1.expect)(seen).toEqual(["mount", "dispose", "mount"]);
                return [4 /*yield*/, host.close()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
