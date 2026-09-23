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
exports.loadLocalPlugins = loadLocalPlugins;
exports.loadPluginEntries = loadPluginEntries;
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
var discovery_1 = require("./discovery");
var dependencies_1 = require("./dependencies");
var installed_1 = require("./installed");
function loadLocalPlugins(input) {
    return __awaiter(this, void 0, void 0, function () {
        var discovered, _i, _a, root, _b, _c, item;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    discovered = [];
                    _i = 0, _a = input.roots;
                    _e.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    root = _a[_i];
                    _b = 0;
                    return [4 /*yield*/, (0, discovery_1.discoverPluginManifests)(root)];
                case 2:
                    _c = _e.sent();
                    _e.label = 3;
                case 3:
                    if (!(_b < _c.length)) return [3 /*break*/, 5];
                    item = _c[_b];
                    if (((_d = input.enabled) === null || _d === void 0 ? void 0 : _d[item.manifest.id]) !== false)
                        discovered.push(item);
                    _e.label = 4;
                case 4:
                    _b++;
                    return [3 /*break*/, 3];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/, loadPluginEntries(__assign(__assign({}, input), { entries: discovered }))];
            }
        });
    });
}
function loadPluginEntries(input) {
    return __awaiter(this, void 0, void 0, function () {
        var loaded, resolution, _i, _a, unresolved, byID, _b, _c, id, item, manifest, path, entry, module_1, plugin, candidate, error_1;
        var _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    loaded = [];
                    resolution = (0, dependencies_1.resolvePluginDependencies)(input.entries.map(function (item) { return item.manifest; }), input.registry.list().filter(function (manifest) {
                        var _a;
                        var status = (_a = input.registry.status(manifest.id)) === null || _a === void 0 ? void 0 : _a.status;
                        return status === "active" || status === "pending";
                    }), input.registry.list());
                    for (_i = 0, _a = __spreadArray(__spreadArray([], resolution.denied, true), resolution.pending, true); _i < _a.length; _i++) {
                        unresolved = _a[_i];
                        (_d = input.onError) === null || _d === void 0 ? void 0 : _d.call(input, unresolved.id, new Error("plugin dependency unresolved: ".concat(unresolved.reason)));
                    }
                    byID = new Map(input.entries.map(function (item) { return [item.manifest.id, item]; }));
                    _b = 0, _c = resolution.order;
                    _g.label = 1;
                case 1:
                    if (!(_b < _c.length)) return [3 /*break*/, 7];
                    id = _c[_b];
                    item = byID.get(id);
                    if (!item)
                        return [3 /*break*/, 6];
                    manifest = item.manifest, path = item.path;
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 5, , 6]);
                    entry = (0, installed_1.validatePluginPath)((0, node_path_1.resolve)(path, ".."), manifest.entry);
                    return [4 /*yield*/, Promise.resolve("".concat((0, node_url_1.pathToFileURL)(entry).href)).then(function (s) { return require(s); })];
                case 3:
                    module_1 = (_g.sent());
                    plugin = typeof module_1.default === "function"
                        ? module_1.default()
                        : module_1.default;
                    if (!plugin || typeof plugin !== "object")
                        throw new Error("plugin module has no default export: ".concat(manifest.id));
                    candidate = plugin;
                    if (!candidate.setup || typeof candidate.setup !== "function")
                        throw new Error("plugin module has no setup function: ".concat(manifest.id));
                    return [4 /*yield*/, input.registry.load(__assign(__assign({}, candidate), { manifest: manifest }), (_e = input.settings) === null || _e === void 0 ? void 0 : _e[manifest.id])];
                case 4:
                    _g.sent();
                    loaded.push(manifest);
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _g.sent();
                    (_f = input.onError) === null || _f === void 0 ? void 0 : _f.call(input, manifest.id, error_1);
                    return [3 /*break*/, 6];
                case 6:
                    _b++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, loaded];
            }
        });
    });
}
