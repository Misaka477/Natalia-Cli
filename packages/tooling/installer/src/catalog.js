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
exports.listInstalledPlugins = listInstalledPlugins;
var config_1 = require("@natalia/config");
var plugin_1 = require("@natalia/plugin");
var closure_1 = require("./closure");
function listInstalledPlugins(input) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, lock, config, rows, _i, _b, entry, packageDir, manifest;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        (0, closure_1.loadNataliaLock)(input.pluginStoreRoot),
                        (0, config_1.resolveConfig)(input),
                    ])];
                case 1:
                    _a = _e.sent(), lock = _a[0], config = _a[1].config;
                    rows = [];
                    _i = 0, _b = Object.values(lock.plugins);
                    _e.label = 2;
                case 2:
                    if (!(_i < _b.length)) return [3 /*break*/, 5];
                    entry = _b[_i];
                    packageDir = (0, closure_1.packageDirectory)((0, closure_1.pluginClosurePaths)(input.pluginStoreRoot).pluginsDir, entry.packageName);
                    return [4 /*yield*/, (0, plugin_1.discoverPluginManifests)(packageDir, { nodeModules: false })];
                case 3:
                    manifest = (_c = (_e.sent())[0]) === null || _c === void 0 ? void 0 : _c.manifest;
                    rows.push({
                        id: entry.metadata.id,
                        name: (_d = manifest === null || manifest === void 0 ? void 0 : manifest.name) !== null && _d !== void 0 ? _d : null,
                        version: entry.metadata.resolvedVersion,
                        scope: entry.metadata.scope,
                        enabled: config.plugins.enabled[entry.metadata.id] !== false,
                        installed: true,
                        source: entry.metadata.source,
                        packageName: entry.packageName,
                        ui: (manifest === null || manifest === void 0 ? void 0 : manifest.apiVersion) === 2 ? manifest.ui : undefined,
                    });
                    _e.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, rows.sort(function (left, right) { return left.id.localeCompare(right.id); })];
            }
        });
    });
}
