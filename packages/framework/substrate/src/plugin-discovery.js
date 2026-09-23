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
exports.discoverDesiredPluginEntries = discoverDesiredPluginEntries;
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
var plugin_1 = require("@natalia/plugin");
function discoverDesiredPluginEntries(input) {
    return __awaiter(this, void 0, void 0, function () {
        var installed, _a, _i, _b, failure, ids, _c, _d, id, pathEntries, _e, _f, rawPath, root, _g, _h, item, entries;
        var _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    if (!input.pluginStoreRoot) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, plugin_1.resolveInstalledPluginEntries)({
                            pluginStoreRoot: input.pluginStoreRoot,
                            enabled: input.enabled,
                        })];
                case 1:
                    _a = _m.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = { entries: [], errors: [] };
                    _m.label = 3;
                case 3:
                    installed = _a;
                    for (_i = 0, _b = installed.errors; _i < _b.length; _i++) {
                        failure = _b[_i];
                        input.onError(failure.id, failure.error);
                    }
                    ids = new Set(input.declaredIDs);
                    for (_c = 0, _d = installed.entries.map(function (_a) {
                        var manifest = _a.manifest;
                        return manifest.id;
                    }); _c < _d.length; _c++) {
                        id = _d[_c];
                        if (ids.has(id))
                            throw new Error("duplicate plugin id: ".concat(id));
                        ids.add(id);
                    }
                    pathEntries = [];
                    _e = 0, _f = (_j = input.paths) !== null && _j !== void 0 ? _j : [];
                    _m.label = 4;
                case 4:
                    if (!(_e < _f.length)) return [3 /*break*/, 9];
                    rawPath = _f[_e];
                    root = (0, node_path_1.resolve)((_k = input.workspaceRoot) !== null && _k !== void 0 ? _k : process.cwd(), rawPath);
                    _g = 0;
                    return [4 /*yield*/, (0, plugin_1.discoverPluginManifests)(root, {
                            nodeModules: false,
                        })];
                case 5:
                    _h = _m.sent();
                    _m.label = 6;
                case 6:
                    if (!(_g < _h.length)) return [3 /*break*/, 8];
                    item = _h[_g];
                    if (((_l = input.enabled) === null || _l === void 0 ? void 0 : _l[item.manifest.id]) === false)
                        return [3 /*break*/, 7];
                    // Installed/declared entries are authoritative; a path that points at the
                    // same source package must not turn into a duplicate-id failure.
                    if (ids.has(item.manifest.id))
                        return [3 /*break*/, 7];
                    ids.add(item.manifest.id);
                    pathEntries.push({ manifest: item.manifest, path: item.path });
                    _m.label = 7;
                case 7:
                    _g++;
                    return [3 /*break*/, 6];
                case 8:
                    _e++;
                    return [3 /*break*/, 4];
                case 9:
                    entries = installed.entries.map(function (entry) { return desiredEntry(entry, input); });
                    return [2 /*return*/, __spreadArray(__spreadArray([], entries, true), pathEntries.map(function (entry) { return desiredEntry(entry, input); }), true)];
            }
        });
    });
}
function desiredEntry(entry, input) {
    var manifest = entry.manifest, path = entry.path;
    return {
        id: manifest.id,
        enabled: true,
        fingerprint: JSON.stringify({ manifest: manifest, path: path }),
        manifest: manifest,
        onError: function (error) { return input.onError(manifest.id, error); },
        load: function (cacheBust) {
            return __awaiter(this, void 0, void 0, function () {
                var modulePath, moduleURL, specifier, module, candidate;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            modulePath = (0, plugin_1.validatePluginPath)((0, node_path_1.resolve)(path, ".."), manifest.entry);
                            moduleURL = (0, node_url_1.pathToFileURL)(modulePath).href;
                            specifier = cacheBust
                                ? "".concat(moduleURL, "?reload=").concat(cacheBust)
                                : moduleURL;
                            return [4 /*yield*/, Promise.resolve("".concat(specifier)).then(function (s) { return require(s); })];
                        case 1:
                            module = (_a.sent());
                            candidate = (typeof module.default === "function" ? module.default() : module.default);
                            if (!(candidate === null || candidate === void 0 ? void 0 : candidate.setup) || typeof candidate.setup !== "function")
                                throw new Error("plugin module has no setup function: ".concat(manifest.id));
                            return [2 /*return*/, __assign(__assign({}, candidate), { manifest: manifest })];
                    }
                });
            });
        },
    };
}
