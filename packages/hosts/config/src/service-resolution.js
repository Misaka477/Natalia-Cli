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
exports.GLOBAL_MODEL_CONFIG_KEYS = void 0;
exports.defaultGlobalConfigPath = defaultGlobalConfigPath;
exports.resolveConfig = resolveConfig;
exports.presentGlobalModelConfigKeys = presentGlobalModelConfigKeys;
exports.withoutGlobalModelConfig = withoutGlobalModelConfig;
exports.onlyGlobalModelConfig = onlyGlobalModelConfig;
var node_fs_1 = require("node:fs");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var contracts_1 = require("@natalia/contracts");
var platform_1 = require("@natalia/platform");
var file_1 = require("./file");
var service_merge_1 = require("./service-merge");
exports.GLOBAL_MODEL_CONFIG_KEYS = [
    "providers",
    "catalog",
    "modelOverrides",
    "defaultModel",
];
var globalModelConfigKeys = new Set(exports.GLOBAL_MODEL_CONFIG_KEYS);
function defaultGlobalConfigPath(input) {
    if (input === void 0) { input = {}; }
    return (0, node_path_1.resolve)((0, platform_1.globalConfigHome)(input), "natalia-cli", "config.json");
}
function resolveConfig(input) {
    return __awaiter(this, void 0, void 0, function () {
        var workspaceRoot, projectConfigPath, globalPath, config, sources, _i, _a, _b, scope, path, overlay, _c, ignored, error_1, model;
        var _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    workspaceRoot = (0, node_path_1.resolve)(input.workspaceRoot);
                    projectConfigPath = (0, node_path_1.resolve)(workspaceRoot, ".natalia", "config.json");
                    globalPath = (_d = input.globalPath) !== null && _d !== void 0 ? _d : defaultGlobalConfigPath();
                    config = contracts_1.configV3Schema.parse({ version: 3 });
                    sources = [{ scope: "defaults", applied: true }];
                    _i = 0, _a = [
                        ["global", globalPath],
                        ["project", projectConfigPath],
                    ];
                    _f.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    _b = _a[_i], scope = _b[0], path = _b[1];
                    if (!(0, node_fs_1.existsSync)(path)) {
                        sources.push({ scope: scope, path: path, applied: false, diagnostic: "missing" });
                        return [3 /*break*/, 5];
                    }
                    _f.label = 2;
                case 2:
                    _f.trys.push([2, 4, , 5]);
                    _c = file_1.parseConfigText;
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 3:
                    overlay = _c.apply(void 0, [_f.sent()]);
                    ignored = scope === "project" ? presentGlobalModelConfigKeys(overlay) : [];
                    config = (0, service_merge_1.mergeConfig)(config, scope === "project" ? withoutGlobalModelConfig(overlay) : overlay);
                    sources.push({
                        scope: scope,
                        path: path,
                        applied: true,
                        diagnostic: ignored.length
                            ? "ignored global-only settings: ".concat(ignored.join(", "))
                            : undefined,
                    });
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _f.sent();
                    sources.push({
                        scope: scope,
                        path: path,
                        applied: false,
                        diagnostic: "invalid_config: ".concat(configFailureReason(error_1)),
                    });
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6:
                    model = ((_e = input.environment) !== null && _e !== void 0 ? _e : process.env).NATALIA_MODEL;
                    if (model) {
                        config = contracts_1.configV3Schema.parse(__assign(__assign({}, config), { defaultModel: (0, contracts_1.parseModelRef)(model) }));
                        sources.push({
                            scope: "environment",
                            applied: true,
                            diagnostic: "NATALIA_MODEL",
                        });
                    }
                    return [2 /*return*/, { config: config, sources: sources, projectConfigPath: projectConfigPath }];
            }
        });
    });
}
function configFailureReason(error) {
    var _a, _b;
    var issues = error.issues;
    if (Array.isArray(issues) && issues.length) {
        var first = issues[0];
        var path = ((_a = first.path) !== null && _a !== void 0 ? _a : []).join(".");
        return "".concat(path ? "".concat(path, ": ") : "").concat((_b = first.message) !== null && _b !== void 0 ? _b : "invalid value").concat(issues.length > 1 ? " (+".concat(issues.length - 1, " more)") : "");
    }
    return error instanceof Error ? error.message : "parse_error";
}
function presentGlobalModelConfigKeys(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch))
        return [];
    return exports.GLOBAL_MODEL_CONFIG_KEYS.filter(function (key) { return Object.hasOwn(patch, key); });
}
function withoutGlobalModelConfig(patch) {
    return Object.fromEntries(Object.entries(patch).filter(function (_a) {
        var key = _a[0];
        return !globalModelConfigKeys.has(key);
    }));
}
function onlyGlobalModelConfig(patch) {
    return Object.fromEntries(Object.entries(patch).filter(function (_a) {
        var key = _a[0];
        return globalModelConfigKeys.has(key);
    }));
}
