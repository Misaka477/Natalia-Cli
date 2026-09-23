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
exports.createUiPluginHost = createUiPluginHost;
var viewStore = require("@natalia/view-store");
var ui_model_1 = require("@natalia/ui-model");
var events_1 = require("./events");
var logger_1 = require("./logger");
var preferences_1 = require("./preferences");
var transport_1 = require("./transport");
function createUiPluginHost(options) {
    return __awaiter(this, void 0, void 0, function () {
        /**
         * Session keys are `${workspaceID ?? "default"}:${sessionID}`. Before the
         * workspace registry is known a session's hydrated history can land on the
         * `default:` key. A later event carrying the concrete workspace id used to
         * create a second, empty shell key that then won `activateSession` and wiped
         * the visible transcript. Treat `default:` as the workspace-unknown home for
         * that session.
         */
        function conversationContentScore(candidate) {
            if (!candidate)
                return 0;
            return (candidate.messages.length +
                Object.keys(candidate.streams).length +
                Object.keys(candidate.tools).length);
        }
        function hasConversationContent(candidate) {
            return conversationContentScore(candidate) > 0;
        }
        function workspaceUnknownKey(sessionID) {
            var key = "default:".concat(sessionID);
            return hasConversationContent(sessionStates.get(key)) ? key : undefined;
        }
        function ctxFor(plugin) {
            var _this = this;
            return {
                root: options.root,
                runtime: options.runtime,
                viewStore: viewStore,
                projection: projection,
                events: {
                    emit: events.emit,
                    subscribe: function (listener, filter) {
                        return events.subscribe(listener, filter !== null && filter !== void 0 ? filter : plugin.events);
                    },
                },
                preferences: preferences,
                resources: {
                    read: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!options.runtime.resourceRead)
                                            throw new Error("runtime does not provide resourceRead");
                                        return [4 /*yield*/, options.runtime.resourceRead(__assign(__assign({ resource: input.resource }, (input.params ? { params: input.params } : {})), { reader: plugin.id }))];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        });
                    },
                },
                transport: transport,
                logger: logger,
                t: t,
                pending: {
                    registerPresenter: function (presenter) {
                        var existing = presenters.get(presenter.kind);
                        if (existing &&
                            existing.pluginId === plugin.id &&
                            existing.presenter === presenter)
                            // Re-registering the same presenter is a no-op; notifying here
                            // would make a remounting panel fight the panel revision.
                            return function () { };
                        if (existing && existing.pluginId !== plugin.id)
                            throw new Error("pending presenter for kind \"".concat(presenter.kind, "\" is already owned by ").concat(existing.pluginId));
                        presenters.set(presenter.kind, {
                            pluginId: plugin.id,
                            presenter: presenter,
                        });
                        for (var _i = 0, panelListeners_1 = panelListeners; _i < panelListeners_1.length; _i++) {
                            var listener = panelListeners_1[_i];
                            listener();
                        }
                        return function () {
                            var current = presenters.get(presenter.kind);
                            if ((current === null || current === void 0 ? void 0 : current.pluginId) === plugin.id &&
                                current.presenter === presenter) {
                                presenters.delete(presenter.kind);
                                for (var _i = 0, panelListeners_2 = panelListeners; _i < panelListeners_2.length; _i++) {
                                    var listener = panelListeners_2[_i];
                                    listener();
                                }
                            }
                        };
                    },
                    presenters: function () {
                        var view = new Map();
                        for (var _i = 0, presenters_1 = presenters; _i < presenters_1.length; _i++) {
                            var _a = presenters_1[_i], kind = _a[0], entry = _a[1];
                            view.set(kind, entry.presenter);
                        }
                        return view;
                    },
                    controller: pendingController,
                },
                extra: options.extra,
                host: {
                    listPanels: function () {
                        return __spreadArray([], mounted.values(), true).flatMap(function (entry) {
                            return entry.record.panels.map(function (panel) { return ({
                                pluginId: entry.record.plugin.id,
                                panel: panel,
                            }); });
                        });
                    },
                    mountPanel: function (pluginId, panelId, container) { return __awaiter(_this, void 0, void 0, function () {
                        var entry, panel, key, existing, dispose;
                        var _a, _b, _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    entry = mounted.get(pluginId);
                                    if (!entry)
                                        throw new Error("ui plugin not loaded: ".concat(pluginId));
                                    panel = entry.record.panels.find(function (item) { return item.id === panelId; });
                                    if (!panel)
                                        throw new Error("ui panel not found: ".concat(pluginId, ":").concat(panelId));
                                    if (!panel.mount)
                                        throw new Error("ui panel has no mount: ".concat(pluginId, ":").concat(panelId));
                                    key = "".concat(pluginId, ":").concat(panelId);
                                    existing = mountedPanels.get(key);
                                    (_a = existing === null || existing === void 0 ? void 0 : existing.dispose) === null || _a === void 0 ? void 0 : _a.call(existing);
                                    (_c = (_b = existing === null || existing === void 0 ? void 0 : existing.lifecycle) === null || _b === void 0 ? void 0 : _b.dispose) === null || _c === void 0 ? void 0 : _c.call(_b);
                                    return [4 /*yield*/, panel.mount(ctxFor(entry.record.plugin), container)];
                                case 1:
                                    dispose = (_d.sent());
                                    mountedPanels.set(key, __assign({}, (dispose ? { dispose: dispose } : {})));
                                    return [2 /*return*/];
                            }
                        });
                    }); },
                    subscribePanels: function (listener) {
                        panelListeners.add(listener);
                        return function () {
                            panelListeners.delete(listener);
                        };
                    },
                    loaded: function () {
                        return __spreadArray([], mounted.values(), true).map(function (entry) { return (__assign({ pluginId: entry.record.plugin.id, name: entry.record.plugin.name, version: entry.record.plugin.version }, (entry.record.plugin.shellLayout
                            ? { shellLayout: entry.record.plugin.shellLayout }
                            : {}))); });
                    },
                    unload: function (pluginId) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, unloadPlugin(pluginId)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); },
                    load: function (plugin) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, loadPlugin(plugin)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); },
                },
            };
        }
        function loadPlugin(plugin) {
            return __awaiter(this, void 0, void 0, function () {
                var ctx, lifecycle, record, _i, panelListeners_3, listener;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (closed)
                                throw new Error("ui plugin host is closed");
                            if (mounted.has(plugin.id))
                                throw new Error("ui plugin already loaded: ".concat(plugin.id));
                            ctx = ctxFor(plugin);
                            return [4 /*yield*/, plugin.mount(ctx)];
                        case 1:
                            lifecycle = _c.sent();
                            record = {
                                plugin: plugin,
                                panels: (_a = plugin.panels) !== null && _a !== void 0 ? _a : [],
                                commands: (_b = plugin.commands) !== null && _b !== void 0 ? _b : [],
                            };
                            mounted.set(plugin.id, __assign({ record: record }, (lifecycle ? { lifecycle: lifecycle } : {})));
                            for (_i = 0, panelListeners_3 = panelListeners; _i < panelListeners_3.length; _i++) {
                                listener = panelListeners_3[_i];
                                listener();
                            }
                            startRuntime();
                            logger.info("loaded ".concat(plugin.id, "@").concat(plugin.version));
                            return [2 /*return*/, record];
                    }
                });
            });
        }
        function unloadPlugin(id) {
            return __awaiter(this, void 0, void 0, function () {
                var entry, _i, _a, _b, key, panel, _c, _d, _e, kind, owned, _f, panelListeners_4, listener;
                var _g, _h, _j, _k, _l;
                return __generator(this, function (_m) {
                    switch (_m.label) {
                        case 0:
                            entry = mounted.get(id);
                            if (!entry)
                                return [2 /*return*/];
                            mounted.delete(id);
                            _i = 0, _a = __spreadArray([], mountedPanels, true);
                            _m.label = 1;
                        case 1:
                            if (!(_i < _a.length)) return [3 /*break*/, 4];
                            _b = _a[_i], key = _b[0], panel = _b[1];
                            if (!key.startsWith("".concat(id, ":"))) return [3 /*break*/, 3];
                            mountedPanels.delete(key);
                            (_g = panel.dispose) === null || _g === void 0 ? void 0 : _g.call(panel);
                            return [4 /*yield*/, ((_h = panel.lifecycle) === null || _h === void 0 ? void 0 : _h.dispose())];
                        case 2:
                            _m.sent();
                            _m.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4:
                            for (_c = 0, _d = __spreadArray([], presenters, true); _c < _d.length; _c++) {
                                _e = _d[_c], kind = _e[0], owned = _e[1];
                                if (owned.pluginId === id)
                                    presenters.delete(kind);
                            }
                            for (_f = 0, panelListeners_4 = panelListeners; _f < panelListeners_4.length; _f++) {
                                listener = panelListeners_4[_f];
                                listener();
                            }
                            _m.label = 5;
                        case 5:
                            _m.trys.push([5, , 7, 9]);
                            return [4 /*yield*/, ((_j = entry.lifecycle) === null || _j === void 0 ? void 0 : _j.dispose())];
                        case 6:
                            _m.sent();
                            return [3 /*break*/, 9];
                        case 7: return [4 /*yield*/, ((_l = (_k = entry.record.plugin).unmount) === null || _l === void 0 ? void 0 : _l.call(_k))];
                        case 8:
                            _m.sent();
                            return [7 /*endfinally*/];
                        case 9:
                            logger.info("unloaded ".concat(id));
                            return [2 /*return*/];
                    }
                });
            });
        }
        var logger, preferences, transport, t, events, sessionStates, activeKey, state, projectionListeners, mounted, mountedPanels, presenters, panelListeners, pendingController, started, closed, projection, fanout, startRuntime;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            logger = (_a = options.logger) !== null && _a !== void 0 ? _a : (0, logger_1.createSilentLogger)();
            preferences = (_b = options.preferences) !== null && _b !== void 0 ? _b : (0, preferences_1.createMemoryPreferenceStore)();
            transport = (_c = options.transport) !== null && _c !== void 0 ? _c : (0, transport_1.createMemoryTransport)();
            t = (_d = options.t) !== null && _d !== void 0 ? _d : (function (text) { return text; });
            events = (0, events_1.createUiEventBus)();
            sessionStates = new Map();
            state = viewStore.initialState();
            projectionListeners = new Set();
            mounted = new Map();
            mountedPanels = new Map();
            presenters = new Map();
            panelListeners = new Set();
            pendingController = (0, ui_model_1.createPendingController)(function () {
                for (var _i = 0, panelListeners_5 = panelListeners; _i < panelListeners_5.length; _i++) {
                    var listener = panelListeners_5[_i];
                    listener();
                }
            });
            started = false;
            closed = false;
            projection = {
                getState: function () { return state; },
                subscribe: function (listener) {
                    projectionListeners.add(listener);
                    return function () {
                        projectionListeners.delete(listener);
                    };
                },
                hydrateMessages: function (messages, direction, options) {
                    if (direction === void 0) { direction = "older"; }
                    var evicted = viewStore.hydrateProjectedMessages(state, messages, direction, options);
                    for (var _i = 0, projectionListeners_1 = projectionListeners; _i < projectionListeners_1.length; _i++) {
                        var listener = projectionListeners_1[_i];
                        listener(state);
                    }
                    return evicted;
                },
                hydrateNaviMessages: function (messages, options) {
                    var evicted = viewStore.hydrateNaviMessages(state, messages, options);
                    for (var _i = 0, projectionListeners_2 = projectionListeners; _i < projectionListeners_2.length; _i++) {
                        var listener = projectionListeners_2[_i];
                        listener(state);
                    }
                    return evicted;
                },
                hydrateNiaMessages: function (messages, options) {
                    var evicted = viewStore.hydrateNiaMessages(state, messages, options);
                    for (var _i = 0, projectionListeners_3 = projectionListeners; _i < projectionListeners_3.length; _i++) {
                        var listener = projectionListeners_3[_i];
                        listener(state);
                    }
                    return evicted;
                },
                hydrateRuntimeNotices: function (notices) {
                    var changed = viewStore.hydrateRuntimeNotices(state, notices);
                    if (changed)
                        for (var _i = 0, projectionListeners_4 = projectionListeners; _i < projectionListeners_4.length; _i++) {
                            var listener = projectionListeners_4[_i];
                            listener(state);
                        }
                    return changed;
                },
                beginNaviHydration: function () {
                    viewStore.beginNaviHydration(state);
                },
                beginNiaHydration: function () {
                    viewStore.beginNiaHydration(state);
                },
                hydrateSubagents: function (subagents) {
                    var changed = viewStore.hydrateSubagents(state, subagents);
                    for (var _i = 0, projectionListeners_5 = projectionListeners; _i < projectionListeners_5.length; _i++) {
                        var listener = projectionListeners_5[_i];
                        listener(state);
                    }
                    return changed;
                },
                hydrateSubagentHistory: function (history, options) {
                    var changed = viewStore.hydrateSubagentHistory(state, history, options);
                    for (var _i = 0, projectionListeners_6 = projectionListeners; _i < projectionListeners_6.length; _i++) {
                        var listener = projectionListeners_6[_i];
                        listener(state);
                    }
                    return changed;
                },
                activateSession: function (sessionID, workspaceID) {
                    var _a, _b, _c;
                    var preferredKey = "".concat(workspaceID !== null && workspaceID !== void 0 ? workspaceID : "default", ":").concat(sessionID);
                    var preferredState = sessionStates.get(preferredKey);
                    var defaultKey = "default:".concat(sessionID);
                    var defaultState = sessionStates.get(defaultKey);
                    var siblingKeys = __spreadArray([], sessionStates.keys(), true).filter(function (key) { return key !== preferredKey && key.endsWith(":".concat(sessionID)); });
                    var selectedKey = sessionStates.has(preferredKey)
                        ? preferredKey
                        : ((_a = siblingKeys[0]) !== null && _a !== void 0 ? _a : preferredKey);
                    // A concrete-workspace key created by a late event is usually a shell.
                    // When the workspace-unknown `default:` key holds this session's history,
                    // prefer whichever side actually has more conversation content.
                    if (defaultKey !== preferredKey && hasConversationContent(defaultState)) {
                        if (!hasConversationContent(preferredState) ||
                            conversationContentScore(defaultState) >=
                                conversationContentScore(preferredState)) {
                            selectedKey = defaultKey;
                        }
                    }
                    else if (selectedKey === preferredKey &&
                        !hasConversationContent(preferredState)) {
                        var hydrated = siblingKeys.find(function (key) {
                            return hasConversationContent(sessionStates.get(key));
                        });
                        if (hydrated)
                            selectedKey = hydrated;
                    }
                    activeKey = selectedKey;
                    state = (_b = sessionStates.get(activeKey)) !== null && _b !== void 0 ? _b : viewStore.initialState();
                    (_c = state.sessionID) !== null && _c !== void 0 ? _c : (state.sessionID = sessionID);
                    sessionStates.set(activeKey, state);
                    for (var _i = 0, projectionListeners_7 = projectionListeners; _i < projectionListeners_7.length; _i++) {
                        var listener = projectionListeners_7[_i];
                        listener(state);
                    }
                },
            };
            fanout = function (event) {
                var _a, _b, _c;
                var sessionID = event.sessionID;
                var workspaceID = event.workspaceID;
                var activeSessionID = activeKey
                    ? activeKey.slice(activeKey.lastIndexOf(":") + 1)
                    : undefined;
                var key = sessionID && activeSessionID && sessionID === activeSessionID
                    ? activeKey
                    : sessionID
                        ? "".concat(workspaceID !== null && workspaceID !== void 0 ? workspaceID : "default", ":").concat(sessionID)
                        : activeKey;
                // Do not fork a second state key for a session whose history already lives
                // on the workspace-unknown `default:` key.
                if (key &&
                    sessionID &&
                    workspaceID &&
                    workspaceID !== "default" &&
                    !sessionStates.has(key)) {
                    key = (_a = workspaceUnknownKey(sessionID)) !== null && _a !== void 0 ? _a : key;
                }
                if (!key) {
                    viewStore.applyEvent(state, event);
                    for (var _i = 0, projectionListeners_8 = projectionListeners; _i < projectionListeners_8.length; _i++) {
                        var listener = projectionListeners_8[_i];
                        listener(state);
                    }
                    events.emit(event);
                    return;
                }
                var target = (_b = sessionStates.get(key)) !== null && _b !== void 0 ? _b : viewStore.initialState();
                if (sessionID)
                    (_c = target.sessionID) !== null && _c !== void 0 ? _c : (target.sessionID = sessionID);
                sessionStates.set(key, target);
                viewStore.applyEvent(target, event);
                var shouldRender = key === activeKey ||
                    (sessionID &&
                        !activeKey &&
                        (!state.sessionID || state.sessionID === sessionID));
                if (shouldRender) {
                    if (!activeKey)
                        activeKey = key;
                    state = target;
                    for (var _d = 0, projectionListeners_9 = projectionListeners; _d < projectionListeners_9.length; _d++) {
                        var listener = projectionListeners_9[_d];
                        listener(state);
                    }
                }
                events.emit(event);
            };
            startRuntime = function () {
                var _a;
                if (started)
                    return;
                started = true;
                options.runtime.start(fanout, { replay: (_a = options.replay) !== null && _a !== void 0 ? _a : "all" });
            };
            return [2 /*return*/, {
                    projection: projection,
                    load: function (plugin) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, loadPlugin(plugin)];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        });
                    },
                    unload: function (id) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, unloadPlugin(id)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                    loaded: function () {
                        return __spreadArray([], mounted.values(), true).map(function (entry) { return entry.record; });
                    },
                    listPanels: function () {
                        return __spreadArray([], mounted.values(), true).flatMap(function (entry) {
                            return entry.record.panels.map(function (panel) { return ({
                                pluginId: entry.record.plugin.id,
                                panel: panel,
                            }); });
                        });
                    },
                    mountPanel: function (pluginId, panelId, container) {
                        return __awaiter(this, void 0, void 0, function () {
                            var entry, panel, key, existing, dispose;
                            var _a, _b, _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        entry = mounted.get(pluginId);
                                        if (!entry)
                                            throw new Error("ui plugin not loaded: ".concat(pluginId));
                                        panel = entry.record.panels.find(function (item) { return item.id === panelId; });
                                        if (!panel)
                                            throw new Error("ui panel not found: ".concat(pluginId, ":").concat(panelId));
                                        if (!panel.mount)
                                            throw new Error("ui panel has no mount: ".concat(pluginId, ":").concat(panelId));
                                        key = "".concat(pluginId, ":").concat(panelId);
                                        existing = mountedPanels.get(key);
                                        (_a = existing === null || existing === void 0 ? void 0 : existing.dispose) === null || _a === void 0 ? void 0 : _a.call(existing);
                                        (_c = (_b = existing === null || existing === void 0 ? void 0 : existing.lifecycle) === null || _b === void 0 ? void 0 : _b.dispose) === null || _c === void 0 ? void 0 : _c.call(_b);
                                        return [4 /*yield*/, panel.mount(ctxFor(entry.record.plugin), container)];
                                    case 1:
                                        dispose = (_d.sent());
                                        mountedPanels.set(key, __assign({}, (dispose ? { dispose: dispose } : {})));
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                    subscribePanels: function (listener) {
                        panelListeners.add(listener);
                        return function () {
                            panelListeners.delete(listener);
                        };
                    },
                    executeCommand: function (name, args) {
                        return __awaiter(this, void 0, void 0, function () {
                            var _i, _a, entry, command;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _i = 0, _a = mounted.values();
                                        _b.label = 1;
                                    case 1:
                                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                                        entry = _a[_i];
                                        command = entry.record.commands.find(function (item) { return item.id === name; });
                                        if (!command) return [3 /*break*/, 3];
                                        return [4 /*yield*/, command.run(args)];
                                    case 2: return [2 /*return*/, _b.sent()];
                                    case 3:
                                        _i++;
                                        return [3 /*break*/, 1];
                                    case 4: return [2 /*return*/, executeRuntimeCommand(options.runtime, name, args)];
                                }
                            });
                        });
                    },
                    close: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var ids, errors, _i, ids_1, id, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (closed)
                                            return [2 /*return*/];
                                        closed = true;
                                        ids = __spreadArray([], mounted.keys(), true);
                                        errors = [];
                                        _i = 0, ids_1 = ids;
                                        _a.label = 1;
                                    case 1:
                                        if (!(_i < ids_1.length)) return [3 /*break*/, 6];
                                        id = ids_1[_i];
                                        _a.label = 2;
                                    case 2:
                                        _a.trys.push([2, 4, , 5]);
                                        return [4 /*yield*/, unloadPlugin(id)];
                                    case 3:
                                        _a.sent();
                                        return [3 /*break*/, 5];
                                    case 4:
                                        error_1 = _a.sent();
                                        errors.push(error_1);
                                        return [3 /*break*/, 5];
                                    case 5:
                                        _i++;
                                        return [3 /*break*/, 1];
                                    case 6:
                                        if (errors.length)
                                            throw new AggregateError(errors, "ui plugin host cleanup failed");
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }];
        });
    });
}
function executeRuntimeCommand(runtime, name, args) {
    return __awaiter(this, void 0, void 0, function () {
        var text;
        var _a;
        return __generator(this, function (_b) {
            if (name === "runtime.submit")
                return [2 /*return*/, runtime.submit(String(args !== null && args !== void 0 ? args : ""))];
            if (name === "runtime.chatSubmit") {
                if (!((_a = runtime.naviChat) === null || _a === void 0 ? void 0 : _a.submit))
                    throw new Error("runtime command execution unavailable");
                text = typeof args === "object" && args && "text" in args
                    ? String(args.text)
                    : String(args !== null && args !== void 0 ? args : "");
                return [2 /*return*/, runtime.naviChat.submit({ text: text })];
            }
            if (name === "runtime.cancel") {
                runtime.cancel(typeof args === "string" ? args : undefined);
                return [2 /*return*/];
            }
            throw new Error("command unavailable: ".concat(name));
        });
    });
}
