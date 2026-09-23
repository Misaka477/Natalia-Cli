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
exports.createExtensionsRuntime = createExtensionsRuntime;
var plugin_1 = require("@natalia/plugin");
var secondary_worker_client_1 = require("../secondary-worker-client");
var substrate_1 = require("@anthelia/substrate");
function createExtensionsRuntime(ctx) {
    return {
        plugins: function () {
            return __awaiter(this, void 0, void 0, function () {
                var plugins, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            plugins = ctx.ports.getPluginsController().list();
                            _b.label = 2;
                        case 2:
                            _b.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, (0, secondary_worker_client_1.projectPluginsInWorker)(plugins)];
                        case 3: return [2 /*return*/, _b.sent()];
                        case 4:
                            _a = _b.sent();
                            return [2 /*return*/, plugins.map(function (plugin) { return ({
                                    id: plugin.id,
                                    version: plugin.version,
                                    name: plugin.name,
                                    description: plugin.description,
                                    capabilities: (0, plugin_1.manifestIntegrationPoints)(plugin),
                                }); })];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        },
        commandCatalog: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: 
                        // The catalog reads the plugin registry and capability contributions,
                        // which only exist after initialize; on a cold start the request could
                        // otherwise race ahead of it.
                        return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            // The catalog reads the plugin registry and capability contributions,
                            // which only exist after initialize; on a cold start the request could
                            // otherwise race ahead of it.
                            _a.sent();
                            return [2 /*return*/, ctx.ports.commandCatalogEntries().map(function (command) { return ({
                                    name: command.name,
                                    title: command.title,
                                    description: command.description,
                                    acceptsArguments: command.acceptsArguments,
                                    category: command.category,
                                }); })];
                    }
                });
            });
        },
        commandExecute: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var command, raw, expected;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.ensureReady()];
                        case 1:
                            _a.sent();
                            command = ctx.ports
                                .commandCatalogEntries()
                                .find(function (entry) { return entry.name === input.name; });
                            if (!command)
                                throw new Error("command unavailable: ".concat(input.name));
                            raw = input.raw.trim();
                            expected = "/".concat(input.name);
                            if (raw !== expected && !raw.startsWith("".concat(expected, " ")))
                                throw new Error("command input does not match ".concat(expected));
                            return [4 /*yield*/, ctx.ports.submitInput(__assign({ text: raw }, (input.sessionID ? { sessionID: input.sessionID } : {})))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        pluginUnload: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var before, result, _i, before_1, name_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            before = new Set(ctx.ports.getTools().keys());
                            return [4 /*yield*/, ctx.ports.getPluginsController().unload(id)];
                        case 2:
                            result = _a.sent();
                            // The plugin's tool disposers removed its tools from the registry; publish
                            // tool.unregistered for the ones that disappeared so the projected tool
                            // catalog stops reporting them (P5 dynamic unload).
                            for (_i = 0, before_1 = before; _i < before_1.length; _i++) {
                                name_1 = before_1[_i];
                                if (ctx.ports.getTools().has(name_1))
                                    continue;
                                ctx.ports.publish({
                                    type: "tool.unregistered",
                                    id: "tool:".concat(name_1),
                                    name: name_1,
                                });
                            }
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        pluginReload: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, ctx.ports.getPluginsController().reload(id)];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        toolFamilyReload: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, ctx.ports.hotReloadToolFamily(id)];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        projectionContributions: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, (0, substrate_1.snapshotProjectionContributions)(ctx.ports.getCapabilityRegistry())];
                    }
                });
            });
        },
        capabilities: function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: 
                        // The built-in catalogue registers during initialize; a query that skips
                        // `ready` would answer before those records exist.
                        return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            // The built-in catalogue registers during initialize; a query that skips
                            // `ready` would answer before those records exist.
                            _c.sent();
                            if (!ctx.ports.getCapabilityRegistry())
                                return [2 /*return*/, []];
                            return [2 /*return*/, __spreadArray(__spreadArray([], ((_b = (_a = ctx.ports.getWorkspaceCapabilityView()) === null || _a === void 0 ? void 0 : _a.list()) !== null && _b !== void 0 ? _b : []), true), ctx.ports.getCapabilityRegistry().list(), true).map(function (record) {
                                    // The effective contributions this capability owns, as metadata only.
                                    // Payloads stay on the host side: a tool definition or a settings value
                                    // must not leak through the query surface. Contributions that lost an
                                    // override are not effective and are omitted.
                                    var contributions = record.grants.flatMap(function (grant) {
                                        return ctx.ports
                                            .getCapabilityRegistry()
                                            .contributions(grant)
                                            .filter(function (entry) { return entry.capabilityID === record.id; })
                                            .map(function (entry) { return ({ kind: entry.kind, name: entry.name }); });
                                    });
                                    return {
                                        id: record.id,
                                        name: record.name,
                                        version: record.version,
                                        scope: record.scope,
                                        grants: record.grants,
                                        precedence: record.precedence,
                                        provides: contributions
                                            .filter(function (entry) { return entry.kind === "services"; })
                                            .map(function (entry) { return entry.name; }),
                                        contributions: contributions,
                                    };
                                })];
                    }
                });
            });
        },
    };
}
