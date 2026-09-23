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
exports.tuiConfigSchema = void 0;
exports.tuiConfigPath = tuiConfigPath;
exports.resolveTuiConfig = resolveTuiConfig;
exports.saveTuiConfig = saveTuiConfig;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var platform_1 = require("@natalia/platform");
var zod_1 = require("zod");
/**
 * The interface-preference config (theme, keybinds, density, ...). Lived
 * inside the TUI app until the settings surface was made public; it now lives
 * here so the runtime can serve it over RPC and any consumer can read the
 * same schema the TUI renders.
 */
var keybindValue = zod_1.z.union([
    zod_1.z.string(),
    zod_1.z.array(zod_1.z.string()),
    zod_1.z.literal(false),
]);
var keybindsSchema = zod_1.z.record(keybindValue).default({});
exports.tuiConfigSchema = zod_1.z.object({
    version: zod_1.z.literal(1).default(1),
    theme: zod_1.z.string().default("natalia-dark"),
    themeMode: zod_1.z.enum(["dark", "light", "system"]).default("dark"),
    keybinds: keybindsSchema,
    leaderKey: zod_1.z.string().min(1).default("ctrl+x"),
    leaderTimeoutMs: zod_1.z.number().int().positive().default(2000),
    toolDetails: zod_1.z.enum(["collapsed", "expanded"]).default("collapsed"),
    reasoning: zod_1.z.enum(["step", "hidden"]).default("step"),
    density: zod_1.z.enum(["comfortable", "compact"]).default("comfortable"),
    followBottom: zod_1.z.boolean().default(true),
    scrollSpeed: zod_1.z.number().positive().default(1),
    scrollAcceleration: zod_1.z.boolean().default(true),
    mouse: zod_1.z.boolean().default(true),
    prompt: zod_1.z
        .object({ maxHeight: zod_1.z.number().int().min(1).max(24).default(8) })
        .default({}),
    diffStyle: zod_1.z.enum(["auto", "stacked"]).default("auto"),
    attention: zod_1.z
        .object({
        enabled: zod_1.z.boolean().default(false),
        notifications: zod_1.z.boolean().default(true),
        sound: zod_1.z.boolean().default(false),
        volume: zod_1.z.number().min(0).max(1).default(0.4),
    })
        .default({}),
});
function tuiConfigPath(workspaceRoot, scope) {
    if (scope === "project")
        return (0, node_path_1.resolve)(workspaceRoot, ".natalia", "tui.json");
    // `resolve(process.env.HOME ?? "", ...)` collapsed to the *current directory*
    // on Windows, where HOME is normally unset. Global settings then silently
    // applied only inside whatever directory saved them, and Natalia scattered
    // `.config` trees into user repositories. globalConfigHome reproduces
    // `$HOME/.config` on POSIX and resolves `%APPDATA%` on Windows.
    return (0, node_path_1.resolve)((0, platform_1.globalConfigHome)(), "natalia-cli", "tui.json");
}
function resolveTuiConfig(workspaceRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var projectPath, globalPath, config, sources, _i, _a, _b, scope, path, raw, _c, _d, error_1;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    projectPath = tuiConfigPath(workspaceRoot, "project");
                    globalPath = tuiConfigPath(workspaceRoot, "global");
                    config = exports.tuiConfigSchema.parse({});
                    sources = [{ scope: "defaults", applied: true }];
                    _i = 0, _a = [
                        ["global", globalPath],
                        ["project", projectPath],
                    ];
                    _e.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    _b = _a[_i], scope = _b[0], path = _b[1];
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 4, , 5]);
                    _d = (_c = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 3:
                    raw = _d.apply(_c, [_e.sent()]);
                    config = exports.tuiConfigSchema.parse(__assign(__assign(__assign({}, config), raw), { prompt: __assign(__assign({}, config.prompt), raw.prompt), attention: __assign(__assign({}, config.attention), raw.attention), keybinds: __assign(__assign({}, config.keybinds), raw.keybinds) }));
                    sources.push({ scope: scope, path: path, applied: true });
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _e.sent();
                    if (error_1.code === "ENOENT")
                        sources.push({ scope: scope, path: path, applied: false, diagnostic: "missing" });
                    else
                        sources.push({
                            scope: scope,
                            path: path,
                            applied: false,
                            diagnostic: error_1 instanceof Error ? error_1.message : String(error_1),
                        });
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/, { config: config, sources: sources, projectPath: projectPath }];
            }
        });
    });
}
function saveTuiConfig(workspaceRoot_1, config_1) {
    return __awaiter(this, arguments, void 0, function (workspaceRoot, config, scope) {
        var path, parsed, temporary;
        if (scope === void 0) { scope = "project"; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    path = tuiConfigPath(workspaceRoot, scope);
                    parsed = exports.tuiConfigSchema.deepPartial().parse(config);
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true, mode: 448 })];
                case 1:
                    _a.sent();
                    temporary = "".concat(path, ".").concat(Date.now().toString(36), ".tmp");
                    return [4 /*yield*/, (0, promises_1.writeFile)(temporary, "".concat(JSON.stringify(parsed, null, 2), "\n"), {
                            mode: 384,
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.rename)(temporary, path)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
