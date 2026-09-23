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
exports.loadConfigFile = loadConfigFile;
exports.loadOrCreateConfigFile = loadOrCreateConfigFile;
exports.saveConfigFile = saveConfigFile;
exports.saveConfigOverlayFile = saveConfigOverlayFile;
exports.migrateConfigFile = migrateConfigFile;
exports.parseConfigText = parseConfigText;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var contracts_1 = require("@natalia/contracts");
var migration_1 = require("./migration");
var migration_2 = require("./migration");
function loadConfigFile(path) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 1:
                    raw = _a.sent();
                    data = parseConfigText(raw);
                    return [2 /*return*/, (0, migration_1.migrateConfig)(data)];
            }
        });
    });
}
function loadOrCreateConfigFile(path) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1, config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 4]);
                    return [4 /*yield*/, loadConfigFile(path)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_1 = _a.sent();
                    if (error_1.code !== "ENOENT")
                        throw error_1;
                    config = (0, migration_2.defaultConfigV3)();
                    return [4 /*yield*/, saveConfigFile(config, path)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, {
                            config: config,
                            summary: {
                                fromVersion: 3,
                                toVersion: 3,
                                changed: ["created default TS config"],
                                warnings: [],
                            },
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function saveConfigFile(config, path) {
    return __awaiter(this, void 0, void 0, function () {
        var parsed, temporary, handle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    parsed = contracts_1.configV3Schema.parse(config);
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true, mode: 448 })];
                case 1:
                    _a.sent();
                    temporary = "".concat(path, ".tmp-").concat((0, node_crypto_1.randomUUID)());
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 11, 13]);
                    return [4 /*yield*/, (0, promises_1.writeFile)(temporary, "".concat(JSON.stringify(parsed, null, 2), "\n"), {
                            mode: 384,
                        })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.open)(temporary, "r+")];
                case 4:
                    handle = _a.sent();
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, , 7, 9]);
                    return [4 /*yield*/, handle.sync()];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, handle.close()];
                case 8:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 9: return [4 /*yield*/, (0, promises_1.rename)(temporary, path)];
                case 10:
                    _a.sent();
                    return [3 /*break*/, 13];
                case 11: return [4 /*yield*/, (0, promises_1.rm)(temporary, { force: true }).catch(function () { return undefined; })];
                case 12:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 13: return [2 /*return*/];
            }
        });
    });
}
/** Persists a validated scope overlay without promoting resolved values. */
function saveConfigOverlayFile(path, overlay) {
    return __awaiter(this, void 0, void 0, function () {
        var temporary, handle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true, mode: 448 })];
                case 1:
                    _a.sent();
                    temporary = "".concat(path, ".tmp-").concat((0, node_crypto_1.randomUUID)());
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 11, 13]);
                    return [4 /*yield*/, (0, promises_1.writeFile)(temporary, "".concat(JSON.stringify(overlay, null, 2), "\n"), {
                            mode: 384,
                        })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.open)(temporary, "r+")];
                case 4:
                    handle = _a.sent();
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, , 7, 9]);
                    return [4 /*yield*/, handle.sync()];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, handle.close()];
                case 8:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 9: return [4 /*yield*/, (0, promises_1.rename)(temporary, path)];
                case 10:
                    _a.sent();
                    return [3 /*break*/, 13];
                case 11: return [4 /*yield*/, (0, promises_1.rm)(temporary, { force: true }).catch(function () { return undefined; })];
                case 12:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 13: return [2 /*return*/];
            }
        });
    });
}
function migrateConfigFile(path_1) {
    return __awaiter(this, arguments, void 0, function (path, now) {
        var raw, data, result, backupPath;
        if (now === void 0) { now = new Date(); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 1:
                    raw = _a.sent();
                    data = parseConfigText(raw);
                    result = (0, migration_1.migrateConfig)(data);
                    if (!(result.summary.fromVersion !== 3 || result.summary.changed.length)) return [3 /*break*/, 4];
                    backupPath = "".concat(path, ".bak.").concat(now.toISOString().replace(/[:.]/g, "-"));
                    return [4 /*yield*/, (0, promises_1.copyFile)(path, backupPath)];
                case 2:
                    _a.sent();
                    result.summary.backupPath = backupPath;
                    return [4 /*yield*/, saveConfigFile(result.config, path)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/, __assign(__assign({}, result), { text: (0, migration_1.migrationSummaryText)(result.summary) })];
            }
        });
    });
}
function parseConfigText(raw) {
    // A UTF-8 BOM from a Windows editor makes JSON.parse throw and also defeats
    // the `^\s*[\[{]` guard below, so a valid config would silently fall through
    // to the legacy YAML reader and parse into garbage. POSIX files have no BOM.
    var text = raw.replace(/^\uFEFF/u, "");
    try {
        return JSON.parse(text);
    }
    catch (error) {
        if (/^\s*[\[{]/u.test(text))
            throw error;
        return parseLegacyYamlSubset(text);
    }
}
function parseLegacyYamlSubset(raw) {
    var _a, _b;
    var root = {};
    var stack = [
        { indent: -1, value: root },
    ];
    for (var _i = 0, _c = raw.split("\n"); _i < _c.length; _i++) {
        var line = _c[_i];
        if (!line.trim() || line.trimStart().startsWith("#"))
            continue;
        var indent = (_b = (_a = line.match(/^\s*/u)) === null || _a === void 0 ? void 0 : _a[0].length) !== null && _b !== void 0 ? _b : 0;
        var match = line.trim().match(/^([^:]+):(.*)$/u);
        if (!match)
            continue;
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent)
            stack.pop();
        var parent_1 = stack[stack.length - 1].value;
        var key = match[1].trim();
        var rawValue = match[2].trim();
        if (!rawValue) {
            var child = {};
            parent_1[key] = child;
            stack.push({ indent: indent, value: child });
            continue;
        }
        parent_1[key] = parseScalar(rawValue);
    }
    return root;
}
function parseScalar(value) {
    var unquoted = value.replace(/^['"]|['"]$/gu, "");
    if (/^-?\d+$/u.test(unquoted))
        return Number(unquoted);
    if (unquoted === "true")
        return true;
    if (unquoted === "false")
        return false;
    if (unquoted === "null")
        return null;
    return unquoted;
}
