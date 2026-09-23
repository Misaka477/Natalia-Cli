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
exports.doctorPlugins = doctorPlugins;
exports.reconcilePlugins = reconcilePlugins;
var plugin_1 = require("@natalia/plugin");
var closure_1 = require("./closure");
var lifecycle_1 = require("./lifecycle");
var package_metadata_1 = require("./package-metadata");
function doctorPlugins(pluginStoreRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var lock, findings, _i, _a, _b, id, entry, manifest;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, (0, closure_1.loadNataliaLock)(pluginStoreRoot)];
                case 1:
                    lock = _d.sent();
                    findings = [];
                    _i = 0, _a = Object.entries(lock.plugins);
                    _d.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    _b = _a[_i], id = _b[0], entry = _b[1];
                    return [4 /*yield*/, (0, plugin_1.discoverPluginManifests)((0, closure_1.packageDirectory)((0, closure_1.pluginClosurePaths)(pluginStoreRoot).pluginsDir, entry.packageName), { nodeModules: false })];
                case 3:
                    manifest = (_c = (_d.sent())[0]) === null || _c === void 0 ? void 0 : _c.manifest;
                    if (!manifest)
                        findings.push({
                            pluginID: id,
                            code: "package_missing",
                            message: "plugin ".concat(id, " package is missing from the installation closure"),
                        });
                    else if (manifest.id !== id ||
                        manifest.version !== entry.metadata.resolvedVersion)
                        findings.push({
                            pluginID: id,
                            code: "manifest_mismatch",
                            message: "plugin ".concat(id, " manifest does not match natalia.lock"),
                        });
                    _d.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, findings];
            }
        });
    });
}
function reconcilePlugins(pluginStoreRoot_1) {
    return __awaiter(this, arguments, void 0, function (pluginStoreRoot, runPackageManager, seams) {
        var lock, findings, _i, findings_1, finding, entry;
        var _a;
        var _b;
        if (runPackageManager === void 0) { runPackageManager = closure_1.runNpm; }
        if (seams === void 0) { seams = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, closure_1.loadNataliaLock)(pluginStoreRoot)];
                case 1:
                    lock = _c.sent();
                    return [4 /*yield*/, doctorPlugins(pluginStoreRoot)];
                case 2:
                    findings = _c.sent();
                    _i = 0, findings_1 = findings;
                    _c.label = 3;
                case 3:
                    if (!(_i < findings_1.length)) return [3 /*break*/, 6];
                    finding = findings_1[_i];
                    if (finding.code !== "package_missing")
                        return [3 /*break*/, 5];
                    entry = lock.plugins[finding.pluginID];
                    if (!entry)
                        return [3 /*break*/, 5];
                    return [4 /*yield*/, ((_b = seams.installPlugin) !== null && _b !== void 0 ? _b : lifecycle_1.installPlugin)({
                            pluginStoreRoot: pluginStoreRoot,
                            spec: (0, package_metadata_1.sourceSpec)(entry.metadata.source),
                            runPackageManager: runPackageManager,
                        })];
                case 4:
                    _c.sent();
                    _c.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    _a = {
                        reconciled: true,
                        findings: findings
                    };
                    return [4 /*yield*/, doctorPlugins(pluginStoreRoot)];
                case 7: return [2 /*return*/, (_a.remaining = _c.sent(),
                        _a)];
            }
        });
    });
}
